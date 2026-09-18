import { useMemo, useState, useEffect } from 'react';
import { 
  CalendarDays,
  CalendarClock,
  Scissors, 
  Phone, 
  X, 
  ChevronRight, 
  PhoneCall, 
  User, 
  Clock, 
  CheckCircle2, 
  XCircle,
  RotateCw,
  Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { SavedBooking, Barber } from '@/types';
import { WEEKDAY_SHORT, MONTH_SHORT, toISO, isCancelledBookingExpired } from '@/lib/schedule';
import { notify } from '@/lib/notify';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CustomerDetailModal } from '@/components/admin/CustomerDetailModal';
import { ReorganizeBookingModal } from '@/components/admin/ReorganizeBookingModal';
import { notifyBookingCancelled } from '@/lib/notifications';
import { getWhatsAppUrl, getCallUrl } from '@/lib/phoneActions';
import { WhatsAppIcon } from '@/components/icons';

interface AdminAgendaProps {
  bookings: SavedBooking[];
  loading: boolean;
  onRefresh: () => void;
}

export function AdminAgenda({ bookings, loading, onRefresh }: AdminAgendaProps) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [viewFilter, setViewFilter] = useState<'active' | 'cancelled' | 'all'>('active');
  const [barberFilter, setBarberFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<SavedBooking | null>(null);
  const [reorganizingBooking, setReorganizingBooking] = useState<SavedBooking | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    user_id?: string | null;
    full_name: string;
    phone: string;
    email?: string | null;
    comments?: string | null;
  } | null>(null);

  useEffect(() => { fetchAllBarbers().then(setBarbers); }, []);

  const [nowState, setNowState] = useState(() => {
    const d = new Date();
    return {
      iso: toISO(d),
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    };
  });

  // Re-evaluar cada 15 segundos para mantener actualizado el reloj y las fechas
  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setNowState({
        iso: toISO(d),
        time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Solo citas de hoy en adelante: los días pasados desaparecen de la agenda completa
  // y quedan guardados en el historial de citas del cliente
  const cleanBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (!b.booking_date) return false;
      // Descartar días que ya hayan pasado de la agenda
      if (b.booking_date < nowState.iso) return false;
      // Descartar citas canceladas que ya hayan expirado hoy
      if (isCancelledBookingExpired(b, nowState.iso, nowState.time)) return false;
      return true;
    });
  }, [bookings, nowState]);

  const activeCount = useMemo(() => cleanBookings.filter((b) => b.status !== 'cancelled').length, [cleanBookings]);
  const cancelledCount = useMemo(() => cleanBookings.filter((b) => b.status === 'cancelled').length, [cleanBookings]);

  const filteredBookings = useMemo(() => {
    let list = cleanBookings;
    if (viewFilter === 'active') list = list.filter((b) => b.status !== 'cancelled');
    else if (viewFilter === 'cancelled') list = list.filter((b) => b.status === 'cancelled');

    if (barberFilter !== 'all') {
      list = list.filter((b) => b.barber === barberFilter);
    }
    return list;
  }, [cleanBookings, viewFilter, barberFilter]);

  const groupedBookings = useMemo(() => {
    const sorted = [...filteredBookings].sort((a, b) =>
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
  }, [filteredBookings]);

  const handleCancel = async (id: string) => {
    if (!confirm('¿Cancelar esta cita?')) return;
    try {
      const target = bookings.find((b) => b.id === id) || (selectedBooking?.id === id ? selectedBooking : null);
      const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
      notify.success('Cita cancelada', 'La cita fue marcada como cancelada');
      if (selectedBooking?.id === id) {
        setSelectedBooking((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
      }
      if (target) {
        const targetBarber = barbers.find((b) => b.id === target.barber);
        notifyBookingCancelled(target, targetBarber).catch(console.error);
      }
      onRefresh();
    } catch (err: any) {
      notify.error('Error al cancelar', err?.message || 'No se pudo cancelar la cita');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const { error } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id);
      if (error) throw error;
      notify.success('Cita restaurada', 'La cita vuelve a estar activa en la agenda');
      if (selectedBooking?.id === id) {
        setSelectedBooking((prev) => (prev ? { ...prev, status: 'confirmed' } : null));
      }
      onRefresh();
    } catch (err: any) {
      notify.error('Error al restaurar', err?.message || 'No se pudo restaurar la cita');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm('¿Eliminar por completo esta cita de la base de datos?\n\nEsta acción es irreversible y borrará el registro definitivamente.')) return;
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
      notify.success('Cita eliminada definitivamente', 'El registro se ha borrado por completo de la base de datos');
      if (selectedBooking?.id === id) {
        setSelectedBooking(null);
      }
      onRefresh();
    } catch (err: any) {
      notify.error('Error al eliminar', err?.message || 'No se pudo eliminar la cita');
    }
  };

  const getBarber = (id: string): Barber => {
    const found = barbers.find((b) => b.id === id);
    if (found) return found;
    const adrian = barbers.find((b) => b.id === 'adrian');
    if (id === 'adrian' && adrian) return adrian;
    return {
      id: id || 'barber',
      name: id === 'adrian' ? 'Adrián Millán' : id ? `Barbero (${id})` : 'Barbero no asignado',
      role: 'Barbero',
      initials: (id || '?').substring(0, 2).toUpperCase(),
      active: true,
      services: [],
      working_hours: { start: '09:00', end: '20:30', days: [1, 2, 3, 4, 5, 6] },
    };
  };

  const formatDateLabel = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    const label = `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
    if (iso === nowState.iso) {
      return `Hoy · ${label}`;
    }
    return label;
  };

  const formatDateFull = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} de ${MONTH_SHORT[d.getMonth()]} de ${d.getFullYear()}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" label="Cargando agenda…" />
      </div>
    );
  }

  if (cleanBookings.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl glass-card px-5 py-12 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-400">No hay citas programadas en la agenda.</p>
          <p className="mt-1 text-xs text-zinc-600">
            Las citas de días pasados se encuentran guardadas en el historial de cada cliente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl w-full min-w-0 space-y-4">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-gold" />
          <h3 className="font-display text-xl font-bold text-white">Próximas citas</h3>
        </div>

        <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewFilter('active')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              viewFilter === 'active'
                ? 'bg-gold text-black shadow font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Activas ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setViewFilter('cancelled')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              viewFilter === 'cancelled'
                ? 'bg-red-500/20 text-red-300 border border-red-500/30 font-bold'
                : cancelledCount > 0
                ? 'text-red-400 hover:bg-red-500/10'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Canceladas</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[0.65rem] ${
              cancelledCount > 0 ? 'bg-red-500/30 text-red-300 font-bold' : 'bg-zinc-800 text-zinc-500'
            }`}>
              {cancelledCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setViewFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              viewFilter === 'all'
                ? 'bg-white/10 text-white shadow font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Todas ({cleanBookings.length})
          </button>
        </div>
      </div>

      {/* Selector de barbero para filtrar la agenda */}
      {barbers.length > 1 && (
        <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setBarberFilter('all')}
            className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              barberFilter === 'all'
                ? 'bg-zinc-800 text-white border border-white/20 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 bg-white/[0.03] border border-white/5'
            }`}
          >
            Todos los barberos
          </button>
          {barbers.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBarberFilter(b.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                barberFilter === b.id
                  ? 'bg-gold/20 text-gold border border-gold/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 bg-white/[0.03] border border-white/5'
              }`}
            >
              {b.photo_url ? (
                <img src={b.photo_url} alt="" className="h-3.5 w-3.5 rounded-full object-cover shrink-0" />
              ) : (
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full gold-gradient text-[0.5rem] font-bold text-black shrink-0">
                  {b.initials}
                </span>
              )}
              <span>{b.name}</span>
            </button>
          ))}
        </div>
      )}

      {groupedBookings.length === 0 ? (
        <div className="rounded-3xl glass-card px-5 py-12 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-400">
            {viewFilter === 'cancelled'
              ? 'No hay citas canceladas próximas.'
              : viewFilter === 'active'
              ? 'No hay citas activas próximas programadas.'
              : 'No hay citas próximas registradas.'}
          </p>
          {(viewFilter !== 'active' || barberFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setViewFilter('active');
                setBarberFilter('all');
              }}
              className="mt-3 text-xs text-gold hover:underline"
            >
              Restablecer filtros
            </button>
          )}
        </div>
      ) : (
      <div data-lenis-prevent className="max-h-[70vh] md:max-h-[calc(100vh-210px)] space-y-5 overflow-y-auto overflow-x-hidden pr-1 sm:pr-2">
        {groupedBookings.map((group) => (
          <div key={group.date}>
            <div className="sticky top-0 z-10 mb-2 rounded-xl bg-zinc-900/80 px-4 py-2 backdrop-blur-sm">
              <p className="font-display text-sm font-bold text-gold">{formatDateLabel(group.date)}</p>
              <p className="text-xs text-zinc-500">{group.items.length} {group.items.length === 1 ? 'cita' : 'citas'}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {group.items.map((b) => {
                const barber = getBarber(b.barber);
                const isCancelled = b.status === 'cancelled';
                const isDuplicate = group.items.some(
                  (other) => other.id !== b.id && other.status !== 'cancelled' && other.barber === b.barber && other.booking_time === b.booking_time
                );

                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBooking(b)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedBooking(b); }}
                    className={`group flex cursor-pointer items-start gap-2.5 sm:gap-3 rounded-2xl glass-card p-3 sm:p-3.5 transition-all duration-200 hover:border-gold/30 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-gold/5 ${
                      isCancelled 
                        ? 'opacity-80 border-red-500/20 bg-red-950/10' 
                        : isDuplicate 
                        ? 'border-amber-500/40 bg-amber-950/15 ring-1 ring-amber-500/30' 
                        : ''
                    }`}
                  >
                    {/* Time block: compact, never stretches vertically, h on the right */}
                    <div className="self-start shrink-0 inline-flex items-baseline justify-center rounded-xl bg-gold/10 px-2 sm:px-2.5 py-1 sm:py-1.5 border border-gold/20 shadow-sm">
                      <span className="font-display text-xs sm:text-sm font-bold text-gold tracking-tight">{b.booking_time}</span>
                      <span className="ml-0.5 text-[0.6rem] sm:text-[0.65rem] font-semibold text-gold/70 lowercase">h</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* TOP: Client Name, Barber Tag y Service Price */}
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <p className="truncate text-sm font-bold text-white group-hover:text-gold transition-colors">
                            {b.full_name}
                          </p>
                          {/* Chip de barbero en la cabecera */}
                          <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[0.65rem] font-medium text-zinc-300 border border-white/5">
                            {barber?.photo_url ? (
                              <img src={barber.photo_url} alt="" className="h-3 w-3 rounded-full object-cover shrink-0" />
                            ) : (
                              <span className="flex h-3 w-3 items-center justify-center rounded-full gold-gradient text-[0.45rem] font-bold text-black shrink-0">
                                {barber?.initials || b.barber.charAt(0).toUpperCase()}
                              </span>
                            )}
                            <span className="truncate max-w-[90px]">{barber?.name || b.barber}</span>
                          </span>
                          {isCancelled && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-red-400 border border-red-500/20">
                              <XCircle className="h-2.5 w-2.5" /> Cancelada
                            </span>
                          )}
                          {isDuplicate && !isCancelled && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[0.65rem] font-bold text-amber-300 border border-amber-500/40 animate-pulse">
                              ⚠️ Cita duplicada
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-gold font-mono">
                          {b.service_price}€
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                        <span className="flex items-center gap-1 text-zinc-300">
                          <Scissors className="h-3 w-3 text-gold/80" />
                          {b.service}
                        </span>
                        {b.phone && (
                          <span className="flex items-center gap-1 text-zinc-400">
                            <Phone className="h-3 w-3 text-zinc-500" />
                            {b.phone}
                          </span>
                        )}
                      </div>

                      {b.comments && (
                        <p className="truncate text-xs text-zinc-500 italic">"{b.comments}"</p>
                      )}

                      {/* BOTTOM: Barber Photo y "Cita para [barber_name]" */}
                      <div className="pt-1.5 flex items-center gap-2 border-t border-white/[0.04] text-xs text-zinc-400">
                        {barber?.photo_url ? (
                          <img src={barber.photo_url} alt="" className="h-4 w-4 rounded-full object-cover shrink-0" />
                        ) : barber ? (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full gold-gradient font-display text-[0.55rem] font-bold text-black shrink-0">
                            {barber.initials}
                          </span>
                        ) : null}
                        <span className="truncate">
                          Cita para <strong className="font-semibold text-zinc-200">{barber?.name || b.barber}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Actions y Chevron */}
                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 self-center">
                      {isCancelled ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestore(b.id);
                            }}
                            aria-label="Restaurar cita"
                            title="Restaurar cita a la agenda activa"
                            className="flex h-7 px-2 sm:h-8 sm:px-2.5 shrink-0 items-center gap-1 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/25 active:scale-95 transition-all"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline text-[0.7rem]">Restaurar</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePermanentDelete(b.id);
                            }}
                            aria-label="Eliminar cita por completo"
                            title="Eliminar cita por completo de la base de datos"
                            className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReorganizingBooking(b);
                          }}
                          aria-label="Reorganizar cita"
                          title="Reorganizar cita (cambiar fecha/hora o sugerir cambio)"
                          className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 hover:scale-105 active:scale-95 transition-all shadow-sm shadow-gold/5"
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <div className="text-zinc-600 group-hover:text-gold group-hover:translate-x-0.5 transition-all">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Appointment Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
          <div className="absolute inset-0" onClick={() => setSelectedBooking(null)} />
          <div 
            className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-gold/20 bg-zinc-950/95 p-6 shadow-2xl shadow-gold/5 backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2.5 py-0.5 font-display text-xs font-bold text-gold border border-gold/20">
                    <Clock className="h-3 w-3" /> {selectedBooking.booking_time} h
                  </span>
                  {selectedBooking.status === 'cancelled' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-red-400 border border-red-500/20">
                      <XCircle className="h-3 w-3" /> Cancelada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3" /> Confirmada
                    </span>
                  )}
                </div>
                <h3 className="font-display text-lg font-bold text-white">
                  {formatDateFull(selectedBooking.booking_date)}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                aria-label="Cerrar detalle"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Details Content */}
            <div className="my-5 space-y-4 text-sm">
              {/* Client card */}
              <div className="rounded-2xl glass-card p-4 border border-white/5 bg-zinc-900/40 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Cliente</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gold-gradient font-display text-sm font-bold text-black">
                    {selectedBooking.full_name ? selectedBooking.full_name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white">{selectedBooking.full_name}</p>
                    <p className="text-xs text-zinc-400">{selectedBooking.phone}</p>
                    {selectedBooking.email && <p className="text-xs text-zinc-500">{selectedBooking.email}</p>}
                  </div>
                </div>

                {selectedBooking.comments && (
                  <p className="mt-2 rounded-xl bg-white/[0.03] p-2.5 text-xs text-zinc-300 italic border border-white/5">
                    "{selectedBooking.comments}"
                  </p>
                )}
              </div>

              {/* Service y Barber */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl glass-card p-3.5 border border-white/5 bg-zinc-900/40">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Servicio</p>
                  <p className="mt-1 font-bold text-white text-sm truncate">{selectedBooking.service}</p>
                  <p className="mt-0.5 text-xs font-mono font-bold text-gold">{selectedBooking.service_price} €</p>
                </div>

                <div className="rounded-2xl glass-card p-3.5 border border-white/5 bg-zinc-900/40">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Barbero</p>
                  <div className="mt-1 flex items-center gap-2">
                    {getBarber(selectedBooking.barber).photo_url ? (
                      <img
                        src={getBarber(selectedBooking.barber).photo_url!}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4 text-zinc-500" />
                    )}
                    <p className="font-bold text-white text-sm truncate">
                      {getBarber(selectedBooking.barber)?.name || selectedBooking.barber}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 border-t border-white/10 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={getWhatsAppUrl(
                    selectedBooking.phone,
                    `¡Hola ${selectedBooking.full_name}! Te contactamos de Peluquería Adrián sobre tu cita del ${formatDateLabel(selectedBooking.booking_date)} a las ${selectedBooking.booking_time}h.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 py-2.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 active:scale-95 transition-all shadow-sm shadow-emerald-900/20"
                >
                  <WhatsAppIcon className="h-4 w-4 fill-current" />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={getCallUrl(selectedBooking.phone)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gold/15 py-2.5 text-xs font-semibold text-gold border border-gold/30 hover:bg-gold/25 active:scale-95 transition-all shadow-sm shadow-gold/10"
                >
                  <PhoneCall className="h-4 w-4" />
                  <span>Llamar</span>
                </a>
              </div>

              {/* Open customer profile and history */}
              <button
                type="button"
                onClick={() => {
                  const b = selectedBooking;
                  setSelectedBooking(null);
                  setSelectedCustomer({
                    user_id: b.user_id,
                    full_name: b.full_name,
                    phone: b.phone,
                    email: b.email,
                    comments: b.comments,
                  });
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-xs font-semibold text-white border border-white/10 hover:bg-white/10 hover:border-gold/30 active:scale-95 transition-all"
              >
                <User className="h-4 w-4 text-gold" />
                <span>Ver perfil e historial del cliente</span>
              </button>

              {selectedBooking.status === 'cancelled' ? (
                <button
                  type="button"
                  onClick={() => handleRestore(selectedBooking.id)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 py-2.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 active:scale-95 transition-all mt-1 shadow-sm shadow-emerald-950/20"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>Restaurar esta cita en la agenda</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const b = selectedBooking;
                      setSelectedBooking(null);
                      setReorganizingBooking(b);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold/15 py-2.5 text-xs font-bold text-gold border border-gold/30 hover:bg-gold/25 active:scale-95 transition-all mt-1 shadow-sm shadow-gold/10"
                  >
                    <CalendarClock className="h-4 w-4" />
                    <span>Reorganizar cita (sugerir cambio de hora)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCancel(selectedBooking.id)}
                    className="w-full text-center text-[0.7rem] text-zinc-500 hover:text-red-400 py-1 transition-colors"
                  >
                    Cancelar esta cita (marcar cancelada)
                  </button>
                </>
              )}

              {/* Botón para eliminar por completo */}
              <button
                type="button"
                onClick={() => handlePermanentDelete(selectedBooking.id)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/10 py-2 text-xs font-semibold text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all mt-1 shadow-sm shadow-red-950/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Eliminar por completo de la base de datos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail / History Modal from Agenda */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

      {/* Reorganize Booking Modal from Agenda */}
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
