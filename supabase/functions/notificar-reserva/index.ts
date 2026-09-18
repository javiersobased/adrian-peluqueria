import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const APP_ID = Deno.env.get("ONESIGNAL_APP_ID") || "86a6a369-9e5f-472b-8461-cac4fb762af7";
const API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY") || "lgfr7ht7teveunp5tu3luvp4u";
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

    // 1. OneSignal Push Dispatch
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

    // 2. Email Dispatch via Resend (si está configurada la API key)
    if (body.email && body.email.to && RESEND_API_KEY) {
      try {
        const mailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Peluquería Adrián Millán <citas@adrianmillan.es>",
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