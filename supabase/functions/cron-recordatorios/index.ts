import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  // 1. Verificación de autorización para ejecución de tareas programadas
  const authHeader = req.headers.get("Authorization");
  if (CRON_SECRET) {
    const isAuthorized =
      authHeader === `Bearer ${CRON_SECRET}` ||
      authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid cron secret" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (!APP_ID || !API_KEY) {
    return new Response(JSON.stringify({ warning: "OneSignal not configured" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Obtener citas de hoy que no estén canceladas
  const hoy = new Date().toISOString().split('T')[0];
  const { data: citas, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('booking_date', hoy)
    .neq('status', 'cancelled');

  if (error || !citas || citas.length === 0) {
    return new Response(JSON.stringify({ message: "Sin citas pendientes hoy", count: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ahora = new Date();

  for (const cita of citas) {
    if (!cita.booking_time) continue;
    const [horas, minutos] = cita.booking_time.split(':');
    const fechaCita = new Date();
    fechaCita.setHours(parseInt(horas, 10), parseInt(minutos, 10), 0, 0);
    
    const minutosRestantes = Math.round((fechaCita.getTime() - ahora.getTime()) / 60000);
    const horaFormateada = cita.booking_time.slice(0, 5);
    const nombreCliente = cita.full_name || 'El cliente';

    // Aviso al CLIENTE (1 hora y media antes -> entre 85 y 100 mins para el cron de 15m)
    if (minutosRestantes > 85 && minutosRestantes <= 100 && cita.user_id) {
      await enviarPush([cita.user_id], "Recordatorio de Cita", `Tu cita es en 1 hora y media (a las ${horaFormateada}h). ¡Te esperamos!`);
    }

    // Aviso al BARBERO (1 hora antes -> entre 55 y 70 mins para el cron de 15m)
    if (minutosRestantes > 55 && minutosRestantes <= 70 && cita.barber) {
      await enviarPush([cita.barber], "Próximo Cliente", `${nombreCliente} llegará en 1 hora (a las ${horaFormateada}h).`);
    }
  }

  return new Response(JSON.stringify({ message: "Revisión completada exitosamente" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function enviarPush(users: string[], titulo: string, mensaje: string) {
  if (!API_KEY || !APP_ID) return;
  const authHeader = (API_KEY.startsWith("os_") || API_KEY.startsWith("key_"))
    ? `Key ${API_KEY}`
    : `Basic ${API_KEY}`;

  try {
    await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": authHeader },
      body: JSON.stringify({
        app_id: APP_ID,
        include_aliases: { external_id: users },
        target_channel: "push",
        contents: { en: mensaje, es: mensaje },
        headings: { en: titulo, es: titulo }
      })
    });
  } catch (err) {
    console.warn("Error enviando push en cron-recordatorios:", err);
  }
}