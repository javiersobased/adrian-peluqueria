import { useState, useEffect, useCallback } from 'react';
import type { SavedBooking, Barber } from '@/types';
import { safeInitial } from '@/lib/calendar';
import { ArrowLeft, Calendar, Clock, Scissors, X, Phone, CalendarClock, Check, Trash2, AlertTriangle, CalendarPlus } from 'lucide-react';
import { MONTH_SHORT, WEEKDAY_SHORT } from '@/lib/schedule';
import { fetchMyBookings, rescheduleBooking } from '@/lib/myBookings';
import { supabase } from '@/lib/supabase';
import { DateTimeStep } from '@/components/DateTimeStep';
import { deleteUserAccount } from '@/lib/terms';
import { notifyBookingCancelled, notifyBookingRescheduled } from '@/lib/notifications';

interface MyBookingsProps {
  onBack: () => void;
  onBook?: () => void;
  userEmail?: string | null;
  userId?: string | null;
  onSignOut?: () => Promise<void>;
}

const CANCEL_THRESHOLD_HOURS = 3;

export function MyBookings({ onBack, onBook, userEmail, userId, onSignOut }: MyBookingsProps) {
  const [bookings, setBookings] = useState<SavedBooking[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [reschedulingBooking, setReschedulingBooking] = useState<SavedBooking | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [data, { data: barberData }] = await Promise.all([
        fetchMyBookings(userId, userEmail),
        supabase.from('barbers').select('*'),
      ]);
      setBookings(data);
      setBarbers((barberData as Barber[]) ?? []);
      setLoading(false);
    })();
  }, [userId, userEmail]);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 3500);
    return () => clearTimeout(t);
  }, [successMessage]);

  const getBarber = useCallback((id: string): Barber => {
    const found = barbers.find((b) => b.id === id);
    if (found) return found;
    const adrian = barbers.find((b) => b.id === 'adrian');
    if (adrian) return adrian;
    if (barbers.length > 0) return barbers[0];
    return {
      id: id || 'adrian',
      name: 'Adrián Millán',
      role: 'Barbero',
      initials: 'AM',
      active: true,
      sort_order: 1,
    };
  }, [barbers]);

  const canCancel = (date: string, time: string): boolean => {
    const appointment = new Date(`${date}T${time}:00`);
    const diff = appointment.getTime() - Date.now();
    return diff > CANCEL_THRESHOLD_HOURS * 60 * 60 * 1000;
  };

  const handleCancel = useCallback(async (id: string) => {
    if (cancellingId === id) return;
    if (!confirm('¿Seguro que quieres cancelar esta cita?')) return;
    const target = bookings.find((b) => b.id === id);
    if (target?.status === 'cancelled') return;
    setCancellingId(id);
    try {
      await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
      setBookings((prev) => prev.filter((b) => b.id !== id));
      if (target) {
        await notifyBookingCancelled({ ...target, status: 'cancelled' }, getBarber(target.barber)).catch(console.error);
      }
    } finally {
      setCancellingId(null);
    }
  }, [bookings, getBarber, cancellingId]);

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
          notifyBookingRescheduled(
            updated,
            reschedulingBooking.booking_date,
            reschedulingBooking.booking_time,
            undefined,
            getBarber(updated.barber)
          ).catch(console.error);
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

  const handleDeleteAccount = useCallback(async () => {
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      let uid = userId;
      if (!uid) {
        const { data: sessionData } = await supabase.auth.getSession();
        uid = sessionData.session?.user.id;
      }
      if (!uid) throw new Error('No se pudo identificar la sesión actual.');

      const res = await deleteUserAccount(uid, userEmail);
      if (!res.success) throw new Error(res.error || 'Error al eliminar cuenta.');

      setShowDeleteModal(false);
      if (onSignOut) {
        await onSignOut();
      } else {
        await supabase.auth.signOut();
        onBack();
      }
    } catch (err) {
      console.error('Error al eliminar cuenta:', err);
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar la cuenta. Inténtalo de nuevo.');
    } finally {
      setDeletingAccount(false);
    }
  }, [userId, userEmail, onSignOut, onBack]);

  const handleGoToBooking = useCallback(() => {
    if (onBook) {
      onBook();
      return;
    }
    if (typeof window !== 'undefined') {
      if (window.location.hostname.startsWith('citas.')) {
        window.location.href = 'https://adrianmillan.es/reservas';
        return;
      }
      window.location.href = '/reservas';
    }
  }, [onBook]);

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
          service={reschedulingBooking.service}
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
          <div className="self-start shrink-0 inline-flex items-baseline justify-center rounded-xl bg-gold/10 px-2 sm:px-2.5 py-1 sm:py-1.5 border border-gold/20 shadow-sm">
            <span className="font-display text-xs sm:text-sm font-bold text-gold tracking-tight">{b.booking_time}</span>
            <span className="ml-0.5 text-[0.6rem] sm:text-[0.65rem] font-semibold text-gold/70 lowercase">h</span>
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
            <p className="mt-4 text-base font-bold text-white">No tienes citas reservadas</p>
            <p className="mt-1 text-xs text-zinc-400">Cuando reserves una cita, aparecerá aquí.</p>
            <button
              type="button"
              onClick={handleGoToBooking}
              className="mt-6 inline-flex items-center gap-2 rounded-full gold-gradient px-6 py-3 text-xs font-bold uppercase tracking-wider text-black shadow-lg shadow-gold/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <CalendarPlus className="h-4 w-4 text-black" />
              <span>Reserva tu cita</span>
            </button>
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

        {/* Apartado de eliminar cuenta discreto abajo a la derecha */}
        <div className="mt-16 pt-8 pb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="group inline-flex items-center gap-1.5 text-[0.7rem] text-zinc-600 hover:text-red-400/80 transition-colors"
            title="Eliminar mi cuenta y datos personales"
          >
            <Trash2 className="h-3 w-3 opacity-50 group-hover:opacity-100" />
            <span>Eliminar cuenta</span>
          </button>
        </div>
      </div>

      {/* Modal de confirmación para eliminar cuenta */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={() => !deletingAccount && setShowDeleteModal(false)}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-red-500/30 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl animate-scale-in text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="font-display text-lg font-bold text-white">¿Eliminar tu cuenta de cliente?</h3>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Esta acción borrará tus datos personales de contacto de nuestro sistema, cancelará tus citas futuras programadas y cerrará tu sesión de inmediato. Esta acción no se puede deshacer.
            </p>

            {deleteError && (
              <p className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2.5">
                {deleteError}
              </p>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingAccount}
                className="flex-1 rounded-full border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="flex-1 rounded-full bg-red-600 hover:bg-red-500 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-red-600/20"
              >
                {deletingAccount ? 'Eliminando...' : 'Sí, eliminar cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
