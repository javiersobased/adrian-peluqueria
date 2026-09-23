-- Revierte el Paso 5 en base de datos. Con VITE_SAAS_MODE apagado el frontend sigue
-- funcionando sin esta RPC (usa el tenant heredado); con el flag encendido mostraría "no encontrado".

BEGIN;

DROP FUNCTION IF EXISTS public.resolve_business_by_host(text);

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260924020000';

NOTIFY pgrst, 'reload schema';

COMMIT;
