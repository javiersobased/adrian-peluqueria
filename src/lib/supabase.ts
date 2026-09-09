import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ghukyltijkgdbaewhmcm.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_GQZocmXSG5-sda85TtAFsg_7DizUgnk'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las credenciales de Supabase en las variables de entorno.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)