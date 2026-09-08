import { useState, useCallback } from 'react';
import type { Service, Barber, BookingForm, SavedBooking } from '@/types';
import type { PendingBookingPayload } from '@/lib/pendingBooking';
import { clearPendingBooking } from '@/lib/pendingBooking';
import { insertBooking } from '@/lib/bookings';

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

  /** Builds the exact row to insert from the current selections + the details form. */
  const buildPayload = useCallback(
    (form: BookingForm): PendingBookingPayload | null => {
      if (!barber || !service || !date || !time) return null;
      return {
        service: service.name,
        service_price: service.price,
        barber: barber.id,
        booking_date: date,
        booking_time: time,
        full_name: form.fullName,
        phone: form.phone,
        email: form.email,
        comments: form.comments || null,
      };
    },
    [barber, service, date, time]
  );

  /** Inserts the booking for an already-authenticated user and jumps to the success screen. */
  const submitBooking = useCallback(
    async (form: BookingForm, userId: string) => {
      const payload = buildPayload(form);
      if (!payload) return;
      setSubmitting(true);
      setError(null);
      try {
        const saved = await insertBooking(payload, userId);
        clearPendingBooking();
        setConfirmation(saved);
        setStep('success');
      } catch {
        setError('No se pudo guardar la reserva. Inténtalo de nuevo.');
      } finally {
        setSubmitting(false);
      }
    },
    [buildPayload]
  );

  /** Used after a Google login redirect: the payload came from localStorage, not live state. */
  const applyExternalConfirmation = useCallback((saved: SavedBooking) => {
    setConfirmation(saved);
    setStep('success');
  }, []);

  const reset = useCallback(() => {
    clearPendingBooking();
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
    buildPayload,
    submitBooking,
    applyExternalConfirmation,
    reset,
  };
}
