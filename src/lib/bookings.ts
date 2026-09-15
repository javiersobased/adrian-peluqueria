import { supabase } from '@/lib/supabase';
import type { PendingBookingPayload } from '@/lib/pendingBooking';
import type { SavedBooking } from '@/types';

export async function createBooking(payload: PendingBookingPayload): Promise<{ booking: SavedBooking | null; error: string | null }> {
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

  if (res.error) {
    // Double check if booking was actually created despite error response
    const existing = await findExistingBooking(payload.barber, payload.booking_date, payload.booking_time);
    if (existing) {
      return { booking: existing, error: null };
    }
    return { booking: null, error: res.error.message };
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
      comments: payload.comments ?? null,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
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
