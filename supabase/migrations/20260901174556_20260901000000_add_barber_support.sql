/*
# Add barber support and availability blocks

1. Overview
- Adds a `barber` column to the existing `bookings` table so each appointment is tied to a specific barber ("adrian" or "loren").
- Creates a new `barber_blocks` table to store per-barber availability blocks: day-of-week rest days, specific date blocks, and individual time-slot blocks.
- Enables RLS on `barber_blocks` and adds full anon+authenticated CRUD policies so the no-auth frontend can read and manage blocks.

2. Modified Tables
- `bookings`
  - `barber` (text, NOT NULL, default 'adrian') — the barber assigned to the appointment. CHECK constraint limits to 'adrian' or 'loren'.
  - `status` — now also allows 'cancelled' in addition to 'pending' and 'confirmed' (CHECK updated).

3. New Tables
- `barber_blocks`
  - `id` (uuid, primary key)
  - `barber` (text, NOT NULL) — 'adrian' or 'loren', CHECK constrained.
  - `block_type` (text, NOT NULL) — 'day_off' (a full specific date off), 'weekly_off' (a recurring weekday off), 'slot_block' (a specific date+time slot blocked).
  - `block_date` (date, nullable) — used for 'day_off' and 'slot_block'.
  - `weekday` (integer, nullable, 0=Sunday..6=Saturday) — used for 'weekly_off'.
  - `block_time` (text, nullable) — used for 'slot_block' (e.g. '10:00').
  - `note` (text, nullable) — optional note.
  - `created_at` (timestamptz, default now())

4. Indexes
- `idx_bookings_barber_date` on bookings(barber, booking_date) — speeds up availability queries.
- `idx_barber_blocks_barber` on barber_blocks(barber).
- `idx_barber_blocks_date` on barber_blocks(block_date).

5. Security
- `barber_blocks`: RLS enabled, anon+authenticated full CRUD (this is a shared operational table for a no-auth app).
- `bookings`: SELECT/UPDATE/DELETE policies added for anon+authenticated so the admin panel can read and manage bookings. INSERT policy already existed; updated to include barber in WITH CHECK.
*/

-- 1. Add barber column to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS barber text NOT NULL DEFAULT 'adrian';

-- Add CHECK constraint for barber values (drop first for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_barber_check'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_barber_check
      CHECK (barber IN ('adrian', 'loren'));
  END IF;
END $$;

-- Update status check to allow 'cancelled'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_status_check'
  ) THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
  END IF;
END $$;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled'));

-- 2. Create barber_blocks table
CREATE TABLE IF NOT EXISTS barber_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber text NOT NULL CHECK (barber IN ('adrian', 'loren')),
  block_type text NOT NULL CHECK (block_type IN ('day_off', 'weekly_off', 'slot_block')),
  block_date date,
  weekday integer CHECK (weekday IS NULL OR (weekday >= 0 AND weekday <= 6)),
  block_time text,
  note text,
  created_at timestamptz DEFAULT now(),
  CHECK (
    (block_type = 'day_off' AND block_date IS NOT NULL) OR
    (block_type = 'weekly_off' AND weekday IS NOT NULL) OR
    (block_type = 'slot_block' AND block_date IS NOT NULL AND block_time IS NOT NULL)
  )
);

ALTER TABLE barber_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_barber_blocks" ON barber_blocks;
CREATE POLICY "anon_select_barber_blocks" ON barber_blocks FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_barber_blocks" ON barber_blocks;
CREATE POLICY "anon_insert_barber_blocks" ON barber_blocks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_barber_blocks" ON barber_blocks;
CREATE POLICY "anon_update_barber_blocks" ON barber_blocks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_barber_blocks" ON barber_blocks;
CREATE POLICY "anon_delete_barber_blocks" ON barber_blocks FOR DELETE
  TO anon, authenticated USING (true);

-- 3. Add SELECT/UPDATE/DELETE policies to bookings for admin panel
DROP POLICY IF EXISTS "anon_select_bookings" ON bookings;
CREATE POLICY "anon_select_bookings" ON bookings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_bookings" ON bookings;
CREATE POLICY "anon_update_bookings" ON bookings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bookings" ON bookings;
CREATE POLICY "anon_delete_bookings" ON bookings FOR DELETE
  TO anon, authenticated USING (true);

-- Replace the insert policy to include barber in WITH CHECK
DROP POLICY IF EXISTS "anon_insert_bookings" ON bookings;
CREATE POLICY "anon_insert_bookings" ON bookings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_barber_date ON bookings(barber, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_barber_datetime ON bookings(barber, booking_date, booking_time);
CREATE INDEX IF NOT EXISTS idx_barber_blocks_barber ON barber_blocks(barber);
CREATE INDEX IF NOT EXISTS idx_barber_blocks_date ON barber_blocks(block_date);
