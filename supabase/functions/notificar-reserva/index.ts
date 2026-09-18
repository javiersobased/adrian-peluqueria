import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 1. Verificación de Autenticación
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || supabaseAnonKey;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Valid session required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!APP_ID || !API_KEY) {
      console.warn("OneSignal credentials not fully configured in environment.");
      return new Response(JSON.stringify({ warning: "OneSignal not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const results: Record<string, any> = {};

    // Support legacy payload: { record: cita }
    if (body.record && !body.push) {
      const cita = body.record;
      if (cita && cita.user_id) {
        const horaCita = (cita.booking_time || '').slice(0, 5);
        body.push = {
          userIds: [cita.user_id],
          heading: "Cita Confirmada · Peluquería Adrián Millán",
          content: `¡Te esperamos el ${cita.booking_date} a las ${horaCita}h!`,
          url: "https://www.adrianmillan.es/#mis-citas",
        };
      }
    }

    // 2. OneSignal Push Dispatch
    if (body.push) {
      const pushBody: Record<string, any> = {
        app_id: APP_ID,
        headings: { en: body.push.heading, es: body.push.heading },
        contents: { en: body.push.content, es: body.push.content },
        url: body.push.url || "https://www.adrianmillan.es/#mis-citas",
      };

      if (body.push.userIds && body.push.userIds.length > 0) {
        pushBody.include_aliases = { external_id: body.push.userIds };
        pushBody.target_channel = "push";
      } else if (body.push.tags && body.push.tags.length > 0) {
        // Broadcast / multi-target push: solo permitido si el usuario es staff verificado o notifica a su barbero
        const isBarberTarget = body.push.tags.some((t: any) => t.key === 'barber_id');
        if (!isBarberTarget) {
          const adminSupabase = createClient(supabaseUrl, supabaseKey);
          const { data: staffMember } = await adminSupabase
            .from("staff")
            .select("role, status")
            .eq("email", user.email?.toLowerCase().trim())
            .eq("status", "verified")
            .maybeSingle();

          if (!staffMember) {
            return new Response(JSON.stringify({ error: "Forbidden: Broadcast push requires staff role" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        const filters: any[] = [];
        body.push.tags.forEach((t: any, index: number) => {
          if (index > 0) {
            filters.push({ operator: "AND" });
          }
          filters.push({
            field: "tag",
            key: t.key,
            relation: t.relation || "=",
            value: t.value,
          });
        });
        pushBody.filters = filters;
      }

      try {
        const authHeader = (API_KEY.startsWith("os_") || API_KEY.startsWith("key_"))
          ? `Key ${API_KEY}`
          : `Basic ${API_KEY}`;

        const osRes = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
          },
          body: JSON.stringify(pushBody),
        });
        results.push = await osRes.json();
      } catch (err: any) {
        results.pushError = err.message;
      }
    }

    // 3. Email Dispatch via Resend (si está configurada la API key)
    if (body.email && body.email.to && RESEND_API_KEY) {
      const cleanTo = String(body.email.to).trim().toLowerCase();
      const callerEmail = user.email?.trim().toLowerCase();

      // Comprobar que no sea un relay a terceros no autorizados
      let emailAllowed = (callerEmail && cleanTo === callerEmail);
      if (!emailAllowed) {
        const adminSupabase = createClient(supabaseUrl, supabaseKey);
        const { data: staffCaller } = await adminSupabase
          .from("staff")
          .select("role, status")
          .eq("email", callerEmail)
          .eq("status", "verified")
          .maybeSingle();
        if (staffCaller) {
          emailAllowed = true;
        } else {
          const { data: targetBarber } = await adminSupabase
            .from("barbers")
            .select("id")
            .eq("google_email", cleanTo)
            .maybeSingle();
          if (targetBarber) emailAllowed = true;
        }
      }

      if (emailAllowed) {
        try {
          const mailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: Deno.env.get("RESEND_FROM_EMAIL") || "Peluquería Adrián Millán <citas@adrianmillan.es>",
              reply_to: Deno.env.get("RESEND_REPLY_TO") || "adrian.millan.peguero@hotmail.com",
              to: body.email.to,
              subject: body.email.subject,
              html: body.email.html,
            }),
          });
          results.email = await mailRes.json();
        } catch (err: any) {
          results.emailError = err.message;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});