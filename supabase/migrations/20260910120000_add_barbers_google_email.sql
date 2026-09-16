/*
# Fix: 400 Bad Request when adding/editing a barber

`src/components/admin/AdminStaff.tsx` sends a `google_email` field when
inserting/updating a row in `barbers` (added to let the admin link a
barber profile to the Google account that should get barber access), but
no migration ever added that column to the table. PostgREST rejects the
insert with 400 because the column isn't in its schema cache.
*/

ALTER TABLE barbers ADD COLUMN IF NOT EXISTS google_email text;

CREATE INDEX IF NOT EXISTS idx_barbers_google_email ON barbers(google_email);
