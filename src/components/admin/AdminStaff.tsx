import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { Barber } from '@/types';
import { Plus, Trash2, Pencil, Check, X, Upload, UserRound, Mail, Shield, ShieldCheck } from 'lucide-react';
import { notify } from '@/lib/notify';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const MASTER_ADMINS = [
  { name: 'Adrián Millán (Dueño - Hotmail)', email: 'adrian.millan.peguero@hotmail.com' },
  { name: 'Adrián Millán (Dueño - Hotmail 2)', email: 'adrianmillanpeguero1994@hotmail.com' },
  { name: 'Francisco Javier (Soporte técnico)', email: 'franciscojavierfarinapadilla@gmail.com' },
];

export const isAdrian = (b?: Barber | null): boolean => {
  if (!b) return false;
  const lowerName = b.name.toLowerCase().trim();
  return b.id === 'adrian' || lowerName === 'adrian' || lowerName === 'adrián' || lowerName.startsWith('adrián') || lowerName.startsWith('adrian');
};

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
    if (isAdrian(b)) {
      notify.error('Acción denegada', 'El perfil principal de Adrián no puede ser eliminado');
      return;
    }

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
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white truncate">{b.name}</p>
                  {isAdrian(b) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[0.65rem] font-bold text-gold border border-gold/30 shrink-0">
                      <Shield className="h-2.5 w-2.5" /> Administrador
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">{b.role}</p>
                {isAdrian(b) ? (
                  <div className="mt-1 flex items-center gap-1.5 text-[0.7rem] text-gold">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {Array.isArray(b.admin_emails) && b.admin_emails.length > 0
                        ? `${b.admin_emails.length} ${b.admin_emails.length === 1 ? 'cuenta admin' : 'cuentas admin'}: ${b.admin_emails.join(', ')}`
                        : b.google_email || 'adrian.millan.peguero@hotmail.com, adrianmillanpeguero1994@hotmail.com'}
                    </span>
                  </div>
                ) : b.google_email ? (
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
                title="Modificar perfil"
              >
                <Pencil className="h-4 w-4" />
              </button>
              {isAdrian(b) ? (
                <div
                  title="El perfil principal de Adrián está protegido y nunca puede ser eliminado"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/10 text-gold/60 cursor-not-allowed border border-gold/20"
                >
                  <ShieldCheck className="h-4 w-4 text-gold" />
                </div>
              ) : (
                <button
                  onClick={() => handleDelete(b)}
                  aria-label="Eliminar"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BarberForm({ barber, onClose, onSaved }: { barber: Barber | null; onClose: () => void; onSaved: () => void }) {
  const isAdrianProfile = isAdrian(barber);
  const [name, setName] = useState(barber?.name ?? '');
  const [role, setRole] = useState(barber?.role ?? (isAdrianProfile ? 'Barbero – Propietario' : 'Barbero'));
  const [id, setId] = useState(barber?.id ?? '');
  const [googleEmail, setGoogleEmail] = useState(barber?.google_email ?? '');
  const [adminEmails, setAdminEmails] = useState<string[]>(() => {
    if (barber && isAdrian(barber)) {
      const list: string[] = [];
      if (Array.isArray(barber.admin_emails)) {
        barber.admin_emails.forEach((e) => {
          const clean = e?.toLowerCase().trim();
          if (clean && !list.includes(clean)) list.push(clean);
        });
      }
      if (barber.google_email) {
        const clean = barber.google_email.toLowerCase().trim();
        if (clean && !list.includes(clean)) list.unshift(clean);
      }
      if (list.length === 0) {
        list.push('adrian.millan.peguero@hotmail.com', 'adrianmillanpeguero1994@hotmail.com');
      }
      return list.slice(0, 5);
    }
    return [''];
  });
  const [photoUrl, setPhotoUrl] = useState(barber?.photo_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync existing admin emails from staff table when editing Adrián
  useEffect(() => {
    if (barber && isAdrian(barber)) {
      supabase
        .from('staff')
        .select('email')
        .eq('role', 'admin')
        .then(({ data }) => {
          if (data && data.length > 0) {
            setAdminEmails((prev) => {
              const combined = [...prev];
              data.forEach((row) => {
                const em = row.email?.toLowerCase().trim();
                if (
                  em &&
                  em !== 'franciscojavierfarinapadilla@gmail.com' &&
                  !combined.includes(em)
                ) {
                  combined.push(em);
                }
              });
              return combined.slice(0, 5);
            });
          }
        });
    }
  }, [barber]);

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
    setFormError(null);

    try {
      const initials = name.trim().split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

      if (isAdrianProfile) {
        // Handle Adrián's admin accounts (up to 5)
        const cleanEmails = adminEmails
          .map((em) => em.trim().toLowerCase())
          .filter(Boolean);
        const uniqueAdminEmails = Array.from(new Set(cleanEmails)).slice(0, 5);

        if (uniqueAdminEmails.length === 0) {
          setFormError('Debes configurar al menos una cuenta de administrador para Adrián.');
          setSaving(false);
          return;
        }

        // Identify previous accounts
        const oldEmails: string[] = [];
        if (barber?.google_email) oldEmails.push(barber.google_email.trim().toLowerCase());
        if (Array.isArray(barber?.admin_emails)) {
          barber.admin_emails.forEach((em) => {
            const clean = em?.trim().toLowerCase();
            if (clean && !oldEmails.includes(clean)) oldEmails.push(clean);
          });
        }

        // Also retrieve current staff emails assigned to adrian
        try {
          const { data: staffList } = await supabase
            .from('staff')
            .select('email')
            .eq('barber_id', 'adrian');
          if (staffList) {
            staffList.forEach((s) => {
              const em = s.email?.toLowerCase().trim();
              if (em && !oldEmails.includes(em)) oldEmails.push(em);
            });
          }
        } catch {
          // ignore
        }

        // Revoke access from any email removed from Adrián's profile
        const removedEmails = oldEmails.filter((old) => !uniqueAdminEmails.includes(old));
        for (const rem of removedEmails) {
          if (rem !== 'franciscojavierfarinapadilla@gmail.com') {
            await supabase.from('staff').delete().eq('email', rem);
          }
        }

        // Grant verified admin permissions in staff table to all configured accounts
        for (const em of uniqueAdminEmails) {
          await supabase.from('staff').upsert(
            {
              email: em,
              full_name: name.trim() || 'Adrián Millán',
              role: 'admin',
              status: 'verified',
              barber_id: 'adrian',
            },
            { onConflict: 'email' }
          );
        }

        // Update barbers table
        const primaryEmail = uniqueAdminEmails[0] || null;
        let updatePayload: any = {
          name: name.trim(),
          role: role.trim() || 'Barbero – Propietario',
          initials,
          photo_url: photoUrl || null,
          google_email: primaryEmail,
          admin_emails: uniqueAdminEmails,
        };

        let { error: updateError } = await supabase
          .from('barbers')
          .update(updatePayload)
          .eq('id', barber!.id);

        if (updateError && updateError.message?.includes('admin_emails')) {
          delete updatePayload.admin_emails;
          const retry = await supabase.from('barbers').update(updatePayload).eq('id', barber!.id);
          updateError = retry.error;
        }

        if (updateError) throw updateError;
        notify.success('Perfil de Adrián actualizado', `${uniqueAdminEmails.length} cuentas de administrador activas`);
      } else {
        // Regular barber logic
        const cleanNewEmail = googleEmail.trim().toLowerCase() || null;
        const cleanOldEmail = barber?.google_email?.trim().toLowerCase() || null;

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
      }

      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el perfil';
      setFormError(msg);
      notify.error('Error al guardar', msg);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold flex items-center gap-1.5">
          {isAdrianProfile ? <ShieldCheck className="h-4 w-4" /> : null}
          {barber ? (isAdrianProfile ? 'Modificar Perfil de Adrián (Administrador)' : 'Editar barbero') : 'Nuevo barbero'}
        </p>
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
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Nombre completo
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre completo"
          className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Puesto / Rol visible
        </label>
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Rol (ej. Barbero – Propietario)"
          className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none"
        />
      </div>

      {isAdrianProfile ? (
        <div className="space-y-3 rounded-2xl bg-white/[0.03] border border-gold/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gold" />
              <label className="text-xs font-bold uppercase tracking-wider text-gold">
                Cuentas con Acceso Administrador (hasta 5)
              </label>
            </div>
            <span className="text-[0.7rem] font-semibold text-zinc-400">
              {adminEmails.filter((e) => e.trim()).length}/5 cuentas
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Cualquier correo que añadas aquí tendrá <strong>acceso completo de Administrador</strong> al iniciar sesión con Google (admite cuentas de <strong>Hotmail</strong> o <strong>Gmail</strong>). Si eliminas o cambias un correo, la cuenta anterior perderá de inmediato el acceso.
          </p>

          <div className="space-y-2 pt-1">
            {adminEmails.map((email, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const updated = [...adminEmails];
                      updated[idx] = e.target.value;
                      setAdminEmails(updated);
                    }}
                    placeholder="ej. adrian.millan.peguero@hotmail.com"
                    className="w-full rounded-xl glass-card pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none"
                  />
                </div>
                {adminEmails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = adminEmails.filter((_, i) => i !== idx);
                      setAdminEmails(updated);
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Eliminar este correo de administrador"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {adminEmails.length < 5 && (
            <button
              type="button"
              onClick={() => setAdminEmails([...adminEmails, ''])}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:text-gold/80 transition-colors pt-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Añadir otra cuenta ({adminEmails.length}/5)
            </button>
          )}
        </div>
      ) : (
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Correo electrónico para acceder al panel de barbero (Google)
          </label>
          <input
            type="email"
            value={googleEmail}
            onChange={(e) => setGoogleEmail(e.target.value)}
            placeholder="barbero@gmail.com"
            className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-zinc-500">
            Si el barbero inicia sesión con este correo de Google, accederá únicamente a su panel de barbero. Si se borra o cambia este correo, su acceso queda revocado de inmediato.
          </p>
        </div>
      )}

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
        {isAdrianProfile ? 'Guardar Cambios de Administrador' : 'Guardar barbero'}
      </button>
    </form>
  );
}
