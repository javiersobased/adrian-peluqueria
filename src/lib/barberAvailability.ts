import { supabase } from '@/lib/supabase';
import type { BarberSchedule, BarberBlock, BarberVacation, SavedBooking, Service } from '@/types';
import {
  generateSlotsForDay,
  isDayAvailable,
  getSlotBlocksForDate,
  getTimeRangeBlocksForDate,
  isSlotAvailable,
  getServiceDurationMinutes,
  timeToMinutes,
  toISO,
} from '@/lib/schedule';

export interface BarberAvailableSlotsResult {
  availableSlots: string[];
  morningSlots: string[];
  afternoonSlots: string[];
  occupiedTimes: Set<string>;
  isDayUnavailable: boolean;
  unavailableReason?: string;
}

/**
 * Consulta en tiempo real la disponibilidad completa de un barbero para una fecha específica.
 * Filtra automáticamente:
 * 1. Citas ya reservadas activas (status != 'cancelled') y solapamientos por duración.
 * 2. Vacaciones del barbero.
 * 3. Días libres completos y descansos semanales.
 * 4. Bloqueos de tramo o rangos horarios.
 * 5. Turno laboral según su horario (mañana/tarde).
 * 6. Horas que ya hayan pasado si la fecha es hoy.
 */
export async function getBarberAvailableSlots(
  barberId: string,
  dateIso: string,
  serviceDuration: number = 30
): Promise<BarberAvailableSlotsResult> {
  if (!barberId || !dateIso) {
    return {
      availableSlots: [],
      morningSlots: [],
      afternoonSlots: [],
      occupiedTimes: new Set(),
      isDayUnavailable: false,
    };
  }

  const dateObj = new Date(dateIso + 'T12:00:00');
  const targetWeekday = dateObj.getDay(); // 0 = Domingo, 1 = Lunes, ...
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = toISO(today);

  // 1. Consultar en paralelo bookings, horario, bloqueos y vacaciones del barbero
  const [schedRes, blockRes, vacRes, bookingsRes, rpcRes] = await Promise.all([
    supabase
      .from('barber_schedules')
      .select('*')
      .or(`barber.eq.${barberId},barber_id.eq.${barberId}`),
    supabase
      .from('barber_blocks')
      .select('*')
      .eq('barber', barberId),
    supabase
      .from('barber_vacations')
      .select('*')
      .eq('barber', barberId),
    supabase
      .from('bookings')
      .select('id, booking_time, service, status')
      .eq('barber', barberId)
      .eq('booking_date', dateIso)
      .neq('status', 'cancelled'),
    supabase
      .rpc('get_booked_intervals', { p_barber: barberId, p_date: dateIso }),
  ]);

  const schedules = (schedRes.data as BarberSchedule[]) || [];
  const blocks = (blockRes.data as BarberBlock[]) || [];
  const vacations = (vacRes.data as BarberVacation[]) || [];
  const directBookings = (bookingsRes.data as SavedBooking[]) || [];
  const rpcBookings = Array.isArray(rpcRes.data) ? rpcRes.data : [];

  // Buscar el horario del barbero para este día de la semana
  const daySchedule = schedules.find(
    (s) =>
      s.weekday === targetWeekday ||
      Number((s as any).day_of_week) === targetWeekday ||
      Number(s.weekday) === targetWeekday
  );

  // 2. Comprobar si el día completo no está disponible
  // a) Vacaciones
  const onVacation = vacations.some(
    (v) => v.start_date <= dateIso && v.end_date >= dateIso
  );
  if (onVacation) {
    return {
      availableSlots: [],
      morningSlots: [],
      afternoonSlots: [],
      occupiedTimes: new Set(),
      isDayUnavailable: true,
      unavailableReason: 'El barbero está en período de vacaciones.',
    };
  }

  // b) Día libre completo bloqueado
  const isDayOff = blocks.some(
    (b) => b.block_type === 'day_off' && b.block_date === dateIso
  );
  if (isDayOff) {
    return {
      availableSlots: [],
      morningSlots: [],
      afternoonSlots: [],
      occupiedTimes: new Set(),
      isDayUnavailable: true,
      unavailableReason: 'El barbero tiene este día completo bloqueado.',
    };
  }

  // c) Descanso semanal
  const isWeeklyOff = blocks.some(
    (b) => b.block_type === 'weekly_off' && b.weekday === targetWeekday
  );
  if (isWeeklyOff) {
    return {
      availableSlots: [],
      morningSlots: [],
      afternoonSlots: [],
      occupiedTimes: new Set(),
      isDayUnavailable: true,
      unavailableReason: 'Día de descanso semanal habitual del barbero.',
    };
  }

  // d) Horario laboral: no trabaja
  if (daySchedule && !daySchedule.is_working) {
    return {
      availableSlots: [],
      morningSlots: [],
      afternoonSlots: [],
      occupiedTimes: new Set(),
      isDayUnavailable: true,
      unavailableReason: 'El barbero no trabaja este día según su horario registrado.',
    };
  }

  // Si no hay horario y es domingo, por defecto cerrado
  if (!daySchedule && targetWeekday === 0) {
    return {
      availableSlots: [],
      morningSlots: [],
      afternoonSlots: [],
      occupiedTimes: new Set(),
      isDayUnavailable: true,
      unavailableReason: 'El salón permanece cerrado los domingos.',
    };
  }

  // 3. Unificar reservas e intervalos ocupados
  const occupiedTimes = new Set<string>();
  const bookedIntervals: { start: string; duration: number }[] = [];

  // Agregar desde RPC
  rpcBookings.forEach((item: any) => {
    if (item.booking_time) {
      occupiedTimes.add(item.booking_time);
      bookedIntervals.push({
        start: item.booking_time,
        duration: item.duration_minutes && item.duration_minutes > 0 ? item.duration_minutes : 30,
      });
    }
  });

  // Agregar desde consulta directa de bookings (por seguridad si la RPC no capturó alguna)
  directBookings.forEach((b) => {
    occupiedTimes.add(b.booking_time);
    const existing = bookedIntervals.find((i) => i.start === b.booking_time);
    if (!existing) {
      bookedIntervals.push({
        start: b.booking_time,
        duration: 30,
      });
    }
  });

  // 4. Generar slots según turno laboral
  const daySlots = generateSlotsForDay(daySchedule);
  const morningEnd = daySchedule?.morning_end ?? '13:30';
  const afternoonEnd = daySchedule?.afternoon_end ?? '20:30';

  const daySlotBlocks = getSlotBlocksForDate(dateObj, blocks);
  const dayTimeRangeBlocks = getTimeRangeBlocksForDate(dateObj, blocks);

  const now = new Date();
  const isDateToday = dateIso === todayIso;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // 5. Filtrar mañana
  const morningAvail = daySlots.morning.filter((slot) => {
    // Si la hora exacta ya está ocupada por una cita activa, descartar inmediatamente
    if (occupiedTimes.has(slot)) return false;

    // Si es hoy y ya pasó la hora
    if (isDateToday && timeToMinutes(slot) <= nowMinutes) return false;

    // Evaluar con isSlotAvailable (solapamiento de duración, fin de turno, bloqueos)
    return isSlotAvailable(
      slot,
      bookedIntervals,
      daySlotBlocks,
      dayTimeRangeBlocks,
      dateObj,
      now,
      serviceDuration,
      morningEnd
    );
  });

  // 6. Filtrar tarde
  const afternoonAvail = daySlots.afternoon.filter((slot) => {
    // Si la hora exacta ya está ocupada por una cita activa, descartar inmediatamente
    if (occupiedTimes.has(slot)) return false;

    // Si es hoy y ya pasó la hora
    if (isDateToday && timeToMinutes(slot) <= nowMinutes) return false;

    // Evaluar con isSlotAvailable (solapamiento de duración, fin de turno, bloqueos)
    return isSlotAvailable(
      slot,
      bookedIntervals,
      daySlotBlocks,
      dayTimeRangeBlocks,
      dateObj,
      now,
      serviceDuration,
      afternoonEnd
    );
  });

  const availableSlots = [...morningAvail, ...afternoonAvail];

  return {
    availableSlots,
    morningSlots: morningAvail,
    afternoonSlots: afternoonAvail,
    occupiedTimes,
    isDayUnavailable: false,
  };
}
