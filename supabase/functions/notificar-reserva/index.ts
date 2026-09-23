import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  acquireOnce,
  adminClient,
  getCaller,
  getStaffMembership,
  json,
  loadTenant,
  type PushTarget,
  resolveBusiness,
  sendPush,
  tenantUrl,
} from "../_shared/tenant.ts";

interface PushRequest extends PushTarget {
  heading?: string;
  content?: string;
  url?: string;
}

interface RequestBody {
  push?: PushRequest;
  record?: { id?: string };
  booking_id?: string | null;
  business_id?: string | null;
  idempotency_key?: string | null;
}

// El email lo envía send-booking-email; esta función solo gestiona push.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(null);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "Unauthorized: Valid session required" }, 401);

    const body = (await req.json()) as RequestBody;
    const db = adminClient();

    const resolved = await resolveBusiness(db, body.booking_id || body.record?.id, body.business_id);
    if ("error" in resolved) return json({ error: resolved.error }, resolved.status);
    const { businessId, booking } = resolved;

    const tenant = await loadTenant(db, businessId);
    if (!tenant) return json({ error: "Business not found" }, 404);
    if (tenant.status !== "active") return json({ warning: "Business is not active" });
    if (!tenant.push) {
      console.warn(`[notificar-reserva] Push not configured for business ${businessId}`);
      return json({ warning: "Push not configured for this business" });
    }

    const staff = await getStaffMembership(db, businessId, caller.email);
    const ownsBooking = !!booking && booking.user_id === caller.id;

    let push = body.push;
    if (!push && body.record && booking?.user_id) {
      push = {
        userIds: [booking.user_id],
        heading: `Cita Confirmada · ${tenant.name}`,
        content: `¡Te esperamos el ${booking.booking_date} a las ${booking.booking_time.slice(0, 5)}h!`,
      };
    }
    if (!push?.heading || !push.content) return json({ error: "No push payload provided" }, 400);

    const target: PushTarget = {};
    if (push.userIds?.length) {
      const onlySelf = push.userIds.every((id) => id === caller.id);
      if (!staff && !onlySelf) return json({ error: "Forbidden: push target not allowed" }, 403);
      target.userIds = push.userIds;
    } else if (push.tags?.length) {
      // Un cliente solo puede avisar al barbero de su propia reserva
      const barberOfOwnBooking = ownsBooking && push.tags.every((t) =>
        (t.key === "barber_id" && t.value === booking!.barber) || (t.key === "role" && t.value === "barber")
      ) && push.tags.some((t) => t.key === "barber_id");
      if (!staff && !barberOfOwnBooking) return json({ error: "Forbidden: broadcast push requires staff role" }, 403);
      target.tags = push.tags;
    } else {
      return json({ error: "Push target required" }, 400);
    }

    if (body.idempotency_key) {
      const recipient = target.userIds?.join(",") || target.tags?.map((t) => `${t.key}=${t.value}`).join("&") || "push";
      const first = await acquireOnce(db, businessId, String(body.idempotency_key), "push", recipient, booking?.id ?? null);
      if (!first) return json({ success: true, duplicate: true });
    }

    const result = await sendPush(
      tenant.push,
      target,
      push.heading,
      push.content,
      tenantUrl(tenant, push.url, "/#mis-citas"),
    );
    return json({ success: true, push: result });
  } catch (err) {
    console.error("[notificar-reserva]", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
