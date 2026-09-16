import { useMemo, useState, useEffect } from 'react';
import { 
  CalendarDays, 
  Scissors, 
  Phone, 
  X, 
  ChevronRight, 
  PhoneCall, 
  User, 
  Clock, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { SavedBooking, Barber } from '@/types';
import { WEEKDAY_SHORT, MONTH_SHORT } from '@/lib/schedule';
import { notify } from '@/lib/notify';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CustomerDetailModal } from '@/components/admin/CustomerDetailModal';
import { getWhatsAppUrl, getCallUrl } from '@/lib/phoneActions';
import { WhatsAppIcon } from '@/components/icons';

interface AdminAgendaProps {
  bookings: SavedBooking[];
  loading: boolean;
  onRefresh: () => void;
}

export function AdminAgenda({ bookings, loading, onRefresh }: AdminAgendaProps) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<SavedBooking | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    user_id?: string | null;
    full_name: string;
    phone: string;
    email?: string | null;
    comments?: string | null;
  } | null>(null);

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
    try {
      const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
      notify.success('Cita cancelada', 'La cita fue marcada como cancelada');
      if (selectedBooking?.id === id) {
        setSelectedBooking(null);
      }
      onRefresh();
    } catch (err: any) {
      notify.error('Error al cancelar', err?.message || 'No se pudo cancelar la cita');
    }
  };

  const getBarber = (id: string) => barbers.find((b) => b.id === id);

  const formatDateLabel = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
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

      <div data-lenis-prevent className="max-h-[70vh] space-y-6 overflow-y-auto pr-2">
        {groupedBookings.map((group) => (
          <div key={group.date}>
            <div className="sticky top-0 z-10 mb-2 rounded-xl bg-zinc-900/80 px-4 py-2 backdrop-blur-sm">
              <p className="font-display text-sm font-bold text-gold">{formatDateLabel(group.date)}</p>
              <p className="text-xs text-zinc-500">{group.items.length} {group.items.length === 1 ? 'cita' : 'citas'}</p>
            </div>
            <div className="space-y-2.5">
              {group.items.map((b) => {
                const barber = getBarber(b.barber);
                const isCancelled = b.status === 'cancelled';
                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBooking(b)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedBooking(b); }}
                    className={`group flex cursor-pointer items-stretch gap-3 rounded-2xl glass-card p-3.5 transition-all duration-200 hover:border-gold/30 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-gold/5 ${
                      isCancelled ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Time block */}
                    <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-gold/5 py-2.5 border border-gold/10">
                      <span className="font-display text-base font-bold text-gold">{b.booking_time}</span>
                      <span className="text-[0.55rem] uppercase text-zinc-500">h</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* TOP: Client Name & Service */}
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-bold text-white group-hover:text-gold transition-colors">
                          {b.full_name}
                        </p>
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

                      {/* BOTTOM: Barber Photo & "Cita para [barber_name]" */}
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

                    {/* Actions & Chevron */}
                    <div className="flex items-center gap-1.5 shrink-0 self-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(b.id);
                        }}
                        aria-label="Cancelar cita"
                        title="Cancelar cita"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
                      >
                        <X className="h-4 w-4" />
                      </button>
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

              {/* Service & Barber */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl glass-card p-3.5 border border-white/5 bg-zinc-900/40">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Servicio</p>
                  <p className="mt-1 font-bold text-white text-sm truncate">{selectedBooking.service}</p>
                  <p className="mt-0.5 text-xs font-mono font-bold text-gold">{selectedBooking.service_price} €</p>
                </div>

                <div className="rounded-2xl glass-card p-3.5 border border-white/5 bg-zinc-900/40">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Barbero</p>
                  <div className="mt-1 flex items-center gap-2">
                    {getBarber(selectedBooking.barber)?.photo_url ? (
                      <img
                        src={getBarber(selectedBooking.barber)!.photo_url!}
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

              {selectedBooking.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => handleCancel(selectedBooking.id)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/10 py-2 text-xs font-semibold text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all mt-1"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Cancelar esta cita</span>
                </button>
              )}
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
    </div>
  );
}
