import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { Barber, BarberSchedule } from '@/types';
import { WEEKDAY_NAMES } from '@/lib/schedule';
import { Save, Check, Sparkles, Clock } from 'lucide-react';
import { notify } from '@/lib/notify';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Orden de visualización habitual en España: Lunes a Sábado, y Domingo al final
const DISPLAY_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

export function AdminStaffSchedule() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barber, setBarber] = useState('');
  const [schedules, setSchedules] = useState<BarberSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadSchedules = useCallback(async () => {
    if (!barber) return;
    setLoading(true);
    const { data } = await supabase
      .from('barber_schedules')
      .select('*')
      .or(`barber.eq.${barber},barber_id.eq.${barber}`);
    setSchedules((data as BarberSchedule[]) ?? []);
    setLoading(false);
  }, [barber]);

  useEffect(() => {
    fetchAllBarbers().then((b) => { setBarbers(b); if (b.length > 0) setBarber(b[0].id); });
  }, []);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  const getSchedule = (weekday: number): BarberSchedule => {
    return (
      schedules.find(
        (s) => s.weekday === weekday || Number(s.day_of_week) === weekday || Number(s.weekday) === weekday
      ) ?? {
        id: '',
        barber,
        weekday,
        is_working: false,
        morning_start: null,
        morning_end: null,
        afternoon_start: null,
        afternoon_end: null,
      }
    );
  };

  const updateField = (weekday: number, field: keyof BarberSchedule, value: string | boolean | null) => {
    setSchedules((prev) => {
      const existing = prev.find(
        (s) => s.weekday === weekday || Number(s.day_of_week) === weekday || Number(s.weekday) === weekday
      );
      if (existing) {
        return prev.map((s) =>
          s.weekday === weekday || Number(s.day_of_week) === weekday || Number(s.weekday) === weekday
            ? { ...s, [field]: value }
            : s
        );
      }
      return [
        ...prev,
        {
          id: '',
          barber,
          weekday,
          is_working: field === 'is_working' ? (value as boolean) : false,
          morning_start: null,
          morning_end: null,
          afternoon_start: null,
          afternoon_end: null,
          [field]: value,
        } as BarberSchedule,
      ];
    });
  };

  // Aplica el horario predeterminado: Lunes a Sábado (09:30-13:30 y 16:30-20:30), Domingo libre
  const handleSetDefaultSchedule = () => {
    if (!barber) return;
    setSchedules((prev) => {
      const allDays = [0, 1, 2, 3, 4, 5, 6];
      return allDays.map((weekday) => {
        const existing = prev.find(
          (s) => s.weekday === weekday || Number(s.day_of_week) === weekday || Number(s.weekday) === weekday
        );
        const isWorking = weekday !== 0; // Lunes a Sábado trabaja (1 a 6), Domingo no (0)
        return {
          id: existing?.id || '',
          barber,
          weekday,
          is_working: isWorking,
          morning_start: isWorking ? '09:30' : null,
          morning_end: isWorking ? '13:30' : null,
          afternoon_start: isWorking ? '16:30' : null,
          afternoon_end: isWorking ? '20:30' : null,
        };
      });
    });

    const activeBarberName = barbers.find((b) => b.id === barber)?.name ?? 'el perfil';
    notify.success(
      'Horario predeterminado aplicado',
      `L-S 09:30–13:30 y 16:30–20:30 cargado para ${activeBarberName}. Recuerda pulsar en "Guardar horario".`
    );
  };

  const handleSave = async () => {
    if (!barber) return;
    setSaving(true);
    setSaved(false);
    try {
      // 1. Obtener los registros actuales del barbero para verificar IDs existentes
      const { data: existing, error: fetchErr } = await supabase
        .from('barber_schedules')
        .select('*')
        .or(`barber.eq.${barber},barber_id.eq.${barber}`);

      if (fetchErr) throw fetchErr;

      const allDays = [0, 1, 2, 3, 4, 5, 6];
      const savePromises = allDays.map(async (weekday) => {
        const s = schedules.find(
          (item) => item.weekday === weekday || Number(item.day_of_week) === weekday || Number(item.weekday) === weekday
        );
        const match = existing?.find(
          (e) => e.weekday === weekday || Number(e.day_of_week) === weekday || Number(e.weekday) === weekday
        );
        const isWorking = s?.is_working ?? false;
        const rowData = {
          barber,
          barber_id: barber,
          weekday,
          day_of_week: String(weekday),
          is_working: isWorking,
          morning_start: isWorking ? (s?.morning_start ?? '09:30') : null,
          morning_end: isWorking ? (s?.morning_end ?? '13:30') : null,
          afternoon_start: isWorking ? (s?.afternoon_start ?? '16:30') : null,
          afternoon_end: isWorking ? (s?.afternoon_end ?? '20:30') : null,
        };

        if (match?.id) {
          const { error } = await supabase.from('barber_schedules').update(rowData).eq('id', match.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('barber_schedules').insert([rowData]);
          if (error) throw error;
        }
      });

      await Promise.all(savePromises);

      await loadSchedules();
      setSaved(true);
      notify.success('Horario guardado', 'La configuración semanal ha sido actualizada');
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error('Error al guardar horario:', err);
      notify.error('Error al guardar', err?.message || 'No se pudo actualizar el horario');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" label="Cargando horarios…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <label className="mb-1.5 block text-xs text-zinc-500">Barbero</label>
        <div className="flex gap-2">
          {barbers.map((b) => (
            <button key={b.id} type="button" onClick={() => setBarber(b.id)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${
                barber === b.id ? 'gold-gradient text-black' : 'glass-card text-zinc-400 hover:text-white'
              }`}>{b.name}</button>
          ))}
        </div>
      </div>

      {/* Botón de horario predeterminado */}
      <div className="flex flex-col gap-3 rounded-2xl glass-card p-4 border border-white/5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gold" />
            <p className="text-sm font-bold text-white">Horario habitual de peluquería</p>
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">
            Lunes a Sábado: 09:30–13:30 y 16:30–20:30 · Domingo: Cerrado
          </p>
        </div>
        <button
          type="button"
          onClick={handleSetDefaultSchedule}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-xs font-bold text-gold transition-all hover:bg-gold hover:text-black hover:shadow-lg hover:shadow-gold/20 active:scale-95"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Establecer horario predeterminado</span>
        </button>
      </div>

      <div className="space-y-2.5">
        {DISPLAY_WEEKDAYS.map((weekday) => {
          const dayName = WEEKDAY_NAMES[weekday];
          const s = getSchedule(weekday);
          return (
            <div key={weekday} className="rounded-2xl glass-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">{dayName}</p>
                <button
                  type="button"
                  onClick={() => updateField(weekday, 'is_working', !s.is_working)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    s.is_working ? 'gold-gradient text-black' : 'glass-card text-zinc-500'
                  }`}>
                  {s.is_working ? 'Trabaja' : 'Libre'}
                </button>
              </div>

              {s.is_working && (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <TimeInput label="Mañana inicio" value={s.morning_start} onChange={(v) => updateField(weekday, 'morning_start', v)} />
                    <TimeInput label="Mañana fin" value={s.morning_end} onChange={(v) => updateField(weekday, 'morning_end', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <TimeInput label="Tarde inicio" value={s.afternoon_start} onChange={(v) => updateField(weekday, 'afternoon_start', v)} />
                    <TimeInput label="Tarde fin" value={s.afternoon_end} onChange={(v) => updateField(weekday, 'afternoon_end', v)} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-full gold-gradient py-3.5 text-sm font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98] gold-glow">
        {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
        : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {saved ? 'Guardado' : 'Guardar horario'}
      </button>
    </div>
  );
}

function TimeInput({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div>
      <p className="mb-1 text-[0.6rem] uppercase text-zinc-500">{label}</p>
      <input type="time" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-lg glass-card px-2 py-1.5 text-xs text-white focus:border-gold/30 focus:outline-none [color-scheme:dark]" />
    </div>
  );
}

