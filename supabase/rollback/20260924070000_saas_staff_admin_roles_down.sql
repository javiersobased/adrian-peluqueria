-- Revierte 20260924070000_saas_staff_admin_roles. Los roles concedidos (set_barber_admin, onboarding
-- de plataforma) se conservan como filas normales de staff; desaparecen el RPC, las protecciones, la
-- titularidad, la auditoría y el alta automática de la plataforma en negocios nuevos.

BEGIN;

DO $restore$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT definition FROM backup_20260924_pre_staff_roles.function_defs LOOP
    EXECUTE r.definition;
  END LOOP;
END;
$restore$;

DROP FUNCTION IF EXISTS public.platform_grant_business_admin(uuid, text, text, boolean);
DROP FUNCTION IF EXISTS public.set_barber_admin(uuid, text, boolean);
DROP TRIGGER IF EXISTS trg_log_staff_role_change ON public.staff;
DROP TRIGGER IF EXISTS trg_guard_staff_roles ON public.staff;
DROP TRIGGER IF EXISTS trg_add_platform_admins ON public.businesses;
DROP TRIGGER IF EXISTS trg_add_platform_admin_to_businesses ON public.platform_admins;
DROP FUNCTION IF EXISTS public.add_platform_admins_to_business();
DROP FUNCTION IF EXISTS public.log_staff_role_change();
DROP FUNCTION IF EXISTS public.guard_staff_roles();
DROP TABLE IF EXISTS public.staff_role_events;
DROP FUNCTION IF EXISTS public.is_business_owner(uuid);
DROP FUNCTION IF EXISTS public.is_platform_admin();
DROP TABLE IF EXISTS public.platform_admins;
ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_owner_is_admin_check,
  DROP COLUMN IF EXISTS is_owner;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260924070000';

COMMIT;
