/*
# Create services + barbers tables, modify barber_blocks for time ranges, add storage bucket

1. Overview
- Creates a `services` table so the owner can CRUD services (name, price, duration, icon) from the admin panel.
- Creates a `barbers` table to manage staff dynamically (add/remove barbers, profile photos).
- Modifies `barber_blocks` to support time-range blocks (block_start_time + block_end_time) in addition to full-day blocks.
- Drops the hardcoded CHECK constraints on the `barber` column in bookings/barber_blocks/barber_schedules so new barbers can be added dynamically.
- Creates a public storage bucket for barber profile photos.
- Seeds default services and barbers.

2. New Tables
- `services`
  - id (uuid, PK), name (text), price (int, default 0), duration (text, default '45min'),
    icon (text, default 'scissors'), sort_order (int, default 0), active (bool, default true), created_at
- `barbers`
  - id (text, PK — e.g. 'adrian'), name (text), role (text), initials (text),
    photo_url (text, nullable), active (bool, default true), sort_order (int, default 0), created_at

3. Modified Tables
- `barber_blocks`: added `block_start_time` (text, nullable) and `block_end_time` (text, nullable).
  block_type CHECK updated to include 'time_range'. Main CHECK updated to validate time_range rows.
- `bookings`: dropped `bookings_barber_check` constraint so new barbers can receive bookings.
- `barber_blocks`: dropped `barber_blocks_barber_check` for the same reason.
- `barber_schedules`: dropped `barber_schedules_barber_check` for the same reason.
- `barber_vacations`: dropped `barber_vacations_barber_check` for the same reason.

4. Storage
- Creates public bucket `barber-photos` (5MB limit, JPEG/PNG/WebP).
- Policies: anon+authenticated can read, upload, update, delete objects in this bucket.

5. Security
- `services` and `barbers`: RLS enabled, anon+authenticated full CRUD (shared operational tables, no-auth app).
- Storage policies on `barber-photos` bucket.

6. Seed Data
- 7 default services matching the previous hardcoded list.
- 2 barbers: Adrián (id 'adrian') and Loren (id 'loren').
*/

-- ============================================================
-- 1. SERVICES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  duration text NOT NULL DEFAULT '45min',
  icon text NOT NULL DEFAULT 'scissors',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_services" ON services;
CREATE POLICY "anon_select_services" ON services FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_services" ON services;
CREATE POLICY "anon_insert_services" ON services FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_services" ON services;
CREATE POLICY "anon_update_services" ON services FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_services" ON services;
CREATE POLICY "anon_delete_services" ON services FOR DELETE
  TO anon, authenticated USING (true);

-- Seed services
INSERT INTO services (name, price, duration, icon, sort_order) VALUES
  ('Corte', 0, '45min', 'scissors', 0),
  ('Barba', 0, '45min', 'beard', 1),
  ('Corte + Barba', 0, '45min', 'scissors-crossed', 2),
  ('Barba + Contornos', 0, '45min', 'contours', 3),
  ('Peinado + Lavado', 0, '45min', 'wash', 4),
  ('Tinte + Barba', 0, '45min', 'color', 5),
  ('Arreglo de cuello y patillas', 0, '45min', 'neck', 6)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. BARBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS barbers (
  id text PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'Barbero',
  initials text NOT NULL,
  photo_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_barbers" ON barbers;
CREATE POLICY "anon_select_barbers" ON barbers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_barbers" ON barbers;
CREATE POLICY "anon_insert_barbers" ON barbers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_barbers" ON barbers;
CREATE POLICY "anon_update_barbers" ON barbers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_barbers" ON barbers;
CREATE POLICY "anon_delete_barbers" ON barbers FOR DELETE
  TO anon, authenticated USING (true);

-- Seed barbers
INSERT INTO barbers (id, name, role, initials, sort_order) VALUES
  ('adrian', 'Adrián', 'Barbero · Propietario', 'AM', 0),
  ('loren', 'Loren', 'Barbero', 'LO', 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. DROP HARDCODED BARBER CHECK CONSTRAINTS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_barber_check') THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_barber_check;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barber_blocks_barber_check') THEN
    ALTER TABLE barber_blocks DROP CONSTRAINT barber_blocks_barber_check;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barber_schedules_barber_check') THEN
    ALTER TABLE barber_schedules DROP CONSTRAINT barber_schedules_barber_check;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barber_vacations_barber_check') THEN
    ALTER TABLE barber_vacations DROP CONSTRAINT barber_vacations_barber_check;
  END IF;
END $$;

-- ============================================================
-- 4. MODIFY BARBER_BLOCKS FOR TIME RANGES
-- ============================================================
ALTER TABLE barber_blocks ADD COLUMN IF NOT EXISTS block_start_time text;
ALTER TABLE barber_blocks ADD COLUMN IF NOT EXISTS block_end_time text;

-- Drop old block_type CHECK and add new one with 'time_range'
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barber_blocks_block_type_check') THEN
    ALTER TABLE barber_blocks DROP CONSTRAINT barber_blocks_block_type_check;
  END IF;
END $$;
ALTER TABLE barber_blocks ADD CONSTRAINT barber_blocks_block_type_check
  CHECK (block_type IN ('day_off', 'weekly_off', 'slot_block', 'time_range'));

-- Drop old main CHECK and add new one
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barber_blocks_check') THEN
    ALTER TABLE barber_blocks DROP CONSTRAINT barber_blocks_check;
  END IF;
END $$;
ALTER TABLE barber_blocks ADD CONSTRAINT barber_blocks_check
  CHECK (
    (block_type = 'day_off' AND block_date IS NOT NULL) OR
    (block_type = 'weekly_off' AND weekday IS NOT NULL) OR
    (block_type = 'slot_block' AND block_date IS NOT NULL AND block_time IS NOT NULL) OR
    (block_type = 'time_range' AND block_date IS NOT NULL AND block_start_time IS NOT NULL AND block_end_time IS NOT NULL)
  );

-- ============================================================
-- 5. STORAGE BUCKET FOR BARBER PHOTOS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('barber-photos', 'barber-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read barber photos" ON storage.objects;
CREATE POLICY "Public read barber photos" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'barber-photos');

DROP POLICY IF EXISTS "Anon upload barber photos" ON storage.objects;
CREATE POLICY "Anon upload barber photos" ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'barber-photos');

DROP POLICY IF EXISTS "Anon update barber photos" ON storage.objects;
CREATE POLICY "Anon update barber photos" ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'barber-photos') WITH CHECK (bucket_id = 'barber-photos');

DROP POLICY IF EXISTS "Anon delete barber photos" ON storage.objects;
CREATE POLICY "Anon delete barber photos" ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'barber-photos');

-- ============================================================
-- 6. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_services_active ON services(active, sort_order);
CREATE INDEX IF NOT EXISTS idx_barbers_active ON barbers(active, sort_order);
