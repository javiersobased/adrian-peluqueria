-- SaaS multi-tenant · Paso 4b (integraciones por negocio para Edge Functions).
-- * business_integrations: remitente, reply-to, URL pública y app de OneSignal por negocio.
--   Las API keys viven cifradas en Supabase Vault; aquí solo se guarda el nombre del secreto.
-- * get_business_integration(): única vía de lectura, exclusiva de service_role (Edge Functions).
-- * acquire_notification_idempotency(): recibe el negocio y deja de ser invocable desde el navegador.
-- Rollback: supabase/rollback/20260924010000_saas_business_integrations_down.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.business_integrations (
  business_id              uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE RESTRICT,
  email_from               text CHECK (email_from IS NULL OR email_from ~ '^([^<>]*<)?[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+>?$'),
  email_reply_to           text CHECK (email_reply_to IS NULL OR email_reply_to ~ '^[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+$'),
  site_url                 text CHECK (site_url IS NULL OR site_url ~ '^https://[a-z0-9.-]+$'),
  resend_api_key_secret    text,
  onesignal_app_id         uuid,
  onesignal_api_key_secret text,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_integrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_integrations FROM PUBLIC, anon, authenticated;

-- Tenant heredado: valores que hoy están codificados en las funciones. Sus API keys siguen
-- saliendo de los secretos globales del proyecto (solo el tenant heredado puede usarlos).
INSERT INTO public.business_integrations (business_id, email_from, email_reply_to, site_url, onesignal_app_id)
VALUES (
  'f67af497-5e58-48a2-8bea-022c4f1d7e1a',
  'Peluquería Adrián Millán <citas@adrianmillan.es>',
  'adrian.millan.peguero@hotmail.com',
  'https://www.adrianmillan.es',
  '86a6a369-9e5f-472b-8461-cac4fb762af7'
)
ON CONFLICT (business_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_business_integration(p_business_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'business_id', b.id,
    'name', b.name,
    'slug', b.slug,
    'status', b.status,
    'timezone', b.timezone,
    'is_legacy', b.id = public.legacy_business_id(),
    'email_from', i.email_from,
    'email_reply_to', i.email_reply_to,
    'site_url', coalesce(
      i.site_url,
      (SELECT 'https://' || d.hostname FROM public.business_domains d
       WHERE d.business_id = b.id AND d.is_primary AND d.status = 'active' LIMIT 1)
    ),
    'onesignal_app_id', i.onesignal_app_id,
    'resend_api_key', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = i.resend_api_key_secret),
    'onesignal_api_key', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = i.onesignal_api_key_secret)
  )
  FROM public.businesses b
  LEFT JOIN public.business_integrations i ON i.business_id = b.id
  WHERE b.id = p_business_id
$$;

DROP FUNCTION public.acquire_notification_idempotency(text, uuid, text, text);
CREATE FUNCTION public.acquire_notification_idempotency(
  p_key text, p_booking_id uuid DEFAULT NULL, p_type text DEFAULT 'email', p_recipient text DEFAULT '',
  p_business_id uuid DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_business_id uuid;
BEGIN
  IF p_key IS NULL OR trim(p_key) = '' THEN
    RETURN true;
  END IF;

  IF p_booking_id IS NOT NULL THEN
    SELECT b.business_id INTO v_business_id FROM public.bookings b WHERE b.id = p_booking_id;
    IF v_business_id IS NULL THEN
      RAISE EXCEPTION 'Reserva % inexistente', p_booking_id;
    END IF;
    IF p_business_id IS NOT NULL AND p_business_id <> v_business_id THEN
      RAISE EXCEPTION 'La reserva no pertenece al negocio indicado';
    END IF;
  ELSE
    v_business_id := coalesce(p_business_id, public.legacy_business_id());
  END IF;

  INSERT INTO public.notification_idempotency (
    business_id, idempotency_key, booking_id, notification_type, recipient, status
  ) VALUES (
    v_business_id, trim(p_key), p_booking_id, coalesce(p_type, 'email'), trim(coalesce(p_recipient, '')), 'sent'
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.get_business_integration(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acquire_notification_idempotency(text, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_integration(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_notification_idempotency(text, uuid, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.legacy_business_id() TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
