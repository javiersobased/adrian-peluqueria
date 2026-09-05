export type AdminRole = 'adrian' | 'admin';

interface AuthState {
  isBarber: boolean;
  role: AdminRole | null;
}

const DEFAULT_CREDENTIALS = {
  adrian: { username: 'peluqueriaadrian', password: '21005', role: 'adrian' as const },
  admin: { username: 'peluqueriaadmin', password: '21005', role: 'admin' as const },
};

const STORAGE_KEY = 'admin_credentials';

function getStoredCredentials() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEFAULT_CREDENTIALS;
}

function saveCredentials(creds: typeof DEFAULT_CREDENTIALS) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
}

export function login(username: string, password: string): AuthState {
  const creds = getStoredCredentials();
  for (const key of Object.keys(creds) as (keyof typeof creds)[]) {
    const entry = creds[key];
    if (entry.username === username && entry.password === password) {
      localStorage.setItem('is_barber', 'true');
      localStorage.setItem('admin_role', entry.role);
      return { isBarber: true, role: entry.role };
    }
  }
  return { isBarber: false, role: null };
}

export function logout() {
  localStorage.removeItem('is_barber');
  localStorage.removeItem('admin_role');
}

export function checkAuth(): AuthState {
  const isBarber = localStorage.getItem('is_barber') === 'true';
  const role = localStorage.getItem('admin_role') as AdminRole | null;
  return { isBarber, role };
}

export function updatePassword(role: AdminRole, oldPassword: string, newPassword: string): boolean {
  const creds = getStoredCredentials();
  const entry = creds[role];
  if (!entry || entry.password !== oldPassword) return false;
  entry.password = newPassword;
  creds[role] = entry;
  saveCredentials(creds);
  return true;
}

export function canAccessServices(role: AdminRole | null): boolean {
  return role === 'adrian';
}

export function canAccessStaff(role: AdminRole | null): boolean {
  return role === 'adrian';
}

export function canAccessSettings(role: AdminRole | null): boolean {
  return role === 'adrian';
}
