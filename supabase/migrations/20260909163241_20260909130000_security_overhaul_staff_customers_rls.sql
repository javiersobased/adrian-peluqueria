/*
# Security overhaul: staff accounts, customer profiles, role-based RLS, backend validation

1. Overview
- Replaces the old local-password admin auth with Google OAuth + database-enforced roles.
- Creates a `staff` table (email-keyed) that maps Google accounts to admin/barber roles.
- Creates a `customers` table that stores customer data (name, phone, comments, Google email) persistently, linked to auth.users.
- Creates the missing `barber_schedules` and `barber_vacations` tables (code referenced them but they did not exist in the DB).
- Reworks `bookings` RLS to be role-based: customers see only their own, verified barbers see their assigned bookings, admin sees all.
- Anon can no longer read bookings directly (customer data protection). A SECURITY DEFINER function `get_booked_slots` exposes only time strings for the public availability check.
- All booking creation goes through a `create_booking` SECURITY DEFINER function that validates name/phone/comments, checks slot availability, and upserts the customer record.
- Barber verification is a `verify_barber` SECURITY DEFINER function callable only by admin.
- A one-time `claim_admin` function bootstraps the first admin (Adrián).

2. New Tables
- `staff`
  - email (text, PK) — the Google email used to sign in
  - full_name (text, nullable)
  - role (text, 'admin' | 'barber')
  - barber_id (text, nullable, FK → barbers.id) — links staff account to a barber profile
  - status (text, 'pending' | 'verified' | 'rejected')
  - created_at (timestamptz)
- `customers`
  - user_id (uuid, PK, FK → auth.users) — the Google account
  - full_name (text), phone (text), email (text, nullable), comments (text, nullable)
  - created_at, updated_at (timestamptz)
- `barber_schedules`
  - id (uuid, PK), barber (text), weekday (0-6), is_working (bool),
  - morning_start/end, afternoon_start/end (text, nullable), UNIQUE(barber, weekday)
- `barber_vacations`
  - id (uuid, PK), barber (text), start_date, end_date (date), reason (text, nullable), created_at

3. Modified Tables
- `bookings`: `email` column relaxed from NOT NULL to nullable (email now comes from Google, not the form).
- `barbers`: mutation policies changed from anon-open to admin-only.
- `services`: mutation policies changed from anon-open to admin-only.
- `barber_blocks`: mutation policies changed from anon-open to authenticated-staff-only.

4. Security
- `staff` RLS: admin sees all rows; a user sees their own row (matched by email).
- `customers` RLS: admin sees all; a customer sees only their own row.
- `bookings` RLS: customer sees own (auth.uid() = user_id); admin sees all; verified barber sees bookings where barber_id matches.
- `barber_schedules`, `barber_vacations`: anon SELECT (public booking flow needs them), authenticated CRUD.
- `barbers`, `services`: anon SELECT (public booking flow), admin-only mutations.
- `barber_blocks`: anon SELECT, authenticated-staff mutations.
- SECURITY DEFINER functions: get_my_role, has_admin, claim_admin, verify_barber, create_booking, get_booked_slots.

5. Important Notes
- claim_admin() can only succeed if no verified admin exists yet. Adrián should log in with Google and call it once.
- verify_barber(email) checks that the caller is a verified admin before setting a barber's status to 'verified'.
- create_booking validates name length >= 2, Spanish phone regex, comments length <= 1000, and slot availability before inserting.
- get_booked_slots returns only booking_time strings (no customer data) so the public availability check works without exposing customer info.
- The old auth.ts local-password system is retired; all authentication now flows through Google OAuth + Supabase Auth.
*/ 

-- ============================================================
-- 1. RELAX bookings.email CONSTRAINT
-- ============================================================
ALTER TABLE bookings ALTER COLUMN email DROP NOT NULL;
ALTER TABLE bookings ALTER COLUMN email SET DEFAULT NULL;

-- ============================================================
-- 2. STAFF TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
  email text PRIMARY KEY,
  full_name text,
  role text NOT NULL DEFAULT 'barber' CHECK (role IN ('admin', 'barber')),
  barber_id text REFERENCES barbers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_staff_admin_or_self" ON staff;
CREATE POLICY "select_staff_admin_or_self" ON staff FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "insert_staff_admin_only" ON staff;
CREATE POLICY "insert_staff_admin_only" ON staff FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "update_staff_admin_only" ON staff;
CREATE POLICY "update_staff_admin_only" ON staff FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "delete_staff_admin_only" ON staff;
CREATE POLICY "delete_staff_admin_only" ON staff FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
  );

-- ============================================================
-- 3. CUSTOMERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_customers_admin_or_self" ON customers;
CREATE POLICY "select_customers_admin_or_self" ON customers FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
  );

-- ============================================================
-- 4. BARBER_SCHEDULES TABLE (was missing from DB)
-- ============================================================
CREATE TABLE IF NOT EXISTS barber_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber text NOT NULL,
  weekday integer NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  is_working boolean NOT NULL DEFAULT false,
  morning_start text,
  morning_end text,
  afternoon_start text,
  afternoon_end text,
  UNIQUE(barber, weekday)
);

ALTER TABLE barber_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_barber_schedules" ON barber_schedules;
CREATE POLICY "anon_select_barber_schedules" ON barber_schedules FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_barber_schedules" ON barber_schedules;
CREATE POLICY "auth_insert_barber_schedules" ON barber_schedules FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_barber_schedules" ON barber_schedules;
CREATE POLICY "auth_update_barber_schedules" ON barber_schedules FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_barber_schedules" ON barber_schedules;
CREATE POLICY "auth_delete_barber_schedules" ON barber_schedules FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 5. BARBER_VACATIONS TABLE (was missing from DB)
-- ============================================================
CREATE TABLE IF NOT EXISTS barber_vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE barber_vacations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_barber_vacations" ON barber_vacations;
CREATE POLICY "anon_select_barber_vacations" ON barber_vacations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_barber_vacations" ON barber_vacations;
CREATE POLICY "auth_insert_barber_vacations" ON barber_vacations FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_barber_vacations" ON barber_vacations;
CREATE POLICY "auth_update_barber_vacations" ON barber_vacations FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_barber_vacations" ON barber_vacations;
CREATE POLICY "auth_delete_barber_vacations" ON barber_vacations FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 6. UPDATE BARBERS MUTATION POLICIES (admin-only)
-- ============================================================
DROP POLICY IF EXISTS "anon_insert_barbers" ON barbers;
DROP POLICY IF EXISTS "anon_update_barbers" ON barbers;
DROP POLICY IF EXISTS "anon_delete_barbers" ON barbers;

DROP POLICY IF EXISTS "insert_barbers_admin" ON barbers;
CREATE POLICY "insert_barbers_admin" ON barbers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "update_barbers_admin" ON barbers;
CREATE POLICY "update_barbers_admin" ON barbers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "delete_barbers_admin" ON barbers;
CREATE POLICY "delete_barbers_admin" ON barbers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
  );

-- ============================================================
-- 7. UPDATE SERVICES MUTATION POLICIES (admin-only)
-- ============================================================
DROP POLICY IF EXISTS "anon_insert_services" ON services;
DROP POLICY IF EXISTS "anon_update_services" ON services;
DROP POLICY IF EXISTS "anon_delete_services" ON services;

DROP POLICY IF EXISTS "insert_services_admin" ON services;
CREATE POLICY "insert_services_admin" ON services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "update_services_admin" ON services;
CREATE POLICY "update_services_admin" ON services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "delete_services_admin" ON services;
CREATE POLICY "delete_services_admin" ON services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
  );

-- ============================================================
-- 8. UPDATE BARBER_BLOCKS MUTATION POLICIES (authenticated staff)
-- ============================================================
DROP POLICY IF EXISTS "anon_insert_barber_blocks" ON barber_blocks;
DROP POLICY IF EXISTS "anon_update_barber_blocks" ON barber_blocks;
DROP POLICY IF EXISTS "anon_delete_barber_blocks" ON barber_blocks;

DROP POLICY IF EXISTS "auth_insert_barber_blocks" ON barber_blocks;
CREATE POLICY "auth_insert_barber_blocks" ON barber_blocks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "auth_update_barber_blocks" ON barber_blocks;
CREATE POLICY "auth_update_barber_blocks" ON barber_blocks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.status = 'verified'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.status = 'verified'
    )
  );

DROP POLICY IF EXISTS "auth_delete_barber_blocks" ON barber_blocks;
CREATE POLICY "auth_delete_barber_blocks" ON barber_blocks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.status = 'verified'
    )
  );

-- ============================================================
-- 9. UPDATE BOOKINGS RLS (role-based)
-- ============================================================
DROP POLICY IF EXISTS "anon_insert_manual_bookings" ON bookings;
DROP POLICY IF EXISTS "anon_select_all_bookings_admin" ON bookings;
DROP POLICY IF EXISTS "anon_update_bookings_admin" ON bookings;
DROP POLICY IF EXISTS "anon_delete_bookings_admin" ON bookings;
DROP POLICY IF EXISTS "authenticated_insert_own_bookings" ON bookings;
DROP POLICY IF EXISTS "authenticated_select_own_bookings" ON bookings;

DROP POLICY IF EXISTS "insert_bookings_role_based" ON bookings;
CREATE POLICY "insert_bookings_role_based" ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR (
      user_id IS NULL
      AND EXISTS (
        SELECT 1 FROM staff s
        WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND s.role = 'admin' AND s.status = 'verified'
      )
    )
    OR (
      user_id IS NULL
      AND EXISTS (
        SELECT 1 FROM staff s
        WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND s.role = 'barber' AND s.status = 'verified'
        AND s.barber_id = bookings.barber
      )
    )
  );

DROP POLICY IF EXISTS "select_bookings_role_based" ON bookings;
CREATE POLICY "select_bookings_role_based" ON bookings FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'barber' AND s.status = 'verified'
      AND s.barber_id = bookings.barber
    )
  );

DROP POLICY IF EXISTS "update_bookings_role_based" ON bookings;
CREATE POLICY "update_bookings_role_based" ON bookings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'barber' AND s.status = 'verified'
      AND s.barber_id = bookings.barber
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'barber' AND s.status = 'verified'
      AND s.barber_id = bookings.barber
    )
  );

DROP POLICY IF EXISTS "delete_bookings_admin_only" ON bookings;
CREATE POLICY "delete_bookings_admin_only" ON bookings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND s.role = 'admin' AND s.status = 'verified'
    )
  );

-- ============================================================
-- 10. SECURITY DEFINER FUNCTIONS
-- ============================================================

-- get_my_role: returns the caller's staff role info (or nulls if not staff)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
      'role', s.role,
      'status', s.status,
      'barber_id', s.barber_id,
      'email', s.email
    )
    FROM staff s
    WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())),
    jsonb_build_object('role', null, 'status', null, 'barber_id', null, 'email', null)
  );
$$;

-- has_admin: checks if a verified admin exists (for bootstrap UI)
CREATE OR REPLACE FUNCTION has_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM staff WHERE role = 'admin' AND status = 'verified');
$$;

-- claim_admin: one-time bootstrap, first authenticated caller becomes admin
CREATE OR REPLACE FUNCTION claim_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_admin_count integer;
BEGIN
  v_email := (SELECT email FROM auth.users WHERE id = auth.uid());
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COUNT(*) INTO v_admin_count FROM staff WHERE role = 'admin' AND status = 'verified';
  IF v_admin_count > 0 THEN
    RAISE EXCEPTION 'An admin already exists';
  END IF;

  INSERT INTO staff (email, role, status, full_name)
  VALUES (v_email, 'admin', 'verified', '')
  ON CONFLICT (email) DO UPDATE
  SET role = 'admin', status = 'verified';
END;
$$;

-- verify_barber: admin sets a barber's status to verified
CREATE OR REPLACE FUNCTION verify_barber(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM staff s
    WHERE s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND s.role = 'admin' AND s.status = 'verified'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admin can verify barbers';
  END IF;

  UPDATE staff SET status = 'verified'
  WHERE email = p_email AND role = 'barber';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barber not found';
  END IF;
END;
$$;

-- create_booking: validates and creates a booking, upserts customer
CREATE OR REPLACE FUNCTION create_booking(
  p_service text,
  p_service_price integer,
  p_barber text,
  p_booking_date date,
  p_booking_time text,
  p_full_name text,
  p_phone text,
  p_comments text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_full_name text := trim(p_full_name);
  v_phone text := trim(p_phone);
  v_comments text := trim(p_comments);
  v_booking_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF length(v_full_name) < 2 THEN
    RAISE EXCEPTION 'Name must be at least 2 characters';
  END IF;
  IF v_phone !~ '^(\+34\s?|0034\s?)?[6789]\d{2}(\s?\d{2}){3}$' THEN
    RAISE EXCEPTION 'Invalid phone number';
  END IF;
  IF v_comments IS NOT NULL AND length(v_comments) > 1000 THEN
    RAISE EXCEPTION 'Comments too long';
  END IF;

  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE barber = p_barber
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND status != 'cancelled'
    ) THEN
    RAISE EXCEPTION 'This time slot is already booked';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO bookings (service, service_price, barber, booking_date, booking_time, full_name, phone, email, comments, status, user_id)
  VALUES (p_service, p_service_price, p_barber, p_booking_date, p_booking_time, v_full_name, v_phone, v_email, v_comments, 'pending', v_user_id)
  RETURNING id INTO v_booking_id;

  INSERT INTO customers (user_id, full_name, phone, email, comments)
  VALUES (v_user_id, v_full_name, v_phone, v_email, v_comments)
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      comments = EXCLUDED.comments,
      updated_at = now();

  RETURN v_booking_id;
END;
$$;

-- get_booked_slots: returns only time strings (no customer data) for public availability check
CREATE OR REPLACE FUNCTION get_booked_slots(p_barber text, p_date date)
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT booking_time FROM bookings
  WHERE barber = p_barber
    AND booking_date = p_date
    AND status != 'cancelled';
$$;

-- ============================================================
-- 11. GRANT EXECUTE
-- ============================================================
GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION has_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION claim_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION verify_barber(text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_booking(text, integer, text, date, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_booked_slots(text, date) TO anon, authenticated;