import { supabase } from '@/lib/supabase';

export const MASTER_ADMIN_EMAILS: readonly string[] = [
  'adrian.millan.peguero@hotmail.com',
  'adrianmillanpeguero1994@hotmail.com',
  'franciscojavierfarinapadilla@gmail.com',
];

export function isMasterAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  return MASTER_ADMIN_EMAILS.includes(clean);
}

export async function hasAdmin(): Promise<boolean> {
  const { data } = await supabase.rpc('has_admin');
  return data === true;
}

export async function claimAdmin(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('claim_admin');
  return { error: error?.message ?? null };
}

