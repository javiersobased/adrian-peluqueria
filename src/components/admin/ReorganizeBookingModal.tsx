import { useState, useMemo } from 'react';
import {
  CalendarClock,
  Calendar,
  Clock,
  User,
  Scissors,
  X,
  Phone,
  MessageSquare,
  AlertCircle,
  RotateCw,
  Trash2,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';
import { getWhatsAppUrl, getCallUrl } from '@/lib/phoneActions';
import { WhatsAppIcon } from '@/components/icons';
import { WEEKDAY_SHORT, MONTH_SHORT, toISO } from '@/lib/schedule';
import type { SavedBooking, Barber } from '@/types';

export interface ReorganizeBookingModalProps {
  booking: SavedBooking;
  barbers: Barber[];
  allBookings?: SavedBooking[];
  onClose: () => void;
  onUpdated: () => void;
  onCancelBooking?: (bookingId: string) => void;
}

const COMMON_SLOTS = [
  '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00',
  '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00',
];

const PRESET_REASONS = [
  'Ajuste en la agenda del salón',
  'Hueco libre disponible antes',
  'Retraso imprevisto en el salón',
  'Imprevisto de fuerza mayor',
  'Reorganización de turnos',
];

export function ReorganizeBookingModal({
  booking,
  barbers,
  allBookings = [],
  onClose,
  onUpdated,
  onCancelBooking,
}: ReorganizeBookingModalProps) {
  const [targetDate, setTargetDate] = useState(booking.booking_date);
  const [targetTime, setTargetTime] = useState(booking.booking_time);
  const [targetBarber, setTargetBarber] = useState(booking.barber);
  const [selectedReason, setSelectedReason] = useState(PRESET_REASONS[0]);
  const [customMessage, setCustomMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const todayISO = toISO(new Date());

  const currentBarberObj = useMemo(() => {
    return barbers.find((b) => b.id === booking.barber) || {
      id: booking.barber,
      name: booking.barber === 'adrian' ? 'Adrián Millán' : booking.barber,
      role: 'Barbero',
      initials: 'AM',
      photo_url: null,
      active: true,
      sort_order: 0,
    };
  }, [barbers, booking.barber]);

  const targetBarberObj = useMemo(() => {
    return barbers.find((b) => b.id === targetBarber) || currentBarberObj;
  }, [barbers, targetBarber, currentBarberObj]);

  const formatDateLabel = (iso: string) => {
    try {
      const d = new Date(iso + 'T00:00:00');
      return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} de ${MONTH_SHORT[d.getMonth()]}`;
    } catch {
      return iso;
    }
  };

  // Check occupied slots for the selected date and barber
  const occupiedSlots = useMemo(() => {
    const set = new Set<string>();
    allBookings.forEach((b) => {
      if (
        b.id !== booking.id &&
        b.status !== 'cancelled' &&
        b.barber === targetBarber &&
        b.booking_date === targetDate
      ) {
        set.add(b.booking_time);
      }
    });
    return set;
  }, [allBookings, booking.id, targetBarber, targetDate]);

  // Client's first name for polite messaging
  const clientFirstName = booking.full_name.trim().split(' ')[0] || 'Hola';

  // Default suggested message template
  const defaultSuggestionText = useMemo(() => {
    const isSameBarber = targetBarber === booking.barber;
    const isSameDate = targetDate === booking.booking_date;

    let whenText = '';
    if (isSameDate) {
      whenText = `a las ${targetTime}h hoy (${formatDateLabel(targetDate)})`;
    } else {
      whenText = `el ${formatDateLabel(targetDate)} a las ${targetTime}h`;
    }

    const barberText = isSameBarber
      ? ''
      : ` con ${targetBarberObj.name}`;

    return `¡Hola ${clientFirstName}! 👋 Te escribo de Peluquería Adrián Millán en relación a tu cita del ${formatDateLabel(booking.booking_date)} a las ${booking.booking_time}h (${booking.service}).

Por ${selectedReason.toLowerCase()}, nos gustaría proponerte mover tu turno para ${whenText}${barberText}.

¿Te vendría bien este nuevo horario? Si te encaja, confírmame y te la dejamos fijada. ¡Muchas gracias!`;
  }, [clientFirstName, booking, selectedReason, targetDate, targetTime, targetBarber, targetBarberObj]);

  const finalMessage = customMessage.trim() || defaultSuggestionText;

  const isCurrentSlotSelected =
    targetDate === booking.booking_date &&
    targetTime === booking.booking_time &&
    targetBarber === booking.barber;

  // Handle saving new appointment date/time directly in Supabase
  const handleSaveReschedule = async (andNotifyWhatsApp: boolean = false) => {
    if (isCurrentSlotSelected && !andNotifyWhatsApp) {
      notify.info('Sin cambios', 'Selecciona una nueva hora o fecha para reorganizar.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          booking_date: targetDate,
          booking_time: targetTime,
          barber: targetBarber,
          status: 'confirmed',
        })
        .eq('id', booking.id);

      if (error) {
        if (error.message?.includes('duplicate') || error.message?.includes('ya está reservado')) {
          throw new Error('El horario seleccionado ya está ocupado. Elige otra hora disponible.');
        }
        throw error;
      }

      notify.success(
        'Cita reorganizada',
        `Nueva cita: ${formatDateLabel(targetDate)} a las ${targetTime}h (${targetBarberObj.name})`
      );

      if (andNotifyWhatsApp) {
        const whatsappUrl = getWhatsAppUrl(booking.phone, finalMessage);
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      }

      onUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error al reorganizar cita:', err);
      notify.error('No se pudo reprogramar', err?.message || 'Error al actualizar la cita');
    } finally {
      setSaving(false);
    }
  };

  // Direct WhatsApp proposal without immediate system change
  const handleSendWhatsAppProposalOnly = () => {
    const whatsappUrl = getWhatsAppUrl(booking.phone, finalMessage);
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    notify.info(
      'Propuesta enviada',
      `Se ha abierto WhatsApp con la sugerencia de cambio para ${clientFirstName}.`
    );
  };

  const handleExecuteCancel = async () => {
    setSaving(true);
    try {
      if (onCancelBooking) {
        await onCancelBooking(booking.id);
      } else {
        const { error } = await supabase
          .from('bookings')
          .update({ status: 'cancelled' })
          .eq('id', booking.id);
        if (error) throw error;
      }
      notify.success('Cita cancelada', 'La cita se ha marcado como cancelada.');
      onUpdated();
      onClose();
    } catch (err: any) {
      notify.error('Error al cancelar', err?.message || 'No se pudo cancelar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-gold/30 bg-zinc-950/95 p-5 sm:p-6 shadow-2xl backdrop-blur-xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gold-gradient font-display text-black shadow-md shadow-gold/20">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base sm:text-lg font-bold text-white">
                Reorganizar Cita
              </h3>
              <p className="text-xs text-zinc-400">
                Sugiere un cambio de hora al cliente o reprograma la cita directamente.
              </p>
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

        {/* Scrollable Content */}
        <div data-lenis-prevent className="flex-1 overflow-y-auto space-y-4 pr-1 my-3 text-sm">
          {/* Current appointment info banner */}
          <div className="rounded-2xl glass-card p-3.5 border border-white/5 bg-zinc-900/50 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.65rem] font-bold uppercase tracking-wider text-zinc-400">
                Cita actual programada
              </span>
              <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[0.65rem] font-bold text-gold border border-gold/20">
                {booking.service_price} €
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-white truncate text-sm">{booking.full_name}</p>
                <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                  <Scissors className="h-3 w-3 text-gold/70 shrink-0" />
                  <span className="truncate">{booking.service}</span>
                </p>
              </div>

              {/* Quick contact buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {booking.phone && (
                  <>
                    <a
                      href={getWhatsAppUrl(booking.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir chat de WhatsApp"
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                    >
                      <WhatsAppIcon className="h-3.5 w-3.5 fill-current" />
                    </a>
                    <a
                      href={getCallUrl(booking.phone)}
                      title="Llamar"
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5 text-xs text-zinc-300">
              <span className="flex items-center gap-1 text-gold font-medium">
                <Calendar className="h-3.5 w-3.5" />
                {formatDateLabel(booking.booking_date)}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1 font-bold text-white">
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                {booking.booking_time} h
              </span>
              <span>·</span>
              <span className="flex items-center gap-1 text-zinc-400">
                <User className="h-3.5 w-3.5 text-zinc-500" />
                {currentBarberObj.name}
              </span>
            </div>
          </div>

          {/* New Slot Selection Section */}
          <div className="space-y-3 rounded-2xl glass-card p-3.5 sm:p-4 border border-gold/20 bg-zinc-900/30">
            <p className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" />
              1. Seleccionar nuevo horario propuesto
            </p>

            {/* Barber picker */}
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Barbero asignado</label>
              <div className="flex flex-wrap gap-2">
                {barbers.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setTargetBarber(b.id)}
                    className={`flex-1 min-w-[90px] rounded-xl py-2 px-2.5 text-xs font-semibold transition-all truncate ${
                      targetBarber === b.id
                        ? 'gold-gradient text-black shadow-md shadow-gold/10 font-bold'
                        : 'glass-card text-zinc-400 hover:text-white'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Date picker */}
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Nueva Fecha</label>
              <div className="flex items-center gap-2 rounded-xl glass-card px-3 py-2 border border-white/10">
                <Calendar className="h-4 w-4 text-gold shrink-0" />
                <input
                  type="date"
                  min={todayISO}
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-transparent text-sm text-white focus:outline-none [color-scheme:dark]"
                />
                <span className="text-xs text-zinc-500 font-medium shrink-0">
                  {formatDateLabel(targetDate)}
                </span>
              </div>
            </div>

            {/* Time Slot Picker */}
            <div>
              <label className="mb-1.5 block text-xs text-zinc-400">
                Nueva Hora sugerida / disponible
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 max-h-40 overflow-y-auto pr-1">
                {COMMON_SLOTS.map((slot) => {
                  const isOccupied = occupiedSlots.has(slot);
                  const isCurrent =
                    slot === booking.booking_time && targetDate === booking.booking_date;
                  const isSelected = targetTime === slot;

                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={isOccupied}
                      onClick={() => setTargetTime(slot)}
                      title={
                        isCurrent
                          ? 'Horario actual de esta cita'
                          : isOccupied
                          ? 'Horario ya ocupado por otra cita'
                          : `Seleccionar ${slot}h`
                      }
                      className={`relative flex flex-col items-center justify-center rounded-xl py-2 px-1 text-xs transition-all ${
                        isSelected
                          ? 'gold-gradient text-black font-bold shadow-md shadow-gold/20 scale-105 z-10'
                          : isCurrent
                          ? 'border border-gold/40 bg-gold/10 text-gold font-semibold'
                          : isOccupied
                          ? 'bg-white/[0.02] text-zinc-600 line-through opacity-40 cursor-not-allowed'
                          : 'bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="font-mono">{slot}</span>
                      {isCurrent && (
                        <span className="text-[0.55rem] uppercase font-bold text-gold/80">
                          Actual
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Reason & Message Section */}
          <div className="space-y-3 rounded-2xl glass-card p-3.5 sm:p-4 border border-white/5 bg-zinc-900/30">
            <p className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              2. Motivo y Mensaje para el cliente
            </p>

            {/* Quick reason chips */}
            <div>
              <label className="mb-1.5 block text-xs text-zinc-400">Motivo del cambio</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => {
                      setSelectedReason(reason);
                      setCustomMessage('');
                    }}
                    className={`rounded-lg px-2.5 py-1 text-[0.7rem] font-medium transition-all ${
                      selectedReason === reason && !customMessage
                        ? 'bg-gold/20 text-gold border border-gold/40 font-bold'
                        : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 border border-white/5'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom message textarea */}
            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                Texto de la propuesta (editable):
              </label>
              <textarea
                rows={4}
                value={customMessage || defaultSuggestionText}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Escribe un mensaje personalizado para el cliente..."
                className="w-full rounded-xl glass-card p-3 text-xs text-white placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none leading-relaxed border border-white/10"
              />
              <p className="mt-1 text-[0.65rem] text-zinc-500">
                Este mensaje se cargará directamente en WhatsApp listo para enviar al cliente pulsando el botón verde.
              </p>
            </div>
          </div>

          {/* Danger zone / cancel option */}
          {showCancelConfirm ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="text-xs font-bold">¿Seguro que deseas cancelar esta cita?</p>
              </div>
              <p className="text-xs text-zinc-400">
                La cita quedará registrada como cancelada y se liberará el horario de {booking.booking_time}h.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleExecuteCancel}
                  className="flex-1 rounded-xl bg-red-500/20 py-2 text-xs font-bold text-red-300 border border-red-500/40 hover:bg-red-500/30 active:scale-95 transition-all"
                >
                  {saving ? 'Cancelando...' : 'Sí, cancelar cita'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white"
                >
                  Volver
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors inline-flex items-center gap-1 underline underline-offset-4"
              >
                <Trash2 className="h-3 w-3" />
                Si el cliente no puede acudir a ninguna hora, cancelar cita definitivamente
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-white/10 pt-4 space-y-2 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Primary Action 1: Reprogramar en el sistema */}
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveReschedule(false)}
              className="flex items-center justify-center gap-2 rounded-xl gold-gradient py-3 px-4 text-xs font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-95 shadow-md shadow-gold/20 disabled:opacity-50"
            >
              {saving ? (
                <RotateCw className="h-4 w-4 animate-spin text-black" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>Guardar nuevo horario</span>
            </button>

            {/* Primary Action 2: Sugerir por WhatsApp */}
            <button
              type="button"
              disabled={saving}
              onClick={handleSendWhatsAppProposalOnly}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 py-3 px-4 text-xs font-bold text-emerald-400 border border-emerald-500/30 transition-all hover:bg-emerald-500/25 active:scale-95 shadow-sm shadow-emerald-950/30"
            >
              <WhatsAppIcon className="h-4 w-4 fill-current text-emerald-400" />
              <span>Sugerir por WhatsApp</span>
            </button>
          </div>

          {/* Action 3: Guardar y notificar al cliente en un solo clic */}
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveReschedule(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-xs font-semibold text-zinc-300 border border-white/10 hover:bg-white/10 hover:text-gold active:scale-95 transition-all"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
            <span>Guardar en el sistema y notificar por WhatsApp al cliente</span>
          </button>
        </div>
      </div>
    </div>
  );
}
