import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllServices } from '@/data/services';
import type { Service } from '@/types';
import { Scissors, Feather, CircleUserRound, Droplets, Paintbrush, UserRound, Plus, Trash2, Pencil, Check, X, type LucideIcon } from 'lucide-react';

const ICON_OPTIONS: { id: string; icon: LucideIcon; label: string }[] = [
  { id: 'scissors', icon: Scissors, label: 'Tijeras' },
  { id: 'beard', icon: Feather, label: 'Barba' },
  { id: 'scissors-crossed', icon: Scissors, label: 'Tijeras X' },
  { id: 'contours', icon: CircleUserRound, label: 'Contornos' },
  { id: 'wash', icon: Droplets, label: 'Lavado' },
  { id: 'color', icon: Paintbrush, label: 'Color' },
  { id: 'neck', icon: UserRound, label: 'Cuello' },
];

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(ICON_OPTIONS.map((o) => [o.id, o.icon]));

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Scissors;
}

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
    await supabase.from('services').delete().eq('id', id);
    load();
  };

  const handleToggleActive = async (s: Service) => {
    await supabase.from('services').update({ active: !s.active }).eq('id', s.id);
    load();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><span className="h-6 w-6 animate-spin rounded-full border-2 border-marble/20 border-t-wood" /></div>;
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => { setCreating(true); setEditing(null); }}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-marble py-3.5 text-sm font-semibold uppercase tracking-wider text-ink transition-all hover:bg-white active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        Nuevo servicio
      </button>

      {(creating || editing) && (
        <ServiceForm
          service={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}

      <div className="space-y-2">
        {services.map((s) => {
          const Icon = getIcon(s.icon);
          return (
            <div key={s.id} className={`flex items-center gap-3 rounded-xl border border-marble/8 bg-marble/[0.03] p-3 ${!s.active ? 'opacity-50' : ''}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-marble/[0.05] text-wood-light">
                <Icon className="h-5 w-5" strokeWidth={1.6} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-marble">{s.name}</p>
                <p className="text-xs text-marble/45">{s.duration}{s.price > 0 ? ` · ${s.price}€` : ''}</p>
              </div>
              <button onClick={() => handleToggleActive(s)} className="text-xs text-marble/40 hover:text-marble/70">
                {s.active ? 'Activo' : 'Inactivo'}
              </button>
              <button onClick={() => { setEditing(s); setCreating(false); }} aria-label="Editar"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-marble/5 text-marble/60 hover:bg-marble/10">
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
  const [duration, setDuration] = useState(service?.duration ?? '45min');
  const [icon, setIcon] = useState(service?.icon ?? 'scissors');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), price: Number(price) || 0, duration: duration.trim() || '45min', icon };
      if (service) {
        await supabase.from('services').update(payload).eq('id', service.id);
      } else {
        await supabase.from('services').insert({ ...payload, active: true, sort_order: 99 });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-wood/20 bg-wood/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-wood-light">{service ? 'Editar servicio' : 'Nuevo servicio'}</p>
        <button type="button" onClick={onClose} className="text-marble/40 hover:text-marble/70"><X className="h-4 w-4" /></button>
      </div>

      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del servicio"
        className="w-full rounded-xl border border-marble/10 bg-marble/[0.04] px-4 py-3 text-sm text-marble placeholder:text-marble/30 focus:border-wood/50 focus:outline-none" />

      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duración (ej. 45min)"
          className="rounded-xl border border-marble/10 bg-marble/[0.04] px-4 py-3 text-sm text-marble placeholder:text-marble/30 focus:border-wood/50 focus:outline-none" />
        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Precio (€)" min="0"
          className="rounded-xl border border-marble/10 bg-marble/[0.04] px-4 py-3 text-sm text-marble placeholder:text-marble/30 focus:border-wood/50 focus:outline-none" />
      </div>

      <div>
        <p className="mb-2 text-xs text-marble/50">Icono</p>
        <div className="grid grid-cols-4 gap-2">
          {ICON_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button key={opt.id} type="button" onClick={() => setIcon(opt.id)}
                className={`flex flex-col items-center gap-1 rounded-xl py-3 text-[0.6rem] font-medium transition-all ${
                  icon === opt.id ? 'bg-wood text-marble' : 'bg-marble/5 text-marble/55 hover:bg-marble/10'
                }`}>
                <Icon className="h-5 w-5" strokeWidth={1.6} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <button type="submit" disabled={saving || !name.trim()}
        className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold uppercase tracking-wider transition-all ${
          name.trim() && !saving ? 'bg-marble text-ink hover:bg-white active:scale-[0.98]' : 'bg-marble/10 text-marble/30'
        }`}>
        {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" /> : <Check className="h-4 w-4" />}
        Guardar
      </button>
    </form>
  );
}
