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
          <p className="mt-1 font-display text-xl font-bold text-white">{booking.service}</p>
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
              <p className="text-sm font-medium text-white">{prettyDate(booking.booking_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ClockIcon className="h-4 w-4 text-gold" />
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-zinc-500">Hora</p>
              <p className="text-sm font-medium text-white">{booking.booking_time} h</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-4 w-4 items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-zinc-500">A nombre de</p>
              <p className="text-sm font-medium text-white">{booking.full_name}</p>
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
    </div>
  );
}
