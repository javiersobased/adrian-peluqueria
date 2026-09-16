/*
# Fix booking confirmation showing blank fields + admin panel not syncing

1. Bug #1 — create_booking() return type mismatch (confirmed root cause of
   the blank/null confirmation screen)
   - The SQL function `create_booking` was defined as `RETURNS uuid` (just
     the new row's id).
   - But `src/lib/bookings.ts` calls it and treats the RPC result as if it
     were already the full booking row: `return { booking: data as
     SavedBooking, ... }`.
   - So `data` was actually a bare UUID string. `booking.service`,
     `booking.booking_date`, `booking.full_name` etc. were all `undefined`
     on that string — hence the confirmation screen showing blank/null
     fields, and `prettyDate(undefined)` throwing in the console.
   - Fix: `create_booking` now returns the full inserted row
     (`RETURNS bookings`), matching what the frontend already expects.
     Bonus: this also means the customer's browser never needs a follow-up
     SELECT to read their own new booking back (no RLS round-trip at all).

2. Bug #2 — RLS policies silently failing (auth.users is not readable by
   normal roles)
   - Every "is this user admin/barber?" check added in the previous
     migration ran `(SELECT email FROM auth.users WHERE id = auth.uid())`
     directly inside a plain RLS policy. `auth.users` is only readable by
     `service_role` in Supabase — a normal policy runs as the caller's own
     role, so this either fails outright or, worse, is inconsistent
     depending on how Postgres decides to evaluate the OR'd conditions.
   - This is why the admin panel could show zero bookings/customers even
     though the rows exist (fetchBookings/fetchCustomers silently come
     back empty), and why AdminManualBooking's direct insert could be
     unreliable.
   - Fix: replaced every occurrence with `(auth.jwt() ->> 'email')`, which
     reads the email straight from the caller's JWT — no table permission
     needed, and it's Supabase's official recommended pattern.

3. Bonus — makes sure the tables the admin panel listens to over Realtime
   are actually part of the `supabase_realtime` publication (creating a
   table does not automatically start broadcasting its changes).
*/

-- ============================================================
-- 1. create_booking: return the full row, not just its id
-- ============================================================
DROP FUNCTION IF EXISTS create_booking(text, integer, text, date, text, text, text, text);

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
RETURNS bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_full_name text := trim(p_full_name);
  v_phone text := trim(p_phone);
  v_comments text := trim(p_comments);
  v_row bookings;
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

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION create_booking(text, integer, text, date, text, text, text, text) TO authenticated;

-- ============================================================
-- 2. Other SECURITY DEFINER functions: stop touching auth.users
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
      'role', s.role, 'status', s.status, 'barber_id', s.barber_id, 'email', s.email
    )
    FROM staff s
    WHERE s.email = (auth.jwt() ->> 'email')),
    jsonb_build_object('role', null, 'status', null, 'barber_id', null, 'email', null)
  );
$$;

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
  v_email := auth.jwt() ->> 'email';
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT COUNT(*) INTO v_admin_count FROM staff WHERE role = 'admin' AND status = 'verified';
  IF v_admin_count > 0 THEN
    RAISE EXCEPTION 'An admin already exists';
  END IF;
  INSERT INTO staff (email, role, status, full_name)
  VALUES (v_email, 'admin', 'verified', '')
  ON CONFLICT (email) DO UPDATE SET role = 'admin', status = 'verified';
END;
$$;

-- ============================================================
-- 3. RLS policies: same fix, table by table
-- ============================================================
DROP POLICY IF EXISTS "select_staff_admin_or_self" ON staff;
CREATE POLICY "select_staff_admin_or_self" ON staff FOR SELECT TO authenticated
  USING (email = (auth.jwt() ->> 'email') OR EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'));

DROP POLICY IF EXISTS "insert_staff_admin_only" ON staff;
CREATE POLICY "insert_staff_admin_only" ON staff FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'));

DROP POLICY IF EXISTS "update_staff_admin_only" ON staff;
CREATE POLICY "update_staff_admin_only" ON staff FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'))
  WITH CHECK (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'));

DROP POLICY IF EXISTS "delete_staff_admin_only" ON staff;
CREATE POLICY "delete_staff_admin_only" ON staff FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'));

DROP POLICY IF EXISTS "select_customers_admin_or_self" ON customers;
CREATE POLICY "select_customers_admin_or_self" ON customers FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'));

DROP POLICY IF EXISTS "insert_barbers_admin" ON barbers;
CREATE POLICY "insert_barbers_admin" ON barbers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'));

DROP POLICY IF EXISTS "update_barbers_admin" ON barbers;
CREATE POLICY "update_barbers_admin" ON barbers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'))
  WITH CHECK (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'));

DROP POLICY IF EXISTS "delete_barbers_admin" ON barbers;
CREATE POLICY "delete_barbers_admin" ON barbers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'));

DROP POLICY IF EXISTS "insert_services_admin" ON services;
CREATE POLICY "insert_services_admin" ON services FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'));

DROP POLICY IF EXISTS "update_services_admin" ON services;
CREATE POLICY "update_services_admin" ON services FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'))
  WITH CHECK (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'));

DROP POLICY IF EXISTS "delete_services_admin" ON services;
CREATE POLICY "delete_services_admin" ON services FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'));

DROP POLICY IF EXISTS "auth_insert_barber_blocks" ON barber_blocks;
CREATE POLICY "auth_insert_barber_blocks" ON barber_blocks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.status = 'verified'));

DROP POLICY IF EXISTS "auth_update_barber_blocks" ON barber_blocks;
CREATE POLICY "auth_update_barber_blocks" ON barber_blocks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.status = 'verified'))
  WITH CHECK (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.status = 'verified'));

DROP POLICY IF EXISTS "auth_delete_barber_blocks" ON barber_blocks;
CREATE POLICY "auth_delete_barber_blocks" ON barber_blocks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.status = 'verified'));

DROP POLICY IF EXISTS "insert_bookings_role_based" ON bookings;
CREATE POLICY "insert_bookings_role_based" ON bookings FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR (user_id IS NULL AND EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'))
    OR (user_id IS NULL AND EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'barber' AND s.status = 'verified' AND s.barber_id = bookings.barber))
  );

DROP POLICY IF EXISTS "select_bookings_role_based" ON bookings;
CREATE POLICY "select_bookings_role_based" ON bookings FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified')
    OR EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'barber' AND s.status = 'verified' AND s.barber_id = bookings.barber)
  );

DROP POLICY IF EXISTS "update_bookings_role_based" ON bookings;
CREATE POLICY "update_bookings_role_based" ON bookings FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified')
    OR EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'barber' AND s.status = 'verified' AND s.barber_id = bookings.barber)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified')
    OR EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'barber' AND s.status = 'verified' AND s.barber_id = bookings.barber)
  );

DROP POLICY IF EXISTS "delete_bookings_admin_only" ON bookings;
CREATE POLICY "delete_bookings_admin_only" ON bookings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'));

-- ============================================================
-- 4. Realtime: make sure the admin panel's live subscriptions
--    actually receive changes.
-- ============================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bookings', 'barber_blocks', 'barber_vacations', 'barber_schedules', 'customers', 'staff']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
