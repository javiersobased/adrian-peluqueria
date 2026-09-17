import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllBarbers } from '@/data/services';
import type { BarberBlock, Barber, BarberVacation, SavedBooking } from '@/types';
import { Trash2, CalendarOff, Clock, Plane, AlertTriangle, ArrowRight, UserCheck, X, Scissors, Phone, User } from 'lucide-react';
import { BLOCK_START_SLOTS, BLOCK_END_SLOTS, toISO, isBlockExpired, isVacationExpired, timeToMinutes, WEEKDAY_SHORT, MONTH_SHORT } from '@/lib/schedule';
import { notify } from '@/lib/notify';

interface AdminAvailabilityProps {
  blocks?: BarberBlock[];
  onRefresh?: () => void;
}

type BlockMode = 'day_full' | 'time_range' | 'vacation';

interface ConflictState {
  affected: SavedBooking[];
  sourceBarberName: string;
  sourceBarberId: string;
  isSourceAdrian: boolean;
  targetBarberId: string;
  otherBarbers: Barber[];
  executeBlock: () => Promise<void>;
}

export function AdminAvailability({ blocks: initialBlocks, onRefresh }: AdminAvailabilityProps) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barber, setBarber] = useState('');
  const [mode, setMode] = useState<BlockMode>('day_full');
  const [date, setDate] = useState(toISO(new Date()));
  const [endDate, setEndDate] = useState(toISO(new Date()));
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [blocks, setBlocks] = useState<BarberBlock[]>(initialBlocks ?? []);
  const [vacations, setVacations] = useState<BarberVacation[]>([]);
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);
  const [selectedTargetBarber, setSelectedTargetBarber] = useState<string>('adrian');
  const [nowState, setNowState] = useState(() => {
    const d = new Date();
    return {
      iso: toISO(d),
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    };
  });

  // Re-evaluar la hora actual cada 15 segundos para eliminar automáticamente al cumplirse la hora fin
  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setNowState({
        iso: toISO(d),
        time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchAllBarbers().then((b) => { setBarbers(b); if (b.length > 0) setBarber(b[0].id); });
  }, []);

  const fetchBlocks = useCallback(async () => {
    if (!barber) return;
    const { data } = await supabase
      .from('barber_blocks')
      .select('*')
      .eq('barber', barber)
      .order('block_date', { ascending: false })
      .order('created_at', { ascending: false });
    const list = (data as BarberBlock[]) ?? [];

    // Purgar de la base de datos cualquier bloqueo expirado de días o tramos anteriores
    const d = new Date();
    const curIso = toISO(d);
    const curTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const expiredIds = list.filter((b) => isBlockExpired(b, curIso, curTime)).map((b) => b.id);
    if (expiredIds.length > 0) {
      supabase.from('barber_blocks').delete().in('id', expiredIds).then(() => {});
    }

    setBlocks(list.filter((b) => !isBlockExpired(b, curIso, curTime)));
  }, [barber]);

  const fetchVacations = useCallback(async () => {
    if (!barber) return;
    const { data } = await supabase
      .from('barber_vacations')
      .select('*')
      .eq('barber', barber)
      .order('start_date', { ascending: false });
    const list = (data as BarberVacation[]) ?? [];

    // Purgar vacaciones ya finalizadas de la base de datos
    const d = new Date();
    const curIso = toISO(d);
    const curTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const expiredIds = list.filter((v) => isVacationExpired(v, curIso, curTime)).map((v) => v.id);
    if (expiredIds.length > 0) {
      supabase.from('barber_vacations').delete().in('id', expiredIds).then(() => {});
    }

    setVacations(list.filter((v) => !isVacationExpired(v, curIso, curTime)));
  }, [barber]);

  // Al cambiar el minuto actual, si algún bloqueo acaba de expirar, se borra de BD inmediatamente
  useEffect(() => {
    const expiredBlockIds = blocks
      .filter((b) => isBlockExpired(b, nowState.iso, nowState.time))
      .map((b) => b.id);
    if (expiredBlockIds.length > 0) {
      supabase.from('barber_blocks').delete().in('id', expiredBlockIds).then(() => {
        setBlocks((prev) => prev.filter((b) => !expiredBlockIds.includes(b.id)));
      });
    }

    const expiredVacIds = vacations
      .filter((v) => isVacationExpired(v, nowState.iso, nowState.time))
      .map((v) => v.id);
    if (expiredVacIds.length > 0) {
      supabase.from('barber_vacations').delete().in('id', expiredVacIds).then(() => {
        setVacations((prev) => prev.filter((v) => !expiredVacIds.includes(v.id)));
      });
    }
  }, [nowState, blocks, vacations]);

  const loadAvailability = useCallback(async () => {
    if (!barber) return;
    await Promise.all([fetchBlocks(), fetchVacations()]);
  }, [barber, fetchBlocks, fetchVacations]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    if (!barber) return;
    const channel = supabase
      .channel(`availability-${barber}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barber_blocks' }, () => fetchBlocks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barber_vacations' }, () => fetchVacations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [barber, fetchBlocks, fetchVacations]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barber) return;

    if (mode === 'time_range' && (!startTime || !endTime)) {
      notify.error('Datos incompletos', 'Debes seleccionar hora de inicio y fin.');
      return;
    }
    if (mode === 'vacation' && endDate < date) {
      notify.error('Fechas inválidas', 'La fecha fin no puede ser anterior a la fecha de inicio.');
      return;
    }

    setSaving(true);

    const executeInsertBlock = async () => {
      if (mode === 'day_full') {
        const { error } = await supabase.from('barber_blocks').insert({ barber, block_type: 'day_off', block_date: date, note: reason.trim() || null });
        if (error) throw error;
        notify.success('Día bloqueado', `Bloqueo para el ${date}`);
      } else if (mode === 'time_range') {
        const { error } = await supabase.from('barber_blocks').insert({ barber, block_type: 'time_range', block_date: date, block_start_time: startTime, block_end_time: endTime, note: reason.trim() || null });
        if (error) throw error;
        notify.success('Horario bloqueado', `${date} de ${startTime} a ${endTime}h`);
      } else if (mode === 'vacation') {
        const { error } = await supabase.from('barber_vacations').insert({ barber, start_date: date, end_date: endDate, reason: reason.trim() || null });
        if (error) throw error;
        notify.success('Vacaciones añadidas', `${date} al ${endDate}`);
      }
      setReason(''); setStartTime(''); setEndTime('');
      await loadAvailability();
      onRefresh?.();
    };

    try {
      // 1. Detectar si hay citas activas programadas que coincidan con este bloqueo
      let q = supabase
        .from('bookings')
        .select('*')
        .eq('barber', barber)
        .neq('status', 'cancelled');

      if (mode === 'day_full') {
        q = q.eq('booking_date', date);
      } else if (mode === 'time_range') {
        q = q.eq('booking_date', date);
      } else if (mode === 'vacation') {
        q = q.gte('booking_date', date).lte('booking_date', endDate);
      }

      const { data: existingBookings, error: qErr } = await q;
      if (qErr) throw qErr;

      let affected = (existingBookings as SavedBooking[]) || [];
      if (mode === 'time_range' && startTime && endTime) {
        const startMin = timeToMinutes(startTime);
        const endMin = timeToMinutes(endTime);
        affected = affected.filter((b) => {
          const bMin = timeToMinutes(b.booking_time);
          return bMin >= startMin && bMin < endMin;
        });
      }

      // 2. Si hay citas afectadas, requerir confirmación y reasignación preventiva
      if (affected.length > 0) {
        const currentBarberObj = barbers.find((b) => b.id === barber);
        const isCurrentAdrian = barber === 'adrian' || (currentBarberObj?.name.toLowerCase() || '').includes('adrian');
        const others = barbers.filter((b) => b.id !== barber && b.active !== false);
        const defaultTarget = isCurrentAdrian ? (others[0]?.id || '') : 'adrian';

        setSelectedTargetBarber(defaultTarget);
        setConflictState({
          affected,
          sourceBarberName: currentBarberObj?.name || barber,
          sourceBarberId: barber,
          isSourceAdrian: isCurrentAdrian,
          targetBarberId: defaultTarget,
          otherBarbers: others,
          executeBlock: executeInsertBlock,
        });
        setSaving(false);
        return;
      }

      // Si no hay citas afectadas, aplicar bloqueo directamente
      await executeInsertBlock();
    } catch (err: any) {
      console.error('Error al guardar bloqueo:', err);
      notify.error('Error al guardar', err?.message || 'No se pudo aplicar el bloqueo');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmReassignment = async () => {
    if (!conflictState) return;
    const targetId = selectedTargetBarber;
    if (!targetId) {
      notify.error('Selecciona un barbero', 'Debes indicar a qué barbero reasignar las citas.');
      return;
    }

    setSaving(true);
    try {
      const bookingIds = conflictState.affected.map((b) => b.id);
      const { error: reassignErr } = await supabase
        .from('bookings')
        .update({ barber: targetId })
        .in('id', bookingIds);

      if (reassignErr) {
        const msg = reassignErr.message || '';
        if (msg.includes('idx_bookings_unique_active_slot') || msg.includes('unique')) {
          throw new Error('El barbero destino ya tiene una cita reservada a la misma fecha y hora que una de las citas a reasignar. Por favor, selecciona otro barbero disponible o gestiona esa cita individualmente.');
        }
        throw reassignErr;
      }

      // Aplicar el bloqueo
      await conflictState.executeBlock();

      const targetBarberName = barbers.find((b) => b.id === targetId)?.name || targetId;
      notify.success(
        'Bloqueo y reasignación completados',
        `${bookingIds.length} ${bookingIds.length === 1 ? 'cita reasignada' : 'citas reasignadas'} a ${targetBarberName}`
      );
      setConflictState(null);
    } catch (err: any) {
      console.error('Error al reasignar citas y bloquear:', err);
      notify.error('Error en reasignación', err?.message || 'No se pudieron reasignar las citas.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = async (id: string) => {
    try {
      const { error } = await supabase.from('barber_blocks').delete().eq('id', id);
      if (error) throw error;
      notify.success('Bloqueo eliminado', 'El tramo vuelve a estar disponible');
      await fetchBlocks();
      onRefresh?.();
    } catch (err: any) {
      notify.error('Error al eliminar', err?.message || 'No se pudo eliminar el bloqueo');
    }
  };

  const handleDeleteVacation = async (id: string) => {
    try {
      const { error } = await supabase.from('barber_vacations').delete().eq('id', id);
      if (error) throw error;
      notify.success('Vacaciones eliminadas', 'Se ha eliminado el período');
      await fetchVacations();
      onRefresh?.();
    } catch (err: any) {
      notify.error('Error al eliminar', err?.message || 'No se pudo eliminar las vacaciones');
    }
  };

  const modeButtons: { id: BlockMode; label: string; icon: typeof CalendarOff }[] = [
    { id: 'day_full', label: 'Día completo', icon: CalendarOff },
    { id: 'time_range', label: 'Rango horario', icon: Clock },
    { id: 'vacation', label: 'Vacaciones', icon: Plane },
  ];

  const activeBlocks = useMemo(
    () =>
      blocks.filter(
        (b) =>
          (b.block_type === 'day_off' || b.block_type === 'time_range') &&
          !isBlockExpired(b, nowState.iso, nowState.time)
      ),
    [blocks, nowState]
  );

  const activeVacations = useMemo(
    () => vacations.filter((v) => !isVacationExpired(v, nowState.iso, nowState.time)),
    [vacations, nowState]
  );

  return (
    <div className="mx-auto max-w-xl w-full min-w-0 space-y-5">
      <form onSubmit={handleAdd} className="rounded-3xl glass-card p-4 sm:p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">Bloquear disponibilidad</p>

        <div>
          <label className="mb-1.5 block text-xs text-zinc-500">Barbero</label>
          <div className="flex flex-wrap gap-2">
            {barbers.map((b) => (
              <button key={b.id} type="button" onClick={() => setBarber(b.id)}
                className={`flex-1 min-w-[80px] truncate rounded-xl py-2 sm:py-2.5 px-2 text-xs sm:text-sm font-medium transition-all ${
                  barber === b.id ? 'gold-gradient text-black' : 'glass-card text-zinc-400 hover:text-white'
                }`}>{b.name}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-zinc-500">Tipo de bloqueo</label>
          <div className="grid grid-cols-3 gap-2">
            {modeButtons.map((m) => {
              const Icon = m.icon;
              return (
                <button key={m.id} type="button" onClick={() => setMode(m.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl py-3 text-[0.65rem] font-medium transition-all ${
                    mode === m.id ? 'gold-gradient text-black' : 'glass-card text-zinc-400 hover:text-white'
                  }`}>
                  <Icon className="h-4 w-4" />{m.label}
                </button>
              );
            })}
          </div>
        </div>

        {mode !== 'vacation' && (
          <div>
            <label className="mb-1.5 block text-xs text-zinc-500">Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white focus:border-gold/30 focus:outline-none [color-scheme:dark]" />
          </div>
        )}

        {mode === 'vacation' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1.5 block text-xs text-zinc-500">Desde</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white focus:border-gold/30 focus:outline-none [color-scheme:dark]" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-zinc-500">Hasta</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white focus:border-gold/30 focus:outline-none [color-scheme:dark]" />
            </div>
          </div>
        )}

        {mode === 'time_range' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1.5 block text-xs text-zinc-500">Hora inicio</label>
              <select
                value={startTime}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setStartTime(newStart);
                  if (endTime && newStart && endTime <= newStart) {
                    const nextEnd = BLOCK_END_SLOTS.find((s) => s > newStart);
                    setEndTime(nextEnd ?? '');
                  }
                }}
                className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white focus:border-gold/30 focus:outline-none"
              >
                <option value="" className="bg-zinc-900">Inicio</option>
                {BLOCK_START_SLOTS.map((s) => (
                  <option key={s} value={s} className="bg-zinc-900">{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-zinc-500">Hora fin</label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white focus:border-gold/30 focus:outline-none"
              >
                <option value="" className="bg-zinc-900">Fin (hasta cierre 20:30)</option>
                {(startTime
                  ? BLOCK_END_SLOTS.filter((s) => s > startTime)
                  : BLOCK_END_SLOTS
                ).map((s) => (
                  <option key={s} value={s} className="bg-zinc-900">
                    {s === '20:30' ? '20:30 (Cierre tarde)' : s === '13:30' ? '13:30 (Cierre mañana)' : s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs text-zinc-500">Nota (opcional)</label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. Vacaciones, descanso, etc."
            className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none" />
        </div>

        <button type="submit" disabled={saving || (mode === 'time_range' && (!startTime || !endTime))}
          className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
            !(mode === 'time_range' && (!startTime || !endTime)) ? 'gold-gradient text-black hover:brightness-110 active:scale-[0.98]' : 'bg-white/5 text-zinc-600'
          }`}>
          {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <CalendarOff className="h-4 w-4" />}
          Bloquear
        </button>
      </form>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">Bloqueos activos</p>
        {activeBlocks.length === 0 && activeVacations.length === 0 ? (
          <div className="rounded-3xl glass-card px-5 py-8 text-center">
            <CalendarOff className="mx-auto h-7 w-7 text-zinc-600" />
            <p className="mt-2 text-sm text-zinc-500">No hay bloqueos activos de disponibilidad.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeVacations.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-2xl glass-card p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/5 text-gold"><Plane className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">Vacaciones</p>
                  <p className="text-xs text-zinc-500">{v.start_date} → {v.end_date}{v.reason ? ` — ${v.reason}` : ''}</p>
                </div>
                <button onClick={() => handleDeleteVacation(v.id)} aria-label="Eliminar"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {activeBlocks.map((b) => (
              <div key={b.id} className="flex items-center gap-3 rounded-2xl glass-card p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/5 text-gold">
                  {b.block_type === 'time_range' ? <Clock className="h-4 w-4" /> : <CalendarOff className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{b.block_type === 'time_range' ? 'Rango horario' : 'Día completo'}</p>
                  <p className="text-xs text-zinc-500">{b.block_date}{b.block_type === 'time_range' ? ` · ${b.block_start_time}–${b.block_end_time}` : ''}{b.note ? ` — ${b.note}` : ''}</p>
                </div>
                <button onClick={() => handleDeleteBlock(b.id)} aria-label="Eliminar"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de advertencia de citas afectadas y reasignación */}
      {conflictState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in"
            onClick={() => { if (!saving) setConflictState(null); }}
          />
          <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl border border-amber-500/30 bg-zinc-900/95 p-5 sm:p-6 shadow-2xl backdrop-blur-xl animate-scale-in">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-white">
                    Citas afectadas por el bloqueo ({conflictState.affected.length})
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {conflictState.sourceBarberName} tiene reservas en este tramo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { if (!saving) setConflictState(null); }}
                className="rounded-full p-1 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content info & reassignment selector */}
            <div className="my-4 space-y-3.5 overflow-y-auto pr-1 text-xs">
              {conflictState.isSourceAdrian ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
                  <p className="font-semibold text-amber-300">
                    Adrián Millán no estará disponible en este período.
                  </p>
                  <p className="text-zinc-300 text-[0.75rem] leading-relaxed">
                    Para no dejar estas citas desatendidas, selecciona qué otro barbero del equipo las asumirá:
                  </p>
                  {conflictState.otherBarbers.length === 0 ? (
                    <p className="text-red-400 text-xs font-semibold">
                      No hay otros barberos activos disponibles en el sistema. Cancela o reprograma las citas individualmente.
                    </p>
                  ) : (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {conflictState.otherBarbers.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedTargetBarber(b.id)}
                          className={`flex items-center gap-2.5 rounded-xl p-2.5 text-left transition-all ${
                            selectedTargetBarber === b.id
                              ? 'border border-gold bg-gold/15 text-white font-bold'
                              : 'border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                          }`}
                        >
                          {b.photo_url ? (
                            <img src={b.photo_url} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full gold-gradient text-[0.6rem] font-bold text-black">
                              {b.initials}
                            </div>
                          )}
                          <span className="truncate text-xs">{b.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-gold/30 bg-gold/10 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-gold font-bold">
                    <UserCheck className="h-4 w-4" />
                    <span>Reasignación automática a Adrián Millán</span>
                  </div>
                  <p className="text-zinc-300 text-[0.75rem] leading-relaxed">
                    Las citas de <strong>{conflictState.sourceBarberName}</strong> se reasignarán automáticamente a <strong>Adrián Millán</strong> para que los clientes sean atendidos sin contratiempos.
                  </p>
                </div>
              )}

              {/* Lista de citas afectadas */}
              <div className="space-y-2">
                <p className="text-[0.65rem] uppercase tracking-wider font-semibold text-zinc-500">
                  Detalle de citas a reasignar ({conflictState.affected.length})
                </p>
                <div className="max-h-[35vh] space-y-2 overflow-y-auto pr-1">
                  {conflictState.affected.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
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
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => setConflictState(null)}
                className="w-full sm:w-auto rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving || (conflictState.isSourceAdrian && conflictState.otherBarbers.length === 0)}
                onClick={handleConfirmReassignment}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl gold-gradient px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-black hover:brightness-110 active:scale-95 transition-all shadow-md disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    <span>Reasignando y bloqueando...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>Reasignar citas y bloquear</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
