-- Revierte el Paso 3 SaaS al estado del Paso 2 (business_id nullable y vacío, claves globales).
-- Aborta si ya existe más de un negocio: en ese caso vaciar business_id mezclaría tenants.

BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.businesses) <> 1 THEN
    RAISE EXCEPTION 'Rollback abortado: existe más de un negocio';
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_bookings_unique_active_slot;
CREATE UNIQUE INDEX idx_bookings_unique_active_slot
  ON public.bookings (barber, booking_date, booking_time)
  WHERE status <> 'cancelled';

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_barber_id_fkey;
ALTER TABLE public.staff ADD CONSTRAINT staff_barber_id_fkey
  FOREIGN KEY (barber_id) REFERENCES public.barbers (id) ON DELETE SET NULL;
ALTER TABLE public.barber_schedules DROP CONSTRAINT IF EXISTS barber_schedules_barber_id_fkey;
ALTER TABLE public.barber_schedules ADD CONSTRAINT barber_schedules_barber_id_fkey
  FOREIGN KEY (barber_id) REFERENCES public.barbers (id) ON DELETE CASCADE;
ALTER TABLE public.gallery_photos DROP CONSTRAINT IF EXISTS gallery_photos_barber_id_fkey;
ALTER TABLE public.gallery_photos ADD CONSTRAINT gallery_photos_barber_id_fkey
  FOREIGN KEY (barber_id) REFERENCES public.barbers (id) ON DELETE SET NULL;
ALTER TABLE public.store_products DROP CONSTRAINT IF EXISTS store_products_category_id_fkey;
ALTER TABLE public.store_products ADD CONSTRAINT store_products_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.store_categories (id) ON DELETE CASCADE;
ALTER TABLE public.notification_idempotency DROP CONSTRAINT IF EXISTS notification_idempotency_booking_id_fkey;
ALTER TABLE public.notification_idempotency ADD CONSTRAINT notification_idempotency_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES public.bookings (id) ON DELETE CASCADE;

ALTER TABLE public.bookings         DROP CONSTRAINT IF EXISTS bookings_business_id_id_key;
ALTER TABLE public.barbers          DROP CONSTRAINT IF EXISTS barbers_business_id_id_key;
ALTER TABLE public.services         DROP CONSTRAINT IF EXISTS services_business_id_id_key;
ALTER TABLE public.store_categories DROP CONSTRAINT IF EXISTS store_categories_business_id_id_key;
ALTER TABLE public.store_categories DROP CONSTRAINT IF EXISTS store_categories_business_id_slug_key;
ALTER TABLE public.staff            DROP CONSTRAINT IF EXISTS staff_business_id_email_key;
ALTER TABLE public.customers        DROP CONSTRAINT IF EXISTS customers_business_id_user_id_key;

ALTER TABLE public.bookings DISABLE TRIGGER USER;
ALTER TABLE public.barbers  DISABLE TRIGGER USER;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bookings','barbers','services','barber_schedules','barber_blocks','barber_vacations',
    'staff','customers','booking_notifications','notification_idempotency',
    'store_categories','store_products','gallery_photos'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id DROP NOT NULL, ALTER COLUMN business_id DROP DEFAULT', t);
    EXECUTE format('UPDATE public.%I SET business_id = NULL', t);
  END LOOP;
END $$;

ALTER TABLE public.bookings ENABLE TRIGGER USER;
ALTER TABLE public.barbers  ENABLE TRIGGER USER;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260923233000';

COMMIT;
