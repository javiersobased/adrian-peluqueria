-- ============================================================================
-- MIGRACIÓN: PERMITIR CITAS FAMILIARES / CONSECUTIVAS Y ACCESO DE BARBEROS A CLIENTES
-- Fecha: 2026-09-19
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ACTUALIZAR TRIGGER FUNCTION: validate_booking_anti_spam_and_duplicates
-- ----------------------------------------------------------------------------
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
  v_daily_count integer := 0;
  v_madrid_now timestamp;
  v_madrid_date date;
  v_madrid_time time;
  v_booking_slot_time time;
  v_new_duration integer := 30;
  v_new_start_min integer;
  v_new_end_min integer;
  v_conflict_service text;
  v_conflict_time text;
  v_conflict_duration integer;
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

  -- 4.B PREVENCIÓN DE SOLAPAMIENTO POR DURACIÓN DE SERVICIO
  SELECT coalesce(duration_minutes, 30) INTO v_new_duration
  FROM public.services
  WHERE name = NEW.service OR id::text = NEW.service
  LIMIT 1;

  IF v_new_duration IS NULL OR v_new_duration <= 0 THEN
    v_new_duration := 30;
  END IF;

  BEGIN
    v_new_start_min := (substring(NEW.booking_time from '^(\d+)')::integer * 60) + (substring(NEW.booking_time from ':(\d+)$')::integer);
    v_new_end_min := v_new_start_min + v_new_duration;

    SELECT b.booking_time, b.service, coalesce(s.duration_minutes, 30)
    INTO v_conflict_time, v_conflict_service, v_conflict_duration
    FROM public.bookings b
    LEFT JOIN public.services s ON (s.name = b.service OR s.id::text = b.service)
    WHERE b.barber = NEW.barber
      AND b.booking_date = NEW.booking_date
      AND b.status != 'cancelled'
      AND (TG_OP = 'INSERT' OR b.id != NEW.id)
      AND (
        GREATEST(
          v_new_start_min,
          (substring(b.booking_time from '^(\d+)')::integer * 60) + (substring(b.booking_time from ':(\d+)$')::integer)
        ) < LEAST(
          v_new_end_min,
          ((substring(b.booking_time from '^(\d+)')::integer * 60) + (substring(b.booking_time from ':(\d+)$')::integer)) + coalesce(s.duration_minutes, 30)
        )
      )
    LIMIT 1;

    IF v_conflict_time IS NOT NULL THEN
      RAISE EXCEPTION 'El horario seleccionado (% a las %) se solapa con la cita de "%" reservada a las % (% min).',
        NEW.booking_date, NEW.booking_time, v_conflict_service, v_conflict_time, v_conflict_duration;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%se solapa%' THEN
      RAISE;
    END IF;
  END;

  -- 5. PREVENCIÓN DE SOLAPAMIENTO DEL MISMO CLIENTE CON EL MISMO BARBERO:
  -- Un cliente no puede tener dos citas duplicadas a la misma fecha y hora con el MISMO barbero.
  -- (Se permite si es con barberos distintos, por ejemplo si un padre reserva a la misma hora para su hijo con otro barbero).
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE (
      (NEW.user_id IS NOT NULL AND user_id = NEW.user_id)
      OR (v_clean_phone IS NOT NULL AND phone = v_clean_phone)
      OR (NEW.email IS NOT NULL AND lower(email) = lower(NEW.email))
    )
    AND barber = NEW.barber
    AND booking_date = NEW.booking_date
    AND booking_time = NEW.booking_time
    AND status != 'cancelled'
    AND (TG_OP = 'INSERT' OR id != NEW.id)
  ) THEN
    RAISE EXCEPTION 'Ya tienes una cita confirmada con este barbero para este mismo día y hora.';
  END IF;

  -- 6. RESTRICCIONES ANTI-SPAM Y ANTI-FLOOD PARA CLIENTES (El personal está exento)
  IF NOT v_is_staff THEN
    -- A. Cooldown anti-flood: Mínimo 10 segundos entre reservas para evitar dobles clics o bucles
    IF TG_OP = 'INSERT' AND EXISTS (
      SELECT 1 FROM public.bookings
      WHERE (
        (NEW.user_id IS NOT NULL AND user_id = NEW.user_id)
        OR (v_clean_phone IS NOT NULL AND phone = v_clean_phone)
      )
      AND created_at > (now() - interval '10 seconds')
    ) THEN
      RAISE EXCEPTION 'Por favor, espera unos segundos antes de realizar otra reserva.';
    END IF;

    -- B. Máximo 2 citas por día para el mismo cliente (permite citas familiares como padre e hijo consecutivas o separadas)
    SELECT count(*) INTO v_daily_count
    FROM public.bookings
    WHERE (
      (NEW.user_id IS NOT NULL AND user_id = NEW.user_id)
      OR (v_clean_phone IS NOT NULL AND phone = v_clean_phone)
    )
    AND booking_date = NEW.booking_date
    AND status != 'cancelled'
    AND (TG_OP = 'INSERT' OR id != NEW.id);

    IF v_daily_count >= 2 THEN
      RAISE EXCEPTION 'Ya tienes 2 citas reservadas para el día %. Para citas adicionales el mismo día, contacta con nosotros.', NEW.booking_date;
    END IF;

    -- C. Límite máximo de citas activas futuras simultáneas: máximo 4 por cliente
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

    IF v_active_count >= 4 THEN
      RAISE EXCEPTION 'Ya tienes 4 citas activas reservadas. Si necesitas citas adicionales, contacta directamente con la peluquería.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. VINCULAR TRIGGER
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_validate_booking_anti_spam_and_duplicates ON public.bookings;
CREATE TRIGGER trg_validate_booking_anti_spam_and_duplicates
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.validate_booking_anti_spam_and_duplicates();

-- ----------------------------------------------------------------------------
-- 3. POLÍTICAS RLS EN TABLA CUSTOMERS: PERMITIR ACCESO A BARBEROS VERIFICADOS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "select_customers_admin_or_self" ON public.customers;
DROP POLICY IF EXISTS "select_customers_role_based" ON public.customers;
CREATE POLICY "select_customers_role_based" ON public.customers
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin_or_verified_staff()
  );

DROP POLICY IF EXISTS "update_customers_admin_or_self" ON public.customers;
DROP POLICY IF EXISTS "update_customers_role_based" ON public.customers;
CREATE POLICY "update_customers_role_based" ON public.customers
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin_or_verified_staff()
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_admin_or_verified_staff()
  );

-- Mantener DELETE exclusivamente para administradores verificados
DROP POLICY IF EXISTS "delete_customers_admin_only" ON public.customers;
CREATE POLICY "delete_customers_admin_only" ON public.customers
  FOR DELETE TO authenticated
  USING (public.is_admin());
