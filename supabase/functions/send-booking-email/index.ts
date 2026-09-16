import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BookingData {
  id: string;
  service: string;
  service_price: number;
  barber: string;
  booking_date: string;
  booking_time: string;
  full_name: string;
  phone: string;
  email: string | null;
  comments: string | null;
  status: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { booking } = await req.json() as { booking: BookingData };

    if (!booking?.email) {
      return new Response(JSON.stringify({ error: "No email provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build email content
    const subject = `Confirmación de tu cita · Peluquería Adrián Millán`;
    const html = `
      <h2>¡Cita confirmada!</h2>
      <p>Hola ${booking.full_name},</p>
      <p>Tu cita ha sido reservada correctamente. Aquí tienes los detalles:</p>
      <ul>
        <li><strong>Servicio:</strong> ${booking.service}</li>
        <li><strong>Fecha:</strong> ${booking.booking_date}</li>
        <li><strong>Hora:</strong> ${booking.booking_time} h</li>
        <li><strong>Barbero:</strong> ${booking.barber}</li>
        ${booking.comments ? `<li><strong>Comentarios:</strong> ${booking.comments}</li>` : ""}
      </ul>
      <p>Te esperamos. Si necesitas cancelar o modificar tu cita, puedes hacerlo desde la app.</p>
      <p>Saludos,<br/>Peluquería Adrián Millán</p>
    `;

    // Send via Resend API
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Peluquería Adrián Millán <noreply@adrianmillan.es>",
        to: booking.email,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend API error:", errText);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
