import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { StepHeader } from '@/components/ServiceStep';
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, CheckIcon } from '@/components/icons';
import { supabase } from '@/lib/supabase';
import { fetchAllServices } from '@/data/services';
import type { Barber, BarberBlock, BarberVacation, BarberSchedule, Service } from '@/types';
import {
  generateSlotsForDay,
  isDayAvailable,
  getSlotBlocksForDate,
  getTimeRangeBlocksForDate,
  isSlotAvailable,
  getServiceDurationMinutes,
  timeToMinutes,
  minutesToTime,
  toISO,
  WEEKDAY_SHORT,
  MONTH_NAMES,
  MONTH_SHORT,
} from '@/lib/schedule';

interface DateTimeStepProps {
  barber: Barber;
  service?: Service | string | null;
  onBack: () => void;
  onContinue: (date: string, time: string) => void;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function DateTimeStep({ barber, service, onBack, onContinue }: DateTimeStepProps) {
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
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [bookedIntervals, setBookedIntervals] = useState<{ start: string; duration: number }[]>([]);
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
    const [schedRes, blockRes, vacRes, servList] = await Promise.all([
      supabase.from('barber_schedules').select('*').or(`barber.eq.${barber.id},barber_id.eq.${barber.id}`),
      supabase.from('barber_blocks').select('*').eq('barber', barber.id),
      supabase.from('barber_vacations').select('*').eq('barber', barber.id),
      fetchAllServices(),
    ]);
    setSchedules((schedRes.data as BarberSchedule[]) ?? []);
    setBlocks((blockRes.data as BarberBlock[]) ?? []);
    setVacations((vacRes.data as BarberVacation[]) ?? []);
    setAllServices(servList);
    setLoading(false);
  }, [barber.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSelected(today);
  }, [today]);

  const currentServiceDuration = useMemo(() => {
    if (typeof service === 'object' && service !== null) {
      return getServiceDurationMinutes(service);
    }
    if (typeof service === 'string' && allServices.length > 0) {
      const found = allServices.find((s) => s.name === service || s.id === service);
      return getServiceDurationMinutes(found);
    }
    return 30;
  }, [service, allServices]);

  const fetchBookedSlots = useCallback(async (date: Date | null) => {
    if (!date) return;
    const iso = toISO(date);

    try {
      const { data, error } = await supabase.rpc('get_booked_intervals', { p_barber: barber.id, p_date: iso });
      if (!error && Array.isArray(data)) {
        const intervals = data.map((item: any) => {
          const sName = item.service;
          const sFound = allServices.find((s) => s.name === sName || s.id === sName);
          const dur = sFound ? getServiceDurationMinutes(sFound) : (item.duration_minutes || 30);
          return {
            start: item.booking_time,
            duration: dur,
          };
        });
        setBookedIntervals(intervals);
        return;
      }
    } catch {
      // Fallback below
    }

    const { data } = await supabase.rpc('get_booked_slots', { p_barber: barber.id, p_date: iso });
    const slotList = (data as string[]) ?? [];
    setBookedIntervals(slotList.map((s) => ({ start: s, duration: 30 })));
  }, [barber.id, allServices]);

  useEffect(() => {
    fetchBookedSlots(selected);
  }, [selected, fetchBookedSlots]);

  const scheduleForSelected = useMemo(() => {
    if (!selected) return undefined;
    const targetWeekday = selected.getDay();
    return schedules.find(
      (s) => s.weekday === targetWeekday || Number(s.day_of_week) === targetWeekday || Number(s.weekday) === targetWeekday
    );
  }, [schedules, selected]);

  const slots = selected ? generateSlotsForDay(scheduleForSelected) : { morning: [], afternoon: [] };

  const slotBlocks = useMemo(() => (selected ? getSlotBlocksForDate(selected, blocks) : new Set<string>()), [blocks, selected]);
  const timeRangeBlocks = useMemo(() => (selected ? getTimeRangeBlocksForDate(selected, blocks) : []), [blocks, selected]);

  const canContinue = selected && selectedTime;

  const handleSelectDay = (d: Date) => {
    const targetWeekday = d.getDay();
    const daySchedule = schedules.find(
      (s) => s.weekday === targetWeekday || Number(s.day_of_week) === targetWeekday || Number(s.weekday) === targetWeekday
    );
    if (!isDayAvailable(d, today, daySchedule, blocks, vacations)) return;
    setSelected(d);
    setSelectedTime('');
  };

  const prettyDate = (date: Date) =>
    `${WEEKDAY_SHORT[(date.getDay() + 6) % 7]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col animate-slide-in overflow-hidden">
      <StepHeader title="Fecha y hora" subtitle="Paso 3 de 4" onBack={onBack} />

      <div data-lenis-prevent className="flex-1 overflow-y-auto px-4 pb-4 pt-2 sm:px-5 sm:pt-3">
        {/* Compact barber chip */}
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl glass-card px-3 py-2 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {barber.photo_url ? (
              <img src={barber.photo_url} alt={barber.name} className="h-8 w-8 shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl gold-gradient font-display text-xs font-bold text-black/80">
                {barber.initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-display text-xs sm:text-sm font-bold text-white truncate">{barber.name}</p>
              <p className="text-[0.65rem] text-zinc-400 truncate">{barber.role}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-gold/10 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-gold">
            Seleccionado
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-gold" />
          </div>
        ) : (
          <>
            {/* Horizontal day pills */}
            <div className="mb-3">
              <p className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-zinc-500">Elige el día</p>
              <div data-lenis-prevent ref={scrollRef} className="no-scrollbar -mx-4 sm:-mx-5 flex gap-1.5 overflow-x-auto px-4 sm:px-5 pb-1">
                {dayPills.map((d) => {
                  const targetWeekday = d.getDay();
                  const daySchedule = schedules.find(
                    (s) => s.weekday === targetWeekday || Number(s.day_of_week) === targetWeekday || Number(s.weekday) === targetWeekday
                  );
                  const disabled = !isDayAvailable(d, today, daySchedule, blocks, vacations);
                  const isSel = selected && toISO(d) === toISO(selected);
                  return (
                    <button
                      key={toISO(d)}
                      onClick={() => handleSelectDay(d)}
                      disabled={disabled}
                      className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 transition-all duration-200 ${
                        isSel
                          ? 'gold-gradient text-black gold-glow scale-[1.02]'
                          : disabled
                          ? 'bg-zinc-900/40 text-zinc-700 cursor-not-allowed'
                          : 'glass-card text-zinc-300 hover:border-gold/20 active:scale-95'
                      }`}
                    >
                      <span className="text-[0.55rem] font-semibold uppercase tracking-wider opacity-75">
                        {DAY_LABELS[(d.getDay() + 6) % 7]}
                      </span>
                      <span className="font-display text-base sm:text-lg font-bold leading-none">{d.getDate()}</span>
                      <span className="text-[0.5rem] uppercase opacity-60">{MONTH_SHORT[d.getMonth()]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time slots — only available slots shown */}
            {selected ? (
              <div className="animate-fade-in">
                <div className="mb-2 flex items-center gap-1.5">
                  <ClockIcon className="h-3.5 w-3.5 text-gold" />
                  <p className="text-xs font-medium text-zinc-300">
                    Horas disponibles · <span className="capitalize">{prettyDate(selected)}</span>
                  </p>
                </div>

                {(() => {
                  const morningEnd = scheduleForSelected?.morning_end ?? '13:30';
                  const afternoonEnd = scheduleForSelected?.afternoon_end ?? '20:30';

                  const morningAvail = slots.morning.filter((s) =>
                    isSlotAvailable(
                      s,
                      bookedIntervals,
                      slotBlocks,
                      timeRangeBlocks,
                      selected ?? undefined,
                      new Date(),
                      currentServiceDuration,
                      morningEnd
                    )
                  );
                  const afternoonAvail = slots.afternoon.filter((s) =>
                    isSlotAvailable(
                      s,
                      bookedIntervals,
                      slotBlocks,
                      timeRangeBlocks,
                      selected ?? undefined,
                      new Date(),
                      currentServiceDuration,
                      afternoonEnd
                    )
                  );
                  const totalAvail = morningAvail.length + afternoonAvail.length;

                  if (totalAvail === 0) {
                    return (
                      <div className="rounded-2xl glass-card px-4 py-6 text-center">
                        <p className="text-xs sm:text-sm text-zinc-500">No hay horas disponibles este día.</p>
                      </div>
                    );
                  }

                  return (
                    <>
                      {morningAvail.length > 0 && (
                        <SlotGroup label="Mañana" slots={morningAvail} selected={selectedTime} onSelect={setSelectedTime} />
                      )}
                      {afternoonAvail.length > 0 && (
                        <SlotGroup label="Tarde" slots={afternoonAvail} selected={selectedTime} onSelect={setSelectedTime} />
                      )}
                    </>
                  );
                })()}
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="sticky bottom-0 z-30 mt-auto glass-panel px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {selectedTime && (
          <div className="mb-2 flex items-center justify-between px-1 text-xs text-zinc-400">
            <span>Hora seleccionada:</span>
            <span className="font-semibold text-gold">
              {selectedTime} – {minutesToTime(timeToMinutes(selectedTime) + currentServiceDuration)} ({currentServiceDuration} min)
            </span>
          </div>
        )}
        <button
          onClick={() => canContinue && onContinue(toISO(selected!), selectedTime)}
          disabled={!canContinue}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 sm:py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
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
  label, slots, selected, onSelect,
}: {
  label: string; slots: string[]; selected: string; onSelect: (s: string) => void;
}) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
        {slots.map((slot) => {
          const isSel = selected === slot;
          return (
            <button
              key={slot}
              onClick={() => onSelect(slot)}
              className={`inline-flex items-baseline justify-center rounded-xl py-2 sm:py-2.5 px-1 text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-90 ${
                isSel ? 'gold-gradient text-black gold-glow'
                : 'glass-card text-zinc-300 hover:border-gold/20 hover:text-white'
              }`}
            >
              <span>{slot}</span>
              <span className={`ml-0.5 text-[0.6rem] font-medium lowercase ${isSel ? 'text-black/80' : 'text-zinc-500'}`}>h</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
