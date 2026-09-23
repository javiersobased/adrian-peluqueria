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
  booking?: BookingData | null;
  barber_email?: string | null;
  barber_name?: string | null;
  to?: string | null;
  subject?: string | null;
  html?: string | null;
  idempotency_key?: string | null;
  notification_type?: string | null;
  booking_id?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { booking, to, subject, html } = body;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured. Skipping email dispatch.");
      return new Response(JSON.stringify({ warning: "RESEND_API_KEY not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") || "Peluquería Adrián Millán <citas@adrianmillan.es>";
    const replyToAddress = Deno.env.get("RESEND_REPLY_TO") || "adrian.millan.peguero@hotmail.com";

    const sendResendEmail = async (targetTo: string, targetSubject: string, targetHtml: string) => {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: targetTo,
            reply_to: replyToAddress,
            subject: targetSubject,
            html: targetHtml,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error(`Resend error sending to ${targetTo}:`, errText);
          return false;
        }
        return true;
      } catch (err) {
        console.error(`Fetch error sending to ${targetTo}:`, err);
        return false;
      }
    };

    // 1. Verificación de Autenticación de Supabase
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || supabaseKey;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Si se solicita envío directo de plantilla (e.g. desde notifications.ts)
    if (to && subject && html) {
      const cleanTo = to.trim().toLowerCase();
      const callerEmail = user.email?.trim().toLowerCase();

      let isAllowed = false;
      // El cliente solo puede enviarse correos a sí mismo (ej. copia de confirmación o recordatorio)
      if (callerEmail && cleanTo === callerEmail) {
        isAllowed = true;
      }

      // Si no es a sí mismo, verificar si el remitente es staff o si el destinatario es un barbero/admin registrado
      if (!isAllowed) {
        const adminSupabase = createClient(supabaseUrl, supabaseKey);
        const { data: staffMember } = await adminSupabase
          .from("staff")
          .select("role, status")
          .eq("email", callerEmail)
          .eq("status", "verified")
          .maybeSingle();

        if (staffMember) {
          isAllowed = true;
        } else {
          // Comprobar si el correo destino pertenece a un barbero o admin de la peluquería
          const MASTER_ADMINS = [
            'adrian.millan.peguero@hotmail.com',
            'adrianmillanpeguero1994@hotmail.com',
            'franciscojavierfarinapadilla@gmail.com',
          ];
          if (MASTER_ADMINS.includes(cleanTo)) {
            isAllowed = true;
          } else {
            const { data: targetBarber } = await adminSupabase
              .from("barbers")
              .select("id")
              .eq("google_email", cleanTo)
              .maybeSingle();
            if (targetBarber) isAllowed = true;
          }
        }
      }

      if (!isAllowed) {
        return new Response(JSON.stringify({ error: "Forbidden: Destination email not authorized for this account" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.idempotency_key && supabaseUrl && supabaseKey) {
        try {
          const adminSupabase = createClient(supabaseUrl, supabaseKey);
          const { data: acquired } = await adminSupabase.rpc('acquire_notification_idempotency', {
            p_key: body.idempotency_key,
            p_booking_id: body.booking_id || null,
            p_type: body.notification_type || 'direct_email',
            p_recipient: cleanTo,
          });
          if (acquired === false) {
            console.log(`[Idempotency] Duplicate email dispatch suppressed for key: ${body.idempotency_key}`);
            return new Response(JSON.stringify({ success: true, duplicate: true, message: "Duplicate email suppressed by idempotency lock" }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (idempErr) {
          console.warn("[Idempotency] Error checking idempotency key:", idempErr);
        }
      }

      const ok = await sendResendEmail(to, subject, html);
      return new Response(JSON.stringify({ success: ok }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!booking) {
      return new Response(JSON.stringify({ error: "No booking data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured. Skipping email dispatch.");
      return new Response(JSON.stringify({ warning: "RESEND_API_KEY not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase admin client to query barber details if needed
    let barberEmails: string[] = [];
    let barberDisplayName = body.barber_name || booking.barber;

    if (body.barber_email) {
      barberEmails.push(body.barber_email.trim().toLowerCase());
    }

    if (supabaseUrl && supabaseKey) {
      try {
        const adminDb = createClient(supabaseUrl, supabaseKey);
        const { data: bData } = await adminDb
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

        const { data: sData } = await adminDb
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
        let shouldSend = true;
        if (booking.id && supabaseUrl && supabaseKey) {
          try {
            const adminDb = createClient(supabaseUrl, supabaseKey);
            const barberKey = `booking-barber-${booking.id}-${bEmail}`;
            const { data: acquired } = await adminDb.rpc('acquire_notification_idempotency', {
              p_key: barberKey,
              p_booking_id: booking.id,
              p_type: 'barber_booking_email',
              p_recipient: bEmail,
            });
            if (acquired === false) {
              console.log(`[Idempotency] Duplicate barber email suppressed: ${barberKey}`);
              shouldSend = false;
              results.barbersSent.push(bEmail);
            }
          } catch (idempErr) {
            console.warn('[Idempotency] Warning acquiring barber idempotency:', idempErr);
          }
        }
        if (shouldSend) {
          const ok = await sendResendEmail(bEmail, barberSubject, barberHtml);
          if (ok) results.barbersSent.push(bEmail);
        }
      }
    }

    // 2. Send confirmation to Customer (forzado al email de la sesión autenticada salvo que sea staff)
    const clientTargetEmail = user.email || booking.email;
    if (clientTargetEmail) {
      let shouldSendClient = true;
      if (booking.id && supabaseUrl && supabaseKey) {
        try {
          const adminDb = createClient(supabaseUrl, supabaseKey);
          const clientKey = `booking-client-${booking.id}-${clientTargetEmail.toLowerCase().trim()}`;
          const { data: acquired } = await adminDb.rpc('acquire_notification_idempotency', {
            p_key: clientKey,
            p_booking_id: booking.id,
            p_type: 'client_booking_email',
            p_recipient: clientTargetEmail,
          });
          if (acquired === false) {
            console.log(`[Idempotency] Duplicate client email suppressed: ${clientKey}`);
            shouldSendClient = false;
            results.clientSent = true;
          }
        } catch (idempErr) {
          console.warn('[Idempotency] Warning acquiring client idempotency:', idempErr);
        }
      }

      if (shouldSendClient) {
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
        const ok = await sendResendEmail(clientTargetEmail, clientSubject, clientHtml);
        results.clientSent = ok;
      }
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
