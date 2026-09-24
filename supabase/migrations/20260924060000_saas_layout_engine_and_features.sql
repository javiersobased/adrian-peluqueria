-- Motor de temas (layout + variante + tokens de diseño) y sistema de planes (feature toggles).
--
-- 1. layout_variants: catálogo de las 20 variantes (4 layouts x 5) con sus tokens por defecto.
-- 2. businesses.layout_variant (FK compuesta con layout_key: una variante siempre pertenece a su layout).
-- 3. businesses.design_tokens: sobrescrituras del negocio sobre los tokens de la variante. Se validan
--    contra un esquema cerrado (colores hex, enumerados y fuentes de una lista blanca): nunca CSS libre.
-- 4. plans + businesses.plan_code + businesses.active_features (mapa completo y efectivo de módulos).
--    Cambiar de plan reinicia active_features a las del plan; los extras se añaden después a mano.
--    Solo service_role escribe en businesses/plans: un negocio no puede ampliarse el plan.
-- 5. has_feature() aplicado en RLS: tienda, galería y cita manual. Emails vía get_business_integration.
-- 6. resolve_business_by_host expone variante, tokens efectivos y módulos activos.
--
-- businesses.theme queda obsoleta (sin datos); se retirará cuando el frontend lea design_tokens.
-- Rollback: supabase/rollback/20260924060000_saas_layout_engine_and_features_down.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS backup_20260924_pre_layout_engine;
CREATE TABLE backup_20260924_pre_layout_engine.function_defs AS
SELECT p.oid::regprocedure::text AS signature, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('resolve_business_by_host', 'get_business_integration');
CREATE TABLE backup_20260924_pre_layout_engine.policies AS
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'store_categories_public_read', 'store_categories_staff_insert', 'store_categories_staff_update',
    'store_products_public_read', 'store_products_staff_insert', 'store_products_staff_update',
    'gallery_photos_public_read', 'gallery_photos_staff_insert', 'bookings_insert'
  );
REVOKE ALL ON SCHEMA backup_20260924_pre_layout_engine FROM PUBLIC, anon, authenticated;

-- 1. Utilidades de validación ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jsonb_deep_merge(p_base jsonb, p_override jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE PARALLEL SAFE
SET search_path TO ''
AS $function$
DECLARE
  v_result jsonb;
  v_key text;
BEGIN
  IF p_override IS NULL THEN
    RETURN p_base;
  END IF;
  IF p_base IS NULL OR jsonb_typeof(p_base) <> 'object' OR jsonb_typeof(p_override) <> 'object' THEN
    RETURN p_override;
  END IF;
  v_result := p_base;
  FOR v_key IN SELECT jsonb_object_keys(p_override) LOOP
    v_result := jsonb_set(v_result, ARRAY[v_key], public.jsonb_deep_merge(p_base -> v_key, p_override -> v_key), true);
  END LOOP;
  RETURN v_result;
END;
$function$;

-- Esquema cerrado de tokens. Claves desconocidas = inválido.
CREATE OR REPLACE FUNCTION public.is_valid_design_tokens(p_tokens jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE PARALLEL SAFE
SET search_path TO ''
AS $function$
DECLARE
  v_key text;
  v_value jsonb;
BEGIN
  IF p_tokens IS NULL OR jsonb_typeof(p_tokens) <> 'object' THEN
    RETURN false;
  END IF;

  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(p_tokens) LOOP
    CASE v_key
      WHEN 'palette' THEN
        IF jsonb_typeof(v_value) <> 'object' OR EXISTS (
          SELECT 1 FROM jsonb_each(v_value) e
          WHERE e.key NOT IN ('accent', 'accentLight', 'accentDark', 'accentContrast', 'surface', 'surfaceSoft',
                              'surfaceMuted', 'marble', 'text', 'textMuted', 'border')
             OR jsonb_typeof(e.value) <> 'string'
             OR (e.value #>> '{}') !~ '^#[0-9a-fA-F]{6}$'
        ) THEN
          RETURN false;
        END IF;
      WHEN 'fonts' THEN
        IF jsonb_typeof(v_value) <> 'object' OR EXISTS (
          SELECT 1 FROM jsonb_each(v_value) e
          WHERE e.key NOT IN ('display', 'body')
             OR jsonb_typeof(e.value) <> 'string'
             OR (e.value #>> '{}') NOT IN (
               'Inter', 'Plus Jakarta Sans', 'Manrope', 'DM Sans', 'Space Grotesk', 'Archivo', 'Syne',
               'Josefin Sans', 'Poppins', 'Nunito', 'Quicksand', 'Fredoka', 'Baloo 2', 'Oswald', 'Bebas Neue',
               'Fraunces', 'Playfair Display', 'Cormorant Garamond', 'DM Serif Display', 'Lora'
             )
        ) THEN
          RETURN false;
        END IF;
      WHEN 'radius' THEN
        IF jsonb_typeof(v_value) <> 'string' OR (v_value #>> '{}') NOT IN ('none', 'sm', 'md', 'lg', 'xl', 'full') THEN
          RETURN false;
        END IF;
      WHEN 'shadow' THEN
        IF jsonb_typeof(v_value) <> 'string' OR (v_value #>> '{}') NOT IN ('none', 'soft', 'medium', 'hard', 'glow') THEN
          RETURN false;
        END IF;
      WHEN 'material' THEN
        IF jsonb_typeof(v_value) <> 'string' OR (v_value #>> '{}') NOT IN ('matte', 'glass', 'paper', 'metal', 'neon') THEN
          RETURN false;
        END IF;
      WHEN 'density' THEN
        IF jsonb_typeof(v_value) <> 'string' OR (v_value #>> '{}') NOT IN ('compact', 'comfortable', 'spacious') THEN
          RETURN false;
        END IF;
      ELSE
        RETURN false;
    END CASE;
  END LOOP;

  RETURN true;
END;
$function$;

-- Los tokens por defecto de una variante deben definir todo (el negocio solo sobrescribe).
CREATE OR REPLACE FUNCTION public.is_complete_design_tokens(p_tokens jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
SET search_path TO ''
AS $function$
  SELECT public.is_valid_design_tokens(p_tokens)
     AND p_tokens ?& ARRAY['palette', 'fonts', 'radius', 'shadow', 'material', 'density']
     AND (p_tokens -> 'palette') ?& ARRAY['accent', 'accentLight', 'accentDark', 'accentContrast', 'surface',
                                         'surfaceSoft', 'surfaceMuted', 'marble', 'text', 'textMuted', 'border']
     AND (p_tokens -> 'fonts') ?& ARRAY['display', 'body']
$function$;

CREATE OR REPLACE FUNCTION public.feature_keys()
RETURNS text[]
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
SET search_path TO ''
AS $function$
  SELECT ARRAY['has_store', 'has_gallery', 'allow_manual_booking', 'enable_emails',
               'enable_campaigns', 'enable_pwa', 'enable_seo_advanced']
$function$;

CREATE OR REPLACE FUNCTION public.is_valid_feature_set(p_features jsonb, p_complete boolean)
RETURNS boolean
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
SET search_path TO ''
AS $function$
  SELECT p_features IS NOT NULL
     AND jsonb_typeof(p_features) = 'object'
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_each(p_features) e
       WHERE NOT (e.key = ANY (public.feature_keys())) OR jsonb_typeof(e.value) <> 'boolean'
     )
     AND (NOT p_complete OR p_features ?& public.feature_keys())
$function$;

-- 2. Catálogo de variantes ---------------------------------------------------------------------

ALTER TABLE public.businesses DROP CONSTRAINT businesses_layout_key_check;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_layout_key_check CHECK (layout_key IN ('classic', 'minimal', 'editorial', 'playful'));

CREATE TABLE public.layout_variants (
  key text PRIMARY KEY CHECK (key ~ '^[a-z]+_[a-z]+$'),
  layout_key text NOT NULL CHECK (layout_key IN ('classic', 'minimal', 'editorial', 'playful')),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  description text NOT NULL DEFAULT '',
  default_tokens jsonb NOT NULL CHECK (public.is_complete_design_tokens(default_tokens)),
  is_available boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0,
  CONSTRAINT layout_variants_layout_key_key UNIQUE (layout_key, key),
  CONSTRAINT layout_variants_prefix_check CHECK (split_part(key, '_', 1) = layout_key)
);

ALTER TABLE public.layout_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY layout_variants_public_read ON public.layout_variants
  FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.layout_variants FROM anon, authenticated;

-- classic_prestige reproduce exactamente los tokens actuales de la web de Adrián (src/index.css).
INSERT INTO public.layout_variants (key, layout_key, name, description, sort_order, default_tokens) VALUES
('classic_heritage', 'classic', 'Heritage', 'Madera y vintage', 10,
 '{"palette":{"accent":"#b07d48","accentLight":"#cf9d69","accentDark":"#8a5f33","accentContrast":"#1c140d","surface":"#1c140d","surfaceSoft":"#261b12","surfaceMuted":"#32241a","marble":"#f3eadd","text":"#efe4d4","textMuted":"#b8a58c","border":"#4a3726"},"fonts":{"display":"Playfair Display","body":"Lora"},"radius":"sm","shadow":"medium","material":"paper","density":"comfortable"}'),
('classic_industrial', 'classic', 'Industrial', 'Metal y urbano', 20,
 '{"palette":{"accent":"#e07a2f","accentLight":"#f0995a","accentDark":"#b35e1f","accentContrast":"#0f1113","surface":"#15181b","surfaceSoft":"#1d2125","surfaceMuted":"#272c31","marble":"#e6e8ea","text":"#e3e6e8","textMuted":"#8e979f","border":"#3a4148"},"fonts":{"display":"Oswald","body":"Archivo"},"radius":"none","shadow":"hard","material":"metal","density":"compact"}'),
('classic_prestige', 'classic', 'Prestige', 'Lujo y dorado', 30,
 '{"palette":{"accent":"#d4af37","accentLight":"#e6c84e","accentDark":"#b8941f","accentContrast":"#0a0a0a","surface":"#0a0a0a","surfaceSoft":"#121212","surfaceMuted":"#1a1a1a","marble":"#f5f3f0","text":"#e4e4e7","textMuted":"#a1a1aa","border":"#27272a"},"fonts":{"display":"Plus Jakarta Sans","body":"Inter"},"radius":"xl","shadow":"soft","material":"glass","density":"comfortable"}'),
('classic_street', 'classic', 'Street', 'Urbano y neón', 40,
 '{"palette":{"accent":"#39ff88","accentLight":"#7dffb0","accentDark":"#1fcc63","accentContrast":"#050608","surface":"#07080b","surfaceSoft":"#0e1016","surfaceMuted":"#161a22","marble":"#eef1f6","text":"#f1f4f8","textMuted":"#8b93a3","border":"#252b37"},"fonts":{"display":"Bebas Neue","body":"Space Grotesk"},"radius":"md","shadow":"glow","material":"neon","density":"compact"}'),
('classic_club', 'classic', 'Club', 'Deportivo y dinámico', 50,
 '{"palette":{"accent":"#e63946","accentLight":"#f06b75","accentDark":"#b82530","accentContrast":"#ffffff","surface":"#0d1b2a","surfaceSoft":"#13253a","surfaceMuted":"#1b3049","marble":"#f1f4f8","text":"#f1f4f8","textMuted":"#9fb0c3","border":"#284160"},"fonts":{"display":"Archivo","body":"Manrope"},"radius":"lg","shadow":"medium","material":"matte","density":"compact"}'),

('minimal_clinic', 'minimal', 'Clinic', 'Blanco, estéril y azul', 10,
 '{"palette":{"accent":"#2563eb","accentLight":"#60a5fa","accentDark":"#1d4ed8","accentContrast":"#ffffff","surface":"#ffffff","surfaceSoft":"#f8fafc","surfaceMuted":"#eef2f7","marble":"#ffffff","text":"#0f172a","textMuted":"#64748b","border":"#e2e8f0"},"fonts":{"display":"Manrope","body":"Inter"},"radius":"lg","shadow":"soft","material":"matte","density":"spacious"}'),
('minimal_spa', 'minimal', 'Spa', 'Zen, tierra y pastel', 20,
 '{"palette":{"accent":"#a47e5f","accentLight":"#c9a88b","accentDark":"#7d5c42","accentContrast":"#ffffff","surface":"#f6f1ea","surfaceSoft":"#efe7dc","surfaceMuted":"#e6dacb","marble":"#fbf8f3","text":"#3b3129","textMuted":"#8a7b6c","border":"#ddd0bf"},"fonts":{"display":"Cormorant Garamond","body":"Nunito"},"radius":"xl","shadow":"soft","material":"paper","density":"spacious"}'),
('minimal_luxury', 'minimal', 'Luxury', 'Mármol y oro rosa', 30,
 '{"palette":{"accent":"#b76e79","accentLight":"#d49aa2","accentDark":"#94525c","accentContrast":"#ffffff","surface":"#fbf9f7","surfaceSoft":"#f4efeb","surfaceMuted":"#ece4de","marble":"#f7f3ef","text":"#2d2426","textMuted":"#8c7b7e","border":"#e5d9d2"},"fonts":{"display":"Playfair Display","body":"DM Sans"},"radius":"md","shadow":"soft","material":"glass","density":"spacious"}'),
('minimal_botanical', 'minimal', 'Botanical', 'Verde y natural', 40,
 '{"palette":{"accent":"#4f7a52","accentLight":"#7aa37c","accentDark":"#365a39","accentContrast":"#ffffff","surface":"#f4f6ef","surfaceSoft":"#ebefe3","surfaceMuted":"#dfe6d4","marble":"#fafbf6","text":"#243024","textMuted":"#6b7a67","border":"#d3dcc6"},"fonts":{"display":"Fraunces","body":"DM Sans"},"radius":"full","shadow":"none","material":"paper","density":"comfortable"}'),
('minimal_chic', 'minimal', 'Chic', 'Monocromático y moda', 50,
 '{"palette":{"accent":"#111111","accentLight":"#3a3a3a","accentDark":"#000000","accentContrast":"#ffffff","surface":"#ffffff","surfaceSoft":"#f5f5f5","surfaceMuted":"#e9e9e9","marble":"#fafafa","text":"#111111","textMuted":"#6e6e6e","border":"#dedede"},"fonts":{"display":"Syne","body":"Inter"},"radius":"none","shadow":"none","material":"matte","density":"spacious"}'),

('editorial_magazine', 'editorial', 'Magazine', 'Asimétrico y tipografía grande', 10,
 '{"palette":{"accent":"#c9a980","accentLight":"#e0c7a4","accentDark":"#9e7c56","accentContrast":"#171411","surface":"#171411","surfaceSoft":"#1f1b17","surfaceMuted":"#2a251f","marble":"#f3ede2","text":"#f3ede2","textMuted":"#a89c8c","border":"#3a332b"},"fonts":{"display":"Fraunces","body":"Inter"},"radius":"none","shadow":"none","material":"paper","density":"spacious"}'),
('editorial_studio', 'editorial', 'Studio', 'Vibrante y creativo', 20,
 '{"palette":{"accent":"#ff5c39","accentLight":"#ff8a6e","accentDark":"#d63f1f","accentContrast":"#ffffff","surface":"#fffaf5","surfaceSoft":"#fff1e6","surfaceMuted":"#ffe4d1","marble":"#ffffff","text":"#1d1a2e","textMuted":"#6c6780","border":"#f1d9c6"},"fonts":{"display":"Syne","body":"Manrope"},"radius":"lg","shadow":"hard","material":"matte","density":"comfortable"}'),
('editorial_gallery', 'editorial', 'Gallery', 'Visual y cajas grandes', 30,
 '{"palette":{"accent":"#e8e2d6","accentLight":"#ffffff","accentDark":"#bdb5a6","accentContrast":"#0c0c0c","surface":"#0c0c0c","surfaceSoft":"#141414","surfaceMuted":"#1e1e1e","marble":"#f2f0eb","text":"#f2f0eb","textMuted":"#8f8b84","border":"#2b2b2b"},"fonts":{"display":"DM Serif Display","body":"DM Sans"},"radius":"none","shadow":"none","material":"matte","density":"spacious"}'),
('editorial_fluid', 'editorial', 'Fluid', 'Formas suaves y moderno', 40,
 '{"palette":{"accent":"#7c5cff","accentLight":"#a58fff","accentDark":"#5a3de0","accentContrast":"#ffffff","surface":"#f7f5ff","surfaceSoft":"#efebff","surfaceMuted":"#e4defc","marble":"#ffffff","text":"#1e1a33","textMuted":"#6e6991","border":"#ddd6fb"},"fonts":{"display":"Plus Jakarta Sans","body":"Inter"},"radius":"full","shadow":"soft","material":"glass","density":"comfortable"}'),
('editorial_pop', 'editorial', 'Pop', 'Colores de alto contraste', 50,
 '{"palette":{"accent":"#ff2d95","accentLight":"#ff6fb5","accentDark":"#d10f73","accentContrast":"#ffffff","surface":"#fff200","surfaceSoft":"#fff566","surfaceMuted":"#ffe600","marble":"#ffffff","text":"#111111","textMuted":"#3d3d3d","border":"#111111"},"fonts":{"display":"Bebas Neue","body":"Space Grotesk"},"radius":"sm","shadow":"hard","material":"matte","density":"compact"}'),

('playful_paws', 'playful', 'Paws', 'Cálido y amigable para mascotas', 10,
 '{"palette":{"accent":"#f59e0b","accentLight":"#fbbf24","accentDark":"#d97706","accentContrast":"#3b2506","surface":"#fffbeb","surfaceSoft":"#fef3c7","surfaceMuted":"#fde68a","marble":"#ffffff","text":"#3b2506","textMuted":"#8a6a3b","border":"#f6dc9b"},"fonts":{"display":"Fredoka","body":"Nunito"},"radius":"xl","shadow":"soft","material":"matte","density":"comfortable"}'),
('playful_boutique', 'playful', 'Boutique', 'Coqueto y elegante', 20,
 '{"palette":{"accent":"#d9467a","accentLight":"#ea7ea3","accentDark":"#b02d5d","accentContrast":"#ffffff","surface":"#fff5f8","surfaceSoft":"#ffe9f0","surfaceMuted":"#fcd9e5","marble":"#ffffff","text":"#3a1b27","textMuted":"#8d6474","border":"#f6cddb"},"fonts":{"display":"Playfair Display","body":"Quicksand"},"radius":"lg","shadow":"soft","material":"glass","density":"comfortable"}'),
('playful_nature', 'playful', 'Nature', 'Campo y aire libre', 30,
 '{"palette":{"accent":"#3f8f5b","accentLight":"#6bb383","accentDark":"#2b6a41","accentContrast":"#ffffff","surface":"#f3f8ef","surfaceSoft":"#e7f1df","surfaceMuted":"#d6e7c9","marble":"#fbfdf9","text":"#1f3324","textMuted":"#5f7a65","border":"#cfe1c1"},"fonts":{"display":"Baloo 2","body":"Nunito"},"radius":"xl","shadow":"none","material":"paper","density":"comfortable"}'),
('playful_bubble', 'playful', 'Bubble', 'Burbujas y pastel', 40,
 '{"palette":{"accent":"#38bdf8","accentLight":"#7dd3fc","accentDark":"#0284c7","accentContrast":"#082f49","surface":"#f0f9ff","surfaceSoft":"#e0f2fe","surfaceMuted":"#bae6fd","marble":"#ffffff","text":"#0c2a3d","textMuted":"#4f7187","border":"#c7e7fa"},"fonts":{"display":"Fredoka","body":"Quicksand"},"radius":"full","shadow":"soft","material":"glass","density":"spacious"}'),
('playful_vibrant', 'playful', 'Vibrant', 'Colores intensos y divertidos', 50,
 '{"palette":{"accent":"#8b5cf6","accentLight":"#a78bfa","accentDark":"#6d28d9","accentContrast":"#ffffff","surface":"#fdf4ff","surfaceSoft":"#fae8ff","surfaceMuted":"#f5d0fe","marble":"#ffffff","text":"#2e1065","textMuted":"#7c5a9e","border":"#ecc8fb"},"fonts":{"display":"Baloo 2","body":"Poppins"},"radius":"xl","shadow":"hard","material":"matte","density":"comfortable"}');

-- 3. Variante y tokens por negocio ---------------------------------------------------------------

ALTER TABLE public.businesses ADD COLUMN layout_variant text;
UPDATE public.businesses SET layout_variant = CASE layout_key
  WHEN 'classic' THEN 'classic_prestige'
  WHEN 'editorial' THEN 'editorial_magazine'
  WHEN 'minimal' THEN 'minimal_clinic'
END;
ALTER TABLE public.businesses
  ALTER COLUMN layout_variant SET DEFAULT 'classic_heritage',
  ALTER COLUMN layout_variant SET NOT NULL,
  ADD CONSTRAINT businesses_layout_variant_fkey
    FOREIGN KEY (layout_key, layout_variant) REFERENCES public.layout_variants (layout_key, key) ON UPDATE CASCADE;

-- Adrián vuelve a su web clásica (la prueba con editorial queda descartada).
UPDATE public.businesses
SET layout_key = 'classic', layout_variant = 'classic_prestige', updated_at = now()
WHERE id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a';

ALTER TABLE public.businesses
  ADD COLUMN design_tokens jsonb NOT NULL DEFAULT '{}'::jsonb
  CONSTRAINT businesses_design_tokens_check CHECK (public.is_valid_design_tokens(design_tokens));

COMMENT ON COLUMN public.businesses.theme IS 'Obsoleta: sustituida por design_tokens. Se retirará con el frontend del motor de temas.';
COMMENT ON COLUMN public.businesses.design_tokens IS 'Sobrescrituras del negocio sobre layout_variants.default_tokens (validadas por is_valid_design_tokens).';

-- 4. Planes y módulos ----------------------------------------------------------------------------

CREATE TABLE public.plans (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text NOT NULL,
  features jsonb NOT NULL CHECK (public.is_valid_feature_set(features, true)),
  sort_order smallint NOT NULL DEFAULT 0
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plans FROM anon, authenticated;

INSERT INTO public.plans (code, name, sort_order, features) VALUES
('basic', 'Básico', 10,
 '{"has_store":false,"has_gallery":true,"allow_manual_booking":true,"enable_emails":false,"enable_campaigns":false,"enable_pwa":true,"enable_seo_advanced":false}'),
('pro', 'Profesional', 20,
 '{"has_store":true,"has_gallery":true,"allow_manual_booking":true,"enable_emails":true,"enable_campaigns":false,"enable_pwa":true,"enable_seo_advanced":true}'),
('premium', 'Premium', 30,
 '{"has_store":true,"has_gallery":true,"allow_manual_booking":true,"enable_emails":true,"enable_campaigns":true,"enable_pwa":true,"enable_seo_advanced":true}');

ALTER TABLE public.businesses
  ADD COLUMN plan_code text NOT NULL DEFAULT 'basic'
    CONSTRAINT businesses_plan_code_fkey REFERENCES public.plans (code) ON UPDATE CASCADE,
  ADD COLUMN active_features jsonb NOT NULL DEFAULT '{}'::jsonb;

-- active_features es siempre el mapa completo: al crear o cambiar de plan se rellena desde el plan;
-- editarlo a mano solo altera las claves indicadas (extras o recortes sobre el plan).
CREATE OR REPLACE FUNCTION public.sync_business_features()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_plan jsonb;
BEGIN
  SELECT p.features INTO v_plan FROM public.plans p WHERE p.code = NEW.plan_code;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Plan % inexistente', NEW.plan_code;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.plan_code IS DISTINCT FROM OLD.plan_code
     AND NEW.active_features IS NOT DISTINCT FROM OLD.active_features THEN
    NEW.active_features := v_plan;
  ELSE
    NEW.active_features := v_plan || coalesce(NEW.active_features, '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_business_features() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_business_features
  BEFORE INSERT OR UPDATE OF plan_code, active_features ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.sync_business_features();

UPDATE public.businesses SET plan_code = 'premium' WHERE id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a';
UPDATE public.businesses SET plan_code = 'pro' WHERE id <> 'f67af497-5e58-48a2-8bea-022c4f1d7e1a';

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_active_features_check CHECK (public.is_valid_feature_set(active_features, true));

CREATE OR REPLACE FUNCTION public.has_feature(p_business_id uuid, p_feature text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT coalesce((
    SELECT (b.active_features ->> p_feature)::boolean FROM public.businesses b WHERE b.id = p_business_id
  ), false)
$function$;

-- 5. Módulos aplicados en el backend -------------------------------------------------------------

ALTER POLICY store_categories_public_read ON public.store_categories
  USING (public.is_business_public(business_id) AND public.has_feature(business_id, 'has_store'));
ALTER POLICY store_categories_staff_insert ON public.store_categories
  WITH CHECK (public.has_business_role(business_id) AND public.has_feature(business_id, 'has_store'));
ALTER POLICY store_categories_staff_update ON public.store_categories
  USING (public.has_business_role(business_id))
  WITH CHECK (public.has_business_role(business_id) AND public.has_feature(business_id, 'has_store'));

ALTER POLICY store_products_public_read ON public.store_products
  USING (public.is_business_public(business_id) AND public.has_feature(business_id, 'has_store'));
ALTER POLICY store_products_staff_insert ON public.store_products
  WITH CHECK (public.has_business_role(business_id) AND public.has_feature(business_id, 'has_store'));
ALTER POLICY store_products_staff_update ON public.store_products
  USING (public.has_business_role(business_id))
  WITH CHECK (public.has_business_role(business_id) AND public.has_feature(business_id, 'has_store'));

ALTER POLICY gallery_photos_public_read ON public.gallery_photos
  USING (public.is_business_public(business_id) AND public.has_feature(business_id, 'has_gallery'));
ALTER POLICY gallery_photos_staff_insert ON public.gallery_photos
  WITH CHECK (public.has_business_role(business_id) AND public.has_feature(business_id, 'has_gallery'));

-- El personal solo crea citas para terceros (cita manual) si el plan lo incluye.
ALTER POLICY bookings_insert ON public.bookings
  WITH CHECK (
    (user_id = (SELECT auth.uid()))
    OR (public.can_manage_barber(business_id, barber) AND public.has_feature(business_id, 'allow_manual_booking'))
  );

CREATE OR REPLACE FUNCTION public.get_business_integration(p_business_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'business_id', b.id,
    'name', b.name,
    'slug', b.slug,
    'status', b.status,
    'timezone', b.timezone,
    'is_legacy', b.id = public.legacy_business_id(),
    'features', b.active_features,
    'email_from', i.email_from,
    'email_reply_to', i.email_reply_to,
    'site_url', coalesce(
      i.site_url,
      (SELECT 'https://' || d.hostname FROM public.business_domains d
       WHERE d.business_id = b.id AND d.is_primary AND d.status = 'active' LIMIT 1)
    ),
    'onesignal_app_id', i.onesignal_app_id,
    'resend_api_key', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = i.resend_api_key_secret),
    'onesignal_api_key', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = i.onesignal_api_key_secret)
  )
  FROM public.businesses b
  LEFT JOIN public.business_integrations i ON i.business_id = b.id
  WHERE b.id = p_business_id
$function$;

-- 6. Configuración pública por dominio -----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_business_by_host(p_hostname text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH h AS (
    SELECT regexp_replace(regexp_replace(lower(btrim(coalesce(p_hostname, ''))), ':[0-9]+$', ''), '\.$', '') AS host
  )
  SELECT jsonb_build_object(
    'id', b.id,
    'slug', b.slug,
    'name', b.name,
    'timezone', b.timezone,
    'locale', b.locale,
    'currency', b.currency,
    'layout_key', b.layout_key,
    'layout_variant', b.layout_variant,
    'design_tokens', public.jsonb_deep_merge(v.default_tokens, b.design_tokens),
    'active_features', b.active_features,
    'slot_interval_minutes', b.slot_interval_minutes,
    'theme', b.theme,
    'public_config', b.public_config,
    'contact', b.contact,
    'hostname', d.hostname,
    'is_primary_domain', d.is_primary
  )
  FROM h
  JOIN public.business_domains d ON d.hostname = h.host
  JOIN public.businesses b ON b.id = d.business_id
  JOIN public.layout_variants v ON v.key = b.layout_variant
  WHERE length(h.host) BETWEEN 1 AND 253
    AND d.status = 'active'
    AND d.verified_at IS NOT NULL
    AND b.status = 'active'
$function$;

-- Pruebas de puerta: cualquier fallo aborta la transacción completa ------------------------------

DO $gate$
DECLARE
  v_legacy uuid := 'f67af497-5e58-48a2-8bea-022c4f1d7e1a';
  v_resolved jsonb;
  v_count integer;
  v_msg text;
BEGIN
  IF (SELECT count(*) FROM public.layout_variants) <> 20
     OR EXISTS (SELECT 1 FROM public.layout_variants GROUP BY layout_key HAVING count(*) <> 5) THEN
    RAISE EXCEPTION 'gate: el catálogo no tiene 4 layouts x 5 variantes';
  END IF;

  -- classic_prestige reproduce los tokens actuales de la web clásica (src/index.css).
  IF (SELECT default_tokens #>> '{palette,accent}' FROM public.layout_variants WHERE key = 'classic_prestige') <> '#d4af37'
     OR (SELECT default_tokens #>> '{palette,surface}' FROM public.layout_variants WHERE key = 'classic_prestige') <> '#0a0a0a'
     OR (SELECT default_tokens #>> '{fonts,display}' FROM public.layout_variants WHERE key = 'classic_prestige') <> 'Plus Jakarta Sans' THEN
    RAISE EXCEPTION 'gate: classic_prestige no reproduce los tokens de la web clásica';
  END IF;

  -- Cada negocio conserva su layout y recibe los tokens completos de su variante.
  v_resolved := public.resolve_business_by_host('www.adrianmillan.es');
  IF v_resolved ->> 'layout_key' <> (SELECT layout_key FROM public.businesses WHERE id = v_legacy)
     OR v_resolved ->> 'layout_variant' <> (SELECT layout_variant FROM public.businesses WHERE id = v_legacy)
     OR v_resolved -> 'design_tokens' <> (SELECT default_tokens FROM public.layout_variants WHERE key = v_resolved ->> 'layout_variant')
     OR NOT public.is_complete_design_tokens(v_resolved -> 'design_tokens') THEN
    RAISE EXCEPTION 'gate: el negocio heredado no recibe los tokens de su variante: %', v_resolved;
  END IF;
  IF v_resolved ->> 'layout_key' <> 'classic' OR v_resolved ->> 'layout_variant' <> 'classic_prestige'
     OR v_resolved #>> '{design_tokens,palette,accent}' <> '#d4af37' THEN
    RAISE EXCEPTION 'gate: Adrián no quedó en classic_prestige: %', v_resolved ->> 'layout_variant';
  END IF;
  IF (SELECT plan_code FROM public.businesses WHERE id = v_legacy) <> 'premium'
     OR EXISTS (SELECT 1 FROM jsonb_each(v_resolved -> 'active_features') e WHERE e.value <> 'true'::jsonb)
     OR NOT public.is_valid_feature_set(v_resolved -> 'active_features', true) THEN
    RAISE EXCEPTION 'gate: Adrián no tiene todos los módulos activos';
  END IF;

  -- Sobrescritura parcial: se mezcla con la variante sin perder el resto de tokens.
  IF public.jsonb_deep_merge('{"palette":{"accent":"#000000","text":"#111111"},"radius":"lg"}',
                             '{"palette":{"accent":"#ffffff"},"material":"glass"}')
     <> '{"palette":{"accent":"#ffffff","text":"#111111"},"radius":"lg","material":"glass"}'::jsonb THEN
    RAISE EXCEPTION 'gate: jsonb_deep_merge no mezcla en profundidad';
  END IF;

  -- Tokens fuera del esquema, variante de otro layout y features desconocidas se rechazan.
  BEGIN
    UPDATE public.businesses SET design_tokens = '{"palette":{"accent":"red"}}' WHERE id = v_legacy;
    RAISE EXCEPTION 'gate: se aceptó un color no hexadecimal';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.businesses SET design_tokens = '{"css":"body{display:none}"}' WHERE id = v_legacy;
    RAISE EXCEPTION 'gate: se aceptó una clave de tokens desconocida';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.businesses SET design_tokens = '{"fonts":{"display":"Comic Sans MS"}}' WHERE id = v_legacy;
    RAISE EXCEPTION 'gate: se aceptó una fuente fuera de la lista';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.businesses SET layout_key = CASE WHEN layout_key = 'minimal' THEN 'classic' ELSE 'minimal' END
    WHERE id = v_legacy;
    RAISE EXCEPTION 'gate: se aceptó una variante de otro layout';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.businesses SET active_features = '{"has_casino":true}' WHERE id = v_legacy;
    RAISE EXCEPTION 'gate: se aceptó un módulo desconocido';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Cambiar de plan y sus efectos en RLS: se comprueba y se deshace con un error centinela.
  BEGIN
    UPDATE public.businesses SET plan_code = 'basic' WHERE id = v_legacy;
    IF public.has_feature(v_legacy, 'has_store') OR NOT public.has_feature(v_legacy, 'has_gallery') THEN
      RAISE EXCEPTION 'gate: el plan básico no se aplicó';
    END IF;
    UPDATE public.businesses SET active_features = '{"has_store":true}' WHERE id = v_legacy;
    IF NOT public.has_feature(v_legacy, 'has_store') OR public.has_feature(v_legacy, 'enable_emails') THEN
      RAISE EXCEPTION 'gate: el extra sobre el plan no se aplicó';
    END IF;
    UPDATE public.businesses SET active_features = '{"has_store":false}' WHERE id = v_legacy;

    EXECUTE 'SET LOCAL ROLE anon';
    SELECT count(*) INTO v_count FROM public.store_products WHERE business_id = v_legacy;
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'gate: la tienda desactivada sigue visible al público';
    END IF;
    BEGIN
      SELECT count(*) INTO v_count FROM public.plans;
      RAISE EXCEPTION 'gate: los planes son legibles por anon';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RAISE EXCEPTION 'gate_rollback_ok';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg <> 'gate_rollback_ok' THEN
      RAISE EXCEPTION '%', v_msg;
    END IF;
  END;

  IF NOT public.has_feature(v_legacy, 'has_store') OR public.has_feature(v_legacy, 'no_existe')
     OR public.has_feature(gen_random_uuid(), 'has_store') THEN
    RAISE EXCEPTION 'gate: has_feature devuelve un valor inesperado';
  END IF;

  EXECUTE 'SET LOCAL ROLE anon';
  SELECT count(*) INTO v_count FROM public.store_products WHERE business_id = v_legacy;
  EXECUTE 'RESET ROLE';
  IF v_count = 0 AND EXISTS (SELECT 1 FROM public.store_products WHERE business_id = v_legacy) THEN
    RAISE EXCEPTION 'gate: la tienda de Adrián dejó de ser visible';
  END IF;
END;
$gate$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260924060000', 'saas_layout_engine_and_features');

COMMIT;
