import { useState, useEffect, useCallback } from 'react';
import type { SavedBooking, Barber } from '@/types';
import { safeInitial } from '@/lib/calendar';
import { ArrowLeft, Calendar, Clock, Scissors, X, Phone, CalendarClock, Check } from 'lucide-react';
import { MONTH_SHORT, WEEKDAY_SHORT } from '@/lib/schedule';
import { fetchMyBookings, rescheduleBooking } from '@/lib/myBookings';
import { supabase } from '@/lib/supabase';
import { DateTimeStep } from '@/components/DateTimeStep';

interface MyBookingsProps {
  onBack: () => void;
  userEmail?: string | null;
}

const CANCEL_THRESHOLD_HOURS = 3;

export function MyBookings({ onBack, userEmail }: MyBookingsProps) {
  const [bookings, setBookings] = useState<SavedBooking[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [reschedulingBooking, setReschedulingBooking] = useState<SavedBooking | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [data, { data: barberData }] = await Promise.all([
        fetchMyBookings(),
        supabase.from('barbers').select('*'),
      ]);
      setBookings(data);
      setBarbers((barberData as Barber[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 3500);
    return () => clearTimeout(t);
  }, [successMessage]);

  const canCancel = (date: string, time: string): boolean => {
    const appointment = new Date(`${date}T${time}:00`);
    const diff = appointment.getTime() - Date.now();
    return diff > CANCEL_THRESHOLD_HOURS * 60 * 60 * 1000;
  };

  const handleCancel = useCallback(async (id: string) => {
    if (!confirm('¿Seguro que quieres cancelar esta cita?')) return;
    setCancellingId(id);
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    setBookings((prev) => prev.filter((b) => b.id !== id));
    setCancellingId(null);
  }, []);

  const handleRescheduleContinue = useCallback(
    async (newDate: string, newTime: string) => {
      if (!reschedulingBooking) return;
      setRescheduling(true);
      setRescheduleError(null);
      try {
        const { booking: updated, error } = await rescheduleBooking(reschedulingBooking.id, newDate, newTime);
        if (error) throw new Error(error);
        if (updated) {
          setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
          setReschedulingBooking(null);
          setSuccessMessage('Cita reprogramada correctamente.');
        }
      } catch (e) {
        console.error('Error al reprogramar la cita:', e);
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('already booked') || msg.includes('time slot')) {
          setRescheduleError('Ese horario ya no está disponible. Elige otra hora.');
        } else {
          setRescheduleError('No se pudo reprogramar la cita. Inténtalo de nuevo en unos segundos.');
        }
      } finally {
        setRescheduling(false);
      }
    },
    [reschedulingBooking]
  );

  const getBarber = (id: string) => barbers.find((b) => b.id === id);
  const now = new Date().toISOString().slice(0, 10);

  const nonCancelled = bookings.filter((b) => b.status !== 'cancelled');
  const upcoming = nonCancelled.filter((b) => b.booking_date >= now);
  const past = nonCancelled.filter((b) => b.booking_date < now);

  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-gold" />
      </div>
    );
  }

  // Reschedule mode: reuse DateTimeStep to pick a new slot for the same barber.
  if (reschedulingBooking) {
    const barber = getBarber(reschedulingBooking.barber)!;
    return (
      <div className="min-h-screen animate-fade-in">
        {rescheduleError && (
          <div className="sticky top-0 z-40 border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-center text-xs font-medium text-red-400 backdrop-blur-xl">
            {rescheduleError}
          </div>
        )}
        {rescheduling && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-md">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
            <p className="text-sm text-zinc-300">Reprogramando tu cita…</p>
          </div>
        )}
        <DateTimeStep
          barber={barber}
          onBack={() => {
            setRescheduleError(null);
            setReschedulingBooking(null);
          }}
          onContinue={handleRescheduleContinue}
        />
      </div>
    );
  }

  const renderBookingCard = (b: SavedBooking) => {
    const barber = getBarber(b.barber);
    const cancellable = canCancel(b.booking_date, b.booking_time);
    const isUpcoming = b.booking_date >= now;
    return (
      <div key={b.id} className="rounded-2xl glass-card p-4 transition-colors hover:border-gold/15">
        <div className="flex items-start gap-3">
          <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-gold/5 py-2">
            <span className="font-display text-sm font-bold text-gold">{b.booking_time}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {barber?.photo_url ? (
                <img src={barber.photo_url} alt="" className="h-5 w-5 rounded-full object-cover" />
              ) : barber ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full gold-gradient text-[0.55rem] font-bold text-black">
                  {safeInitial(barber.name)}
                </span>
              ) : null}
              <p className="truncate text-sm font-bold text-white">{b.service}</p>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(b.booking_date)}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{b.booking_time} h</span>
              {barber && <span className="flex items-center gap-1"><Scissors className="h-3 w-3" />{barber.name}</span>}
              {b.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{b.phone}</span>}
            </div>
          </div>
        </div>
        {isUpcoming && (
          <div className="mt-3 flex gap-2">
            {cancellable ? (
              <>
                <button
                  onClick={() => {
                    if (!getBarber(b.barber)) return;
                    setRescheduleError(null);
                    setReschedulingBooking(b);
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gold/10 py-2.5 text-xs font-bold uppercase tracking-wider text-gold transition-all hover:bg-gold/20 active:scale-[0.98]"
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  Cambiar fecha y hora
                </button>
                <button
                  onClick={() => handleCancel(b.id)}
                  disabled={cancellingId === b.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-red-500/10 py-2.5 text-xs font-bold uppercase tracking-wider text-red-400 transition-all hover:bg-red-500/20 active:scale-[0.98] disabled:opacity-50"
                >
                  {cancellingId === b.id ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400/30 border-t-red-400" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                  Cancelar
                </button>
              </>
            ) : (
              <p className="w-full text-center text-[0.65rem] text-zinc-600">
                No se puede modificar con menos de 3 horas de antelación
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen animate-fade-in">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/5 bg-zinc-950/60 px-5 py-4 backdrop-blur-xl md:px-8">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full glass-card text-zinc-400 transition-colors hover:text-gold">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-gold">Mi cuenta</p>
          <h1 className="font-display text-lg font-bold text-white">Mis citas</h1>
        </div>
        {userEmail && (
          <span className="hidden text-xs text-zinc-500 sm:block">{userEmail}</span>
        )}
      </header>

      {successMessage && (
        <div className="mx-5 mt-4 flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-400 md:mx-8">
          <Check className="h-4 w-4 flex-none" />
          {successMessage}
        </div>
      )}

      <div className="mx-auto max-w-2xl px-5 py-6 md:px-8 md:py-8">
        {bookings.length === 0 ? (
          <div className="rounded-3xl glass-card px-5 py-16 text-center">
            <Calendar className="mx-auto h-10 w-10 text-zinc-600" />
            <p className="mt-4 text-sm font-medium text-zinc-400">No tienes citas reservadas</p>
            <p className="mt-1 text-xs text-zinc-600">Cuando reserves una cita, aparecerá aquí.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {upcoming.length > 0 && (
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Próximas citas ({upcoming.length})</h2>
                <div className="space-y-2.5">{upcoming.map(renderBookingCard)}</div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-600">Historial</h2>
                <div className="space-y-2.5 opacity-60">{past.map(renderBookingCard)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
