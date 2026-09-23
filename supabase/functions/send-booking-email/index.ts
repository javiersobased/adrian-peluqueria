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

      const ok = await sendResendEmail(to, subject, html);
      return new Response(JSON.stringify({ success: ok }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Missing required email parameters (to, subject, html)" }), {
      status: 400,
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
