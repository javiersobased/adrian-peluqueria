import { supabase } from '@/lib/supabase';
import type { PendingBookingPayload } from '@/lib/pendingBooking';
import type { SavedBooking } from '@/types';

export async function createBooking(payload: PendingBookingPayload): Promise<{ booking: SavedBooking | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_booking', {
    p_service: payload.service,
    p_service_price: payload.service_price,
    p_barber: payload.barber,
    p_booking_date: payload.booking_date,
    p_booking_time: payload.booking_time,
    p_full_name: payload.full_name,
    p_phone: payload.phone,
    p_comments: payload.comments ?? '',
  });

  if (error) return { booking: null, error: error.message };
  return { booking: data as SavedBooking, error: null };
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
