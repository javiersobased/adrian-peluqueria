import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { SavedBooking, BarberBlock, Barber } from '@/types';
import { AdminToday } from '@/components/admin/AdminToday';
import { AdminAgenda } from '@/components/admin/AdminAgenda';
import { AdminManualBooking } from '@/components/admin/AdminManualBooking';
import { AdminAvailability } from '@/components/admin/AdminAvailability';
import { AdminServices } from '@/components/admin/AdminServices';
import { AdminStaff } from '@/components/admin/AdminStaff';
import { AdminStaffSchedule } from '@/components/admin/AdminStaffSchedule';
import { ArrowLeft, CalendarDays, PlusCircle, SlidersHorizontal, Scissors, Users, Clock } from 'lucide-react';

interface AdminPanelProps {
  onBack: () => void;
}

type AdminTab = 'today' | 'agenda' | 'manual' | 'availability' | 'services' | 'staff' | 'schedule';

export function AdminPanel({ onBack }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>('today');
  const [bookings, setBookings] = useState<SavedBooking[]>([]);
  const [blocks, setBlocks] = useState<BarberBlock[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllBarbers().then((b) => setBarbers(b));
  }, []);

  const fetchBookings = useCallback(async () => {
    let query = supabase
      .from('bookings')
      .select('*')
      .neq('status', 'cancelled')
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true });

    if (selectedBarber !== 'all') {
      query = query.eq('barber', selectedBarber);
    }

    const { data } = await query;
    setBookings((data as SavedBooking[]) ?? []);
  }, [selectedBarber]);

  const fetchBlocks = useCallback(async () => {
    let query = supabase
      .from('barber_blocks')
      .select('*')
      .order('created_at', { ascending: false });

    if (selectedBarber !== 'all') {
      query = query.eq('barber', selectedBarber);
    }

    const { data } = await query;
    setBlocks((data as BarberBlock[]) ?? []);
  }, [selectedBarber]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchBookings(), fetchBlocks()]);
    setLoading(false);
  }, [fetchBookings, fetchBlocks]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchBookings())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barber_blocks' }, () => fetchBlocks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barber_vacations' }, () => fetchBlocks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barber_schedules' }, () => fetchBlocks())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBookings, fetchBlocks]);

  const tabs: { id: AdminTab; label: string; icon: typeof CalendarDays }[] = [
    { id: 'today', label: 'Hoy', icon: CalendarDays },
    { id: 'agenda', label: 'Agenda', icon: Clock },
    { id: 'manual', label: 'Cita manual', icon: PlusCircle },
    { id: 'availability', label: 'Bloqueos', icon: SlidersHorizontal },
    { id: 'services', label: 'Servicios', icon: Scissors },
    { id: 'staff', label: 'Personal', icon: Users },
    { id: 'schedule', label: 'Horarios', icon: Clock },
  ];

  return (
    <div className="min-h-screen animate-slide-in">
      <header className="sticky top-0 z-30 glass-panel px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Volver"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marble/5 text-marble/80 transition-colors hover:bg-marble/10 active:scale-90"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-wood-light">Gestión</p>
            <h2 className="font-display text-2xl font-medium leading-tight text-marble">Panel de administración</h2>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedBarber('all')}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              selectedBarber === 'all' ? 'bg-wood text-marble' : 'bg-marble/5 text-marble/60 hover:bg-marble/10'
            }`}
          >
            Todos
          </button>
          {barbers.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBarber(b.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                selectedBarber === b.id ? 'bg-wood text-marble' : 'bg-marble/5 text-marble/60 hover:bg-marble/10'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </header>

      <div className="sticky top-[120px] z-20 -mx-5 px-5 pt-3 pb-2 bg-ink/85 backdrop-blur-xl border-b border-marble/8">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                  tab === t.id ? 'bg-marble text-ink' : 'bg-marble/5 text-marble/55 hover:bg-marble/10'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 pb-10 pt-4">
        {tab === 'today' && <AdminToday bookings={bookings} loading={loading} onRefresh={refresh} />}
        {tab === 'agenda' && <AdminAgenda bookings={bookings} loading={loading} onRefresh={refresh} />}
        {tab === 'manual' && <AdminManualBooking onCreated={refresh} />}
        {tab === 'availability' && <AdminAvailability blocks={blocks} onRefresh={refresh} />}
        {tab === 'services' && <AdminServices />}
        {tab === 'staff' && <AdminStaff />}
        {tab === 'schedule' && <AdminStaffSchedule />}
      </div>
    </div>
  );
}
