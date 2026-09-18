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
  created_at?: string;
}

interface RequestBody {
  booking: BookingData;
  barber_email?: string | null;
  barber_name?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { booking } = body;

    if (!booking) {
      return new Response(JSON.stringify({ error: "No booking data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured. Skipping email dispatch.");
      return new Response(JSON.stringify({ warning: "RESEND_API_KEY not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default sender (resend sandbox or custom domain)
    const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") || "Peluquería Adrián Millán <onboarding@resend.dev>";

    // Initialize Supabase admin client to query barber details if needed
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    let barberEmails: string[] = [];
    let barberDisplayName = body.barber_name || booking.barber;

    if (body.barber_email) {
      barberEmails.push(body.barber_email.trim().toLowerCase());
    }

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        // Find barber in barbers table
        const { data: bData } = await supabase
          .from("barbers")
          .select("id, name, google_email, admin_emails")
          .eq("id", booking.barber)
          .maybeSingle();

        if (bData) {
          if (bData.name) barberDisplayName = bData.name;
          if (bData.google_email && !barberEmails.includes(bData.google_email.toLowerCase().trim())) {
            barberEmails.push(bData.google_email.toLowerCase().trim());
          }
          if (Array.isArray(bData.admin_emails)) {
            for (const em of bData.admin_emails) {
              const clean = String(em).toLowerCase().trim();
              if (clean && !barberEmails.includes(clean)) {
                barberEmails.push(clean);
              }
            }
          }
        }

        // Also check staff table for assigned barber
        const { data: sData } = await supabase
          .from("staff")
          .select("email, barber_id")
          .eq("barber_id", booking.barber);

        if (sData && Array.isArray(sData)) {
          for (const s of sData) {
            const clean = s.email?.toLowerCase().trim();
            if (clean && !barberEmails.includes(clean)) {
              barberEmails.push(clean);
            }
          }
        }
      } catch (dbErr) {
        console.error("Error looking up barber email in database:", dbErr);
      }
    }

    const sendResendEmail = async (to: string, subject: string, html: string) => {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to,
            subject,
            html,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error(`Resend error sending to ${to}:`, errText);
          return false;
        }
        return true;
      } catch (err) {
        console.error(`Fetch error sending to ${to}:`, err);
        return false;
      }
    };

    const results: { clientSent?: boolean; barbersSent: string[] } = { barbersSent: [] };

    // 1. Send notification to Barber(s)
    if (barberEmails.length > 0) {
      const barberSubject = `💈 Nueva cita con ${booking.full_name} · ${booking.booking_date} a las ${booking.booking_time}h`;
      const barberHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #d4af37; font-size: 24px; margin: 0;">💈 Nueva Cita Reservada</h1>
            <p style="color: #a1a1aa; font-size: 14px; margin-top: 6px;">Peluquería Adrián Millán</p>
          </div>
          
          <div style="background-color: #18181b; border-radius: 12px; padding: 20px; border: 1px solid #27272a; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="border-bottom: 1px solid #27272a;">
                <td style="padding: 10px 0; color: #a1a1aa;">Cliente:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #ffffff; text-align: right;">${booking.full_name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #27272a;">
                <td style="padding: 10px 0; color: #a1a1aa;">Teléfono:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #d4af37; text-align: right;">
                  <a href="tel:${booking.phone}" style="color: #d4af37; text-decoration: none;">${booking.phone}</a>
                </td>
              </tr>
              ${booking.email ? `
              <tr style="border-bottom: 1px solid #27272a;">
                <td style="padding: 10px 0; color: #a1a1aa;">Email cliente:</td>
                <td style="padding: 10px 0; color: #ffffff; text-align: right;">${booking.email}</td>
              </tr>
              ` : ''}
              <tr style="border-bottom: 1px solid #27272a;">
                <td style="padding: 10px 0; color: #a1a1aa;">Fecha:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #ffffff; text-align: right;">${booking.booking_date}</td>
              </tr>
              <tr style="border-bottom: 1px solid #27272a;">
                <td style="padding: 10px 0; color: #a1a1aa;">Hora:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #d4af37; font-size: 16px; text-align: right;">${booking.booking_time} h</td>
              </tr>
              <tr style="border-bottom: 1px solid #27272a;">
                <td style="padding: 10px 0; color: #a1a1aa;">Servicio:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #ffffff; text-align: right;">${booking.service} (${booking.service_price} €)</td>
              </tr>
              <tr style="border-bottom: 1px solid #27272a;">
                <td style="padding: 10px 0; color: #a1a1aa;">Barbero:</td>
                <td style="padding: 10px 0; color: #ffffff; text-align: right;">${barberDisplayName}</td>
              </tr>
              ${booking.comments ? `
              <tr>
                <td style="padding: 10px 0; color: #a1a1aa;">Notas:</td>
                <td style="padding: 10px 0; color: #d4d4d8; font-style: italic; text-align: right;">"${booking.comments}"</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <p style="color: #71717a; font-size: 12px; margin: 0;">Gestiona tus citas desde el Panel de Administración de Peluquería Adrián Millán.</p>
          </div>
        </div>
      `;

      for (const bEmail of barberEmails) {
        const ok = await sendResendEmail(bEmail, barberSubject, barberHtml);
        if (ok) results.barbersSent.push(bEmail);
      }
    }

    // 2. Send confirmation to Customer (if email provided)
    if (booking.email) {
      const clientSubject = `Confirmación de tu cita · Peluquería Adrián Millán`;
      const clientHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #d4af37; font-size: 24px; margin: 0;">¡Cita Confirmada!</h1>
            <p style="color: #a1a1aa; font-size: 14px; margin-top: 6px;">Peluquería Adrián Millán</p>
          </div>

          <p style="font-size: 15px; color: #e4e4e7;">Hola <strong>${booking.full_name}</strong>,</p>
          <p style="font-size: 14px; color: #a1a1aa; line-height: 1.5;">Tu cita ha sido reservada correctamente. Aquí tienes los detalles:</p>

          <div style="background-color: #18181b; border-radius: 12px; padding: 20px; border: 1px solid #27272a; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="border-bottom: 1px solid #27272a;">
                <td style="padding: 10px 0; color: #a1a1aa;">Servicio:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #ffffff; text-align: right;">${booking.service} (${booking.service_price} €)</td>
              </tr>
              <tr style="border-bottom: 1px solid #27272a;">
                <td style="padding: 10px 0; color: #a1a1aa;">Fecha:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #ffffff; text-align: right;">${booking.booking_date}</td>
              </tr>
              <tr style="border-bottom: 1px solid #27272a;">
                <td style="padding: 10px 0; color: #a1a1aa;">Hora:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #d4af37; font-size: 16px; text-align: right;">${booking.booking_time} h</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #a1a1aa;">Barbero:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #ffffff; text-align: right;">${barberDisplayName}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 13px; color: #a1a1aa;">Te esperamos en nuestro salón. Si necesitas cambiar tu hora o consultar tu cita, puedes hacerlo desde nuestra aplicación web.</p>
          
          <div style="text-align: center; margin-top: 24px; border-top: 1px solid #27272a; padding-top: 16px;">
            <p style="color: #71717a; font-size: 12px; margin: 0;">Peluquería Adrián Millán · Huelva</p>
          </div>
        </div>
      `;
      const ok = await sendResendEmail(booking.email, clientSubject, clientHtml);
      results.clientSent = ok;
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
