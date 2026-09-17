import { supabase } from '@/lib/supabase';
import type { PendingBookingPayload } from '@/lib/pendingBooking';
import type { SavedBooking } from '@/types';

const LAST_BOOKING_KEY = 'amm_last_booking_ts';

export async function createBooking(payload: PendingBookingPayload): Promise<{ booking: SavedBooking | null; error: string | null }> {
  // 1. Client-side cooldown guard (prevent rapid double-clicks or bot flooding)
  try {
    const lastTs = sessionStorage.getItem(LAST_BOOKING_KEY);
    if (lastTs && (Date.now() - parseInt(lastTs, 10)) < 15000) {
      return {
        booking: null,
        error: 'Has realizado una reserva recientemente. Por favor, espera unos segundos antes de solicitar otra.',
      };
    }
  } catch {
    // ignore sessionStorage errors
  }

  // 2. Pre-check if an active booking already exists for this exact slot
  try {
    const preExisting = await findExistingBooking(payload.barber, payload.booking_date, payload.booking_time);
    if (preExisting) {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;
      const cleanPayloadPhone = payload.phone.replace(/\D/g, '');
      const cleanExistingPhone = (preExisting.phone || '').replace(/\D/g, '');

      // If it is the current user's own booking (double submission / re-entry), return it idempotently
      if (
        (currentUserId && preExisting.user_id === currentUserId) ||
        (cleanPayloadPhone && cleanExistingPhone && cleanPayloadPhone === cleanExistingPhone)
      ) {
        return { booking: preExisting, error: null };
      }

      return {
        booking: null,
        error: 'El horario seleccionado ya no está disponible. Por favor, elige otra hora.',
      };
    }
  } catch {
    // proceed to RPC if check fails
  }

  // Proactively check session to ensure token is fresh
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      const expiresAt = sessionData.session.expires_at;
      if (expiresAt && (expiresAt * 1000 - Date.now() < 60000)) {
        await supabase.auth.refreshSession();
      }
    }
  } catch {
    // Ignore and proceed to call RPC
  }

  const callRpc = async () => {
    return await supabase.rpc('create_booking', {
      p_service: payload.service,
      p_service_price: payload.service_price,
      p_barber: payload.barber,
      p_booking_date: payload.booking_date,
      p_booking_time: payload.booking_time,
      p_full_name: payload.full_name,
      p_phone: payload.phone,
      p_comments: payload.comments ?? '',
    });
  };

  let res = await callRpc();

  // If first attempt fails (e.g. stale JWT, cold start, or network delay),
  // refresh session and retry once transparently before throwing error
  if (res.error) {
    console.warn('create_booking attempt 1 failed:', res.error.message, '- reintentando automáticamente...');
    try {
      await supabase.auth.refreshSession();
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 250));
    res = await callRpc();
  }

  // If RPC failed (e.g. 404 function signature mismatch in schema cache),
  // fallback directly to standard RLS insert which authenticated clients have permission for
  if (res.error) {
    console.warn('create_booking RPC failed, attempting direct table insert fallback...', res.error);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id ?? null;
    const userEmail = sessionData?.session?.user?.email ?? null;

    if (userId) {
      // Double check if booking was already created
      const existing = await findExistingBooking(payload.barber, payload.booking_date, payload.booking_time);
      if (existing) {
        return { booking: existing, error: null };
      }

      const { data: inserted, error: insertError } = await supabase
        .from('bookings')
        .insert({
          service: payload.service,
          service_price: payload.service_price,
          barber: payload.barber,
          booking_date: payload.booking_date,
          booking_time: payload.booking_time,
          full_name: payload.full_name.trim(),
          phone: payload.phone.trim(),
          email: userEmail,
          comments: payload.comments?.trim() || null,
          status: 'pending',
          user_id: userId,
        })
        .select('*')
        .single();

        if (!insertError && inserted) {
        // Opportunistically save or update customer details
        try {
          await supabase.from('customers').upsert({
            user_id: userId,
            full_name: payload.full_name.trim(),
            phone: payload.phone.trim(),
            email: userEmail,
            comments: payload.comments?.trim() || null,
            updated_at: new Date().toISOString(),
          });
        } catch {
          // ignore
        }
        try {
          sessionStorage.setItem(LAST_BOOKING_KEY, String(Date.now()));
        } catch {
          // ignore
        }
        return { booking: inserted as SavedBooking, error: null };
      }
    }

    // Double check if booking was actually created despite error response
    const existing = await findExistingBooking(payload.barber, payload.booking_date, payload.booking_time);
    if (existing) {
      try {
        sessionStorage.setItem(LAST_BOOKING_KEY, String(Date.now()));
      } catch {
        // ignore
      }
      return { booking: existing, error: null };
    }

    const rawError = res.error.message || '';
    if (rawError.includes('idx_bookings_unique_active_slot') || rawError.includes('ya está reservado')) {
      return { booking: null, error: 'El horario seleccionado ya no está disponible. Por favor, elige otra hora.' };
    }
    return { booking: null, error: rawError || 'No se pudo confirmar la reserva. Inténtalo de nuevo.' };
  }

  // Robust parsing of res.data across all possible Supabase response formats
  let resolvedBooking: SavedBooking | null = null;
  const raw = res.data;

  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw) && raw.length > 0) {
      resolvedBooking = raw[0] as SavedBooking;
    } else if ('booking_date' in raw) {
      resolvedBooking = raw as SavedBooking;
    }
  } else if (typeof raw === 'string' && raw.length > 10) {
    // raw is the UUID of the newly created booking
    const { data: byId } = await supabase.from('bookings').select('*').eq('id', raw).maybeSingle();
    if (byId) resolvedBooking = byId as SavedBooking;
  }

  if (!resolvedBooking) {
    resolvedBooking = await findExistingBooking(payload.barber, payload.booking_date, payload.booking_time);
  }

  if (!resolvedBooking) {
    // Fallback: construct guaranteed SavedBooking from validated payload
    const { data: sessionData } = await supabase.auth.getSession();
    resolvedBooking = {
      id: typeof raw === 'string' ? raw : (crypto.randomUUID ? crypto.randomUUID() : `b-${Date.now()}`),
      service: payload.service,
      service_price: payload.service_price,
      barber: payload.barber,
      booking_date: payload.booking_date,
      booking_time: payload.booking_time,
      full_name: payload.full_name,
      phone: payload.phone,
      email: sessionData?.session?.user?.email ?? null,
      user_id: sessionData?.session?.user?.id ?? null,
      comments: payload.comments ?? null,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
  }

  if (resolvedBooking) {
    try {
      sessionStorage.setItem(LAST_BOOKING_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }

  return { booking: resolvedBooking, error: null };
}

export async function findExistingBooking(
  barber: string,
  bookingDate: string,
  bookingTime: string
): Promise<SavedBooking | null> {
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('barber', barber)
    .eq('booking_date', bookingDate)
    .eq('booking_time', bookingTime)
    .neq('status', 'cancelled')
    .maybeSingle();
  return (data as SavedBooking) ?? null;
}
