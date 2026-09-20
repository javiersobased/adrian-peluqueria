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
  Scissors,
  ArrowRight,
  Filter,
  Sparkles,
  RefreshCw,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { notify } from '@/lib/notify';

interface AdminNotificationsProps {
  barbers: Barber[];
  selectedBarber: string;
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
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
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

  const fetchNotifications = useCallback(async () => {
    try {
      let query = supabase
        .from('booking_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedBarber !== 'all') {
        query = query.eq('barber', selectedBarber);
      }

      const { data, error } = await query;
      if (error) throw error;
      setNotifications((data as BookingNotification[]) || []);
    } catch (err) {
      console.warn('Error fetching booking notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBarber]);

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
            setNotifications((prev) => [newNotif, ...prev]);
            notify.info('Nueva Notificación', newNotif.title + ': ' + newNotif.client_name);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as BookingNotification;
            setNotifications((prev) =>
              prev.map((n) => (n.id === updated.id ? updated : n))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string })?.id;
            if (deletedId) {
              setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
            } else {
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
      let query = supabase.from('booking_notifications').delete();
      if (selectedBarber !== 'all') {
        query = query.eq('barber', selectedBarber);
      } else {
        query = query.neq('id', '00000000-0000-0000-0000-000000000000');
      }

      const { error } = await query;
      if (error) throw error;

      notify.success(
        'Bandeja vaciada',
        selectedBarber !== 'all'
          ? `Se han eliminado las notificaciones del barbero seleccionado.`
          : 'Todas las notificaciones se han eliminado correctamente.'
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
  }, [notifications, filter, search]);

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

  return (
    <div className="flex flex-col h-full w-full min-w-0 space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Bell className="h-5 w-5 text-gold" />
              Centro de Notificaciones
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-bold text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              En directo
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Historial en tiempo real de citas nuevas, cancelaciones y modificaciones de horario
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              disabled={markingAll || clearingAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-all hover:bg-gold/10 hover:text-gold hover:border-gold/30 active:scale-95 disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Marcar todas como leídas</span>
              <span className="sm:hidden">Marcar leídas</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              onClick={() => setShowClearConfirmModal(true)}
              disabled={clearingAll || markingAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:border-red-500/40 active:scale-95 disabled:opacity-50"
              title="Limpiar todas las notificaciones"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Limpiar todas</span>
              <span className="sm:hidden">Limpiar</span>
            </button>
          )}

          <button
            onClick={() => {
              setLoading(true);
              fetchNotifications();
            }}
            title="Refrescar notificaciones"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Type pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
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
            onClick={() => setFilter('created')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
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
            onClick={() => setFilter('cancelled')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
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
            onClick={() => setFilter('rescheduled')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              filter === 'rescheduled'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-white/5 text-zinc-400 border border-white/5 hover:text-amber-300'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>Cambios de Horario</span>
            {countRescheduled > 0 && (
              <span className="rounded-full bg-amber-950/60 px-1.5 py-0.2 text-[0.65rem] font-bold text-amber-300">
                {countRescheduled}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente o teléfono..."
            className="w-full rounded-xl border border-white/10 bg-black/30 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-zinc-500 focus:border-gold/40 focus:outline-none"
          />
        </div>
      </div>

      {/* Notifications list */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[350px]">
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
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                        : isCancelled
                        ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                    }`}
                  >
                    {isCreated && <CalendarCheck className="h-5 w-5" />}
                    {isCancelled && <CalendarX className="h-5 w-5" />}
                    {isRescheduled && <RotateCcw className="h-5 w-5" />}
                  </div>

                  {/* Body content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-[0.65rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isCreated
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : isCancelled
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {isCreated && 'Nueva Cita'}
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
                        {notif.message}
                      </p>
                    </div>

                    {/* Rescheduled comparison tag */}
                    {isRescheduled && notif.old_date && notif.old_time && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs bg-white/5 rounded-xl px-3 py-1.5 border border-white/5 w-fit">
                        <span className="text-zinc-500 line-through">
                          {formatDate(notif.old_date)} · {notif.old_time}h
                        </span>
                        <ArrowRight className="h-3 w-3 text-amber-400" />
                        <span className="font-semibold text-amber-300 font-mono">
                          {formatDate(notif.booking_date)} · {notif.booking_time}h
                        </span>
                      </div>
                    )}

                    {/* Details row: Barber, Service, Price */}
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
                            {notif.service_price ? ` (${notif.service_price} €)` : ''}
                          </span>
                        </div>
                      )}

                      {notif.booking_date && !isRescheduled && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-zinc-500" />
                          <span>Fecha:</span>
                          <span className="text-zinc-200 font-medium">
                            {formatDate(notif.booking_date)} a las {notif.booking_time}h
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons footer */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
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
              Se eliminarán de forma permanente las{' '}
              <strong className="text-white font-semibold">{notifications.length}</strong>{' '}
              notificaciones actuales del registro
              {selectedBarber !== 'all' ? (
                <> para el barbero <strong className="text-gold font-semibold">{getBarberName(selectedBarber)}</strong></>
              ) : ''}.
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
    </div>
  );
}
