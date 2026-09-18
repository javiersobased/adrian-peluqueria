import { supabase } from '@/lib/supabase';
import type { Barber, SavedBooking, BarberBlock, BarberVacation, BarberSchedule } from '@/types';
import { timeToMinutes } from '@/lib/schedule';
import { fetchAllBarbers } from '@/data/services';
import { notifyBookingRescheduled, notifyBookingCancelled } from '@/lib/notifications';

export interface ReassignmentAttempt {
  barberId: string;
  barberName: string;
  available: boolean;
  reason?: string;
}

export interface ReassignmentDecision {
  booking: SavedBooking;
  action: 'reassign' | 'cancel';
  targetBarberId?: string;
  targetBarberName?: string;
  reason: string;
  attempts: ReassignmentAttempt[];
}

/**
 * Calcula la reasignación en cascada para un grupo de citas afectadas.
 * Regla:
 * 1. Intenta reasignar la cita a los barberos activos disponibles en orden (primero Adrián o el preferente).
 * 2. Comprueba en tiempo real: vacaciones, días libres, horario laboral, bloqueos y citas ya reservadas.
 * 3. Si un barbero está ocupado o bloqueado a esa hora, pasa al siguiente.
 * 4. Si ningún barbero del equipo está libre a esa hora, la cita se marca para cancelación automática.
 */
export async function planCascadingReassignments(
  affectedBookings: SavedBooking[],
  sourceBarberId: string,
  preferredBarberId?: string
): Promise<ReassignmentDecision[]> {
  if (!affectedBookings || affectedBookings.length === 0) return [];

  // 1. Obtener todos los barberos activos del equipo excepto el barbero origen
  const allBarbers = await fetchAllBarbers();
  const candidateBarbers = allBarbers.filter(
    (b) => b.id !== sourceBarberId && b.active !== false
  );

  // Ordenar candidatos: preferredBarberId primero si existe, si no Adrián primero, luego el resto
  candidateBarbers.sort((a, b) => {
    if (preferredBarberId) {
      if (a.id === preferredBarberId) return -1;
      if (b.id === preferredBarberId) return 1;
    }
    const isAdrianA = a.id === 'adrian' || a.name.toLowerCase().includes('adrian');
    const isAdrianB = b.id === 'adrian' || b.name.toLowerCase().includes('adrian');
    if (isAdrianA && !isAdrianB) return -1;
    if (!isAdrianA && isAdrianB) return 1;
    return 0;
  });

  // Si no hay candidatos posibles en el equipo, todas las citas deben cancelarse
  if (candidateBarbers.length === 0) {
    return affectedBookings.map((b) => ({
      booking: b,
      action: 'cancel',
      reason: 'No hay otros barberos disponibles en el equipo',
      attempts: [],
    }));
  }

  const candidateIds = candidateBarbers.map((b) => b.id);
  const affectedDates = Array.from(new Set(affectedBookings.map((b) => b.booking_date)));

  // 2. Consultar en paralelo los datos de disponibilidad de todos los candidatos
  const [bookingsRes, blocksRes, vacationsRes, schedulesRes, servicesRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, barber, full_name, booking_date, booking_time, service')
      .in('barber', candidateIds)
      .in('booking_date', affectedDates)
      .neq('status', 'cancelled'),
    supabase
      .from('barber_blocks')
      .select('*')
      .in('barber', candidateIds),
    supabase
      .from('barber_vacations')
      .select('*')
      .in('barber', candidateIds),
    supabase
      .from('barber_schedules')
      .select('*'),
    supabase
      .from('services')
      .select('name, duration_minutes, duration'),
  ]);

  const existingBookings = (bookingsRes.data as SavedBooking[]) || [];
  const allBlocks = (blocksRes.data as BarberBlock[]) || [];
  const allVacations = (vacationsRes.data as BarberVacation[]) || [];
  const allSchedules = (schedulesRes.data as (BarberSchedule & { barber_id?: string })[]) || [];
  const allServices = servicesRes.data || [];

  // Mapa de duración de servicios
  const serviceDurationMap = new Map<string, number>();
  allServices.forEach((s) => {
    let dur = 30;
    if (s.duration_minutes && s.duration_minutes > 0) {
      dur = s.duration_minutes;
    } else if (s.duration) {
      const m = s.duration.match(/\d+/);
      if (m) {
        const parsed = parseInt(m[0], 10);
        if (!isNaN(parsed) && parsed > 0) dur = parsed;
      }
    }
    serviceDurationMap.set(s.name.toLowerCase().trim(), dur);
  });

  const getServiceDuration = (servName?: string | null): number => {
    if (!servName) return 30;
    return serviceDurationMap.get(servName.toLowerCase().trim()) || 30;
  };

  // Mapa en memoria para ir registrando citas ocupadas (tanto previas como recién asignadas en la cascada)
  // Clave: `${barberId}:${date}` -> Array de { startMin, endMin, clientName, time }
  const occupiedSlotsMap = new Map<
    string,
    { startMin: number; endMin: number; clientName: string; time: string }[]
  >();

  existingBookings.forEach((b) => {
    const key = `${b.barber}:${b.booking_date}`;
    const startMin = timeToMinutes(b.booking_time);
    const dur = getServiceDuration(b.service);
    const endMin = startMin + dur;
    if (!occupiedSlotsMap.has(key)) {
      occupiedSlotsMap.set(key, []);
    }
    occupiedSlotsMap.get(key)!.push({
      startMin,
      endMin,
      clientName: b.full_name,
      time: b.booking_time,
    });
  });

  // Ordenar citas afectadas por fecha y hora cronológica
  const sortedBookings = [...affectedBookings].sort((a, b) => {
    if (a.booking_date !== b.booking_date) {
      return a.booking_date.localeCompare(b.booking_date);
    }
    return a.booking_time.localeCompare(b.booking_time);
  });

  const decisions: ReassignmentDecision[] = [];

  for (const booking of sortedBookings) {
    const bDate = booking.booking_date;
    const bTime = booking.booking_time;
    const bDur = getServiceDuration(booking.service);
    const bStartMin = timeToMinutes(bTime);
    const bEndMin = bStartMin + bDur;

    const dateObj = new Date(bDate + 'T12:00:00');
    const weekday = dateObj.getDay(); // 0 = Domingo, 1 = Lunes, ... 6 = Sábado

    const attempts: ReassignmentAttempt[] = [];
    let assignedBarber: Barber | null = null;

    for (const cand of candidateBarbers) {
      // 1. Vacaciones
      const onVac = allVacations.some(
        (v) => v.barber === cand.id && v.start_date <= bDate && v.end_date >= bDate
      );
      if (onVac) {
        attempts.push({ barberId: cand.id, barberName: cand.name, available: false, reason: 'De vacaciones' });
        continue;
      }

      // 2. Día libre completo
      const isDayOff = allBlocks.some(
        (b) => b.barber === cand.id && b.block_type === 'day_off' && b.block_date === bDate
      );
      if (isDayOff) {
        attempts.push({ barberId: cand.id, barberName: cand.name, available: false, reason: 'Día libre' });
        continue;
      }

      // 3. Descanso semanal
      const isWeeklyOff = allBlocks.some(
        (b) => b.barber === cand.id && b.block_type === 'weekly_off' && b.weekday === weekday
      );
      if (isWeeklyOff) {
        attempts.push({ barberId: cand.id, barberName: cand.name, available: false, reason: 'Descanso semanal' });
        continue;
      }

      // 4. Horario laboral y turnos
      const candSched = allSchedules.find(
        (s) => (s.barber === cand.id || s.barber_id === cand.id) && s.weekday === weekday
      );

      if (candSched) {
        if (!candSched.is_working) {
          attempts.push({ barberId: cand.id, barberName: cand.name, available: false, reason: 'No trabaja este día' });
          continue;
        }

        const mStart = candSched.morning_start ? timeToMinutes(candSched.morning_start) : null;
        const mEnd = candSched.morning_end ? timeToMinutes(candSched.morning_end) : null;
        const aStart = candSched.afternoon_start ? timeToMinutes(candSched.afternoon_start) : null;
        const aEnd = candSched.afternoon_end ? timeToMinutes(candSched.afternoon_end) : null;

        const inMorning = mStart !== null && mEnd !== null && bStartMin >= mStart && bEndMin <= mEnd;
        const inAfternoon = aStart !== null && aEnd !== null && bStartMin >= aStart && bEndMin <= aEnd;

        if (!inMorning && !inAfternoon) {
          attempts.push({ barberId: cand.id, barberName: cand.name, available: false, reason: 'Fuera de turno laboral' });
          continue;
        }
      } else {
        // Fallback estándar si no hay configuración de horario específica
        if (weekday === 0) {
          attempts.push({ barberId: cand.id, barberName: cand.name, available: false, reason: 'Cerrado en domingo' });
          continue;
        }
        const defMStart = timeToMinutes('09:30');
        const defMEnd = timeToMinutes('13:30');
        const defAStart = timeToMinutes('16:30');
        const defAEnd = timeToMinutes('20:30');
        const inMorning = bStartMin >= defMStart && bEndMin <= defMEnd;
        const inAfternoon = bStartMin >= defAStart && bEndMin <= defAEnd;

        if (!inMorning && !inAfternoon) {
          attempts.push({ barberId: cand.id, barberName: cand.name, available: false, reason: 'Fuera de horario laboral' });
          continue;
        }
      }

      // 5. Bloqueos por rango de horas
      const timeBlocks = allBlocks.filter(
        (b) => b.barber === cand.id && b.block_type === 'time_range' && b.block_date === bDate && b.block_start_time && b.block_end_time
      );
      const hasBlockConflict = timeBlocks.some((tb) => {
        const s = timeToMinutes(tb.block_start_time!);
        let e = timeToMinutes(tb.block_end_time!);
        if (tb.block_end_time === '20:00') e = timeToMinutes('20:30');
        if (tb.block_end_time === '13:00' && tb.block_start_time === '09:30') e = timeToMinutes('13:30');
        return Math.max(bStartMin, s) < Math.min(bEndMin, e);
      });
      if (hasBlockConflict) {
        attempts.push({ barberId: cand.id, barberName: cand.name, available: false, reason: 'Horario bloqueado' });
        continue;
      }

      // 6. Solapamiento con citas existentes o ya asignadas en esta ejecución
      const candKey = `${cand.id}:${bDate}`;
      const occupied = occupiedSlotsMap.get(candKey) || [];
      const conflict = occupied.find((occ) => {
        // Mismo slot exacto de hora o solapamiento de intervalos
        return occ.time === bTime || Math.max(bStartMin, occ.startMin) < Math.min(bEndMin, occ.endMin);
      });

      if (conflict) {
        attempts.push({
          barberId: cand.id,
          barberName: cand.name,
          available: false,
          reason: `Ocupado con ${conflict.clientName || 'otra cita'}`,
        });
        continue;
      }

      // Barbero disponible encontrado
      attempts.push({ barberId: cand.id, barberName: cand.name, available: true });
      assignedBarber = cand;

      // Registrar inmediatamente la cita en el mapa para evitar solapamientos con citas posteriores
      if (!occupiedSlotsMap.has(candKey)) {
        occupiedSlotsMap.set(candKey, []);
      }
      occupiedSlotsMap.get(candKey)!.push({
        startMin: bStartMin,
        endMin: bEndMin,
        clientName: booking.full_name,
        time: bTime,
      });

      break;
    }

    if (assignedBarber) {
      const busyBefore = attempts.filter((a) => !a.available);
      let explanation = `Reasignado a ${assignedBarber.name}`;
      if (busyBefore.length > 0) {
        const busyNames = busyBefore.map((a) => a.barberName).join(', ');
        explanation = `Reasignado a ${assignedBarber.name} (${busyNames} no disponible${busyBefore.length > 1 ? 's' : ''})`;
      }

      decisions.push({
        booking,
        action: 'reassign',
        targetBarberId: assignedBarber.id,
        targetBarberName: assignedBarber.name,
        reason: explanation,
        attempts,
      });
    } else {
      decisions.push({
        booking,
        action: 'cancel',
        reason: 'Ningún barbero del equipo está libre en este horario',
        attempts,
      });
    }
  }

  return decisions;
}

/**
 * Ejecuta en base de datos las decisiones calculadas por la cascada y envía las notificaciones por email.
 */
export async function executeCascadingDecisions(
  decisions: ReassignmentDecision[],
  sourceBarber?: Barber | null,
  allBarbers?: Barber[]
): Promise<{ reassignedCount: number; cancelledCount: number }> {
  let reassignedCount = 0;
  let cancelledCount = 0;

  for (const decision of decisions) {
    const { booking, action, targetBarberId, targetBarberName } = decision;

    if (action === 'reassign' && targetBarberId) {
      const { error } = await supabase
        .from('bookings')
        .update({ barber: targetBarberId })
        .eq('id', booking.id);

      if (error) {
        console.error(`[CascadingReassignment] Error al reasignar cita ${booking.id} a ${targetBarberId}:`, error);
        throw error;
      }
      reassignedCount++;

      const targetBarberObj = allBarbers?.find((b) => b.id === targetBarberId) || null;
      notifyBookingRescheduled(
        { ...booking, barber: targetBarberId },
        booking.booking_date,
        booking.booking_time,
        `Reasignación de profesional por indisponibilidad (${targetBarberName || targetBarberId})`,
        targetBarberObj
      ).catch((err) => console.warn('[CascadingReassignment] Error notificando reasignación:', err));
    } else if (action === 'cancel') {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id);

      if (error) {
        console.error(`[CascadingReassignment] Error al cancelar cita ${booking.id}:`, error);
        throw error;
      }
      cancelledCount++;

      notifyBookingCancelled(
        { ...booking, status: 'cancelled' },
        sourceBarber,
        'Indisponibilidad de personal y sin hueco libre alternativo en el equipo para este horario'
      ).catch((err) => console.warn('[CascadingReassignment] Error notificando cancelación:', err));
    }
  }

  return { reassignedCount, cancelledCount };
}

/**
 * Cancela todas las citas afectadas de forma masiva (opción de emergencia / borrado total).
 */
export async function cancelAllAffectedBookings(
  bookings: SavedBooking[],
  sourceBarber?: Barber | null,
  reason: string = 'Indisponibilidad de horario del barbero'
): Promise<number> {
  if (!bookings || bookings.length === 0) return 0;
  const ids = bookings.map((b) => b.id);

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .in('id', ids);

  if (error) throw error;

  await Promise.allSettled(
    bookings.map((b) =>
      notifyBookingCancelled({ ...b, status: 'cancelled' }, sourceBarber, reason)
    )
  );

  return ids.length;
}
