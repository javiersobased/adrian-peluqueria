-- Revierte la contracción del Paso 6. Solo es posible mientras exista un único negocio
-- (las claves globales no admiten slugs/emails/usuarios repetidos entre negocios).

BEGIN;

DO $$
DECLARE t text;
BEGIN
  IF (SELECT count(*) FROM public.businesses) <> 1 THEN
    RAISE EXCEPTION 'Rollback abortado: existe más de un negocio';
  END IF;

  FOREACH t IN ARRAY ARRAY[
    'bookings','barbers','services','barber_schedules','barber_blocks','barber_vacations',
    'staff','customers','booking_notifications','notification_idempotency',
    'store_categories','store_products','gallery_photos'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id SET DEFAULT %L::uuid', t, 'f67af497-5e58-48a2-8bea-022c4f1d7e1a');
  END LOOP;
END $$;

ALTER TABLE public.bookings ALTER COLUMN barber SET DEFAULT 'adrian';

ALTER TABLE public.barbers DROP CONSTRAINT barbers_pkey;
ALTER TABLE public.barbers ADD CONSTRAINT barbers_pkey PRIMARY KEY (id);

ALTER TABLE public.staff DROP CONSTRAINT staff_pkey;
ALTER TABLE public.staff ADD CONSTRAINT staff_pkey PRIMARY KEY (email);
ALTER TABLE public.staff ADD CONSTRAINT staff_business_id_email_key UNIQUE (business_id, email);

ALTER TABLE public.customers DROP CONSTRAINT customers_pkey;
ALTER TABLE public.customers ADD CONSTRAINT customers_pkey PRIMARY KEY (user_id);
ALTER TABLE public.customers ADD CONSTRAINT customers_business_id_user_id_key UNIQUE (business_id, user_id);

ALTER TABLE public.store_categories ADD CONSTRAINT store_categories_slug_key UNIQUE (slug);

DO $$
BEGIN
  EXECUTE replace(pg_get_functiondef('public.sync_barber_staff_access()'::regprocedure),
                  'ON CONFLICT (business_id, email)', 'ON CONFLICT (email)');
  EXECUTE replace(pg_get_functiondef('public.create_booking(text,integer,text,date,text,text,text,text,uuid)'::regprocedure),
                  'ON CONFLICT (business_id, user_id)', 'ON CONFLICT (user_id)');
END $$;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260924030000';

NOTIFY pgrst, 'reload schema';

COMMIT;
