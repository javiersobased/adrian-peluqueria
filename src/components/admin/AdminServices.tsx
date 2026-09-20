import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllServices } from '@/data/services';
import type { Service } from '@/types';
import { Plus, Trash2, Pencil, Check, X, Sparkles } from 'lucide-react';
import { notify } from '@/lib/notify';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  BarberServiceIcon,
  BARBER_SERVICE_ICON_CATALOG,
  type ServiceIconOption,
} from '@/components/icons/BarberServiceIcons';

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

  useEffect(() => {
    load();
  }, [load]);

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
        onClick={() => {
          setCreating(true);
          setEditing(null);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-full gold-gradient py-3 text-sm font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98] gold-glow"
      >
        <Plus className="h-4 w-4" />
        Nuevo servicio
      </button>

      {(creating || editing) && (
        <ServiceForm
          service={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {services.map((s) => {
          return (
            <div
              key={s.id}
              className={`flex items-center gap-3.5 rounded-2xl glass-card p-3.5 transition-all duration-200 hover:border-gold/30 hover:shadow-lg hover:shadow-gold/5 ${
                !s.active ? 'opacity-50' : ''
              }`}
            >
              {/* Luxury Vector Icon Badge */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/20 via-gold/5 to-black/40 border border-gold/25 text-gold shadow-md shadow-gold/5">
                <BarberServiceIcon name={s.icon} className="h-6 w-6 text-gold" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white tracking-tight truncate">{s.name}</p>
                <p className="text-xs text-zinc-400 font-medium">
                  {s.duration_minutes ? `${s.duration_minutes} min` : s.duration}
                  {s.price > 0 ? ` · ${s.price}€` : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleToggleActive(s)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                  s.active
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                    : 'bg-zinc-800/60 text-zinc-400 border-white/5 hover:text-zinc-200'
                }`}
              >
                {s.active ? 'Activo' : 'Inactivo'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditing(s);
                  setCreating(false);
                }}
                aria-label="Editar"
                className="flex h-8 w-8 items-center justify-center rounded-xl glass-card text-zinc-400 hover:text-gold hover:border-gold/30 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleDelete(s.id)}
                aria-label="Eliminar"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ServiceForm({
  service,
  onClose,
  onSaved,
}: {
  service: Service | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(service?.name ?? '');
  const [price, setPrice] = useState(String(service?.price ?? 0));
  const [duration, setDuration] = useState(service?.duration ?? '30min');
  const [durationMinutes, setDurationMinutes] = useState(
    String(service?.duration_minutes ?? (service?.duration ? parseInt(service.duration.match(/\d+/)?.[0] || '30', 10) : 30))
  );
  const [icon, setIcon] = useState(service?.icon ?? 'scissors');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'corte' | 'barba' | 'tratamiento'>('all');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedIconMeta: ServiceIconOption = useMemo(() => {
    return (
      BARBER_SERVICE_ICON_CATALOG.find((o) => o.id === icon) ??
      BARBER_SERVICE_ICON_CATALOG[0]
    );
  }, [icon]);

  const filteredIcons = useMemo(() => {
    if (categoryFilter === 'all') return BARBER_SERVICE_ICON_CATALOG;
    return BARBER_SERVICE_ICON_CATALOG.filter((o) => o.category === categoryFilter);
  }, [categoryFilter]);

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
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl glass-card p-5 space-y-5 border border-gold/20 shadow-2xl">
      <div className="flex items-center justify-between pb-1 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg gold-gradient text-black">
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-gold">
            {service ? 'Editar servicio' : 'Nuevo servicio'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-zinc-400">Nombre del servicio</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Corte Degradado + Barba"
          className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label className="mb-1 block text-[10px] uppercase font-bold tracking-wider text-zinc-400">
            Minutos reales (Agenda)
          </label>
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
            className="w-full rounded-xl glass-card px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase font-bold tracking-wider text-zinc-400">
            Texto visible
          </label>
          <input
            type="text"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="30min"
            className="w-full rounded-xl glass-card px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase font-bold tracking-wider text-zinc-400">
            Precio (€)
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            min="0"
            className="w-full rounded-xl glass-card px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none transition-colors"
          />
        </div>
        <div className="col-span-1 sm:col-span-3 flex flex-wrap gap-1.5 pt-0.5">
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
                  ? 'gold-gradient text-black font-bold shadow-sm'
                  : 'glass-card text-zinc-400 hover:text-white'
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================================
          REVAMPED SERVICE ICON GALLERY & SELECTOR
          ========================================================================= */}
      <div className="space-y-3 pt-2 border-t border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-white tracking-tight">Galería de Iconos del Servicio</p>
            <p className="text-[0.7rem] text-zinc-400">Iconografía vectorial exclusiva adaptada a barbería clásica y moderna</p>
          </div>
          <span className="text-[0.65rem] font-bold text-gold uppercase tracking-wider bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">
            12 Diseños
          </span>
        </div>

        {/* Selected Icon Spotlight Banner */}
        <div className="flex items-center gap-3.5 rounded-2xl bg-gradient-to-r from-gold/15 via-gold/5 to-white/[0.02] border border-gold/30 p-3 shadow-md">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl gold-gradient text-black shadow-md shadow-gold/20">
            <BarberServiceIcon name={selectedIconMeta.id} className="h-6 w-6 text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-white truncate">{selectedIconMeta.label}</p>
              <span className="rounded-full bg-gold/20 text-gold px-2 py-0.2 text-[0.6rem] font-bold uppercase tracking-wider">
                Seleccionado
              </span>
            </div>
            <p className="text-[0.7rem] text-zinc-300 truncate">{selectedIconMeta.description}</p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'corte', label: 'Cortes & Cabello' },
            { id: 'barba', label: 'Barba & Afeitado' },
            { id: 'tratamiento', label: 'Tratamientos & Color' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id as any)}
              className={`rounded-lg px-2.5 py-1 text-[0.7rem] font-semibold transition-all ${
                categoryFilter === cat.id
                  ? 'bg-gold/20 text-gold border border-gold/40 shadow-sm'
                  : 'bg-white/5 text-zinc-400 hover:text-white border border-transparent'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Icon Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
          {filteredIcons.map((opt) => {
            const isSelected = icon === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setIcon(opt.id)}
                className={`group flex items-center gap-2.5 rounded-xl p-2 text-left transition-all duration-150 ${
                  isSelected
                    ? 'bg-gradient-to-r from-gold/25 via-gold/15 to-transparent border border-gold text-white shadow-sm ring-1 ring-gold/40'
                    : 'glass-card border border-white/5 text-zinc-300 hover:border-gold/30 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
                    isSelected
                      ? 'gold-gradient text-black shadow-sm'
                      : 'bg-gold/10 text-gold group-hover:bg-gold/15'
                  }`}
                >
                  <BarberServiceIcon name={opt.id} className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.7rem] font-bold leading-tight truncate">{opt.label}</p>
                  <p className="text-[0.6rem] text-zinc-500 truncate leading-tight mt-0.5">
                    {opt.category === 'corte'
                      ? 'Corte'
                      : opt.category === 'barba'
                      ? 'Barba'
                      : 'Especial'}
                  </p>
                </div>
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

      <button
        type="submit"
        disabled={saving || !name.trim()}
        className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
          name.trim() && !saving
            ? 'gold-gradient text-black hover:brightness-110 active:scale-[0.98]'
            : 'bg-white/5 text-zinc-600'
        }`}
      >
        {saving ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        Guardar
      </button>
    </form>
  );
}
