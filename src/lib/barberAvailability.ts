import { supabase } from '@/lib/supabase';
import { getCurrentBusinessId, tenantFrom } from '@/lib/tenant';
import type { BarberSchedule, BarberBlock, BarberVacation, SavedBooking, Service } from '@/types';
import {
  generateSlotsForDay,
  isDayAvailable,
  getSlotBlocksForDate,
  getTimeRangeBlocksForDate,
  isSlotInTimeRange,
  isSlotAvailable,
  getServiceDurationMinutes,
  timeToMinutes,
  minutesToTime,
  getSlotIntervalMinutes,
  toISO,
} from '@/lib/schedule';

export type SlotStatus = 'available' | 'booked' | 'blocked' | 'past' | 'overlap';

export interface SlotDetails {
  time: string;
  available: boolean;
  status: SlotStatus;
  booking?: {
    clientName?: string;
    service?: string;
    startTime: string;
    duration: number;
  };
}

export interface BarberAvailableSlotsResult {
  availableSlots: string[];
  morningSlots: string[];
  afternoonSlots: string[];
  occupiedTimes: Set<string>;
  allMorningSlots: SlotDetails[];
  allAfternoonSlots: SlotDetails[];
  allSlots: SlotDetails[];
  isDayUnavailable: boolean;
  unavailableReason?: string;
}

/**
 * Consulta en tiempo real la disponibilidad completa de un barbero para una fecha específica.
 * Filtra automáticamente:
 * 1. Citas ya reservadas activas (status != 'cancelled') y solapamientos por duración.
 *    Las horas ocupadas se registran en todos los intervalos de 10 min que cubre la cita.
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
  const emptyUnavailable = (reason: string): BarberAvailableSlotsResult => ({
    availableSlots: [],
    morningSlots: [],
    afternoonSlots: [],
    allMorningSlots: [],
    allAfternoonSlots: [],
    allSlots: [],
    occupiedTimes: new Set(),
    isDayUnavailable: true,
    unavailableReason: reason,
  });

  if (!barberId || !dateIso) {
    return {
      availableSlots: [],
      morningSlots: [],
      afternoonSlots: [],
      allMorningSlots: [],
      allAfternoonSlots: [],
      allSlots: [],
      occupiedTimes: new Set(),
      isDayUnavailable: false,
    };
  }

  const dateObj = new Date(dateIso + 'T12:00:00');
  const targetWeekday = dateObj.getDay(); // 0 = Domingo, 1 = Lunes, ...
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = toISO(today);

  // 1. Consultar en paralelo bookings, horario, bloqueos, vacaciones y servicios
  const [schedRes, blockRes, vacRes, bookingsRes, rpcRes, servicesRes] = await Promise.all([
    tenantFrom('barber_schedules')
      .select('*')
      .or(`barber.eq.${barberId},barber_id.eq.${barberId}`),
    tenantFrom('barber_blocks')
      .select('*')
      .eq('barber', barberId),
    tenantFrom('barber_vacations')
      .select('*')
      .eq('barber', barberId),
    tenantFrom('bookings')
      .select('id, full_name, booking_time, service, status')
      .eq('barber', barberId)
      .eq('booking_date', dateIso)
      .neq('status', 'cancelled'),
    supabase
      .rpc('get_booked_intervals', { p_barber: barberId, p_date: dateIso, p_business_id: getCurrentBusinessId() }),
    tenantFrom('services')
      .select('id, name, duration, duration_minutes'),
  ]);

  const schedules = (schedRes.data as BarberSchedule[]) || [];
  const blocks = (blockRes.data as BarberBlock[]) || [];
  const vacations = (vacRes.data as BarberVacation[]) || [];
  const directBookings = (bookingsRes.data as any[]) || [];
  const rpcBookings = Array.isArray(rpcRes.data) ? rpcRes.data : [];
  const servicesList = (servicesRes.data as Service[]) || [];

  const getDurationForService = (serviceNameOrId?: string | null): number => {
    if (!serviceNameOrId) return 30;
    const clean = serviceNameOrId.trim().toLowerCase();
    const found = servicesList.find(
      (s) => s.name.trim().toLowerCase() === clean || s.id.trim().toLowerCase() === clean
    );
    return getServiceDurationMinutes(found);
  };

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
    return emptyUnavailable('El barbero está en período de vacaciones.');
  }

  // b) Día libre completo bloqueado
  const isDayOff = blocks.some(
    (b) => b.block_type === 'day_off' && b.block_date === dateIso
  );
  if (isDayOff) {
    return emptyUnavailable('El barbero tiene este día completo bloqueado.');
  }

  // c) Descanso semanal
  const isWeeklyOff = blocks.some(
    (b) => b.block_type === 'weekly_off' && b.weekday === targetWeekday
  );
  if (isWeeklyOff) {
    return emptyUnavailable('Día de descanso semanal habitual del barbero.');
  }

  // d) Horario laboral: no trabaja
  if (daySchedule && !daySchedule.is_working) {
    return emptyUnavailable('El barbero no trabaja este día según su horario registrado.');
  }

  // e) Sin horario registrado para este día de la semana → no disponible
  if (!daySchedule) {
    return emptyUnavailable('El barbero no tiene horario registrado para este día de la semana.');
  }

  // 3. Unificar reservas e intervalos ocupados
  const occupiedTimes = new Set<string>();
  const bookedIntervals: { start: string; duration: number }[] = [];
  const bookedSlotsMap = new Map<
    string,
    { clientName?: string; service?: string; startTime: string; duration: number }
  >();

  // Helper para registrar un intervalo de cita y marcar como ocupados todos los slots que cubre
  const registerBookingInterval = (
    startTime: string,
    duration: number,
    clientName?: string,
    serviceName?: string
  ) => {
    const cleanStart = startTime.substring(0, 5); // Asegurar formato HH:MM
    const bDuration = duration > 0 ? duration : 30;

    if (!bookedIntervals.some((b) => b.start === cleanStart)) {
      bookedIntervals.push({ start: cleanStart, duration: bDuration });
    }

    const bStartMin = timeToMinutes(cleanStart);
    const bEndMin = bStartMin + bDuration;

    // Cubrir cada franja de la cita (ej. con intervalo de 10 min, 16:30 de 20 min cubre 16:30 y 16:40)
    const step = getSlotIntervalMinutes();
    for (let t = bStartMin; t < bEndMin; t += step) {
      const slotStr = minutesToTime(t);
      occupiedTimes.add(slotStr);
      if (!bookedSlotsMap.has(slotStr)) {
        bookedSlotsMap.set(slotStr, {
          clientName,
          service: serviceName,
          startTime: cleanStart,
          duration: bDuration,
        });
      }
    }
  };

  // 3.1 Procesar citas directas (tienen nombre del cliente)
  directBookings.forEach((b) => {
    if (!b.booking_time) return;
    const rpcMatch = rpcBookings.find(
      (r: any) => r.booking_time?.substring(0, 5) === b.booking_time?.substring(0, 5)
    );
    const duration =
      rpcMatch?.duration_minutes && rpcMatch.duration_minutes > 0
        ? rpcMatch.duration_minutes
        : getDurationForService(b.service);

    registerBookingInterval(b.booking_time, duration, b.full_name || undefined, b.service || undefined);
  });

  // 3.2 Procesar citas desde RPC que pudieran no estar en directBookings
  rpcBookings.forEach((item: any) => {
    if (!item.booking_time) return;
    const cleanTime = item.booking_time.substring(0, 5);
    if (!bookedIntervals.some((b) => b.start === cleanTime)) {
      const duration =
        item.duration_minutes && item.duration_minutes > 0
          ? item.duration_minutes
          : getDurationForService(item.service);
      registerBookingInterval(cleanTime, duration, undefined, item.service || undefined);
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

  // Función constructora del estado de cada slot
  const createSlotDetails = (slot: string, shiftEnd: string): SlotDetails => {
    const slotMin = timeToMinutes(slot);
    const isPast = isDateToday && slotMin <= nowMinutes;
    const isDirectlyBooked = occupiedTimes.has(slot);
    const bookingInfo = bookedSlotsMap.get(slot);

    const isBlocked =
      daySlotBlocks.has(slot) ||
      isSlotInTimeRange(slot, dayTimeRangeBlocks);

    // Comprobar si cabe la nueva cita con su serviceDuration en este slot
    const available =
      !isPast &&
      !isDirectlyBooked &&
      !isBlocked &&
      isSlotAvailable(
        slot,
        bookedIntervals,
        daySlotBlocks,
        dayTimeRangeBlocks,
        dateObj,
        now,
        serviceDuration,
        shiftEnd
      );

    let status: SlotStatus = 'available';
    if (isDirectlyBooked) {
      status = 'booked';
    } else if (isPast) {
      status = 'past';
    } else if (isBlocked) {
      status = 'blocked';
    } else if (!available) {
      status = 'overlap';
    } else {
      status = 'available';
    }

    return {
      time: slot,
      available,
      status,
      booking: bookingInfo,
    };
  };

  const morningSlotDetails = daySlots.morning.map((s) => createSlotDetails(s, morningEnd));
  const afternoonSlotDetails = daySlots.afternoon.map((s) => createSlotDetails(s, afternoonEnd));
  const allSlotDetails = [...morningSlotDetails, ...afternoonSlotDetails];

  const morningAvail = morningSlotDetails.filter((s) => s.available).map((s) => s.time);
  const afternoonAvail = afternoonSlotDetails.filter((s) => s.available).map((s) => s.time);
  const availableSlots = [...morningAvail, ...afternoonAvail];

  return {
    availableSlots,
    morningSlots: morningAvail,
    afternoonSlots: afternoonAvail,
    occupiedTimes,
    allMorningSlots: morningSlotDetails,
    allAfternoonSlots: afternoonSlotDetails,
    allSlots: allSlotDetails,
    isDayUnavailable: false,
  };
}
