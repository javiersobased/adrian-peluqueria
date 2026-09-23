-- ==============================================================================
-- CodeRabbit Security Audit Remediation
-- 1. Hardening booking_notifications RLS (Protect client PII: names, phones, emails)
-- 2. Revoking anon EXECUTE privileges on barber profile update and internal routines
-- 3. Persistent database-backed idempotency table and atomic lock RPC for emails & push
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Hardening public.booking_notifications
-- ------------------------------------------------------------------------------

-- Ensure RLS is active
ALTER TABLE IF EXISTS public.booking_notifications ENABLE ROW LEVEL SECURITY;

-- Drop all insecure permissive public policies
DROP POLICY IF EXISTS "Allow all read access for booking_notifications" ON public.booking_notifications;
DROP POLICY IF EXISTS "Allow delete for booking_notifications" ON public.booking_notifications;
DROP POLICY IF EXISTS "Allow insert for booking_notifications" ON public.booking_notifications;
DROP POLICY IF EXISTS "Allow update for booking_notifications" ON public.booking_notifications;
DROP POLICY IF EXISTS "staff_read_booking_notifications" ON public.booking_notifications;
DROP POLICY IF EXISTS "staff_update_booking_notifications" ON public.booking_notifications;
DROP POLICY IF EXISTS "staff_delete_booking_notifications" ON public.booking_notifications;
DROP POLICY IF EXISTS "staff_insert_booking_notifications" ON public.booking_notifications;

-- Revoke all direct permissions from anon and public roles
REVOKE ALL ON TABLE public.booking_notifications FROM anon, public;
GRANT SELECT, UPDATE, DELETE ON TABLE public.booking_notifications TO authenticated;

-- Create strict policies allowing ONLY verified staff / admin
CREATE POLICY "staff_read_booking_notifications" ON public.booking_notifications
  FOR SELECT TO authenticated
  USING (public.is_admin_or_verified_staff());

CREATE POLICY "staff_update_booking_notifications" ON public.booking_notifications
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_verified_staff())
  WITH CHECK (public.is_admin_or_verified_staff());

CREATE POLICY "staff_delete_booking_notifications" ON public.booking_notifications
  FOR DELETE TO authenticated
  USING (public.is_admin_or_verified_staff());

CREATE POLICY "staff_insert_booking_notifications" ON public.booking_notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_verified_staff());


-- ------------------------------------------------------------------------------
-- 2. Revoking anon EXECUTE on Barber Profile Update & Internal Trigger Functions
-- ------------------------------------------------------------------------------

-- Revoke anon on update_my_barber_profile
REVOKE EXECUTE ON FUNCTION public.update_my_barber_profile(text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_my_barber_profile(text, text, text) TO authenticated;

-- Revoke anon on update_my_barber_photo if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_my_barber_photo') THEN
    REVOKE EXECUTE ON FUNCTION public.update_my_barber_photo(text, text) FROM anon, public;
    GRANT EXECUTE ON FUNCTION public.update_my_barber_photo(text, text) TO authenticated;
  END IF;
END $$;

-- Revoke anon on trigger_booking_activity_notification
REVOKE EXECUTE ON FUNCTION public.trigger_booking_activity_notification() FROM anon, public;


-- ------------------------------------------------------------------------------
-- 3. Persistent Database Idempotency for Emails and Notifications
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text UNIQUE NOT NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on idempotency table
ALTER TABLE public.notification_idempotency ENABLE ROW LEVEL SECURITY;

-- Allow only verified staff to view idempotency logs
DROP POLICY IF EXISTS "staff_read_idempotency" ON public.notification_idempotency;
CREATE POLICY "staff_read_idempotency" ON public.notification_idempotency
  FOR SELECT TO authenticated
  USING (public.is_admin_or_verified_staff());

-- Atomic lock / claim RPC function
CREATE OR REPLACE FUNCTION public.acquire_notification_idempotency(
  p_key text,
  p_booking_id uuid DEFAULT NULL,
  p_type text DEFAULT 'email',
  p_recipient text DEFAULT ''
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_key IS NULL OR trim(p_key) = '' THEN
    RETURN true;
  END IF;

  INSERT INTO public.notification_idempotency (
    idempotency_key, booking_id, notification_type, recipient, status
  ) VALUES (
    trim(p_key), p_booking_id, coalesce(p_type, 'email'), trim(coalesce(p_recipient, '')), 'sent'
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  IF FOUND THEN
    RETURN true; -- Acquired slot: proceed to dispatch
  ELSE
    RETURN false; -- Already exists: duplicate dispatch prevented
  END IF;
END;
$$;

-- Secure execution of the idempotency RPC
REVOKE EXECUTE ON FUNCTION public.acquire_notification_idempotency(text, uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.acquire_notification_idempotency(text, uuid, text, text) TO authenticated, service_role;
