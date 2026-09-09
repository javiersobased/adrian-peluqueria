import { supabase } from '@/lib/supabase';

export async function hasAdmin(): Promise<boolean> {
  const { data } = await supabase.rpc('has_admin');
  return data === true;
}

export async function claimAdmin(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('claim_admin');
  return { error: error?.message ?? null };
}

export async function verifyBarber(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('verify_barber', { p_email: email });
  return { error: error?.message ?? null };
}

export async function rejectBarber(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('staff')
    .update({ status: 'rejected' })
    .eq('email', email);
  return { error: error?.message ?? null };
}

export async function registerBarber(email: string, fullName: string, barberId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('staff')
    .insert({ email, full_name: fullName, role: 'barber', barber_id: barberId, status: 'pending' });
  return { error: error?.message ?? null };
}
