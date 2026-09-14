-- ============================================================
-- 1. FIX ADMIN ROLES & MASTER ACCESS
-- ============================================================

-- Ensure the master admin accounts always exist in staff
INSERT INTO staff (email, full_name, role, status)
VALUES 
  ('franciscojavierfarinapadilla@gmail.com', 'Francisco Javier', 'admin', 'verified'),
  ('adrian.millan.peguero@hotmail.com', 'Adrián Millán', 'admin', 'verified')
ON CONFLICT (email) DO UPDATE
  SET role = 'admin', status = 'verified';

-- Update get_my_role() to guarantee master admin access unconditionally
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_res jsonb;
BEGIN
  v_email := lower(trim(auth.jwt() ->> 'email'));

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('role', null, 'status', null, 'barber_id', null, 'email', null);
  END IF;

  -- Master unconditional admins
  IF v_email IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com') THEN
    RETURN jsonb_build_object(
      'role', 'admin',
      'status', 'verified',
      'barber_id', (SELECT id FROM barbers WHERE lower(trim(google_email)) = v_email LIMIT 1),
      'email', v_email
    );
  END IF;

  SELECT jsonb_build_object(
    'role', s.role,
    'status', s.status,
    'barber_id', s.barber_id,
    'email', s.email
  ) INTO v_res
  FROM staff s
  WHERE lower(trim(s.email)) = v_email
  LIMIT 1;

  RETURN COALESCE(v_res, jsonb_build_object('role', null, 'status', null, 'barber_id', null, 'email', null));
END;
$$;

-- Fix sync_barber_staff_access() trigger:
-- When a barber is deleted or their google_email is changed/removed,
-- immediately revoke their barber staff access (unless master admin).
CREATE OR REPLACE FUNCTION sync_barber_staff_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_email text;
  v_new_email text;
  v_protected_emails text[] := ARRAY['franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM staff 
    WHERE barber_id = OLD.id 
      AND role = 'barber'
      AND email != ALL(v_protected_emails);
    RETURN OLD;
  END IF;

  v_new_email := NULLIF(lower(trim(NEW.google_email)), '');

  IF TG_OP = 'UPDATE' THEN
    v_old_email := NULLIF(lower(trim(OLD.google_email)), '');
    IF v_old_email IS NOT NULL AND v_old_email IS DISTINCT FROM v_new_email THEN
      DELETE FROM staff 
      WHERE (email = v_old_email OR barber_id = NEW.id)
        AND role = 'barber'
        AND email != ALL(v_protected_emails);
    END IF;
  END IF;

  IF v_new_email IS NOT NULL THEN
    -- If email is in master admin list, keep admin
    IF v_new_email = ANY(v_protected_emails) THEN
      UPDATE staff SET barber_id = NEW.id, full_name = NEW.name WHERE email = v_new_email;
    ELSE
      INSERT INTO staff (email, full_name, role, barber_id, status)
      VALUES (v_new_email, NEW.name, 'barber', NEW.id, 'verified')
      ON CONFLICT (email) DO UPDATE
        SET role = 'barber',
            status = 'verified',
            barber_id = NEW.id,
            full_name = NEW.name
        WHERE staff.email != ALL(v_protected_emails);
    END IF;
  ELSE
    DELETE FROM staff 
    WHERE barber_id = NEW.id 
      AND role = 'barber'
      AND email != ALL(v_protected_emails);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_barber_staff_access ON barbers;
CREATE TRIGGER trg_sync_barber_staff_access
AFTER INSERT OR UPDATE OR DELETE ON barbers
FOR EACH ROW EXECUTE FUNCTION sync_barber_staff_access();


-- ============================================================
-- 2. GALLERY PHOTOS TABLE & STORAGE
-- ============================================================

CREATE TABLE IF NOT EXISTS gallery_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  title text DEFAULT '',
  barber_id text REFERENCES barbers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE gallery_photos ENABLE ROW LEVEL SECURITY;

-- Public can view photos
DROP POLICY IF EXISTS "public_select_gallery_photos" ON gallery_photos;
CREATE POLICY "public_select_gallery_photos" ON gallery_photos
  FOR SELECT TO anon, authenticated
  USING (true);

-- Staff (admin or verified barber) can insert/update/delete
DROP POLICY IF EXISTS "staff_insert_gallery_photos" ON gallery_photos;
CREATE POLICY "staff_insert_gallery_photos" ON gallery_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE lower(s.email) = lower(auth.jwt() ->> 'email')
        AND s.status = 'verified'
    )
    OR lower(auth.jwt() ->> 'email') IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com')
  );

DROP POLICY IF EXISTS "staff_delete_gallery_photos" ON gallery_photos;
CREATE POLICY "staff_delete_gallery_photos" ON gallery_photos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE lower(s.email) = lower(auth.jwt() ->> 'email')
        AND s.status = 'verified'
    )
    OR lower(auth.jwt() ->> 'email') IN ('franciscojavierfarinapadilla@gmail.com', 'adrian.millan.peguero@hotmail.com')
  );

-- Create storage bucket for gallery photos if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery-photos',
  'gallery-photos',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- Storage policies for gallery-photos
DROP POLICY IF EXISTS "public_read_gallery_photos" ON storage.objects;
CREATE POLICY "public_read_gallery_photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'gallery-photos');

DROP POLICY IF EXISTS "authenticated_upload_gallery_photos" ON storage.objects;
CREATE POLICY "authenticated_upload_gallery_photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery-photos');

DROP POLICY IF EXISTS "authenticated_delete_gallery_photos" ON storage.objects;
CREATE POLICY "authenticated_delete_gallery_photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'gallery-photos');
