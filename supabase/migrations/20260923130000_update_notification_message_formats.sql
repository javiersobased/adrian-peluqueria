-- Migration: Update booking activity notification formats and categories
-- 1. Manual bookings: title = 'Nueva cita manual', message = '[Barbero] ha reservado una cita para [cliente] para el DD/MM/YY a las HH:MMh'
-- 2. Online customer bookings: title = 'Nueva cita reservada', message = '[cliente] ha reservado cita para el DD/MM/YY a las HH:MMh'
-- 3. Format all dates as 2-digit year (DD/MM/YY)
-- 4. Exclude service name and price from message body (service is shown cleanly below in details)

CREATE OR REPLACE FUNCTION public.trigger_booking_activity_notification()
RETURNS TRIGGER AS $$
DECLARE
  barber_display_name text;
  formatted_date text;
  formatted_old_date text;
  clean_time text;
  clean_old_time text;
BEGIN
  -- Determine barber display name
  barber_display_name := CASE NEW.barber
    WHEN 'adrian' THEN 'Adrián'
    WHEN 'luna' THEN 'David Luna'
    ELSE NEW.barber
  END;

  formatted_date := to_char(NEW.booking_date, 'DD/MM/YY');
  clean_time := regexp_replace(COALESCE(NEW.booking_time, ''), '\s*h$', '', 'i');

  IF OLD IS NOT NULL AND OLD.booking_date IS NOT NULL THEN
    formatted_old_date := to_char(OLD.booking_date, 'DD/MM/YY');
  END IF;
  IF OLD IS NOT NULL AND OLD.booking_time IS NOT NULL THEN
    clean_old_time := regexp_replace(OLD.booking_time, '\s*h$', '', 'i');
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_notifications (
      booking_id, type, title, message, client_name, client_phone, client_email, barber, service, service_price, booking_date, booking_time
    ) VALUES (
      NEW.id,
      CASE WHEN NEW.status = 'cancelled' THEN 'cancelled' ELSE 'created' END,
      CASE
        WHEN NEW.status = 'cancelled' THEN 'Cita cancelada'
        WHEN NEW.user_id IS NULL THEN 'Nueva cita manual'
        ELSE 'Nueva cita reservada'
      END,
      CASE
        WHEN NEW.status = 'cancelled'
          THEN NEW.full_name || ' ha cancelado su cita del ' || formatted_date || ' a las ' || clean_time || 'h'
        WHEN NEW.user_id IS NULL
          THEN barber_display_name || ' ha reservado una cita para ' || NEW.full_name || ' para el ' || formatted_date || ' a las ' || clean_time || 'h'
        ELSE NEW.full_name || ' ha reservado cita para el ' || formatted_date || ' a las ' || clean_time || 'h'
      END,
      NEW.full_name,
      NEW.phone,
      NEW.email,
      NEW.barber,
      NEW.service,
      NEW.service_price,
      NEW.booking_date,
      NEW.booking_time
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
      INSERT INTO public.booking_notifications (
        booking_id, type, title, message, client_name, client_phone, client_email, barber, service, service_price, booking_date, booking_time, old_date, old_time, old_barber
      ) VALUES (
        NEW.id,
        'cancelled',
        'Cita cancelada',
        NEW.full_name || ' ha cancelado su cita del ' || to_char(OLD.booking_date, 'DD/MM/YY') || ' a las ' || clean_old_time || 'h',
        NEW.full_name,
        NEW.phone,
        NEW.email,
        NEW.barber,
        NEW.service,
        NEW.service_price,
        NEW.booking_date,
        NEW.booking_time,
        OLD.booking_date,
        OLD.booking_time,
        OLD.barber
      );
    ELSIF OLD.booking_date != NEW.booking_date OR OLD.booking_time != NEW.booking_time OR OLD.barber != NEW.barber THEN
      INSERT INTO public.booking_notifications (
        booking_id, type, title, message, client_name, client_phone, client_email, barber, service, service_price, booking_date, booking_time, old_date, old_time, old_barber
      ) VALUES (
        NEW.id,
        'rescheduled',
        'Cita reprogramada / modificada',
        'Cita de ' || NEW.full_name || ' cambiada del ' || to_char(OLD.booking_date, 'DD/MM/YY') || ' a las ' || clean_old_time || 'h al ' || formatted_date || ' a las ' || clean_time || 'h' || CASE WHEN OLD.barber != NEW.barber THEN ' (Reasignada a ' || barber_display_name || ')' ELSE '' END,
        NEW.full_name,
        NEW.phone,
        NEW.email,
        NEW.barber,
        NEW.service,
        NEW.service_price,
        NEW.booking_date,
        NEW.booking_time,
        OLD.booking_date,
        OLD.booking_time,
        OLD.barber
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing records in booking_notifications to match standard format
UPDATE public.booking_notifications n
SET
  title = CASE 
    WHEN n.type = 'created' AND b.user_id IS NULL THEN 'Nueva cita manual'
    ELSE n.title
  END,
  message = CASE
    WHEN n.type = 'created' AND b.user_id IS NULL THEN
      (CASE n.barber WHEN 'adrian' THEN 'Adrián' WHEN 'luna' THEN 'David Luna' ELSE n.barber END) || ' ha reservado una cita para ' || n.client_name || ' para el ' || to_char(n.booking_date, 'DD/MM/YY') || ' a las ' || regexp_replace(COALESCE(n.booking_time, ''), '\s*h$', '', 'i') || 'h'
    WHEN n.type = 'created' THEN
      n.client_name || ' ha reservado cita para el ' || to_char(n.booking_date, 'DD/MM/YY') || ' a las ' || regexp_replace(COALESCE(n.booking_time, ''), '\s*h$', '', 'i') || 'h'
    WHEN n.type = 'cancelled' THEN
      n.client_name || ' ha cancelado su cita del ' || to_char(COALESCE(n.booking_date, n.old_date), 'DD/MM/YY') || ' a las ' || regexp_replace(COALESCE(n.booking_time, n.old_time, ''), '\s*h$', '', 'i') || 'h'
    WHEN n.type = 'rescheduled' THEN
      'Cita de ' || n.client_name || ' cambiada del ' || to_char(n.old_date, 'DD/MM/YY') || ' a las ' || regexp_replace(COALESCE(n.old_time, ''), '\s*h$', '', 'i') || 'h al ' || to_char(n.booking_date, 'DD/MM/YY') || ' a las ' || regexp_replace(COALESCE(n.booking_time, ''), '\s*h$', '', 'i') || 'h'
    ELSE n.message
  END
FROM public.bookings b
WHERE n.booking_id = b.id;
