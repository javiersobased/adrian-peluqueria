import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

export function isServiceRoleToken(authHeader: string | null): boolean {
  return !!SERVICE_ROLE_KEY && authHeader === `Bearer ${SERVICE_ROLE_KEY}`;
}

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

export interface Caller {
  id: string;
  email: string;
}

export async function getCaller(req: Request): Promise<Caller | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: normalizeEmail(data.user.email) };
}

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export interface EmailChannel {
  apiKey: string;
  from: string;
  replyTo: string | null;
}

export interface PushChannel {
  appId: string;
  apiKey: string;
}

export interface Tenant {
  businessId: string;
  name: string;
  status: string;
  timezone: string;
  isLegacy: boolean;
  siteUrl: string | null;
  email: EmailChannel | null;
  push: PushChannel | null;
}

interface IntegrationRow {
  business_id: string;
  name: string;
  status: string;
  timezone: string;
  is_legacy: boolean;
  email_from: string | null;
  email_reply_to: string | null;
  site_url: string | null;
  onesignal_app_id: string | null;
  resend_api_key: string | null;
  onesignal_api_key: string | null;
}

// Los secretos globales del proyecto pertenecen al tenant heredado; ningún otro negocio los usa.
export async function loadTenant(db: SupabaseClient, businessId: string): Promise<Tenant | null> {
  const { data, error } = await db.rpc("get_business_integration", { p_business_id: businessId });
  if (error || !data) return null;
  const row = data as IntegrationRow;
  const legacyEnv = (key: string) => (row.is_legacy ? Deno.env.get(key) || null : null);

  const resendKey = row.resend_api_key || legacyEnv("RESEND_API_KEY");
  const from = legacyEnv("RESEND_FROM_EMAIL") || row.email_from;
  const replyTo = legacyEnv("RESEND_REPLY_TO") || row.email_reply_to;
  const pushAppId = row.onesignal_app_id || legacyEnv("ONESIGNAL_APP_ID");
  const pushKey = row.onesignal_api_key || legacyEnv("ONESIGNAL_REST_API_KEY");

  return {
    businessId: row.business_id,
    name: row.name,
    status: row.status,
    timezone: row.timezone || "Europe/Madrid",
    isLegacy: row.is_legacy,
    siteUrl: row.site_url,
    email: resendKey && from ? { apiKey: resendKey, from, replyTo } : null,
    push: pushAppId && pushKey ? { appId: pushAppId, apiKey: pushKey } : null,
  };
}

export interface BookingRow {
  id: string;
  business_id: string;
  user_id: string | null;
  barber: string;
  service: string;
  service_price: number;
  booking_date: string;
  booking_time: string;
  full_name: string;
  phone: string;
  email: string | null;
  comments: string | null;
  status: string;
}

export type TenantResolution =
  | { businessId: string; booking: BookingRow | null }
  | { error: string; status: number };

// El negocio se deriva de la reserva almacenada; un business_id del cliente solo se acepta si coincide.
export async function resolveBusiness(
  db: SupabaseClient,
  bookingId: unknown,
  requestedBusinessId: unknown,
): Promise<TenantResolution> {
  const requested = typeof requestedBusinessId === "string" && requestedBusinessId ? requestedBusinessId : null;

  if (typeof bookingId === "string" && bookingId) {
    const { data: booking } = await db.from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (!booking) return { error: "Booking not found", status: 404 };
    if (requested && requested !== booking.business_id) {
      return { error: "Booking does not belong to the requested business", status: 400 };
    }
    return { businessId: booking.business_id, booking: booking as BookingRow };
  }

  if (requested) return { businessId: requested, booking: null };

  const { data: legacyId } = await db.rpc("legacy_business_id");
  if (typeof legacyId !== "string") return { error: "Business could not be resolved", status: 400 };
  return { businessId: legacyId, booking: null };
}

export interface StaffMembership {
  role: "admin" | "barber";
  barberId: string | null;
}

export async function getStaffMembership(
  db: SupabaseClient,
  businessId: string,
  email: string,
): Promise<StaffMembership | null> {
  if (!email) return null;
  const { data } = await db
    .from("staff")
    .select("role, barber_id")
    .eq("business_id", businessId)
    .eq("email", email)
    .eq("status", "verified")
    .maybeSingle();
  return data ? { role: data.role, barberId: data.barber_id } : null;
}

export async function getBarberRecipients(
  db: SupabaseClient,
  businessId: string,
  barberId: string,
): Promise<{ name: string; emails: string[] }> {
  const emails = new Set<string>();
  let name = barberId;

  const { data: barber } = await db
    .from("barbers")
    .select("name, google_email, admin_emails")
    .eq("business_id", businessId)
    .eq("id", barberId)
    .maybeSingle();

  if (barber) {
    if (barber.name) name = barber.name;
    const google = normalizeEmail(barber.google_email);
    if (google) emails.add(google);
    for (const extra of Array.isArray(barber.admin_emails) ? barber.admin_emails : []) {
      const clean = normalizeEmail(extra);
      if (clean) emails.add(clean);
    }
  }

  const { data: staff } = await db
    .from("staff")
    .select("email")
    .eq("business_id", businessId)
    .eq("barber_id", barberId)
    .eq("status", "verified");
  for (const row of staff ?? []) {
    const clean = normalizeEmail(row.email);
    if (clean) emails.add(clean);
  }

  return { name, emails: [...emails] };
}

// true = primer envío; false = duplicado ya registrado.
export async function acquireOnce(
  db: SupabaseClient,
  businessId: string,
  key: string,
  type: string,
  recipient: string,
  bookingId: string | null,
): Promise<boolean> {
  const { data, error } = await db.rpc("acquire_notification_idempotency", {
    p_key: key,
    p_booking_id: bookingId,
    p_type: type,
    p_recipient: recipient,
    p_business_id: businessId,
  });
  if (error) {
    console.warn("[idempotency]", error.message);
    return true;
  }
  return data !== false;
}

export async function sendEmail(channel: EmailChannel, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${channel.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: channel.from,
        to,
        subject,
        html,
        ...(channel.replyTo ? { reply_to: channel.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error("[resend]", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[resend]", err);
    return false;
  }
}

export interface PushTarget {
  userIds?: string[];
  tags?: { key: string; relation?: string; value: string }[];
}

export async function sendPush(
  channel: PushChannel,
  target: PushTarget,
  heading: string,
  content: string,
  url: string | null,
): Promise<unknown> {
  const payload: Record<string, unknown> = {
    app_id: channel.appId,
    headings: { en: heading, es: heading },
    contents: { en: content, es: content },
  };
  if (url) payload.url = url;

  if (target.userIds?.length) {
    payload.include_aliases = { external_id: target.userIds };
    payload.target_channel = "push";
  } else if (target.tags?.length) {
    payload.filters = target.tags.flatMap((t, i) => {
      const filter = { field: "tag", key: t.key, relation: t.relation || "=", value: t.value };
      return i === 0 ? [filter] : [{ operator: "AND" }, filter];
    });
  } else {
    return { skipped: "no target" };
  }

  const authorization = channel.apiKey.startsWith("os_") || channel.apiKey.startsWith("key_")
    ? `Key ${channel.apiKey}`
    : `Basic ${channel.apiKey}`;

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

// Solo se permiten enlaces al sitio del propio negocio.
export function tenantUrl(tenant: Tenant, requested: unknown, fallbackPath = "/"): string | null {
  if (!tenant.siteUrl) return null;
  if (typeof requested === "string" && requested.startsWith(tenant.siteUrl)) {
    const next = requested.charAt(tenant.siteUrl.length);
    if (next === "" || next === "/" || next === "#" || next === "?") return requested;
  }
  return tenant.siteUrl + fallbackPath;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function localNow(timezone: string): { date: string; minutes: number } {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now).split(":").map(Number);
  return { date, minutes: (h % 24) * 60 + m };
}
