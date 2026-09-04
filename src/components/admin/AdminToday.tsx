import { CalendarDays, Clock, Scissors, Phone, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { SavedBooking, Barber } from '@/types';
import { MONTH_SHORT, WEEKDAY_SHORT, toISO } from '@/lib/schedule';
import { useEffect, useState } from 'react';

interface AdminTodayProps {
  bookings: SavedBooking[];
  loading: boolean;
  onRefresh: () => void;
}

export function AdminToday({ bookings, loading, onRefresh }: AdminTodayProps) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const todayISO = toISO(new Date());

  useEffect(() => { fetchAllBarbers().then(setBarbers); }, []);

  const todayBookings = bookings
    .filter((b) => b.booking_date === todayISO)
    .sort((a, b) => a.booking_time.localeCompare(b.booking_time));

  const handleCancel = async (id: string) => {
    if (!confirm('¿Cancelar esta cita?')) return;
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    onRefresh();
  };

  const getBarber = (id: string) => barbers.find((b) => b.id === id);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-gold" /></div>;
  }

  const now = new Date();
  const dateLabel = `${WEEKDAY_SHORT[now.getDay()]} ${now.getDate()} ${MONTH_SHORT[now.getMonth()]}`;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Citas hoy" value={todayBookings.length} />
        <StatCard label="Próxima cita" value={todayBookings[0]?.booking_time ?? '—'} />
        <StatCard label="Barbero" value={barbers.length} className="col-span-2 md:col-span-1" />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-gold" />
        <h3 className="font-display text-xl font-bold text-white">Citas de hoy · {dateLabel}</h3>
      </div>

      {todayBookings.length === 0 ? (
        <div className="rounded-3xl glass-card px-5 py-12 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-500">No hay citas para hoy.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {todayBookings.map((b) => {
            const barber = getBarber(b.barber);
            return (
              <div key={b.id} className="flex items-stretch gap-3 rounded-2xl glass-card p-3.5 transition-colors hover:border-gold/15">
                <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-gold/5 py-2.5">
                  <span className="font-display text-base font-bold text-gold">{b.booking_time}</span>
                  <span className="text-[0.55rem] uppercase text-zinc-500">h</span>
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
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><Scissors className="h-3 w-3" />{b.service}</span>
                    {b.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{b.phone}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleCancel(b.id)}
                  aria-label="Cancelar cita"
                  className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div className={`rounded-2xl glass-card p-4 ${className ?? ''}`}>
      <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
