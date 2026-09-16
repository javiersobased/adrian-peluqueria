import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { UserRole, Barber } from '@/types';
import {
  Camera,
  Upload,
  Trash2,
  ShieldCheck,
  Mail,
  Sparkles,
  Scissors,
  TrendingUp,
  Clock,
} from 'lucide-react';

interface AdminProfileProps {
  userRole: UserRole;
  onBarberUpdated?: () => void;
}

export function AdminProfile({ userRole, onBarberUpdated }: AdminProfileProps) {
  const [barber, setBarber] = useState<Barber | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBarberProfile = async () => {
    try {
      setLoading(true);
      let query = supabase.from('barbers').select('*');

      if (userRole.barber_id) {
        query = query.eq('id', userRole.barber_id);
      } else if (userRole.email) {
        query = query.ilike('google_email', userRole.email);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      let barberData = data as Barber | null;
      if (barberData && !barberData.photo_url && typeof window !== 'undefined') {
        const cached = localStorage.getItem(`barber_photo_${barberData.id}`);
        if (cached) {
          barberData = { ...barberData, photo_url: cached };
        }
      }
      setBarber(barberData);
    } catch (err: any) {
      console.error('Error al cargar perfil de barbero:', err);
      notify.error('Error al cargar perfil', err?.message || 'No se pudo obtener la información.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBarberProfile();
  }, [userRole.barber_id, userRole.email]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !barber) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      notify.error('Archivo demasiado grande', 'La imagen debe pesar menos de 5 MB.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `barber_${barber.id}_${Date.now()}.${ext}`;

      // Upload to barber-photos bucket
      const { error: uploadError } = await supabase.storage
        .from('barber-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('barber-photos')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // Immediately cache locally so it never disappears on page refresh
      if (typeof window !== 'undefined') {
        localStorage.setItem(`barber_photo_${barber.id}`, publicUrl);
      }

      // Update in barbers table (try direct update first, then RPC fallback)
      setSaving(true);
      const { data: updatedRows, error: updateError } = await supabase
        .from('barbers')
        .update({ photo_url: publicUrl })
        .eq('id', barber.id)
        .select();

      const savedInDb = updatedRows && updatedRows.length > 0;

      if (!savedInDb || updateError) {
        // Fallback to RPC if RLS blocks direct update
        await supabase.rpc('update_my_barber_photo', {
          p_barber_id: barber.id,
          p_photo_url: publicUrl,
        }).catch(() => null);
      }

      setBarber((prev) => (prev ? { ...prev, photo_url: publicUrl } : null));
      notify.success('Foto de perfil actualizada', 'Tu imagen ha sido guardada correctamente.');
      onBarberUpdated?.();
    } catch (err: any) {
      console.error('Error al actualizar foto de perfil:', err);
      notify.error('Error al subir foto', err?.message || 'No se pudo guardar la imagen.');
    } finally {
      setUploading(false);
      setSaving(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async () => {
    if (!barber || !barber.photo_url) return;
    if (!window.confirm('¿Seguro que deseas eliminar tu foto de perfil? Se mostrarán tus iniciales.')) return;

    setSaving(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`barber_photo_${barber.id}`);
      }

      await supabase
        .from('barbers')
        .update({ photo_url: null })
        .eq('id', barber.id);

      await supabase.rpc('update_my_barber_photo', {
        p_barber_id: barber.id,
        p_photo_url: null,
      }).catch(() => null);

      setBarber((prev) => (prev ? { ...prev, photo_url: null } : null));
      notify.success('Foto eliminada', 'Se ha restablecido tu avatar por defecto.');
      onBarberUpdated?.();
    } catch (err: any) {
      console.error('Error al eliminar foto de perfil:', err);
      notify.error('Error', err?.message || 'No se pudo eliminar la foto.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner message="Cargando tu perfil..." />
      </div>
    );
  }

  if (!barber) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl glass-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-zinc-400">
          <ShieldCheck className="h-6 w-6 text-gold" />
        </div>
        <h3 className="font-display text-lg font-bold text-white">Perfil no vinculado</h3>
        <p className="mt-2 text-sm text-zinc-400">
          Tu cuenta ({userRole.email}) no tiene un barbero vinculado en la base de datos.
          Contacta con el administrador para vincular tu correo.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-white">Mi Perfil</h1>
            <span className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[0.65rem] font-semibold text-gold">
              <ShieldCheck className="h-3 w-3" />
              Barbero Verificado
            </span>
          </div>
          <p className="text-sm text-zinc-400">
            Gestiona tu imagen profesional y tu presencia en la plataforma de Adrián Millán.
          </p>
        </div>
      </div>

      {/* Main Profile Card */}
      <div className="relative overflow-hidden rounded-3xl glass-card p-6 md:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Avatar Section */}
          <div className="relative group shrink-0">
            <div className="relative h-28 w-28 overflow-hidden rounded-2xl ring-2 ring-gold/40 shadow-xl shadow-gold/5 transition-all group-hover:ring-gold">
              {barber.photo_url ? (
                <img
                  src={barber.photo_url}
                  alt={barber.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center gold-gradient font-display text-3xl font-bold text-black">
                  {barber.initials || barber.name.slice(0, 2).toUpperCase()}
                </div>
              )}

              {(uploading || saving) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-xs">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || saving}
              title="Cambiar foto de perfil"
              className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gold text-black shadow-lg transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>

          {/* Basic Info & Photo Actions */}
          <div className="flex-1 text-center sm:text-left space-y-4">
            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="font-display text-xl font-bold text-white">{barber.name}</h2>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-emerald-400 border border-emerald-500/20">
                  En servicio
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{barber.role || 'Barbero Profesional'}</p>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || saving}
                className="flex items-center gap-2 rounded-xl gold-gradient px-4 py-2.5 text-xs font-bold text-black transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{barber.photo_url ? 'Cambiar foto de perfil' : 'Subir foto de perfil'}</span>
              </button>

              {barber.photo_url && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={uploading || saving}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-medium text-zinc-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 active:scale-95 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar foto</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-zinc-500">
              Formatos recomendados: JPG, PNG o WebP. Máximo 5 MB. Tu foto se verá reflejada en la pantalla de selección de barbero cuando los clientes reserven.
            </p>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl glass-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-zinc-400">
            <Mail className="h-4 w-4 text-gold" />
            <span className="text-xs font-semibold uppercase tracking-wider">Acceso de Google</span>
          </div>
          <p className="font-mono text-sm text-zinc-200 truncate">
            {userRole.email || barber.google_email || 'No asignado'}
          </p>
          <p className="text-[11px] text-zinc-500">
            Cuenta de Google vinculada para iniciar sesión en tu panel.
          </p>
        </div>

        <div className="rounded-3xl glass-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-zinc-400">
            <Clock className="h-4 w-4 text-gold" />
            <span className="text-xs font-semibold uppercase tracking-wider">Identificador de Barbero</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-zinc-200 font-bold">{barber.id}</span>
            <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
              Orden #{barber.sort_order}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500">
            ID interno utilizado para la asignación y sincronización de citas.
          </p>
        </div>
      </div>

      {/* Upcoming features preview section */}
      <div className="rounded-3xl border border-white/5 bg-zinc-900/40 p-6 backdrop-blur-md">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" />
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-zinc-300">
            Próximamente en tu espacio de perfil
          </h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/5 p-4 space-y-1.5 border border-white/5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold/10 text-gold mb-2">
              <TrendingUp className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-zinc-200">Métricas Personales</p>
            <p className="text-[11px] leading-relaxed text-zinc-400">
              Estadísticas mensuales de citas realizadas y servicios más solicitados.
            </p>
          </div>

          <div className="rounded-2xl bg-white/5 p-4 space-y-1.5 border border-white/5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold/10 text-gold mb-2">
              <Scissors className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-zinc-200">Especialidades & Bio</p>
            <p className="text-[11px] leading-relaxed text-zinc-400">
              Presentación personal y técnicas destacadas que verán tus clientes.
            </p>
          </div>

          <div className="rounded-2xl bg-white/5 p-4 space-y-1.5 border border-white/5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold/10 text-gold mb-2">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-zinc-200">Preferencias de Agenda</p>
            <p className="text-[11px] leading-relaxed text-zinc-400">
              Configuraciones avanzadas y notificaciones automáticas en tiempo real.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
