import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ghukyltijkgdbaewhmcm.supabase.co'
const supabaseAnonKey = 'sb_publishable_GQZocmXSG5-sda85TtAFsg_7DizUgnk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)