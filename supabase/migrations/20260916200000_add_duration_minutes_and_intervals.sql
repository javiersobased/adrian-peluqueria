-- ============================================================
-- Migration: Add duration_minutes to services and get_booked_intervals RPC
-- ============================================================

-- 1. Ensure duration_minutes column exists on services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS duration_minutes integer;

-- 2. Populate duration_minutes from existing duration text (e.g. '10min' -> 10, '30min' -> 30)
UPDATE public.services
SET duration_minutes = substring(duration from '(\d+)')::integer
WHERE duration_minutes IS NULL AND duration ~ '\d+';

-- Set default fallback to 30 where null
UPDATE public.services
SET duration_minutes = 30
WHERE duration_minutes IS NULL;

-- 3. Create get_booked_intervals RPC function
-- Exposes booking_time and service name for slot overlap calculation without revealing customer data
CREATE OR REPLACE FUNCTION public.get_booked_intervals(p_barber text, p_date date)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'booking_time', b.booking_time,
        'service', b.service
      )
    ),
    '[]'::jsonb
  )
  FROM public.bookings b
  WHERE b.barber = p_barber
    AND b.booking_date = p_date
    AND b.status != 'cancelled';
$$;

GRANT EXECUTE ON FUNCTION public.get_booked_intervals(text, date) TO anon, authenticated;
