import { supabase } from '@/lib/supabase';
import type { SavedBooking } from '@/types';

export async function fetchMyBookings(): Promise<SavedBooking[]> {
  // RLS already restricts this to the signed-in customer's own rows.
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('booking_date', { ascending: true })
    .order('booking_time', { ascending: true });

  if (error) {
    console.error('Error al cargar mis citas:', error);
    return [];
  }
  return (data as SavedBooking[]) ?? [];
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