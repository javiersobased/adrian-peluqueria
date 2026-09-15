import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://ghukyltijkgdbaewhmcm.supabase.co';
const DEFAULT_KEY = 'sb_publishable_GQZocmXSG5-sda85TtAFsg_7DizUgnk';

function extractValidUrl(raw?: string): string {
  if (!raw) return DEFAULT_URL;
  // Match valid Supabase URL even if formatted as markdown [url](url) or with quotes/brackets
  const match = raw.match(/https?:\/\/[a-zA-Z0-9.-]+\.supabase\.co/);
  if (match) return match[0];
  const genericMatch = raw.match(/https?:\/\/[^\s)\]'"]+/);
  if (genericMatch) return genericMatch[0];
  return DEFAULT_URL;
}

function extractValidKey(raw?: string): string {
  if (!raw) return DEFAULT_KEY;
  const clean = raw.trim().replace(/^['"\s\[\]()]+|['"\s\[\]()]+$/g, '');
  return clean || DEFAULT_KEY;
}

const supabaseUrl = extractValidUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = extractValidKey(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});