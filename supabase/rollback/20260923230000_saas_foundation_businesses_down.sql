-- Revierte el Paso 2 SaaS. Aborta si algún business_id ya tiene valor (backfill iniciado)
-- o si hay membresías, para no destruir trabajo del Paso 3.

BEGIN;

DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bookings','barbers','services','barber_schedules','barber_blocks','barber_vacations',
    'staff','customers','booking_notifications','notification_idempotency',
    'store_categories','store_products','gallery_photos'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = t AND column_name = 'business_id') THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE business_id IS NOT NULL', t) INTO n;
      IF n > 0 THEN
        RAISE EXCEPTION 'Rollback abortado: %.business_id tiene % filas con valor', t, n;
      END IF;
    END IF;
  END LOOP;

  IF to_regclass('public.business_members') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.business_members) THEN
    RAISE EXCEPTION 'Rollback abortado: business_members contiene filas';
  END IF;
END $$;

ALTER TABLE public.bookings                 DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.barbers                  DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.services                 DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.barber_schedules         DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.barber_blocks            DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.barber_vacations         DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.staff                    DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.customers                DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.booking_notifications    DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.notification_idempotency DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.store_categories         DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.store_products           DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.gallery_photos           DROP COLUMN IF EXISTS business_id;

DROP TABLE IF EXISTS public.business_members;
DROP TABLE IF EXISTS public.business_domains;
DROP TABLE IF EXISTS public.businesses;

COMMIT;
