import type { BarberSchedule, BarberBlock, BarberVacation } from '@/types';

const SLOT_INTERVAL_MINUTES = 30;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
    // If a block ends at 20:00 (the former max slot option in UI), treat as covering until closing (20:30)
    // so the final 20:00 slot is properly blocked.
    // Similarly, if a morning block started at 09:30 and ended at 13:00, extend to 13:30.
    let endMin = timeToMinutes(r.end);
    if (r.end === '20:00') {
      endMin = timeToMinutes('20:30');
    } else if (r.end === '13:00' && r.start === '09:30') {
      endMin = timeToMinutes('13:30');
    }
    return slotMin >= s && slotMin < endMin;
  });
}

export function isSlotAvailable(
  slot: string,
  bookedSlots: Set<string>,
  slotBlocks: Set<string>,
  timeRangeBlocks: { start: string; end: string }[],
  selectedDate?: Date,
  now: Date = new Date()
): boolean {
  if (bookedSlots.has(slot)) return false;
  if (slotBlocks.has(slot)) return false;
  if (isSlotInTimeRange(slot, timeRangeBlocks)) return false;
  if (selectedDate && toISO(selectedDate) === toISO(now)) {
    const [h, m] = slot.split(':').map(Number);
    const slotMinutes = h * 60 + m;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (slotMinutes <= nowMinutes) return false;
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

export const BLOCK_END_SLOTS: string[] = [
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
];

