-- Migration: Create booking_notifications table and trigger for live admin notifications

CREATE TABLE IF NOT EXISTS public.booking_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID,
  type TEXT NOT NULL CHECK (type IN ('created', 'cancelled', 'rescheduled')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  barber TEXT NOT NULL,
  service TEXT,
  service_price INTEGER,
  booking_date DATE,
  booking_time TEXT,
  old_date DATE,
  old_time TEXT,
  old_barber TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_booking_notifs_created_at ON public.booking_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_notifs_barber ON public.booking_notifications(barber);
CREATE INDEX IF NOT EXISTS idx_booking_notifs_read ON public.booking_notifications(read);

-- RLS
ALTER TABLE public.booking_notifications ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'booking_notifications' AND policyname = 'Allow all read access for booking_notifications'
  ) THEN
    CREATE POLICY "Allow all read access for booking_notifications" ON public.booking_notifications FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'booking_notifications' AND policyname = 'Allow insert for booking_notifications'
  ) THEN
    CREATE POLICY "Allow insert for booking_notifications" ON public.booking_notifications FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'booking_notifications' AND policyname = 'Allow update for booking_notifications'
  ) THEN
    CREATE POLICY "Allow update for booking_notifications" ON public.booking_notifications FOR UPDATE USING (true);
  END IF;
END $$;

-- Trigger function for automatic activity logging
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_booking_activity_notification ON public.bookings;
CREATE TRIGGER trg_booking_activity_notification
AFTER INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.trigger_booking_activity_notification();

-- Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'booking_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_notifications;
  END IF;
END $$;
