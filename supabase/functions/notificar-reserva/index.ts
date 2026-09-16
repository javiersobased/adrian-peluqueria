import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const cita = payload.record;

    if (!cita || !cita.user_id) {
      return new Response(JSON.stringify({ error: "Faltan datos de la cita o del usuario" }), { status: 400 });
    }

    const horaCita = cita.booking_time.slice(0, 5); // Formato "HH:MM"
    const mensaje = `¡Reserva confirmada! Te esperamos el ${cita.booking_date} a las ${horaCita}.`;

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${API_KEY}`
      },
      body: JSON.stringify({
        app_id: APP_ID,
        include_external_user_ids: [cita.user_id], // Envia solo al cliente que reservó
        contents: { en: mensaje, es: mensaje },
        headings: { en: "Cita Confirmada", es: "Cita Confirmada" }
      })
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
});