import { supabase } from '@/lib/supabase';
import type { SavedBooking } from '@/types';

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

  // Strict double-check filter: NEVER show other customers' bookings in "Mis Citas", even for admins
  const list = (data as SavedBooking[]) ?? [];
  return list.filter((b) => {
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