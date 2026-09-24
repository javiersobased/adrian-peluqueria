-- Revierte 20260924070000_saas_staff_admin_roles. Los roles concedidos con set_barber_admin se
-- conservan (son filas normales de staff); solo desaparecen el RPC, las protecciones y la auditoría.

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

DROP FUNCTION IF EXISTS public.set_barber_admin(uuid, text, boolean);
DROP TRIGGER IF EXISTS trg_log_staff_role_change ON public.staff;
DROP TRIGGER IF EXISTS trg_guard_staff_roles ON public.staff;
DROP FUNCTION IF EXISTS public.log_staff_role_change();
DROP FUNCTION IF EXISTS public.guard_staff_roles();
DROP TABLE IF EXISTS public.staff_role_events;
DROP FUNCTION IF EXISTS public.is_business_owner(uuid);
ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_owner_is_admin_check,
  DROP COLUMN IF EXISTS is_owner;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260924070000';

COMMIT;
