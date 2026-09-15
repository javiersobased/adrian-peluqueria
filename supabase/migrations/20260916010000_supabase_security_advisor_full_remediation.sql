-- ============================================================================
-- MIGRACIÓN DE REMEDIACIÓN INTEGRAL DE SEGURIDAD (SUPABASE SECURITY ADVISOR)
-- Proyecto: ghukyltijkgdbaewhmcm (Peluquería Adrián Millán)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ELIMINAR FUNCIONES INSEGURAS U OBSOLETAS
-- ----------------------------------------------------------------------------
-- claim_admin permitía auto-asignarse rol admin si no había ninguno registrado.
-- Los administradores ya están fijos y verificados en la tabla staff.
DROP FUNCTION IF EXISTS public.claim_admin() CASCADE;

-- Eliminar sobrecargas antiguas de create_booking
DROP FUNCTION IF EXISTS public.create_booking(text, integer, text, date, text, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_booking(text, integer, text, date, text, text, text, text, text) CASCADE;

-- ----------------------------------------------------------------------------
-- 2. BLINDAJE DE FUNCIONES SECURITY DEFINER (FIX: function_search_path_mutable)
-- Todas las funciones SECURITY DEFINER deben tener SET search_path = '' y
-- referencias a tablas completamente calificadas (public.tabla, auth.uid, etc.)
-- ----------------------------------------------------------------------------

-- Función: is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  
  -- Administradores maestros incondicionales
  IF v_email IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com') THEN
    RETURN true;
  END IF;
  
  -- Verificar en staff
  RETURN EXISTS (
    SELECT 1 FROM public.staff
    WHERE lower(email) = v_email
      AND role = 'admin'
      AND status = 'verified'
  );
END;
$$;

-- Función: is_admin_or_verified_staff()
CREATE OR REPLACE FUNCTION public.is_admin_or_verified_staff()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  
  -- Administradores maestros incondicionales
  IF v_email IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com') THEN
    RETURN true;
  END IF;
  
  -- Verificar en staff (admin o barbero verificado)
  RETURN EXISTS (
    SELECT 1 FROM public.staff
    WHERE lower(email) = v_email
      AND status = 'verified'
  );
END;
$$;

-- Función: is_verified_staff() (compatibilidad catálogo tienda)
CREATE OR REPLACE FUNCTION public.is_verified_staff()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.is_admin_or_verified_staff();
END;
$$;

-- Función: has_admin()
CREATE OR REPLACE FUNCTION public.has_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN true;
END;
$$;

-- Función: get_my_role()
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_row record;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF v_email = '' THEN
    RETURN jsonb_build_object('role', null, 'status', null, 'barber_id', null, 'email', null);
  END IF;

  -- Admins maestros
  IF v_email IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com') THEN
    RETURN jsonb_build_object(
      'role', 'admin',
      'status', 'verified',
      'barber_id', 'adrian',
      'email', v_email
    );
  END IF;

  SELECT role, status, barber_id, email INTO v_row
  FROM public.staff
  WHERE lower(email) = v_email
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'role', v_row.role,
      'status', v_row.status,
      'barber_id', v_row.barber_id,
      'email', v_row.email
    );
  END IF;

  RETURN jsonb_build_object('role', null, 'status', null, 'barber_id', null, 'email', null);
END;
$$;

-- Función: get_booked_slots (solo devuelve horas, cero datos personales)
CREATE OR REPLACE FUNCTION public.get_booked_slots(p_barber text, p_date date)
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT booking_time FROM public.bookings
  WHERE barber = p_barber
    AND booking_date = p_date
    AND status != 'cancelled';
$$;

-- Función: sync_barber_staff_access()
CREATE OR REPLACE FUNCTION public.sync_barber_staff_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := lower(trim(coalesce(NEW.google_email, '')));
  IF v_email != '' THEN
    INSERT INTO public.staff (email, full_name, role, status, barber_id)
    VALUES (v_email, NEW.name, 'barber', 'verified', NEW.id)
    ON CONFLICT (email) DO UPDATE
      SET barber_id = EXCLUDED.barber_id,
          full_name = EXCLUDED.full_name,
          role = CASE WHEN public.staff.role = 'admin' THEN 'admin' ELSE 'barber' END,
          status = 'verified';
  END IF;
  RETURN NEW;
END;
$$;

-- Función: create_booking con search_path sellado
CREATE OR REPLACE FUNCTION public.create_booking(
  p_service_id text,
  p_service_duration integer,
  p_barber_id text,
  p_booking_date date,
  p_booking_time text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_comments text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_booking_id uuid;
  v_clean_phone text;
  v_result jsonb;
  v_recent_count integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para reservar una cita';
  END IF;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  IF p_customer_name IS NULL OR length(trim(p_customer_name)) < 2 THEN
    RAISE EXCEPTION 'El nombre del cliente debe tener al menos 2 caracteres';
  END IF;

  v_clean_phone := regexp_replace(coalesce(p_customer_phone, ''), '[\s\-\(\)\.]', '', 'g');
  IF length(v_clean_phone) < 7 OR length(v_clean_phone) > 16 THEN
    RAISE EXCEPTION 'El número de teléfono no es válido';
  END IF;

  -- Protección anti-spam: máximo 3 citas activas por usuario
  SELECT count(*) INTO v_recent_count
  FROM public.bookings
  WHERE user_id = v_user_id
    AND status = 'confirmed'
    AND booking_date >= CURRENT_DATE;

  IF v_recent_count >= 3 THEN
    RAISE EXCEPTION 'Ya tienes 3 citas activas reservadas. Si necesitas otra, contacta con la peluquería.';
  END IF;

  -- Verificar disponibilidad de franja horaria
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE barber = p_barber_id
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'El horario seleccionado ya no está disponible';
  END IF;

  -- Insertar la reserva
  INSERT INTO public.bookings (
    service,
    service_id,
    barber,
    booking_date,
    booking_time,
    full_name,
    phone,
    comments,
    user_id,
    status,
    email
  )
  VALUES (
    p_service_id,
    p_service_id,
    p_barber_id,
    p_booking_date,
    p_booking_time,
    trim(p_customer_name),
    v_clean_phone,
    trim(coalesce(p_customer_comments, '')),
    v_user_id,
    'confirmed',
    v_email
  )
  RETURNING id INTO v_booking_id;

  -- Actualizar o registrar en customers
  INSERT INTO public.customers (
    user_id,
    name,
    phone,
    comments,
    email,
    updated_at
  )
  VALUES (
    v_user_id,
    trim(p_customer_name),
    v_clean_phone,
    trim(coalesce(p_customer_comments, '')),
    v_email,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      comments = EXCLUDED.comments,
      email = EXCLUDED.email,
      updated_at = now();

  SELECT to_jsonb(b) INTO v_result
  FROM public.bookings b
  WHERE b.id = v_booking_id;

  RETURN v_result;
END;
$$;

-- Permisos de ejecución de funciones
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_verified_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_verified_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking(text, integer, text, date, text, text, text, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. ACTIVAR ROW LEVEL SECURITY (RLS) EN LAS 11 TABLAS
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.barber_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.barber_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.barber_vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.store_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gallery_photos ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. POLÍTICAS RLS: STAFF (CERO ACCESO ANÓNIMO - NO MÁS EXPOSICIÓN DE CORREOS)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "public_select_staff" ON public.staff;
DROP POLICY IF EXISTS "select_staff_admin_or_self" ON public.staff;
DROP POLICY IF EXISTS "insert_staff_admin_only" ON public.staff;
DROP POLICY IF EXISTS "update_staff_admin_only" ON public.staff;
DROP POLICY IF EXISTS "delete_staff_admin_only" ON public.staff;

-- Solo administradores o el propio usuario autenticado pueden consultar su registro de staff
CREATE POLICY "select_staff_admin_or_self" ON public.staff
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

CREATE POLICY "insert_staff_admin_only" ON public.staff
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "update_staff_admin_only" ON public.staff
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "delete_staff_admin_only" ON public.staff
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. POLÍTICAS RLS: CUSTOMERS (PROTECCIÓN RGPD DATOS PERSONALES)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "select_customers_admin_or_self" ON public.customers;
DROP POLICY IF EXISTS "insert_customers_admin_or_self" ON public.customers;
DROP POLICY IF EXISTS "update_customers_admin_or_self" ON public.customers;
DROP POLICY IF EXISTS "delete_customers_admin_only" ON public.customers;

CREATE POLICY "select_customers_admin_or_self" ON public.customers
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin()
  );

CREATE POLICY "insert_customers_admin_or_self" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_admin()
  );

CREATE POLICY "update_customers_admin_or_self" ON public.customers
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_admin()
  );

CREATE POLICY "delete_customers_admin_only" ON public.customers
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. POLÍTICAS RLS: BOOKINGS (CITAS)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon_select_bookings" ON public.bookings;
DROP POLICY IF EXISTS "anon_insert_bookings" ON public.bookings;
DROP POLICY IF EXISTS "anon_update_bookings" ON public.bookings;
DROP POLICY IF EXISTS "anon_delete_bookings" ON public.bookings;
DROP POLICY IF EXISTS "select_bookings_role_based" ON public.bookings;
DROP POLICY IF EXISTS "insert_bookings_role_based" ON public.bookings;
DROP POLICY IF EXISTS "update_bookings_role_based" ON public.bookings;
DROP POLICY IF EXISTS "delete_bookings_admin_only" ON public.bookings;

-- SELECT: Solo el propio cliente autenticado puede ver sus citas, o el personal/admin verificado
CREATE POLICY "select_bookings_role_based" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin_or_verified_staff()
  );

-- INSERT: El usuario para su propia cita, o staff para citas manuales
CREATE POLICY "insert_bookings_role_based" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_admin_or_verified_staff()
  );

-- UPDATE: El usuario puede cancelar su cita, o staff puede gestionar
CREATE POLICY "update_bookings_role_based" ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin_or_verified_staff()
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_admin_or_verified_staff()
  );

-- DELETE: Solo administradores verificados
CREATE POLICY "delete_bookings_admin_only" ON public.bookings
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. POLÍTICAS RLS: HORARIOS, VACACIONES Y BLOQUEOS
-- (Lectura pública para calcular huecos libres en la reserva, mutación solo staff)
-- ----------------------------------------------------------------------------
-- barber_schedules
DROP POLICY IF EXISTS "anon_select_barber_schedules" ON public.barber_schedules;
DROP POLICY IF EXISTS "auth_insert_barber_schedules" ON public.barber_schedules;
DROP POLICY IF EXISTS "auth_update_barber_schedules" ON public.barber_schedules;
DROP POLICY IF EXISTS "auth_delete_barber_schedules" ON public.barber_schedules;

CREATE POLICY "anon_select_barber_schedules" ON public.barber_schedules
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "staff_insert_barber_schedules" ON public.barber_schedules
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_verified_staff());

CREATE POLICY "staff_update_barber_schedules" ON public.barber_schedules
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_verified_staff())
  WITH CHECK (public.is_admin_or_verified_staff());

CREATE POLICY "staff_delete_barber_schedules" ON public.barber_schedules
  FOR DELETE TO authenticated
  USING (public.is_admin_or_verified_staff());

-- barber_vacations
DROP POLICY IF EXISTS "anon_select_barber_vacations" ON public.barber_vacations;
DROP POLICY IF EXISTS "auth_insert_barber_vacations" ON public.barber_vacations;
DROP POLICY IF EXISTS "auth_update_barber_vacations" ON public.barber_vacations;
DROP POLICY IF EXISTS "auth_delete_barber_vacations" ON public.barber_vacations;

CREATE POLICY "anon_select_barber_vacations" ON public.barber_vacations
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "staff_insert_barber_vacations" ON public.barber_vacations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_verified_staff());

CREATE POLICY "staff_update_barber_vacations" ON public.barber_vacations
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_verified_staff())
  WITH CHECK (public.is_admin_or_verified_staff());

CREATE POLICY "staff_delete_barber_vacations" ON public.barber_vacations
  FOR DELETE TO authenticated
  USING (public.is_admin_or_verified_staff());

-- barber_blocks
DROP POLICY IF EXISTS "anon_select_barber_blocks" ON public.barber_blocks;
DROP POLICY IF EXISTS "anon_insert_barber_blocks" ON public.barber_blocks;
DROP POLICY IF EXISTS "anon_update_barber_blocks" ON public.barber_blocks;
DROP POLICY IF EXISTS "anon_delete_barber_blocks" ON public.barber_blocks;
DROP POLICY IF EXISTS "auth_insert_barber_blocks" ON public.barber_blocks;
DROP POLICY IF EXISTS "auth_update_barber_blocks" ON public.barber_blocks;
DROP POLICY IF EXISTS "auth_delete_barber_blocks" ON public.barber_blocks;

CREATE POLICY "anon_select_barber_blocks" ON public.barber_blocks
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "staff_insert_barber_blocks" ON public.barber_blocks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_verified_staff());

CREATE POLICY "staff_update_barber_blocks" ON public.barber_blocks
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_verified_staff())
  WITH CHECK (public.is_admin_or_verified_staff());

CREATE POLICY "staff_delete_barber_blocks" ON public.barber_blocks
  FOR DELETE TO authenticated
  USING (public.is_admin_or_verified_staff());

-- ----------------------------------------------------------------------------
-- 8. POLÍTICAS RLS: SERVICIOS Y BARBEROS (CATÁLOGO PÚBLICO, EDICIÓN ADMIN)
-- ----------------------------------------------------------------------------
-- services
DROP POLICY IF EXISTS "public_select_services" ON public.services;
DROP POLICY IF EXISTS "insert_services_admin" ON public.services;
DROP POLICY IF EXISTS "update_services_admin" ON public.services;
DROP POLICY IF EXISTS "delete_services_admin" ON public.services;

CREATE POLICY "public_select_services" ON public.services
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "insert_services_admin" ON public.services
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "update_services_admin" ON public.services
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "delete_services_admin" ON public.services
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- barbers
DROP POLICY IF EXISTS "public_select_barbers" ON public.barbers;
DROP POLICY IF EXISTS "insert_barbers_admin" ON public.barbers;
DROP POLICY IF EXISTS "update_barbers_admin" ON public.barbers;
DROP POLICY IF EXISTS "delete_barbers_admin" ON public.barbers;

CREATE POLICY "public_select_barbers" ON public.barbers
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "insert_barbers_admin" ON public.barbers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "update_barbers_admin" ON public.barbers
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "delete_barbers_admin" ON public.barbers
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 9. POLÍTICAS RLS: TIENDA (CATEGORÍAS Y PRODUCTOS)
-- ----------------------------------------------------------------------------
-- store_categories
DROP POLICY IF EXISTS "public_read_store_categories" ON public.store_categories;
DROP POLICY IF EXISTS "staff_insert_store_categories" ON public.store_categories;
DROP POLICY IF EXISTS "staff_update_store_categories" ON public.store_categories;
DROP POLICY IF EXISTS "staff_delete_store_categories" ON public.store_categories;

CREATE POLICY "public_read_store_categories" ON public.store_categories
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "staff_insert_store_categories" ON public.store_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_verified_staff());

CREATE POLICY "staff_update_store_categories" ON public.store_categories
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_verified_staff())
  WITH CHECK (public.is_admin_or_verified_staff());

CREATE POLICY "staff_delete_store_categories" ON public.store_categories
  FOR DELETE TO authenticated
  USING (public.is_admin_or_verified_staff());

-- store_products
DROP POLICY IF EXISTS "public_read_store_products" ON public.store_products;
DROP POLICY IF EXISTS "staff_insert_store_products" ON public.store_products;
DROP POLICY IF EXISTS "staff_update_store_products" ON public.store_products;
DROP POLICY IF EXISTS "staff_delete_store_products" ON public.store_products;

CREATE POLICY "public_read_store_products" ON public.store_products
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "staff_insert_store_products" ON public.store_products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_verified_staff());

CREATE POLICY "staff_update_store_products" ON public.store_products
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_verified_staff())
  WITH CHECK (public.is_admin_or_verified_staff());

CREATE POLICY "staff_delete_store_products" ON public.store_products
  FOR DELETE TO authenticated
  USING (public.is_admin_or_verified_staff());

-- ----------------------------------------------------------------------------
-- 10. POLÍTICAS RLS: GALERÍA DE FOTOS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "public_select_gallery_photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "staff_insert_gallery_photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "staff_delete_gallery_photos" ON public.gallery_photos;

CREATE POLICY "public_select_gallery_photos" ON public.gallery_photos
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "staff_insert_gallery_photos" ON public.gallery_photos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_verified_staff());

CREATE POLICY "staff_delete_gallery_photos" ON public.gallery_photos
  FOR DELETE TO authenticated
  USING (public.is_admin_or_verified_staff());
