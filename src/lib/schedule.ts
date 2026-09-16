import type { BarberSchedule, BarberBlock, BarberVacation } from '@/types';

export const SLOT_INTERVAL_MINUTES = 15;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getServiceDurationMinutes(
  service?: { duration_minutes?: number | null; duration?: string | null } | null
): number {
  if (service?.duration_minutes && service.duration_minutes > 0) {
    return service.duration_minutes;
  }
  if (service?.duration) {
    const match = service.duration.match(/\d+/);
    if (match) {
      const parsed = parseInt(match[0], 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  return 30; // Fallback seguro de 30 minutos por defecto
}

export function generateSlotsForShift(start: string | null, end: string | null): string[] {
  if (!start || !end) return [];
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (endMin <= startMin) return [];
  const slots: string[] = [];
  for (let t = startMin; t < endMin; t += SLOT_INTERVAL_MINUTES) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

export function generateSlotsForDay(schedule: BarberSchedule | undefined): { morning: string[]; afternoon: string[] } {
  if (!schedule || !schedule.is_working) return { morning: [], afternoon: [] };
  return {
    morning: generateSlotsForShift(schedule.morning_start, schedule.morning_end),
    afternoon: generateSlotsForShift(schedule.afternoon_start, schedule.afternoon_end),
  };
}

export function isOnVacation(date: Date, vacations: BarberVacation[]): boolean {
  const iso = toISO(date);
  return vacations.some((v) => v.start_date <= iso && v.end_date >= iso);
}

export function isWeeklyOff(date: Date, blocks: BarberBlock[]): boolean {
  const jsDay = date.getDay();
  return blocks.some((b) => b.block_type === 'weekly_off' && b.weekday === jsDay);
}

export function isDayOff(date: Date, blocks: BarberBlock[]): boolean {
  const iso = toISO(date);
  return blocks.some((b) => b.block_type === 'day_off' && b.block_date === iso);
}

export function getSlotBlocksForDate(date: Date, blocks: BarberBlock[]): Set<string> {
  const iso = toISO(date);
  return new Set(
    blocks
      .filter((b) => b.block_type === 'slot_block' && b.block_date === iso && b.block_time)
      .map((b) => b.block_time as string)
  );
}

export function getTimeRangeBlocksForDate(date: Date, blocks: BarberBlock[]): { start: string; end: string }[] {
  const iso = toISO(date);
  return blocks
    .filter((b) => b.block_type === 'time_range' && b.block_date === iso && b.block_start_time && b.block_end_time)
    .map((b) => ({ start: b.block_start_time as string, end: b.block_end_time as string }));
}

export function isSlotInTimeRange(slot: string, ranges: { start: string; end: string }[]): boolean {
  const slotMin = timeToMinutes(slot);
  return ranges.some((r) => {
    const s = timeToMinutes(r.start);
    let endMin = timeToMinutes(r.end);
    if (r.end === '20:00') {
      endMin = timeToMinutes('20:30');
    } else if (r.end === '13:00' && r.start === '09:30') {
      endMin = timeToMinutes('13:30');
    }
    return slotMin >= s && slotMin < endMin;
  });
}

export interface BookedIntervalCheck {
  start: string;
  duration?: number;
}

export function isSlotAvailable(
  slot: string,
  bookedSlots: Set<string> | BookedIntervalCheck[],
  slotBlocks: Set<string>,
  timeRangeBlocks: { start: string; end: string }[],
  selectedDate?: Date,
  now: Date = new Date(),
  serviceDuration: number = 30,
  shiftEnd: string | null = null
): boolean {
  const potentialStartMin = timeToMinutes(slot);
  const potentialEndMin = potentialStartMin + serviceDuration;

  // 1. Limite del turno de trabajo (no puede terminar despues del cierre de turno)
  if (shiftEnd) {
    const shiftEndMin = timeToMinutes(shiftEnd);
    if (potentialEndMin > shiftEndMin) {
      return false;
    }
  }

  // 2. Detección de solapamiento con reservas existentes (Bookings)
  if (Array.isArray(bookedSlots)) {
    const hasBookingOverlap = bookedSlots.some((b) => {
      const bStartMin = timeToMinutes(b.start);
      const bDuration = b.duration && b.duration > 0 ? b.duration : 30;
      const bEndMin = bStartMin + bDuration;
      // Interval overlap: [potentialStart, potentialEnd] vs [bStart, bEnd]
      return Math.max(potentialStartMin, bStartMin) < Math.min(potentialEndMin, bEndMin);
    });
    if (hasBookingOverlap) return false;
  } else if (bookedSlots instanceof Set) {
    // Si viene como Set<string>, evaluamos cada reserva asumiendo fallback de 30 minutos
    for (const bTime of bookedSlots) {
      const bStartMin = timeToMinutes(bTime);
      const bEndMin = bStartMin + 30;
      if (Math.max(potentialStartMin, bStartMin) < Math.min(potentialEndMin, bEndMin)) {
        return false;
      }
    }
  }

  // 3. Bloqueos puntuales de tramo (slot_block)
  if (slotBlocks && slotBlocks.size > 0) {
    for (const sb of slotBlocks) {
      const sbMin = timeToMinutes(sb);
      // Si el slot puntual cae dentro de la duracion potencial de la cita
      if (sbMin >= potentialStartMin && sbMin < potentialEndMin) {
        return false;
      }
    }
  }

  // 4. Bloqueos de rango horario del barbero (time_range)
  if (timeRangeBlocks && timeRangeBlocks.length > 0) {
    const hasRangeOverlap = timeRangeBlocks.some((r) => {
      const rStartMin = timeToMinutes(r.start);
      let rEndMin = timeToMinutes(r.end);
      if (r.end === '20:00') {
        rEndMin = timeToMinutes('20:30');
      } else if (r.end === '13:00' && r.start === '09:30') {
        rEndMin = timeToMinutes('13:30');
      }
      return Math.max(potentialStartMin, rStartMin) < Math.min(potentialEndMin, rEndMin);
    });
    if (hasRangeOverlap) return false;
  }

  // 5. Citas pasadas hoy
  if (selectedDate && toISO(selectedDate) === toISO(now)) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (potentialStartMin <= nowMinutes) return false;
  }

  return true;
}

export function isDayAvailable(
  date: Date,
  today: Date,
  schedule: BarberSchedule | undefined,
  blocks: BarberBlock[],
  vacations: BarberVacation[]
): boolean {
  if (date < today) return false;
  if (!schedule || !schedule.is_working) return false;
  if (isWeeklyOff(date, blocks)) return false;
  if (isDayOff(date, blocks)) return false;
  if (isOnVacation(date, vacations)) return false;
  return true;
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
export const MONTH_SHORT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

export const ALL_TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let t = 9 * 60 + 30; t < 13 * 60 + 30; t += SLOT_INTERVAL_MINUTES) slots.push(minutesToTime(t));
  for (let t = 16 * 60 + 30; t < 20 * 60 + 30; t += SLOT_INTERVAL_MINUTES) slots.push(minutesToTime(t));
  return slots;
})();

export const BLOCK_START_SLOTS: string[] = ALL_TIME_SLOTS;

export const BLOCK_END_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let t = 9 * 60 + 45; t <= 13 * 60 + 30; t += SLOT_INTERVAL_MINUTES) slots.push(minutesToTime(t));
  for (let t = 16 * 60 + 45; t <= 20 * 60 + 30; t += SLOT_INTERVAL_MINUTES) slots.push(minutesToTime(t));
  return slots;
})();

