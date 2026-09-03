import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { BarberBlock, Barber, BarberVacation } from '@/types';
import { Trash2, CalendarOff, Clock, Plane } from 'lucide-react';
import { ALL_TIME_SLOTS, toISO, WEEKDAY_NAMES } from '@/lib/schedule';

interface AdminAvailabilityProps {
  blocks: BarberBlock[];
  onRefresh: () => void;
}

type BlockMode = 'day_full' | 'time_range' | 'vacation';

export function AdminAvailability({ blocks, onRefresh }: AdminAvailabilityProps) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barber, setBarber] = useState('');
  const [mode, setMode] = useState<BlockMode>('day_full');
  const [date, setDate] = useState(toISO(new Date()));
  const [endDate, setEndDate] = useState(toISO(new Date()));
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAllBarbers().then((b) => {
      setBarbers(b);
      if (b.length > 0) setBarber(b[0].id);
    });
  }, []);

  const [vacations, setVacations] = useState<BarberVacation[]>([]);

  const fetchVacations = useCallback(async () => {
    if (!barber) return;
    const { data } = await supabase.from('barber_vacations').select('*').eq('barber', barber).order('start_date', { ascending: false });
    setVacations((data as BarberVacation[]) ?? []);
  }, [barber]);

  useEffect(() => {
    fetchVacations();
  }, [fetchVacations]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barber) return;
    setSaving(true);
    try {
      if (mode === 'day_full') {
        await supabase.from('barber_blocks').insert({
          barber, block_type: 'day_off', block_date: date, note: reason.trim() || null,
        });
      } else if (mode === 'time_range') {
        if (!startTime || !endTime) { setSaving(false); return; }
        await supabase.from('barber_blocks').insert({
          barber, block_type: 'time_range', block_date: date,
          block_start_time: startTime, block_end_time: endTime, note: reason.trim() || null,
        });
      } else if (mode === 'vacation') {
        await supabase.from('barber_vacations').insert({
          barber, start_date: date, end_date: endDate, reason: reason.trim() || null,
        });
      }
      setReason('');
      setStartTime('');
      setEndTime('');
      onRefresh();
      fetchVacations();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    await supabase.from('barber_blocks').delete().eq('id', id);
    onRefresh();
  };

  const handleDeleteVacation = async (id: string) => {
    await supabase.from('barber_vacations').delete().eq('id', id);
    fetchVacations();
  };

  const modeButtons: { id: BlockMode; label: string; icon: typeof CalendarOff }[] = [
    { id: 'day_full', label: 'Día completo', icon: CalendarOff },
    { id: 'time_range', label: 'Rango horario', icon: Clock },
    { id: 'vacation', label: 'Vacaciones', icon: Plane },
  ];

  const barberBlocks = blocks.filter((b) => b.barber === barber && (b.block_type === 'day_off' || b.block_type === 'time_range'));

  return (
    <div className="space-y-5">
      <form onSubmit={handleAdd} className="rounded-2xl border border-marble/8 bg-marble/[0.03] p-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-wood-light">Bloquear disponibilidad</p>

        <div>
          <label className="mb-1.5 block text-xs text-marble/50">Barbero</label>
          <div className="flex gap-2">
            {barbers.map((b) => (
              <button key={b.id} type="button" onClick={() => setBarber(b.id)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${
                  barber === b.id ? 'bg-wood text-marble' : 'bg-marble/5 text-marble/60 hover:bg-marble/10'
                }`}>
                {b.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-marble/50">Tipo de bloqueo</label>
          <div className="grid grid-cols-3 gap-2">
            {modeButtons.map((m) => {
              const Icon = m.icon;
              return (
                <button key={m.id} type="button" onClick={() => setMode(m.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl py-3 text-[0.65rem] font-medium transition-all ${
                    mode === m.id ? 'bg-marble text-ink' : 'bg-marble/5 text-marble/55 hover:bg-marble/10'
                  }`}>
                  <Icon className="h-4 w-4" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {mode !== 'vacation' && (
          <div>
            <label className="mb-1.5 block text-xs text-marble/50">Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-marble/10 bg-marble/[0.04] px-4 py-3 text-sm text-marble focus:border-wood/50 focus:outline-none [color-scheme:dark]" />
          </div>
        )}

        {mode === 'vacation' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1.5 block text-xs text-marble/50">Desde</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-marble/10 bg-marble/[0.04] px-4 py-3 text-sm text-marble focus:border-wood/50 focus:outline-none [color-scheme:dark]" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-marble/50">Hasta</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-marble/10 bg-marble/[0.04] px-4 py-3 text-sm text-marble focus:border-wood/50 focus:outline-none [color-scheme:dark]" />
            </div>
          </div>
        )}

        {mode === 'time_range' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1.5 block text-xs text-marble/50">Hora inicio</label>
              <select value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-marble/10 bg-marble/[0.04] px-4 py-3 text-sm text-marble focus:border-wood/50 focus:outline-none">
                <option value="" className="bg-ink-soft">Inicio</option>
                {ALL_TIME_SLOTS.map((s) => <option key={s} value={s} className="bg-ink-soft">{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-marble/50">Hora fin</label>
              <select value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-marble/10 bg-marble/[0.04] px-4 py-3 text-sm text-marble focus:border-wood/50 focus:outline-none">
                <option value="" className="bg-ink-soft">Fin</option>
                {ALL_TIME_SLOTS.map((s) => <option key={s} value={s} className="bg-ink-soft">{s}</option>)}
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs text-marble/50">Nota (opcional)</label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. Vacaciones, descanso, etc."
            className="w-full rounded-xl border border-marble/10 bg-marble/[0.04] px-4 py-3 text-sm text-marble placeholder:text-marble/30 focus:border-wood/50 focus:outline-none" />
        </div>

        <button type="submit" disabled={saving || (mode === 'time_range' && (!startTime || !endTime))}
          className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold uppercase tracking-wider transition-all ${
            !(mode === 'time_range' && (!startTime || !endTime)) ? 'bg-marble text-ink hover:bg-white active:scale-[0.98]' : 'bg-marble/10 text-marble/30'
          }`}>
          {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" /> : <CalendarOff className="h-4 w-4" />}
          Bloquear
        </button>
      </form>

      {/* Blocks list */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-wood-light">Bloqueos activos</p>
        {barberBlocks.length === 0 && vacations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-marble/10 px-5 py-8 text-center">
            <CalendarOff className="mx-auto h-7 w-7 text-marble/25" />
            <p className="mt-2 text-sm text-marble/50">No hay bloqueos de disponibilidad.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {vacations.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-xl border border-marble/8 bg-marble/[0.03] p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-marble/[0.05] text-wood-light">
                  <Plane className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-marble">Vacaciones</p>
                  <p className="text-xs text-marble/45">{v.start_date} → {v.end_date}{v.reason ? ` — ${v.reason}` : ''}</p>
                </div>
                <button onClick={() => handleDeleteVacation(v.id)} aria-label="Eliminar"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {barberBlocks.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-xl border border-marble/8 bg-marble/[0.03] p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-marble/[0.05] text-wood-light">
                  {b.block_type === 'time_range' ? <Clock className="h-4 w-4" /> : <CalendarOff className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-marble">
                    {b.block_type === 'time_range' ? 'Rango horario' : 'Día completo'}
                  </p>
                  <p className="text-xs text-marble/45">
                    {b.block_date}
                    {b.block_type === 'time_range' ? ` · ${b.block_start_time}–${b.block_end_time}` : ''}
                    {b.note ? ` — ${b.note}` : ''}
                  </p>
                </div>
                <button onClick={() => handleDeleteBlock(b.id)} aria-label="Eliminar"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
