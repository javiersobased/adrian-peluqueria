import { supabase } from '@/lib/supabase';

export const SUPER_ADMIN_EMAIL = 'franciscojavierfarinapadilla@gmail.com';

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === SUPER_ADMIN_EMAIL;
}

export const MASTER_ADMIN_EMAILS: readonly string[] = [
  'adrian.millan.peguero@hotmail.com',
  'adrianmillanpeguero1994@hotmail.com',
  SUPER_ADMIN_EMAIL,
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
  const cachedPhoto = typeof window !== 'undefined'
    ? localStorage.getItem(`barber_photo_${DEVELOPER_BARBER_ID}`) ||
      localStorage.getItem('barber_photo_francisco_javier')
    : null;
  const cachedName = typeof window !== 'undefined'
    ? localStorage.getItem(`barber_name_${DEVELOPER_BARBER_ID}`) ||
      localStorage.getItem('barber_name_francisco_javier')
    : null;
  const devName = cachedName?.trim() || 'Francisco Javier';
  const initials = devName
    .split(' ')
    .filter(Boolean)
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'FJ';

  return {
    id: DEVELOPER_BARBER_ID,
    name: devName,
    role: 'Desarrollador',
    initials,
    photo_url: cachedPhoto || null,
    active: false,
    sort_order: 9999,
    google_email: DEVELOPER_EMAIL,
  };
}

