-- 1. Function to enforce column-level security and status integrity on bookings table
CREATE OR REPLACE FUNCTION public.validate_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- 1. If admin or verified staff, allow full update
  IF public.is_admin_or_verified_staff() THEN
    RETURN NEW;
  END IF;

  -- 2. Verify row ownership for non-staff
  IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You can only modify your own bookings';
  END IF;

  -- 3. If update is coming from reschedule_booking RPC:
  IF current_setting('app.rescheduling', true) = 'true' THEN
    -- Only permit booking_date and booking_time to change
    IF NEW.service IS DISTINCT FROM OLD.service OR
       NEW.service_price IS DISTINCT FROM OLD.service_price OR
       NEW.barber IS DISTINCT FROM OLD.barber OR
       NEW.full_name IS DISTINCT FROM OLD.full_name OR
       NEW.phone IS DISTINCT FROM OLD.phone OR
       NEW.email IS DISTINCT FROM OLD.email OR
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Forbidden: Tampering with booking metadata during reschedule is prohibited';
    END IF;
    RETURN NEW;
  END IF;

  -- 4. Regular customer update (e.g. cancellation):
  -- Core details cannot be modified directly via REST API
  IF NEW.service IS DISTINCT FROM OLD.service OR
     NEW.service_price IS DISTINCT FROM OLD.service_price OR
     NEW.barber IS DISTINCT FROM OLD.barber OR
     NEW.booking_date IS DISTINCT FROM OLD.booking_date OR
     NEW.booking_time IS DISTINCT FROM OLD.booking_time OR
     NEW.full_name IS DISTINCT FROM OLD.full_name OR
     NEW.phone IS DISTINCT FROM OLD.phone OR
     NEW.email IS DISTINCT FROM OLD.email OR
     NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Forbidden: Customers cannot alter booking details directly. Use reschedule_booking for date/time changes.';
  END IF;

  -- 5. Customer status transition can ONLY be to 'cancelled'
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status != 'cancelled' THEN
      RAISE EXCEPTION 'Forbidden: Customers can only cancel their bookings';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_validate_booking_update ON public.bookings;
CREATE TRIGGER trg_validate_booking_update
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_booking_update();

-- Revoke direct execute on trigger function
REVOKE EXECUTE ON FUNCTION public.validate_booking_update() FROM PUBLIC, anon, authenticated;

-- 2. Update reschedule_booking to set app.rescheduling transaction context
CREATE OR REPLACE FUNCTION public.reschedule_booking(p_booking_id uuid, p_new_date date, p_new_time text)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_barber text;
  v_row public.bookings;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT barber INTO v_barber
  FROM public.bookings
  WHERE id = p_booking_id
    AND user_id = v_user_id
    AND status != 'cancelled';

  IF v_barber IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE barber = v_barber
      AND booking_date = p_new_date
      AND booking_time = p_new_time
      AND status != 'cancelled'
      AND id != p_booking_id
  ) THEN
    RAISE EXCEPTION 'This time slot is already booked';
  END IF;

  -- Set transaction-local setting to signal authorized rescheduling
  PERFORM set_config('app.rescheduling', 'true', true);

  UPDATE public.bookings
  SET booking_date = p_new_date,
      booking_time = p_new_time
  WHERE id = p_booking_id
    AND user_id = v_user_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Ensure execute permissions on reschedule_booking
REVOKE EXECUTE ON FUNCTION public.reschedule_booking(uuid, date, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_booking(uuid, date, text) TO authenticated;
