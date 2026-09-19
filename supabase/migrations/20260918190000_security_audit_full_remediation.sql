-- ============================================================================
-- MIGRACIÓN DE SEGURIDAD: REMEDIACIÓN INTEGRAL DE AUDITORÍA
-- Proyecto: ghukyltijkgdbaewhmcm (Peluquería Adrián Millán)
-- Fecha: 2026-09-18
-- ============================================================================

-- 1. ELIMINAR POLÍTICA PERMISIVA EN BARBER_SCHEDULES
-- Esta política otorgaba ALL a {public} permitiendo a usuarios anónimos
-- modificar, insertar o eliminar cualquier turno de trabajo.
DROP POLICY IF EXISTS "Acceso total para turnos en barber_schedules" ON public.barber_schedules;

-- 2. BLINDAJE DE SUPABASE STORAGE (STORAGE.OBJECTS)
-- A. Bucket 'barber-photos': Solo admins o staff verificado pueden insertar, modificar o eliminar fotos.
DROP POLICY IF EXISTS "Anon delete barber photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon update barber photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon upload barber photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read barber photos" ON storage.objects;
DROP POLICY IF EXISTS "public_read_barber_photos" ON storage.objects;
DROP POLICY IF EXISTS "staff_upload_barber_photos" ON storage.objects;
DROP POLICY IF EXISTS "staff_update_barber_photos" ON storage.objects;
DROP POLICY IF EXISTS "staff_delete_barber_photos" ON storage.objects;

CREATE POLICY "public_read_barber_photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'barber-photos');

CREATE POLICY "staff_upload_barber_photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'barber-photos'
    AND public.is_admin_or_verified_staff()
  );

CREATE POLICY "staff_update_barber_photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'barber-photos'
    AND public.is_admin_or_verified_staff()
  )
  WITH CHECK (
    bucket_id = 'barber-photos'
    AND public.is_admin_or_verified_staff()
  );

CREATE POLICY "staff_delete_barber_photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'barber-photos'
    AND public.is_admin_or_verified_staff()
  );

-- B. Bucket 'gallery-photos': Solo personal del salón o admins pueden subir o borrar fotos de la galería.
DROP POLICY IF EXISTS "authenticated_delete_gallery_photos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_upload_gallery_photos" ON storage.objects;
DROP POLICY IF EXISTS "public_read_gallery_photos" ON storage.objects;
DROP POLICY IF EXISTS "staff_upload_gallery_photos" ON storage.objects;
DROP POLICY IF EXISTS "staff_delete_gallery_photos" ON storage.objects;

CREATE POLICY "public_read_gallery_photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'gallery-photos');

CREATE POLICY "staff_upload_gallery_photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gallery-photos'
    AND public.is_admin_or_verified_staff()
  );

CREATE POLICY "staff_delete_gallery_photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'gallery-photos'
    AND public.is_admin_or_verified_staff()
  );

-- 3. ELIMINACIÓN DE FUNCIONES HUÉRFANAS Y OBSOLETAS
DROP FUNCTION IF EXISTS public.auto_assign_barber_role() CASCADE;
DROP FUNCTION IF EXISTS public.verify_barber(text) CASCADE;

-- 4. ENDURECIMIENTO DE RESCHEDULE_BOOKING (search_path sellado y revocación pública)
CREATE OR REPLACE FUNCTION public.reschedule_booking(
  p_booking_id uuid,
  p_new_date date,
  p_new_time text
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_barber text;
  v_row public.bookings;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT barber INTO v_barber
  FROM public.bookings
  WHERE id = p_booking_id
    AND user_id = v_user_id
    AND status != 'cancelled';

  IF v_barber IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE barber = v_barber
      AND booking_date = p_new_date
      AND booking_time = p_new_time
      AND status != 'cancelled'
      AND id != p_booking_id
  ) THEN
    RAISE EXCEPTION 'This time slot is already booked';
  END IF;

  UPDATE public.bookings
  SET booking_date = p_new_date,
      booking_time = p_new_time
  WHERE id = p_booking_id
    AND user_id = v_user_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reschedule_booking(uuid, date, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_booking(uuid, date, text) TO authenticated;

-- 5. REVOCAR PERMISOS DE EJECUCIÓN PÚBLICA EN FUNCIONES INTERNAS DE TRIGGER
-- Evita que aparezcan como endpoints RPC expuestos en PostgREST (/rest/v1/rpc/...)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_barber_staff_access') THEN
    REVOKE EXECUTE ON FUNCTION public.sync_barber_staff_access() FROM public, anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_booking_anti_spam_and_duplicates') THEN
    REVOKE EXECUTE ON FUNCTION public.validate_booking_anti_spam_and_duplicates() FROM public, anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'prevent_delete_adrian') THEN
    REVOKE EXECUTE ON FUNCTION public.prevent_delete_adrian() FROM public, anon, authenticated;
  END IF;
END;
$$;

-- 6. RECARGA DE ESQUEMA POSTGREST
NOTIFY pgrst, 'reload schema';
