import { useState, useEffect, useCallback, useMemo } from 'react';
import { tenantFrom } from '@/lib/tenant';
import { fetchAllBarbers, fetchAllServices } from '@/data/services';
import type { Barber, Service } from '@/types';
import {
  Check,
  Calendar,
  Clock,
  User,
  Plus,
  Phone,
  Mail,
  FileText,
  AlertCircle,
  AlertTriangle,
  Scissors,
  CheckCircle2,
} from 'lucide-react';
import { toISO, WEEKDAY_SHORT, MONTH_SHORT, getServiceDurationMinutes } from '@/lib/schedule';
import { notify } from '@/lib/notify';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getBarberAvailableSlots, type BarberAvailableSlotsResult, type SlotDetails } from '@/lib/barberAvailability';
import { CalendarPickerModal, CalendarOpenButton } from '@/components/ui/CalendarPickerModal';

interface AdminManualBookingProps {
  onCreated: () => void;
}

export function AdminManualBooking({ onCreated }: AdminManualBookingProps) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barber, setBarber] = useState('');
  const [service, setService] = useState('');
  const [date, setDate] = useState(() => toISO(new Date()));
  const [time, setTime] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [comments, setComments] = useState('');

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCalendar, setShowCalendar] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotResult, setSlotResult] = useState<BarberAvailableSlotsResult | null>(null);

  const todayISO = useMemo(() => toISO(new Date()), []);

  useEffect(() => {
    fetchAllBarbers().then((b) => {
      setBarbers(b);
      if (b.length > 0) setBarber(b[0].id);
    });
    fetchAllServices().then((s) => {
      setServices(s);
      if (s.length > 0) setService(s[0].name);
    });
  }, []);

  const selectedServiceObj = useMemo(() => {
    return services.find((s) => s.name === service || s.id === service) || null;
  }, [services, service]);

  const serviceDuration = useMemo(() => {
    return getServiceDurationMinutes(selectedServiceObj);
  }, [selectedServiceObj]);

  const selectedBarberObj = useMemo(() => {
    return barbers.find((b) => b.id === barber) || null;
  }, [barbers, barber]);

  // Consultar disponibilidad en tiempo real siempre que cambie el barbero, la fecha o el servicio
  const loadAvailableSlots = useCallback(async () => {
    if (!barber || !date) return;
    setLoadingSlots(true);
    setError(null);
    try {
      const res = await getBarberAvailableSlots(barber, date, serviceDuration);
      setSlotResult(res);

      // Si la hora que estaba elegida ya no está libre en la nueva fecha/barbero, limpiarla
      setTime((prevTime) => {
        if (prevTime && !res.availableSlots.includes(prevTime)) {
          return '';
        }
        return prevTime;
      });
    } catch (err: any) {
      console.error('Error calculando horas libres para cita manual:', err);
    } finally {
      setLoadingSlots(false);
    }
  }, [barber, date, serviceDuration]);

  useEffect(() => {
    loadAvailableSlots();
  }, [loadAvailableSlots]);

  const isSlotValid = Boolean(time && slotResult?.availableSlots.includes(time));
  const valid = Boolean(
    fullName.trim().length >= 2 &&
    barber &&
    service &&
    date &&
    isSlotValid &&
    !slotResult?.isDayUnavailable
  );

  const formatDateLabel = (iso: string) => {
    try {
      const d = new Date(iso + 'T12:00:00');
      return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} de ${MONTH_SHORT[d.getMonth()]}`;
    } catch {
      return iso;
    }
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // 1. Verificación previa de colisión en tiempo real antes de insertar
      const resCheck = await getBarberAvailableSlots(barber, date, serviceDuration);
      if (!resCheck.availableSlots.includes(time)) {
        const conflictMsg = `La hora ${time}h ya no está disponible (está ocupada por otra cita o bloqueo). Por favor, selecciona otro turno libre.`;
        setError(conflictMsg);
        notify.error('Horario no disponible', conflictMsg);
        setSlotResult(resCheck);
        setSaving(false);
        return;
      }

      const svc = services.find((s) => s.name === service);
      const cleanName = fullName.trim();
      const cleanPhone = phone.trim();
      const cleanEmail = email.trim().toLowerCase() || null;
      const cleanComments = comments.trim() || null;

      // 2. Insertar la cita
      const { error: insertError } = await tenantFrom('bookings').insert({
        barber,
        service,
        service_price: svc?.price ?? 0,
        booking_date: date,
        booking_time: time,
        full_name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        comments: cleanComments,
        status: 'confirmed',
        user_id: null,
      });

      if (insertError) {
        if (insertError.message.includes('idx_bookings_unique_active_slot') || insertError.message.includes('duplicate')) {
          throw new Error(`El barbero ya tiene una cita reservada a las ${time}h en esa fecha.`);
        }
        throw insertError;
      }

      // 3. Guardar o actualizar la ficha del cliente si hay datos
      if (cleanName && cleanPhone) {
        try {
          await tenantFrom('customers').upsert(
            {
              full_name: cleanName,
              phone: cleanPhone,
              email: cleanEmail,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'phone' }
          );
        } catch {
          // No bloqueante
        }
      }

      setSuccess(true);
      notify.success(
        'Cita registrada con éxito',
        `${cleanName} con ${selectedBarberObj?.name || barber} el ${formatDateLabel(date)} a las ${time}h`
      );

      setFullName('');
      setPhone('');
      setEmail('');
      setComments('');
      setTime('');

      // Recargar horas disponibles inmediatamente para que el hueco recién ocupado desaparezca
      await loadAvailableSlots();
      onCreated();
    } catch (err: any) {
      const msg = err?.message || 'No se pudo registrar la cita.';
      setError(msg);
      notify.error('Error al registrar', msg);
    } finally {
      setSaving(false);
    }
  }, [valid, barber, service, date, time, fullName, phone, email, comments, services, selectedBarberObj, loadAvailableSlots, onCreated]);

  return (
    <div className="mx-auto max-w-4xl w-full min-w-0">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* Columna Izquierda: Barbero, Servicio, Fecha y Hora */}
        <div className="space-y-4">
          <FormCard label="1. Seleccionar Barbero">
            <div className="flex flex-wrap gap-2">
              {barbers.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBarber(b.id)}
                  className={`flex-1 min-w-[100px] rounded-xl py-2.5 px-3 text-xs sm:text-sm font-semibold transition-all truncate ${
                    barber === b.id
                      ? 'gold-gradient text-black font-bold shadow-md shadow-gold/20'
                      : 'glass-card text-zinc-400 hover:text-white'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </FormCard>

          <FormCard label="2. Servicio">
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white focus:border-gold/30 focus:outline-none"
            >
              {services.map((s) => (
                <option key={s.id} value={s.name} className="bg-zinc-900">
                  {s.name} · {s.price}€ ({getServiceDurationMinutes(s)} min)
                </option>
              ))}
            </select>
          </FormCard>

          <FormCard label="3. Fecha y Hora">
            {/* Selector de fecha */}
            <div>
              <label className="mb-1 block text-xs text-zinc-400 font-medium">Fecha de la cita</label>
              <div className="flex items-center gap-2">
                {/* Visual date display — clicking opens the calendar picker */}
                <button
                  type="button"
                  onClick={() => setShowCalendar(true)}
                  className="flex flex-1 items-center gap-2 rounded-xl glass-card px-3 py-2.5 border border-white/5 hover:border-gold/30 transition-all text-left cursor-pointer"
                >
                  <Calendar className="h-4 w-4 text-gold shrink-0" />
                  <span className="flex-1 text-sm text-white font-medium">
                    {date}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium shrink-0">
                    {formatDateLabel(date)}
                  </span>
                </button>
                <CalendarOpenButton
                  label="Abrir"
                  onClick={() => setShowCalendar(true)}
                  className="shrink-0"
                />
              </div>

              {/* Calendar modal */}
              {showCalendar && (
                <CalendarPickerModal
                  selected={date}
                  minDate={todayISO}
                  onSelect={(iso) => {
                    setDate(iso);
                    setTime('');
                  }}
                  onClose={() => setShowCalendar(false)}
                />
              )}
            </div>

            {/* Aviso si el día no está disponible por vacaciones o bloqueo */}
            {slotResult?.isDayUnavailable && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-300">Día no disponible</p>
                  <p className="text-[0.72rem] text-amber-200/80 mt-0.5">
                    {slotResult.unavailableReason || 'El barbero no tiene disponibilidad para esta fecha.'}
                  </p>
                </div>
              </div>
            )}

            {/* Selector de horas disponibles */}
            {/* Selector de horas disponibles y ocupadas */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-gold" />
                  Horas del barbero
                </label>
                {loadingSlots ? (
                  <span className="text-[0.68rem] text-gold animate-pulse">Comprobando agenda...</span>
                ) : slotResult && !slotResult.isDayUnavailable ? (
                  <div className="flex items-center gap-2 text-[0.68rem]">
                    <span className="font-semibold text-emerald-400">
                      {slotResult.availableSlots.length} libres
                    </span>
                    {slotResult.occupiedTimes.size > 0 && (
                      <span className="font-semibold text-red-400">
                        · {slotResult.occupiedTimes.size} {slotResult.occupiedTimes.size === 1 ? 'ocupada' : 'ocupadas'}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={time}
                  disabled={loadingSlots || slotResult?.isDayUnavailable || slotResult?.availableSlots.length === 0}
                  onChange={(e) => setTime(e.target.value)}
                  className="flex-1 rounded-xl glass-card px-3 py-2.5 text-sm text-white focus:border-gold/30 focus:outline-none disabled:opacity-50"
                >
                  {loadingSlots ? (
                    <option value="" className="bg-zinc-900">Consultando disponibilidad en tiempo real...</option>
                  ) : slotResult?.isDayUnavailable ? (
                    <option value="" className="bg-zinc-900">Día no disponible para este barbero</option>
                  ) : slotResult?.availableSlots.length === 0 ? (
                    <option value="" className="bg-zinc-900">No hay horas libres para esta fecha (todas ocupadas)</option>
                  ) : (
                    <>
                      <option value="" className="bg-zinc-900">
                        Selecciona hora ({slotResult?.availableSlots.length} libres)
                      </option>
                      {slotResult?.allMorningSlots && slotResult.allMorningSlots.length > 0 && (
                        <optgroup label="Turno de Mañana" className="bg-zinc-900 text-gold font-semibold">
                          {slotResult.allMorningSlots.map((s) => {
                            if (s.status === 'booked') {
                              return (
                                <option key={s.time} value={s.time} disabled className="bg-zinc-900 text-red-400 font-normal">
                                  {s.time} h — 🔴 OCUPADA{s.booking?.clientName ? ` (${s.booking.clientName})` : ' (Cita)'}
                                </option>
                              );
                            }
                            if (s.status === 'past') {
                              return (
                                <option key={s.time} value={s.time} disabled className="bg-zinc-900 text-zinc-600 font-normal">
                                  {s.time} h — Pasada
                                </option>
                              );
                            }
                            if (s.status === 'blocked') {
                              return (
                                <option key={s.time} value={s.time} disabled className="bg-zinc-900 text-zinc-500 font-normal">
                                  {s.time} h — Bloqueada
                                </option>
                              );
                            }
                            if (s.status === 'overlap') {
                              return (
                                <option key={s.time} value={s.time} disabled className="bg-zinc-900 text-amber-500/70 font-normal">
                                  {s.time} h — No disponible (solapa con cita o fin de turno)
                                </option>
                              );
                            }
                            return (
                              <option key={s.time} value={s.time} className="bg-zinc-900 text-white font-normal">
                                {s.time} h — Disponible
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                      {slotResult?.allAfternoonSlots && slotResult.allAfternoonSlots.length > 0 && (
                        <optgroup label="Turno de Tarde" className="bg-zinc-900 text-gold font-semibold">
                          {slotResult.allAfternoonSlots.map((s) => {
                            if (s.status === 'booked') {
                              return (
                                <option key={s.time} value={s.time} disabled className="bg-zinc-900 text-red-400 font-normal">
                                  {s.time} h — 🔴 OCUPADA{s.booking?.clientName ? ` (${s.booking.clientName})` : ' (Cita)'}
                                </option>
                              );
                            }
                            if (s.status === 'past') {
                              return (
                                <option key={s.time} value={s.time} disabled className="bg-zinc-900 text-zinc-600 font-normal">
                                  {s.time} h — Pasada
                                </option>
                              );
                            }
                            if (s.status === 'blocked') {
                              return (
                                <option key={s.time} value={s.time} disabled className="bg-zinc-900 text-zinc-500 font-normal">
                                  {s.time} h — Bloqueada
                                </option>
                              );
                            }
                            if (s.status === 'overlap') {
                              return (
                                <option key={s.time} value={s.time} disabled className="bg-zinc-900 text-amber-500/70 font-normal">
                                  {s.time} h — No disponible (solapa con cita o fin de turno)
                                </option>
                              );
                            }
                            return (
                              <option key={s.time} value={s.time} className="bg-zinc-900 text-white font-normal">
                                {s.time} h — Disponible
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                    </>
                  )}
                </select>
              </div>

              {/* Malla de botones con turnos libres y turnos ocupados marcados en rojo/tachados */}
              {!loadingSlots && slotResult && !slotResult.isDayUnavailable && slotResult.allSlots && slotResult.allSlots.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-white/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[0.65rem] uppercase tracking-wider font-semibold text-zinc-400">
                      Cuadrícula de turnos:
                    </p>
                    <span className="text-[0.65rem] text-zinc-500">
                      Toca un turno libre para seleccionarlo
                    </span>
                  </div>

                  {/* Turno Mañana */}
                  {slotResult.allMorningSlots.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[0.62rem]">
                        <span className="font-bold text-gold uppercase tracking-wider">Turno Mañana</span>
                        <span className="text-zinc-500">
                          {slotResult.allMorningSlots.filter((s) => s.available).length} libres
                        </span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {slotResult.allMorningSlots.map((s) => (
                          <SlotButton
                            key={s.time}
                            slot={s}
                            selectedTime={time}
                            onSelect={setTime}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Turno Tarde */}
                  {slotResult.allAfternoonSlots.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[0.62rem]">
                        <span className="font-bold text-gold uppercase tracking-wider">Turno Tarde</span>
                        <span className="text-zinc-500">
                          {slotResult.allAfternoonSlots.filter((s) => s.available).length} libres
                        </span>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pr-1">
                        {slotResult.allAfternoonSlots.map((s) => (
                          <SlotButton
                            key={s.time}
                            slot={s}
                            selectedTime={time}
                            onSelect={setTime}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Leyenda explicativa */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 border-t border-white/5 text-[0.62rem]">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Disponible
                    </span>
                    <span className="flex items-center gap-1.5 text-red-400 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="line-through">Tachada en rojo</span> (Ocupada por cita)
                    </span>
                    <span className="flex items-center gap-1.5 text-zinc-500">
                      <span className="h-2 w-2 rounded-full bg-zinc-600" />
                      Pasada / Bloqueo
                    </span>
                  </div>
                </div>
              )}

              {/* Mensaje cuando no hay turnos */}
              {!loadingSlots && slotResult && !slotResult.isDayUnavailable && slotResult.availableSlots.length === 0 && (
                <div className="mt-2.5 rounded-xl border border-red-500/20 bg-red-950/15 p-3 text-xs text-red-300">
                  <p className="font-semibold text-red-400">Sin turnos libres</p>
                  <p className="text-[0.7rem] text-zinc-400 mt-0.5">
                    Todos los turnos de {selectedBarberObj?.name || 'este barbero'} para el {formatDateLabel(date)} ya están ocupados por otras citas o fuera de horario.
                  </p>
                </div>
              )}
            </div>
          </FormCard>
        </div>

        {/* Columna Derecha: Datos del Cliente, Confirmación y Guardado */}
        <div className="space-y-4">
          <FormCard label="4. Datos del Cliente">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-medium">Nombre completo *</label>
                <div className="flex items-center gap-3 rounded-xl glass-card px-4 py-3 focus-within:border-gold/30">
                  <User className="h-4 w-4 text-zinc-500 shrink-0" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="ej. Carlos Rodríguez"
                    className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-medium">Teléfono móvil (opcional)</label>
                <div className="flex items-center gap-3 rounded-xl glass-card px-4 py-3 focus-within:border-gold/30">
                  <Phone className="h-4 w-4 text-zinc-500 shrink-0" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="ej. 612 345 678"
                    className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-medium">Correo electrónico (opcional, para avisos de cambio o cancelación)</label>
                <div className="flex items-center gap-3 rounded-xl glass-card px-4 py-3 focus-within:border-gold/30">
                  <Mail className="h-4 w-4 text-zinc-500 shrink-0" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ej. cliente@gmail.com"
                    className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-medium">Notas u observaciones (opcional)</label>
                <div className="flex items-center gap-3 rounded-xl glass-card px-4 py-2.5 focus-within:border-gold/30">
                  <FileText className="h-4 w-4 text-zinc-500 shrink-0" />
                  <input
                    type="text"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="ej. Cliente habitual, corte con degradado cero"
                    className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </FormCard>

          {/* Resumen de la cita antes de confirmar */}
          <div className="rounded-3xl glass-card p-4 border border-white/5 space-y-2 text-xs">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-zinc-500">Resumen de la cita</p>
            <div className="flex items-center justify-between text-zinc-300">
              <span>Barbero:</span>
              <span className="font-semibold text-white">{selectedBarberObj?.name || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <span>Servicio:</span>
              <span className="font-semibold text-white">{service}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <span>Fecha y hora:</span>
              <span className="font-semibold text-gold font-mono">
                {date} · {time ? `${time}h` : 'Pendiente de elegir hora'}
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Cita registrada correctamente en el sistema.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!valid || saving}
            className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
              valid && !saving
                ? 'gold-gradient text-black hover:brightness-110 active:scale-[0.98] gold-glow cursor-pointer'
                : 'bg-white/5 text-zinc-600 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
            ) : success ? (
              <Check className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Registrar cita en agenda
          </button>
        </div>
      </form>
    </div>
  );
}

function FormCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl glass-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">{label}</p>
      {children}
    </div>
  );
}

function SlotButton({
  slot,
  selectedTime,
  onSelect,
}: {
  slot: SlotDetails;
  selectedTime: string;
  onSelect: (time: string) => void;
}) {
  const isSelected = selectedTime === slot.time;

  if (slot.status === 'booked') {
    const tooltip = slot.booking?.clientName
      ? `Cita ocupada: ${slot.booking.clientName}${slot.booking.service ? ` (${slot.booking.service})` : ''} · Inicio ${slot.booking.startTime}h (${slot.booking.duration} min)`
      : `Ocupada por una cita previa (${slot.time}h)`;

    return (
      <button
        type="button"
        disabled
        title={tooltip}
        aria-label={`${slot.time}h ocupada por cita`}
        className="group relative flex flex-col items-center justify-center rounded-xl py-1.5 px-2 text-xs font-mono font-bold transition-all bg-red-500/15 text-red-400 border border-red-500/40 line-through cursor-not-allowed opacity-90 select-none shadow-sm shadow-red-950/30"
      >
        <span>{slot.time}</span>
        <span className="text-[0.55rem] font-semibold text-red-400/90 leading-none mt-0.5 no-underline">
          Cita
        </span>
      </button>
    );
  }

  if (slot.status === 'past') {
    return (
      <button
        type="button"
        disabled
        title="Hora ya pasada hoy"
        aria-label={`${slot.time}h pasada`}
        className="flex flex-col items-center justify-center rounded-xl py-1.5 px-2 text-xs font-mono transition-all bg-zinc-900/30 text-zinc-600 border border-white/5 line-through cursor-not-allowed opacity-40 select-none"
      >
        <span>{slot.time}</span>
        <span className="text-[0.55rem] text-zinc-600 leading-none mt-0.5 no-underline">
          Pasada
        </span>
      </button>
    );
  }

  if (slot.status === 'blocked') {
    return (
      <button
        type="button"
        disabled
        title="Horario bloqueado por el barbero"
        aria-label={`${slot.time}h bloqueada`}
        className="flex flex-col items-center justify-center rounded-xl py-1.5 px-2 text-xs font-mono transition-all bg-zinc-900/40 text-zinc-500 border border-zinc-800 line-through cursor-not-allowed opacity-50 select-none"
      >
        <span>{slot.time}</span>
        <span className="text-[0.55rem] text-zinc-500 leading-none mt-0.5 no-underline">
          Bloqueo
        </span>
      </button>
    );
  }

  if (slot.status === 'overlap') {
    return (
      <button
        type="button"
        disabled
        title="No disponible: la duración de este servicio choca con la siguiente cita o fin de turno"
        aria-label={`${slot.time}h no disponible`}
        className="flex flex-col items-center justify-center rounded-xl py-1.5 px-2 text-xs font-mono transition-all bg-amber-500/5 text-amber-400/50 border border-amber-500/20 line-through cursor-not-allowed opacity-60 select-none"
      >
        <span>{slot.time}</span>
        <span className="text-[0.55rem] text-amber-500/60 leading-none mt-0.5 no-underline">
          Solapa
        </span>
      </button>
    );
  }

  // Disponible
  return (
    <button
      type="button"
      onClick={() => onSelect(slot.time)}
      title={`Seleccionar ${slot.time}h (Disponible)`}
      aria-label={`Seleccionar ${slot.time}h`}
      className={`flex flex-col items-center justify-center rounded-xl py-1.5 px-2 text-xs font-mono font-semibold transition-all cursor-pointer active:scale-95 ${
        isSelected
          ? 'gold-gradient text-black font-bold shadow-md shadow-gold/20 scale-105 z-10'
          : 'bg-zinc-900/90 text-zinc-200 hover:bg-gold/15 hover:text-gold hover:border-gold/40 border border-white/10'
      }`}
    >
      <span>{slot.time}</span>
      <span
        className={`text-[0.55rem] leading-none mt-0.5 ${
          isSelected ? 'text-black/80 font-bold' : 'text-emerald-400/80 font-medium'
        }`}
      >
        Libre
      </span>
    </button>
  );
}

