-- Revierte 20260924060000_saas_layout_engine_and_features. Antes, redesplegar un frontend que no
-- dependa de layout_variant/design_tokens/active_features (el actual los ignora si no llegan).
-- Un negocio con layout_key 'playful' debe moverse antes a otro layout o el CHECK restaurado fallará.

BEGIN;

DO $restore$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT definition FROM backup_20260924_pre_layout_engine.function_defs LOOP
    EXECUTE r.definition;
  END LOOP;
END;
$restore$;

ALTER POLICY store_categories_public_read ON public.store_categories USING (public.is_business_public(business_id));
ALTER POLICY store_categories_staff_insert ON public.store_categories WITH CHECK (public.has_business_role(business_id));
ALTER POLICY store_categories_staff_update ON public.store_categories
  USING (public.has_business_role(business_id)) WITH CHECK (public.has_business_role(business_id));
ALTER POLICY store_products_public_read ON public.store_products USING (public.is_business_public(business_id));
ALTER POLICY store_products_staff_insert ON public.store_products WITH CHECK (public.has_business_role(business_id));
ALTER POLICY store_products_staff_update ON public.store_products
  USING (public.has_business_role(business_id)) WITH CHECK (public.has_business_role(business_id));
ALTER POLICY gallery_photos_public_read ON public.gallery_photos USING (public.is_business_public(business_id));
ALTER POLICY gallery_photos_staff_insert ON public.gallery_photos WITH CHECK (public.has_business_role(business_id));
ALTER POLICY bookings_insert ON public.bookings
  WITH CHECK ((user_id = (SELECT auth.uid())) OR public.can_manage_barber(business_id, barber));

DROP TRIGGER IF EXISTS trg_sync_business_features ON public.businesses;
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_active_features_check,
  DROP COLUMN IF EXISTS active_features,
  DROP COLUMN IF EXISTS plan_code,
  DROP CONSTRAINT IF EXISTS businesses_layout_variant_fkey,
  DROP COLUMN IF EXISTS layout_variant,
  DROP COLUMN IF EXISTS design_tokens;
COMMENT ON COLUMN public.businesses.theme IS NULL;

ALTER TABLE public.businesses DROP CONSTRAINT businesses_layout_key_check;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_layout_key_check CHECK (layout_key IN ('classic', 'editorial', 'minimal'));

DROP FUNCTION IF EXISTS public.has_feature(uuid, text);
DROP FUNCTION IF EXISTS public.sync_business_features();
DROP TABLE IF EXISTS public.plans;
DROP TABLE IF EXISTS public.layout_variants;
DROP FUNCTION IF EXISTS public.is_valid_feature_set(jsonb, boolean);
DROP FUNCTION IF EXISTS public.feature_keys();
DROP FUNCTION IF EXISTS public.is_complete_design_tokens(jsonb);
DROP FUNCTION IF EXISTS public.is_valid_design_tokens(jsonb);
DROP FUNCTION IF EXISTS public.jsonb_deep_merge(jsonb, jsonb);

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260924060000';

COMMIT;
