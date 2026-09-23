import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { BookingNotification, Barber } from '@/types';
import {
  Bell,
  CalendarCheck,
  CalendarX,
  Clock,
  RotateCcw,
  Check,
  CheckCheck,
  Search,
  Phone,
  MessageCircle,
  User,
  Users,
  Scissors,
  ArrowRight,
  Filter,
  Sparkles,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CalendarPlus,
  Eye,
  X,
  Mail,
  CalendarDays,
  ChevronDown,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { notify } from '@/lib/notify';
import { toISO } from '@/lib/schedule';

interface AdminNotificationsProps {
  barbers: Barber[];
  selectedBarber: string;
  onSelectBarber?: (barberId: string) => void;
  onRefreshBookings?: () => void;
  onNavigateToAgenda?: (date: string) => void;
}

type NotificationFilter = 'all' | 'created' | 'cancelled' | 'rescheduled';

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return 'Ahora mismo';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffHours < 24) {
      const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      return `Hoy a las ${timeStr}`;
    }
    if (diffDays === 1) {
      const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      return `Ayer a las ${timeStr}`;
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `${day}/${month}/${yy} a las ${timeStr}`;
  } catch {
    return dateStr;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const clean = dateStr.trim();
    if (clean.includes('-')) {
      const parts = clean.split('-');
      if (parts.length === 3) {
        const y = parts[0];
        const m = parts[1];
        const d = parts[2].split('T')[0];
        const yy = y.length === 4 ? y.slice(2) : y;
        return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${yy}`;
      }
    }
    if (clean.includes('/')) {
      const parts = clean.split('/');
      if (parts.length === 3) {
        const d = parts[0];
        const m = parts[1];
        const y = parts[2].split(' ')[0];
        const yy = y.length === 4 ? y.slice(2) : y;
        return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${yy}`;
      }
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function AdminNotifications({
  barbers,
  selectedBarber,
  onRefreshBookings,
  onNavigateToAgenda,
}: AdminNotificationsProps) {
  const [notifications, setNotifications] = useState<BookingNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [search, setSearch] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  const [selectedBarberFilter, setSelectedBarberFilter] = useState<string>(selectedBarber || 'all');
  const [selectedNotif, setSelectedNotif] = useState<BookingNotification | null>(null);
  const [manualBookingIds, setManualBookingIds] = useState<Set<string>>(new Set());
  const [showBarberDropdown, setShowBarberDropdown] = useState(false);

  // Keep in sync if prop changes
  useEffect(() => {
    if (selectedBarber) {
      setSelectedBarberFilter(selectedBarber);
    }
  }, [selectedBarber]);

  const selectedBarberObj = useMemo(
    () => barbers.find((b) => b.id === selectedBarberFilter),
    [barbers, selectedBarberFilter]
  );
  const selectedBarberLabel = useMemo(
    () => (selectedBarberFilter === 'all' ? 'Todos los barberos' : selectedBarberObj?.name || 'Barbero'),
    [selectedBarberFilter, selectedBarberObj]
  );

  const fetchNotifications = useCallback(async () => {
    try {
      const todayISO = toISO(new Date());

      // Automatically purge from Supabase any notifications whose scheduled appointment day has passed
      try {
        await supabase
          .from('booking_notifications')
          .delete()
          .lt('booking_date', todayISO);

        await supabase
          .from('booking_notifications')
          .delete()
          .is('booking_date', null)
          .lt('old_date', todayISO);
      } catch (delErr) {
        console.warn('Error auto-cleaning expired notifications:', delErr);
      }

      const { data, error } = await supabase
        .from('booking_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150);

      if (error) throw error;
      const rawNotifs = (data as BookingNotification[]) || [];

      // Filter in-memory to ensure past-date notifications are never shown
      const notifs = rawNotifs.filter((n) => {
        const appointmentDate = n.booking_date || n.old_date;
        return !appointmentDate || appointmentDate >= todayISO;
      });

      setNotifications(notifs);

      // Check which booking_ids correspond to manual bookings (user_id IS NULL)
      const bIds = Array.from(
        new Set(notifs.map((n) => n.booking_id).filter((id): id is string => Boolean(id)))
      );
      if (bIds.length > 0) {
        const { data: bData } = await supabase
          .from('bookings')
          .select('id, user_id')
          .in('id', bIds);
        if (bData) {
          const manualSet = new Set<string>();
          bData.forEach((b) => {
            if (!b.user_id) {
              manualSet.add(b.id);
            }
          });
          setManualBookingIds(manualSet);
        }
      }
    } catch (err) {
      console.warn('Error fetching booking notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const isManualNotification = useCallback(
    (notif: BookingNotification) => {
      if (notif.booking_id && manualBookingIds.has(notif.booking_id)) return true;
      if (!notif.client_email && !notif.booking_id) return true;
      return false;
    },
    [manualBookingIds]
  );

  useEffect(() => {
    fetchNotifications();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('booking-notifications-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'booking_notifications' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as BookingNotification;
            const todayISO = toISO(new Date());
            const appointmentDate = newNotif.booking_date || newNotif.old_date;
            if (appointmentDate && appointmentDate < todayISO) {
              return;
            }

            setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
            notify.info('Nueva Notificación', newNotif.title + ': ' + newNotif.client_name);

            if (newNotif.booking_id) {
              supabase
                .from('bookings')
                .select('id, user_id')
                .eq('id', newNotif.booking_id)
                .maybeSingle()
                .then(({ data: b }) => {
                  if (b && !b.user_id) {
                    setManualBookingIds((prev) => new Set([...prev, b.id]));
                  }
                });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as BookingNotification;
            const todayISO = toISO(new Date());
            const appointmentDate = updated.booking_date || updated.old_date;
            if (appointmentDate && appointmentDate < todayISO) {
              setNotifications((prev) => prev.filter((n) => n.id !== updated.id));
              return;
            }

            setNotifications((prev) =>
              prev.map((n) => (n.id === updated.id ? updated : n))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string })?.id;
            if (deletedId) {
              setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
            } else {
              // Bulk delete or missing replica identity: refetch to ensure 100% sync
              fetchNotifications();
            }
          } else {
            fetchNotifications();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await supabase.from('booking_notifications').update({ read: true }).eq('id', id);
    } catch (err) {
      console.warn('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await supabase
        .from('booking_notifications')
        .update({ read: true })
        .in('id', unreadIds);
      notify.success('Notificaciones al día', 'Todas las notificaciones se han marcado como leídas.');
    } catch (err) {
      console.warn('Error marking all notifications as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotification = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeletingId(id);
    const previousNotifs = [...notifications];
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      const { error } = await supabase
        .from('booking_notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
      notify.success('Notificación eliminada', 'La notificación se ha borrado correctamente.');
    } catch (err: any) {
      console.error('Error deleting notification:', err);
      setNotifications(previousNotifs);
      notify.error('Error al eliminar', err?.message || 'No se pudo eliminar la notificación.');
    } finally {
      setDeletingId(null);
    }
  };

  const clearAllNotifications = async () => {
    if (notifications.length === 0) return;
    setClearingAll(true);
    setShowClearConfirmModal(false);

    const previousNotifs = [...notifications];
    setNotifications([]);

    try {
      // Clear all notifications across all barbers from the database unconditionally
      const { error } = await supabase
        .from('booking_notifications')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      notify.success(
        'Bandeja vaciada',
        'Se han eliminado todas las notificaciones del historial del salón en todos los dispositivos.'
      );
    } catch (err: any) {
      console.error('Error clearing all notifications:', err);
      setNotifications(previousNotifs);
      notify.error('Error al limpiar notificaciones', err?.message || 'No se pudieron eliminar.');
    } finally {
      setClearingAll(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // Barber filter
      if (selectedBarberFilter !== 'all' && n.barber !== selectedBarberFilter) return false;

      // Type filter
      if (filter !== 'all' && n.type !== filter) return false;

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesClient = n.client_name?.toLowerCase().includes(q);
        const matchesPhone = n.client_phone?.toLowerCase().includes(q);
        const matchesService = n.service?.toLowerCase().includes(q);
        const matchesBarber = n.barber?.toLowerCase().includes(q);
        const matchesMsg = n.message?.toLowerCase().includes(q);
        if (!matchesClient && !matchesPhone && !matchesService && !matchesBarber && !matchesMsg) {
          return false;
        }
      }

      return true;
    });
  }, [notifications, selectedBarberFilter, filter, search]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const countCreated = useMemo(
    () => notifications.filter((n) => n.type === 'created').length,
    [notifications]
  );
  const countCancelled = useMemo(
    () => notifications.filter((n) => n.type === 'cancelled').length,
    [notifications]
  );
  const countRescheduled = useMemo(
    () => notifications.filter((n) => n.type === 'rescheduled').length,
    [notifications]
  );

  const getBarberName = (id: string) => {
    const found = barbers.find((b) => b.id === id);
    if (found) return found.name;
    if (id === 'adrian') return 'Adrián';
    if (id === 'luna') return 'David Luna';
    return id;
  };

  const getNotificationMessage = useCallback(
    (notif: BookingNotification, isManual: boolean) => {
      const dateFormatted = formatDate(notif.booking_date);
      const barberName = getBarberName(notif.barber);
      const cleanTime = notif.booking_time ? notif.booking_time.replace(/\s*h$/i, '') : '';
      const timeStr = cleanTime ? ` a las ${cleanTime}h` : '';

      if (notif.type === 'created') {
        if (isManual) {
          return `${barberName} ha reservado una cita para ${notif.client_name} para el ${dateFormatted}${timeStr}`;
        }
        return `${notif.client_name} ha reservado cita para el ${dateFormatted}${timeStr}`;
      }

      if (notif.type === 'cancelled') {
        const cancelDate = formatDate(notif.booking_date || notif.old_date);
        const cancelRawTime = notif.booking_time || notif.old_time;
        const cancelCleanTime = cancelRawTime ? cancelRawTime.replace(/\s*h$/i, '') : '';
        const cancelTimeStr = cancelCleanTime ? ` a las ${cancelCleanTime}h` : '';
        return `${notif.client_name} ha cancelado su cita del ${cancelDate}${cancelTimeStr}`;
      }

      if (notif.type === 'rescheduled') {
        const oldD = formatDate(notif.old_date);
        const oldT = notif.old_time ? notif.old_time.replace(/\s*h$/i, '') : '';
        const oldTimeStr = oldT ? ` a las ${oldT}h` : '';
        const newD = formatDate(notif.booking_date);
        const newT = notif.booking_time ? notif.booking_time.replace(/\s*h$/i, '') : '';
        const newTimeStr = newT ? ` a las ${newT}h` : '';
        const reassignText =
          notif.old_barber && notif.old_barber !== notif.barber
            ? ` (Reasignada a ${getBarberName(notif.barber)})`
            : '';
        return `Cita de ${notif.client_name} cambiada del ${oldD}${oldTimeStr} al ${newD}${newTimeStr}${reassignText}`;
      }

      return notif.message;
    },
    [barbers]
  );

  return (
    <div className="flex flex-col h-full w-full min-w-0 space-y-4">
      {/* Compact Controls Header (Space-saving, no repeated title) */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pb-2.5 border-b border-white/5">
        {/* Left: Filter Pills + Barber Dropdown immediately to the right */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-gold/20 text-gold border border-gold/40 shadow-sm'
                : 'bg-white/5 text-zinc-400 border border-white/5 hover:text-zinc-200'
            }`}
          >
            <span>Todas</span>
            <span className="rounded-full bg-black/40 px-1.5 py-0.2 text-[0.65rem] font-bold">
              {notifications.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('created')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all ${
              filter === 'created'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'bg-white/5 text-zinc-400 border border-white/5 hover:text-emerald-300'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Nuevas Citas</span>
            {countCreated > 0 && (
              <span className="rounded-full bg-emerald-950/60 px-1.5 py-0.2 text-[0.65rem] font-bold text-emerald-300">
                {countCreated}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilter('cancelled')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all ${
              filter === 'cancelled'
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                : 'bg-white/5 text-zinc-400 border border-white/5 hover:text-red-300'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-red-400" />
            <span>Cancelaciones</span>
            {countCancelled > 0 && (
              <span className="rounded-full bg-red-950/60 px-1.5 py-0.2 text-[0.65rem] font-bold text-red-300">
                {countCancelled}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilter('rescheduled')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all ${
              filter === 'rescheduled'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-white/5 text-zinc-400 border border-white/5 hover:text-amber-300'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>Cambios</span>
            {countRescheduled > 0 && (
              <span className="rounded-full bg-amber-950/60 px-1.5 py-0.2 text-[0.65rem] font-bold text-amber-300">
                {countRescheduled}
              </span>
            )}
          </button>

          {/* Separator divider */}
          {barbers.length > 0 && (
            <span className="h-4 w-px bg-white/10 mx-0.5 hidden sm:inline-block" />
          )}

          {/* Barber Dropdown (Right next to notification filters) */}
          {barbers.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowBarberDropdown((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all border ${
                  selectedBarberFilter !== 'all'
                    ? 'bg-gold/20 text-gold border border-gold/40 shadow-sm'
                    : 'bg-white/5 text-zinc-300 border border-white/10 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                {selectedBarberObj?.photo_url ? (
                  <img src={selectedBarberObj.photo_url} alt="" className="h-4 w-4 rounded-full object-cover shrink-0" />
                ) : selectedBarberFilter !== 'all' && selectedBarberObj ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full gold-gradient text-[0.5rem] font-bold text-black shrink-0">
                    {selectedBarberObj.initials}
                  </span>
                ) : (
                  <Users className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                )}
                <span className="max-w-[120px] truncate">{selectedBarberLabel}</span>
                <ChevronDown className={`h-3 w-3 text-zinc-400 transition-transform duration-200 ${showBarberDropdown ? 'rotate-180 text-gold' : ''}`} />
              </button>

              {showBarberDropdown && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowBarberDropdown(false)} />
                  <div className="absolute left-0 top-full mt-1.5 z-40 w-52 rounded-2xl border border-white/10 bg-zinc-900/98 p-1.5 shadow-2xl backdrop-blur-2xl animate-scale-in space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBarberFilter('all');
                        onSelectBarber?.('all');
                        setShowBarberDropdown(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors ${
                        selectedBarberFilter === 'all'
                          ? 'bg-gold/15 text-gold border border-gold/30'
                          : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span>Todos los barberos</span>
                      </div>
                      <span className="rounded-full bg-black/40 px-1.5 py-0.2 text-[0.6rem] font-bold text-zinc-400">
                        {notifications.length}
                      </span>
                    </button>

                    {barbers.map((b) => {
                      const barberCount = notifications.filter((n) => n.barber === b.id).length;
                      const isSelected = selectedBarberFilter === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setSelectedBarberFilter(b.id);
                            onSelectBarber?.(b.id);
                            setShowBarberDropdown(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors ${
                            isSelected
                              ? 'bg-gold/15 text-gold border border-gold/30'
                              : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {b.photo_url ? (
                              <img src={b.photo_url} alt="" className="h-4 w-4 rounded-full object-cover shrink-0" />
                            ) : (
                              <span className="flex h-4 w-4 items-center justify-center rounded-full gold-gradient text-[0.5rem] font-bold text-black shrink-0">
                                {b.initials}
                              </span>
                            )}
                            <span className="truncate">{b.name}</span>
                          </div>
                          <span className={`rounded-full px-1.5 py-0.2 text-[0.6rem] font-bold ${
                            isSelected ? 'bg-gold/30 text-gold' : 'bg-black/40 text-zinc-400'
                          }`}>
                            {barberCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Search + Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0 self-end xl:self-auto w-full xl:w-auto justify-between xl:justify-end">
          {/* Compact Search */}
          <div className="relative flex-1 sm:w-56 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente o teléfono..."
              className="w-full rounded-xl border border-white/10 bg-black/30 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-zinc-500 focus:border-gold/40 focus:outline-none"
            />
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              disabled={markingAll || clearingAll}
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition-all hover:bg-gold/10 hover:text-gold hover:border-gold/30 active:scale-95 disabled:opacity-50 shrink-0"
              title="Marcar todas como leídas"
            >
              <CheckCheck className="h-3.5 w-3.5 text-gold" />
              <span className="hidden sm:inline">Marcar leídas</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              onClick={() => setShowClearConfirmModal(true)}
              disabled={clearingAll || markingAll}
              className="inline-flex items-center gap-1 rounded-xl border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:border-red-500/40 active:scale-95 disabled:opacity-50 shrink-0"
              title="Limpiar todas las notificaciones"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          )}

          <button
            onClick={() => {
              setLoading(true);
              fetchNotifications();
            }}
            title="Refrescar notificaciones"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications list */}
      <div data-lenis-prevent className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1 pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <LoadingSpinner size="lg" label="Cargando notificaciones..." />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-white/5 bg-white/[0.01] p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-500 mb-3">
              <Bell className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-zinc-300">No hay notificaciones</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              {search
                ? `No se encontró ninguna notificación con el término "${search}"`
                : 'Todas las citas y notificaciones están al día.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const isCreated = notif.type === 'created';
            const isCancelled = notif.type === 'cancelled';
            const isRescheduled = notif.type === 'rescheduled';
            const isManual = isManualNotification(notif);

            const cleanPhone = notif.client_phone ? notif.client_phone.replace(/\s+/g, '') : null;
            const waNumber = cleanPhone ? (cleanPhone.startsWith('34') ? cleanPhone : `34${cleanPhone}`) : null;
            const waUrl = waNumber ? `https://wa.me/${waNumber}` : null;

            return (
              <div
                key={notif.id}
                className={`group relative rounded-2xl border p-4 transition-all duration-200 ${
                  !notif.read
                    ? 'bg-zinc-900/90 border-gold/30 shadow-md shadow-gold/5'
                    : 'bg-zinc-900/50 border-white/5 hover:border-white/10 hover:bg-zinc-900/80'
                }`}
              >
                {/* Unread indicator dot */}
                {!notif.read && (
                  <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-gold animate-ping" />
                )}

                <div className="flex items-start gap-3.5">
                  {/* Type icon */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isCreated
                        ? isManual
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                        : isCancelled
                        ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                    }`}
                  >
                    {isCreated && (isManual ? <CalendarPlus className="h-5 w-5" /> : <CalendarCheck className="h-5 w-5" />)}
                    {isCancelled && <CalendarX className="h-5 w-5" />}
                    {isRescheduled && <RotateCcw className="h-5 w-5" />}
                  </div>

                  {/* Body content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-[0.65rem] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                          isCreated
                            ? isManual
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : isCancelled
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {isCreated && (isManual ? 'Nueva Cita Manual' : 'Nueva Cita')}
                        {isCancelled && 'Cita Cancelada'}
                        {isRescheduled && 'Cita Modificada'}
                      </span>

                      <span className="text-[0.7rem] text-zinc-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(notif.created_at)}
                      </span>
                    </div>

                    {/* Notification message / Client name */}
                    <div className="mt-1">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {notif.client_name}
                      </h4>
                      <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                        {getNotificationMessage(notif, isManual)}
                      </p>
                    </div>

                    {/* Rescheduled comparison tag */}
                    {isRescheduled && notif.old_date && notif.old_time && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs bg-white/5 rounded-xl px-3 py-1.5 border border-white/5 w-fit">
                        <span className="text-zinc-500 line-through">
                          {formatDate(notif.old_date)} · {notif.old_time.replace(/\s*h$/i, '')}h
                        </span>
                        <ArrowRight className="h-3 w-3 text-amber-400" />
                        <span className="font-semibold text-amber-300 font-mono">
                          {formatDate(notif.booking_date)} · {notif.booking_time ? `${notif.booking_time.replace(/\s*h$/i, '')}h` : ''}
                        </span>
                      </div>
                    )}

                    {/* Details row: Barber, Service without price, Date */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-zinc-500" />
                        <span>Barbero:</span>
                        <strong className="text-zinc-200">
                          {getBarberName(notif.barber)}
                        </strong>
                      </div>

                      {notif.service && (
                        <div className="flex items-center gap-1.5">
                          <Scissors className="h-3.5 w-3.5 text-zinc-500" />
                          <span>Servicio:</span>
                          <span className="text-zinc-200 font-medium">
                            {notif.service}
                          </span>
                        </div>
                      )}

                      {notif.booking_date && !isRescheduled && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-zinc-500" />
                          <span>Fecha:</span>
                          <span className="text-zinc-200 font-medium">
                            {formatDate(notif.booking_date)} a las {notif.booking_time ? `${notif.booking_time.replace(/\s*h$/i, '')}h` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons footer */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                      {/* Ver detalles button */}
                      <button
                        type="button"
                        onClick={() => setSelectedNotif(notif)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gold/10 px-2.5 py-1 text-[0.7rem] font-semibold text-gold hover:bg-gold/20 active:scale-95 transition-all"
                        title="Ver todos los detalles de esta cita"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Ver detalles</span>
                      </button>

                      {/* WhatsApp contact */}
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}

                      {/* Phone call */}
                      {notif.client_phone && (
                        <a
                          href={`tel:${notif.client_phone}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-[0.7rem] font-semibold text-zinc-300 hover:bg-white/10 transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          <span>{notif.client_phone}</span>
                        </a>
                      )}

                      {/* Action buttons on the right: Mark as read & Delete single */}
                      <div className="ml-auto flex items-center gap-1.5">
                        {!notif.read && (
                          <button
                            type="button"
                            onClick={() => markAsRead(notif.id)}
                            className="inline-flex items-center gap-1 rounded-lg text-[0.7rem] font-medium text-zinc-400 hover:text-gold hover:bg-gold/10 transition-colors py-1 px-2 active:scale-95"
                            title="Marcar como leída"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Marcar leída</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => deleteNotification(notif.id, e)}
                          disabled={deletingId === notif.id}
                          className="inline-flex items-center gap-1 rounded-lg text-[0.7rem] font-medium text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors py-1 px-2 active:scale-95 disabled:opacity-50"
                          title="Eliminar esta notificación"
                        >
                          {deletingId === notif.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal for Clearing All Notifications */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">¿Limpiar todas las notificaciones?</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Esta acción no se puede deshacer.</p>
              </div>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">
              Se eliminarán de forma permanente todas las{' '}
              <strong className="text-white font-semibold">{notifications.length}</strong>{' '}
              notificaciones del historial del salón en la base de datos para todos los barberos y dispositivos.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                disabled={clearingAll}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={clearAllNotifications}
                disabled={clearingAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 active:scale-95 transition-all shadow-lg shadow-red-900/30 disabled:opacity-50"
              >
                {clearingAll ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>{clearingAll ? 'Eliminando...' : 'Sí, eliminar todas'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Detail Modal in AdminNotifications */}
      {selectedNotif && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-md animate-fade-in"
              onClick={() => setSelectedNotif(null)}
            />
            <div
              data-lenis-prevent
              className="relative z-10 my-auto flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-gold/20 bg-zinc-950/95 p-4 sm:p-6 shadow-2xl shadow-gold/5 backdrop-blur-xl animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      selectedNotif.type === 'created'
                        ? isManualNotification(selectedNotif)
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : selectedNotif.type === 'cancelled'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {selectedNotif.type === 'created' && (
                      isManualNotification(selectedNotif) ? <CalendarPlus className="h-5 w-5" /> : <CalendarCheck className="h-5 w-5" />
                    )}
                    {selectedNotif.type === 'cancelled' && <CalendarX className="h-5 w-5" />}
                    {selectedNotif.type === 'rescheduled' && <RotateCcw className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[0.65rem] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                          selectedNotif.type === 'created'
                            ? isManualNotification(selectedNotif)
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : selectedNotif.type === 'cancelled'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {selectedNotif.type === 'created' && (
                          isManualNotification(selectedNotif) ? 'Nueva Cita Manual' : 'Nueva Cita'
                        )}
                        {selectedNotif.type === 'cancelled' && 'Cita Cancelada'}
                        {selectedNotif.type === 'rescheduled' && 'Cita Modificada'}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-white mt-1">
                      Detalle de Cita
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedNotif(null)}
                  className="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Cerrar ventana"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1 text-xs">
                {/* Reschedule alert banner */}
                {selectedNotif.type === 'rescheduled' && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2.5">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                      <RotateCcw className="h-4 w-4" />
                      <span>Cambio de Horario / Reasignación</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="rounded-xl bg-black/40 p-2.5 border border-white/5 space-y-1">
                        <span className="text-[0.65rem] font-bold uppercase tracking-wider text-zinc-500">
                          Anterior
                        </span>
                        <p className="font-mono text-zinc-400 line-through">
                          {formatDate(selectedNotif.old_date)} · {selectedNotif.old_time} h
                        </p>
                        {selectedNotif.old_barber && (
                          <p className="text-[0.7rem] text-zinc-500">
                            Barbero: {getBarberName(selectedNotif.old_barber)}
                          </p>
                        )}
                      </div>
                      <div className="rounded-xl bg-amber-500/20 p-2.5 border border-amber-500/40 space-y-1">
                        <span className="text-[0.65rem] font-bold uppercase tracking-wider text-amber-400">
                          Nuevo Horario
                        </span>
                        <p className="font-mono font-bold text-amber-200">
                          {formatDate(selectedNotif.booking_date)} · {selectedNotif.booking_time} h
                        </p>
                        <p className="text-[0.7rem] text-amber-300">
                          Barbero: {getBarberName(selectedNotif.barber)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cancelled alert banner */}
                {selectedNotif.type === 'cancelled' && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 flex items-start gap-3">
                    <CalendarX className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-red-300 text-sm">Cita Anulada</p>
                      <p className="text-zinc-300 mt-0.5 leading-relaxed">
                        Esta cita fue cancelada para el{' '}
                        <strong className="text-white">
                          {formatDate(selectedNotif.booking_date || selectedNotif.old_date)}
                        </strong>{' '}
                        a las{' '}
                        <strong className="text-white">
                          {selectedNotif.booking_time || selectedNotif.old_time} h
                        </strong>
                        . El hueco está disponible de nuevo en la agenda.
                      </p>
                    </div>
                  </div>
                )}

                {/* Created banner */}
                {selectedNotif.type === 'created' && (
                  <div
                    className={`rounded-2xl border p-3.5 flex items-start gap-3 ${
                      isManualNotification(selectedNotif)
                        ? 'border-blue-500/30 bg-blue-500/10'
                        : 'border-emerald-500/30 bg-emerald-500/10'
                    }`}
                  >
                    {isManualNotification(selectedNotif) ? (
                      <CalendarPlus className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                    ) : (
                      <CalendarCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p
                        className={`font-bold text-sm ${
                          isManualNotification(selectedNotif) ? 'text-blue-300' : 'text-emerald-300'
                        }`}
                      >
                        {isManualNotification(selectedNotif) ? 'Nueva Cita Manual' : 'Nueva Cita Reservada'}
                      </p>
                      <p className="text-zinc-300 mt-0.5 leading-relaxed">
                        Programada para el{' '}
                        <strong className="text-white">{formatDate(selectedNotif.booking_date)}</strong>{' '}
                        a las <strong className="text-white">{selectedNotif.booking_time ? `${selectedNotif.booking_time.replace(/\s*h$/i, '')}h` : ''}</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Client Data Box */}
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.65rem] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                      <User className="h-3 w-3 text-gold" />
                      Datos del Cliente
                    </span>
                    <span className="text-[0.65rem] text-zinc-500">
                      {isManualNotification(selectedNotif) ? 'Añadida manualmente' : 'Cliente registrado'}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-white">{selectedNotif.client_name}</h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
                    {selectedNotif.client_phone ? (
                      <>
                        <a
                          href={`tel:${selectedNotif.client_phone}`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5 text-gold" />
                          <span>Llamar: {selectedNotif.client_phone}</span>
                        </a>

                        <a
                          href={`https://wa.me/${
                            selectedNotif.client_phone.replace(/\s+/g, '').startsWith('34')
                              ? selectedNotif.client_phone.replace(/\s+/g, '')
                              : `34${selectedNotif.client_phone.replace(/\s+/g, '')}`
                          }`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25 transition-colors border border-emerald-500/20"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      </>
                    ) : (
                      <span className="text-zinc-500 italic text-xs">Sin teléfono indicado</span>
                    )}

                    {selectedNotif.client_email && (
                      <a
                        href={`mailto:${selectedNotif.client_email}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10 transition-colors"
                      >
                        <Mail className="h-3.5 w-3.5 text-zinc-400" />
                        <span className="truncate max-w-[200px]">{selectedNotif.client_email}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Appointment Data Box */}
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3.5 space-y-2.5">
                  <span className="text-[0.65rem] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                    <Scissors className="h-3 w-3 text-gold" />
                    Servicio y Asignación
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div className="space-y-1">
                      <span className="text-[0.65rem] text-zinc-500">Servicio</span>
                      <p className="font-semibold text-white">
                        {selectedNotif.service || 'Servicio no especificado'}
                      </p>
                      {selectedNotif.service_price && (
                        <p className="text-gold font-bold">{selectedNotif.service_price} €</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[0.65rem] text-zinc-500">Barbero Asignado</span>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const b = barbers.find((x) => x.id === selectedNotif.barber);
                          return (
                            <>
                              {b?.photo_url ? (
                                <img src={b.photo_url} alt="" className="h-6 w-6 rounded-full object-cover ring-1 ring-gold/30" />
                              ) : (
                                <div className="h-6 w-6 rounded-full gold-gradient flex items-center justify-center text-[0.6rem] font-bold text-black">
                                  {b?.initials || 'AM'}
                                </div>
                              )}
                              <span className="font-semibold text-zinc-200">
                                {b?.name || getBarberName(selectedNotif.barber)}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* System Activity Log & Timestamp */}
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-3 space-y-1">
                  <div className="flex items-center justify-between text-[0.65rem] text-zinc-500">
                    <span>Mensaje del sistema</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(selectedNotif.created_at)}
                    </span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed">
                    {getNotificationMessage(selectedNotif, isManualNotification(selectedNotif))}
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-white/5 pt-4">
                {selectedNotif.booking_date && onNavigateToAgenda && (
                  <button
                    type="button"
                    onClick={() => {
                      const d = selectedNotif.booking_date;
                      setSelectedNotif(null);
                      if (d) onNavigateToAgenda(d);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-gold/15 px-3.5 py-2 text-xs font-bold text-gold hover:bg-gold/25 transition-all border border-gold/30 active:scale-95"
                  >
                    <CalendarDays className="h-4 w-4" />
                    <span>Ver en agenda</span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  {!selectedNotif.read && (
                    <button
                      type="button"
                      onClick={() => {
                        markAsRead(selectedNotif.id);
                        setSelectedNotif((prev) => (prev ? { ...prev, read: true } : null));
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10 transition-colors active:scale-95"
                    >
                      <Check className="h-3.5 w-3.5 text-gold" />
                      <span>Marcar leída</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedNotif(null)}
                    className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 transition-colors active:scale-95"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
