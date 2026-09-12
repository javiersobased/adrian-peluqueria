import { supabase } from '@/lib/supabase';

export async function hasAdmin(): Promise<boolean> {
  const { data } = await supabase.rpc('has_admin');
  return data === true;
}

export async function claimAdmin(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('claim_admin');
  return { error: error?.message ?? null };
}
