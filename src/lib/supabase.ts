import { createClient } from '@supabase/supabase-js';

function extractValidUrl(raw?: string): string {
  if (!raw) return '';
  // Match valid Supabase URL even if formatted as markdown [url](url) or with quotes/brackets
  const match = raw.match(/https?:\/\/[a-zA-Z0-9.-]+\.supabase\.co/);
  if (match) return match[0];
  const genericMatch = raw.match(/https?:\/\/[^\s)\]'"]+/);
  if (genericMatch) return genericMatch[0];
  return raw.trim();
}

function extractValidKey(raw?: string): string {
  if (!raw) return '';
  return raw.trim().replace(/^['"\s\[\]()]+|['"\s\[\]()]+$/g, '');
}

export const supabaseUrl = extractValidUrl(import.meta.env.VITE_SUPABASE_URL);
export const supabaseAnonKey = extractValidKey(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no detectadas.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});