import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers, fetchAllServices } from '@/data/services';
import type { Barber, Service } from '@/types';
import { Check, Calendar, Clock, User, Plus } from 'lucide-react';
import { ALL_TIME_SLOTS, toISO } from '@/lib/schedule';

interface AdminManualBookingProps {
  onCreated: () => void;
}

export function AdminManualBooking({ onCreated }: AdminManualBookingProps) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barber, setBarber] = useState('');
  const [service, setService] = useState('');
  const [date, setDate] = useState(toISO(new Date()));
  const [time, setTime] = useState('');
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllBarbers().then((b) => {
      setBarbers(b);
      if (b.length > 0) setBarber(b[0].id);
    });
    fetchAllServices().then((s) => {
      setServices(s);
      if (s.length > 0) setService(s[0].name);
    });
  }, []);

  const valid = fullName.trim().length >= 2 && barber && service && date && time;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const svc = services.find((s) => s.name === service);
      const { error: insertError } = await supabase.from('bookings').insert({
        barber,
        service,
        service_price: svc?.price ?? 0,
        booking_date: date,
        booking_time: time,
        full_name: fullName.trim(),
        phone: '',
        email: '',
        comments: null,
        status: 'confirmed',
      });
      if (insertError) throw insertError;
      setSuccess(true);
      setFullName('');
      setTime('');
      onCreated();
    } catch {
      setError('No se pudo registrar la cita.');
    } finally {
      setSaving(false);
    }
  }, [valid, barber, service, date, time, fullName, services, onCreated]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-marble/8 bg-marble/[0.03] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-wood-light">Barbero</p>
        <div className="flex gap-2">
          {barbers.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBarber(b.id)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${
                barber === b.id ? 'bg-wood text-marble' : 'bg-marble/5 text-marble/60 hover:bg-marble/10'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-marble/8 bg-marble/[0.03] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-wood-light">Servicio</p>
        <select
          value={service}
          onChange={(e) => setService(e.target.value)}
          className="w-full rounded-xl border border-marble/10 bg-marble/[0.04] px-4 py-3 text-sm text-marble focus:border-wood/50 focus:outline-none"
        >
          {services.map((s) => (
            <option key={s.id} value={s.name} className="bg-ink-soft text-marble">{s.name}</option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-marble/8 bg-marble/[0.03] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-wood-light">Fecha y hora</p>
        <div className="flex items-center gap-2 rounded-xl border border-marble/10 bg-marble/[0.04] px-3 py-2.5">
          <Calendar className="h-4 w-4 text-marble/40" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-transparent text-sm text-marble focus:outline-none [color-scheme:dark]"
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-marble/40" />
          <select
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="flex-1 rounded-xl border border-marble/10 bg-marble/[0.04] px-3 py-2.5 text-sm text-marble focus:border-wood/50 focus:outline-none"
          >
            <option value="" className="bg-ink-soft">Selecciona hora</option>
            {ALL_TIME_SLOTS.map((s) => (
              <option key={s} value={s} className="bg-ink-soft">{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-marble/8 bg-marble/[0.03] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-wood-light">Cliente</p>
        <div className="flex items-center gap-3 rounded-xl border border-marble/10 bg-marble/[0.04] px-4 py-3 focus-within:border-wood/50">
          <User className="h-4 w-4 text-marble/40" />
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nombre del cliente"
            className="w-full bg-transparent text-sm text-marble placeholder:text-marble/30 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          Cita registrada correctamente.
        </div>
      )}

      <button
        type="submit"
        disabled={!valid || saving}
        className={`flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-semibold uppercase tracking-wider transition-all ${
          valid && !saving ? 'bg-marble text-ink hover:bg-white active:scale-[0.98]' : 'bg-marble/10 text-marble/30'
        }`}
      >
        {saving ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
        ) : success ? (
          <Check className="h-4 w-4" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Registrar cita
      </button>
    </form>
  );
}
