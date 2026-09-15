-- 1. Ensure master admins are permanently in staff table with verified admin status
INSERT INTO staff (email, full_name, role, status)
VALUES
  ('franciscojavierfarinapadilla@gmail.com', 'Francisco Javier', 'admin', 'verified'),
  ('adrian.millan.peguero@hotmail.com', 'Adrián Millán', 'admin', 'verified')
ON CONFLICT (email) DO UPDATE
SET role = 'admin', status = 'verified';

-- 2. Delete known rogue/orphan accounts
DELETE FROM staff WHERE lower(trim(email)) IN (
  'javierjunior1917@gmail.com',
  'adrian@barberiaadrianmillan.es'
);

-- 3. Delete any staff entry that is NOT a master admin AND NOT an active barber's google_email
DELETE FROM staff
WHERE lower(trim(email)) NOT IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com')
  AND (barber_id IS NULL OR barber_id NOT IN (SELECT id FROM barbers WHERE active = true));

-- 4. Sync current active barbers into staff
DO $$
DECLARE
  b RECORD;
BEGIN
  FOR b IN 
    SELECT id, name, google_email 
    FROM barbers 
    WHERE active = true 
      AND google_email IS NOT NULL 
      AND trim(google_email) != ''
      AND lower(trim(google_email)) NOT IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com')
  LOOP
    INSERT INTO staff (email, full_name, role, barber_id, status)
    VALUES (lower(trim(b.google_email)), b.name, 'barber', b.id, 'verified')
    ON CONFLICT (email) DO UPDATE
      SET role = 'barber',
          status = 'verified',
          barber_id = b.id,
          full_name = b.name;
  END LOOP;
END $$;

-- 5. Update get_my_role() to enforce strictly:
--    - Master admins -> admin
--    - Active barbers -> barber (linked to barber_id)
--    - Anyone else -> NULL (NO ACCESS)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_barber record;
BEGIN
  v_email := lower(trim(auth.jwt() ->> 'email'));

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('role', null, 'status', null, 'barber_id', null, 'email', null);
  END IF;

  -- 1. Master Admins
  IF v_email IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com') THEN
    RETURN jsonb_build_object(
      'role', 'admin',
      'status', 'verified',
      'barber_id', (SELECT id FROM barbers WHERE lower(trim(google_email)) = v_email LIMIT 1),
      'email', v_email
    );
  END IF;

  -- 2. Active Barbers from barbers table
  SELECT id, name, google_email INTO v_barber
  FROM barbers
  WHERE lower(trim(google_email)) = v_email AND active = true
  LIMIT 1;

  IF v_barber.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'role', 'barber',
      'status', 'verified',
      'barber_id', v_barber.id,
      'email', v_email
    );
  END IF;

  -- 3. Any other user has NO role
  RETURN jsonb_build_object('role', null, 'status', null, 'barber_id', null, 'email', null);
END;
$$;

-- 6. Update has_admin() to always return true (master admins are permanent)
CREATE OR REPLACE FUNCTION has_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT true;
$$;
