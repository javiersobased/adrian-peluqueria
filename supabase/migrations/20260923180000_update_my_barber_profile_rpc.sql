-- ============================================================
-- Barber Profile Self-Update & SuperAdmin / Admin RPC
-- Allows barbers, adrian, and developer to update name, initials, and photo_url
-- ============================================================

CREATE OR REPLACE FUNCTION update_my_barber_profile(
  p_barber_id text,
  p_name text DEFAULT NULL,
  p_photo_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_matched_id text;
  v_initials text;
BEGIN
  v_email := lower(trim(auth.jwt() ->> 'email'));
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Match barber id to this user's email or check if admin / dev
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
     OR v_email = 'franciscojavierfarinapadilla@gmail.com'
     OR v_email IN ('adrian.millan.peguero@hotmail.com', 'adrianmillanpeguero1994@hotmail.com')
  LIMIT 1;

  IF v_matched_id IS NULL THEN
    RAISE EXCEPTION 'No tienes permiso para actualizar este perfil';
  END IF;

  IF p_name IS NOT NULL AND trim(p_name) <> '' THEN
    SELECT string_agg(substring(word from 1 for 1), '')
    INTO v_initials
    FROM regexp_split_to_table(trim(p_name), '\s+') AS word;
    v_initials := upper(substring(v_initials from 1 for 2));

    UPDATE public.barbers
    SET name = trim(p_name),
        initials = coalesce(v_initials, initials)
    WHERE id = v_matched_id;
  END IF;

  IF p_photo_url IS NOT NULL THEN
    IF p_photo_url = '' OR p_photo_url = 'null' THEN
      UPDATE public.barbers
      SET photo_url = NULL
      WHERE id = v_matched_id;
    ELSE
      UPDATE public.barbers
      SET photo_url = p_photo_url
      WHERE id = v_matched_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'barber_id', v_matched_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION update_my_barber_profile(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_my_barber_profile(text, text, text) TO anon;
