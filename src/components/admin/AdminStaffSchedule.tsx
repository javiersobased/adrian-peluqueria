import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { Barber, BarberSchedule } from '@/types';
import { WEEKDAY_NAMES } from '@/lib/schedule';
import { Clock, Save, Check } from 'lucide-react';

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
    const { data } = await supabase.from('barber_schedules').select('*').eq('barber', barber);
    setSchedules((data as BarberSchedule[]) ?? []);
    setLoading(false);
  }, [barber]);

  useEffect(() => {
    fetchAllBarbers().then((b) => {
      setBarbers(b);
      if (b.length > 0) setBarber(b[0].id);
    });
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const getSchedule = (weekday: number): BarberSchedule => {
    return schedules.find((s) => s.weekday === weekday) ?? {
      id: '', barber, weekday, is_working: false,
      morning_start: null, morning_end: null, afternoon_start: null, afternoon_end: null,
    };
  };

  const updateField = (weekday: number, field: keyof BarberSchedule, value: string | boolean | null) => {
    setSchedules((prev) => {
      const existing = prev.find((s) => s.weekday === weekday);
      if (existing) {
        return prev.map((s) => s.weekday === weekday ? { ...s, [field]: value } : s);
      }
      return [...prev, {
        id: '', barber, weekday, is_working: field === 'is_working' ? (value as boolean) : false,
        morning_start: null, morning_end: null, afternoon_start: null, afternoon_end: null,
        [field]: value,
      } as BarberSchedule];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      for (const s of schedules) {
        if (s.id) {
          await supabase.from('barber_schedules').update({
            is_working: s.is_working, morning_start: s.morning_start, morning_end: s.morning_end,
            afternoon_start: s.afternoon_start, afternoon_end: s.afternoon_end,
          }).eq('id', s.id);
        } else {
          await supabase.from('barber_schedules').insert({
            barber, weekday: s.weekday, is_working: s.is_working,
            morning_start: s.morning_start, morning_end: s.morning_end,
            afternoon_start: s.afternoon_start, afternoon_end: s.afternoon_end,
          });
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><span className="h-6 w-6 animate-spin rounded-full border-2 border-marble/20 border-t-wood" /></div>;
  }

  return (
    <div className="space-y-4">
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

      <div className="space-y-2">
        {WEEKDAY_NAMES.map((dayName, weekday) => {
          const s = getSchedule(weekday);
          return (
            <div key={weekday} className="rounded-xl border border-marble/8 bg-marble/[0.03] p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-marble">{dayName}</p>
                <button
                  onClick={() => updateField(weekday, 'is_working', !s.is_working)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    s.is_working ? 'bg-wood text-marble' : 'bg-marble/10 text-marble/50'
                  }`}>
                  {s.is_working ? 'Trabaja' : 'Libre'}
                </button>
              </div>

              {s.is_working && (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-[0.6rem] uppercase text-marble/40">Mañana inicio</p>
                      <input type="time" value={s.morning_start ?? ''} onChange={(e) => updateField(weekday, 'morning_start', e.target.value || null)}
                        className="w-full rounded-lg border border-marble/10 bg-marble/[0.04] px-2 py-1.5 text-xs text-marble focus:border-wood/50 focus:outline-none [color-scheme:dark]" />
                    </div>
                    <div>
                      <p className="mb-1 text-[0.6rem] uppercase text-marble/40">Mañana fin</p>
                      <input type="time" value={s.morning_end ?? ''} onChange={(e) => updateField(weekday, 'morning_end', e.target.value || null)}
                        className="w-full rounded-lg border border-marble/10 bg-marble/[0.04] px-2 py-1.5 text-xs text-marble focus:border-wood/50 focus:outline-none [color-scheme:dark]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-[0.6rem] uppercase text-marble/40">Tarde inicio</p>
                      <input type="time" value={s.afternoon_start ?? ''} onChange={(e) => updateField(weekday, 'afternoon_start', e.target.value || null)}
                        className="w-full rounded-lg border border-marble/10 bg-marble/[0.04] px-2 py-1.5 text-xs text-marble focus:border-wood/50 focus:outline-none [color-scheme:dark]" />
                    </div>
                    <div>
                      <p className="mb-1 text-[0.6rem] uppercase text-marble/40">Tarde fin</p>
                      <input type="time" value={s.afternoon_end ?? ''} onChange={(e) => updateField(weekday, 'afternoon_end', e.target.value || null)}
                        className="w-full rounded-lg border border-marble/10 bg-marble/[0.04] px-2 py-1.5 text-xs text-marble focus:border-wood/50 focus:outline-none [color-scheme:dark]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-marble py-3.5 text-sm font-semibold uppercase tracking-wider text-ink transition-all hover:bg-white active:scale-[0.98]"
      >
        {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
        : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {saved ? 'Guardado' : 'Guardar horario'}
      </button>
    </div>
  );
}
