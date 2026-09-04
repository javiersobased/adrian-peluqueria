import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { Barber, BarberSchedule } from '@/types';
import { WEEKDAY_NAMES } from '@/lib/schedule';
import { Save, Check } from 'lucide-react';

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
    fetchAllBarbers().then((b) => { setBarbers(b); if (b.length > 0) setBarber(b[0].id); });
  }, []);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  const getSchedule = (weekday: number): BarberSchedule => {
    return schedules.find((s) => s.weekday === weekday) ?? {
      id: '', barber, weekday, is_working: false,
      morning_start: null, morning_end: null, afternoon_start: null, afternoon_end: null,
    };
  };

  const updateField = (weekday: number, field: keyof BarberSchedule, value: string | boolean | null) => {
    setSchedules((prev) => {
      const existing = prev.find((s) => s.weekday === weekday);
      if (existing) return prev.map((s) => s.weekday === weekday ? { ...s, [field]: value } : s);
      return [...prev, {
        id: '', barber, weekday, is_working: field === 'is_working' ? (value as boolean) : false,
        morning_start: null, morning_end: null, afternoon_start: null, afternoon_end: null, [field]: value,
      } as BarberSchedule];
    });
  };

  const handleSave = async () => {
    setSaving(true); setSaved(false);
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
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-gold" /></div>;
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

      <div className="space-y-2.5">
        {WEEKDAY_NAMES.map((dayName, weekday) => {
          const s = getSchedule(weekday);
          return (
            <div key={weekday} className="rounded-2xl glass-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">{dayName}</p>
                <button
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

      <button onClick={handleSave} disabled={saving}
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
