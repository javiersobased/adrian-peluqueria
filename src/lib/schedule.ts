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
    const e = timeToMinutes(r.end);
    return slotMin >= s && slotMin < e;
  });
}

export function isSlotAvailable(
  slot: string,
  bookedSlots: Set<string>,
  slotBlocks: Set<string>,
  timeRangeBlocks: { start: string; end: string }[]
): boolean {
  if (bookedSlots.has(slot)) return false;
  if (slotBlocks.has(slot)) return false;
  if (isSlotInTimeRange(slot, timeRangeBlocks)) return false;
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
