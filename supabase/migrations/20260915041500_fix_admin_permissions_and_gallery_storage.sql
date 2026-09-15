-- ============================================================
-- 1. ASEGURAR TABLA Y BUCKET DE GALERÍA
-- ============================================================

-- Crear tabla gallery_photos si no existe
CREATE TABLE IF NOT EXISTS public.gallery_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  title text DEFAULT '',
  barber_id text REFERENCES public.barbers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;

-- Crear bucket gallery-photos si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery-photos',
  'gallery-photos',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- Políticas de Storage para gallery-photos
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

-- ============================================================
-- 2. BLINDAJE INCONDICIONAL DE PERMISOS PARA LOS 2 ADMINISTRADORES
-- (Francisco Javier y Adrián Millán)
-- ============================================================

-- Asegurar que ambos administradores maestros están registrados y verificados en staff
INSERT INTO public.staff (email, full_name, role, status)
VALUES 
  ('franciscojavierfarinapadilla@gmail.com', 'Francisco Javier', 'admin', 'verified'),
  ('adrian.millan.peguero@hotmail.com', 'Adrián Millán', 'admin', 'verified')
ON CONFLICT (email) DO UPDATE
  SET role = 'admin', status = 'verified';

-- Políticas para gallery_photos
DROP POLICY IF EXISTS "public_select_gallery_photos" ON public.gallery_photos;
CREATE POLICY "public_select_gallery_photos" ON public.gallery_photos
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "staff_insert_gallery_photos" ON public.gallery_photos;
CREATE POLICY "staff_insert_gallery_photos" ON public.gallery_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    lower(auth.jwt() ->> 'email') IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com')
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE lower(s.email) = lower(auth.jwt() ->> 'email')
        AND s.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "staff_delete_gallery_photos" ON public.gallery_photos;
CREATE POLICY "staff_delete_gallery_photos" ON public.gallery_photos
  FOR DELETE TO authenticated
  USING (
    lower(auth.jwt() ->> 'email') IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com')
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE lower(s.email) = lower(auth.jwt() ->> 'email')
        AND s.status = 'verified'
    )
  );

-- ============================================================
-- 3. PERMISOS TOTALES DE EDICIÓN Y GUARDADO EN SERVICIOS Y BARBEROS
-- ============================================================

-- Políticas para SERVICES
DROP POLICY IF EXISTS "insert_services_admin" ON public.services;
CREATE POLICY "insert_services_admin" ON public.services
  FOR INSERT TO authenticated
  WITH CHECK (
    lower(auth.jwt() ->> 'email') IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com')
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE lower(s.email) = lower(auth.jwt() ->> 'email')
        AND s.role = 'admin'
        AND s.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "update_services_admin" ON public.services;
CREATE POLICY "update_services_admin" ON public.services
  FOR UPDATE TO authenticated
  USING (
    lower(auth.jwt() ->> 'email') IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com')
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE lower(s.email) = lower(auth.jwt() ->> 'email')
        AND s.role = 'admin'
        AND s.status = 'verified'
    )
  )
  WITH CHECK (
    lower(auth.jwt() ->> 'email') IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com')
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE lower(s.email) = lower(auth.jwt() ->> 'email')
        AND s.role = 'admin'
        AND s.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "delete_services_admin" ON public.services;
CREATE POLICY "delete_services_admin" ON public.services
  FOR DELETE TO authenticated
  USING (
    lower(auth.jwt() ->> 'email') IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com')
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE lower(s.email) = lower(auth.jwt() ->> 'email')
        AND s.role = 'admin'
        AND s.status = 'verified'
    )
  );

-- Políticas para BARBERS
DROP POLICY IF EXISTS "insert_barbers_admin" ON public.barbers;
CREATE POLICY "insert_barbers_admin" ON public.barbers
  FOR INSERT TO authenticated
  WITH CHECK (
    lower(auth.jwt() ->> 'email') IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com')
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE lower(s.email) = lower(auth.jwt() ->> 'email')
        AND s.role = 'admin'
        AND s.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "update_barbers_admin" ON public.barbers;
CREATE POLICY "update_barbers_admin" ON public.barbers
  FOR UPDATE TO authenticated
  USING (
    lower(auth.jwt() ->> 'email') IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com')
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE lower(s.email) = lower(auth.jwt() ->> 'email')
        AND s.role = 'admin'
        AND s.status = 'verified'
    )
  )
  WITH CHECK (
    lower(auth.jwt() ->> 'email') IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com')
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE lower(s.email) = lower(auth.jwt() ->> 'email')
        AND s.role = 'admin'
        AND s.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "delete_barbers_admin" ON public.barbers;
CREATE POLICY "delete_barbers_admin" ON public.barbers
  FOR DELETE TO authenticated
  USING (
    lower(auth.jwt() ->> 'email') IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com')
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE lower(s.email) = lower(auth.jwt() ->> 'email')
        AND s.role = 'admin'
        AND s.status = 'verified'
    )
  );
