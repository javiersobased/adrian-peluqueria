import { CalendarDays, CalendarClock, Clock, Scissors, Phone, X, ChevronDown, ChevronUp, History, CheckCircle2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { SavedBooking, Barber } from '@/types';
import { MONTH_SHORT, WEEKDAY_SHORT, toISO } from '@/lib/schedule';
import { useEffect, useState } from 'react';
import { notify } from '@/lib/notify';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ReorganizeBookingModal } from '@/components/admin/ReorganizeBookingModal';

interface AdminTodayProps {
  bookings: SavedBooking[];
  loading: boolean;
  onRefresh: () => void;
}

export function AdminToday({ bookings, loading, onRefresh }: AdminTodayProps) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [showPastBookings, setShowPastBookings] = useState(false);
  const [reorganizingBooking, setReorganizingBooking] = useState<SavedBooking | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  const todayISO = toISO(new Date());

  useEffect(() => {
    fetchAllBarbers().then(setBarbers);
  }, []);

  // Update current time every 30 seconds so upcoming/past transitions automatically
  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setCurrentTimeStr(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // All active bookings for today
  const allTodayBookings = bookings
    .filter((b) => b.booking_date === todayISO && b.status !== 'cancelled')
    .sort((a, b) => a.booking_time.localeCompare(b.booking_time));

  // Upcoming appointments today (time is >= now)
  const upcomingBookings = allTodayBookings.filter(
    (b) => b.booking_time >= currentTimeStr
  );

  // Past appointments today (time has passed)
  const pastBookings = allTodayBookings.filter(
    (b) => b.booking_time < currentTimeStr
  );

  const nextBookingTime = upcomingBookings[0]?.booking_time ?? '—';

  const handleCancel = async (id: string) => {
    if (!confirm('¿Cancelar esta cita?')) return;
    try {
      const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
      notify.success('Cita cancelada', 'La cita se ha cancelado correctamente');
      onRefresh();
    } catch (err: any) {
      console.error('Error al cancelar cita:', err);
      notify.error('Error al cancelar', err?.message || 'No se pudo cancelar la cita');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm('¿Eliminar por completo esta cita de la base de datos?\n\nEsta acción es irreversible y borrará el registro definitivamente.')) return;
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
      notify.success('Cita eliminada definitivamente', 'El registro se ha borrado por completo');
      onRefresh();
    } catch (err: any) {
      console.error('Error al eliminar cita:', err);
      notify.error('Error al eliminar', err?.message || 'No se pudo eliminar la cita');
    }
  };

  const getBarber = (id: string) => barbers.find((b) => b.id === id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" label="Cargando citas de hoy…" />
      </div>
    );
  }

  const now = new Date();
  const dateLabel = `${WEEKDAY_SHORT[now.getDay()]} ${now.getDate()} ${MONTH_SHORT[now.getMonth()]}`;

  return (
    <div className="mx-auto max-w-6xl w-full min-w-0 space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          label="Citas hoy"
          value={upcomingBookings.length}
          badge={pastBookings.length > 0 ? `-${pastBookings.length}` : undefined}
          badgeTitle={`${pastBookings.length} cita${pastBookings.length > 1 ? 's ya pasaron' : ' ya pasó'} hoy`}
        />
        <StatCard
          label="Próxima cita"
          value={nextBookingTime}
          subtext={nextBookingTime !== '—' ? 'Siguiente turno' : 'Sin más turnos'}
        />
        <StatCard
          label="Barberos activos"
          value={barbers.length}
          className="col-span-2 md:col-span-1"
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-gold" />
          <h3 className="font-display text-xl font-bold text-white">Citas de hoy · {dateLabel}</h3>
        </div>
        <span className="text-xs font-mono text-zinc-500 bg-zinc-900/80 px-2.5 py-1 rounded-full border border-white/5">
          {currentTimeStr} h
        </span>
      </div>

      {/* Main upcoming bookings list */}
      {upcomingBookings.length === 0 ? (
        <div className="rounded-3xl glass-card px-5 py-12 text-center">
          {allTodayBookings.length === 0 ? (
            <>
              <CalendarDays className="mx-auto h-8 w-8 text-zinc-600" />
              <p className="mt-3 text-sm text-zinc-500">No hay citas programadas para hoy.</p>
            </>
          ) : (
            <>
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/60" />
              <p className="mt-3 text-sm font-medium text-zinc-300">Todas las citas de hoy han finalizado</p>
              <p className="mt-1 text-xs text-zinc-500">
                Se completaron las {pastBookings.length} citas programadas para la jornada.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {upcomingBookings.map((b, index) => {
            const barber = getBarber(b.barber);
            const isNext = index === 0;
            return (
              <div
                key={b.id}
                className={`flex items-start gap-2.5 sm:gap-3 rounded-2xl glass-card p-3 sm:p-3.5 transition-all hover:border-gold/30 ${
                  isNext ? 'border-gold/30 bg-gold/[0.03] ring-1 ring-gold/20' : ''
                }`}
              >
                <div className="self-start shrink-0 flex flex-col items-center gap-1">
                  <div className={`inline-flex items-baseline justify-center rounded-xl px-2 sm:px-2.5 py-1 sm:py-1.5 border shadow-sm ${
                    isNext ? 'bg-gold/20 text-gold border-gold/40' : 'bg-gold/10 text-gold border-gold/20'
                  }`}>
                    <span className="font-display text-xs sm:text-sm font-bold tracking-tight">{b.booking_time}</span>
                    <span className="ml-0.5 text-[0.6rem] sm:text-[0.65rem] font-semibold text-gold/70 lowercase">h</span>
                  </div>
                  {isNext && (
                    <span className="rounded px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider bg-gold text-black">
                      Próxima
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {barber?.photo_url ? (
                      <img src={barber.photo_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : barber ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full gold-gradient font-display text-[0.6rem] font-bold text-black">
                        {barber.initials}
                      </span>
                    ) : null}
                    <p className="truncate text-sm font-bold text-white">{b.full_name}</p>
                    {barber && (
                      <span className="text-[0.65rem] text-zinc-400 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                        {barber.name}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Scissors className="h-3 w-3 text-gold/70" />
                      {b.service}
                    </span>
                    {b.phone && (
                      <a
                        href={`tel:${b.phone}`}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                      >
                        <Phone className="h-3 w-3 text-zinc-500" />
                        {b.phone}
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-center">
                  <button
                    type="button"
                    onClick={() => setReorganizingBooking(b)}
                    aria-label="Reorganizar cita"
                    title="Reorganizar cita (cambiar hora o sugerir cambio al cliente)"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 hover:scale-105 active:scale-95 transition-all shadow-sm shadow-gold/5"
                  >
                    <CalendarClock className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePermanentDelete(b.id)}
                    aria-label="Eliminar cita por completo"
                    title="Eliminar cita por completo de la base de datos"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accordion / Review of Past Appointments of Today */}
      {pastBookings.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowPastBookings((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-3 text-xs font-medium text-zinc-400 hover:bg-zinc-900/70 hover:text-zinc-300 transition-all"
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-zinc-500" />
              <span>Citas anteriores de hoy</span>
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.2 text-[0.65rem] font-bold text-red-400">
                -{pastBookings.length}
              </span>
            </div>
            {showPastBookings ? (
              <ChevronUp className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            )}
          </button>

          {showPastBookings && (
            <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
              {pastBookings.map((b) => {
                const barber = getBarber(b.barber);
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-zinc-950/40 p-3 opacity-60 transition-opacity hover:opacity-100"
                  >
                    <div className="self-start shrink-0 inline-flex items-baseline justify-center rounded-lg bg-zinc-900 px-2 py-1 text-zinc-400">
                      <span className="font-mono text-xs font-semibold line-through decoration-zinc-600">
                        {b.booking_time}
                      </span>
                      <span className="ml-0.5 text-[0.6rem] lowercase text-zinc-500">h</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium text-zinc-300">{b.full_name}</p>
                      <p className="truncate text-[0.7rem] text-zinc-500">{b.service} {barber ? `· ${barber.name}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {b.phone && (
                        <a
                          href={`tel:${b.phone}`}
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setReorganizingBooking(b)}
                        aria-label="Reorganizar cita"
                        title="Reorganizar cita (reprogramar a otro día u hora)"
                        className="text-zinc-500 hover:text-gold transition-colors p-1 rounded hover:bg-gold/10"
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePermanentDelete(b.id)}
                        aria-label="Eliminar cita por completo"
                        title="Eliminar cita por completo de la base de datos"
                        className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reorganize Booking Modal */}
      {reorganizingBooking && (
        <ReorganizeBookingModal
          booking={reorganizingBooking}
          barbers={barbers}
          allBookings={bookings}
          onClose={() => setReorganizingBooking(null)}
          onUpdated={onRefresh}
          onCancelBooking={handleCancel}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  badge,
  badgeTitle,
  subtext,
  className,
}: {
  label: string;
  value: string | number;
  badge?: string;
  badgeTitle?: string;
  subtext?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl glass-card p-4 relative overflow-hidden ${className ?? ''}`}>
      <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="font-display text-2xl font-bold text-white tracking-tight">{value}</p>
        {badge && (
          <span
            title={badgeTitle}
            className="inline-flex items-center rounded-full border border-red-500/60 bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400 ring-1 ring-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.2)]"
          >
            {badge}
          </span>
        )}
      </div>
      {subtext && (
        <p className="mt-0.5 text-[0.65rem] text-zinc-500 font-medium">{subtext}</p>
      )}
    </div>
  );
}
