-- ============================================================
-- Barber Self-Profile Update Policy & RPC
-- Allows authenticated barbers to update their own photo_url
-- ============================================================

-- 1. Direct RLS policy on barbers table for self updates
DROP POLICY IF EXISTS "update_barbers_self" ON barbers;
CREATE POLICY "update_barbers_self" ON barbers FOR UPDATE TO authenticated
  USING (
    google_email = (auth.jwt() ->> 'email')
    OR id IN (
      SELECT s.barber_id FROM staff s
      WHERE s.email = (auth.jwt() ->> 'email') AND s.status = 'verified'
    )
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'
    )
  )
  WITH CHECK (
    google_email = (auth.jwt() ->> 'email')
    OR id IN (
      SELECT s.barber_id FROM staff s
      WHERE s.email = (auth.jwt() ->> 'email') AND s.status = 'verified'
    )
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = (auth.jwt() ->> 'email') AND s.role = 'admin' AND s.status = 'verified'
    )
  );

-- 2. Ultra-reliable SECURITY DEFINER RPC function for profile photo updates
CREATE OR REPLACE FUNCTION update_my_barber_photo(
  p_barber_id text,
  p_photo_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_matched_id text;
BEGIN
  v_email := lower(trim(auth.jwt() ->> 'email'));
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Match barber id to this user's email or check if admin
  SELECT b.id INTO v_matched_id
  FROM public.barbers b
  WHERE (b.id = p_barber_id AND lower(trim(coalesce(b.google_email, ''))) = v_email)
     OR (b.id = p_barber_id AND b.id IN (
       SELECT s.barber_id FROM public.staff s
       WHERE lower(trim(s.email)) = v_email AND s.status = 'verified'
     ))
     OR EXISTS (
       SELECT 1 FROM public.staff s
       WHERE lower(trim(s.email)) = v_email AND s.role = 'admin' AND s.status = 'verified'
     )
  LIMIT 1;

  IF v_matched_id IS NULL THEN
    RAISE EXCEPTION 'No tienes permiso para actualizar este perfil';
  END IF;

  UPDATE public.barbers
  SET photo_url = p_photo_url
  WHERE id = v_matched_id;

  RETURN jsonb_build_object(
    'success', true,
    'barber_id', v_matched_id,
    'photo_url', p_photo_url
  );
END;
$$;
