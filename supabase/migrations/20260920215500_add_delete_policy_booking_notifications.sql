-- Migration: Allow delete policy for booking_notifications
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'booking_notifications' AND policyname = 'Allow delete for booking_notifications'
  ) THEN
    CREATE POLICY "Allow delete for booking_notifications" ON public.booking_notifications FOR DELETE USING (true);
  END IF;
END $$;
