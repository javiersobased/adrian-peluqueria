-- ============================================================================
-- MIGRACIÓN: PRIVILEGIOS DE ADMINISTRADOR DE ADRIÁN Y GESTIÓN MULTI-CUENTA (HASTA 5)
-- Proyecto: ghukyltijkgdbaewhmcm (Peluquería Adrián Millán)
-- ============================================================================

-- 1. Añadir columna admin_emails a la tabla barbers para guardar las hasta 5 cuentas
ALTER TABLE public.barbers
ADD COLUMN IF NOT EXISTS admin_emails text[] DEFAULT '{}';

-- 2. Asegurar que las cuentas maestras de Adrián estén configuradas en su perfil
UPDATE public.barbers
SET admin_emails = ARRAY[
      'adrian.millan.peguero@hotmail.com',
      'adrianmillanpeguero1994@hotmail.com'
    ],
    google_email = 'adrian.millan.peguero@hotmail.com'
WHERE id = 'adrian';

-- 3. Registrar y verificar todas las cuentas de administrador en staff
INSERT INTO public.staff (email, full_name, role, status, barber_id)
VALUES
  ('adrian.millan.peguero@hotmail.com', 'Adrián Millán', 'admin', 'verified', 'adrian'),
  ('adrianmillanpeguero1994@hotmail.com', 'Adrián Millán', 'admin', 'verified', 'adrian'),
  ('franciscojavierfarinapadilla@gmail.com', 'Francisco Javier', 'admin', 'verified', 'adrian')
ON CONFLICT (email) DO UPDATE
SET role = 'admin', status = 'verified', barber_id = 'adrian';

-- 4. Protección estricta a nivel de base de datos: el perfil de Adrián NUNCA puede ser eliminado
CREATE OR REPLACE FUNCTION public.prevent_delete_adrian()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.id = 'adrian' OR lower(trim(OLD.name)) IN ('adrian', 'adrián') THEN
    RAISE EXCEPTION 'El perfil principal de Adrián está protegido y no se puede eliminar';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_adrian ON public.barbers;
CREATE TRIGGER trg_prevent_delete_adrian
BEFORE DELETE ON public.barbers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_delete_adrian();

-- 5. Trigger sincronizado de accesos de personal y administrador
CREATE OR REPLACE FUNCTION public.sync_barber_staff_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_email text;
  v_new_email text;
  v_email_item text;
  v_all_new_admin_emails text[] := ARRAY[]::text[];
  v_all_old_admin_emails text[] := ARRAY[]::text[];
  v_protected_emails text[] := ARRAY[
    'franciscojavierfarinapadilla@gmail.com'
  ];
BEGIN
  -- A. SI SE TRATA DEL PERFIL DE ADRIÁN (ADMINISTRADOR)
  IF (TG_OP = 'UPDATE' AND NEW.id = 'adrian') OR (TG_OP = 'INSERT' AND NEW.id = 'adrian') THEN
    -- Recolectar nuevos correos de admin
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

    -- Recolectar antiguos correos si es update para revocar los eliminados
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

      -- Revocar los eliminados
      FOREACH v_email_item IN ARRAY v_all_old_admin_emails LOOP
        IF NOT (v_email_item = ANY(v_all_new_admin_emails)) AND NOT (v_email_item = ANY(v_protected_emails)) THEN
          DELETE FROM public.staff WHERE email = v_email_item AND barber_id = 'adrian';
        END IF;
      END LOOP;
    END IF;

    -- Otorgar rol 'admin' a todos los correos actuales configurados
    FOREACH v_email_item IN ARRAY v_all_new_admin_emails LOOP
      INSERT INTO public.staff (email, full_name, role, barber_id, status)
      VALUES (v_email_item, NEW.name, 'admin', 'adrian', 'verified')
      ON CONFLICT (email) DO UPDATE
        SET role = 'admin',
            status = 'verified',
            barber_id = 'adrian',
            full_name = NEW.name;
    END LOOP;

    RETURN NEW;
  END IF;

  -- B. SI SE TRATA DE UN BARBERO REGULAR
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.staff 
    WHERE barber_id = OLD.id 
      AND role = 'barber'
      AND email != ALL(v_protected_emails);
    RETURN OLD;
  END IF;

  v_new_email := NULLIF(lower(trim(NEW.google_email)), '');

  IF TG_OP = 'UPDATE' THEN
    v_old_email := NULLIF(lower(trim(OLD.google_email)), '');
    IF v_old_email IS NOT NULL AND v_old_email IS DISTINCT FROM v_new_email THEN
      DELETE FROM public.staff 
      WHERE (email = v_old_email OR barber_id = NEW.id)
        AND role = 'barber'
        AND email != ALL(v_protected_emails);
    END IF;
  END IF;

  IF v_new_email IS NOT NULL THEN
    INSERT INTO public.staff (email, full_name, role, barber_id, status)
    VALUES (v_new_email, NEW.name, 'barber', NEW.id, 'verified')
    ON CONFLICT (email) DO UPDATE
      SET role = 'barber',
          status = 'verified',
          barber_id = NEW.id,
          full_name = NEW.name
      WHERE staff.role = 'barber';
  ELSE
    DELETE FROM public.staff 
    WHERE barber_id = NEW.id 
      AND role = 'barber'
      AND email != ALL(v_protected_emails);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_barber_staff_access ON public.barbers;
CREATE TRIGGER trg_sync_barber_staff_access
AFTER INSERT OR UPDATE OR DELETE ON public.barbers
FOR EACH ROW EXECUTE FUNCTION public.sync_barber_staff_access();

-- 6. Actualizar is_admin() para abarcar correos maestros, staff verificado y cuentas de Adrián
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF v_email = '' THEN
    RETURN false;
  END IF;
  
  -- Correos maestros incondicionales
  IF v_email IN (
    'adrian.millan.peguero@hotmail.com',
    'adrianmillanpeguero1994@hotmail.com',
    'franciscojavierfarinapadilla@gmail.com'
  ) THEN
    RETURN true;
  END IF;
  
  -- Verificar en staff (rol admin y verificado)
  IF EXISTS (
    SELECT 1 FROM public.staff
    WHERE lower(email) = v_email
      AND role = 'admin'
      AND status = 'verified'
  ) THEN
    RETURN true;
  END IF;

  -- Verificar en cuentas configuradas en el perfil de Adrián
  IF EXISTS (
    SELECT 1 FROM public.barbers
    WHERE id = 'adrian'
      AND (
        lower(google_email) = v_email
        OR v_email = ANY(admin_emails)
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 7. Actualizar is_admin_or_verified_staff()
CREATE OR REPLACE FUNCTION public.is_admin_or_verified_staff()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF v_email = '' THEN
    RETURN false;
  END IF;
  
  IF public.is_admin() THEN
    RETURN true;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.staff
    WHERE lower(email) = v_email
      AND status = 'verified'
  );
END;
$$;

-- 8. Actualizar get_my_role()
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_row record;
  v_barber record;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF v_email = '' THEN
    RETURN jsonb_build_object('role', null, 'status', null, 'barber_id', null, 'email', null);
  END IF;

  -- A. Administradores maestros
  IF v_email IN (
    'adrian.millan.peguero@hotmail.com',
    'adrianmillanpeguero1994@hotmail.com',
    'franciscojavierfarinapadilla@gmail.com'
  ) THEN
    RETURN jsonb_build_object(
      'role', 'admin',
      'status', 'verified',
      'barber_id', 'adrian',
      'email', v_email
    );
  END IF;

  -- B. Verificar si está configurado como admin en el perfil de Adrián
  IF EXISTS (
    SELECT 1 FROM public.barbers
    WHERE id = 'adrian'
      AND (
        lower(google_email) = v_email
        OR v_email = ANY(admin_emails)
      )
  ) THEN
    RETURN jsonb_build_object(
      'role', 'admin',
      'status', 'verified',
      'barber_id', 'adrian',
      'email', v_email
    );
  END IF;

  -- C. Verificar tabla staff
  SELECT role, status, barber_id, email INTO v_row
  FROM public.staff
  WHERE lower(email) = v_email
  LIMIT 1;

  IF FOUND AND v_row.status = 'verified' THEN
    RETURN jsonb_build_object(
      'role', v_row.role,
      'status', v_row.status,
      'barber_id', CASE WHEN v_row.role = 'admin' THEN COALESCE(v_row.barber_id, 'adrian') ELSE v_row.barber_id END,
      'email', v_row.email
    );
  END IF;

  -- D. Verificar barberos regulares activos
  SELECT id, name, google_email INTO v_barber
  FROM public.barbers
  WHERE lower(trim(google_email)) = v_email AND active = true AND id != 'adrian'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'role', 'barber',
      'status', 'verified',
      'barber_id', v_barber.id,
      'email', v_email
    );
  END IF;

  RETURN jsonb_build_object('role', null, 'status', null, 'barber_id', null, 'email', null);
END;
$$;
