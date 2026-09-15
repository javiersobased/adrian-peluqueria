-- ============================================================================
-- FIX: REPARAR FUNCIÓN RPC create_booking CON LOS PARÁMETROS EXACTOS DEL FRONTEND
-- Ejecutar este script en Supabase -> SQL Editor -> New Query -> Run
-- ============================================================================

-- 1. Eliminar cualquier firma previa con nombres de parámetros antiguos
DROP FUNCTION IF EXISTS public.create_booking(text, integer, text, date, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_booking;

-- 2. Crear la función con los nombres exactos esperados por el frontend:
--    p_service, p_service_price, p_barber, p_booking_date, p_booking_time, p_full_name, p_phone, p_comments
CREATE OR REPLACE FUNCTION public.create_booking(
  p_service text,
  p_service_price integer,
  p_barber text,
  p_booking_date date,
  p_booking_time text,
  p_full_name text,
  p_phone text,
  p_comments text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_full_name text := trim(p_full_name);
  v_phone text := trim(p_phone);
  v_clean_phone text;
  v_digits text;
  v_comments text := trim(coalesce(p_comments, ''));
  v_row public.bookings;
  v_recent_count integer;
BEGIN
  -- 1. Verificar autenticación
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para reservar una cita';
  END IF;

  -- 2. Validar nombre
  IF length(v_full_name) < 2 THEN
    RAISE EXCEPTION 'El nombre del cliente debe tener al menos 2 caracteres';
  END IF;

  -- 3. Normalización y validación del teléfono
  v_clean_phone := regexp_replace(v_phone, '[\s\-\(\)]', '', 'g');
  v_digits := regexp_replace(v_phone, '\D', '', 'g');

  IF length(v_digits) < 7 OR length(v_digits) > 15 THEN
    RAISE EXCEPTION 'El número de teléfono no es válido';
  END IF;

  -- Detección anti-spam de números falsos
  IF v_digits ~ '^(\d)\1+$'
     OR v_digits IN ('123456789', '987654321', '012345678', '876543210', '12345678', '87654321') THEN
    RAISE EXCEPTION 'Número de teléfono sospechoso o de prueba';
  END IF;

  IF v_clean_phone !~ '^(\+[1-9]\d{6,14}|[6789]\d{8})$' THEN
    RAISE EXCEPTION 'El número de teléfono debe tener un formato válido (ej. 612345678 o +34612345678)';
  END IF;

  IF v_comments IS NOT NULL AND length(v_comments) > 1000 THEN
    RAISE EXCEPTION 'Los comentarios son demasiado extensos';
  END IF;

  -- 4. Protección anti-spam: máximo 3 citas activas por usuario
  SELECT count(*) INTO v_recent_count
  FROM public.bookings
  WHERE user_id = v_user_id
    AND status != 'cancelled'
    AND booking_date >= CURRENT_DATE;

  IF v_recent_count >= 3 THEN
    RAISE EXCEPTION 'Ya tienes 3 citas activas reservadas. Si necesitas otra, contacta directamente con la peluquería.';
  END IF;

  -- 5. Comprobar si el horario ya está reservado
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE barber = p_barber
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'El horario seleccionado ya no está disponible. Por favor, elige otra hora.';
  END IF;

  -- 6. Insertar la reserva
  INSERT INTO public.bookings (
    service,
    service_price,
    barber,
    booking_date,
    booking_time,
    full_name,
    phone,
    email,
    comments,
    status,
    user_id
  )
  VALUES (
    p_service,
    p_service_price,
    p_barber,
    p_booking_date,
    p_booking_time,
    v_full_name,
    v_phone,
    v_email,
    v_comments,
    'pending',
    v_user_id
  )
  RETURNING * INTO v_row;

  -- 7. Guardar o actualizar perfil en customers
  INSERT INTO public.customers (
    user_id,
    full_name,
    phone,
    email,
    comments,
    updated_at
  )
  VALUES (
    v_user_id,
    v_full_name,
    v_phone,
    v_email,
    v_comments,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      comments = EXCLUDED.comments,
      updated_at = now();

  RETURN to_jsonb(v_row);
END;
$$;

-- 3. Conceder permisos de ejecución
GRANT EXECUTE ON FUNCTION public.create_booking(text, integer, text, date, text, text, text, text) TO authenticated;

-- 4. Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
