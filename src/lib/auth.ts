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

export const DEVELOPER_EMAIL = 'franciscojavierfarinapadilla@gmail.com';
export const DEVELOPER_BARBER_ID = 'franciscojavier';

export function isDeveloper(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === DEVELOPER_EMAIL;
}

export function getDeveloperProfile(): import('@/types').Barber {
  const cachedPhoto = typeof window !== 'undefined' ? localStorage.getItem(`barber_photo_${DEVELOPER_BARBER_ID}`) : null;
  return {
    id: DEVELOPER_BARBER_ID,
    name: 'Francisco Javier',
    role: 'Desarrollador',
    initials: 'FJ',
    photo_url: cachedPhoto || null,
    active: false,
    sort_order: 9999,
    google_email: DEVELOPER_EMAIL,
  };
}

