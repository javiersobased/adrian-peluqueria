import { useState, useCallback, useRef } from 'react';
import type { Service, Barber, BookingForm, SavedBooking } from '@/types';
import type { PendingBookingPayload } from '@/lib/pendingBooking';
import { clearPendingBooking } from '@/lib/pendingBooking';
import { createBooking, findExistingBooking } from '@/lib/bookings';
import { fetchAllServices, fetchAllBarbers } from '@/data/services';
import { supabase } from '@/lib/supabase';
import { updateOneSignalMarketingConsent } from '@/lib/onesignal';

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
  const submittingRef = useRef(false);

  const startBooking = useCallback(() => {
    setError(null);
    setStep('service');
  }, []);

  const selectService = useCallback((s: Service) => {
    setService(s);
    setStep('barber');
  }, []);

  const selectBarber = useCallback((b: Barber) => {
    setBarber(b);
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
      if (prev === 'datetime') return 'barber';
      if (prev === 'barber') return 'service';
      if (prev === 'service') return 'landing';
      return prev;
    });
  }, []);

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
        comments: form.comments || null,
        marketing_accepted: form.marketingAccepted,
      };
    },
    [barber, service, date, time]
  );

  const submitBooking = useCallback(
    async (form: BookingForm) => {
      if (submittingRef.current) return;
      const payload = buildPayload(form);
      if (!payload) return;

      submittingRef.current = true;
      setSubmitting(true);
      setError(null);
      try {
        const { booking, error: rpcError } = await createBooking(payload);
        if (rpcError) throw new Error(rpcError);
        clearPendingBooking();

        // Sincronizar preferencia de marketing comercial si fue seleccionada
        if (form.marketingAccepted !== undefined) {
          const accepted = Boolean(form.marketingAccepted);
          localStorage.setItem('marketing_accepted', accepted ? 'true' : 'false');
          supabase.auth.updateUser({ data: { marketing_accepted: accepted } }).catch(() => {});
          updateOneSignalMarketingConsent(accepted).catch(() => {});
          if (booking?.user_id) {
            supabase
              .from('customers')
              .update({ marketing_accepted: accepted, updated_at: new Date().toISOString() })
              .eq('user_id', booking.user_id)
              .then(null, () => {});
          }
        }

        if (booking) {
          setConfirmation(booking);
          setStep('success');
        } else {
          const fallback = await findExistingBooking(payload.barber, payload.booking_date, payload.booking_time);
          if (fallback) {
            setConfirmation(fallback);
            setStep('success');
          } else {
            setError('No se pudo confirmar la reserva. Inténtalo de nuevo en unos segundos.');
          }
        }
      } catch (e) {
        console.error('Error al crear reserva:', e);
        const msg = e instanceof Error ? e.message : '';

        // Check if the booking actually went through despite the error
        const existing = await findExistingBooking(payload.barber, payload.booking_date, payload.booking_time);
        if (existing) {
          clearPendingBooking();
          if (form.marketingAccepted !== undefined) {
            const accepted = Boolean(form.marketingAccepted);
            localStorage.setItem('marketing_accepted', accepted ? 'true' : 'false');
            supabase.auth.updateUser({ data: { marketing_accepted: accepted } }).catch(() => {});
            updateOneSignalMarketingConsent(accepted).catch(() => {});
          }
          setConfirmation(existing);
          setStep('success');
          return;
        }

        if (
          msg.includes('already booked') ||
          msg.includes('time slot') ||
          msg.includes('ya está reservado') ||
          msg.includes('idx_bookings_unique_active_slot')
        ) {
          setError('Ese horario ya no está disponible. Por favor, elige otra hora.');
          setStep('datetime');
        } else if (msg) {
          setError(msg);
        } else {
          setError('No se pudo confirmar la reserva. Inténtalo de nuevo en unos segundos.');
        }
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [buildPayload]
  );

  const applyExternalConfirmation = useCallback((saved: SavedBooking) => {
    setConfirmation(saved);
    setStep('success');
  }, []);

  const restorePending = useCallback(async (payload: PendingBookingPayload) => {
    try {
      const [services, barbers] = await Promise.all([
        fetchAllServices(),
        fetchAllBarbers(),
      ]);
      const s = services.find((x) => x.name === payload.service) || {
        id: 'custom',
        name: payload.service,
        price: payload.service_price,
        duration: '30 min',
        icon: 'scissors',
        sort_order: 1,
        active: true,
      };
      const b = barbers.find((x) => x.id === payload.barber) || null;
      setService(s);
      setBarber(b);
      setDate(payload.booking_date);
      setTime(payload.booking_time);
      setError('Por favor, confirma tu cita ahora que has iniciado sesión.');
      setStep('details');
    } catch {
      setStep('landing');
    }
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
    restorePending,
    reset,
  };
}
