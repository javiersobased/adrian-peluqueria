-- Migration: Automatically delete booking notifications after the scheduled appointment day has passed

-- 1. Helper function to purge expired notifications from public.booking_notifications
CREATE OR REPLACE FUNCTION public.cleanup_expired_booking_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM public.booking_notifications
  WHERE (booking_date IS NOT NULL AND booking_date < CURRENT_DATE)
     OR (booking_date IS NULL AND old_date IS NOT NULL AND old_date < CURRENT_DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update trigger function to automatically run cleanup on every booking activity
CREATE OR REPLACE FUNCTION public.trigger_booking_activity_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_notifications (
      booking_id, type, title, message, client_name, client_phone, client_email, barber, service, service_price, booking_date, booking_time
    ) VALUES (
      NEW.id,
      CASE WHEN NEW.status = 'cancelled' THEN 'cancelled' ELSE 'created' END,
      CASE WHEN NEW.status = 'cancelled' THEN 'Cita cancelada' ELSE 'Nueva cita reservada' END,
      CASE WHEN NEW.status = 'cancelled'
        THEN NEW.full_name || ' ha cancelado su cita del ' || to_char(NEW.booking_date, 'DD/MM/YYYY') || ' a las ' || NEW.booking_time || 'h'
        ELSE NEW.full_name || ' ha reservado cita para el ' || to_char(NEW.booking_date, 'DD/MM/YYYY') || ' a las ' || NEW.booking_time || 'h (' || NEW.service || ')'
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
        NEW.full_name || ' ha cancelado su cita del ' || to_char(OLD.booking_date, 'DD/MM/YYYY') || ' a las ' || OLD.booking_time || 'h',
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
        'Cita de ' || NEW.full_name || ' cambiada de ' || to_char(OLD.booking_date, 'DD/MM/YYYY') || ' ' || OLD.booking_time || 'h a ' || to_char(NEW.booking_date, 'DD/MM/YYYY') || ' ' || NEW.booking_time || 'h' || CASE WHEN OLD.barber != NEW.barber THEN ' (Reasignada a ' || NEW.barber || ')' ELSE '' END,
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

  -- Automatically delete notifications for appointments whose planned date has passed
  PERFORM public.cleanup_expired_booking_notifications();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Initial cleanup run for existing past-date notifications
SELECT public.cleanup_expired_booking_notifications();
