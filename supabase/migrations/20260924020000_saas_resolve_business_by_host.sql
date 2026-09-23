-- SaaS multi-tenant · Paso 5 (resolución del negocio por dominio).
-- Coincidencia exacta del hostname normalizado contra dominios verificados y activos de
-- negocios activos. Solo devuelve configuración pública; business_domains sigue sin políticas.
-- Rollback: supabase/rollback/20260924020000_saas_resolve_business_by_host_down.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_business_by_host(p_hostname text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
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
    'theme', b.theme,
    'public_config', b.public_config,
    'contact', b.contact,
    'hostname', d.hostname,
    'is_primary_domain', d.is_primary
  )
  FROM h
  JOIN public.business_domains d ON d.hostname = h.host
  JOIN public.businesses b ON b.id = d.business_id
  WHERE length(h.host) BETWEEN 1 AND 253
    AND d.status = 'active'
    AND d.verified_at IS NOT NULL
    AND b.status = 'active'
$$;

REVOKE ALL ON FUNCTION public.resolve_business_by_host(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_business_by_host(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
