-- Revierte el Paso 4 SaaS restaurando funciones, grants y políticas desde el snapshot
-- capturado antes de la migración en backup_20260923_pre_step4.rollback_sql.

BEGIN;

DO $$
BEGIN
  IF to_regclass('backup_20260923_pre_step4.rollback_sql') IS NULL THEN
    RAISE EXCEPTION 'Rollback abortado: no existe el snapshot backup_20260923_pre_step4.rollback_sql';
  END IF;
END $$;

-- 1. Triggers nuevos
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bookings','barbers','services','barber_schedules','barber_blocks','barber_vacations',
    'staff','customers','booking_notifications','notification_idempotency',
    'store_categories','store_products','gallery_photos'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_business_id_immutable ON public.%I', t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS trg_barber_in_business ON public.barber_blocks;
DROP TRIGGER IF EXISTS trg_barber_in_business ON public.barber_vacations;
DROP TRIGGER IF EXISTS trg_barber_in_business ON public.barber_schedules;
DROP TRIGGER IF EXISTS trg_notification_business ON public.booking_notifications;
DROP TRIGGER IF EXISTS trg_guard_barber_sensitive_columns ON public.barbers;

-- 2. Todas las políticas actuales de las tablas de aplicación y de storage.objects
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE (schemaname = 'public'
           AND tablename IN ('bookings','barbers','services','barber_schedules','barber_blocks','barber_vacations',
                             'staff','customers','booking_notifications','notification_idempotency',
                             'store_categories','store_products','gallery_photos'))
       OR (schemaname = 'storage' AND tablename = 'objects')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 3. Funciones con firma nueva
DROP FUNCTION IF EXISTS public.get_booked_intervals(text, date, uuid);
DROP FUNCTION IF EXISTS public.get_booked_slots(text, date, uuid);
DROP FUNCTION IF EXISTS public.create_booking(text, integer, text, date, text, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.update_my_barber_profile(text, text, text, uuid);
DROP FUNCTION IF EXISTS public.get_my_role(uuid);

-- 4. Restaurar funciones, grants y políticas originales
DO $$
DECLARE s text;
BEGIN
  FOR s IN SELECT sql FROM backup_20260923_pre_step4.rollback_sql
           WHERE kind IN ('functions', 'grants', 'policies') ORDER BY ord LOOP
    EXECUTE s;
  END LOOP;
END $$;

REVOKE ALL ON public.barbers FROM anon;
DO $$
DECLARE s text;
BEGIN
  SELECT sql INTO s FROM backup_20260923_pre_step4.rollback_sql WHERE kind = 'barbers_grants';
  IF s IS NOT NULL THEN
    EXECUTE s;
  END IF;
END $$;

-- 5. Helpers nuevos (ya sin dependencias)
DROP FUNCTION IF EXISTS public.guard_barber_sensitive_columns();
DROP FUNCTION IF EXISTS public.set_notification_business();
DROP FUNCTION IF EXISTS public.enforce_barber_in_business();
DROP FUNCTION IF EXISTS public.reject_business_id_change();
DROP FUNCTION IF EXISTS public.can_write_storage_object(text, text[]);
DROP FUNCTION IF EXISTS public.storage_business_id(text);
DROP FUNCTION IF EXISTS public.can_manage_barber(uuid, text);
DROP FUNCTION IF EXISTS public.my_barber_id(uuid);
DROP FUNCTION IF EXISTS public.has_business_role(uuid, text[]);
DROP FUNCTION IF EXISTS public.is_business_public(uuid);
DROP FUNCTION IF EXISTS public.current_user_email();
DROP FUNCTION IF EXISTS public.legacy_business_id();

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260924000000';

NOTIFY pgrst, 'reload schema';

COMMIT;
