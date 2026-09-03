/*
# Create bookings table for Peluquería Adrián Millán

1. New Tables
- `bookings`
  - `id` (uuid, primary key)
  - `service` (text, not null) — name of the selected service, e.g. "Corte Clásico"
  - `service_price` (integer, not null) — price in euros of the selected service
  - `booking_date` (date, not null) — selected appointment date
  - `booking_time` (text, not null) — selected appointment time slot, e.g. "10:00"
  - `full_name` (text, not null) — customer's full name
  - `phone` (text, not null) — customer's phone number
  - `email` (text, not null) — customer's email address
  - `comments` (text, nullable) — optional comments from the customer
  - `status` (text, not null default 'pending') — booking status
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `bookings`.
- This is a no-auth public booking app: customers submit bookings without an account.
- Allow anon + authenticated to INSERT (create bookings) and SELECT their own submission by email is not feasible without auth, so SELECT is restricted to service role only via no anon SELECT policy. For simplicity and to allow a future admin, anon can INSERT only.
- Actually: the app only needs to INSERT bookings (no login, no reading of bookings in the UI). So we add an INSERT policy for anon+authenticated and no SELECT/UPDATE/DELETE policies (service role still bypasses RLS for admin access).
*/

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL,
  service_price integer NOT NULL,
  booking_date date NOT NULL,
  booking_time text NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  comments text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_bookings" ON bookings;
CREATE POLICY "anon_insert_bookings" ON bookings FOR INSERT
  TO anon, authenticated WITH CHECK (true);
