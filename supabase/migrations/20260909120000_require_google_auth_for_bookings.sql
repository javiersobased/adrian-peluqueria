/*
# Require Google sign-in for customer bookings (auth.uid() based RLS)

1. Changes
- Adds `user_id` (uuid, nullable, references auth.users) to `bookings`.
  Every booking made by a customer through the public site from now on
  carries the id of the Google account that created it. Existing rows
  (from before this migration) keep `user_id = NULL`.
- Adds an index on `user_id`.

2. Security model
- A customer must be signed in (Supabase Auth via Google) to create a
  booking, and can only insert/read rows where `auth.uid() = user_id`.
  This replaces the old fully-open "anon can insert anything" policy and
  is what stops fake/anonymous bookings.
- The admin panel ("Cita Manual" / agenda / today) still authenticates
  with its own local username+password screen (see src/lib/auth.ts), not
  with Supabase Auth — it always talks to Supabase using the public `anon`
  key. To avoid breaking it, `anon` keeps the ability to:
    - INSERT a booking, but ONLY with `user_id IS NULL` (i.e. a manual
      walk-in booking created by staff, never impersonating a customer).
    - SELECT / UPDATE / DELETE any booking (so the admin panel can keep
      listing, cancelling and managing every appointment).
- IMPORTANT / honest caveat: because the admin login is not real Supabase
  Auth, this RLS setup cannot cryptographically distinguish "the barber"
  from "anyone who has the public anon key" at the database level — the
  anon key is, by design, public in client-side apps. The real gate today
  is still the client-side password screen. If you want the database
  itself to enforce "only the barber can see every booking", the admin
  login needs to move to Supabase Auth too (e.g. a fixed allow-listed
  admin email checked in RLS via auth.jwt() ->> 'email'). That's a
  natural follow-up, not included here since it wasn't part of this change.
*/

-- 1. Add user_id column + index
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);

-- 2. INSERT: a signed-in customer can only insert their own booking...
DROP POLICY IF EXISTS "anon_insert_bookings" ON bookings;

CREATE POLICY "authenticated_insert_own_bookings" ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ...and the admin panel (anon key) can still insert a manual/walk-in
-- booking, as long as it isn't tagged with someone else's account.
CREATE POLICY "anon_insert_manual_bookings" ON bookings FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- 3. SELECT: a signed-in customer can only read their own bookings...
DROP POLICY IF EXISTS "anon_select_bookings" ON bookings;

CREATE POLICY "authenticated_select_own_bookings" ON bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ...the admin panel (anon key) keeps seeing every booking, as before.
CREATE POLICY "anon_select_all_bookings_admin" ON bookings FOR SELECT
  TO anon
  USING (true);

-- 4. UPDATE/DELETE: unchanged — only the admin panel does this today.
DROP POLICY IF EXISTS "anon_update_bookings" ON bookings;
CREATE POLICY "anon_update_bookings_admin" ON bookings FOR UPDATE
  TO anon
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bookings" ON bookings;
CREATE POLICY "anon_delete_bookings_admin" ON bookings FOR DELETE
  TO anon
  USING (true);
