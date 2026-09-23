-- SaaS multi-tenant · Paso 6 (contracción).
-- * Retira el DEFAULT temporal de business_id y el barbero por defecto 'adrian'.
-- * Las identidades pasan a ser por negocio: barbers (business_id, id), staff (business_id, email),
--   customers (business_id, user_id); store_categories.slug deja de ser único global.
-- * Los ON CONFLICT de create_booking y sync_barber_staff_access usan las claves compuestas.
-- Requiere el frontend del commit 86de939 (todas las escrituras envían business_id).
-- Rollback: supabase/rollback/20260924030000_saas_contract_legacy_keys_down.sql

BEGIN;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bookings','barbers','services','barber_schedules','barber_blocks','barber_vacations',
    'staff','customers','booking_notifications','notification_idempotency',
    'store_categories','store_products','gallery_photos'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id DROP DEFAULT', t);
  END LOOP;
END $$;

ALTER TABLE public.bookings ALTER COLUMN barber DROP DEFAULT;

ALTER TABLE public.barbers DROP CONSTRAINT barbers_pkey;
ALTER TABLE public.barbers ADD CONSTRAINT barbers_pkey PRIMARY KEY (business_id, id);

ALTER TABLE public.staff DROP CONSTRAINT staff_pkey;
ALTER TABLE public.staff DROP CONSTRAINT staff_business_id_email_key;
ALTER TABLE public.staff ADD CONSTRAINT staff_pkey PRIMARY KEY (business_id, email);

ALTER TABLE public.customers DROP CONSTRAINT customers_pkey;
ALTER TABLE public.customers DROP CONSTRAINT customers_business_id_user_id_key;
ALTER TABLE public.customers ADD CONSTRAINT customers_pkey PRIMARY KEY (business_id, user_id);

ALTER TABLE public.store_categories DROP CONSTRAINT store_categories_slug_key;

-- Reescritura exacta de los ON CONFLICT sobre la definición vigente de cada función.
DO $$
DECLARE
  v_def text;
BEGIN
  v_def := pg_get_functiondef('public.sync_barber_staff_access()'::regprocedure);
  IF v_def NOT LIKE '%ON CONFLICT (email)%' THEN
    RAISE EXCEPTION 'sync_barber_staff_access no contiene ON CONFLICT (email)';
  END IF;
  EXECUTE replace(v_def, 'ON CONFLICT (email)', 'ON CONFLICT (business_id, email)');

  v_def := pg_get_functiondef('public.create_booking(text,integer,text,date,text,text,text,text,uuid)'::regprocedure);
  IF v_def NOT LIKE '%ON CONFLICT (user_id)%' THEN
    RAISE EXCEPTION 'create_booking no contiene ON CONFLICT (user_id)';
  END IF;
  EXECUTE replace(v_def, 'ON CONFLICT (user_id)', 'ON CONFLICT (business_id, user_id)');
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
