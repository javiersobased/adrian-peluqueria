import { useState, useEffect, useCallback } from 'react';
import { supabase, supabaseUrl } from '@/lib/supabase';
import { fetchAllServices } from '@/data/services';
import type { Service } from '@/types';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { notify } from '@/lib/notify';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const ICON_BASE = `${supabaseUrl}/storage/v1/object/public/service-icons`;

const ICON_OPTIONS: { id: string; src: string; label: string }[] = [
  { id: 'scissors', src: `${ICON_BASE}/corte.png`, label: 'Corte' },
  { id: 'scissors-crossed', src: `${ICON_BASE}/corte-barba.png`, label: 'Corte+Barba' },
  { id: 'beard', src: `${ICON_BASE}/barba.png`, label: 'Barba' },
  { id: 'color', src: `${ICON_BASE}/tinte.png`, label: 'Tinte' },
  { id: 'contours', src: `${ICON_BASE}/peinado-estilo.png`, label: 'Peinado' },
  { id: 'kids-cut', src: `${ICON_BASE}/corte-ninos.png`, label: 'Niños' },
  { id: 'nose-wax', src: `${ICON_BASE}/depilado-nasal.png`, label: 'Nasal' },
  { id: 'eyebrow-razor', src: `${ICON_BASE}/cejas-cuchilla.png`, label: 'Cejas' },
  { id: 'clipper', src: `${ICON_BASE}/maquina-pelar.png`, label: 'Máquina' },
  { id: 'wash', src: `${ICON_BASE}/polvos-volumen.png`, label: 'Polvos' },
  { id: 'fade', src: `${ICON_BASE}/degradado-pelo.png`, label: 'Degradado' },
];

const ICON_MAP: Record<string, string> = Object.fromEntries(ICON_OPTIONS.map((o) => [o.id, o.src]));
function getIconSrc(name: string): string { return ICON_MAP[name] ?? ICON_MAP.scissors; }

export function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAllServices();
    setServices(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este servicio?')) return;
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) {
      notify.error('Error al eliminar', error.message);
      return;
    }
    notify.success('Servicio eliminado', 'El servicio fue eliminado correctamente');
    load();
  };

  const handleToggleActive = async (s: Service) => {
    const nextState = !s.active;
    const { error } = await supabase.from('services').update({ active: nextState }).eq('id', s.id);
    if (error) {
      notify.error('Error al actualizar', error.message);
      return;
    }
    notify.info('Estado actualizado', `${s.name} marcado como ${nextState ? 'activo' : 'inactivo'}`);
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" label="Cargando servicios…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl w-full min-w-0 space-y-4">
      <button
        onClick={() => { setCreating(true); setEditing(null); }}
        className="flex w-full items-center justify-center gap-2 rounded-full gold-gradient py-3 text-sm font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98] gold-glow"
      >
        <Plus className="h-4 w-4" />Nuevo servicio
      </button>

      {(creating || editing) && (
        <ServiceForm service={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {services.map((s) => {
          const iconSrc = getIconSrc(s.icon);
          return (
            <div key={s.id} className={`flex items-center gap-3 rounded-2xl glass-card p-3.5 transition-colors hover:border-gold/15 ${!s.active ? 'opacity-50' : ''}`}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/5 overflow-hidden">
                <img src={iconSrc} alt="" className="h-7 w-7 rounded-lg object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{s.name}</p>
                <p className="text-xs text-zinc-500">
                  {s.duration_minutes ? `${s.duration_minutes} min` : s.duration}
                  {s.price > 0 ? ` · ${s.price}€` : ''}
                </p>
              </div>
              <button onClick={() => handleToggleActive(s)} className="text-xs font-medium text-zinc-500 hover:text-gold">
                {s.active ? 'Activo' : 'Inactivo'}
              </button>
              <button onClick={() => { setEditing(s); setCreating(false); }} aria-label="Editar"
                className="flex h-8 w-8 items-center justify-center rounded-full glass-card text-zinc-400 hover:text-white">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => handleDelete(s.id)} aria-label="Eliminar"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ServiceForm({ service, onClose, onSaved }: { service: Service | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(service?.name ?? '');
  const [price, setPrice] = useState(String(service?.price ?? 0));
  const [duration, setDuration] = useState(service?.duration ?? '30min');
  const [durationMinutes, setDurationMinutes] = useState(
    String(service?.duration_minutes ?? (service?.duration ? parseInt(service.duration.match(/\d+/)?.[0] || '30', 10) : 30))
  );
  const [icon, setIcon] = useState(service?.icon ?? 'scissors');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      const durMins = Number(durationMinutes) || parseInt(duration.match(/\d+/)?.[0] || '30', 10) || 30;
      let payload: any = {
        name: name.trim(),
        price: Number(price) || 0,
        duration: duration.trim() || `${durMins}min`,
        duration_minutes: durMins,
        icon,
      };

      if (service) {
        let { error } = await supabase.from('services').update(payload).eq('id', service.id);
        if (error && error.message?.includes('duration_minutes')) {
          delete payload.duration_minutes;
          const retry = await supabase.from('services').update(payload).eq('id', service.id);
          error = retry.error;
        }
        if (error) throw error;
        notify.success('Servicio actualizado', payload.name);
      } else {
        let { error } = await supabase.from('services').insert({ ...payload, active: true, sort_order: 99 });
        if (error && error.message?.includes('duration_minutes')) {
          delete payload.duration_minutes;
          const retry = await supabase.from('services').insert({ ...payload, active: true, sort_order: 99 });
          error = retry.error;
        }
        if (error) throw error;
        notify.success('Servicio creado', payload.name);
      }
      onSaved();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el servicio';
      setFormError(msg);
      notify.error('Error al guardar', msg);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">{service ? 'Editar servicio' : 'Nuevo servicio'}</p>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
      </div>

      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del servicio"
        className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none" />

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="mb-1 block text-[10px] text-zinc-500">Minutos reales</label>
          <input
            type="number"
            value={durationMinutes}
            onChange={(e) => {
              setDurationMinutes(e.target.value);
              if (e.target.value) setDuration(`${e.target.value}min`);
            }}
            placeholder="30"
            min="5"
            step="5"
            className="w-full rounded-xl glass-card px-3 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-zinc-500">Texto visible</label>
          <input
            type="text"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="30min"
            className="w-full rounded-xl glass-card px-3 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-zinc-500">Precio (€)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            min="0"
            className="w-full rounded-xl glass-card px-3 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none"
          />
        </div>
        <div className="col-span-3 flex flex-wrap gap-1.5 pt-0.5">
          {[10, 20, 30, 40, 50, 60].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setDurationMinutes(String(m));
                setDuration(`${m}min`);
              }}
              className={`rounded-lg px-2.5 py-1 text-[0.7rem] font-semibold transition-all ${
                durationMinutes === String(m)
                  ? 'gold-gradient text-black'
                  : 'glass-card text-zinc-400 hover:text-white'
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-zinc-500">Icono</p>
        <div className="grid grid-cols-4 gap-2">
          {ICON_OPTIONS.map((opt) => {
            return (
              <button key={opt.id} type="button" onClick={() => setIcon(opt.id)}
                className={`flex flex-col items-center gap-1 rounded-xl py-3 text-[0.6rem] font-medium transition-all ${
                  icon === opt.id ? 'gold-gradient text-black' : 'glass-card text-zinc-400 hover:text-white'
                }`}>
                <img src={opt.src} alt="" className="h-6 w-6 rounded-lg object-cover" />{opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {formError && (
        <p className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
          {formError}
        </p>
      )}

      <button type="submit" disabled={saving || !name.trim()}
        className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
          name.trim() && !saving ? 'gold-gradient text-black hover:brightness-110 active:scale-[0.98]' : 'bg-white/5 text-zinc-600'
        }`}>
        {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <Check className="h-4 w-4" />}
        Guardar
      </button>
    </form>
  );
}
