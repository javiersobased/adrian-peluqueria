import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { Barber } from '@/types';
import { Plus, Trash2, Pencil, Check, X, Upload, UserRound } from 'lucide-react';

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
    return <div className="flex justify-center py-20"><span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-gold" /></div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button
        onClick={() => { setCreating(true); setEditing(null); }}
        className="flex w-full items-center justify-center gap-2 rounded-full gold-gradient py-3.5 text-sm font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98] gold-glow"
      >
        <Plus className="h-4 w-4" />Nuevo barbero
      </button>

      {(creating || editing) && (
        <BarberForm barber={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} />
      )}

      <div className="space-y-2.5">
        {barbers.map((b) => (
          <div key={b.id} className={`flex items-center gap-3 rounded-2xl glass-card p-3.5 transition-colors hover:border-gold/15 ${!b.active ? 'opacity-50' : ''}`}>
            {b.photo_url ? (
              <img src={b.photo_url} alt={b.name} className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl gold-gradient font-display text-base font-bold text-black">
                {b.initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{b.name}</p>
              <p className="text-xs text-zinc-500">{b.role}{!b.active ? ' · Inactivo' : ''}</p>
            </div>
            <button onClick={() => { setEditing(b); setCreating(false); }} aria-label="Editar"
              className="flex h-8 w-8 items-center justify-center rounded-full glass-card text-zinc-400 hover:text-white">
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
      const { error: uploadError } = await supabase.storage.from('barber-photos').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('barber-photos').getPublicUrl(fileName);
      setPhotoUrl(urlData.publicUrl);
    } catch { alert('Error al subir la foto'); } finally { setUploading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const initials = name.trim().split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      if (barber) {
        await supabase.from('barbers').update({ name: name.trim(), role: role.trim() || 'Barbero', initials, photo_url: photoUrl || null }).eq('id', barber.id);
      } else {
        const newId = id.trim().toLowerCase().replace(/\s+/g, '-') || name.trim().toLowerCase().replace(/\s+/g, '-');
        await supabase.from('barbers').insert({ id: newId, name: name.trim(), role: role.trim() || 'Barbero', initials, photo_url: photoUrl || null, active: true, sort_order: 99 });
      }
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">{barber ? 'Editar barbero' : 'Nuevo barbero'}</p>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex items-center gap-4">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/10" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl glass-card text-zinc-500"><UserRound className="h-7 w-7" /></div>
        )}
        <label className="cursor-pointer rounded-full glass-card px-4 py-2 text-xs font-medium text-zinc-400 transition-colors hover:text-white">
          <Upload className="mr-1.5 inline h-3.5 w-3.5" />{uploading ? 'Subiendo...' : 'Subir foto'}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {!barber && (
        <input type="text" value={id} onChange={(e) => setId(e.target.value)} placeholder="ID (ej. juan)"
          className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none" />
      )}
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo"
        className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none" />
      <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Rol (ej. Barbero, Propietario)"
        className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none" />

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
