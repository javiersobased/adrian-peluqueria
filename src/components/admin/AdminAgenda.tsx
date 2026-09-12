import { useMemo, useState, useEffect } from 'react';
import { CalendarDays, Scissors, Phone, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { SavedBooking, Barber } from '@/types';
import { WEEKDAY_SHORT, MONTH_SHORT } from '@/lib/schedule';

interface AdminAgendaProps {
  bookings: SavedBooking[];
  loading: boolean;
  onRefresh: () => void;
}

export function AdminAgenda({ bookings, loading, onRefresh }: AdminAgendaProps) {
  const [barbers, setBarbers] = useState<Barber[]>([]);

  useEffect(() => { fetchAllBarbers().then(setBarbers); }, []);

  const groupedBookings = useMemo(() => {
    const sorted = [...bookings].sort((a, b) =>
      a.booking_date.localeCompare(b.booking_date) || a.booking_time.localeCompare(b.booking_time)
    );
    const groups: { date: string; items: SavedBooking[] }[] = [];
    for (const b of sorted) {
      const last = groups[groups.length - 1];
      if (last && last.date === b.booking_date) {
        last.items.push(b);
      } else {
        groups.push({ date: b.booking_date, items: [b] });
      }
    }
    return groups;
  }, [bookings]);

  const handleCancel = async (id: string) => {
    if (!confirm('¿Cancelar esta cita?')) return;
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    onRefresh();
  };

  const getBarber = (id: string) => barbers.find((b) => b.id === id);

  const formatDateLabel = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-gold" /></div>;
  }

  if (groupedBookings.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl glass-card px-5 py-12 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-500">No hay citas programadas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-gold" />
        <h3 className="font-display text-xl font-bold text-white">Próximas citas</h3>
      </div>

      <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-2">
        {groupedBookings.map((group) => (
          <div key={group.date}>
            <div className="sticky top-0 z-10 mb-2 rounded-xl bg-zinc-900/80 px-4 py-2 backdrop-blur-sm">
              <p className="font-display text-sm font-bold text-gold">{formatDateLabel(group.date)}</p>
              <p className="text-xs text-zinc-500">{group.items.length} {group.items.length === 1 ? 'cita' : 'citas'}</p>
            </div>
            <div className="space-y-2.5">
              {group.items.map((b) => {
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
                      {b.comments && <p className="mt-1 truncate text-xs text-zinc-600 italic">"{b.comments}"</p>}
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
          </div>
        ))}
      </div>
    </div>
  );
}
