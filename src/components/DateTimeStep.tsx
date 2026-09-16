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

const ICON_BASE = `${supabaseUrl}/storage/v1/object/public/service-icons`;

const SERVICE_ICONS: Record<string, string> = {
  scissors: `${ICON_BASE}/corte.png`,
  'scissors-crossed': `${ICON_BASE}/corte-barba.png`,
  beard: `${ICON_BASE}/barba.png`,
  color: `${ICON_BASE}/tinte.png`,
  contours: `${ICON_BASE}/peinado-estilo.png`,
  'kids-cut': `${ICON_BASE}/corte-ninos.png`,
  'nose-wax': `${ICON_BASE}/depilado-nasal.png`,
  'eyebrow-razor': `${ICON_BASE}/cejas-cuchilla.png`,
  clipper: `${ICON_BASE}/maquina-pelar.png`,
  wash: `${ICON_BASE}/polvos-volumen.png`,
  fade: `${ICON_BASE}/degradado-pelo.png`,
};

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
  const scrollRef = useRef<HTMLDivElement>(null);
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
    if (loading || schedules.length === 0) return;

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
                  const sName = item.service;
                  const sFound = allServices.find((s) => s.name === sName || s.id === sName);
                  const dur = sFound ? getServiceDurationMinutes(sFound) : (item.duration_minutes || 30);
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

    if (allBookingsByDate[iso]) {
      setBookedIntervals(allBookingsByDate[iso]);
      return;
    }

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
  }, [barber.id, allServices, allBookingsByDate]);

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
  };

  const scrollSlots = (direction: 'left' | 'right') => {
    if (slotsScrollRef.current) {
      const amount = direction === 'left' ? -220 : 220;
      slotsScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const prettyDate = (date: Date) =>
    `${WEEKDAY_SHORT[(date.getDay() + 6) % 7]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col animate-slide-in overflow-hidden">
      <StepHeader title="Fecha y hora" subtitle="Paso 3 de 4" onBack={onBack} />

      <div data-lenis-prevent className="flex-1 overflow-y-auto px-4 pb-3 pt-2 sm:px-5 sm:pt-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-gold" />
          </div>
        ) : (
          <>
            {/* Horizontal day selector pills with availability status */}
            <div className="mb-3">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 px-0.5">
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-zinc-500">Elige el día</p>
                <div className="flex items-center gap-2 text-[0.55rem] sm:text-[0.6rem] text-zinc-400">
                  <span className="flex items-center gap-1" title="La mayoría de citas disponibles">
                    <span className="h-1.5 w-2.5 rounded-full bg-emerald-500" /> Mucha
                  </span>
                  <span className="flex items-center gap-1" title="Alrededor de la mitad disponible">
                    <span className="h-1.5 w-2.5 rounded-full bg-amber-400" /> Media
                  </span>
                  <span className="flex items-center gap-1" title="Quedan muy pocas citas disponibles">
                    <span className="h-1.5 w-2.5 rounded-full bg-rose-500" /> Pocas
                  </span>
                  <span className="flex items-center gap-0.5 text-rose-400" title="Sin citas disponibles">
                    <span className="h-1.5 w-2 rounded-full bg-rose-500" />
                    <X className="h-2 w-2 stroke-[3]" /> Sin citas
                  </span>
                </div>
              </div>

              <div data-lenis-prevent ref={scrollRef} className="no-scrollbar -mx-4 sm:-mx-5 flex gap-1.5 overflow-x-auto px-4 sm:px-5 pb-1">
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
                      className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 transition-all duration-200 cursor-pointer ${
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

                      {/* Barrita alargada y fina de disponibilidad */}
                      <div className="mt-1 flex h-2.5 items-center justify-center">
                        {avail === 'green' && (
                          <span
                            className={`h-1 w-5 sm:w-6 rounded-full bg-emerald-500 shadow-sm ${
                              isSel ? 'border border-black/20 shadow-none' : 'shadow-emerald-500/60'
                            }`}
                            title="Mayoría de citas disponibles"
                          />
                        )}
                        {avail === 'yellow' && (
                          <span
                            className={`h-1 w-5 sm:w-6 rounded-full bg-amber-400 shadow-sm ${
                              isSel ? 'border border-black/20 shadow-none' : 'shadow-amber-400/60'
                            }`}
                            title="Disponibilidad media"
                          />
                        )}
                        {avail === 'red' && (
                          <span
                            className={`h-1 w-5 sm:w-6 rounded-full bg-rose-500 shadow-sm ${
                              isSel ? 'border border-black/20 shadow-none' : 'shadow-rose-500/60'
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
                            <span className={`h-1 w-3 rounded-full ${isSel ? 'bg-black/70' : 'bg-rose-500/80'}`} />
                            <X className="h-2.5 w-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time selection container */}
            {selected ? (
              <div className="animate-fade-in">
                {/* Header with selected date and desktop scroll controls */}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ClockIcon className="h-3.5 w-3.5 text-gold" />
                    <p className="text-xs font-medium text-zinc-300">
                      Horas disponibles · <span className="capitalize">{prettyDate(selected)}</span>
                    </p>
                  </div>
                  {currentPeriodSlots.length > 6 && (
                    <div className="flex items-center gap-1">
                      <span className="hidden sm:inline text-[0.6rem] text-zinc-500 mr-1 font-medium">Desliza</span>
                      <button
                        type="button"
                        onClick={() => scrollSlots('left')}
                        aria-label="Desplazar horas a la izquierda"
                        className="flex h-6 w-6 items-center justify-center rounded-lg glass-card text-zinc-400 hover:text-white active:scale-95 transition-all cursor-pointer"
                      >
                        <ChevronLeftIcon className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollSlots('right')}
                        aria-label="Desplazar horas a la derecha"
                        className="flex h-6 w-6 items-center justify-center rounded-lg glass-card text-zinc-400 hover:text-white active:scale-95 transition-all cursor-pointer"
                      >
                        <ChevronRightIcon className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Animated Morning / Afternoon Dock */}
                <div className="relative mb-2.5 grid grid-cols-2 p-1 rounded-2xl bg-zinc-900/80 border border-white/10 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setPeriod('morning')}
                    className={`relative flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-xl transition-colors duration-200 z-10 cursor-pointer select-none ${
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
                    <Sun className={`relative z-10 h-3.5 w-3.5 transition-transform duration-200 ${period === 'morning' ? 'text-black scale-110' : 'text-amber-400'}`} />
                    <span className="relative z-10">Mañana</span>
                    <span
                      className={`relative z-10 text-[0.65rem] px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
                        period === 'morning' ? 'bg-black/20 text-black' : 'bg-white/5 text-zinc-400'
                      }`}
                    >
                      {morningAvail.length}
                    </span>
                    {morningAvail.includes(selectedTime) && (
                      <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-black shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPeriod('afternoon')}
                    className={`relative flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-xl transition-colors duration-200 z-10 cursor-pointer select-none ${
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
                    <Moon className={`relative z-10 h-3.5 w-3.5 transition-transform duration-200 ${period === 'afternoon' ? 'text-black scale-110' : 'text-indigo-300'}`} />
                    <span className="relative z-10">Tarde</span>
                    <span
                      className={`relative z-10 text-[0.65rem] px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
                        period === 'afternoon' ? 'bg-black/20 text-black' : 'bg-white/5 text-zinc-400'
                      }`}
                    >
                      {afternoonAvail.length}
                    </span>
                    {afternoonAvail.includes(selectedTime) && (
                      <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-black shrink-0" />
                    )}
                  </button>
                </div>

                {/* Horizontal scrollable slots (2 rows) */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${selected?.toISOString()}-${period}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                  >
                    {currentPeriodSlots.length === 0 ? (
                      <div className="rounded-2xl glass-card px-4 py-6 text-center">
                        <p className="text-xs sm:text-sm text-zinc-400">
                          No hay horas disponibles por la {period === 'morning' ? 'mañana' : 'tarde'}.
                        </p>
                        {(period === 'morning' ? afternoonAvail : morningAvail).length > 0 && (
                          <button
                            type="button"
                            onClick={() => setPeriod(period === 'morning' ? 'afternoon' : 'morning')}
                            className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20 transition-all cursor-pointer"
                          >
                            Ver turno de {period === 'morning' ? 'tarde' : 'mañana'} (
                            {(period === 'morning' ? afternoonAvail : morningAvail).length} disponibles) &rarr;
                          </button>
                        )}
                      </div>
                    ) : (
                      <div
                        ref={slotsScrollRef}
                        data-lenis-prevent
                        className="no-scrollbar -mx-4 sm:-mx-5 flex overflow-x-auto px-4 sm:px-5 py-1 scroll-smooth overscroll-x-contain"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                      >
                        <div className="grid grid-rows-2 grid-flow-col gap-2 auto-cols-[minmax(76px,max-content)]">
                          {currentPeriodSlots.map((slot) => {
                            const isSel = selectedTime === slot;
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setSelectedTime(slot)}
                                className={`inline-flex h-9 items-baseline justify-center whitespace-nowrap rounded-xl px-3 text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer ${
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
                          })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Sticky Bottom Area with Live Appointment Summary Embed and Continue button */}
      <div className="sticky bottom-0 z-30 mt-auto glass-panel px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* Live Appointment Summary Embed */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900/90 backdrop-blur-md p-3 sm:p-3.5 shadow-2xl mb-2.5">
          {/* Fila 1: Servicio e Importe */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {iconUrl ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gold/10 border border-gold/20 overflow-hidden">
                  <img src={iconUrl} alt="" className="h-5 w-5 object-contain" />
                </div>
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gold/10 border border-gold/20 text-gold">
                  <ScissorsIcon className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-400">Servicio</p>
                <p className="font-display text-xs sm:text-sm font-bold text-white truncate">
                  {currentServiceObj?.name ?? (typeof service === 'string' ? service : 'Servicio')}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-400">Importe</p>
              <p className="font-display text-sm sm:text-base font-bold text-gold">
                {currentServiceObj?.price !== undefined ? `${currentServiceObj.price}€` : '—'}
              </p>
            </div>
          </div>

          {/* Fila 2: Hora seleccionada y fin previsto (solo si está seleccionada) */}
          {selectedTime && (
            <div className="mt-2.5 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2 animate-fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                  <ClockIcon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-400">
                    Horario previsto {selected ? `· ${prettyDate(selected)}` : ''}
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    <span>{selectedTime}</span>
                    <span className="text-[0.65rem] font-normal text-zinc-400">h</span>
                    <span className="mx-1.5 text-gold/70">–</span>
                    <span>{endTime}</span>
                    <span className="text-[0.65rem] font-normal text-zinc-400">h</span>
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-gold/15 border border-gold/30 px-2.5 py-0.5 text-[0.65rem] font-bold text-gold">
                {currentServiceDuration} min
              </span>
            </div>
          )}

          {/* Fila 3: Peluquero seleccionado abajo */}
          <div className="mt-2.5 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {barber.photo_url ? (
                <img
                  src={barber.photo_url}
                  alt={barber.name}
                  className="h-8 w-8 shrink-0 rounded-xl object-cover ring-1 ring-gold/40"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl gold-gradient font-display text-xs font-bold text-black/80">
                  {barber.initials}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-zinc-400">Peluquero</p>
                <p className="font-display text-xs sm:text-sm font-bold text-white truncate">{barber.name}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[0.6rem] font-medium text-zinc-300">
              {barber.role || 'Barbero'}
            </span>
          </div>
        </div>

        {/* Botón Continuar */}
        <button
          onClick={() => canContinue && onContinue(toISO(selected!), selectedTime)}
          disabled={!canContinue}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 sm:py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
            canContinue
              ? 'gold-gradient text-black hover:brightness-110 active:scale-[0.98] gold-glow cursor-pointer'
              : 'bg-white/5 text-zinc-600 cursor-not-allowed'
          }`}
        >
          <CheckIcon className="h-4 w-4" />
          Continuar
        </button>
      </div>
    </div>
  );
}
