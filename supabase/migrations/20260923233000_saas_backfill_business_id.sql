-- SaaS multi-tenant · Paso 3 (backfill + constraints).
-- Asigna el tenant Adrián a todas las filas y hace business_id NOT NULL.
-- Compatibilidad con el frontend actual (que no envía business_id):
--   * DEFAULT temporal = tenant Adrián. Se retira en el Paso 6, cuando el cliente envíe business_id.
--   * Se mantienen las PK/unique globales (barbers.id, staff.email, customers.user_id,
--     store_categories.slug) porque el frontend hace upsert/ON CONFLICT sobre ellas;
--     se añaden en paralelo las claves compuestas por negocio. Contracción en el Paso 6/8.
--   * El índice de hueco activo conserva su nombre: el frontend lo busca en los mensajes de error.
-- Rollback: supabase/rollback/20260923233000_saas_backfill_business_id_down.sql

BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.businesses) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a') THEN
    RAISE EXCEPTION 'Backfill abortado: se esperaba únicamente el tenant Adrián';
  END IF;
END $$;

-- 1. Backfill. Los triggers de usuario de bookings/barbers validan reglas de cliente
--    (fechas pasadas, autoría) y sincronizan staff; no deben ejecutarse al etiquetar filas.
ALTER TABLE public.bookings DISABLE TRIGGER USER;
ALTER TABLE public.barbers  DISABLE TRIGGER USER;

UPDATE public.bookings                 SET business_id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a' WHERE business_id IS NULL;
UPDATE public.barbers                  SET business_id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a' WHERE business_id IS NULL;
UPDATE public.services                 SET business_id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a' WHERE business_id IS NULL;
UPDATE public.barber_schedules         SET business_id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a' WHERE business_id IS NULL;
UPDATE public.barber_blocks            SET business_id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a' WHERE business_id IS NULL;
UPDATE public.barber_vacations         SET business_id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a' WHERE business_id IS NULL;
UPDATE public.staff                    SET business_id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a' WHERE business_id IS NULL;
UPDATE public.customers                SET business_id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a' WHERE business_id IS NULL;
UPDATE public.booking_notifications    SET business_id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a' WHERE business_id IS NULL;
UPDATE public.notification_idempotency SET business_id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a' WHERE business_id IS NULL;
UPDATE public.store_categories         SET business_id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a' WHERE business_id IS NULL;
UPDATE public.store_products           SET business_id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a' WHERE business_id IS NULL;
UPDATE public.gallery_photos           SET business_id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a' WHERE business_id IS NULL;

ALTER TABLE public.bookings ENABLE TRIGGER USER;
ALTER TABLE public.barbers  ENABLE TRIGGER USER;

-- 2. DEFAULT temporal + NOT NULL
ALTER TABLE public.bookings                 ALTER COLUMN business_id SET DEFAULT 'f67af497-5e58-48a2-8bea-022c4f1d7e1a'::uuid, ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.barbers                  ALTER COLUMN business_id SET DEFAULT 'f67af497-5e58-48a2-8bea-022c4f1d7e1a'::uuid, ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.services                 ALTER COLUMN business_id SET DEFAULT 'f67af497-5e58-48a2-8bea-022c4f1d7e1a'::uuid, ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.barber_schedules         ALTER COLUMN business_id SET DEFAULT 'f67af497-5e58-48a2-8bea-022c4f1d7e1a'::uuid, ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.barber_blocks            ALTER COLUMN business_id SET DEFAULT 'f67af497-5e58-48a2-8bea-022c4f1d7e1a'::uuid, ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.barber_vacations         ALTER COLUMN business_id SET DEFAULT 'f67af497-5e58-48a2-8bea-022c4f1d7e1a'::uuid, ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.staff                    ALTER COLUMN business_id SET DEFAULT 'f67af497-5e58-48a2-8bea-022c4f1d7e1a'::uuid, ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.customers                ALTER COLUMN business_id SET DEFAULT 'f67af497-5e58-48a2-8bea-022c4f1d7e1a'::uuid, ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.booking_notifications    ALTER COLUMN business_id SET DEFAULT 'f67af497-5e58-48a2-8bea-022c4f1d7e1a'::uuid, ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.notification_idempotency ALTER COLUMN business_id SET DEFAULT 'f67af497-5e58-48a2-8bea-022c4f1d7e1a'::uuid, ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.store_categories         ALTER COLUMN business_id SET DEFAULT 'f67af497-5e58-48a2-8bea-022c4f1d7e1a'::uuid, ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.store_products           ALTER COLUMN business_id SET DEFAULT 'f67af497-5e58-48a2-8bea-022c4f1d7e1a'::uuid, ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.gallery_photos           ALTER COLUMN business_id SET DEFAULT 'f67af497-5e58-48a2-8bea-022c4f1d7e1a'::uuid, ALTER COLUMN business_id SET NOT NULL;

-- 3. Identidad por negocio (en paralelo a las claves globales heredadas)
ALTER TABLE public.bookings         ADD CONSTRAINT bookings_business_id_id_key         UNIQUE (business_id, id);
ALTER TABLE public.barbers          ADD CONSTRAINT barbers_business_id_id_key          UNIQUE (business_id, id);
ALTER TABLE public.services         ADD CONSTRAINT services_business_id_id_key         UNIQUE (business_id, id);
ALTER TABLE public.store_categories ADD CONSTRAINT store_categories_business_id_id_key UNIQUE (business_id, id);
ALTER TABLE public.store_categories ADD CONSTRAINT store_categories_business_id_slug_key UNIQUE (business_id, slug);
ALTER TABLE public.staff            ADD CONSTRAINT staff_business_id_email_key         UNIQUE (business_id, email);
ALTER TABLE public.customers        ADD CONSTRAINT customers_business_id_user_id_key   UNIQUE (business_id, user_id);

-- 4. FKs compuestas: la referencia debe existir en el MISMO negocio. Se conserva el ON DELETE original.
ALTER TABLE public.staff DROP CONSTRAINT staff_barber_id_fkey;
ALTER TABLE public.staff ADD CONSTRAINT staff_barber_id_fkey
  FOREIGN KEY (business_id, barber_id) REFERENCES public.barbers (business_id, id) ON DELETE SET NULL (barber_id);

ALTER TABLE public.barber_schedules DROP CONSTRAINT barber_schedules_barber_id_fkey;
ALTER TABLE public.barber_schedules ADD CONSTRAINT barber_schedules_barber_id_fkey
  FOREIGN KEY (business_id, barber_id) REFERENCES public.barbers (business_id, id) ON DELETE CASCADE;

ALTER TABLE public.gallery_photos DROP CONSTRAINT gallery_photos_barber_id_fkey;
ALTER TABLE public.gallery_photos ADD CONSTRAINT gallery_photos_barber_id_fkey
  FOREIGN KEY (business_id, barber_id) REFERENCES public.barbers (business_id, id) ON DELETE SET NULL (barber_id);

ALTER TABLE public.store_products DROP CONSTRAINT store_products_category_id_fkey;
ALTER TABLE public.store_products ADD CONSTRAINT store_products_category_id_fkey
  FOREIGN KEY (business_id, category_id) REFERENCES public.store_categories (business_id, id) ON DELETE CASCADE;

ALTER TABLE public.notification_idempotency DROP CONSTRAINT notification_idempotency_booking_id_fkey;
ALTER TABLE public.notification_idempotency ADD CONSTRAINT notification_idempotency_booking_id_fkey
  FOREIGN KEY (business_id, booking_id) REFERENCES public.bookings (business_id, id) ON DELETE CASCADE;

-- 5. Hueco activo único por negocio (mismo nombre que el índice heredado)
CREATE UNIQUE INDEX idx_bookings_unique_active_slot_tenant
  ON public.bookings (business_id, barber, booking_date, booking_time)
  WHERE status <> 'cancelled';
DROP INDEX public.idx_bookings_unique_active_slot;
ALTER INDEX public.idx_bookings_unique_active_slot_tenant RENAME TO idx_bookings_unique_active_slot;

COMMIT;
