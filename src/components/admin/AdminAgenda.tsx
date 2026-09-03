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

  useEffect(() => {
    fetchAllBarbers().then(setBarbers);
  }, []);

  const baseDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  }, [offset]);

  const targetISO = toISO(baseDate);

  const dayBookings = useMemo(
    () => bookings
      .filter((b) => b.booking_date === targetISO)
      .sort((a, b) => a.booking_time.localeCompare(b.booking_time)),
    [bookings, targetISO]
  );

  const handleCancel = async (id: string) => {
    if (!confirm('¿Cancelar esta cita?')) return;
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    onRefresh();
  };

  const getBarber = (id: string) => barbers.find((b) => b.id === id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-marble/20 border-t-wood" />
      </div>
    );
  }

  const dateLabel = `${WEEKDAY_SHORT[baseDate.getDay()]} ${baseDate.getDate()} ${MONTH_SHORT[baseDate.getMonth()]}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-wood-light" />
          <h3 className="font-display text-xl font-medium text-marble">{dateLabel}</h3>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setOffset((o) => o - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-marble/5 text-marble/70 hover:bg-marble/10 active:scale-90"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOffset(0)}
            className="rounded-full bg-marble/5 px-3 text-xs font-medium text-marble/70 hover:bg-marble/10"
          >
            Hoy
          </button>
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-marble/5 text-marble/70 hover:bg-marble/10 active:scale-90"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {dayBookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-marble/10 px-5 py-12 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-marble/25" />
          <p className="mt-3 text-sm text-marble/50">No hay citas este día.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dayBookings.map((b) => {
            const barber = getBarber(b.barber);
            return (
              <div key={b.id} className="flex items-stretch gap-3 rounded-xl border border-marble/8 bg-marble/[0.03] p-3">
                <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-marble/[0.05] py-2">
                  <span className="text-sm font-bold text-marble">{b.booking_time}</span>
                  <span className="text-[0.6rem] text-marble/40">h</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {barber?.photo_url ? (
                      <img src={barber.photo_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : barber ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-wood to-wood-dark font-display text-[0.6rem] font-semibold text-marble">
                        {barber.initials}
                      </span>
                    ) : null}
                    <p className="truncate text-sm font-semibold text-marble">{b.full_name}</p>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-marble/50">
                    <span className="flex items-center gap-1"><Scissors className="h-3 w-3" />{b.service}</span>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{b.phone}</span>
                  </div>
                  {b.comments && (
                    <p className="mt-1 truncate text-xs text-marble/35 italic">"{b.comments}"</p>
                  )}
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
