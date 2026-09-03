import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Service, Barber, BookingForm, SavedBooking } from '@/types';

export type BookingStep = 'landing' | 'barber' | 'service' | 'datetime' | 'details' | 'success';

export function useBooking() {
  const [step, setStep] = useState<BookingStep>('landing');
  const [barber, setBarber] = useState<Barber | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [confirmation, setConfirmation] = useState<SavedBooking | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startBooking = useCallback(() => {
    setError(null);
    setStep('barber');
  }, []);

  const selectBarber = useCallback((b: Barber) => {
    setBarber(b);
    setStep('service');
  }, []);

  const selectService = useCallback((s: Service) => {
    setService(s);
    setStep('datetime');
  }, []);

  const selectDateTime = useCallback((d: string, t: string) => {
    setDate(d);
    setTime(t);
    setStep('details');
  }, []);

  const goBack = useCallback(() => {
    setStep((prev) => {
      if (prev === 'details') return 'datetime';
      if (prev === 'datetime') return 'service';
      if (prev === 'service') return 'barber';
      if (prev === 'barber') return 'landing';
      return prev;
    });
  }, []);

  const submitBooking = useCallback(
    async (form: BookingForm) => {
      if (!barber || !service || !date || !time) return;
      setSubmitting(true);
      setError(null);
      try {
        const { data, error: insertError } = await supabase
          .from('bookings')
          .insert({
            service: service.name,
            service_price: service.price,
            barber: barber.id,
            booking_date: date,
            booking_time: time,
            full_name: form.fullName,
            phone: form.phone,
            email: form.email,
            comments: form.comments || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setConfirmation(data as SavedBooking);
        setStep('success');
      } catch (e) {
        setError('No se pudo guardar la reserva. Inténtalo de nuevo.');
      } finally {
        setSubmitting(false);
      }
    },
    [barber, service, date, time]
  );

  const reset = useCallback(() => {
    setBarber(null);
    setService(null);
    setDate('');
    setTime('');
    setConfirmation(null);
    setError(null);
    setStep('landing');
  }, []);

  return {
    step,
    barber,
    service,
    date,
    time,
    confirmation,
    submitting,
    error,
    startBooking,
    selectBarber,
    selectService,
    selectDateTime,
    goBack,
    submitBooking,
    reset,
  };
}
