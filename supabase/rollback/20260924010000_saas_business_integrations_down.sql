-- Revierte el Paso 4b en base de datos. Redesplegar antes las Edge Functions del commit anterior,
-- porque las versiones nuevas dependen de get_business_integration().

BEGIN;

DROP FUNCTION IF EXISTS public.get_business_integration(uuid);

DROP FUNCTION IF EXISTS public.acquire_notification_idempotency(text, uuid, text, text, uuid);
CREATE FUNCTION public.acquire_notification_idempotency(
  p_key text, p_booking_id uuid DEFAULT NULL, p_type text DEFAULT 'email', p_recipient text DEFAULT ''
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_key IS NULL OR trim(p_key) = '' THEN
    RETURN true;
  END IF;

  INSERT INTO public.notification_idempotency (
    business_id, idempotency_key, booking_id, notification_type, recipient, status
  ) VALUES (
    coalesce((SELECT b.business_id FROM public.bookings b WHERE b.id = p_booking_id), public.legacy_business_id()),
    trim(p_key), p_booking_id, coalesce(p_type, 'email'), trim(coalesce(p_recipient, '')), 'sent'
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.acquire_notification_idempotency(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acquire_notification_idempotency(text, uuid, text, text) TO authenticated, service_role;

DROP TABLE IF EXISTS public.business_integrations;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260924010000';

NOTIFY pgrst, 'reload schema';

COMMIT;
