import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Needed so the session survives the full-page redirect to/from Google,
    // and so a customer stays logged in across visits.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
