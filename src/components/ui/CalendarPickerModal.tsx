import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, CalendarDays } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toISO, MONTH_NAMES } from '@/lib/schedule';

// Availability indicator dot
type AvailStatus = 'green' | 'yellow' | 'red' | 'none' | 'loading' | 'unknown';

const DAY_LABELS_SHORT = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

export interface CalendarPickerModalProps {
  /** Currently selected date as ISO string (YYYY-MM-DD) or null */
  selected: string | null;
  /** Minimum selectable date as ISO string (YYYY-MM-DD), defaults to today */
  minDate?: string;
  /** Maximum selectable date as ISO string (YYYY-MM-DD), defaults to +12 months */
  maxDate?: string;
  /**
   * Provide availability status for known dates.
   * Keys are ISO strings, values are the status.
   * Dates not in the map show as 'unknown' (no indicator).
   */
  availabilityMap?: Record<string, AvailStatus>;
  /** Called when user selects a date — passes ISO string */
  onSelect: (dateIso: string) => void;
  /** Called when the modal should be closed */
  onClose: () => void;
}

function getCalendarDays(year: number, month: number): (Date | null)[] {
  // Returns array of 42 slots (6 weeks), null for padding cells before/after month
  const firstDay = new Date(year, month, 1);
  // getDay() returns 0=Sunday, we want 0=Monday
  const startPad = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function AvailDot({ status }: { status: AvailStatus }) {
  if (status === 'loading') {
    return <span className="h-1 w-3 rounded-full bg-zinc-600 animate-pulse" />;
  }
  if (status === 'unknown') {
    return <span className="h-1 w-3 rounded-full bg-zinc-700/60" />;
  }
  if (status === 'green') {
    return <span className="h-1 w-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40" title="Alta disponibilidad" />;
  }
  if (status === 'yellow') {
    return <span className="h-1 w-3 rounded-full bg-amber-400 shadow-sm shadow-amber-400/40" title="Disponibilidad media" />;
  }
  if (status === 'red') {
    return <span className="h-1 w-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/40" title="Pocas citas libres" />;
  }
  // none
  return (
    <span className="flex items-center gap-0.5 text-rose-500">
      <span className="h-1 w-2 rounded-full bg-rose-500/80" />
      <X className="h-2 w-2 stroke-[3]" />
    </span>
  );
}

export function CalendarPickerModal({
  selected,
  minDate,
  maxDate,
  availabilityMap = {},
  onSelect,
  onClose,
}: CalendarPickerModalProps) {
  const todayIso = useMemo(() => toISO(new Date()), []);
  const min = minDate ?? todayIso;
  const maxDefault = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 12);
    return toISO(d);
  }, []);
  const max = maxDate ?? maxDefault;

  // Start display at the month of selected date, or today
  const initialDate = selected ? new Date(selected + 'T12:00:00') : new Date();
  const [displayYear, setDisplayYear] = useState(initialDate.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(initialDate.getMonth());

  const cells = useMemo(() => getCalendarDays(displayYear, displayMonth), [displayYear, displayMonth]);

  const canGoPrev = useMemo(() => {
    const minD = new Date(min + 'T00:00:00');
    const firstOfDisplay = new Date(displayYear, displayMonth, 1);
    return firstOfDisplay > new Date(minD.getFullYear(), minD.getMonth(), 1);
  }, [min, displayYear, displayMonth]);

  const canGoNext = useMemo(() => {
    const maxD = new Date(max + 'T00:00:00');
    const firstOfDisplay = new Date(displayYear, displayMonth, 1);
    return firstOfDisplay < new Date(maxD.getFullYear(), maxD.getMonth(), 1);
  }, [max, displayYear, displayMonth]);

  const prevMonth = () => {
    if (!canGoPrev) return;
    if (displayMonth === 0) { setDisplayYear(y => y - 1); setDisplayMonth(11); }
    else setDisplayMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (!canGoNext) return;
    if (displayMonth === 11) { setDisplayYear(y => y + 1); setDisplayMonth(0); }
    else setDisplayMonth(m => m + 1);
  };

  const handleDayClick = (d: Date) => {
    const iso = toISO(d);
    if (iso < min || iso > max) return;
    const status = availabilityMap[iso];
    if (status === 'none') return; // no disponible
    onSelect(iso);
    onClose();
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="cal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
      />

      {/* Calendar panel */}
      <motion.div
        key="cal-panel"
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="pointer-events-auto w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <button
              type="button"
              onClick={prevMonth}
              disabled={!canGoPrev}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <h3 className="font-display text-sm font-bold text-white capitalize tracking-tight">
              {MONTH_NAMES[displayMonth]} {displayYear}
            </h3>

            <button
              type="button"
              onClick={nextMonth}
              disabled={!canGoNext}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Close button top-right */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-all cursor-pointer z-10"
            aria-label="Cerrar calendario"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 px-3 pt-3 pb-1">
            {DAY_LABELS_SHORT.map((l) => (
              <div key={l} className="text-center text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500 pb-1">
                {l}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-1 px-3 pb-4">
            {cells.map((d, i) => {
              if (!d) {
                return <div key={`pad-${i}`} />;
              }
              const iso = toISO(d);
              const isPast = iso < min;
              const isOver = iso > max;
              const status: AvailStatus = availabilityMap[iso] ?? 'unknown';
              const isUnavailable = isPast || isOver || status === 'none';
              const isSel = iso === selected;
              const isToday = iso === todayIso;

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={isUnavailable}
                  onClick={() => handleDayClick(d)}
                  className={`
                    relative flex flex-col items-center justify-center rounded-xl py-1.5 gap-0.5 transition-all duration-150 cursor-pointer
                    ${isSel
                      ? 'gold-gradient text-black font-bold shadow-md gold-glow scale-[1.04]'
                      : isUnavailable
                      ? 'text-zinc-700 cursor-not-allowed'
                      : isToday
                      ? 'ring-1 ring-gold/40 text-white hover:bg-white/10 active:scale-95'
                      : 'text-zinc-300 hover:bg-white/8 hover:text-white active:scale-95'
                    }
                  `}
                >
                  <span className={`text-xs font-semibold leading-none ${isToday && !isSel ? 'text-gold' : ''}`}>
                    {d.getDate()}
                  </span>

                  {/* Availability indicator */}
                  <div className="flex h-1.5 items-center justify-center">
                    {!isUnavailable && !isSel && (
                      <AvailDot status={status} />
                    )}
                    {isSel && (
                      <span className="h-1 w-3 rounded-full bg-black/50" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 px-5 pb-4 pt-1 border-t border-white/5">
            <span className="flex items-center gap-1.5 text-[0.6rem] text-zinc-500">
              <span className="h-1 w-3 rounded-full bg-emerald-500" />
              Alta
            </span>
            <span className="flex items-center gap-1.5 text-[0.6rem] text-zinc-500">
              <span className="h-1 w-3 rounded-full bg-amber-400" />
              Media
            </span>
            <span className="flex items-center gap-1.5 text-[0.6rem] text-zinc-500">
              <span className="h-1 w-3 rounded-full bg-rose-500" />
              Poca
            </span>
            <span className="flex items-center gap-1.5 text-[0.6rem] text-zinc-500">
              <span className="h-1 w-2 rounded-full bg-rose-500/80" />
              <X className="h-2 w-2 text-rose-500 stroke-[3]" />
              Lleno
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/** Small trigger button to open the calendar */
export function CalendarOpenButton({
  label,
  onClick,
  className,
}: {
  label?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl glass-card px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:border-gold/30 transition-all active:scale-95 cursor-pointer ${className ?? ''}`}
    >
      <CalendarDays className="h-3.5 w-3.5 text-gold" />
      {label ?? 'Ver más fechas'}
    </button>
  );
}
