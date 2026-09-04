import { useMemo, useState, useEffect } from 'react';
import { CalendarDays, Scissors, Phone, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { SavedBooking, Barber } from '@/types';
import { MONTH_SHORT, WEEKDAY_SHORT, toISO } from '@/lib/schedule';

interface AdminAgendaProps {
  bookings: SavedBooking[];
  loading: boolean;
  onRefresh: () => void;
}

export function AdminAgenda({ bookings, loading, onRefresh }: AdminAgendaProps) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [offset, setOffset] = useState(0);

  useEffect(() => { fetchAllBarbers().then(setBarbers); }, []);

  const baseDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  }, [offset]);

  const targetISO = toISO(baseDate);

  const dayBookings = useMemo(
    () => bookings.filter((b) => b.booking_date === targetISO).sort((a, b) => a.booking_time.localeCompare(b.booking_time)),
    [bookings, targetISO]
  );

  const handleCancel = async (id: string) => {
    if (!confirm('¿Cancelar esta cita?')) return;
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    onRefresh();
  };

  const getBarber = (id: string) => barbers.find((b) => b.id === id);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-gold" /></div>;
  }

  const dateLabel = `${WEEKDAY_SHORT[baseDate.getDay()]} ${baseDate.getDate()} ${MONTH_SHORT[baseDate.getMonth()]}`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-gold" />
          <h3 className="font-display text-xl font-bold text-white">{dateLabel}</h3>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setOffset((o) => o - 1)} className="flex h-8 w-8 items-center justify-center rounded-full glass-card text-zinc-400 hover:text-white active:scale-90">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setOffset(0)} className="rounded-full glass-card px-3 text-xs font-medium text-zinc-400 hover:text-white">
            Hoy
          </button>
          <button onClick={() => setOffset((o) => o + 1)} className="flex h-8 w-8 items-center justify-center rounded-full glass-card text-zinc-400 hover:text-white active:scale-90">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {dayBookings.length === 0 ? (
        <div className="rounded-3xl glass-card px-5 py-12 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-500">No hay citas este día.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {dayBookings.map((b) => {
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
      )}
    </div>
  );
}
