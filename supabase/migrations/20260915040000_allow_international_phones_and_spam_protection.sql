-- Actualización de create_booking: soporte completo para prefijos internacionales y protección anti-spam
CREATE OR REPLACE FUNCTION public.create_booking(
  p_service text,
  p_service_price integer,
  p_barber text,
  p_booking_date date,
  p_booking_time text,
  p_full_name text,
  p_phone text,
  p_comments text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_full_name text := trim(p_full_name);
  v_phone text := trim(p_phone);
  v_clean_phone text;
  v_digits text;
  v_comments text := trim(p_comments);
  v_row bookings;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF length(v_full_name) < 2 THEN
    RAISE EXCEPTION 'Name must be at least 2 characters';
  END IF;

  -- Normalización y validación del teléfono
  v_clean_phone := regexp_replace(v_phone, '[\s\-\(\)]', '', 'g');
  v_digits := regexp_replace(v_phone, '\D', '', 'g');

  -- 1. Descartar teléfonos vacíos o fuera de rango E.164 (7 a 15 dígitos)
  IF length(v_digits) < 7 OR length(v_digits) > 15 THEN
    RAISE EXCEPTION 'Invalid phone number length';
  END IF;

  -- 2. Detección anti-spam: descartar secuencias falsas o todos los dígitos iguales (ej. 666666666, 123456789)
  IF v_digits ~ '^(\d)\1+$'
     OR v_digits IN ('123456789', '987654321', '012345678', '876543210', '12345678', '87654321') THEN
    RAISE EXCEPTION 'Invalid or fake phone number';
  END IF;

  -- 3. Formato válido: Internacional con '+' (ej. +34612345678, +351912345678) o teléfono nacional español de 9 dígitos
  IF v_clean_phone !~ '^(\+[1-9]\d{6,14}|[6789]\d{8})$' THEN
    RAISE EXCEPTION 'Invalid phone number format';
  END IF;

  IF v_comments IS NOT NULL AND length(v_comments) > 1000 THEN
    RAISE EXCEPTION 'Comments too long';
  END IF;

  -- Comprobar si el horario ya está reservado
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE barber = p_barber
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND status != 'cancelled'
    ) THEN
    RAISE EXCEPTION 'This time slot is already booked';
  END IF;

  INSERT INTO bookings (service, service_price, barber, booking_date, booking_time, full_name, phone, email, comments, status, user_id)
  VALUES (p_service, p_service_price, p_barber, p_booking_date, p_booking_time, v_full_name, v_phone, v_email, v_comments, 'pending', v_user_id)
  RETURNING * INTO v_row;

  INSERT INTO customers (user_id, full_name, phone, email, comments)
  VALUES (v_user_id, v_full_name, v_phone, v_email, v_comments)
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      comments = EXCLUDED.comments,
      updated_at = now();

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking(text, integer, text, date, text, text, text, text) TO authenticated;
