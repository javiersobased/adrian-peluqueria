import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { SavedBooking, Barber } from '@/types';
import { WEEKDAY_SHORT, MONTH_SHORT } from '@/lib/schedule';
import { getWhatsAppUrl, getCallUrl } from '@/lib/phoneActions';
import { WhatsAppIcon } from '@/components/icons';
import { 
  X, 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar, 
  Scissors, 
  User, 
  TrendingUp, 
  Award, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Sparkles
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export interface CustomerDetailModalProps {
  customer: {
    user_id?: string | null;
    full_name: string;
    phone: string;
    email?: string | null;
    comments?: string | null;
    created_at?: string;
  } | null;
  onClose: () => void;
}

export function CustomerDetailModal({ customer, onClose }: CustomerDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<SavedBooking[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);

  useEffect(() => {
    if (!customer) return;
    let active = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const [barbersList, bookingsRes] = await Promise.all([
          fetchAllBarbers(),
          (async () => {
            let q = supabase.from('bookings').select('*');
            if (customer.user_id) {
              q = q.or(`user_id.eq.${customer.user_id},phone.eq.${customer.phone}`);
            } else {
              q = q.eq('phone', customer.phone);
            }
            return await q.order('booking_date', { ascending: false }).order('booking_time', { ascending: false });
          })()
        ]);
        if (!active) return;
        setBarbers(barbersList);
        setBookings(bookingsRes.data || []);
      } catch (err) {
        console.error('Error cargando historial del cliente:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => { active = false; };
  }, [customer]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const stats = useMemo(() => {
    const total = bookings.length;
    const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
    const active = total - cancelled;
    const totalSpent = bookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((acc, b) => acc + (Number(b.service_price) || 0), 0);

    // Favorite service
    const serviceCounts: Record<string, number> = {};
    bookings.forEach((b) => {
      if (b.service) {
        serviceCounts[b.service] = (serviceCounts[b.service] || 0) + 1;
      }
    });
    let favoriteService: { name: string; count: number } | null = null;
    for (const [name, count] of Object.entries(serviceCounts)) {
      if (!favoriteService || count > favoriteService.count) {
        favoriteService = { name, count };
      }
    }

    // Favorite barber
    const barberCounts: Record<string, number> = {};
    bookings.forEach((b) => {
      if (b.barber) {
        barberCounts[b.barber] = (barberCounts[b.barber] || 0) + 1;
      }
    });
    let topBarberId: string | null = null;
    let topBarberCount = 0;
    for (const [id, count] of Object.entries(barberCounts)) {
      if (count > topBarberCount) {
        topBarberId = id;
        topBarberCount = count;
      }
    }
    const favoriteBarber = topBarberId ? barbers.find((b) => b.id === topBarberId) : null;

    return {
      total,
      cancelled,
      active,
      totalSpent,
      favoriteService,
      favoriteBarber,
      favoriteBarberCount: topBarberCount,
    };
  }, [bookings, barbers]);

  if (!customer) return null;

  const formatDateLabel = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  };

  const getBarber = (id: string) => barbers.find((b) => b.id === id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      <div 
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-gold/20 bg-zinc-950/95 shadow-2xl shadow-gold/5 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-white/10 bg-zinc-900/60 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl gold-gradient font-display text-lg font-bold text-black shadow-lg shadow-gold/20">
                {customer.full_name ? customer.full_name.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-bold text-white md:text-xl">
                    {customer.full_name}
                  </h3>
                  {customer.user_id && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-400 border border-emerald-500/20">
                      <Sparkles className="h-2.5 w-2.5" /> Cuenta Google
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-gold" />
                    <span>{customer.phone}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-zinc-500" />
                      <span className="text-zinc-400">{customer.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Action Buttons: WhatsApp y Call */}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <a
              href={getWhatsAppUrl(customer.phone, `¡Hola ${customer.full_name}! Te escribimos de Peluquería Adrián...`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-400 border border-emerald-500/30 transition-all hover:bg-emerald-500/25 active:scale-95 shadow-sm shadow-emerald-900/30"
            >
              <WhatsAppIcon className="h-4 w-4 fill-current text-emerald-400" />
              <span>Contactar por WhatsApp</span>
            </a>

            <a
              href={getCallUrl(customer.phone)}
              className="inline-flex items-center gap-2 rounded-xl bg-gold/15 px-3.5 py-2 text-xs font-semibold text-gold border border-gold/30 transition-all hover:bg-gold/25 active:scale-95 shadow-sm shadow-gold/10"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>Llamar al cliente</span>
            </a>
          </div>

          {/* Customer notes / comments if saved */}
          {customer.comments && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/[0.03] p-2.5 text-xs text-zinc-300 border border-white/5">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
              <div className="space-y-0.5">
                <span className="font-semibold text-zinc-400">Nota del cliente: </span>
                <span className="italic">{customer.comments}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Body with Scroll */}
        <div data-lenis-prevent className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="md" label="Cargando estadísticas e historial…" />
            </div>
          ) : (
            <>
              {/* Statistics Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {/* Total Bookings */}
                <div className="rounded-2xl glass-card p-3.5 border border-white/5 bg-zinc-900/40">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                    <Calendar className="h-3.5 w-3.5 text-gold" />
                    <span>Total Citas</span>
                  </div>
                  <p className="mt-1 font-display text-2xl font-bold text-white">{stats.total}</p>
                  <p className="text-[0.65rem] text-zinc-500 mt-0.5">
                    {stats.active} completadas · {stats.cancelled} canc.
                  </p>
                </div>

                {/* Total Spend */}
                <div className="rounded-2xl glass-card p-3.5 border border-white/5 bg-zinc-900/40">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Gasto Aprox.</span>
                  </div>
                  <p className="mt-1 font-display text-2xl font-bold text-white">{stats.totalSpent}€</p>
                  <p className="text-[0.65rem] text-zinc-500 mt-0.5">Sin cancelaciones</p>
                </div>

                {/* Favorite Service */}
                <div className="rounded-2xl glass-card p-3.5 border border-white/5 bg-zinc-900/40">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                    <Scissors className="h-3.5 w-3.5 text-gold" />
                    <span>Servicio Habitual</span>
                  </div>
                  <p className="mt-1 font-display text-sm font-bold text-white truncate" title={stats.favoriteService?.name || 'Ninguno'}>
                    {stats.favoriteService ? stats.favoriteService.name : '—'}
                  </p>
                  <p className="text-[0.65rem] text-zinc-500 mt-0.5">
                    {stats.favoriteService ? `${stats.favoriteService.count} ${stats.favoriteService.count === 1 ? 'vez' : 'veces'}` : 'Sin datos'}
                  </p>
                </div>

                {/* Favorite Barber */}
                <div className="rounded-2xl glass-card p-3.5 border border-white/5 bg-zinc-900/40">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                    <Award className="h-3.5 w-3.5 text-gold" />
                    <span>Barbero Habitual</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 min-w-0">
                    {stats.favoriteBarber?.photo_url ? (
                      <img src={stats.favoriteBarber.photo_url} alt="" className="h-4 w-4 rounded-full object-cover shrink-0" />
                    ) : (
                      <User className="h-4 w-4 text-zinc-500 shrink-0" />
                    )}
                    <p className="font-display text-sm font-bold text-white truncate">
                      {stats.favoriteBarber ? stats.favoriteBarber.name : '—'}
                    </p>
                  </div>
                  <p className="text-[0.65rem] text-zinc-500 mt-0.5">
                    {stats.favoriteBarber ? `${stats.favoriteBarberCount} ${stats.favoriteBarberCount === 1 ? 'cita' : 'citas'}` : 'Sin datos'}
                  </p>
                </div>
              </div>

              {/* Booking History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-2 font-display text-sm font-bold text-white">
                    <Clock className="h-4 w-4 text-gold" />
                    Historial de Citas ({bookings.length})
                  </h4>
                </div>

                {bookings.length === 0 ? (
                  <div className="rounded-2xl glass-card p-8 text-center border border-white/5">
                    <Calendar className="mx-auto h-8 w-8 text-zinc-600" />
                    <p className="mt-2 text-sm text-zinc-500">Este cliente aún no tiene citas registradas.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bookings.map((b) => {
                      const barber = getBarber(b.barber);
                      const isCancelled = b.status === 'cancelled';
                      return (
                        <div
                          key={b.id}
                          className={`flex items-center justify-between gap-3 rounded-2xl glass-card p-3.5 border transition-all ${
                            isCancelled
                              ? 'border-red-500/10 bg-red-950/5 opacity-60'
                              : 'border-white/5 hover:border-gold/20 bg-zinc-900/30'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Time badge: compact, self-start, h on the right */}
                            <div className="self-start shrink-0 inline-flex items-baseline justify-center rounded-xl bg-gold/10 px-2 py-1 border border-gold/20 shadow-sm">
                              <span className="font-display text-xs font-bold text-gold tracking-tight">{b.booking_time}</span>
                              <span className="ml-0.5 text-[0.6rem] font-semibold text-gold/70 lowercase">h</span>
                            </div>

                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <p className="font-display text-xs font-bold text-zinc-200">
                                  {formatDateLabel(b.booking_date)}
                                </p>
                              </div>
                              <p className="text-xs text-zinc-400 flex items-center gap-1">
                                <Scissors className="h-3 w-3 text-gold/80" />
                                <span className="font-medium text-white">{b.service}</span>
                                <span className="text-zinc-500 font-mono">({b.service_price}€)</span>
                              </p>
                              <div className="flex items-center gap-1.5 text-[0.7rem] text-zinc-400">
                                {barber?.photo_url ? (
                                  <img src={barber.photo_url} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
                                ) : (
                                  <User className="h-3 w-3 text-zinc-500" />
                                )}
                                <span>Con {barber?.name || b.barber}</span>
                              </div>
                              {b.comments && (
                                <p className="truncate text-[0.7rem] italic text-zinc-500">"{b.comments}"</p>
                              )}
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0 text-right">
                            {isCancelled ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-red-400 border border-red-500/20">
                                <XCircle className="h-3 w-3" /> Cancelada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="h-3 w-3" /> Confirmada
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
