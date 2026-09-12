import { supabase } from '@/lib/supabase';
import type { SavedBooking } from '@/types';

// TODO: Implement Edge Function URL — replace with your deployed Supabase Edge Function endpoint
const EMAIL_EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/send-booking-email`;

export async function sendBookingEmail(booking: SavedBooking): Promise<void> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token ?? '';
    await fetch(EMAIL_EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({ booking }),
    });
  } catch (e) {
    console.error('Email send failed (non-blocking):', e);
  }
}
