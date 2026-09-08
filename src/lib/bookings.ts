import { supabase } from '@/lib/supabase';
import type { SavedBooking } from '@/types';
import type { PendingBookingPayload } from '@/lib/pendingBooking';

export async function insertBooking(payload: PendingBookingPayload, userId: string): Promise<SavedBooking> {
  const { data, error } = await supabase
    .from('bookings')
    .insert({ ...payload, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data as SavedBooking;
}
