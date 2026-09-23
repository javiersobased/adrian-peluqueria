-- SaaS multi-tenant · Paso 4 (seguridad por negocio).
-- * Autorización derivada del business_id de cada fila + pertenencia verificada en staff.
-- * Se eliminan los emails maestros codificados: esas cuentas ya son admins verificados en staff.
-- * RPC públicas aceptan p_business_id opcional; si falta, usan el tenant heredado (shim hasta el Paso 6).
-- * Validación cruzada de barbero/reserva dentro del mismo negocio e inmutabilidad de business_id.
-- * Storage: escritura en businesses/{business_id}/… por negocio; la raíz queda solo para el tenant heredado.
-- Rollback: supabase/rollback/20260924000000_saas_tenant_security_down.sql
--           (restaura desde backup_20260923_pre_step4.rollback_sql)

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Helpers de autorización
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.legacy_business_id()
RETURNS uuid LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = ''
AS $$ SELECT 'f67af497-5e58-48a2-8bea-022c4f1d7e1a'::uuid $$;

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT lower(btrim(coalesce(auth.jwt() ->> 'email', ''))) $$;

CREATE OR REPLACE FUNCTION public.is_business_public(p_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = p_business_id AND b.status = 'active')
$$;

CREATE OR REPLACE FUNCTION public.has_business_role(p_business_id uuid, p_roles text[] DEFAULT ARRAY['admin', 'barber'])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p_business_id IS NOT NULL
     AND public.current_user_email() <> ''
     AND EXISTS (
       SELECT 1 FROM public.staff s
       WHERE s.business_id = p_business_id
         AND lower(s.email) = public.current_user_email()
         AND s.status = 'verified'
         AND s.role = ANY (p_roles)
     )
$$;

CREATE OR REPLACE FUNCTION public.my_barber_id(p_business_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT s.barber_id FROM public.staff s
  WHERE s.business_id = p_business_id
    AND lower(s.email) = public.current_user_email()
    AND s.status = 'verified'
  LIMIT 1
$$;

-- Admin del negocio, o barbero verificado actuando sobre su propio perfil/agenda.
CREATE OR REPLACE FUNCTION public.can_manage_barber(p_business_id uuid, p_barber text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.has_business_role(p_business_id, ARRAY['admin'])
      OR (p_barber IS NOT NULL
          AND public.has_business_role(p_business_id, ARRAY['barber'])
          AND p_barber = public.my_barber_id(p_business_id))
$$;

CREATE OR REPLACE FUNCTION public.storage_business_id(p_name text)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE
    WHEN split_part(p_name, '/', 1) = 'businesses'
     AND split_part(p_name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN split_part(p_name, '/', 2)::uuid
  END
$$;

-- businesses/{id}/… exige rol en ese negocio; objetos en la raíz solo para el tenant heredado.
CREATE OR REPLACE FUNCTION public.can_write_storage_object(p_name text, p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT CASE
    WHEN public.storage_business_id(p_name) IS NOT NULL
      THEN public.has_business_role(public.storage_business_id(p_name), p_roles)
    WHEN strpos(p_name, '/') = 0
      THEN public.has_business_role(public.legacy_business_id(), p_roles)
    ELSE false
  END
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Funciones heredadas sin emails maestros (ámbito: tenant heredado)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT public.has_business_role(public.legacy_business_id(), ARRAY['admin']) $$;

CREATE OR REPLACE FUNCTION public.is_admin_or_verified_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT public.has_business_role(public.legacy_business_id(), ARRAY['admin', 'barber']) $$;

CREATE OR REPLACE FUNCTION public.is_verified_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT public.has_business_role(public.legacy_business_id(), ARRAY['admin', 'barber']) $$;

CREATE OR REPLACE FUNCTION public.is_staff_verified()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT public.has_business_role(public.legacy_business_id(), ARRAY['admin', 'barber']) $$;

CREATE OR REPLACE FUNCTION public.is_verified_barber(p_barber_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.has_business_role(public.legacy_business_id(), ARRAY['barber'])
     AND public.my_barber_id(public.legacy_business_id()) = p_barber_id
$$;

CREATE OR REPLACE FUNCTION public.get_my_role(p_business_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_email text := public.current_user_email();
  v_row record;
  v_barber_id text;
  v_none jsonb := jsonb_build_object('role', null, 'status', null, 'barber_id', null, 'email', null);
BEGIN
  IF v_email = '' OR p_business_id IS NULL THEN
    RETURN v_none;
  END IF;

  SELECT s.role, s.status, s.barber_id, s.email INTO v_row
  FROM public.staff s
  WHERE s.business_id = p_business_id AND lower(s.email) = v_email
  LIMIT 1;

  IF FOUND AND v_row.status = 'verified' THEN
    RETURN jsonb_build_object('role', v_row.role, 'status', v_row.status,
                              'barber_id', v_row.barber_id, 'email', v_row.email);
  END IF;

  SELECT b.id INTO v_barber_id
  FROM public.barbers b
  WHERE b.business_id = p_business_id AND b.active AND lower(btrim(b.google_email)) = v_email
  LIMIT 1;

  IF v_barber_id IS NOT NULL THEN
    RETURN jsonb_build_object('role', 'barber', 'status', 'verified', 'barber_id', v_barber_id, 'email', v_email);
  END IF;

  RETURN v_none;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT public.get_my_role(public.legacy_business_id()) $$;

-- ─────────────────────────────────────────────────────────────
-- 3. RPC públicas tenant-aware (p_business_id opcional al final)
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION public.get_booked_intervals(text, date);
CREATE FUNCTION public.get_booked_intervals(p_barber text, p_date date, p_business_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH biz AS (SELECT coalesce(p_business_id, public.legacy_business_id()) AS id)
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'booking_time', b.booking_time,
        'service', b.service,
        'duration_minutes', coalesce(s.duration_minutes, 30)
      ) ORDER BY b.booking_time ASC
    ),
    '[]'::jsonb
  )
  FROM biz
  JOIN public.bookings b ON b.business_id = biz.id
  LEFT JOIN LATERAL (
    SELECT sv.duration_minutes FROM public.services sv
    WHERE sv.business_id = b.business_id AND (sv.name = b.service OR sv.id::text = b.service)
    LIMIT 1
  ) s ON true
  WHERE public.is_business_public(biz.id)
    AND b.barber = p_barber
    AND b.booking_date = p_date
    AND b.status <> 'cancelled'
$$;

DROP FUNCTION public.get_booked_slots(text, date);
CREATE FUNCTION public.get_booked_slots(p_barber text, p_date date, p_business_id uuid DEFAULT NULL)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT b.booking_time FROM public.bookings b
  WHERE b.business_id = coalesce(p_business_id, public.legacy_business_id())
    AND public.is_business_public(b.business_id)
    AND b.barber = p_barber
    AND b.booking_date = p_date
    AND b.status <> 'cancelled'
$$;

DROP FUNCTION public.create_booking(text, integer, text, date, text, text, text, text);
CREATE FUNCTION public.create_booking(
  p_service text, p_service_price integer, p_barber text, p_booking_date date, p_booking_time text,
  p_full_name text, p_phone text, p_comments text DEFAULT '', p_business_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_business_id uuid := coalesce(p_business_id, public.legacy_business_id());
  v_full_name text := trim(p_full_name);
  v_phone text := trim(p_phone);
  v_clean_phone text;
  v_digits text;
  v_comments text := trim(coalesce(p_comments, ''));
  v_row public.bookings;
  v_recent_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para reservar una cita';
  END IF;

  IF NOT public.is_business_public(v_business_id) THEN
    RAISE EXCEPTION 'Este negocio no admite reservas en este momento';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.barbers
    WHERE business_id = v_business_id AND id = p_barber AND active
  ) THEN
    RAISE EXCEPTION 'El profesional seleccionado no está disponible';
  END IF;

  IF length(v_full_name) < 2 THEN
    RAISE EXCEPTION 'El nombre del cliente debe tener al menos 2 caracteres';
  END IF;

  v_clean_phone := regexp_replace(v_phone, '[\s\-\(\)]', '', 'g');
  v_digits := regexp_replace(v_phone, '\D', '', 'g');

  IF length(v_digits) < 7 OR length(v_digits) > 15 THEN
    RAISE EXCEPTION 'El número de teléfono no es válido';
  END IF;

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

  SELECT count(*) INTO v_recent_count
  FROM public.bookings
  WHERE business_id = v_business_id
    AND user_id = v_user_id
    AND status != 'cancelled'
    AND booking_date >= CURRENT_DATE;

  IF v_recent_count >= 3 THEN
    RAISE EXCEPTION 'Ya tienes 3 citas activas reservadas. Si necesitas otra, contacta directamente con la peluquería.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE business_id = v_business_id
      AND barber = p_barber
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND status != 'cancelled'
  ) THEN
    RAISE EXCEPTION 'El horario seleccionado ya no está disponible. Por favor, elige otra hora.';
  END IF;

  INSERT INTO public.bookings (
    business_id, service, service_price, barber, booking_date, booking_time,
    full_name, phone, email, comments, status, user_id
  )
  VALUES (
    v_business_id, p_service, p_service_price, p_barber, p_booking_date, p_booking_time,
    v_full_name, v_phone, v_email, v_comments, 'pending', v_user_id
  )
  RETURNING * INTO v_row;

  INSERT INTO public.customers (business_id, user_id, full_name, phone, email, comments, updated_at)
  VALUES (v_business_id, v_user_id, v_full_name, v_phone, v_email, v_comments, now())
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      comments = EXCLUDED.comments,
      updated_at = now()
  WHERE customers.business_id = EXCLUDED.business_id;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_booking(p_booking_id uuid, p_new_date date, p_new_time text)
RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_barber text;
  v_business_id uuid;
  v_row public.bookings;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT barber, business_id INTO v_barber, v_business_id
  FROM public.bookings
  WHERE id = p_booking_id
    AND user_id = v_user_id
    AND status != 'cancelled';

  IF v_barber IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE business_id = v_business_id
      AND barber = v_barber
      AND booking_date = p_new_date
      AND booking_time = p_new_time
      AND status != 'cancelled'
      AND id != p_booking_id
  ) THEN
    RAISE EXCEPTION 'This time slot is already booked';
  END IF;

  PERFORM set_config('app.rescheduling', 'true', true);

  UPDATE public.bookings
  SET booking_date = p_new_date,
      booking_time = p_new_time
  WHERE id = p_booking_id
    AND user_id = v_user_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

DROP FUNCTION public.update_my_barber_profile(text, text, text);
CREATE FUNCTION public.update_my_barber_profile(
  p_barber_id text, p_name text DEFAULT NULL, p_photo_url text DEFAULT NULL, p_business_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_email text := public.current_user_email();
  v_business_id uuid := coalesce(p_business_id, public.legacy_business_id());
  v_matched_id text;
  v_initials text;
BEGIN
  IF v_email = '' THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT b.id INTO v_matched_id
  FROM public.barbers b
  WHERE b.business_id = v_business_id
    AND b.id = p_barber_id
    AND (lower(btrim(coalesce(b.google_email, ''))) = v_email
         OR public.can_manage_barber(v_business_id, b.id));

  IF v_matched_id IS NULL THEN
    RAISE EXCEPTION 'No tienes permiso para actualizar este perfil';
  END IF;

  IF p_name IS NOT NULL AND trim(p_name) <> '' THEN
    SELECT string_agg(substring(word from 1 for 1), '')
    INTO v_initials
    FROM regexp_split_to_table(trim(p_name), '\s+') AS word;
    v_initials := upper(substring(v_initials from 1 for 2));

    UPDATE public.barbers
    SET name = trim(p_name),
        initials = coalesce(v_initials, initials)
    WHERE business_id = v_business_id AND id = v_matched_id;
  END IF;

  IF p_photo_url IS NOT NULL THEN
    UPDATE public.barbers
    SET photo_url = CASE WHEN p_photo_url IN ('', 'null') THEN NULL ELSE p_photo_url END
    WHERE business_id = v_business_id AND id = v_matched_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'barber_id', v_matched_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.acquire_notification_idempotency(
  p_key text, p_booking_id uuid DEFAULT NULL, p_type text DEFAULT 'email', p_recipient text DEFAULT ''
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_key IS NULL OR trim(p_key) = '' THEN
    RETURN true;
  END IF;

  INSERT INTO public.notification_idempotency (
    business_id, idempotency_key, booking_id, notification_type, recipient, status
  ) VALUES (
    coalesce((SELECT b.business_id FROM public.bookings b WHERE b.id = p_booking_id), public.legacy_business_id()),
    trim(p_key), p_booking_id, coalesce(p_type, 'email'), trim(coalesce(p_recipient, '')), 'sent'
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN FOUND;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Triggers: validación por negocio
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_booking_anti_spam_and_duplicates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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
  IF TG_OP = 'INSERT' OR NEW.barber IS DISTINCT FROM OLD.barber THEN
    IF NOT EXISTS (SELECT 1 FROM public.barbers WHERE business_id = NEW.business_id AND id = NEW.barber) THEN
      RAISE EXCEPTION 'El profesional seleccionado no pertenece a este negocio.';
    END IF;
  END IF;

  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Serializa altas/cambios concurrentes del mismo barbero y día dentro del negocio.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.business_id::text || '|' || NEW.barber || '|' || NEW.booking_date::text, 0));

  v_madrid_now := (now() AT TIME ZONE 'Europe/Madrid');
  v_madrid_date := v_madrid_now::date;
  v_madrid_time := v_madrid_now::time;

  BEGIN
    v_is_staff := public.has_business_role(NEW.business_id, ARRAY['admin', 'barber']);
  EXCEPTION WHEN OTHERS THEN
    v_is_staff := false;
  END;

  IF NOT v_is_staff AND TG_OP = 'INSERT' AND NOT public.is_business_public(NEW.business_id) THEN
    RAISE EXCEPTION 'Este negocio no admite reservas en este momento.';
  END IF;

  IF NEW.phone IS NOT NULL THEN
    v_clean_phone := regexp_replace(trim(NEW.phone), '[\s\-\(\)]', '', 'g');
    v_digits := regexp_replace(trim(NEW.phone), '\D', '', 'g');
    NEW.phone := v_clean_phone;
  END IF;

  IF NOT v_is_staff THEN
    IF NEW.booking_date < v_madrid_date THEN
      RAISE EXCEPTION 'No es posible reservar citas en fechas pasadas.';
    END IF;

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

    IF NEW.booking_date > (v_madrid_date + 60) THEN
      RAISE EXCEPTION 'Solo se permiten reservas con un máximo de 60 días de antelación.';
    END IF;

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

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE business_id = NEW.business_id
      AND barber = NEW.barber
      AND booking_date = NEW.booking_date
      AND booking_time = NEW.booking_time
      AND status != 'cancelled'
      AND (TG_OP = 'INSERT' OR id != NEW.id)
  ) THEN
    RAISE EXCEPTION 'El horario seleccionado (% a las %) ya está reservado para este barbero.', NEW.booking_date, NEW.booking_time;
  END IF;

  SELECT coalesce(duration_minutes, 30) INTO v_new_duration
  FROM public.services
  WHERE business_id = NEW.business_id AND (name = NEW.service OR id::text = NEW.service)
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
    LEFT JOIN LATERAL (
      SELECT sv.duration_minutes FROM public.services sv
      WHERE sv.business_id = b.business_id AND (sv.name = b.service OR sv.id::text = b.service)
      LIMIT 1
    ) s ON true
    WHERE b.business_id = NEW.business_id
      AND b.barber = NEW.barber
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

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE business_id = NEW.business_id
      AND (
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

  IF NOT v_is_staff THEN
    IF TG_OP = 'INSERT' AND EXISTS (
      SELECT 1 FROM public.bookings
      WHERE business_id = NEW.business_id
        AND (
          (NEW.user_id IS NOT NULL AND user_id = NEW.user_id)
          OR (v_clean_phone IS NOT NULL AND phone = v_clean_phone)
        )
        AND created_at > (now() - interval '10 seconds')
    ) THEN
      RAISE EXCEPTION 'Por favor, espera unos segundos antes de realizar otra reserva.';
    END IF;

    SELECT count(*) INTO v_daily_count
    FROM public.bookings
    WHERE business_id = NEW.business_id
      AND (
        (NEW.user_id IS NOT NULL AND user_id = NEW.user_id)
        OR (v_clean_phone IS NOT NULL AND phone = v_clean_phone)
      )
      AND booking_date = NEW.booking_date
      AND status != 'cancelled'
      AND (TG_OP = 'INSERT' OR id != NEW.id);

    IF v_daily_count >= 2 THEN
      RAISE EXCEPTION 'Ya tienes 2 citas reservadas para el día %. Para citas adicionales el mismo día, contacta con nosotros.', NEW.booking_date;
    END IF;

    SELECT count(*) INTO v_active_count
    FROM public.bookings
    WHERE business_id = NEW.business_id
      AND (
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

CREATE OR REPLACE FUNCTION public.validate_booking_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF public.has_business_role(OLD.business_id, ARRAY['admin', 'barber']) THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You can only modify your own bookings';
  END IF;

  IF current_setting('app.rescheduling', true) = 'true' THEN
    IF NEW.service IS DISTINCT FROM OLD.service OR
       NEW.service_price IS DISTINCT FROM OLD.service_price OR
       NEW.barber IS DISTINCT FROM OLD.barber OR
       NEW.full_name IS DISTINCT FROM OLD.full_name OR
       NEW.phone IS DISTINCT FROM OLD.phone OR
       NEW.email IS DISTINCT FROM OLD.email OR
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Forbidden: Tampering with booking metadata during reschedule is prohibited';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.service IS DISTINCT FROM OLD.service OR
     NEW.service_price IS DISTINCT FROM OLD.service_price OR
     NEW.barber IS DISTINCT FROM OLD.barber OR
     NEW.booking_date IS DISTINCT FROM OLD.booking_date OR
     NEW.booking_time IS DISTINCT FROM OLD.booking_time OR
     NEW.full_name IS DISTINCT FROM OLD.full_name OR
     NEW.phone IS DISTINCT FROM OLD.phone OR
     NEW.email IS DISTINCT FROM OLD.email OR
     NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Forbidden: Customers cannot alter booking details directly. Use reschedule_booking for date/time changes.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status != 'cancelled' THEN
    RAISE EXCEPTION 'Forbidden: Customers can only cancel their bookings';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_booking_activity_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_notifications (
      business_id, booking_id, type, title, message, client_name, client_phone, client_email, barber, service, service_price, booking_date, booking_time
    ) VALUES (
      NEW.business_id,
      NEW.id,
      CASE WHEN NEW.status = 'cancelled' THEN 'cancelled' ELSE 'created' END,
      CASE WHEN NEW.status = 'cancelled' THEN 'Cita cancelada' ELSE 'Nueva cita reservada' END,
      CASE WHEN NEW.status = 'cancelled'
        THEN NEW.full_name || ' ha cancelado su cita del ' || to_char(NEW.booking_date, 'DD/MM/YYYY') || ' a las ' || NEW.booking_time || 'h'
        ELSE NEW.full_name || ' ha reservado cita para el ' || to_char(NEW.booking_date, 'DD/MM/YYYY') || ' a las ' || NEW.booking_time || 'h (' || NEW.service || ')'
      END,
      NEW.full_name, NEW.phone, NEW.email, NEW.barber, NEW.service, NEW.service_price, NEW.booking_date, NEW.booking_time
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
      INSERT INTO public.booking_notifications (
        business_id, booking_id, type, title, message, client_name, client_phone, client_email, barber, service, service_price, booking_date, booking_time, old_date, old_time, old_barber
      ) VALUES (
        NEW.business_id,
        NEW.id,
        'cancelled',
        'Cita cancelada',
        NEW.full_name || ' ha cancelado su cita del ' || to_char(OLD.booking_date, 'DD/MM/YYYY') || ' a las ' || OLD.booking_time || 'h',
        NEW.full_name, NEW.phone, NEW.email, NEW.barber, NEW.service, NEW.service_price, NEW.booking_date, NEW.booking_time,
        OLD.booking_date, OLD.booking_time, OLD.barber
      );
    ELSIF OLD.booking_date != NEW.booking_date OR OLD.booking_time != NEW.booking_time OR OLD.barber != NEW.barber THEN
      INSERT INTO public.booking_notifications (
        business_id, booking_id, type, title, message, client_name, client_phone, client_email, barber, service, service_price, booking_date, booking_time, old_date, old_time, old_barber
      ) VALUES (
        NEW.business_id,
        NEW.id,
        'rescheduled',
        'Cita reprogramada / modificada',
        'Cita de ' || NEW.full_name || ' cambiada de ' || to_char(OLD.booking_date, 'DD/MM/YYYY') || ' ' || OLD.booking_time || 'h a ' || to_char(NEW.booking_date, 'DD/MM/YYYY') || ' ' || NEW.booking_time || 'h' || CASE WHEN OLD.barber != NEW.barber THEN ' (Reasignada a ' || NEW.barber || ')' ELSE '' END,
        NEW.full_name, NEW.phone, NEW.email, NEW.barber, NEW.service, NEW.service_price, NEW.booking_date, NEW.booking_time,
        OLD.booking_date, OLD.booking_time, OLD.barber
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_barber_staff_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_old_email text;
  v_new_email text;
  v_email_item text;
  v_all_new_admin_emails text[] := ARRAY[]::text[];
  v_all_old_admin_emails text[] := ARRAY[]::text[];
  v_protected_emails text[] := ARRAY['franciscojavierfarinapadilla@gmail.com'];
BEGIN
  -- A. Perfil principal del tenant heredado: google_email + admin_emails son admins del negocio.
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.id = 'adrian' AND NEW.business_id = public.legacy_business_id() THEN
    IF NEW.google_email IS NOT NULL AND trim(NEW.google_email) != '' THEN
      v_all_new_admin_emails := array_append(v_all_new_admin_emails, lower(trim(NEW.google_email)));
    END IF;

    IF NEW.admin_emails IS NOT NULL THEN
      FOREACH v_email_item IN ARRAY NEW.admin_emails LOOP
        IF v_email_item IS NOT NULL AND trim(v_email_item) != '' THEN
          v_all_new_admin_emails := array_append(v_all_new_admin_emails, lower(trim(v_email_item)));
        END IF;
      END LOOP;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF OLD.google_email IS NOT NULL AND trim(OLD.google_email) != '' THEN
        v_all_old_admin_emails := array_append(v_all_old_admin_emails, lower(trim(OLD.google_email)));
      END IF;

      IF OLD.admin_emails IS NOT NULL THEN
        FOREACH v_email_item IN ARRAY OLD.admin_emails LOOP
          IF v_email_item IS NOT NULL AND trim(v_email_item) != '' THEN
            v_all_old_admin_emails := array_append(v_all_old_admin_emails, lower(trim(v_email_item)));
          END IF;
        END LOOP;
      END IF;

      FOREACH v_email_item IN ARRAY v_all_old_admin_emails LOOP
        IF NOT (v_email_item = ANY(v_all_new_admin_emails)) AND NOT (v_email_item = ANY(v_protected_emails)) THEN
          DELETE FROM public.staff
          WHERE email = v_email_item AND barber_id = 'adrian' AND business_id = NEW.business_id;
        END IF;
      END LOOP;
    END IF;

    FOREACH v_email_item IN ARRAY v_all_new_admin_emails LOOP
      INSERT INTO public.staff (business_id, email, full_name, role, barber_id, status)
      VALUES (NEW.business_id, v_email_item, NEW.name, 'admin', 'adrian', 'verified')
      ON CONFLICT (email) DO UPDATE
        SET role = 'admin',
            status = 'verified',
            barber_id = 'adrian',
            full_name = NEW.name
        WHERE staff.business_id = EXCLUDED.business_id;
    END LOOP;

    RETURN NEW;
  END IF;

  -- B. Barbero regular
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.staff
    WHERE business_id = OLD.business_id
      AND barber_id = OLD.id
      AND role = 'barber'
      AND email != ALL(v_protected_emails);
    RETURN OLD;
  END IF;

  v_new_email := NULLIF(lower(trim(NEW.google_email)), '');

  IF TG_OP = 'UPDATE' THEN
    v_old_email := NULLIF(lower(trim(OLD.google_email)), '');
    IF v_old_email IS NOT NULL AND v_old_email IS DISTINCT FROM v_new_email THEN
      DELETE FROM public.staff
      WHERE business_id = NEW.business_id
        AND (email = v_old_email OR barber_id = NEW.id)
        AND role = 'barber'
        AND email != ALL(v_protected_emails);
    END IF;
  END IF;

  IF v_new_email IS NOT NULL THEN
    INSERT INTO public.staff (business_id, email, full_name, role, barber_id, status)
    VALUES (NEW.business_id, v_new_email, NEW.name, 'barber', NEW.id, 'verified')
    ON CONFLICT (email) DO UPDATE
      SET role = 'barber',
          status = 'verified',
          barber_id = NEW.id,
          full_name = NEW.name
      WHERE staff.role = 'barber' AND staff.business_id = EXCLUDED.business_id;
  ELSE
    DELETE FROM public.staff
    WHERE business_id = NEW.business_id
      AND barber_id = NEW.id
      AND role = 'barber'
      AND email != ALL(v_protected_emails);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_delete_adrian()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF OLD.business_id = public.legacy_business_id()
     AND (OLD.id = 'adrian' OR lower(trim(OLD.name)) IN ('adrian', 'adrián')) THEN
    RAISE EXCEPTION 'El perfil principal de Adrián está protegido y no se puede eliminar';
  END IF;
  RETURN OLD;
END;
$$;

-- business_id es inmutable en todas las tablas de aplicación.
CREATE OR REPLACE FUNCTION public.reject_business_id_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'business_id es inmutable (tabla %)', TG_TABLE_NAME;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bookings','barbers','services','barber_schedules','barber_blocks','barber_vacations',
    'staff','customers','booking_notifications','notification_idempotency',
    'store_categories','store_products','gallery_photos'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_business_id_immutable ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_business_id_immutable BEFORE UPDATE OF business_id ON public.%I
         FOR EACH ROW WHEN (OLD.business_id IS DISTINCT FROM NEW.business_id)
         EXECUTE FUNCTION public.reject_business_id_change()', t);
  END LOOP;
END $$;

-- El barbero referenciado por texto debe existir en el mismo negocio.
CREATE OR REPLACE FUNCTION public.enforce_barber_in_business()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_barber text := to_jsonb(NEW) ->> 'barber';
BEGIN
  IF v_barber IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.barbers WHERE business_id = NEW.business_id AND id = v_barber) THEN
    RAISE EXCEPTION 'El profesional % no pertenece a este negocio', v_barber;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_barber_in_business ON public.barber_blocks;
CREATE TRIGGER trg_barber_in_business BEFORE INSERT OR UPDATE OF barber, business_id ON public.barber_blocks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_barber_in_business();
DROP TRIGGER IF EXISTS trg_barber_in_business ON public.barber_vacations;
CREATE TRIGGER trg_barber_in_business BEFORE INSERT OR UPDATE OF barber, business_id ON public.barber_vacations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_barber_in_business();
DROP TRIGGER IF EXISTS trg_barber_in_business ON public.barber_schedules;
CREATE TRIGGER trg_barber_in_business BEFORE INSERT OR UPDATE OF barber, business_id ON public.barber_schedules
  FOR EACH ROW EXECUTE FUNCTION public.enforce_barber_in_business();

-- Una notificación pertenece siempre al negocio de su reserva.
CREATE OR REPLACE FUNCTION public.set_notification_business()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_business_id uuid;
BEGIN
  IF NEW.booking_id IS NOT NULL THEN
    SELECT business_id INTO v_business_id FROM public.bookings WHERE id = NEW.booking_id;
    IF v_business_id IS NOT NULL THEN
      NEW.business_id := v_business_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_business ON public.booking_notifications;
CREATE TRIGGER trg_notification_business BEFORE INSERT ON public.booking_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_notification_business();

-- Un barbero no admin no puede cambiar identidad, accesos ni visibilidad de su perfil.
CREATE OR REPLACE FUNCTION public.guard_barber_sensitive_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'authenticated'
     OR public.has_business_role(OLD.business_id, ARRAY['admin']) THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.google_email IS DISTINCT FROM OLD.google_email
     OR NEW.admin_emails IS DISTINCT FROM OLD.admin_emails
     OR NEW.active IS DISTINCT FROM OLD.active THEN
    RAISE EXCEPTION 'Solo un administrador puede modificar el identificador, los accesos o la visibilidad del profesional';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_barber_sensitive_columns ON public.barbers;
CREATE TRIGGER trg_guard_barber_sensitive_columns BEFORE UPDATE ON public.barbers
  FOR EACH ROW EXECUTE FUNCTION public.guard_barber_sensitive_columns();

-- ─────────────────────────────────────────────────────────────
-- 5. Políticas RLS por negocio (se sustituyen todas las heredadas)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('bookings','barbers','services','barber_schedules','barber_blocks','barber_vacations',
                        'staff','customers','booking_notifications','notification_idempotency',
                        'store_categories','store_products','gallery_photos')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Catálogo público (negocio activo) + lectura completa para el equipo del negocio
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['barbers','services','barber_schedules','barber_blocks','barber_vacations',
                           'store_categories','store_products','gallery_photos'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (public.is_business_public(business_id))',
                   t || '_public_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_business_role(business_id))',
                   t || '_staff_read', t);
  END LOOP;
END $$;

-- barbers
CREATE POLICY barbers_admin_insert ON public.barbers FOR INSERT TO authenticated
  WITH CHECK (public.has_business_role(business_id, ARRAY['admin']));
CREATE POLICY barbers_admin_delete ON public.barbers FOR DELETE TO authenticated
  USING (public.has_business_role(business_id, ARRAY['admin']));
CREATE POLICY barbers_manage_update ON public.barbers FOR UPDATE TO authenticated
  USING (public.can_manage_barber(business_id, id))
  WITH CHECK (public.can_manage_barber(business_id, id));

-- services (solo admin escribe)
CREATE POLICY services_admin_insert ON public.services FOR INSERT TO authenticated
  WITH CHECK (public.has_business_role(business_id, ARRAY['admin']));
CREATE POLICY services_admin_update ON public.services FOR UPDATE TO authenticated
  USING (public.has_business_role(business_id, ARRAY['admin']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['admin']));
CREATE POLICY services_admin_delete ON public.services FOR DELETE TO authenticated
  USING (public.has_business_role(business_id, ARRAY['admin']));

-- tienda (equipo del negocio escribe, como hasta ahora)
CREATE POLICY store_categories_staff_insert ON public.store_categories FOR INSERT TO authenticated
  WITH CHECK (public.has_business_role(business_id));
CREATE POLICY store_categories_staff_update ON public.store_categories FOR UPDATE TO authenticated
  USING (public.has_business_role(business_id)) WITH CHECK (public.has_business_role(business_id));
CREATE POLICY store_categories_staff_delete ON public.store_categories FOR DELETE TO authenticated
  USING (public.has_business_role(business_id));
CREATE POLICY store_products_staff_insert ON public.store_products FOR INSERT TO authenticated
  WITH CHECK (public.has_business_role(business_id));
CREATE POLICY store_products_staff_update ON public.store_products FOR UPDATE TO authenticated
  USING (public.has_business_role(business_id)) WITH CHECK (public.has_business_role(business_id));
CREATE POLICY store_products_staff_delete ON public.store_products FOR DELETE TO authenticated
  USING (public.has_business_role(business_id));

-- galería (equipo del negocio)
CREATE POLICY gallery_photos_staff_insert ON public.gallery_photos FOR INSERT TO authenticated
  WITH CHECK (public.has_business_role(business_id));
CREATE POLICY gallery_photos_staff_delete ON public.gallery_photos FOR DELETE TO authenticated
  USING (public.has_business_role(business_id));

-- agenda del profesional: admin o el propio barbero
CREATE POLICY barber_schedules_manage_insert ON public.barber_schedules FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_barber(business_id, coalesce(barber_id, barber)));
CREATE POLICY barber_schedules_manage_update ON public.barber_schedules FOR UPDATE TO authenticated
  USING (public.can_manage_barber(business_id, coalesce(barber_id, barber)))
  WITH CHECK (public.can_manage_barber(business_id, coalesce(barber_id, barber)));
CREATE POLICY barber_schedules_manage_delete ON public.barber_schedules FOR DELETE TO authenticated
  USING (public.can_manage_barber(business_id, coalesce(barber_id, barber)));

CREATE POLICY barber_blocks_manage_insert ON public.barber_blocks FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_barber(business_id, barber));
CREATE POLICY barber_blocks_manage_update ON public.barber_blocks FOR UPDATE TO authenticated
  USING (public.can_manage_barber(business_id, barber)) WITH CHECK (public.can_manage_barber(business_id, barber));
CREATE POLICY barber_blocks_manage_delete ON public.barber_blocks FOR DELETE TO authenticated
  USING (public.can_manage_barber(business_id, barber));

CREATE POLICY barber_vacations_manage_insert ON public.barber_vacations FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_barber(business_id, barber));
CREATE POLICY barber_vacations_manage_update ON public.barber_vacations FOR UPDATE TO authenticated
  USING (public.can_manage_barber(business_id, barber)) WITH CHECK (public.can_manage_barber(business_id, barber));
CREATE POLICY barber_vacations_manage_delete ON public.barber_vacations FOR DELETE TO authenticated
  USING (public.can_manage_barber(business_id, barber));

-- bookings: cliente propio, admin del negocio o el barbero de la cita
CREATE POLICY bookings_select ON public.bookings FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.can_manage_barber(business_id, barber));
CREATE POLICY bookings_insert ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.can_manage_barber(business_id, barber));
CREATE POLICY bookings_update ON public.bookings FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.can_manage_barber(business_id, barber))
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.can_manage_barber(business_id, barber));
CREATE POLICY bookings_admin_delete ON public.bookings FOR DELETE TO authenticated
  USING (public.has_business_role(business_id, ARRAY['admin']));

-- customers
CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.has_business_role(business_id));
CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.has_business_role(business_id, ARRAY['admin']));
CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.has_business_role(business_id))
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.has_business_role(business_id));
CREATE POLICY customers_admin_delete ON public.customers FOR DELETE TO authenticated
  USING (public.has_business_role(business_id, ARRAY['admin']));

-- staff
CREATE POLICY staff_select ON public.staff FOR SELECT TO authenticated
  USING (public.has_business_role(business_id, ARRAY['admin']) OR lower(email) = public.current_user_email());
CREATE POLICY staff_admin_insert ON public.staff FOR INSERT TO authenticated
  WITH CHECK (public.has_business_role(business_id, ARRAY['admin']));
CREATE POLICY staff_admin_update ON public.staff FOR UPDATE TO authenticated
  USING (public.has_business_role(business_id, ARRAY['admin']))
  WITH CHECK (public.has_business_role(business_id, ARRAY['admin']));
CREATE POLICY staff_admin_delete ON public.staff FOR DELETE TO authenticated
  USING (public.has_business_role(business_id, ARRAY['admin']));

-- booking_notifications: admin del negocio o el barbero afectado
CREATE POLICY booking_notifications_select ON public.booking_notifications FOR SELECT TO authenticated
  USING (public.can_manage_barber(business_id, barber));
CREATE POLICY booking_notifications_insert ON public.booking_notifications FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_barber(business_id, barber));
CREATE POLICY booking_notifications_update ON public.booking_notifications FOR UPDATE TO authenticated
  USING (public.can_manage_barber(business_id, barber)) WITH CHECK (public.can_manage_barber(business_id, barber));
CREATE POLICY booking_notifications_delete ON public.booking_notifications FOR DELETE TO authenticated
  USING (public.can_manage_barber(business_id, barber));

-- notification_idempotency
CREATE POLICY notification_idempotency_staff_read ON public.notification_idempotency FOR SELECT TO authenticated
  USING (public.has_business_role(business_id));

-- Emails del equipo fuera del alcance anónimo
REVOKE SELECT ON public.barbers FROM anon;
GRANT SELECT (id, name, role, initials, photo_url, active, sort_order, created_at, business_id) ON public.barbers TO anon;

-- ─────────────────────────────────────────────────────────────
-- 6. Storage: escritura por carpeta de negocio
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS delete_product_images_admin ON storage.objects;
DROP POLICY IF EXISTS insert_product_images_admin ON storage.objects;
DROP POLICY IF EXISTS staff_delete_barber_photos ON storage.objects;
DROP POLICY IF EXISTS staff_delete_gallery_photos ON storage.objects;
DROP POLICY IF EXISTS staff_update_barber_photos ON storage.objects;
DROP POLICY IF EXISTS staff_upload_barber_photos ON storage.objects;
DROP POLICY IF EXISTS staff_upload_gallery_photos ON storage.objects;

CREATE POLICY tenant_insert_barber_photos ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'barber-photos' AND public.can_write_storage_object(name, ARRAY['admin', 'barber']));
CREATE POLICY tenant_update_barber_photos ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'barber-photos' AND public.can_write_storage_object(name, ARRAY['admin', 'barber']))
  WITH CHECK (bucket_id = 'barber-photos' AND public.can_write_storage_object(name, ARRAY['admin', 'barber']));
CREATE POLICY tenant_delete_barber_photos ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'barber-photos' AND public.can_write_storage_object(name, ARRAY['admin', 'barber']));

CREATE POLICY tenant_insert_gallery_photos ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery-photos' AND public.can_write_storage_object(name, ARRAY['admin', 'barber']));
CREATE POLICY tenant_delete_gallery_photos ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gallery-photos' AND public.can_write_storage_object(name, ARRAY['admin', 'barber']));

CREATE POLICY tenant_insert_product_images ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.can_write_storage_object(name, ARRAY['admin']));
CREATE POLICY tenant_delete_product_images ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.can_write_storage_object(name, ARRAY['admin']));

-- ─────────────────────────────────────────────────────────────
-- 7. Privilegios EXECUTE mínimos
-- ─────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION
  public.legacy_business_id(), public.current_user_email(), public.is_business_public(uuid),
  public.has_business_role(uuid, text[]), public.my_barber_id(uuid), public.can_manage_barber(uuid, text),
  public.storage_business_id(text), public.can_write_storage_object(text, text[]),
  public.is_admin(), public.is_admin_or_verified_staff(), public.is_verified_staff(), public.is_staff_verified(),
  public.is_verified_barber(text), public.get_my_role(), public.get_my_role(uuid),
  public.get_booked_intervals(text, date, uuid), public.get_booked_slots(text, date, uuid),
  public.create_booking(text, integer, text, date, text, text, text, text, uuid),
  public.reschedule_booking(uuid, date, text), public.update_my_barber_profile(text, text, text, uuid),
  public.acquire_notification_idempotency(text, uuid, text, text),
  public.validate_booking_anti_spam_and_duplicates(), public.validate_booking_update(),
  public.trigger_booking_activity_notification(), public.sync_barber_staff_access(), public.prevent_delete_adrian(),
  public.reject_business_id_change(), public.enforce_barber_in_business(), public.set_notification_business(),
  public.guard_barber_sensitive_columns()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.is_business_public(uuid), public.get_my_role(), public.get_my_role(uuid),
  public.get_booked_intervals(text, date, uuid), public.get_booked_slots(text, date, uuid)
TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.legacy_business_id(), public.current_user_email(),
  public.has_business_role(uuid, text[]), public.my_barber_id(uuid), public.can_manage_barber(uuid, text),
  public.storage_business_id(text), public.can_write_storage_object(text, text[]),
  public.is_admin(), public.is_admin_or_verified_staff(), public.is_verified_staff(), public.is_staff_verified(),
  public.is_verified_barber(text),
  public.create_booking(text, integer, text, date, text, text, text, text, uuid),
  public.reschedule_booking(uuid, date, text), public.update_my_barber_profile(text, text, text, uuid),
  public.acquire_notification_idempotency(text, uuid, text, text)
TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
