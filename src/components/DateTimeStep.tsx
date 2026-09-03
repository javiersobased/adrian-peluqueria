import { useMemo, useState, useEffect, useCallback } from 'react';
import { StepHeader } from '@/components/ServiceStep';
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, CheckIcon } from '@/components/icons';
import { supabase } from '@/lib/supabase';
import type { Barber, BarberBlock, BarberVacation, BarberSchedule } from '@/types';
import {
  generateSlotsForDay,
  isDayAvailable,
  getSlotBlocksForDate,
  getTimeRangeBlocksForDate,
  isSlotAvailable,
  toISO,
  WEEKDAY_SHORT,
  MONTH_NAMES,
} from '@/lib/schedule';

interface DateTimeStepProps {
  barber: Barber;
  onBack: () => void;
  onContinue: (date: string, time: string) => void;
}

export function DateTimeStep({ barber, onBack, onContinue }: DateTimeStepProps) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [schedules, setSchedules] = useState<BarberSchedule[]>([]);
  const [blocks, setBlocks] = useState<BarberBlock[]>([]);
  const [vacations, setVacations] = useState<BarberVacation[]>([]);
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [schedRes, blockRes, vacRes] = await Promise.all([
      supabase.from('barber_schedules').select('*').eq('barber', barber.id),
      supabase.from('barber_blocks').select('*').eq('barber', barber.id),
      supabase.from('barber_vacations').select('*').eq('barber', barber.id),
    ]);
    setSchedules((schedRes.data as BarberSchedule[]) ?? []);
    setBlocks((blockRes.data as BarberBlock[]) ?? []);
    setVacations((vacRes.data as BarberVacation[]) ?? []);
    setLoading(false);
  }, [barber.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchBookedSlots = useCallback(async (date: Date | null) => {
    if (!date) return;
    const iso = toISO(date);
    const { data } = await supabase
      .from('bookings')
      .select('booking_time')
      .eq('barber', barber.id)
      .eq('booking_date', iso)
      .neq('status', 'cancelled');
    setBookedSlots(new Set((data ?? []).map((r: { booking_time: string }) => r.booking_time)));
  }, [barber.id]);

  useEffect(() => {
    fetchBookedSlots(selected);
  }, [selected, fetchBookedSlots]);

  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [viewMonth]);

  const scheduleForSelected = useMemo(() => {
    if (!selected) return undefined;
    return schedules.find((s) => s.weekday === selected.getDay());
  }, [schedules, selected]);

  const slots = selected ? generateSlotsForDay(scheduleForSelected) : { morning: [], afternoon: [] };

  const slotBlocks = useMemo(() => (selected ? getSlotBlocksForDate(selected, blocks) : new Set<string>()), [blocks, selected]);
  const timeRangeBlocks = useMemo(() => (selected ? getTimeRangeBlocksForDate(selected, blocks) : []), [blocks, selected]);

  const canContinue = selected && selectedTime;

  const handleSelectDay = (d: Date) => {
    if (!isDayAvailable(d, today, scheduleForSelected, blocks, vacations) && !isDayAvailable(d, today, schedules.find((s) => s.weekday === d.getDay()), blocks, vacations)) return;
    if (!isDayAvailable(d, today, schedules.find((s) => s.weekday === d.getDay()), blocks, vacations)) return;
    setSelected(d);
    setSelectedTime('');
  };

  const prevMonth = () => {
    const prev = new Date(viewMonth);
    prev.setMonth(prev.getMonth() - 1);
    if (prev.getFullYear() < today.getFullYear() ||
        (prev.getFullYear() === today.getFullYear() && prev.getMonth() < today.getMonth())) return;
    setViewMonth(prev);
  };

  const nextMonth = () => {
    const next = new Date(viewMonth);
    next.setMonth(next.getMonth() + 1);
    setViewMonth(next);
  };

  const prettyDate = (date: Date) =>
    `${WEEKDAY_SHORT[(date.getDay() + 6) % 7]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;

  return (
    <div className="min-h-screen animate-slide-in">
      <StepHeader title="Fecha y hora" subtitle="Paso 3 de 4" onBack={onBack} />

      <div className="px-5 pb-32">
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-wood/20 bg-wood/10 px-4 py-3">
          {barber.photo_url ? (
            <img src={barber.photo_url} alt={barber.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-wood to-wood-dark font-display text-sm font-semibold text-marble">
              {barber.initials}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-marble">Cita con {barber.name}</p>
            <p className="text-xs text-marble/50">{barber.role}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-marble/20 border-t-wood" />
          </div>
        ) : (
          <>
            <div className="glass-panel rounded-2xl p-4">
              <div className="mb-4 flex items-center justify-between">
                <button onClick={prevMonth} aria-label="Mes anterior" className="flex h-9 w-9 items-center justify-center rounded-full bg-marble/5 text-marble/70 transition-colors hover:bg-marble/10 active:scale-90">
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <p className="font-display text-lg font-medium text-marble">
                  {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                </p>
                <button onClick={nextMonth} aria-label="Mes siguiente" className="flex h-9 w-9 items-center justify-center rounded-full bg-marble/5 text-marble/70 transition-colors hover:bg-marble/10 active:scale-90">
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-2 grid grid-cols-7 gap-1">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                  <div key={d} className="text-center text-[0.65rem] font-medium uppercase text-marble/35">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((d, i) => {
                  if (!d) return <div key={`e-${i}`} />;
                  const daySchedule = schedules.find((s) => s.weekday === d.getDay());
                  const disabled = !isDayAvailable(d, today, daySchedule, blocks, vacations);
                  const isSel = selected && toISO(d) === toISO(selected);
                  return (
                    <button
                      key={toISO(d)}
                      onClick={() => handleSelectDay(d)}
                      disabled={disabled}
                      className={`flex aspect-square items-center justify-center rounded-xl text-sm transition-all duration-150 ${
                        isSel
                          ? 'bg-wood text-marble font-semibold shadow-lg shadow-wood/20'
                          : disabled
                          ? 'text-marble/20 cursor-not-allowed'
                          : 'text-marble/80 hover:bg-marble/10 active:scale-90'
                      }`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {selected ? (
              <div className="mt-5 animate-fade-in">
                <div className="mb-3 flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-wood-light" />
                  <p className="text-sm text-marble/80">
                    Horas disponibles · <span className="capitalize">{prettyDate(selected)}</span>
                  </p>
                </div>

                {slots.morning.length > 0 && (
                  <SlotGroup label="Mañana" slots={slots.morning} selected={selectedTime} onSelect={setSelectedTime}
                    isAvailable={(s) => isSlotAvailable(s, bookedSlots, slotBlocks, timeRangeBlocks)} />
                )}
                {slots.afternoon.length > 0 ? (
                  <SlotGroup label="Tarde" slots={slots.afternoon} selected={selectedTime} onSelect={setSelectedTime}
                    isAvailable={(s) => isSlotAvailable(s, bookedSlots, slotBlocks, timeRangeBlocks)} />
                ) : slots.morning.length === 0 ? (
                  <p className="mt-2 text-xs text-marble/40">No hay horas disponibles este día.</p>
                ) : null}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-marble/10 px-5 py-8 text-center">
                <ClockIcon className="mx-auto h-7 w-7 text-marble/25" />
                <p className="mt-2 text-sm text-marble/50">Selecciona un día para ver las horas disponibles.</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 glass-panel px-5 pb-6 pt-4">
        <button
          onClick={() => canContinue && onContinue(toISO(selected!), selectedTime)}
          disabled={!canContinue}
          className={`flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-semibold uppercase tracking-wider transition-all duration-200 ${
            canContinue ? 'bg-marble text-ink hover:bg-white active:scale-[0.98]' : 'bg-marble/10 text-marble/30'
          }`}
        >
          <CheckIcon className="h-4 w-4" />
          Continuar
        </button>
      </div>
    </div>
  );
}

function SlotGroup({
  label, slots, selected, onSelect, isAvailable,
}: {
  label: string; slots: string[]; selected: string; onSelect: (s: string) => void; isAvailable: (s: string) => boolean;
}) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-[0.65rem] uppercase tracking-[0.2em] text-marble/40">{label}</p>
      <div className="grid grid-cols-4 gap-2">
        {slots.map((slot) => {
          const isSel = selected === slot;
          const available = isAvailable(slot);
          return (
            <button
              key={slot}
              onClick={() => available && onSelect(slot)}
              disabled={!available}
              className={`rounded-xl py-2.5 text-sm font-medium transition-all duration-150 active:scale-90 ${
                isSel ? 'bg-wood text-marble shadow-md shadow-wood/20'
                : available ? 'bg-marble/[0.05] text-marble/75 hover:bg-marble/10'
                : 'bg-marble/[0.02] text-marble/20 cursor-not-allowed line-through'
              }`}
            >
              {slot}
            </button>
          );
        })}
      </div>
    </div>
  );
}
