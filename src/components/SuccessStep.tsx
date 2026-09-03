import { CheckIcon, CalendarIcon, ClockIcon, HomeIcon } from '@/components/icons';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { SavedBooking, Barber } from '@/types';

interface SuccessStepProps {
  booking: SavedBooking;
  onHome: () => void;
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function prettyDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${cap(MONTHS_ES[d.getMonth()])} ${d.getDate()}, ${d.getFullYear()}`;
}

export function SuccessStep({ booking, onHome }: SuccessStepProps) {
  const [barber, setBarber] = useState<Barber | null>(null);

  useEffect(() => {
    supabase
      .from('barbers')
      .select('*')
      .eq('id', booking.barber)
      .maybeSingle()
      .then(({ data }) => setBarber(data as Barber | null));
  }, [booking.barber]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center animate-fade-in">
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-ping rounded-full bg-wood/20" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-wood shadow-2xl shadow-wood/30 animate-scale-in">
          <CheckIcon className="h-12 w-12 text-marble" />
        </div>
      </div>

      <p className="text-xs uppercase tracking-[0.3em] text-wood-light">Reserva confirmada</p>
      <h2 className="mt-3 font-display text-4xl font-medium text-marble">¡Hasta pronto!</h2>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-marble/60">
        Tu cita ha sido registrada correctamente. Te esperamos en la peluquería a la hora indicada.
      </p>

      <div className="mt-8 w-full max-w-sm rounded-2xl glass-panel p-6 text-left animate-fade-up">
        <div className="mb-4 border-b border-marble/8 pb-4">
          <p className="text-[0.65rem] uppercase tracking-wider text-marble/40">Servicio</p>
          <p className="mt-1 font-display text-xl font-medium text-marble">{booking.service}</p>
        </div>

        <div className="space-y-3">
          {barber && (
            <div className="flex items-center gap-3">
              {barber.photo_url ? (
                <img src={barber.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-wood to-wood-dark font-display text-xs font-semibold text-marble">
                  {barber.initials}
                </div>
              )}
              <div>
                <p className="text-[0.65rem] uppercase tracking-wider text-marble/40">Barbero</p>
                <p className="text-sm text-marble/85">{barber.name}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-4 w-4 text-wood-light" />
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-marble/40">Fecha</p>
              <p className="text-sm text-marble/85">{prettyDate(booking.booking_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ClockIcon className="h-4 w-4 text-wood-light" />
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-marble/40">Hora</p>
              <p className="text-sm text-marble/85">{booking.booking_time} h</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-4 w-4 items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-wood-light" />
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-marble/40">A nombre de</p>
              <p className="text-sm text-marble/85">{booking.full_name}</p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onHome}
        className="mt-10 inline-flex items-center gap-2 rounded-full bg-marble px-7 py-3.5 text-sm font-semibold uppercase tracking-wider text-ink transition-all duration-200 hover:bg-white active:scale-95"
      >
        <HomeIcon className="h-4 w-4" />
        Volver al inicio
      </button>
    </div>
  );
}
