import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const TERMS_VERSION = '1.0';

/**
 * Checks if the current authenticated user has already accepted the legal terms and confirmed age (+14).
 */
export function hasAcceptedTerms(user: User | null | undefined): boolean {
  if (!user) return true; // No prompt if not logged in yet

  // 1. Check user_metadata from Supabase Auth
  if (user.user_metadata?.terms_accepted === true) {
    return true;
  }

  // 2. Check local client cache
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(`terms_accepted_${user.id}`);
    if (cached === 'true') return true;
  }

  return false;
}

/**
 * Persists legal terms acceptance and preferences into user_metadata, localStorage, and customers table.
 */
export async function acceptUserTerms(
  user: User,
  options: { marketingAccepted: boolean }
): Promise<boolean> {
  const timestamp = new Date().toISOString();

  try {
    // 1. Persist directly in Supabase Auth user record
    const { error: authError } = await supabase.auth.updateUser({
      data: {
        terms_accepted: true,
        terms_accepted_at: timestamp,
        marketing_accepted: options.marketingAccepted,
        terms_version: TERMS_VERSION,
      },
    });

    if (authError) {
      console.warn('Error al actualizar user_metadata en auth:', authError.message);
    }

    // 2. Cache in localStorage for immediate synchronous UI resolution
    if (typeof window !== 'undefined') {
      localStorage.setItem(`terms_accepted_${user.id}`, 'true');
      localStorage.setItem(`marketing_accepted_${user.id}`, String(options.marketingAccepted));
    }

    // 3. Opportunistically update customers table in database
    try {
      await supabase.from('customers').upsert({
        user_id: user.id,
        email: user.email || null,
        full_name: user.user_metadata?.full_name || '',
        marketing_accepted: options.marketingAccepted,
        updated_at: timestamp,
      });
    } catch {
      // Table column or RLS might vary, safe to ignore
    }

    return true;
  } catch (err) {
    console.error('Error al guardar aceptación de términos:', err);
    // Even if remote fails temporarily, save locally so the user isn't stuck
    if (typeof window !== 'undefined') {
      localStorage.setItem(`terms_accepted_${user.id}`, 'true');
    }
    return true;
  }
}

/**
 * Executes the Right to Erasure (RGPD Derecho al Olvido):
 * - Deletes user data in public.customers
 * - Cancels future bookings and unlinks personal data
 * - Marks metadata as deleted and signs the user out
 */
export async function deleteUserAccount(
  userId: string,
  userEmail?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date().toISOString().slice(0, 10);

    // 1. Cancel future bookings
    try {
      await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          comments: 'Cuenta y datos personales eliminados por el usuario (RGPD)',
        })
        .eq('user_id', userId)
        .gte('booking_date', now);
    } catch (e) {
      console.warn('Error cancelando citas en eliminación:', e);
    }

    // 2. Delete customer profile
    try {
      await supabase.from('customers').delete().eq('user_id', userId);
      if (userEmail) {
        await supabase.from('customers').delete().ilike('email', userEmail.trim());
      }
    } catch (e) {
      console.warn('Error eliminando perfil customer:', e);
    }

    // 3. Mark user metadata as deleted
    try {
      await supabase.auth.updateUser({
        data: {
          account_deleted: true,
          terms_accepted: false,
          deleted_at: new Date().toISOString(),
          full_name: 'Usuario Eliminado',
        },
      });
    } catch (e) {
      console.warn('Error actualizando user_metadata:', e);
    }

    // 4. Clear local storage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`terms_accepted_${userId}`);
      localStorage.removeItem(`marketing_accepted_${userId}`);
      localStorage.removeItem('pending_booking');
      localStorage.removeItem('adrian_phone_verified');
    }

    // 5. Sign out
    await supabase.auth.signOut();

    return { success: true };
  } catch (err) {
    console.error('Error general en deleteUserAccount:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error desconocido al eliminar la cuenta',
    };
  }
}
