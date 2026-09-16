/*
# Link barbers.google_email to real panel access (staff table)

1. Problem
   `AdminStaff.tsx` already lets Adrián set a `google_email` on a barber,
   and it saves fine (after the earlier fix). But actual access to the
   admin/barber panel is decided by `get_my_role()`, which looks up the
   `staff` table by email — a completely separate table that nothing was
   keeping in sync with `barbers.google_email`. So setting the email never
   actually granted access.

2. Fix
   A trigger on `barbers` keeps `staff` in sync automatically, so Adrián
   only ever has to manage this from the "Personal" screen:
   - INSERT/UPDATE with a `google_email` set → upserts a verified 'barber'
     row in `staff` for that email, linked to that barber_id.
   - Clearing the email, or deleting the barber → removes that barber's
     access from `staff`.
   - If the email is changed to a different one, the old email's access
     is revoked and the new one is granted.
   - Never touches/downgrades an existing 'admin' row, even if an email
     collides (defensive, shouldn't happen in practice).
   - `get_my_role()` now compares emails case-insensitively, since Adrián
     might type the email with different casing than Google's JWT returns.

3. Backfill
   Runs the same sync once for any barber that already has a google_email
   set today, so access applies immediately without re-saving them.
*/

CREATE OR REPLACE FUNCTION sync_barber_staff_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_email text;
  v_new_email text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM staff WHERE barber_id = OLD.id AND role = 'barber';
    RETURN OLD;
  END IF;

  v_new_email := NULLIF(lower(trim(NEW.google_email)), '');

  IF TG_OP = 'UPDATE' THEN
    v_old_email := NULLIF(lower(trim(OLD.google_email)), '');
    IF v_old_email IS NOT NULL AND v_old_email IS DISTINCT FROM v_new_email THEN
      DELETE FROM staff WHERE email = v_old_email AND role = 'barber' AND barber_id = NEW.id;
    END IF;
  END IF;

  IF v_new_email IS NOT NULL THEN
    INSERT INTO staff (email, full_name, role, barber_id, status)
    VALUES (v_new_email, NEW.name, 'barber', NEW.id, 'verified')
    ON CONFLICT (email) DO UPDATE
      SET role = 'barber',
          status = 'verified',
          barber_id = NEW.id,
          full_name = NEW.name
      WHERE staff.role = 'barber';
  ELSE
    DELETE FROM staff WHERE barber_id = NEW.id AND role = 'barber';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_barber_staff_access ON barbers;
CREATE TRIGGER trg_sync_barber_staff_access
AFTER INSERT OR UPDATE OR DELETE ON barbers
FOR EACH ROW EXECUTE FUNCTION sync_barber_staff_access();

-- Backfill: sync any barber that already has a google_email set today.
DO $$
DECLARE
  b RECORD;
BEGIN
  FOR b IN SELECT id, name, google_email FROM barbers WHERE google_email IS NOT NULL AND trim(google_email) != '' LOOP
    INSERT INTO staff (email, full_name, role, barber_id, status)
    VALUES (lower(trim(b.google_email)), b.name, 'barber', b.id, 'verified')
    ON CONFLICT (email) DO UPDATE
      SET role = 'barber', status = 'verified', barber_id = b.id, full_name = b.name
      WHERE staff.role = 'barber';
  END LOOP;
END $$;

-- Make role lookup case-insensitive on email (Google's JWT casing vs. what Adrián types can differ).
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
    WHERE s.email = lower(auth.jwt() ->> 'email')),
    jsonb_build_object('role', null, 'status', null, 'barber_id', null, 'email', null)
  );
$$;
