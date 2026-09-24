-- Gestión dinámica de administradores (co-propietarios) y cuenta raíz de la plataforma.
--
-- Fuente de verdad: public.staff (has_business_role la usa en todas las RLS). business_members sigue
-- sin uso y no se toca aquí.
--
-- 1. platform_admins: cuentas raíz de la plataforma (desarrollador). Están en staff de TODOS los
--    negocios como titulares, se añaden solas a cada negocio nuevo y ningún usuario del cliente
--    puede degradarlas ni borrarlas.
-- 2. staff.is_owner: titulares del negocio. Solo la plataforma cambia la titularidad y un admin que
--    no es titular no puede retirar el acceso de un titular.
-- 3. Invariante: todo negocio conserva al menos un administrador verificado (cualquier vía).
-- 4. staff_role_events: auditoría de todos los cambios de rol, sea cual sea la vía.
-- 5. RPC set_barber_admin: el interruptor de AdminStaff (valida que quien llama es admin del negocio).
-- 6. RPC platform_grant_business_admin: onboarding de los primeros administradores de un cliente.
-- 7. sync_barber_staff_access: altas antes que bajas y un admin ascendido conserva el rol si cambia
--    el email de Google de su ficha.
--
-- Rollback: supabase/rollback/20260924070000_saas_staff_admin_roles_down.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS backup_20260924_pre_staff_roles;
CREATE TABLE backup_20260924_pre_staff_roles.function_defs AS
SELECT p.oid::regprocedure::text AS signature, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('sync_barber_staff_access');
REVOKE ALL ON SCHEMA backup_20260924_pre_staff_roles FROM PUBLIC, anon, authenticated;

-- 1. Cuentas raíz de la plataforma -------------------------------------------------------------

CREATE TABLE public.platform_admins (
  email text PRIMARY KEY CHECK (email = lower(btrim(email)) AND email LIKE '%@%'),
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM anon, authenticated;

INSERT INTO public.platform_admins (email, full_name)
VALUES ('franciscojavierfarinapadilla@gmail.com', 'Plataforma');

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT public.current_user_email() <> ''
     AND EXISTS (SELECT 1 FROM public.platform_admins p WHERE p.email = public.current_user_email())
$function$;

-- 2. Titularidad ------------------------------------------------------------------------------

ALTER TABLE public.staff
  ADD COLUMN is_owner boolean NOT NULL DEFAULT false;

-- Titulares actuales: las cuentas admin que figuran en la ficha (google_email o admin_emails) del
-- profesional al que están vinculadas.
UPDATE public.staff s
SET is_owner = true
FROM public.barbers b
WHERE s.business_id = b.business_id
  AND s.barber_id = b.id
  AND s.role = 'admin'
  AND lower(s.email) IN (
    SELECT lower(btrim(x)) FROM unnest(coalesce(b.admin_emails, '{}'::text[]) || b.google_email) AS x
    WHERE x IS NOT NULL AND btrim(x) <> ''
  );

ALTER TABLE public.staff
  ADD CONSTRAINT staff_owner_is_admin_check CHECK (NOT is_owner OR role = 'admin');

-- La plataforma es titular en todos los negocios existentes (conserva su vínculo de barbero si lo tenía).
INSERT INTO public.staff (business_id, email, full_name, role, barber_id, status, is_owner)
SELECT b.id, p.email, p.full_name, 'admin', NULL, 'verified', true
FROM public.businesses b CROSS JOIN public.platform_admins p
ON CONFLICT (business_id, email) DO UPDATE
  SET role = 'admin', status = 'verified', is_owner = true;

CREATE OR REPLACE FUNCTION public.add_platform_admins_to_business()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'businesses' THEN
    INSERT INTO public.staff (business_id, email, full_name, role, barber_id, status, is_owner)
    SELECT NEW.id, p.email, p.full_name, 'admin', NULL, 'verified', true
    FROM public.platform_admins p
    ON CONFLICT (business_id, email) DO UPDATE
      SET role = 'admin', status = 'verified', is_owner = true;
  ELSE
    INSERT INTO public.staff (business_id, email, full_name, role, barber_id, status, is_owner)
    SELECT b.id, NEW.email, NEW.full_name, 'admin', NULL, 'verified', true
    FROM public.businesses b
    ON CONFLICT (business_id, email) DO UPDATE
      SET role = 'admin', status = 'verified', is_owner = true;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_platform_admins_to_business() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_add_platform_admins
  AFTER INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.add_platform_admins_to_business();
CREATE TRIGGER trg_add_platform_admin_to_businesses
  AFTER INSERT ON public.platform_admins
  FOR EACH ROW EXECUTE FUNCTION public.add_platform_admins_to_business();

CREATE OR REPLACE FUNCTION public.is_business_owner(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT public.current_user_email() <> ''
     AND EXISTS (
       SELECT 1 FROM public.staff s
       WHERE s.business_id = p_business_id
         AND lower(s.email) = public.current_user_email()
         AND s.status = 'verified'
         AND s.role = 'admin'
         AND s.is_owner
     )
$function$;

-- 3. Invariantes de roles ------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_staff_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_end_user boolean := coalesce(auth.jwt() ->> 'role', '') = 'authenticated';
  v_platform boolean := public.is_platform_admin();
  v_loses_admin boolean;
BEGIN
  IF v_end_user AND NOT v_platform AND (
       (TG_OP = 'INSERT' AND NEW.is_owner)
    OR (TG_OP = 'UPDATE' AND NEW.is_owner IS DISTINCT FROM OLD.is_owner)
  ) THEN
    RAISE EXCEPTION 'La titularidad del negocio solo la puede cambiar la plataforma'
      USING ERRCODE = '42501';
  END IF;

  -- Las cuentas raíz de la plataforma solo las toca la propia plataforma.
  IF TG_OP IN ('UPDATE', 'DELETE') AND v_end_user AND NOT v_platform
     AND EXISTS (SELECT 1 FROM public.platform_admins p WHERE p.email = lower(OLD.email))
     AND (TG_OP = 'DELETE'
          OR NEW.role IS DISTINCT FROM OLD.role
          OR NEW.status IS DISTINCT FROM OLD.status
          OR NEW.is_owner IS DISTINCT FROM OLD.is_owner
          OR NEW.email IS DISTINCT FROM OLD.email) THEN
    RAISE EXCEPTION 'La cuenta de la plataforma no se puede modificar desde el panel del negocio'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.role = 'admin' AND OLD.status = 'verified' THEN
    v_loses_admin := TG_OP = 'DELETE'
      OR NEW.role <> 'admin'
      OR NEW.status <> 'verified'
      OR NEW.email IS DISTINCT FROM OLD.email;

    IF v_loses_admin THEN
      IF OLD.is_owner AND v_end_user AND NOT v_platform AND NOT public.is_business_owner(OLD.business_id) THEN
        RAISE EXCEPTION 'Solo un titular puede retirar el acceso de administración a otro titular'
          USING ERRCODE = '42501';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.business_id = OLD.business_id
          AND s.email <> OLD.email
          AND s.role = 'admin'
          AND s.status = 'verified'
      ) THEN
        RAISE EXCEPTION 'El negocio debe conservar al menos un administrador';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_staff_roles() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_guard_staff_roles
  BEFORE INSERT OR UPDATE OR DELETE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.guard_staff_roles();

-- 4. Auditoría ----------------------------------------------------------------------------------

CREATE TABLE public.staff_role_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
  email text NOT NULL,
  barber_id text,
  old_role text,
  new_role text,
  changed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_role_events_business_created_idx ON public.staff_role_events (business_id, created_at DESC);

ALTER TABLE public.staff_role_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_role_events_admin_read ON public.staff_role_events
  FOR SELECT TO authenticated USING (public.has_business_role(business_id, ARRAY['admin']));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.staff_role_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_staff_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor text := coalesce(nullif(public.current_user_email(), ''), 'system:' || current_user);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.staff_role_events (business_id, email, barber_id, old_role, new_role, changed_by)
    VALUES (NEW.business_id, NEW.email, NEW.barber_id, NULL, NEW.role, v_actor);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.staff_role_events (business_id, email, barber_id, old_role, new_role, changed_by)
    VALUES (OLD.business_id, OLD.email, OLD.barber_id, OLD.role, NULL, v_actor);
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.staff_role_events (business_id, email, barber_id, old_role, new_role, changed_by)
    VALUES (NEW.business_id, NEW.email, NEW.barber_id, OLD.role, NEW.role, v_actor);
  END IF;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.log_staff_role_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_log_staff_role_change
  AFTER INSERT OR UPDATE OF role OR DELETE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.log_staff_role_change();

-- 5. Interruptor de administrador --------------------------------------------------------------

-- Opera sobre la ficha del profesional: su cuenta es barbers.google_email. Al retirar el rol, la
-- cuenta vuelve a ser barbero de SU propia ficha.
CREATE OR REPLACE FUNCTION public.set_barber_admin(p_business_id uuid, p_barber_id text, p_is_admin boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email text;
  v_barber_name text;
  v_row public.staff;
BEGIN
  IF p_business_id IS NULL OR p_barber_id IS NULL OR p_is_admin IS NULL THEN
    RAISE EXCEPTION 'Faltan datos para cambiar el rol';
  END IF;

  IF NOT public.has_business_role(p_business_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Solo un administrador de este negocio puede cambiar los permisos'
      USING ERRCODE = '42501';
  END IF;

  SELECT lower(btrim(b.google_email)), b.name INTO v_email, v_barber_name
  FROM public.barbers b
  WHERE b.business_id = p_business_id AND b.id = p_barber_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El profesional no pertenece a este negocio';
  END IF;
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Vincula primero una cuenta de Google a la ficha de %', v_barber_name;
  END IF;

  SELECT * INTO v_row FROM public.staff
  WHERE business_id = p_business_id AND lower(email) = v_email
  FOR UPDATE;

  IF NOT FOUND THEN
    IF NOT p_is_admin THEN
      RAISE EXCEPTION 'La cuenta de % no tiene acceso al panel', v_barber_name;
    END IF;
    INSERT INTO public.staff (business_id, email, full_name, role, barber_id, status)
    VALUES (p_business_id, v_email, v_barber_name, 'admin', p_barber_id, 'verified')
    RETURNING * INTO v_row;
    RETURN jsonb_build_object('email', v_row.email, 'barber_id', v_row.barber_id, 'role', v_row.role, 'changed', true);
  END IF;

  IF v_row.status <> 'verified' THEN
    RAISE EXCEPTION 'La cuenta de % todavía no está verificada', v_barber_name;
  END IF;

  IF (v_row.role = 'admin') = p_is_admin THEN
    RETURN jsonb_build_object('email', v_row.email, 'barber_id', v_row.barber_id, 'role', v_row.role, 'changed', false);
  END IF;

  IF NOT p_is_admin AND EXISTS (
    SELECT 1 FROM public.barbers b
    WHERE b.business_id = p_business_id
      AND v_email IN (SELECT lower(btrim(x)) FROM unnest(coalesce(b.admin_emails, '{}'::text[])) AS x)
  ) THEN
    RAISE EXCEPTION 'Esta cuenta figura como administradora en la ficha de un profesional: retírala desde esa ficha';
  END IF;

  UPDATE public.staff
  SET role = CASE WHEN p_is_admin THEN 'admin' ELSE 'barber' END,
      barber_id = p_barber_id
  WHERE business_id = p_business_id AND email = v_row.email
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('email', v_row.email, 'barber_id', v_row.barber_id, 'role', v_row.role, 'changed', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_barber_admin(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_barber_admin(uuid, text, boolean) TO authenticated;

-- 6. Onboarding de clientes desde la cuenta de plataforma ---------------------------------------

-- Da acceso de administración (titular por defecto) a una cuenta de Google en un negocio. Al
-- iniciar sesión con esa cuenta, el cliente entra directamente al panel.
CREATE OR REPLACE FUNCTION public.platform_grant_business_admin(
  p_business_id uuid, p_email text, p_full_name text DEFAULT NULL, p_is_owner boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_row public.staff;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Solo la plataforma puede dar de alta administradores de un negocio'
      USING ERRCODE = '42501';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email no válido';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = p_business_id) THEN
    RAISE EXCEPTION 'Negocio inexistente';
  END IF;

  INSERT INTO public.staff (business_id, email, full_name, role, barber_id, status, is_owner)
  VALUES (p_business_id, v_email, nullif(btrim(p_full_name), ''), 'admin', NULL, 'verified', coalesce(p_is_owner, true))
  ON CONFLICT (business_id, email) DO UPDATE
    SET role = 'admin',
        status = 'verified',
        is_owner = coalesce(p_is_owner, true),
        full_name = coalesce(nullif(btrim(p_full_name), ''), staff.full_name)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('business_id', v_row.business_id, 'email', v_row.email,
                            'role', v_row.role, 'is_owner', v_row.is_owner);
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_grant_business_admin(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_grant_business_admin(uuid, text, text, boolean) TO authenticated;

-- 7. Sincronización desde barbers (altas antes que bajas) -----------------------------------------

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
  v_was_admin boolean := false;
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
      SELECT s.role = 'admin' AND NOT s.is_owner INTO v_was_admin
      FROM public.staff s
      WHERE s.business_id = NEW.business_id AND s.email = v_old_email AND s.barber_id = NEW.id;
      v_was_admin := coalesce(v_was_admin, false);
    END IF;
  END IF;

  IF v_new_email IS NOT NULL THEN
    INSERT INTO public.staff (business_id, email, full_name, role, barber_id, status)
    VALUES (NEW.business_id, v_new_email, NEW.name, CASE WHEN v_was_admin THEN 'admin' ELSE 'barber' END, NEW.id, 'verified')
    ON CONFLICT (business_id, email) DO UPDATE
      SET role = CASE WHEN v_was_admin THEN 'admin' ELSE 'barber' END,
          status = 'verified',
          barber_id = NEW.id,
          full_name = NEW.name
      WHERE staff.role = 'barber' AND staff.business_id = EXCLUDED.business_id;
  END IF;

  IF v_old_email IS NOT NULL AND v_old_email IS DISTINCT FROM v_new_email THEN
    DELETE FROM public.staff
    WHERE business_id = NEW.business_id
      AND (email = v_old_email OR (barber_id = NEW.id AND email IS DISTINCT FROM v_new_email))
      AND (role = 'barber' OR (v_was_admin AND email = v_old_email AND NOT is_owner));
  END IF;

  IF v_new_email IS NULL THEN
    DELETE FROM public.staff
    WHERE business_id = NEW.business_id
      AND barber_id = NEW.id
      AND role = 'barber';
  END IF;

  RETURN NEW;
END;
$function$;

-- Pruebas de puerta ---------------------------------------------------------------------------
-- Se simulan sesiones reales fijando request.jwt.claims; cada escenario que escribe se deshace con
-- un error centinela, así que la migración no altera datos más allá del esquema y la titularidad.

DO $gate$
DECLARE
  v_legacy uuid := 'f67af497-5e58-48a2-8bea-022c4f1d7e1a';
  v_platform text := 'franciscojavierfarinapadilla@gmail.com';
  v_owner text;
  v_barber_email text;
  v_barber_id text;
  v_other_email text;
  v_other_id text;
  v_owner_barber text;
  v_new_business uuid;
  v_result jsonb;
  v_msg text;
  v_state text;
BEGIN
  SELECT email, barber_id INTO v_owner, v_owner_barber FROM public.staff
  WHERE business_id = v_legacy AND is_owner AND email <> v_platform ORDER BY email LIMIT 1;
  SELECT s.email, s.barber_id INTO v_barber_email, v_barber_id FROM public.staff s
  JOIN public.barbers b ON b.business_id = s.business_id AND b.id = s.barber_id AND lower(b.google_email) = s.email
  WHERE s.business_id = v_legacy AND s.role = 'barber' AND s.status = 'verified' ORDER BY s.email LIMIT 1;
  SELECT s.email, s.barber_id INTO v_other_email, v_other_id FROM public.staff s
  JOIN public.barbers b ON b.business_id = s.business_id AND b.id = s.barber_id AND lower(b.google_email) = s.email
  WHERE s.business_id = v_legacy AND s.role = 'barber' AND s.status = 'verified' AND s.email <> v_barber_email
  ORDER BY s.email LIMIT 1;

  IF v_owner IS NULL OR v_barber_email IS NULL OR v_other_email IS NULL
     OR EXISTS (
       SELECT 1 FROM public.businesses b
       WHERE NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.business_id = b.id AND s.email = v_platform
                         AND s.role = 'admin' AND s.is_owner AND s.status = 'verified')
     ) THEN
    RAISE EXCEPTION 'gate: la plataforma no es titular en todos los negocios o faltan datos de partida';
  END IF;

  -- a) Un barbero no puede conceder permisos.
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_barber_email)::text, true);
    PERFORM public.set_barber_admin(v_legacy, v_barber_id, true);
    RAISE EXCEPTION 'gate: un barbero se concedió administración';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- b) Un titular asciende y degrada a un barbero; queda auditado.
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_owner)::text, true);
    v_result := public.set_barber_admin(v_legacy, v_barber_id, true);
    IF v_result ->> 'role' <> 'admin' THEN RAISE EXCEPTION 'gate: el ascenso no se aplicó: %', v_result; END IF;
    v_result := public.set_barber_admin(v_legacy, v_barber_id, false);
    IF v_result ->> 'role' <> 'barber' OR v_result ->> 'barber_id' <> v_barber_id THEN
      RAISE EXCEPTION 'gate: la degradación no se aplicó: %', v_result;
    END IF;
    IF (SELECT count(*) FROM public.staff_role_events
        WHERE business_id = v_legacy AND email = v_barber_email AND changed_by = v_owner) <> 2 THEN
      RAISE EXCEPTION 'gate: los cambios de rol no quedaron auditados';
    END IF;
    RAISE EXCEPTION 'gate_rollback_ok';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg <> 'gate_rollback_ok' THEN RAISE EXCEPTION '%', v_msg; END IF;
  END;

  -- c) Un admin ascendido (no titular) no puede tocar titulares ni la cuenta de la plataforma.
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_owner)::text, true);
    PERFORM public.set_barber_admin(v_legacy, v_barber_id, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_barber_email)::text, true);

    BEGIN
      UPDATE public.staff SET role = 'barber' WHERE business_id = v_legacy AND email = v_owner;
      RAISE EXCEPTION 'gate: un admin degradó a un titular';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      UPDATE public.staff SET is_owner = true WHERE business_id = v_legacy AND email = v_barber_email;
      RAISE EXCEPTION 'gate: un admin se nombró titular';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      DELETE FROM public.staff WHERE business_id = v_legacy AND email = v_platform;
      RAISE EXCEPTION 'gate: un admin borró la cuenta de la plataforma';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      PERFORM public.platform_grant_business_admin(v_legacy, 'intruso@example.com');
      RAISE EXCEPTION 'gate: un admin de negocio usó el onboarding de plataforma';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RAISE EXCEPTION 'gate_rollback_ok';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg <> 'gate_rollback_ok' THEN RAISE EXCEPTION '%', v_msg; END IF;
  END;

  -- d) Un titular tampoco puede degradar ni borrar la cuenta de la plataforma.
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_owner)::text, true);
    UPDATE public.staff SET role = 'barber', is_owner = false WHERE business_id = v_legacy AND email = v_platform;
    RAISE EXCEPTION 'gate: un titular degradó a la plataforma';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- e) Nunca queda un negocio sin administradores.
  BEGIN
    PERFORM set_config('request.jwt.claims', '', true);
    DELETE FROM public.staff WHERE business_id = v_legacy AND role = 'admin';
    RAISE EXCEPTION 'gate: se borraron todos los administradores';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg <> 'El negocio debe conservar al menos un administrador' THEN RAISE EXCEPTION '%', v_msg; END IF;
  END;

  -- f) Un admin ascendido conserva el rol si cambia el email de Google de su ficha.
  BEGIN
    PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_owner)::text, true);
    PERFORM public.set_barber_admin(v_legacy, v_other_id, true);
    PERFORM set_config('request.jwt.claims', '', true);
    UPDATE public.barbers SET google_email = 'gate.' || v_other_email WHERE business_id = v_legacy AND id = v_other_id;
    SELECT string_agg(email || ':' || role, ',' ORDER BY email) INTO v_state
    FROM public.staff WHERE business_id = v_legacy AND barber_id = v_other_id;
    IF v_state <> 'gate.' || v_other_email || ':admin' THEN
      RAISE EXCEPTION 'gate: el cambio de email no conservó el rol: %', v_state;
    END IF;
    RAISE EXCEPTION 'gate_rollback_ok';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg <> 'gate_rollback_ok' THEN RAISE EXCEPTION '%', v_msg; END IF;
  END;

  -- g) Un negocio nuevo nace con la plataforma como titular, que puede dar de alta a su cliente.
  BEGIN
    PERFORM set_config('request.jwt.claims', '', true);
    INSERT INTO public.businesses (slug, name) VALUES ('gate-onboarding', 'Gate Onboarding') RETURNING id INTO v_new_business;
    IF NOT EXISTS (SELECT 1 FROM public.staff WHERE business_id = v_new_business AND email = v_platform
                   AND role = 'admin' AND is_owner AND status = 'verified') THEN
      RAISE EXCEPTION 'gate: el negocio nuevo no incluye a la plataforma';
    END IF;
    PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'email', v_platform)::text, true);
    v_result := public.platform_grant_business_admin(v_new_business, 'Cliente.Gate@Example.com', 'Cliente Gate');
    IF v_result ->> 'email' <> 'cliente.gate@example.com' OR NOT (v_result ->> 'is_owner')::boolean THEN
      RAISE EXCEPTION 'gate: el onboarding no creó al titular: %', v_result;
    END IF;
    RAISE EXCEPTION 'gate_rollback_ok';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg <> 'gate_rollback_ok' THEN RAISE EXCEPTION '%', v_msg; END IF;
  END;

  -- h) Guardar la ficha del titular sin cambios no altera los administradores.
  PERFORM set_config('request.jwt.claims', '', true);
  v_state := (SELECT string_agg(email || ':' || role || ':' || is_owner, ',' ORDER BY email)
              FROM public.staff WHERE business_id = v_legacy);
  UPDATE public.barbers SET name = name WHERE business_id = v_legacy AND id = v_owner_barber;
  IF v_state <> (SELECT string_agg(email || ':' || role || ':' || is_owner, ',' ORDER BY email)
                 FROM public.staff WHERE business_id = v_legacy) THEN
    RAISE EXCEPTION 'gate: la sincronización alteró el personal';
  END IF;
END;
$gate$;

-- La propia migración no deja eventos de auditoría de las pruebas ni del alta inicial.
DELETE FROM public.staff_role_events;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260924070000', 'saas_staff_admin_roles');

COMMIT;
