import { supabase } from '@/lib/supabase';
import type { SavedBooking } from '@/types';
import { toISO, isCancelledBookingExpired } from '@/lib/schedule';

export const TEST_EMAILS = [
  'javijunior2018@gmail.com',
  'franciscojavierfarinapadilla@gmail.com',
  'javiersobased@gmail.com',
];

export async function fetchMyBookings(
  userId?: string | null,
  userEmail?: string | null
): Promise<SavedBooking[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const currentUserId = userId || sessionData.session?.user?.id;
  const currentEmail = (userEmail || sessionData.session?.user?.email)?.toLowerCase().trim();

  if (!currentUserId && !currentEmail) {
    return [];
  }

  // If the logged-in email is one of the test accounts, purge any test bookings
  if (currentEmail && TEST_EMAILS.includes(currentEmail)) {
    try {
      await supabase.from('bookings').delete().ilike('email', currentEmail);
    } catch { /* ignore */ }
    return [];
  }

  let query = supabase
    .from('bookings')
    .select('*')
    .order('booking_date', { ascending: true })
    .order('booking_time', { ascending: true });

  // Query appointments strictly for this user (by user_id or email)
  if (currentUserId && currentEmail) {
    query = query.or(`user_id.eq.${currentUserId},email.ilike.${currentEmail}`);
  } else if (currentUserId) {
    query = query.eq('user_id', currentUserId);
  } else if (currentEmail) {
    query = query.ilike('email', currentEmail);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error al cargar mis citas:', error);
    return [];
  }

  // Strict double-check filter: NEVER show other customers' bookings or test emails in "Mis Citas"
  const list = (data as SavedBooking[]) ?? [];

  // Mantener citas en BD para preservar el historial del cliente
  const d = new Date();
  const curIso = toISO(d);
  const curTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return list.filter((b) => {
    if (b.email && TEST_EMAILS.includes(b.email.toLowerCase().trim())) {
      return false;
    }
    if (isCancelledBookingExpired(b, curIso, curTime)) {
      return false;
    }
    const matchId = currentUserId && b.user_id === currentUserId;
    const matchEmail = currentEmail && b.email && b.email.toLowerCase().trim() === currentEmail;
    return Boolean(matchId || matchEmail);
  });
}

export async function rescheduleBooking(
  bookingId: string,
  newDate: string,
  newTime: string
): Promise<{ booking: SavedBooking | null; error: string | null }> {
  const { data, error } = await supabase.rpc('reschedule_booking', {
    p_booking_id: bookingId,
    p_new_date: newDate,
    p_new_time: newTime,
  });

  if (error) return { booking: null, error: error.message };
  return { booking: data as SavedBooking, error: null };
}