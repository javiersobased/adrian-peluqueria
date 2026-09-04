import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
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
  MONTH_SHORT,
} from '@/lib/schedule';

interface DateTimeStepProps {
  barber: Barber;
  onBack: () => void;
  onContinue: (date: string, time: string) => void;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function DateTimeStep({ barber, onBack, onContinue }: DateTimeStepProps) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [selected, setSelected] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [schedules, setSchedules] = useState<BarberSchedule[]>([]);
  const [blocks, setBlocks] = useState<BarberBlock[]>([]);
  const [vacations, setVacations] = useState<BarberVacation[]>([]);
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dayPills = useMemo(() => {
    const pills: Date[] = [];
    const start = new Date(today);
    for (let i = 0; i < 21; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      pills.push(d);
    }
    return pills;
  }, [today]);

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

  useEffect(() => {
    setSelected(today);
  }, [today]);

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

  const scheduleForSelected = useMemo(() => {
    if (!selected) return undefined;
    return schedules.find((s) => s.weekday === selected.getDay());
  }, [schedules, selected]);

  const slots = selected ? generateSlotsForDay(scheduleForSelected) : { morning: [], afternoon: [] };

  const slotBlocks = useMemo(() => (selected ? getSlotBlocksForDate(selected, blocks) : new Set<string>()), [blocks, selected]);
  const timeRangeBlocks = useMemo(() => (selected ? getTimeRangeBlocksForDate(selected, blocks) : []), [blocks, selected]);

  const canContinue = selected && selectedTime;

  const handleSelectDay = (d: Date) => {
    const daySchedule = schedules.find((s) => s.weekday === d.getDay());
    if (!isDayAvailable(d, today, daySchedule, blocks, vacations)) return;
    setSelected(d);
    setSelectedTime('');
  };

  const prettyDate = (date: Date) =>
    `${WEEKDAY_SHORT[(date.getDay() + 6) % 7]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;

  return (
    <div className="min-h-screen animate-slide-in">
      <StepHeader title="Fecha y hora" subtitle="Paso 3 de 4" onBack={onBack} />

      <div className="px-5 pb-32">
        {/* Barber header card */}
        <div className="mb-5 flex items-center gap-4 rounded-3xl glass-card p-4">
          {barber.photo_url ? (
            <img src={barber.photo_url} alt={barber.name} className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-white/10" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl gold-gradient font-display text-base font-bold text-black/80">
              {barber.initials}
            </div>
          )}
          <div className="flex-1">
            <p className="font-display text-base font-bold text-white">{barber.name}</p>
            <p className="text-xs text-zinc-400">{barber.role}</p>
          </div>
          <span className="rounded-full bg-gold/10 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-gold">
            Seleccionado
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-gold" />
          </div>
        ) : (
          <>
            {/* Horizontal day pills */}
            <div className="mb-6">
              <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-zinc-500">Elige el día</p>
              <div ref={scrollRef} className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
                {dayPills.map((d) => {
                  const daySchedule = schedules.find((s) => s.weekday === d.getDay());
                  const disabled = !isDayAvailable(d, today, daySchedule, blocks, vacations);
                  const isSel = selected && toISO(d) === toISO(selected);
                  return (
                    <button
                      key={toISO(d)}
                      onClick={() => handleSelectDay(d)}
                      disabled={disabled}
                      className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-4 py-3 transition-all duration-200 ${
                        isSel
                          ? 'gold-gradient text-black gold-glow'
                          : disabled
                          ? 'bg-zinc-900/50 text-zinc-700 cursor-not-allowed'
                          : 'glass-card text-zinc-300 hover:border-gold/20 active:scale-95'
                      }`}
                    >
                      <span className="text-[0.6rem] font-semibold uppercase tracking-wider opacity-70">
                        {DAY_LABELS[(d.getDay() + 6) % 7]}
                      </span>
                      <span className="font-display text-lg font-bold leading-none">{d.getDate()}</span>
                      <span className="text-[0.55rem] uppercase opacity-50">{MONTH_SHORT[d.getMonth()]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time slots */}
            {selected ? (
              <div className="animate-fade-in">
                <div className="mb-3 flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-gold" />
                  <p className="text-sm font-medium text-zinc-300">
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
                  <div className="rounded-2xl glass-card px-5 py-8 text-center">
                    <p className="text-sm text-zinc-500">No hay horas disponibles este día.</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 glass-panel px-5 pb-6 pt-4">
        <button
          onClick={() => canContinue && onContinue(toISO(selected!), selectedTime)}
          disabled={!canContinue}
          className={`flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
            canContinue ? 'gold-gradient text-black hover:brightness-110 active:scale-[0.98] gold-glow' : 'bg-white/5 text-zinc-600'
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
    <div className="mb-5">
      <p className="mb-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <div className="grid grid-cols-4 gap-2">
        {slots.map((slot) => {
          const isSel = selected === slot;
          const available = isAvailable(slot);
          return (
            <button
              key={slot}
              onClick={() => available && onSelect(slot)}
              disabled={!available}
              className={`rounded-2xl py-3 text-sm font-semibold transition-all duration-200 active:scale-90 ${
                isSel ? 'gold-gradient text-black gold-glow'
                : available ? 'glass-card text-zinc-300 hover:border-gold/20 hover:text-white'
                : 'bg-zinc-900/40 text-zinc-700 cursor-not-allowed line-through'
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
