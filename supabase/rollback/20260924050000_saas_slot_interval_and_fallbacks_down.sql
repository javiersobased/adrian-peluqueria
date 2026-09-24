-- Revierte 20260924050000_saas_slot_interval_and_fallbacks restaurando las definiciones guardadas
-- en backup_20260924_pre_step8.function_defs. Antes, redesplegar el frontend anterior si se
-- depende de slot_interval_minutes (el actual usa 10 si el campo no llega).

BEGIN;

DROP TRIGGER IF EXISTS trg_prevent_delete_owner_barber ON public.barbers;
DROP FUNCTION IF EXISTS public.prevent_delete_owner_barber();

DO $restore$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT definition FROM backup_20260924_pre_step8.function_defs LOOP
    EXECUTE r.definition;
  END LOOP;
END;
$restore$;

CREATE TRIGGER trg_prevent_delete_adrian
  BEFORE DELETE ON public.barbers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_adrian();

DROP FUNCTION IF EXISTS public.booking_time_on_grid(uuid, text, date, text);
ALTER TABLE public.businesses DROP COLUMN IF EXISTS slot_interval_minutes;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260924050000';

COMMIT;
