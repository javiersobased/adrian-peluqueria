-- Puerta del Paso 3: 100 % de filas atribuidas y cero referencias entre negocios.
-- Todas las filas deben devolver ok = true.

WITH app_tables(t) AS (
  VALUES ('bookings'),('barbers'),('services'),('barber_schedules'),('barber_blocks'),
         ('barber_vacations'),('staff'),('customers'),('booking_notifications'),
         ('notification_idempotency'),('store_categories'),('store_products'),('gallery_photos')
)
SELECT 'business_id NOT NULL en ' || t AS check_name,
       EXISTS (SELECT 1 FROM information_schema.columns c
               WHERE c.table_schema = 'public' AND c.table_name = t
                 AND c.column_name = 'business_id' AND c.is_nullable = 'NO') AS ok
FROM app_tables
UNION ALL
SELECT 'filas de bookings con negocio existente',
       NOT EXISTS (SELECT 1 FROM public.bookings b WHERE NOT EXISTS (SELECT 1 FROM public.businesses x WHERE x.id = b.business_id))
UNION ALL
SELECT 'bookings.barber del mismo negocio',
       NOT EXISTS (SELECT 1 FROM public.bookings b JOIN public.barbers br ON br.id = b.barber
                   WHERE br.business_id <> b.business_id)
UNION ALL
SELECT 'barber_blocks.barber del mismo negocio',
       NOT EXISTS (SELECT 1 FROM public.barber_blocks k JOIN public.barbers br ON br.id = k.barber
                   WHERE br.business_id <> k.business_id)
UNION ALL
SELECT 'barber_vacations.barber del mismo negocio',
       NOT EXISTS (SELECT 1 FROM public.barber_vacations v JOIN public.barbers br ON br.id = v.barber
                   WHERE br.business_id <> v.business_id)
UNION ALL
SELECT 'booking_notifications.booking_id del mismo negocio',
       NOT EXISTS (SELECT 1 FROM public.booking_notifications n JOIN public.bookings b ON b.id = n.booking_id
                   WHERE b.business_id <> n.business_id)
UNION ALL
SELECT 'customers con reservas del mismo negocio',
       NOT EXISTS (SELECT 1 FROM public.customers c JOIN public.bookings b ON b.user_id = c.user_id
                   WHERE b.business_id <> c.business_id)
UNION ALL
SELECT 'FK compuesta ' || conname,
       pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (business_id, %'
FROM pg_constraint
WHERE conname IN ('staff_barber_id_fkey','barber_schedules_barber_id_fkey','gallery_photos_barber_id_fkey',
                  'store_products_category_id_fkey','notification_idempotency_booking_id_fkey')
UNION ALL
SELECT 'índice de hueco activo por negocio',
       EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
               AND indexname = 'idx_bookings_unique_active_slot'
               AND indexdef LIKE '%(business_id, barber, booking_date, booking_time)%');
