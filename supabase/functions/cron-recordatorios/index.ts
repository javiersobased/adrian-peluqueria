import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async () => {
  // Obtener citas de hoy que no estén canceladas
  const hoy = new Date().toISOString().split('T')[0];
  const { data: citas } = await supabase
    .from('bookings')
    .select('*')
    .eq('booking_date', hoy)
    .neq('status', 'cancelled');

  if (!citas) return new Response("Sin citas", { status: 200 });

  const ahora = new Date();

  for (const cita of citas) {
    // Convertir hora de la cita a objeto Date para calcular minutos restantes
    const [horas, minutos] = cita.booking_time.split(':');
    const fechaCita = new Date();
    fechaCita.setHours(parseInt(horas), parseInt(minutos), 0, 0);
    
    const minutosRestantes = Math.round((fechaCita.getTime() - ahora.getTime()) / 60000);

    // Aviso al CLIENTE (1 hora y media antes -> entre 85 y 100 mins para el cron de 15m)
    if (minutosRestantes > 85 && minutosRestantes <= 100) {
      await enviarPush([cita.user_id], "Recordatorio", `Tu cita es en 1 hora y media (a las ${cita.booking_time.slice(0,5)}). ¡Te esperamos!`);
    }

    // Aviso al BARBERO (1 hora antes -> entre 55 y 70 mins para el cron de 15m)
    if (minutosRestantes > 55 && minutosRestantes <= 70) {
      await enviarPush([cita.barber_id], "Próximo Cliente", `${cita.client_name} llegará en 1 hora (a las ${cita.booking_time.slice(0,5)}).`);
    }
  }

  return new Response("Revisión completada", { status: 200 });
})

async function enviarPush(users: string[], titulo: string, mensaje: string) {
  await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Basic ${API_KEY}` },
    body: JSON.stringify({
      app_id: APP_ID,
      include_external_user_ids: users,
      contents: { en: mensaje, es: mensaje },
      headings: { en: titulo, es: titulo }
    })
  });
}