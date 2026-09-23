import React, { useState, useEffect, useRef } from 'react';
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
  User,
  Check,
  Edit3,
} from 'lucide-react';

import { isDeveloper, getDeveloperProfile, isSuperAdminEmail } from '@/lib/auth';

interface AdminProfileProps {
  userRole: UserRole;
  targetBarberId?: string | null;
  onBarberUpdated?: () => void;
}

export function AdminProfile({ userRole, targetBarberId, onBarberUpdated }: AdminProfileProps) {
  const [barber, setBarber] = useState<Barber | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDevUser =
    isDeveloper(userRole.email) ||
    userRole.barber_id === 'franciscojavier' ||
    userRole.barber_id === 'francisco_javier' ||
    isSuperAdminEmail(userRole.email);

  // Determine whether the target profile being inspected is Francisco's developer profile
  const isTargetDev =
    targetBarberId === 'franciscojavier' ||
    (!targetBarberId && isDevUser) ||
    (targetBarberId === 'all' && isDevUser);

  const effectiveBarberId = isTargetDev
    ? 'franciscojavier'
    : targetBarberId && targetBarberId !== 'all'
    ? targetBarberId
    : userRole.barber_id || 'adrian';

  const loadBarberProfile = async () => {
    try {
      setLoading(true);
      let barberData: Barber | null = null;

      if (isTargetDev) {
        barberData = getDeveloperProfile();
        try {
          const { data } = await supabase
            .from('barbers')
            .select('*')
            .eq('id', 'franciscojavier')
            .maybeSingle();

          if (data) {
            barberData = {
              ...barberData,
              ...data,
              photo_url: data.photo_url || barberData.photo_url,
              name: data.name || barberData.name,
              initials: data.initials || barberData.initials,
            };
            if (data.photo_url && typeof window !== 'undefined') {
              localStorage.setItem('barber_photo_franciscojavier', data.photo_url);
              localStorage.setItem('barber_photo_francisco_javier', data.photo_url);
            }
            if (data.name && typeof window !== 'undefined') {
              localStorage.setItem('barber_name_franciscojavier', data.name);
            }
          }
        } catch {
          // ignore
        }
      } else {
        if (effectiveBarberId) {
          const { data } = await supabase
            .from('barbers')
            .select('*')
            .eq('id', effectiveBarberId)
            .maybeSingle();
          barberData = data as Barber | null;
        }

        if (!barberData && userRole.email) {
          const { data } = await supabase
            .from('barbers')
            .select('*')
            .ilike('google_email', userRole.email)
            .maybeSingle();
          barberData = data as Barber | null;
        }

        // Default fallback for Adrián (administrator)
        if (!barberData) {
          const { data } = await supabase
            .from('barbers')
            .select('*')
            .eq('id', 'adrian')
            .maybeSingle();
          barberData = data as Barber | null;
        }
      }

      if (barberData && !barberData.photo_url && typeof window !== 'undefined') {
        const cached =
          localStorage.getItem(`barber_photo_${barberData.id}`) ||
          (barberData.id === 'franciscojavier'
            ? localStorage.getItem('barber_photo_francisco_javier')
            : null);
        if (cached) {
          barberData = { ...barberData, photo_url: cached };
        }
      }

      setBarber(barberData);
      setNameInput(barberData?.name || '');
    } catch (err: any) {
      console.error('Error al cargar perfil de barbero:', err);
      notify.error('Error al cargar perfil', err?.message || 'No se pudo obtener la información.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBarberProfile();
  }, [effectiveBarberId, isTargetDev, userRole.email]);

  // Upload or update profile photo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !barber) return;

    if (file.size > 5 * 1024 * 1024) {
      notify.error('Archivo demasiado grande', 'La imagen debe pesar menos de 5 MB.');
      return;
    }

    setUploading(true);
    setSavingPhoto(true);
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

      // Immediately cache locally so it never disappears
      if (typeof window !== 'undefined') {
        localStorage.setItem(`barber_photo_${barber.id}`, publicUrl);
        if (barber.id === 'franciscojavier' || isTargetDev) {
          localStorage.setItem('barber_photo_franciscojavier', publicUrl);
          localStorage.setItem('barber_photo_francisco_javier', publicUrl);
        }
      }

      if (barber.id === 'franciscojavier' || isTargetDev) {
        try {
          await supabase.from('barbers').upsert({
            id: 'franciscojavier',
            name: barber.name || 'Francisco Javier',
            role: 'Desarrollador',
            initials: barber.initials || 'FJ',
            photo_url: publicUrl,
            active: false,
            sort_order: 9999,
            google_email: userRole.email,
          });
        } catch (e) {
          console.error('Error upserting dev barber photo:', e);
        }
      } else {
        try {
          await supabase.rpc('update_my_barber_profile', {
            p_barber_id: barber.id,
            p_photo_url: publicUrl,
          });
        } catch {
          await supabase
            .from('barbers')
            .update({ photo_url: publicUrl })
            .eq('id', barber.id);
        }
      }

      setBarber((prev) => (prev ? { ...prev, photo_url: publicUrl } : null));
      notify.success('Foto de perfil actualizada', 'Tu imagen ha sido guardada correctamente.');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('barber_profile_updated'));
      }
      onBarberUpdated?.();
    } catch (err: any) {
      console.error('Error al actualizar foto de perfil:', err);
      notify.error('Error al subir foto', err?.message || 'No se pudo guardar la imagen.');
    } finally {
      setUploading(false);
      setSavingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove photo and reset to initials
  const handleRemovePhoto = async () => {
    if (!barber || !barber.photo_url) return;
    if (!window.confirm('¿Seguro que deseas eliminar tu foto de perfil? Se mostrarán tus iniciales.')) return;

    setSavingPhoto(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`barber_photo_${barber.id}`);
        if (barber.id === 'franciscojavier' || isTargetDev) {
          localStorage.removeItem('barber_photo_franciscojavier');
          localStorage.removeItem('barber_photo_francisco_javier');
        }
      }

      if (barber.id === 'franciscojavier' || isTargetDev) {
        try {
          await supabase.from('barbers').update({ photo_url: null }).eq('id', 'franciscojavier');
        } catch {}
      } else {
        try {
          await supabase.rpc('update_my_barber_profile', {
            p_barber_id: barber.id,
            p_photo_url: '',
          });
        } catch {
          await supabase.from('barbers').update({ photo_url: null }).eq('id', barber.id);
        }
      }

      setBarber((prev) => (prev ? { ...prev, photo_url: null } : null));
      notify.success('Foto eliminada', 'Se ha restablecido tu avatar por defecto.');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('barber_profile_updated'));
      }
      onBarberUpdated?.();
    } catch (err: any) {
      console.error('Error al eliminar foto de perfil:', err);
      notify.error('Error', err?.message || 'No se pudo eliminar la foto.');
    } finally {
      setSavingPhoto(false);
    }
  };

  // Save new barber name
  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    if (!cleanName || !barber) return;
    if (cleanName === barber.name) return;

    setSavingName(true);
    try {
      const words = cleanName.split(' ').filter(Boolean);
      const initials = words.length >= 2
        ? (words[0][0] + words[1][0]).toUpperCase()
        : cleanName.slice(0, 2).toUpperCase();

      if (barber.id === 'franciscojavier' || isTargetDev) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('barber_name_franciscojavier', cleanName);
          localStorage.setItem('barber_name_francisco_javier', cleanName);
        }
        try {
          await supabase.from('barbers').upsert({
            id: 'franciscojavier',
            name: cleanName,
            initials,
            role: 'Desarrollador',
            photo_url: barber.photo_url,
            active: false,
            sort_order: 9999,
            google_email: userRole.email,
          });
        } catch (e) {
          console.error('Error upserting developer name:', e);
        }
      } else {
        try {
          await supabase.rpc('update_my_barber_profile', {
            p_barber_id: barber.id,
            p_name: cleanName,
          });
        } catch {
          await supabase
            .from('barbers')
            .update({ name: cleanName, initials })
            .eq('id', barber.id);
        }
      }

      setBarber((prev) => (prev ? { ...prev, name: cleanName, initials } : null));
      notify.success('Nombre actualizado', `El nombre se ha guardado como "${cleanName}".`);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('barber_profile_updated'));
      }
      onBarberUpdated?.();
    } catch (err: any) {
      console.error('Error al guardar nombre:', err);
      notify.error('Error', err?.message || 'No se pudo actualizar el nombre.');
    } finally {
      setSavingName(false);
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

  const isManagingOther =
    (isDevUser && barber.id !== 'franciscojavier') ||
    (!isDevUser && userRole.role === 'admin' && barber.id !== 'adrian' && barber.id !== userRole.barber_id);

  return (
    <div className="mx-auto max-w-5xl xl:max-w-6xl w-full min-w-0 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-white">
              {isTargetDev
                ? 'Mi Perfil de Super Administrador'
                : isManagingOther
                ? `Perfil de Barbero: ${barber.name}`
                : 'Mi Perfil de Barbero'}
            </h1>
            <span className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[0.65rem] font-semibold text-gold">
              <ShieldCheck className="h-3 w-3" />
              {isTargetDev
                ? 'Super Administrador · Oculto'
                : isManagingOther
                ? 'Modo Administrador'
                : 'Barbero Verificado'}
            </span>
          </div>
          <p className="text-sm text-zinc-400">
            {isTargetDev
              ? 'Perfil confidencial con control total del sistema. Puedes actualizar tu foto de perfil y nombre sin alterar la web del cliente.'
              : isManagingOther
              ? `Estás visualizando y gestionando los datos públicos del barbero ${barber.name}.`
              : 'Gestiona tu imagen profesional y el nombre identificador con el que te verán los clientes en la web.'}
          </p>
        </div>
      </div>

      {/* Main Profile Card: Avatar & Photo Actions */}
      <div className="relative overflow-hidden rounded-3xl glass-card p-6 md:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Avatar Section */}
          <div className="relative group shrink-0">
            <div className="relative h-28 w-28 overflow-hidden rounded-2xl ring-2 ring-gold/40 shadow-xl shadow-gold/5 transition-all group-hover:ring-gold bg-zinc-900">
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

              {(uploading || savingPhoto) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-xs">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || savingPhoto}
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
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium border ${
                    isTargetDev
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}
                >
                  {isTargetDev ? 'Acceso Desarrollador' : 'En servicio'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {barber.role || (isTargetDev ? 'Desarrollador Web' : 'Barbero Profesional')}
              </p>
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
                disabled={uploading || savingPhoto}
                className="flex items-center gap-2 rounded-xl gold-gradient px-4 py-2.5 text-xs font-bold text-black transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{barber.photo_url ? 'Cambiar foto de perfil' : 'Subir foto de perfil'}</span>
              </button>

              {barber.photo_url && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={uploading || savingPhoto}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-medium text-zinc-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 active:scale-95 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar foto</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-zinc-500">
              Formatos recomendados: JPG, PNG o WebP. Máximo 5 MB.
            </p>
          </div>
        </div>
      </div>

      {/* Name / Identity Edit Card */}
      <div className="rounded-3xl glass-card p-6 md:p-8 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                Identificador de Nombre
              </h3>
              <p className="text-xs text-zinc-400">
                Nombre que aparecerá en el selector de barberos, citas y en la página web.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveName} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Nombre visible
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Ej: Loren, David Luna..."
                  className="w-full rounded-xl glass-card px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none transition-colors border border-white/10"
                />
              </div>
              <button
                type="submit"
                disabled={savingName || !nameInput.trim() || nameInput.trim() === barber.name}
                className="flex items-center justify-center gap-2 rounded-xl gold-gradient px-5 py-2.5 text-xs font-bold text-black transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 shrink-0"
              >
                {savingName ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>Guardar nombre</span>
              </button>
            </div>
            {nameInput.trim() !== barber.name && nameInput.trim() !== '' && (
              <p className="text-[11px] text-gold mt-1.5 flex items-center gap-1">
                <Edit3 className="h-3 w-3" />
                Tienes cambios sin guardar en el nombre. Haz clic en "Guardar nombre".
              </p>
            )}
          </div>
        </form>
      </div>

      {/* Account Details */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl glass-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-zinc-400">
            <Mail className="h-4 w-4 text-gold" />
            <span className="text-xs font-semibold uppercase tracking-wider">Acceso de Google</span>
          </div>
          <p className="font-mono text-sm text-zinc-200 truncate">
            {barber.google_email || userRole.email || 'No asignado'}
          </p>
          <p className="text-[11px] text-zinc-500">
            Cuenta de Google autorizada para iniciar sesión en este perfil.
          </p>
        </div>

        <div className="rounded-3xl glass-card p-5 space-y-2">
          <div className="flex items-center gap-2 text-zinc-400">
            <Clock className="h-4 w-4 text-gold" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isTargetDev ? 'Identificador de Desarrollador' : 'Identificador de Barbero'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-zinc-200 font-bold">{barber.id}</span>
            <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
              {isTargetDev ? 'Privado' : `Orden #${barber.sort_order ?? 0}`}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500">
            {isTargetDev
              ? 'Perfil técnico de desarrollo con acceso global al sistema y vistas de salón.'
              : 'ID interno utilizado para la asignación y sincronización de citas.'}
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
            <p className="text-xs font-semibold text-zinc-200">Especialidades y Bio</p>
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
