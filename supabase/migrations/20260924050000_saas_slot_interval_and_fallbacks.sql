-- Paso 8: intervalo de reserva configurable por negocio y retirada de los fallbacks al tenant heredado.
--
-- 1. businesses.slot_interval_minutes (10 por defecto) y validación en servidor de que la hora
--    de una reserva cae en la rejilla del turno del profesional (el personal queda exento).
-- 2. Las validaciones de fecha/hora usan la zona horaria del negocio en lugar de Europe/Madrid.
-- 3. Las RPC ya no caen en legacy_business_id() cuando falta p_business_id.
-- 4. Se eliminan los envoltorios sin negocio (is_admin(), get_my_role(), ...).
-- 5. La protección de borrado y la sincronización de administradores dejan de depender del
--    id 'adrian' y de correos fijos.
--
-- Pendiente con motivo: can_write_storage_object mantiene los objetos en la raíz de los buckets
-- (ficheros anteriores al SaaS, todos del tenant heredado) y get_business_integration mantiene
-- is_legacy mientras las claves de Resend/OneSignal del tenant heredado sigan en variables de entorno.
--
-- Rollback: supabase/rollback/20260924050000_saas_slot_interval_and_fallbacks_down.sql

BEGIN;

-- Copia de las definiciones actuales para el rollback.
CREATE SCHEMA IF NOT EXISTS backup_20260924_pre_step8;
CREATE TABLE backup_20260924_pre_step8.function_defs AS
SELECT p.oid::regprocedure::text AS signature, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN (
    'resolve_business_by_host', 'validate_booking_anti_spam_and_duplicates', 'create_booking',
    'get_booked_slots', 'get_booked_intervals', 'update_my_barber_profile',
    'acquire_notification_idempotency', 'sync_barber_staff_access', 'prevent_delete_adrian',
    'is_admin', 'get_my_role', 'is_staff_verified', 'is_verified_staff',
    'is_admin_or_verified_staff', 'is_verified_barber'
  );
REVOKE ALL ON SCHEMA backup_20260924_pre_step8 FROM PUBLIC, anon, authenticated;

-- 1. Intervalo por negocio -----------------------------------------------------------------

ALTER TABLE public.businesses
  ADD COLUMN slot_interval_minutes smallint NOT NULL DEFAULT 10
  CONSTRAINT businesses_slot_interval_check CHECK (slot_interval_minutes IN (5, 10, 15, 20, 30, 60));

-- La rejilla parte del inicio del turno (como generateSlotsForShift en el frontend).
CREATE OR REPLACE FUNCTION public.booking_time_on_grid(
  p_business_id uuid, p_barber text, p_date date, p_time text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_interval integer;
  v_minutes integer;
  v_morning integer;
  v_afternoon integer;
  v_start integer;
  v_schedule record;
BEGIN
  IF p_time IS NULL OR p_time !~ '^\d{1,2}:\d{2}$' THEN
    RETURN false;
  END IF;

  SELECT b.slot_interval_minutes INTO v_interval FROM public.businesses b WHERE b.id = p_business_id;
  IF v_interval IS NULL THEN
    RETURN false;
  END IF;

  v_minutes := split_part(p_time, ':', 1)::integer * 60 + split_part(p_time, ':', 2)::integer;

  SELECT s.morning_start, s.afternoon_start INTO v_schedule
  FROM public.barber_schedules s
  WHERE s.business_id = p_business_id
    AND s.barber_id = p_barber
    AND s.weekday = extract(dow FROM p_date)::integer
  LIMIT 1;

  v_morning := CASE WHEN coalesce(v_schedule.morning_start, '09:30') ~ '^\d{1,2}:\d{2}$'
    THEN split_part(coalesce(v_schedule.morning_start, '09:30'), ':', 1)::integer * 60
       + split_part(coalesce(v_schedule.morning_start, '09:30'), ':', 2)::integer END;
  v_afternoon := CASE WHEN coalesce(v_schedule.afternoon_start, '16:30') ~ '^\d{1,2}:\d{2}$'
    THEN split_part(coalesce(v_schedule.afternoon_start, '16:30'), ':', 1)::integer * 60
       + split_part(coalesce(v_schedule.afternoon_start, '16:30'), ':', 2)::integer END;

  v_start := CASE WHEN v_afternoon IS NOT NULL AND v_minutes >= v_afternoon THEN v_afternoon ELSE v_morning END;
  IF v_start IS NULL OR v_minutes < v_start THEN
    RETURN false;
  END IF;

  RETURN (v_minutes - v_start) % v_interval = 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.booking_time_on_grid(uuid, text, date, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_business_by_host(p_hostname text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH h AS (
    SELECT regexp_replace(regexp_replace(lower(btrim(coalesce(p_hostname, ''))), ':[0-9]+$', ''), '\.$', '') AS host
  )
  SELECT jsonb_build_object(
    'id', b.id,
    'slug', b.slug,
    'name', b.name,
    'timezone', b.timezone,
    'locale', b.locale,
    'currency', b.currency,
    'layout_key', b.layout_key,
    'slot_interval_minutes', b.slot_interval_minutes,
    'theme', b.theme,
    'public_config', b.public_config,
    'contact', b.contact,
    'hostname', d.hostname,
    'is_primary_domain', d.is_primary
  )
  FROM h
  JOIN public.business_domains d ON d.hostname = h.host
  JOIN public.businesses b ON b.id = d.business_id
  WHERE length(h.host) BETWEEN 1 AND 253
    AND d.status = 'active'
    AND d.verified_at IS NOT NULL
    AND b.status = 'active'
$function$;

-- 2. Validación de reservas con zona horaria e intervalo del negocio -------------------------

CREATE OR REPLACE FUNCTION public.validate_booking_anti_spam_and_duplicates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_is_staff boolean := false;
  v_clean_phone text;
  v_digits text;
  v_active_count integer := 0;
  v_daily_count integer := 0;
  v_timezone text;
  v_interval integer;
  v_local_now timestamp;
  v_local_date date;
  v_local_time time;
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

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.business_id::text || '|' || NEW.barber || '|' || NEW.booking_date::text, 0));

  SELECT b.timezone, b.slot_interval_minutes INTO v_timezone, v_interval
  FROM public.businesses b WHERE b.id = NEW.business_id;

  v_local_now := (now() AT TIME ZONE coalesce(v_timezone, 'UTC'));
  v_local_date := v_local_now::date;
  v_local_time := v_local_now::time;

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
    IF (TG_OP = 'INSERT'
        OR NEW.booking_time IS DISTINCT FROM OLD.booking_time
        OR NEW.booking_date IS DISTINCT FROM OLD.booking_date
        OR NEW.barber IS DISTINCT FROM OLD.barber)
       AND NOT public.booking_time_on_grid(NEW.business_id, NEW.barber, NEW.booking_date, NEW.booking_time) THEN
      RAISE EXCEPTION 'La hora seleccionada (%) no está disponible: las citas se reservan cada % minutos.', NEW.booking_time, v_interval;
    END IF;

    IF NEW.booking_date < v_local_date THEN
      RAISE EXCEPTION 'No es posible reservar citas en fechas pasadas.';
    END IF;

    IF NEW.booking_date = v_local_date THEN
      BEGIN
        v_booking_slot_time := (NEW.booking_time || ':00')::time;
        IF v_booking_slot_time < (v_local_time - interval '5 minutes') THEN
          RAISE EXCEPTION 'La hora seleccionada (%) ya ha pasado hoy.', NEW.booking_time;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    IF NEW.booking_date > (v_local_date + 60) THEN
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
      AND booking_date >= v_local_date
      AND (TG_OP = 'INSERT' OR id != NEW.id);

    IF v_active_count >= 4 THEN
      RAISE EXCEPTION 'Ya tienes 4 citas activas reservadas. Si necesitas citas adicionales, contacta directamente con el negocio.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. RPC sin fallback al tenant heredado ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_booking(
  p_service text, p_service_price integer, p_barber text, p_booking_date date, p_booking_time text,
  p_full_name text, p_phone text, p_comments text DEFAULT ''::text, p_business_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_business_id uuid := p_business_id;
  v_full_name text := trim(p_full_name);
  v_phone text := trim(p_phone);
  v_clean_phone text;
  v_digits text;
  v_comments text := trim(coalesce(p_comments, ''));
  v_row public.bookings;
  v_recent_count integer;
  v_local_date date;
BEGIN
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Falta el negocio de la reserva';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para reservar una cita';
  END IF;

  IF NOT public.is_business_public(v_business_id) THEN
    RAISE EXCEPTION 'Este negocio no admite reservas en este momento';
  END IF;

  SELECT (now() AT TIME ZONE b.timezone)::date INTO v_local_date
  FROM public.businesses b WHERE b.id = v_business_id;

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
    AND booking_date >= v_local_date;

  IF v_recent_count >= 3 THEN
    RAISE EXCEPTION 'Ya tienes 3 citas activas reservadas. Si necesitas otra, contacta directamente con el negocio.';
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
  ON CONFLICT (business_id, user_id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      comments = EXCLUDED.comments,
      updated_at = now()
  WHERE customers.business_id = EXCLUDED.business_id;

  RETURN to_jsonb(v_row);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_booked_slots(p_barber text, p_date date, p_business_id uuid DEFAULT NULL::uuid)
RETURNS SETOF text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT b.booking_time FROM public.bookings b
  WHERE b.business_id = p_business_id
    AND public.is_business_public(b.business_id)
    AND b.barber = p_barber
    AND b.booking_date = p_date
    AND b.status <> 'cancelled'
$function$;

CREATE OR REPLACE FUNCTION public.get_booked_intervals(p_barber text, p_date date, p_business_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
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
  FROM public.bookings b
  LEFT JOIN LATERAL (
    SELECT sv.duration_minutes FROM public.services sv
    WHERE sv.business_id = b.business_id AND (sv.name = b.service OR sv.id::text = b.service)
    LIMIT 1
  ) s ON true
  WHERE b.business_id = p_business_id
    AND public.is_business_public(p_business_id)
    AND b.barber = p_barber
    AND b.booking_date = p_date
    AND b.status <> 'cancelled'
$function$;

CREATE OR REPLACE FUNCTION public.update_my_barber_profile(
  p_barber_id text, p_name text DEFAULT NULL::text, p_photo_url text DEFAULT NULL::text, p_business_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email text := public.current_user_email();
  v_business_id uuid := p_business_id;
  v_matched_id text;
  v_initials text;
BEGIN
  IF v_email = '' THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'Falta el negocio del perfil';
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
$function$;

CREATE OR REPLACE FUNCTION public.acquire_notification_idempotency(
  p_key text, p_booking_id uuid DEFAULT NULL::uuid, p_type text DEFAULT 'email'::text,
  p_recipient text DEFAULT ''::text, p_business_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_business_id uuid;
BEGIN
  IF p_key IS NULL OR trim(p_key) = '' THEN
    RETURN true;
  END IF;

  IF p_booking_id IS NOT NULL THEN
    SELECT b.business_id INTO v_business_id FROM public.bookings b WHERE b.id = p_booking_id;
    IF v_business_id IS NULL THEN
      RAISE EXCEPTION 'Reserva % inexistente', p_booking_id;
    END IF;
    IF p_business_id IS NOT NULL AND p_business_id <> v_business_id THEN
      RAISE EXCEPTION 'La reserva no pertenece al negocio indicado';
    END IF;
  ELSE
    v_business_id := p_business_id;
    IF v_business_id IS NULL THEN
      RAISE EXCEPTION 'Falta el negocio de la notificación';
    END IF;
  END IF;

  INSERT INTO public.notification_idempotency (
    business_id, idempotency_key, booking_id, notification_type, recipient, status
  ) VALUES (
    v_business_id, trim(p_key), p_booking_id, coalesce(p_type, 'email'), trim(coalesce(p_recipient, '')), 'sent'
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN FOUND;
END;
$function$;

-- 4. Envoltorios sin negocio (ningún cliente ni política los usa ya) -------------------------

DROP FUNCTION public.is_admin();
DROP FUNCTION public.get_my_role();
DROP FUNCTION public.is_staff_verified();
DROP FUNCTION public.is_verified_staff();
DROP FUNCTION public.is_admin_or_verified_staff();
DROP FUNCTION public.is_verified_barber(text);

-- 5. Protección y sincronización de administradores genéricas ------------------------------

-- Un perfil con administradores vinculados (staff admin con su barber_id) no se puede borrar.
CREATE OR REPLACE FUNCTION public.prevent_delete_owner_barber()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.business_id = OLD.business_id AND s.barber_id = OLD.id AND s.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'El perfil % está vinculado a la administración del negocio y no se puede eliminar', OLD.name;
  END IF;
  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_delete_owner_barber() FROM PUBLIC, anon, authenticated;

DROP TRIGGER trg_prevent_delete_adrian ON public.barbers;
DROP FUNCTION public.prevent_delete_adrian();
CREATE TRIGGER trg_prevent_delete_owner_barber
  BEFORE DELETE ON public.barbers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_owner_barber();

-- Los perfiles con admin_emails sincronizan administradores; el resto, su acceso de barbero.
CREATE OR REPLACE FUNCTION public.sync_barber_staff_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_old_email text;
  v_new_email text;
  v_email_item text;
  v_all_new_admin_emails text[] := ARRAY[]::text[];
  v_all_old_admin_emails text[] := ARRAY[]::text[];
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE')
     AND (coalesce(cardinality(NEW.admin_emails), 0) > 0
          OR (TG_OP = 'UPDATE' AND coalesce(cardinality(OLD.admin_emails), 0) > 0)) THEN
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
        IF NOT (v_email_item = ANY(v_all_new_admin_emails)) THEN
          DELETE FROM public.staff
          WHERE email = v_email_item AND barber_id = NEW.id AND business_id = NEW.business_id;
        END IF;
      END LOOP;
    END IF;

    FOREACH v_email_item IN ARRAY v_all_new_admin_emails LOOP
      INSERT INTO public.staff (business_id, email, full_name, role, barber_id, status)
      VALUES (NEW.business_id, v_email_item, NEW.name, 'admin', NEW.id, 'verified')
      ON CONFLICT (business_id, email) DO UPDATE
        SET role = 'admin',
            status = 'verified',
            barber_id = NEW.id,
            full_name = NEW.name
        WHERE staff.business_id = EXCLUDED.business_id;
    END LOOP;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.staff
    WHERE business_id = OLD.business_id
      AND barber_id = OLD.id
      AND role = 'barber';
    RETURN OLD;
  END IF;

  v_new_email := NULLIF(lower(trim(NEW.google_email)), '');

  IF TG_OP = 'UPDATE' THEN
    v_old_email := NULLIF(lower(trim(OLD.google_email)), '');
    IF v_old_email IS NOT NULL AND v_old_email IS DISTINCT FROM v_new_email THEN
      DELETE FROM public.staff
      WHERE business_id = NEW.business_id
        AND (email = v_old_email OR barber_id = NEW.id)
        AND role = 'barber';
    END IF;
  END IF;

  IF v_new_email IS NOT NULL THEN
    INSERT INTO public.staff (business_id, email, full_name, role, barber_id, status)
    VALUES (NEW.business_id, v_new_email, NEW.name, 'barber', NEW.id, 'verified')
    ON CONFLICT (business_id, email) DO UPDATE
      SET role = 'barber',
          status = 'verified',
          barber_id = NEW.id,
          full_name = NEW.name
      WHERE staff.role = 'barber' AND staff.business_id = EXCLUDED.business_id;
  ELSE
    DELETE FROM public.staff
    WHERE business_id = NEW.business_id
      AND barber_id = NEW.id
      AND role = 'barber';
  END IF;

  RETURN NEW;
END;
$function$;

-- Pruebas de puerta: cualquier fallo aborta la transacción completa ---------------------------

DO $gate$
DECLARE
  v_legacy uuid := 'f67af497-5e58-48a2-8bea-022c4f1d7e1a';
  v_monday date := current_date + ((8 - extract(dow FROM current_date)::integer) % 7) + 7;
  v_msg text;
BEGIN
  IF (SELECT slot_interval_minutes FROM public.businesses WHERE id = v_legacy) <> 10 THEN
    RAISE EXCEPTION 'gate: el intervalo heredado no es 10';
  END IF;
  IF (public.resolve_business_by_host('www.adrianmillan.es') ->> 'slot_interval_minutes') <> '10' THEN
    RAISE EXCEPTION 'gate: resolve_business_by_host no expone el intervalo';
  END IF;

  IF NOT public.booking_time_on_grid(v_legacy, 'adrian', v_monday, '09:30')
     OR NOT public.booking_time_on_grid(v_legacy, 'adrian', v_monday, '10:10')
     OR NOT public.booking_time_on_grid(v_legacy, 'adrian', v_monday, '16:40')
     OR public.booking_time_on_grid(v_legacy, 'adrian', v_monday, '10:05')
     OR public.booking_time_on_grid(v_legacy, 'adrian', v_monday, '09:00')
     OR public.booking_time_on_grid(v_legacy, 'adrian', v_monday, 'x')
     OR public.booking_time_on_grid(gen_random_uuid(), 'adrian', v_monday, '10:10') THEN
    RAISE EXCEPTION 'gate: booking_time_on_grid no respeta la rejilla de 10 minutos';
  END IF;

  -- Con intervalo 20 la rejilla sigue al turno (09:30, 09:50...) y no a la medianoche.
  UPDATE public.businesses SET slot_interval_minutes = 20 WHERE id = v_legacy;
  IF NOT public.booking_time_on_grid(v_legacy, 'adrian', v_monday, '09:50')
     OR public.booking_time_on_grid(v_legacy, 'adrian', v_monday, '10:00') THEN
    RAISE EXCEPTION 'gate: la rejilla de 20 minutos no parte del inicio del turno';
  END IF;
  UPDATE public.businesses SET slot_interval_minutes = 10 WHERE id = v_legacy;

  BEGIN
    UPDATE public.businesses SET slot_interval_minutes = 7 WHERE id = v_legacy;
    RAISE EXCEPTION 'gate: se aceptó un intervalo no permitido';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Un cliente no puede reservar fuera de la rejilla (el trigger BEFORE lo rechaza).
  BEGIN
    INSERT INTO public.bookings (business_id, service, service_price, barber, booking_date, booking_time, full_name, phone, status)
    VALUES (v_legacy, 'gate', 0, 'adrian', v_monday, '10:05', 'Gate Test', '612345678', 'pending');
    RAISE EXCEPTION 'gate: se aceptó una reserva fuera de la rejilla';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg NOT LIKE 'La hora seleccionada (10:05) no está disponible%' THEN
      RAISE EXCEPTION 'gate: error inesperado al reservar fuera de rejilla: %', v_msg;
    END IF;
  END;

  -- Sin negocio, las RPC ya no caen en el tenant heredado.
  IF EXISTS (SELECT 1 FROM public.get_booked_slots('adrian', v_monday, NULL)) THEN
    RAISE EXCEPTION 'gate: get_booked_slots sin negocio devolvió datos';
  END IF;
  IF public.get_booked_intervals('adrian', v_monday, NULL) <> '[]'::jsonb THEN
    RAISE EXCEPTION 'gate: get_booked_intervals sin negocio devolvió datos';
  END IF;
  BEGIN
    PERFORM public.create_booking('s', 0, 'adrian', v_monday, '10:10', 'Gate', '612345678', '', NULL);
    RAISE EXCEPTION 'gate: create_booking aceptó una reserva sin negocio';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg <> 'Falta el negocio de la reserva' THEN
      RAISE EXCEPTION 'gate: error inesperado en create_booking: %', v_msg;
    END IF;
  END;
  BEGIN
    PERFORM public.acquire_notification_idempotency('gate-key', NULL, 'email', '', NULL);
    RAISE EXCEPTION 'gate: idempotencia aceptada sin negocio';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg <> 'Falta el negocio de la notificación' THEN
      RAISE EXCEPTION 'gate: error inesperado en idempotencia: %', v_msg;
    END IF;
  END;

  IF to_regprocedure('public.is_admin()') IS NOT NULL
     OR to_regprocedure('public.get_my_role()') IS NOT NULL
     OR to_regprocedure('public.is_verified_barber(text)') IS NOT NULL
     OR to_regprocedure('public.get_my_role(uuid)') IS NULL THEN
    RAISE EXCEPTION 'gate: envoltorios heredados en estado inesperado';
  END IF;

  -- El perfil del titular sigue protegido, ahora por sus administradores vinculados.
  BEGIN
    DELETE FROM public.barbers WHERE business_id = v_legacy AND id = 'adrian';
    RAISE EXCEPTION 'gate: se permitió borrar el perfil del titular';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg NOT LIKE '%vinculado a la administración%' THEN
      RAISE EXCEPTION 'gate: error inesperado al borrar el titular: %', v_msg;
    END IF;
  END;

  -- Un UPDATE sin cambios del titular conserva exactamente los administradores actuales.
  UPDATE public.barbers SET name = name WHERE business_id = v_legacy AND id = 'adrian';
  IF (SELECT count(*) FROM public.staff WHERE business_id = v_legacy AND role = 'admin') <> 3 THEN
    RAISE EXCEPTION 'gate: la sincronización alteró los administradores';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname NOT IN ('legacy_business_id', 'can_write_storage_object', 'get_business_integration')
      AND pg_get_functiondef(p.oid) ~* '(legacy_business_id|''adrian''|@gmail|@hotmail)'
  ) THEN
    RAISE EXCEPTION 'gate: quedan funciones con referencias al tenant heredado';
  END IF;
END;
$gate$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260924050000', 'saas_slot_interval_and_fallbacks');

COMMIT;
