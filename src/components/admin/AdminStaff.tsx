import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { Barber } from '@/types';
import { Plus, Trash2, Pencil, Check, X, Upload, type LucideIcon } from 'lucide-react';
import { Scissors, Feather, CircleUserRound, Droplets, Paintbrush, UserRound } from 'lucide-react';

export function AdminStaff() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Barber | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAllBarbers();
    setBarbers(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Dar de baja a este barbero? Se desactivará pero no se borrará.')) return;
    await supabase.from('barbers').update({ active: false }).eq('id', id);
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
        Nuevo barbero
      </button>

      {(creating || editing) && (
        <BarberForm
          barber={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}

      <div className="space-y-2">
        {barbers.map((b) => (
          <div key={b.id} className={`flex items-center gap-3 rounded-xl border border-marble/8 bg-marble/[0.03] p-3 ${!b.active ? 'opacity-50' : ''}`}>
            {b.photo_url ? (
              <img src={b.photo_url} alt={b.name} className="h-12 w-12 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-wood to-wood-dark font-display text-base font-semibold text-marble">
                {b.initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-marble">{b.name}</p>
              <p className="text-xs text-marble/45">{b.role}{!b.active ? ' · Inactivo' : ''}</p>
            </div>
            <button onClick={() => { setEditing(b); setCreating(false); }} aria-label="Editar"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-marble/5 text-marble/60 hover:bg-marble/10">
              <Pencil className="h-4 w-4" />
            </button>
            {b.active && (
              <button onClick={() => handleDelete(b.id)} aria-label="Dar de baja"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BarberForm({ barber, onClose, onSaved }: { barber: Barber | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(barber?.name ?? '');
  const [role, setRole] = useState(barber?.role ?? 'Barbero');
  const [id, setId] = useState(barber?.id ?? '');
  const [photoUrl, setPhotoUrl] = useState(barber?.photo_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('barber-photos')
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('barber-photos').getPublicUrl(fileName);
      setPhotoUrl(urlData.publicUrl);
    } catch {
      alert('Error al subir la foto');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const initials = name.trim().split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      if (barber) {
        await supabase.from('barbers').update({
          name: name.trim(), role: role.trim() || 'Barbero', initials, photo_url: photoUrl || null,
        }).eq('id', barber.id);
      } else {
        const newId = id.trim().toLowerCase().replace(/\s+/g, '-') || name.trim().toLowerCase().replace(/\s+/g, '-');
        await supabase.from('barbers').insert({
          id: newId, name: name.trim(), role: role.trim() || 'Barbero', initials,
          photo_url: photoUrl || null, active: true, sort_order: 99,
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-wood/20 bg-wood/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-wood-light">{barber ? 'Editar barbero' : 'Nuevo barbero'}</p>
        <button type="button" onClick={onClose} className="text-marble/40 hover:text-marble/70"><X className="h-4 w-4" /></button>
      </div>

      {/* Photo upload */}
      <div className="flex items-center gap-4">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-marble/10 text-marble/30">
            <UserRound className="h-7 w-7" />
          </div>
        )}
        <label className="cursor-pointer rounded-full bg-marble/10 px-4 py-2 text-xs font-medium text-marble/70 transition-colors hover:bg-marble/15">
          <Upload className="mr-1.5 inline h-3.5 w-3.5" />
          {uploading ? 'Subiendo...' : 'Subir foto'}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {!barber && (
        <input type="text" value={id} onChange={(e) => setId(e.target.value)} placeholder="ID (ej. juan)"
          className="w-full rounded-xl border border-marble/10 bg-marble/[0.04] px-4 py-3 text-sm text-marble placeholder:text-marble/30 focus:border-wood/50 focus:outline-none" />
      )}
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo"
        className="w-full rounded-xl border border-marble/10 bg-marble/[0.04] px-4 py-3 text-sm text-marble placeholder:text-marble/30 focus:border-wood/50 focus:outline-none" />
      <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Rol (ej. Barbero, Propietario)"
        className="w-full rounded-xl border border-marble/10 bg-marble/[0.04] px-4 py-3 text-sm text-marble placeholder:text-marble/30 focus:border-wood/50 focus:outline-none" />

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
