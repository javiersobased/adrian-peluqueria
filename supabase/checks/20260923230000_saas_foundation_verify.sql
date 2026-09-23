-- Puerta del Paso 2: ejecutar tras la migración. Todas las filas deben devolver ok = true.

WITH app_tables(t) AS (
  VALUES ('bookings'),('barbers'),('services'),('barber_schedules'),('barber_blocks'),
         ('barber_vacations'),('staff'),('customers'),('booking_notifications'),
         ('notification_idempotency'),('store_categories'),('store_products'),('gallery_photos')
)
SELECT 'columna business_id nullable en ' || t AS check_name,
       EXISTS (SELECT 1 FROM information_schema.columns c
               WHERE c.table_schema = 'public' AND c.table_name = t
                 AND c.column_name = 'business_id' AND c.data_type = 'uuid'
                 AND c.is_nullable = 'YES') AS ok
FROM app_tables
UNION ALL
SELECT 'índice business_id en ' || t,
       EXISTS (SELECT 1 FROM pg_indexes i
               WHERE i.schemaname = 'public' AND i.tablename = t
                 AND i.indexname = 'idx_' || t || '_business_id')
FROM app_tables
UNION ALL
SELECT 'sin backfill todavía: bookings', NOT EXISTS (SELECT 1 FROM public.bookings WHERE business_id IS NOT NULL)
UNION ALL
SELECT 'tenant Adrián activo', EXISTS (SELECT 1 FROM public.businesses
       WHERE id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a' AND slug = 'adrian-millan' AND status = 'active')
UNION ALL
SELECT 'dominio primario www.adrianmillan.es', EXISTS (SELECT 1 FROM public.business_domains
       WHERE hostname = 'www.adrianmillan.es' AND is_primary AND status = 'active'
         AND business_id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a')
UNION ALL
SELECT 'RLS activo en ' || c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('businesses','business_domains','business_members')
UNION ALL
SELECT 'business_domains sin políticas (solo servidor)',
       NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_domains')
UNION ALL
SELECT 'anon no puede escribir businesses',
       NOT has_table_privilege('anon', 'public.businesses', 'INSERT,UPDATE,DELETE')
UNION ALL
SELECT 'anon no puede leer business_domains',
       NOT has_table_privilege('anon', 'public.business_domains', 'SELECT');
