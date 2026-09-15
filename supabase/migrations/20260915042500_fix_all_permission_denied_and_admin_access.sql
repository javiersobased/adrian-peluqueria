-- ============================================================================
-- SOLUCIÓN DEFINITIVA: PERMISSION DENIED FOR TABLE USERS Y CONTROL TOTAL ADMIN
-- ============================================================================

-- 1. ELIMINAR FUNCIONES CON RIESGO DE ERROR 42P13 ANTES DE RECREARLAS
DROP FUNCTION IF EXISTS public.create_booking(text, integer, text, date, text, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_booking(text, integer, text, date, text, text, text, text, text) CASCADE;

-- 2. ASEGURAR TABLA GALLERY_PHOTOS Y BUCKET
CREATE TABLE IF NOT EXISTS public.gallery_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  title text DEFAULT '',
  barber_id text REFERENCES public.barbers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;

-- Bucket storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery-photos',
  'gallery-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- Políticas de Storage
DROP POLICY IF EXISTS "public_read_gallery_photos" ON storage.objects;
CREATE POLICY "public_read_gallery_photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'gallery-photos');

DROP POLICY IF EXISTS "authenticated_upload_gallery_photos" ON storage.objects;
CREATE POLICY "authenticated_upload_gallery_photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery-photos');

DROP POLICY IF EXISTS "authenticated_delete_gallery_photos" ON storage.objects;
CREATE POLICY "authenticated_delete_gallery_photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'gallery-photos');

-- 3. FUNCIONES AUXILIARES SECURITY DEFINER
-- (Se ejecutan con permisos de superusuario, jamás tocan auth.users directamente ni fallan con 'permission denied')
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  
  -- Admins maestros incondicionales
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

CREATE OR REPLACE FUNCTION public.is_admin_or_verified_staff()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  
  -- Admins maestros incondicionales
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

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_verified_staff() TO anon, authenticated;

-- 4. REGISTRAR Y VERIFICAR A AMBOS ADMINISTRADORES EN STAFF
INSERT INTO public.staff (email, full_name, role, status)
VALUES 
  ('franciscojavierfarinapadilla@gmail.com', 'Francisco Javier', 'admin', 'verified'),
  ('adrian.millan.peguero@hotmail.com', 'Adrián Millán', 'admin', 'verified')
ON CONFLICT (email) DO UPDATE
  SET role = 'admin', status = 'verified';

-- 5. LIMPIAR Y CORREGIR TODAS LAS POLÍTICAS DE STAFF
-- (Eliminando cualquier referencia a auth.users que cause 'permission denied for table users')
DROP POLICY IF EXISTS "select_staff_admin_or_self" ON public.staff;
DROP POLICY IF EXISTS "insert_staff_admin_only" ON public.staff;
DROP POLICY IF EXISTS "update_staff_admin_only" ON public.staff;
DROP POLICY IF EXISTS "delete_staff_admin_only" ON public.staff;
DROP POLICY IF EXISTS "public_select_staff" ON public.staff;

-- Permitir lectura de staff a cualquier usuario autenticado o anónimo (para que la app y las validaciones no fallen jamás)
CREATE POLICY "public_select_staff" ON public.staff
  FOR SELECT TO anon, authenticated
  USING (true);

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

-- 6. POLÍTICAS DE GALLERY_PHOTOS
DROP POLICY IF EXISTS "public_select_gallery_photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "staff_insert_gallery_photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "staff_delete_gallery_photos" ON public.gallery_photos;

CREATE POLICY "public_select_gallery_photos" ON public.gallery_photos
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "staff_insert_gallery_photos" ON public.gallery_photos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_verified_staff());

CREATE POLICY "staff_delete_gallery_photos" ON public.gallery_photos
  FOR DELETE TO authenticated
  USING (public.is_admin_or_verified_staff());

-- 7. POLÍTICAS DE SERVICES
DROP POLICY IF EXISTS "public_select_services" ON public.services;
DROP POLICY IF EXISTS "insert_services_admin" ON public.services;
DROP POLICY IF EXISTS "update_services_admin" ON public.services;
DROP POLICY IF EXISTS "delete_services_admin" ON public.services;

CREATE POLICY "public_select_services" ON public.services
  FOR SELECT TO anon, authenticated
  USING (true);

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

-- 8. POLÍTICAS DE BARBERS
DROP POLICY IF EXISTS "public_select_barbers" ON public.barbers;
DROP POLICY IF EXISTS "insert_barbers_admin" ON public.barbers;
DROP POLICY IF EXISTS "update_barbers_admin" ON public.barbers;
DROP POLICY IF EXISTS "delete_barbers_admin" ON public.barbers;

CREATE POLICY "public_select_barbers" ON public.barbers
  FOR SELECT TO anon, authenticated
  USING (true);

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

-- 9. FUNCIÓN CREATE_BOOKING ACTUALIZADA CON PREFIJOS INTERNACIONALES Y RETORNO LIMPIO
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
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_booking_id uuid;
  v_clean_phone text;
  v_result jsonb;
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

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE barber_id = p_barber_id
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'El horario seleccionado ya no está disponible';
  END IF;

  INSERT INTO public.bookings (
    service_id,
    service_duration,
    barber_id,
    booking_date,
    booking_time,
    customer_name,
    customer_phone,
    customer_comments,
    user_id,
    status
  )
  VALUES (
    p_service_id,
    p_service_duration,
    p_barber_id,
    p_booking_date,
    p_booking_time,
    trim(p_customer_name),
    v_clean_phone,
    trim(coalesce(p_customer_comments, '')),
    v_user_id,
    'confirmed'
  )
  RETURNING id INTO v_booking_id;

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

GRANT EXECUTE ON FUNCTION public.create_booking(text, integer, text, date, text, text, text, text) TO authenticated;
