import { supabase } from '@/lib/supabase';
import { getCurrentBusinessId } from '@/lib/tenant';
import type { SavedBooking } from '@/types';

// TODO: Implement Edge Function URL — replace with your deployed Supabase Edge Function endpoint
const EMAIL_EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/send-booking-email`;

export async function sendBookingEmail(
  booking: SavedBooking,
  barberEmail?: string | null,
  barberName?: string | null
): Promise<void> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    await fetch(EMAIL_EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({
        booking,
        booking_id: booking.id,
        business_id: getCurrentBusinessId(),
        barber_email: barberEmail || null,
        barber_name: barberName || null,
      }),
    });
  } catch (e) {
    console.error('Email send failed (non-blocking):', e);
  }
}
