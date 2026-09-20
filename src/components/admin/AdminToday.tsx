import { CalendarDays, CalendarClock, Clock, Scissors, Phone, X, ChevronDown, ChevronUp, History, CheckCircle2, Trash2, PhoneCall, User, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { SavedBooking, Barber } from '@/types';
import { MONTH_SHORT, WEEKDAY_SHORT, toISO } from '@/lib/schedule';
import { useEffect, useState, useMemo } from 'react';
import { notify } from '@/lib/notify';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ReorganizeBookingModal } from '@/components/admin/ReorganizeBookingModal';
import { CustomerDetailModal } from '@/components/admin/CustomerDetailModal';
import { getWhatsAppUrl, getCallUrl } from '@/lib/phoneActions';
import { WhatsAppIcon } from '@/components/icons';
import { notifyBookingCancelled } from '@/lib/notifications';
import { ModalPortal } from '@/components/ui/ModalPortal';

interface AdminTodayProps {
  bookings: SavedBooking[];
  loading: boolean;
  onRefresh: () => void;
  currentBarber?: Barber | null;
  selectedBarber?: string;
}

export function AdminToday({
  bookings,
  loading,
  onRefresh,
  currentBarber,
  selectedBarber = 'all',
}: AdminTodayProps) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [showPastBookings, setShowPastBookings] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<SavedBooking | null>(null);
  const [reorganizingBooking, setReorganizingBooking] = useState<SavedBooking | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    user_id?: string | null;
    full_name: string;
    phone: string;
    email?: string | null;
    comments?: string | null;
  } | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  const formatDateFull = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} de ${MONTH_SHORT[d.getMonth()]} de ${d.getFullYear()}`;
  };

  const formatCreatedAt = (iso?: string | null) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleString('es-ES', {
        timeZone: 'Europe/Madrid',
        day: 'numeric',
        month: 'short',
        year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  };

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

  // Resolved barber profile currently in use
  const activeBarberProfile = useMemo(() => {
    if (currentBarber) return currentBarber;
    if (selectedBarber && selectedBarber !== 'all') {
      const found = barbers.find((b) => b.id === selectedBarber);
      if (found) return found;
    }
    const adrian = barbers.find((b) => b.id === 'adrian');
    if (adrian) return adrian;
    return barbers[0] || null;
  }, [currentBarber, selectedBarber, barbers]);

  const activeBarberFirstName = activeBarberProfile?.name?.split(' ')[0] || 'Adrián';
  const activeBarberSubtitle =
    selectedBarber === 'all'
      ? 'Salón Activo · Todo el salón'
      : `Vista: ${activeBarberProfile?.name || 'Barbero'}`;

  // All active bookings for today
  const allTodayBookings = bookings
    .filter((b) => {
      if (b.booking_date !== todayISO || b.status === 'cancelled') return false;
      if (selectedBarber && selectedBarber !== 'all') {
        return b.barber === selectedBarber;
      }
      return true;
    })
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
      const target = allTodayBookings.find((b) => b.id === id);
      const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
      notify.success('Cita cancelada', 'La cita se ha cancelado correctamente');
      if (target) {
        notifyBookingCancelled(target, getBarber(target.barber)).catch(console.error);
      }
      onRefresh();
    } catch (err: any) {
      console.error('Error al cancelar cita:', err);
      notify.error('Error al cancelar', err?.message || 'No se pudo cancelar la cita');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    const target = bookings.find((b) => b.id === id) || (selectedBooking?.id === id ? selectedBooking : null);
    const clientLabel = target ? ` de ${target.full_name} (${target.email || target.phone})` : '';
    if (!confirm(`¿Eliminar por completo la cita${clientLabel} de la base de datos?\n\nEsta acción es irreversible y enviará la notificación y correo de cancelación al cliente.`)) return;
    try {
      if (target) {
        await notifyBookingCancelled(target, getBarber(target.barber), 'Cita eliminada de la agenda por la administración').catch((err) => {
          console.warn('[handlePermanentDelete] Error notificando al cliente:', err);
        });
      }
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
      notify.success(
        'Cita eliminada definitivamente',
        target?.email
          ? `El registro se ha borrado y se notificó por correo a ${target.email}`
          : 'El registro se ha borrado y se notificó al cliente'
      );
      if (selectedBooking?.id === id) {
        setSelectedBooking(null);
      }
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
    <div className="mx-auto max-w-6xl w-full min-w-0 space-y-3 sm:space-y-4">
      {/* Stats cards: Profile on Left, Citas hoy in Middle, Próxima cita on Right */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3">
        {/* Card 1 (Left): Vista del perfil de barbero activo con bienvenida */}
        <div className="rounded-2xl glass-card p-3 sm:p-3.5 relative overflow-hidden flex items-center gap-3 col-span-2 md:col-span-1 border border-white/5 bg-zinc-900/40">
          <div className="relative shrink-0">
            {activeBarberProfile?.photo_url ? (
              <img
                src={activeBarberProfile.photo_url}
                alt={activeBarberProfile.name}
                className="h-11 w-11 sm:h-12 sm:w-12 rounded-full object-cover ring-2 ring-gold/40 shadow-md"
              />
            ) : (
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full gold-gradient font-display text-xs sm:text-sm font-black text-black shadow-md">
                {activeBarberProfile?.initials || 'AM'}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-zinc-950 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-gold">
              Sesión activa
            </p>
            <h4 className="font-display text-base sm:text-lg font-bold text-white tracking-tight truncate leading-tight mt-0.5">
              ¡Bienvenido, {activeBarberFirstName}!
            </h4>
            <p className="text-[0.68rem] text-zinc-400 font-medium truncate mt-0.5">
              {activeBarberSubtitle}
            </p>
          </div>
        </div>

        {/* Card 2 (Middle): Citas hoy */}
        <StatCard
          label="Citas hoy"
          value={upcomingBookings.length}
          badge={pastBookings.length > 0 ? `-${pastBookings.length}` : undefined}
          badgeTitle={`${pastBookings.length} cita${pastBookings.length > 1 ? 's ya pasaron' : ' ya pasó'} hoy`}
        />

        {/* Card 3 (Right): Próxima cita */}
        <StatCard
          label="Próxima cita"
          value={nextBookingTime}
          subtext={nextBookingTime !== '—' ? 'Siguiente turno' : 'Sin más turnos'}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-gold" />
          <h3 className="font-display text-lg sm:text-xl font-bold text-white">Citas de hoy · {dateLabel}</h3>
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
                onClick={() => setSelectedBooking(b)}
                className={`flex items-start gap-2.5 sm:gap-3 rounded-2xl glass-card p-2.5 sm:p-3 transition-all hover:border-gold/30 cursor-pointer ${
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
                        onClick={(e) => e.stopPropagation()}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setReorganizingBooking(b);
                    }}
                    aria-label="Reorganizar cita"
                    title="Reorganizar cita (cambiar hora o sugerir cambio al cliente)"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 hover:scale-105 active:scale-95 transition-all shadow-sm shadow-gold/5"
                  >
                    <CalendarClock className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePermanentDelete(b.id);
                    }}
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
                    onClick={() => setSelectedBooking(b)}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-zinc-950/40 p-3 opacity-60 transition-opacity hover:opacity-100 cursor-pointer"
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
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReorganizingBooking(b);
                        }}
                        aria-label="Reorganizar cita"
                        title="Reorganizar cita (reprogramar a otro día u hora)"
                        className="text-zinc-500 hover:text-gold transition-colors p-1 rounded hover:bg-gold/10"
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePermanentDelete(b.id);
                        }}
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

      {/* Appointment Detail Modal in AdminToday */}
      {selectedBooking && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setSelectedBooking(null)} />
            <div 
              data-lenis-prevent
              className="relative z-10 my-auto flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-gold/20 bg-zinc-950/95 p-4 sm:p-6 shadow-2xl shadow-gold/5 backdrop-blur-xl animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3 sm:pb-4 shrink-0">
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
                  {selectedBooking.created_at && formatCreatedAt(selectedBooking.created_at) && (
                    <p className="text-xs text-zinc-400 flex items-center gap-1.5 pt-0.5">
                      <CalendarClock className="h-3.5 w-3.5 text-gold/80 shrink-0" />
                      <span>Reservada el <strong className="text-zinc-200">{formatCreatedAt(selectedBooking.created_at)} h</strong></span>
                    </p>
                  )}
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
              <div data-lenis-prevent className="my-3 sm:my-4 space-y-4 text-sm flex-1 overflow-y-auto pr-1">
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
              <div className="space-y-2 border-t border-white/10 pt-3 sm:pt-4 shrink-0">
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={getWhatsAppUrl(
                      selectedBooking.phone,
                      `¡Hola ${selectedBooking.full_name}! Te contactamos de Peluquería Adrián sobre tu cita de hoy a las ${selectedBooking.booking_time}h.`
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
                  onClick={async () => {
                    const id = selectedBooking.id;
                    await handleCancel(id);
                    setSelectedBooking(null);
                  }}
                  className="w-full text-center text-[0.7rem] text-zinc-500 hover:text-red-400 py-1 transition-colors"
                >
                  Cancelar esta cita (marcar cancelada)
                </button>

                {/* Permanent Delete */}
                <button
                  type="button"
                  onClick={async () => {
                    const id = selectedBooking.id;
                    await handlePermanentDelete(id);
                    setSelectedBooking(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/10 py-2 text-xs font-semibold text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all mt-1 shadow-sm shadow-red-950/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar por completo de la base de datos</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Customer Detail / History Modal */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
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
    <div className={`rounded-2xl glass-card p-3 sm:p-3.5 relative overflow-hidden ${className ?? ''}`}>
      <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">{value}</p>
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
