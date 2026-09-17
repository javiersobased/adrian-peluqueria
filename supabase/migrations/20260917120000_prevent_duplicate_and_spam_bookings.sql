-- ============================================================================
-- MIGRACIÓN: SISTEMA INTEGRAL ANTI-DUPLICADOS Y PROTECCIÓN CONTRA ATAQUES Y SPAM
-- Fecha: 2026-09-17
-- ============================================================================

-- 1. LIMPIEZA PREVENTIVA DE POSIBLES DUPLICADOS HISTÓRICOS
-- Si existen dos citas activas con el mismo barbero, fecha y hora, conservamos la más reciente y cancelamos la anterior.
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY barber, booking_date, booking_time 
           ORDER BY created_at DESC, id DESC
         ) AS rnum
  FROM public.bookings
  WHERE status != 'cancelled'
)
UPDATE public.bookings
SET status = 'cancelled'
WHERE id IN (
  SELECT id FROM duplicates WHERE rnum > 1
);

-- 2. ÍNDICE ÚNICO PARCIAL EN BASE DE DATOS
-- Garantiza a nivel de motor de almacenamiento B-Tree que NUNCA podrán existir dos reservas activas
-- para el mismo barbero en la misma fecha y hora (previene condiciones de carrera en concurrencia).
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_active_slot
ON public.bookings (barber, booking_date, booking_time)
WHERE status != 'cancelled';

-- 3. FUNCIÓN TRIGGER PARA VALIDACIÓN EXHAUSTIVA DE DUPLICADOS Y SPAM
CREATE OR REPLACE FUNCTION public.validate_booking_anti_spam_and_duplicates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_staff boolean := false;
  v_clean_phone text;
  v_digits text;
  v_active_count integer := 0;
  v_madrid_now timestamp;
  v_madrid_date date;
  v_madrid_time time;
  v_booking_slot_time time;
BEGIN
  -- Si el estado pasa a 'cancelled', permitir la operación sin restricciones
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Hora y fecha local en España peninsular (Huelva: Europe/Madrid)
  v_madrid_now := (now() AT TIME ZONE 'Europe/Madrid');
  v_madrid_date := v_madrid_now::date;
  v_madrid_time := v_madrid_now::time;

  -- 1. Comprobar si quien realiza la reserva es personal verificado o administrador
  BEGIN
    v_is_staff := public.is_admin_or_verified_staff();
  EXCEPTION WHEN OTHERS THEN
    v_is_staff := false;
  END;

  -- 2. Normalización del número de teléfono
  IF NEW.phone IS NOT NULL THEN
    v_clean_phone := regexp_replace(trim(NEW.phone), '[\s\-\(\)]', '', 'g');
    v_digits := regexp_replace(trim(NEW.phone), '\D', '', 'g');
    NEW.phone := v_clean_phone;
  END IF;

  -- 3. Validaciones de fecha y hora para clientes ordinarios
  IF NOT v_is_staff THEN
    -- A. Fecha en el pasado
    IF NEW.booking_date < v_madrid_date THEN
      RAISE EXCEPTION 'No es posible reservar citas en fechas pasadas.';
    END IF;

    -- B. Hora en el pasado para el día de hoy (con margen de cortesía de 5 minutos)
    IF NEW.booking_date = v_madrid_date THEN
      BEGIN
        v_booking_slot_time := (NEW.booking_time || ':00')::time;
        IF v_booking_slot_time < (v_madrid_time - interval '5 minutes') THEN
          RAISE EXCEPTION 'La hora seleccionada (%) ya ha pasado hoy.', NEW.booking_time;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Si hay algún problema de conversión de hora, continuar
        NULL;
      END;
    END IF;

    -- C. Antelación máxima de 60 días
    IF NEW.booking_date > (v_madrid_date + 60) THEN
      RAISE EXCEPTION 'Solo se permiten reservas con un máximo de 60 días de antelación.';
    END IF;

    -- D. Filtro anti-spam de teléfonos falsos o de prueba
    IF v_digits IS NOT NULL THEN
      IF length(v_digits) < 7 OR length(v_digits) > 15 THEN
        RAISE EXCEPTION 'El número de teléfono no tiene una longitud válida.';
      END IF;

      IF v_digits ~ '^(\d)\1+$'
         OR v_digits IN ('123456789', '987654321', '012345678', '876543210', '12345678', '87654321', '600000000', '666666666') THEN
        RAISE EXCEPTION 'El número de teléfono introducido no parece válido.';
      END IF;
    END IF;
  END IF;

  -- 4. PREVENCIÓN DE DUPLICADOS: Mismo horario exacto para el barbero
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE barber = NEW.barber
      AND booking_date = NEW.booking_date
      AND booking_time = NEW.booking_time
      AND status != 'cancelled'
      AND (TG_OP = 'INSERT' OR id != NEW.id)
  ) THEN
    RAISE EXCEPTION 'El horario seleccionado (% a las %) ya está reservado para este barbero.', NEW.booking_date, NEW.booking_time;
  END IF;

  -- 5. PREVENCIÓN DE SOLAPAMIENTO DEL MISMO CLIENTE:
  -- Un cliente no puede tener dos citas a la misma fecha y hora exacta (aunque sea con distinto barbero)
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE (
      (NEW.user_id IS NOT NULL AND user_id = NEW.user_id)
      OR (v_clean_phone IS NOT NULL AND phone = v_clean_phone)
      OR (NEW.email IS NOT NULL AND lower(email) = lower(NEW.email))
    )
    AND booking_date = NEW.booking_date
    AND booking_time = NEW.booking_time
    AND status != 'cancelled'
    AND (TG_OP = 'INSERT' OR id != NEW.id)
  ) THEN
    RAISE EXCEPTION 'Ya tienes una cita confirmada para este mismo día y hora.';
  END IF;

  -- 6. RESTRICCIONES ANTI-SPAM Y ANTI-FLOOD PARA CLIENTES (El personal está exento)
  IF NOT v_is_staff THEN
    -- A. Cooldown anti-flood: Mínimo 20 segundos entre reservas para evitar dobles clics o bucles
    IF TG_OP = 'INSERT' AND EXISTS (
      SELECT 1 FROM public.bookings
      WHERE (
        (NEW.user_id IS NOT NULL AND user_id = NEW.user_id)
        OR (v_clean_phone IS NOT NULL AND phone = v_clean_phone)
      )
      AND created_at > (now() - interval '20 seconds')
    ) THEN
      RAISE EXCEPTION 'Por favor, espera unos segundos antes de realizar otra reserva.';
    END IF;

    -- B. Máximo 1 cita por día para el mismo cliente (evita acaparar la agenda por error)
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE (
        (NEW.user_id IS NOT NULL AND user_id = NEW.user_id)
        OR (v_clean_phone IS NOT NULL AND phone = v_clean_phone)
      )
      AND booking_date = NEW.booking_date
      AND status != 'cancelled'
      AND (TG_OP = 'INSERT' OR id != NEW.id)
    ) THEN
      RAISE EXCEPTION 'Ya tienes una cita reservada para el día %. Para citas adicionales el mismo día, contacta con nosotros.', NEW.booking_date;
    END IF;

    -- C. Límite máximo de citas activas futuras simultáneas: máximo 2 por cliente
    SELECT count(*) INTO v_active_count
    FROM public.bookings
    WHERE (
      (NEW.user_id IS NOT NULL AND user_id = NEW.user_id)
      OR (v_clean_phone IS NOT NULL AND phone = v_clean_phone)
      OR (NEW.email IS NOT NULL AND lower(email) = lower(NEW.email))
    )
    AND status != 'cancelled'
    AND booking_date >= v_madrid_date
    AND (TG_OP = 'INSERT' OR id != NEW.id);

    IF v_active_count >= 2 THEN
      RAISE EXCEPTION 'Ya tienes 2 citas activas reservadas. Si necesitas otra cita, contacta directamente con la peluquería.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. VINCULAR TRIGGER A LA TABLA bookings
DROP TRIGGER IF EXISTS trg_validate_booking_anti_spam_and_duplicates ON public.bookings;
CREATE TRIGGER trg_validate_booking_anti_spam_and_duplicates
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.validate_booking_anti_spam_and_duplicates();

-- 5. ACTUALIZAR create_booking RPC PARA INTEGRACIÓN PERFECTA
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
  v_comments text := trim(coalesce(p_comments, ''));
  v_row public.bookings;
BEGIN
  -- 1. Verificar autenticación
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para reservar una cita';
  END IF;

  -- 2. Validar nombre
  IF length(v_full_name) < 2 THEN
    RAISE EXCEPTION 'El nombre del cliente debe tener al menos 2 caracteres';
  END IF;

  -- 3. Inserción (el trigger validate_booking_anti_spam_and_duplicates se encarga
  -- de verificar duplicados, horario libre, solapamientos, rate limits y spam)
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

  -- 4. Actualizar datos en customers de forma oportunista
  BEGIN
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
      v_row.phone,
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
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking(text, integer, text, date, text, text, text, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
