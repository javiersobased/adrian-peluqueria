import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StepHeader } from '@/components/ServiceStep';
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, CheckIcon, ScissorsIcon } from '@/components/icons';
import { X, Sun, Moon } from 'lucide-react';
import { supabase, supabaseUrl } from '@/lib/supabase';
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

import { BarberServiceIcon } from '@/components/icons/BarberServiceIcons';

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
  const [period, setPeriod] = useState<'morning' | 'afternoon'>('morning');
  const [schedules, setSchedules] = useState<BarberSchedule[]>([]);
  const [blocks, setBlocks] = useState<BarberBlock[]>([]);
  const [vacations, setVacations] = useState<BarberVacation[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [bookedIntervals, setBookedIntervals] = useState<{ start: string; duration: number }[]>([]);
  const [allBookingsByDate, setAllBookingsByDate] = useState<Record<string, { start: string; duration: number }[]>>({});
  const [loading, setLoading] = useState(true);
  const daysScrollRef = useRef<HTMLDivElement>(null);
  const slotsScrollRef = useRef<HTMLDivElement>(null);

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

  const currentServiceObj = useMemo(() => {
    if (typeof service === 'object' && service !== null) {
      return service;
    }
    if (typeof service === 'string' && allServices.length > 0) {
      return allServices.find((s) => s.name === service || s.id === service) || null;
    }
    return null;
  }, [service, allServices]);

  const currentServiceDuration = useMemo(() => {
    if (currentServiceObj) {
      return getServiceDurationMinutes(currentServiceObj);
    }
    return 30;
  }, [currentServiceObj]);

  const iconUrl = useMemo(() => {
    if (currentServiceObj?.icon && SERVICE_ICONS[currentServiceObj.icon]) {
      return SERVICE_ICONS[currentServiceObj.icon];
    }
    return null;
  }, [currentServiceObj]);

  const endTime = useMemo(() => {
    if (!selectedTime) return '';
    return minutesToTime(timeToMinutes(selectedTime) + currentServiceDuration);
  }, [selectedTime, currentServiceDuration]);

  // Cargar reservas de todos los días mostrados para calcular la disponibilidad de cada día
  useEffect(() => {
    if (loading) return;

    let active = true;
    const datesToFetch = dayPills
      .filter((d) => {
        const targetWeekday = d.getDay();
        const daySchedule = schedules.find(
          (s) => s.weekday === targetWeekday || Number(s.day_of_week) === targetWeekday || Number(s.weekday) === targetWeekday
        );
        return isDayAvailable(d, today, daySchedule, blocks, vacations);
      })
      .map((d) => toISO(d));

    if (datesToFetch.length === 0) return;

    (async () => {
      try {
        const results = await Promise.all(
          datesToFetch.map(async (iso) => {
            try {
              const { data, error } = await supabase.rpc('get_booked_intervals', { p_barber: barber.id, p_date: iso });
              if (!error && Array.isArray(data)) {
                const intervals = data.map((item: any) => {
                  const sName = (item.service || '').trim().toLowerCase();
                  const sFound = allServices.find((s) => s.name.trim().toLowerCase() === sName || s.id === item.service);
                  const dur = item.duration_minutes && item.duration_minutes > 0
                    ? item.duration_minutes
                    : (sFound ? getServiceDurationMinutes(sFound) : 30);
                  return { start: item.booking_time, duration: dur };
                });
                return { iso, intervals };
              }
            } catch {
              // ignore
            }
            return { iso, intervals: [] };
          })
        );

        if (!active) return;
        const map: Record<string, { start: string; duration: number }[]> = {};
        results.forEach(({ iso, intervals }) => {
          map[iso] = intervals;
        });
        setAllBookingsByDate((prev) => ({ ...prev, ...map }));
      } catch (err) {
        console.error('Error al cargar disponibilidad de días:', err);
      }
    })();

    return () => { active = false; };
  }, [loading, barber.id, schedules, blocks, vacations, allServices, dayPills, today]);

  const fetchBookedSlots = useCallback(async (date: Date | null) => {
    if (!date) return;
    const iso = toISO(date);

    // Si ya existe en caché, mostrarlo inmediatamente para fluidez
    setAllBookingsByDate((prev) => {
      if (prev[iso]) {
        setBookedIntervals(prev[iso]);
      }
      return prev;
    });

    try {
      const { data, error } = await supabase.rpc('get_booked_intervals', { p_barber: barber.id, p_date: iso });
      if (!error && Array.isArray(data)) {
        const intervals = data.map((item: any) => {
          const sName = (item.service || '').trim().toLowerCase();
          const sFound = allServices.find((s) => s.name.trim().toLowerCase() === sName || s.id === item.service);
          const dur = item.duration_minutes && item.duration_minutes > 0
            ? item.duration_minutes
            : (sFound ? getServiceDurationMinutes(sFound) : 30);
          return {
            start: item.booking_time,
            duration: dur,
          };
        });
        setBookedIntervals(intervals);
        setAllBookingsByDate((prev) => ({ ...prev, [iso]: intervals }));
        return;
      }
    } catch {
      // Fallback below
    }

    const { data } = await supabase.rpc('get_booked_slots', { p_barber: barber.id, p_date: iso });
    const slotList = (data as string[]) ?? [];
    const fallbackIntervals = slotList.map((s) => ({ start: s, duration: 30 }));
    setBookedIntervals(fallbackIntervals);
    setAllBookingsByDate((prev) => ({ ...prev, [iso]: fallbackIntervals }));
  }, [barber.id, allServices]);

  useEffect(() => {
    fetchBookedSlots(selected);
  }, [selected, fetchBookedSlots]);

  // Mapa de disponibilidad calculada para cada día: 'green' | 'yellow' | 'red' | 'none'
  const dayAvailabilityMap = useMemo(() => {
    const map: Record<string, 'green' | 'yellow' | 'red' | 'none'> = {};
    const now = new Date();

    dayPills.forEach((d) => {
      const iso = toISO(d);
      const targetWeekday = d.getDay();
      const daySchedule = schedules.find(
        (s) => s.weekday === targetWeekday || Number(s.day_of_week) === targetWeekday || Number(s.weekday) === targetWeekday
      );
      const available = isDayAvailable(d, today, daySchedule, blocks, vacations);
      if (!available) {
        map[iso] = 'none';
        return;
      }

      const daySlots = generateSlotsForDay(daySchedule);
      const morningEnd = daySchedule?.morning_end ?? '13:30';
      const afternoonEnd = daySchedule?.afternoon_end ?? '20:30';
      const daySlotBlocks = getSlotBlocksForDate(d, blocks);
      const dayTimeRangeBlocks = getTimeRangeBlocksForDate(d, blocks);
      const dayIntervals = allBookingsByDate[iso] || [];

      const morningAvail = daySlots.morning.filter((s) =>
        isSlotAvailable(s, dayIntervals, daySlotBlocks, dayTimeRangeBlocks, d, now, currentServiceDuration, morningEnd)
      );
      const afternoonAvail = daySlots.afternoon.filter((s) =>
        isSlotAvailable(s, dayIntervals, daySlotBlocks, dayTimeRangeBlocks, d, now, currentServiceDuration, afternoonEnd)
      );

      const totalSlots = daySlots.morning.length + daySlots.afternoon.length;
      const availableSlots = morningAvail.length + afternoonAvail.length;

      if (availableSlots === 0) {
        map[iso] = 'none';
      } else if (availableSlots <= 3 || availableSlots / totalSlots < 0.25) {
        map[iso] = 'red';
      } else if (availableSlots / totalSlots < 0.6) {
        map[iso] = 'yellow';
      } else {
        map[iso] = 'green';
      }
    });

    return map;
  }, [dayPills, schedules, blocks, vacations, allBookingsByDate, currentServiceDuration, today]);

  const scheduleForSelected = useMemo(() => {
    if (!selected) return undefined;
    const targetWeekday = selected.getDay();
    return schedules.find(
      (s) => s.weekday === targetWeekday || Number(s.day_of_week) === targetWeekday || Number(s.weekday) === targetWeekday
    );
  }, [schedules, selected]);

  const slots = useMemo(() => {
    return selected ? generateSlotsForDay(scheduleForSelected) : { morning: [], afternoon: [] };
  }, [selected, scheduleForSelected]);

  const slotBlocks = useMemo(() => (selected ? getSlotBlocksForDate(selected, blocks) : new Set<string>()), [blocks, selected]);
  const timeRangeBlocks = useMemo(() => (selected ? getTimeRangeBlocksForDate(selected, blocks) : []), [blocks, selected]);

  const morningEnd = scheduleForSelected?.morning_end ?? '13:30';
  const afternoonEnd = scheduleForSelected?.afternoon_end ?? '20:30';

  const morningAvail = useMemo(() => {
    if (!selected) return [];
    return slots.morning.filter((s) =>
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
  }, [slots.morning, bookedIntervals, slotBlocks, timeRangeBlocks, selected, currentServiceDuration, morningEnd]);

  const afternoonAvail = useMemo(() => {
    if (!selected) return [];
    return slots.afternoon.filter((s) =>
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
  }, [slots.afternoon, bookedIntervals, slotBlocks, timeRangeBlocks, selected, currentServiceDuration, afternoonEnd]);

  // Si el turno actual no tiene horas pero el otro sí, cambiar automáticamente de turno
  useEffect(() => {
    if (morningAvail.length === 0 && afternoonAvail.length > 0) {
      setPeriod('afternoon');
    } else if (afternoonAvail.length === 0 && morningAvail.length > 0) {
      setPeriod('morning');
    }
  }, [morningAvail.length, afternoonAvail.length]);

  // Resetear scroll horizontal de las horas al cambiar de periodo o de día
  useEffect(() => {
    if (slotsScrollRef.current) {
      slotsScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [period, selected]);

  const currentPeriodSlots = period === 'morning' ? morningAvail : afternoonAvail;
  const canContinue = Boolean(selected && selectedTime);

  const handleSelectDay = (d: Date) => {
    const targetWeekday = d.getDay();
    const daySchedule = schedules.find(
      (s) => s.weekday === targetWeekday || Number(s.day_of_week) === targetWeekday || Number(s.weekday) === targetWeekday
    );
    if (!isDayAvailable(d, today, daySchedule, blocks, vacations)) return;
    setSelected(d);
    setSelectedTime('');
    fetchBookedSlots(d);
  };

  const scrollDays = (direction: 'left' | 'right') => {
    if (daysScrollRef.current) {
      const amount = direction === 'left' ? -240 : 240;
      daysScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const scrollSlots = (direction: 'left' | 'right') => {
    if (slotsScrollRef.current) {
      const amount = direction === 'left' ? -200 : 200;
      slotsScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const currentMonthLabel = useMemo(() => {
    const target = selected || today;
    return `${MONTH_NAMES[target.getMonth()]} ${target.getFullYear()}`;
  }, [selected, today]);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col animate-slide-in overflow-hidden">
      {/* Modal Card wrapper - centered on desktop, edge-to-edge on mobile */}
      <div className="flex flex-col h-full w-full max-w-xl mx-auto sm:my-auto sm:max-h-[94vh] sm:rounded-3xl sm:border sm:border-white/10 sm:bg-zinc-950/80 sm:backdrop-blur-xl sm:shadow-2xl overflow-hidden">
        
        {/* Header: Centered Month y Year with Close button on right */}
        <div className="relative flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10 shrink-0">
          <div className="w-8" />
          <h2 className="font-display text-base sm:text-lg font-bold text-white capitalize text-center">
            {currentMonthLabel}
          </h2>
          <button
            type="button"
            onClick={onBack}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div data-lenis-prevent className="flex-1 overflow-y-auto px-4 sm:px-6 py-3">
          {/* Badge informativo de barbero seleccionado para evitar confusiones */}
          <div className="mb-3 flex items-center justify-between rounded-2xl bg-white/[0.04] border border-white/5 px-3.5 py-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {barber.photo_url ? (
                <img src={barber.photo_url} alt="" className="h-7 w-7 rounded-full object-cover shrink-0 ring-1 ring-gold/30" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full gold-gradient font-display text-[0.65rem] font-bold text-black shrink-0">
                  {barber.initials}
                </span>
              )}
              <div className="min-w-0 truncate">
                <p className="text-[0.65rem] uppercase tracking-wider text-zinc-400">Barbero seleccionado</p>
                <p className="text-xs font-bold text-white truncate">{barber.name}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="shrink-0 text-xs font-semibold text-gold hover:text-gold/80 hover:underline px-2 py-1"
            >
              Cambiar
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-gold" />
            </div>
          ) : (
            <>
              {/* Day selection row flanked by left and right arrow buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => scrollDays('left')}
                  aria-label="Días anteriores"
                  className="flex h-12 w-8 sm:w-9 shrink-0 items-center justify-center rounded-xl glass-card text-zinc-400 hover:text-white hover:border-gold/30 active:scale-95 transition-all cursor-pointer"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>

                <div
                  ref={daysScrollRef}
                  data-lenis-prevent
                  className="no-scrollbar flex flex-1 items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 scroll-smooth"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {dayPills.map((d) => {
                    const targetWeekday = d.getDay();
                    const daySchedule = schedules.find(
                      (s) => s.weekday === targetWeekday || Number(s.day_of_week) === targetWeekday || Number(s.weekday) === targetWeekday
                    );
                    const disabled = !isDayAvailable(d, today, daySchedule, blocks, vacations);
                    const isSel = selected && toISO(d) === toISO(selected);
                    const avail = dayAvailabilityMap[toISO(d)] ?? (disabled ? 'none' : 'green');

                    return (
                      <button
                        key={toISO(d)}
                        onClick={() => handleSelectDay(d)}
                        disabled={disabled}
                        className={`flex-1 min-w-[50px] sm:min-w-[62px] flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 sm:py-2.5 transition-all duration-200 cursor-pointer ${
                          isSel
                            ? 'gold-gradient text-black gold-glow scale-[1.03] font-bold shadow-md'
                            : disabled
                            ? 'bg-zinc-900/30 text-zinc-600 cursor-not-allowed border border-transparent'
                            : 'glass-card text-zinc-300 hover:border-gold/30 hover:text-white active:scale-95'
                        }`}
                      >
                        <span className="text-[0.65rem] font-semibold opacity-85">
                          {DAY_LABELS[(d.getDay() + 6) % 7]}.
                        </span>
                        <span className="font-display text-base sm:text-lg font-bold leading-none my-0.5">
                          {d.getDate()}
                        </span>

                        {/* Barrita alargada de disponibilidad */}
                        <div className="mt-0.5 flex h-2 items-center justify-center">
                          {avail === 'green' && (
                            <span
                              className={`h-1 w-4 sm:w-5 rounded-full bg-emerald-500 ${
                                isSel ? 'bg-black/80' : 'shadow-sm shadow-emerald-500/50'
                              }`}
                              title="Mayoría de citas disponibles"
                            />
                          )}
                          {avail === 'yellow' && (
                            <span
                              className={`h-1 w-4 sm:w-5 rounded-full bg-amber-400 ${
                                isSel ? 'bg-black/80' : 'shadow-sm shadow-amber-400/50'
                              }`}
                              title="Disponibilidad media"
                            />
                          )}
                          {avail === 'red' && (
                            <span
                              className={`h-1 w-4 sm:w-5 rounded-full bg-rose-500 ${
                                isSel ? 'bg-black/80' : 'shadow-sm shadow-rose-500/50'
                              }`}
                              title="Pocas citas disponibles"
                            />
                          )}
                          {avail === 'none' && (
                            <div
                              className={`flex items-center gap-0.5 ${
                                isSel ? 'text-black' : 'text-rose-500'
                              }`}
                              title="Sin citas disponibles"
                            >
                              <span className={`h-1 w-2.5 rounded-full ${isSel ? 'bg-black/80' : 'bg-rose-500/80'}`} />
                              <X className="h-2 w-2 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => scrollDays('right')}
                  aria-label="Días siguientes"
                  className="flex h-12 w-8 sm:w-9 shrink-0 items-center justify-center rounded-xl glass-card text-zinc-400 hover:text-white hover:border-gold/30 active:scale-95 transition-all cursor-pointer"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Centered Period Dock (Mañana / Tarde) */}
              <div className="flex justify-center my-3 sm:my-3.5">
                <div className="relative inline-flex p-1 rounded-2xl bg-zinc-900/80 border border-white/10 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setPeriod('morning')}
                    className={`relative px-5 sm:px-7 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors duration-200 z-10 cursor-pointer select-none ${
                      period === 'morning' ? 'text-black font-bold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {period === 'morning' && (
                      <motion.div
                        layoutId="dockPeriodIndicator"
                        className="absolute inset-0 rounded-xl gold-gradient shadow-md"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Sun className={`h-3.5 w-3.5 ${period === 'morning' ? 'text-black' : 'text-amber-400'}`} />
                      Mañana
                      {morningAvail.length > 0 && (
                        <span className={`text-[0.65rem] px-1.5 py-0.5 rounded-full ${period === 'morning' ? 'bg-black/20 text-black font-bold' : 'bg-white/5 text-zinc-400 font-medium'}`}>
                          {morningAvail.length}
                        </span>
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPeriod('afternoon')}
                    className={`relative px-5 sm:px-7 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors duration-200 z-10 cursor-pointer select-none ${
                      period === 'afternoon' ? 'text-black font-bold' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {period === 'afternoon' && (
                      <motion.div
                        layoutId="dockPeriodIndicator"
                        className="absolute inset-0 rounded-xl gold-gradient shadow-md"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <Moon className={`h-3.5 w-3.5 ${period === 'afternoon' ? 'text-black' : 'text-indigo-300'}`} />
                      Tarde
                      {afternoonAvail.length > 0 && (
                        <span className={`text-[0.65rem] px-1.5 py-0.5 rounded-full ${period === 'afternoon' ? 'bg-black/20 text-black font-bold' : 'bg-white/5 text-zinc-400 font-medium'}`}>
                          {afternoonAvail.length}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              </div>

              {/* Single row of hours flanked by left and right arrow buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2 my-2 sm:my-3">
                <button
                  type="button"
                  onClick={() => scrollSlots('left')}
                  aria-label="Horas anteriores"
                  className="flex h-10 w-8 sm:w-9 shrink-0 items-center justify-center rounded-xl glass-card text-zinc-400 hover:text-white hover:border-gold/30 active:scale-95 transition-all cursor-pointer"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>

                <div
                  ref={slotsScrollRef}
                  data-lenis-prevent
                  className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto py-1 scroll-smooth"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {currentPeriodSlots.length === 0 ? (
                    <div className="w-full text-center py-2 text-xs text-zinc-400">
                      No hay horas disponibles por la {period === 'morning' ? 'mañana' : 'tarde'}.
                    </div>
                  ) : (
                    currentPeriodSlots.map((slot) => {
                      const isSel = selectedTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={`flex h-10 shrink-0 min-w-[72px] sm:min-w-[80px] items-baseline justify-center whitespace-nowrap rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer ${
                            isSel
                              ? 'gold-gradient text-black gold-glow scale-[1.03] shadow-md font-bold'
                              : 'glass-card text-zinc-300 hover:border-gold/30 hover:text-white'
                          }`}
                        >
                          <span>{slot}</span>
                          <span className={`ml-0.5 text-[0.65rem] font-medium lowercase ${isSel ? 'text-black/80' : 'text-zinc-500'}`}>
                            h
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => scrollSlots('right')}
                  aria-label="Horas siguientes"
                  className="flex h-10 w-8 sm:w-9 shrink-0 items-center justify-center rounded-xl glass-card text-zinc-400 hover:text-white hover:border-gold/30 active:scale-95 transition-all cursor-pointer"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Service y Barber Card (Embed) */}
              <div className="rounded-2xl border border-white/10 bg-zinc-900/90 backdrop-blur-md p-4 sm:p-5 shadow-xl mt-3 sm:mt-4">
                {/* Fila superior: Servicio, Precio y Rango Horario */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold/20 via-gold/5 to-black/40 border border-gold/20 text-gold shadow-sm">
                      <BarberServiceIcon name={currentServiceObj?.icon} serviceName={currentServiceObj?.name} className="h-5 w-5 text-gold" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-sm sm:text-base font-bold text-white truncate">
                        {currentServiceObj?.name ?? (typeof service === 'string' ? service : 'Servicio')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display text-sm sm:text-base font-bold text-gold">
                      {currentServiceObj?.price !== undefined
                        ? `${currentServiceObj.price.toFixed(2).replace('.', ',')} €`
                        : '—'}
                    </p>
                    {selectedTime && (
                      <p className="text-xs text-zinc-400 font-medium mt-0.5">
                        {selectedTime} - {endTime}
                      </p>
                    )}
                  </div>
                </div>

                {/* Línea divisoria */}
                <div className="border-t border-white/10 my-3.5" />

                {/* Fila inferior: Barbero con foto y nombre */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xs text-zinc-400 font-medium">Empleado:</span>
                  {barber.photo_url ? (
                    <img
                      src={barber.photo_url}
                      alt={barber.name}
                      className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-full object-cover ring-1 ring-gold/40"
                    />
                  ) : (
                    <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full gold-gradient font-display text-xs font-bold text-black/80">
                      {barber.initials}
                    </div>
                  )}
                  <span className="font-display text-xs sm:text-sm font-semibold text-white truncate">
                    {barber.name}
                  </span>
                  {barber.role && (
                    <span className="text-[0.65rem] text-zinc-400 ml-1">
                      ({barber.role})
                    </span>
                  )}
                </div>
              </div>

              {/* Total y Duration section */}
              <div className="mt-4 sm:mt-5 flex flex-col items-end px-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm text-zinc-400">Total :</span>
                  <span className="font-display text-xl sm:text-2xl font-bold text-gold">
                    {currentServiceObj?.price !== undefined
                      ? `${currentServiceObj.price.toFixed(2).replace('.', ',')} €`
                      : '—'}
                  </span>
                </div>
                <span className="text-xs text-zinc-500 font-medium -mt-0.5">
                  {currentServiceDuration} min
                </span>
              </div>

              {/* Continuar button */}
              <button
                onClick={() => canContinue && onContinue(toISO(selected!), selectedTime)}
                disabled={!canContinue}
                className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 sm:py-4 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-300 mt-3 cursor-pointer ${
                  canContinue
                    ? 'gold-gradient text-black hover:brightness-110 active:scale-[0.98] gold-glow shadow-lg'
                    : 'bg-white/5 text-zinc-600 cursor-not-allowed'
                }`}
              >
                Continuar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
