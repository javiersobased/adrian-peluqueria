import { useCallback, useEffect, useState } from 'react';
import { Crown, Loader2, Rocket, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCurrentBusinessId, tenantFrom } from '@/lib/tenant';
import { notify } from '@/lib/notify';
import type { Barber } from '@/types';

export interface StaffAccess {
  email: string;
  role: 'admin' | 'barber';
  is_owner: boolean;
  barber_id: string | null;
  status: string;
}

// Permisos del personal del negocio (staff). Las reglas las aplica el servidor: set_barber_admin
// comprueba que quien llama es admin, protege a los titulares y a la cuenta de la plataforma, y
// nunca deja el negocio sin administradores.
export function useStaffAccess() {
  const [access, setAccess] = useState<Record<string, StaffAccess>>({});
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const reload = useCallback(async () => {
    const [{ data }, platform] = await Promise.all([
      tenantFrom('staff').select('email, role, is_owner, barber_id, status'),
      supabase.rpc('is_platform_admin'),
    ]);
    const rows = (data as StaffAccess[] | null) ?? [];
    setAccess(Object.fromEntries(rows.map((row) => [row.email.toLowerCase(), row])));
    setIsPlatformAdmin(platform.data === true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const accessFor = (barber: Barber): StaffAccess | null => {
    const email = barber.google_email?.trim().toLowerCase();
    return email ? access[email] ?? null : null;
  };

  return { access, accessFor, isPlatformAdmin, reload };
}

export function AdminRoleToggle({
  barber,
  access,
  onChanged,
}: {
  barber: Barber;
  access: StaffAccess | null;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const isAdmin = access?.role === 'admin' && access.status === 'verified';

  if (!barber.google_email) {
    return <p className="text-[0.65rem] text-zinc-500">Vincula su cuenta de Google para darle acceso de administración</p>;
  }

  if (access?.is_owner) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[0.65rem] font-bold text-gold border border-gold/30">
        <Crown className="h-2.5 w-2.5" /> Titular
      </span>
    );
  }

  const toggle = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('set_barber_admin', {
      p_business_id: getCurrentBusinessId(),
      p_barber_id: barber.id,
      p_is_admin: !isAdmin,
    });
    setSaving(false);
    if (error) {
      notify.error('No se pudo cambiar el rol', error.message);
      return;
    }
    notify.success(
      isAdmin ? 'Administración retirada' : 'Administración concedida',
      isAdmin ? `${barber.name} vuelve a gestionar solo su agenda` : `${barber.name} ya puede gestionar todo el negocio`,
    );
    onChanged();
  };

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[0.7rem] text-zinc-300">
      <button
        type="button"
        role="switch"
        aria-checked={isAdmin}
        aria-label={`Administrador: ${barber.name}`}
        disabled={saving}
        onClick={toggle}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60 ${
          isAdmin ? 'border-gold bg-gold' : 'border-white/15 bg-white/10'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${isAdmin ? 'translate-x-4' : 'translate-x-1'}`}
        />
      </button>
      <span className="inline-flex items-center gap-1">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
        Administrador
      </span>
    </label>
  );
}

// Solo visible para la cuenta raíz de la plataforma: da acceso de titular a la cuenta de Google
// del cliente para entregarle el panel en el onboarding.
export function PlatformOnboarding({ owners, onGranted }: { owners: StaffAccess[]; onGranted: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const grant = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.rpc('platform_grant_business_admin', {
      p_business_id: getCurrentBusinessId(),
      p_email: email,
      p_full_name: name || null,
      p_is_owner: true,
    });
    setSaving(false);
    if (error) {
      notify.error('No se pudo dar de alta', error.message);
      return;
    }
    notify.success('Titular dado de alta', `${email.trim().toLowerCase()} ya puede entrar al panel con Google`);
    setEmail('');
    setName('');
    onGranted();
  };

  return (
    <section aria-labelledby="onboarding-titulo" className="rounded-2xl glass-card border border-gold/20 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-gold" />
        <h3 id="onboarding-titulo" className="font-display text-sm font-bold text-white">Onboarding del cliente (plataforma)</h3>
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        Da acceso de titular a la cuenta de Google del cliente. Al iniciar sesión entrará directamente a este panel.
      </p>
      <form onSubmit={grant} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="sr-only" htmlFor="onboarding-email">Email de Google del cliente</label>
        <input
          id="onboarding-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@gmail.com"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-gold focus:outline-none"
        />
        <label className="sr-only" htmlFor="onboarding-name">Nombre</label>
        <input
          id="onboarding-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre (opcional)"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-gold focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl gold-gradient px-4 py-2 text-xs font-bold uppercase tracking-wider text-black disabled:opacity-60"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Dar acceso
        </button>
      </form>
      {owners.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Titulares del negocio">
          {owners.map((owner) => (
            <li key={owner.email} className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2.5 py-1 text-[0.7rem] text-gold border border-gold/20">
              <Crown className="h-3 w-3" /> {owner.email}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
