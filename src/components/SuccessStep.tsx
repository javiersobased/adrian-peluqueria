import { CheckIcon, CalendarIcon, ClockIcon, HomeIcon } from '@/components/icons';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { SavedBooking, Barber } from '@/types';
import { safeCap, googleCalendarUrl, downloadIcs } from '@/lib/calendar';
import { sendBookingEmail } from '@/lib/email';
import { SALON_ADDRESS } from '@/data/services';
import { CalendarPlus, Apple, Mail } from 'lucide-react';

interface SuccessStepProps {
  booking: SavedBooking;
  onHome: () => void;
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function prettyDate(iso: string | null | undefined): string {
  if (!iso) return 'Fecha por confirmar';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return 'Fecha por confirmar';
  return `${safeCap(MONTHS_ES[d.getMonth()])} ${d.getDate()}, ${d.getFullYear()}`;
}

export function SuccessStep({ booking, onHome }: SuccessStepProps) {
  const [barber, setBarber] = useState<Barber | null>(null);
  const [showModal, setShowModal] = useState(true);

  useEffect(() => {
    if (!booking?.barber) return;
    supabase
      .from('barbers')
      .select('*')
      .eq('id', booking.barber)
      .maybeSingle()
      .then(({ data }) => setBarber(data as Barber | null));
  }, [booking?.barber]);

  useEffect(() => {
    if (booking?.id && booking?.email) {
      sendBookingEmail(booking);
    }
  }, [booking?.id, booking?.email]);

  const gcalUrl = googleCalendarUrl({
    title: `Cita: ${booking?.service ?? 'Peluquería'}`,
    date: booking?.booking_date ?? '',
    time: booking?.booking_time ?? '',
    durationMin: 30,
    location: SALON_ADDRESS,
    details: `Barbero: ${barber?.name ?? booking?.barber ?? ''}`,
  });

  const handleAppleCalendar = () => {
    downloadIcs({
      title: `Cita: ${booking?.service ?? 'Peluquería'}`,
      date: booking?.booking_date ?? '',
      time: booking?.booking_time ?? '',
      durationMin: 30,
      location: SALON_ADDRESS,
      description: `Barbero: ${barber?.name ?? booking?.barber ?? ''}`,
    });
  };

  const safeTime = booking?.booking_time ?? '--:--';
  const safeName = booking?.full_name ?? 'Cliente';
  const safeService = booking?.service ?? 'Servicio';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center animate-fade-in">
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-ping rounded-full bg-gold/20" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full gold-gradient luxe-shadow animate-scale-in gold-glow">
          <CheckIcon className="h-12 w-12 text-black" />
        </div>
      </div>

      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Reserva confirmada</p>
      <h2 className="mt-3 font-display text-4xl font-bold text-white">¡Hasta pronto!</h2>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-400">
        Tu cita ha sido registrada correctamente. Te esperamos en la peluquería a la hora indicada.
      </p>

      <div className="mt-8 w-full max-w-sm rounded-3xl glass-panel p-6 text-left animate-fade-up">
        <div className="mb-4 border-b border-white/5 pb-4">
          <p className="text-[0.65rem] uppercase tracking-wider text-zinc-500">Servicio</p>
          <p className="mt-1 font-display text-xl font-bold text-white">{safeService}</p>
        </div>

        <div className="space-y-4">
          {barber && (
            <div className="flex items-center gap-3">
              {barber.photo_url ? (
                <img src={barber.photo_url} alt="" className="h-9 w-9 rounded-xl object-cover ring-1 ring-white/10" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl gold-gradient font-display text-xs font-bold text-black/80">
                  {barber.initials}
                </div>
              )}
              <div>
                <p className="text-[0.65rem] uppercase tracking-wider text-zinc-500">Barbero</p>
                <p className="text-sm font-medium text-white">{barber.name}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-4 w-4 text-gold" />
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-zinc-500">Fecha</p>
              <p className="text-sm font-medium text-white">{prettyDate(booking?.booking_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ClockIcon className="h-4 w-4 text-gold" />
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-zinc-500">Hora</p>
              <p className="text-sm font-medium text-white">{safeTime} h</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-4 w-4 items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-zinc-500">A nombre de</p>
              <p className="text-sm font-medium text-white">{safeName}</p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onHome}
        className="mt-10 inline-flex items-center gap-2 rounded-full glass-card px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition-all duration-300 hover:border-gold/30 active:scale-95"
      >
        <HomeIcon className="h-4 w-4" />
        Volver al inicio
      </button>

      {/* Success modal with calendar buttons */}
      {showModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fade-in"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-gold/20 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl animate-scale-in text-center">
            <button
              onClick={() => setShowModal(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="relative mx-auto mb-5 h-16 w-16">
              <div className="absolute inset-0 animate-ping rounded-full bg-gold/20" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full gold-gradient animate-scale-in">
                <CheckIcon className="h-8 w-8 text-black" />
              </div>
            </div>

            <h3 className="font-display text-xl font-bold text-white">¡Cita confirmada con éxito!</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Te hemos enviado un correo con los detalles de tu cita.
            </p>

            <div className="mt-5 space-y-2.5">
              <a
                href={gcalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2.5 rounded-full bg-white/5 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98]"
              >
                <CalendarPlus className="h-4 w-4 text-gold" />
                Añadir a Google Calendar
              </a>
              <button
                onClick={handleAppleCalendar}
                className="flex w-full items-center justify-center gap-2.5 rounded-full bg-white/5 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98]"
              >
                <Apple className="h-4 w-4 text-gold" />
                Añadir a Apple Calendar (.ics)
              </button>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full text-xs font-medium text-zinc-500 transition-colors hover:text-white"
            >
              Ver resumen de mi cita
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
