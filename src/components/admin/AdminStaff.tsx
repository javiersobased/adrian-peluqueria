import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { Barber, SavedBooking } from '@/types';
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Upload,
  UserRound,
  Mail,
  Shield,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  Scissors,
  Phone,
  CheckCircle2,
  XCircle,
  Ban,
  Sparkles,
} from 'lucide-react';
import { notify } from '@/lib/notify';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { toISO } from '@/lib/schedule';
import {
  planCascadingReassignments,
  executeCascadingDecisions,
  cancelAllAffectedBookings,
  type ReassignmentDecision,
} from '@/lib/reassignment';
import { ModalPortal } from '@/components/ui/ModalPortal';

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

interface DeletionConflictState {
  barber: Barber;
  bookings: SavedBooking[];
  decisions: ReassignmentDecision[];
}

export function AdminStaff() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Barber | null>(null);
  const [deletionConflict, setDeletionConflict] = useState<DeletionConflictState | null>(null);
  const [calculatingCascade, setCalculatingCascade] = useState(false);
  const [executingCascade, setExecutingCascade] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAllBarbers();
    setBarbers(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const executeDeleteBarber = async (barberId: string, barberName: string, googleEmail?: string | null) => {
    try {
      const { error: delError } = await supabase.from('barbers').delete().eq('id', barberId);
      if (delError) throw delError;

      if (googleEmail) {
        const cleanEmail = googleEmail.toLowerCase().trim();
        if (!MASTER_ADMINS.some((a) => a.email === cleanEmail)) {
          await supabase.from('staff').delete().eq('email', cleanEmail);
        }
      }
      notify.success('Barbero eliminado', `${barberName} y sus permisos fueron revocados`);
      load();
    } catch (err: any) {
      notify.error('Error al eliminar barbero', err?.message || 'No se pudo eliminar al barbero');
    }
  };

  const handleDelete = async (b: Barber) => {
    if (isAdrian(b)) {
      notify.error('Acción denegada', 'El perfil principal de Adrián no puede ser eliminado');
      return;
    }

    // 1. Consultar si este barbero tiene citas activas futuras pendientes
    const today = toISO(new Date());
    const { data: futureBookings, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('barber', b.id)
      .gte('booking_date', today)
      .neq('status', 'cancelled');

    if (fetchErr) {
      notify.error('Error al comprobar citas', fetchErr.message);
      return;
    }

    const pending = (futureBookings as SavedBooking[]) || [];

    // 2. Si tiene citas futuras, calcular la cascada inteligente de reasignación
    if (pending.length > 0) {
      setCalculatingCascade(true);
      setDeletionConflict({
        barber: b,
        bookings: pending,
        decisions: [],
      });

      try {
        const decisions = await planCascadingReassignments(pending, b.id);
        setDeletionConflict({
          barber: b,
          bookings: pending,
          decisions,
        });
      } catch (err: any) {
        console.error('Error al calcular cascada de reasignación:', err);
        notify.error('Error al analizar citas', err?.message || 'No se pudo calcular la disponibilidad');
      } finally {
        setCalculatingCascade(false);
      }
      return;
    }

    if (!confirm(`¿Eliminar al barbero "${b.name}"? Esta acción revocará de inmediato cualquier acceso al panel.`)) return;
    executeDeleteBarber(b.id, b.name, b.google_email);
  };

  const handleConfirmCascadeAndDelete = async () => {
    if (!deletionConflict) return;
    setExecutingCascade(true);
    try {
      const { reassignedCount, cancelledCount } = await executeCascadingDecisions(
        deletionConflict.decisions,
        deletionConflict.barber,
        barbers
      );

      await executeDeleteBarber(
        deletionConflict.barber.id,
        deletionConflict.barber.name,
        deletionConflict.barber.google_email
      );

      const parts = [];
      if (reassignedCount > 0) parts.push(`${reassignedCount} reasignada${reassignedCount > 1 ? 's' : ''}`);
      if (cancelledCount > 0) parts.push(`${cancelledCount} cancelada${cancelledCount > 1 ? 's' : ''}`);
      notify.success(
        'Barbero eliminado con éxito',
        parts.length > 0 ? `Citas procesadas: ${parts.join(' y ')}` : 'No había citas pendientes'
      );
      setDeletionConflict(null);
    } catch (err: any) {
      console.error('Error al ejecutar reasignación y eliminar:', err);
      notify.error('Error en reasignación', err?.message || 'No se pudieron procesar las citas');
    } finally {
      setExecutingCascade(false);
    }
  };

  const handleCancelAllAndDelete = async () => {
    if (!deletionConflict) return;
    const count = deletionConflict.bookings.length;
    if (
      !confirm(
        `¿Confirmas la cancelación de las ${count} ${count === 1 ? 'cita pendiente' : 'citas pendientes'} y la eliminación de "${deletionConflict.barber.name}"?\n\nLos clientes recibirán un email de cancelación.`
      )
    ) {
      return;
    }

    setExecutingCascade(true);
    try {
      await cancelAllAffectedBookings(
        deletionConflict.bookings,
        deletionConflict.barber,
        `Baja del profesional ${deletionConflict.barber.name}`
      );

      await executeDeleteBarber(
        deletionConflict.barber.id,
        deletionConflict.barber.name,
        deletionConflict.barber.google_email
      );

      notify.success(
        'Barbero eliminado',
        `Se cancelaron ${count} citas y se notificó a los clientes.`
      );
      setDeletionConflict(null);
    } catch (err: any) {
      console.error('Error al cancelar citas y eliminar barbero:', err);
      notify.error('Error al cancelar', err?.message || 'No se pudieron cancelar las citas');
    } finally {
      setExecutingCascade(false);
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
    <div className="mx-auto max-w-6xl w-full min-w-0 space-y-6">
      {/* Barbers / Staff List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-white">Equipo de Barberos</h3>
            <p className="text-xs text-zinc-400">Personal visible en la web para reservas y con acceso limitado a su agenda.</p>
          </div>
          <button
            onClick={() => { setCreating(true); setEditing(null); }}
            className="inline-flex items-center gap-2 rounded-full gold-gradient px-4 py-2 text-xs font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-95 shadow-md shrink-0"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {barbers.map((b) => (
            <div key={b.id} className="flex items-center gap-2.5 sm:gap-3.5 rounded-2xl glass-card p-3 sm:p-3.5 transition-colors hover:border-gold/20">
              {b.photo_url ? (
                <img src={b.photo_url} alt={b.name} className="h-11 w-11 sm:h-12 sm:w-12 shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
              ) : (
                <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl gold-gradient font-display text-base font-bold text-black">
                  {b.initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{b.name}</p>
                  {isAdrian(b) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[0.65rem] font-bold text-gold border border-gold/30 shrink-0">
                      <Shield className="h-2.5 w-2.5" /> Administrador
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 truncate">{b.role}</p>
                {isAdrian(b) ? (
                  <div className="mt-1 flex items-center gap-1.5 text-[0.7rem] text-gold min-w-0">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {Array.isArray(b.admin_emails) && b.admin_emails.length > 0
                        ? `${b.admin_emails.length} ${b.admin_emails.length === 1 ? 'cuenta admin' : 'cuentas admin'}: ${b.admin_emails.join(', ')}`
                        : b.google_email || 'adrian.millan.peguero@hotmail.com, adrianmillanpeguero1994@hotmail.com'}
                    </span>
                  </div>
                ) : b.google_email ? (
                  <div className="flex items-center gap-1.5 mt-0.5 text-[0.7rem] text-gold min-w-0">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{b.google_email}</span>
                  </div>
                ) : (
                  <p className="text-[0.65rem] text-zinc-600">Sin acceso a panel asignado</p>
                )}
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  onClick={() => { setEditing(b); setCreating(false); }}
                  aria-label="Editar"
                  className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full glass-card text-zinc-400 hover:text-white transition-colors"
                  title="Modificar perfil"
                >
                  <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
                {isAdrian(b) ? (
                  <div
                    title="El perfil principal de Adrián está protegido y nunca puede ser eliminado"
                    className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-gold/10 text-gold/60 cursor-not-allowed border border-gold/20"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gold" />
                  </div>
                ) : (
                  <button
                    onClick={() => handleDelete(b)}
                    aria-label="Eliminar"
                    className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de confirmación y reasignación en cascada inteligente antes de eliminar barbero */}
      {deletionConflict && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-md animate-fade-in"
              onClick={() => { if (!executingCascade) setDeletionConflict(null); }}
            />
            <div className="relative z-10 my-auto flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-gold/30 bg-zinc-900/95 p-4 sm:p-6 shadow-2xl backdrop-blur-xl animate-scale-in">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 sm:pb-4 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-gold border border-gold/30">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-white">
                    Reasignación en Cascada ({deletionConflict.bookings.length} {deletionConflict.bookings.length === 1 ? 'cita' : 'citas'})
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Baja de {deletionConflict.barber.name} con citas pendientes
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={executingCascade}
                onClick={() => setDeletionConflict(null)}
                className="rounded-full p-1 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="my-3 sm:my-4 space-y-3.5 overflow-y-auto flex-1 pr-1 text-xs">
              {calculatingCascade ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
                  <LoadingSpinner size="md" label="Analizando disponibilidad del equipo..." />
                  <p className="text-xs text-zinc-400">
                    Buscando barberos libres para cada horario y fecha...
                  </p>
                </div>
              ) : (
                <>
                  {/* Resumen explicativo */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-2">
                    <p className="text-zinc-300 text-[0.75rem] leading-relaxed">
                      El sistema ha evaluado a los miembros del equipo en orden: si un barbero ya tiene cita a esa hora, pasa al siguiente hasta encontrar uno libre. Si ninguno está libre, la cita se cancela automáticamente.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(() => {
                        const reassigned = deletionConflict.decisions.filter((d) => d.action === 'reassign');
                        const cancelled = deletionConflict.decisions.filter((d) => d.action === 'cancel');
                        return (
                          <>
                            {reassigned.length > 0 && (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                {reassigned.length} {reassigned.length === 1 ? 'cita reasignada a compañero libre' : 'citas reasignadas a compañeros libres'}
                              </span>
                            )}
                            {cancelled.length > 0 && (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[0.7rem] font-semibold text-red-300">
                                <XCircle className="h-3.5 w-3.5 text-red-400" />
                                {cancelled.length} {cancelled.length === 1 ? 'cita se cancelará (sin huecos libres)' : 'citas se cancelarán (sin huecos libres)'}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Lista de citas y su destino en la cascada */}
                  <div className="space-y-2">
                    <p className="text-[0.65rem] uppercase tracking-wider font-semibold text-zinc-500">
                      Resolución por cita ({deletionConflict.decisions.length})
                    </p>
                    <div className="max-h-[36vh] space-y-2.5 overflow-y-auto pr-1">
                      {deletionConflict.decisions.map((dec) => {
                        const b = dec.booking;
                        return (
                          <div
                            key={b.id}
                            className={`rounded-2xl border p-3 text-xs transition-all ${
                              dec.action === 'reassign'
                                ? 'border-emerald-500/30 bg-emerald-950/15'
                                : 'border-red-500/30 bg-red-950/15'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="rounded-md bg-gold/15 px-1.5 py-0.5 font-mono text-[0.7rem] font-bold text-gold border border-gold/20">
                                    {b.booking_date} · {b.booking_time}h
                                  </span>
                                  <span className="truncate font-semibold text-white">{b.full_name}</span>
                                </div>
                                <p className="text-[0.7rem] text-zinc-400 flex items-center gap-1.5 truncate">
                                  <Scissors className="h-3 w-3 text-gold/80 shrink-0" />
                                  <span className="truncate">{b.service}</span>
                                  <span className="text-gold font-mono shrink-0">({b.service_price}€)</span>
                                </p>
                                {b.phone && (
                                  <p className="text-[0.65rem] text-zinc-500 flex items-center gap-1">
                                    <Phone className="h-2.5 w-2.5 shrink-0" />
                                    <span>{b.phone}</span>
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Detalle de la resolución */}
                            {dec.action === 'reassign' ? (
                              <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2 text-emerald-200">
                                <UserCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" />
                                <div className="space-y-0.5 text-[0.7rem] min-w-0">
                                  <p className="font-bold text-emerald-300">
                                    Reasignado a: {dec.targetBarberName}
                                  </p>
                                  <p className="text-emerald-300/80 text-[0.68rem]">{dec.reason}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2.5 space-y-1.5 rounded-xl bg-red-500/10 border border-red-500/20 p-2 text-red-200">
                                <div className="flex items-center gap-1.5 text-[0.7rem] font-bold text-red-300">
                                  <Ban className="h-3.5 w-3.5 text-red-400 shrink-0" />
                                  <span>Cancelación automática</span>
                                </div>
                                <p className="text-[0.68rem] text-red-300/80">{dec.reason}</p>
                                {dec.attempts.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {dec.attempts.map((att) => (
                                      <span
                                        key={att.barberId}
                                        className="inline-block rounded bg-black/40 px-1.5 py-0.5 text-[0.62rem] text-zinc-400"
                                      >
                                        {att.barberName}: {att.reason}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 border-t border-white/10 pt-3 sm:pt-4 shrink-0">
              <button
                type="button"
                disabled={executingCascade}
                onClick={() => setDeletionConflict(null)}
                className="w-full sm:w-auto rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cerrar
              </button>

              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  disabled={executingCascade || calculatingCascade}
                  onClick={handleCancelAllAndDelete}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-950/30 hover:bg-red-900/50 text-red-200 px-3.5 py-2.5 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                >
                  <Ban className="h-3.5 w-3.5 text-red-400" />
                  <span>Cancelar todas y eliminar</span>
                </button>

                <button
                  type="button"
                  disabled={executingCascade || calculatingCascade}
                  onClick={handleConfirmCascadeAndDelete}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl gold-gradient px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-black hover:brightness-110 active:scale-95 transition-all shadow-md disabled:opacity-50"
                >
                  {executingCascade ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-3.5 w-3.5" />
                      <span>Aplicar cascada y eliminar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
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
