import { CheckIcon, CalendarIcon, ClockIcon, HomeIcon } from '@/components/icons';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { SavedBooking, Barber } from '@/types';
import { safeCap, googleCalendarUrl, downloadIcs } from '@/lib/calendar';
import { sendBookingEmail } from '@/lib/email';
import { SALON_ADDRESS } from '@/data/services';
import { Mail } from 'lucide-react';

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

function AppleLogoIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 170 170" fill="currentColor" className={className}>
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.96-14.34-5.77-8.79-10.35-19.16-13.73-31.12-3.38-11.96-5.07-23.3-5.07-34.04 0-14.79 3.58-26.68 10.74-35.67 7.16-8.99 16.29-13.58 27.39-13.77 5.11 0 10.45 1.25 16.03 3.75 5.58 2.5 9.17 3.86 10.78 4.09 2.29-.54 6.24-2.09 11.87-4.66 5.62-2.57 10.78-3.75 15.47-3.54 12.08.76 21.84 5.38 29.27 13.87-10.45 6.32-15.57 15.03-15.35 26.13.22 8.71 3.58 15.93 10.08 21.65 6.5 5.72 14.18 9.07 23.03 10.05-2.07 6.1-4.41 12.13-7.03 18.09zM119.22 31.84c0-7.39 2.67-14.34 8.01-20.85 5.34-6.51 11.88-10.55 19.62-12.12.87 7.84-1.42 15.08-6.86 21.72-5.44 6.64-12.08 10.77-19.92 12.39-.22-.38-.47-.76-.73-1.14h-.12z" />
    </svg>
  );
}

function GoogleCalendarLogoIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 192 192" className={className}>
      <rect width="128" height="128" x="32" y="32" fill="#ffffff" rx="16" />
      <path fill="#4285f4" d="M144 32h-16v16h16V32zM64 32H48v16h16V32z" />
      <path fill="#ea4335" d="M160 52V40c0-4.42-3.58-8-8-8h-16v20H56V32H40c-4.42 0-8 3.58-8 8v12h128z" />
      <path fill="#fbbc04" d="M32 52h24v108H40c-4.42 0-8-3.58-8-8V52z" />
      <path fill="#34a853" d="M160 152c0 4.42-3.58 8-8 8h-24V52h32v100z" />
      <path fill="#4285f4" d="M128 160H56v-24h72v24z" />
      <text x="96" y="125" fill="#1a73e8" fontSize="62" fontWeight="700" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif">31</text>
    </svg>
  );
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
                className="flex w-full items-center justify-center gap-3 rounded-full bg-white/5 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98] border border-white/5 shadow-sm"
              >
                <GoogleCalendarLogoIcon className="h-5 w-5 shrink-0" />
                <span>Añadir a Google Calendar</span>
              </a>
              <button
                onClick={handleAppleCalendar}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-white/5 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98] border border-white/5 shadow-sm"
              >
                <AppleLogoIcon className="h-5 w-5 shrink-0 text-white" />
                <span>Añadir a Apple Calendar</span>
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
