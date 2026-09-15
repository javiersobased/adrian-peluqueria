import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { Barber } from '@/types';
import { Plus, Trash2, Pencil, Check, X, Upload, UserRound, Mail } from 'lucide-react';
import { notify } from '@/lib/notify';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const MASTER_ADMINS = [
  { name: 'Adrián Millán (Dueño)', email: 'adrian.millan.peguero@hotmail.com' },
  { name: 'Francisco Javier (Soporte técnico)', email: 'franciscojavierfarinapadilla@gmail.com' },
];

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

  const handleDelete = async (b: Barber) => {
    if (!confirm(`¿Eliminar al barbero "${b.name}"? Esta acción revocará de inmediato cualquier acceso al panel.`)) return;
    try {
      const { error: delError } = await supabase.from('barbers').delete().eq('id', b.id);
      if (delError) throw delError;

      if (b.google_email) {
        const cleanEmail = b.google_email.toLowerCase().trim();
        if (!MASTER_ADMINS.some((a) => a.email === cleanEmail)) {
          await supabase.from('staff').delete().eq('email', cleanEmail);
        }
      }
      notify.success('Barbero eliminado', `${b.name} y sus permisos fueron revocados`);
      load();
    } catch (err: any) {
      notify.error('Error al eliminar barbero', err?.message || 'No se pudo eliminar al barbero');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" label="Cargando barberos…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Barbers / Staff List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-white">Equipo de Barberos</h3>
            <p className="text-xs text-zinc-400">Personal visible en la web para reservas y con acceso limitado a su agenda.</p>
          </div>
          <button
            onClick={() => { setCreating(true); setEditing(null); }}
            className="inline-flex items-center gap-2 rounded-full gold-gradient px-4 py-2 text-xs font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-95 shadow-md"
          >
            <Plus className="h-4 w-4" />Nuevo barbero
          </button>
        </div>

        {(creating || editing) && (
          <BarberForm
            barber={editing}
            onClose={() => { setCreating(false); setEditing(null); }}
            onSaved={() => { setCreating(false); setEditing(null); load(); }}
          />
        )}

        <div className="space-y-2.5">
          {barbers.map((b) => (
            <div key={b.id} className="flex items-center gap-3.5 rounded-2xl glass-card p-3.5 transition-colors hover:border-gold/20">
              {b.photo_url ? (
                <img src={b.photo_url} alt={b.name} className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl gold-gradient font-display text-base font-bold text-black">
                  {b.initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{b.name}</p>
                <p className="text-xs text-zinc-400">{b.role}</p>
                {b.google_email ? (
                  <div className="flex items-center gap-1.5 mt-0.5 text-[0.7rem] text-gold">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{b.google_email}</span>
                  </div>
                ) : (
                  <p className="text-[0.65rem] text-zinc-600">Sin acceso a panel asignado</p>
                )}
              </div>
              <button
                onClick={() => { setEditing(b); setCreating(false); }}
                aria-label="Editar"
                className="flex h-8 w-8 items-center justify-center rounded-full glass-card text-zinc-400 hover:text-white transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(b)}
                aria-label="Eliminar"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BarberForm({ barber, onClose, onSaved }: { barber: Barber | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(barber?.name ?? '');
  const [role, setRole] = useState(barber?.role ?? 'Barbero');
  const [id, setId] = useState(barber?.id ?? '');
  const [googleEmail, setGoogleEmail] = useState(barber?.google_email ?? '');
  const [photoUrl, setPhotoUrl] = useState(barber?.photo_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      notify.success('Foto subida', 'Imagen actualizada correctamente');
    } catch (err: any) {
      notify.error('Error al subir foto', err?.message || 'No se pudo subir la foto');
    } finally { setUploading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const initials = name.trim().split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      const cleanNewEmail = googleEmail.trim().toLowerCase() || null;
      const cleanOldEmail = barber?.google_email?.trim().toLowerCase() || null;

      // If email was changed or removed, revoke old access from staff
      if (cleanOldEmail && cleanOldEmail !== cleanNewEmail) {
        if (!MASTER_ADMINS.some((a) => a.email === cleanOldEmail)) {
          await supabase.from('staff').delete().eq('email', cleanOldEmail);
        }
      }

      if (barber) {
        const { error: updateError } = await supabase.from('barbers').update({
          name: name.trim(),
          role: role.trim() || 'Barbero',
          initials,
          photo_url: photoUrl || null,
          google_email: cleanNewEmail,
        }).eq('id', barber.id);
        if (updateError) throw updateError;
        notify.success('Barbero actualizado', name.trim());
      } else {
        const newId = id.trim().toLowerCase().replace(/\s+/g, '-') || name.trim().toLowerCase().replace(/\s+/g, '-');
        const { error: insertError } = await supabase.from('barbers').insert({
          id: newId,
          name: name.trim(),
          role: role.trim() || 'Barbero',
          initials,
          photo_url: photoUrl || null,
          google_email: cleanNewEmail,
          active: true,
          sort_order: 99,
        });
        if (insertError) throw insertError;
        notify.success('Barbero creado', name.trim());
      }
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el barbero';
      setFormError(msg);
      notify.error('Error al guardar', msg);
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
        <input
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="ID identificador (ej. loren, adrian)"
          className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none"
        />
      )}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre completo"
        className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none"
      />
      <input
        type="text"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Rol (ej. Barbero, Especialista en Degradados)"
        className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none"
      />
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Correo electrónico para acceder al panel (Google)
        </label>
        <input
          type="email"
          value={googleEmail}
          onChange={(e) => setGoogleEmail(e.target.value)}
          placeholder="barbero@gmail.com"
          className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none"
        />
        <p className="mt-1.5 text-xs text-zinc-500">
          Si el barbero inicia sesión con este correo de Google, accederá a su panel. Si se borra o cambia este correo, su acceso queda revocado de inmediato.
        </p>
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
          name.trim() && !saving ? 'gold-gradient text-black hover:brightness-110 active:scale-[0.98]' : 'bg-white/5 text-zinc-600'
        }`}
      >
        {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <Check className="h-4 w-4" />}
        Guardar barbero
      </button>
    </form>
  );
}
