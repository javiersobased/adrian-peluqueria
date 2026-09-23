import {
  acquireOnce,
  adminClient,
  type BookingRow,
  isServiceRoleToken,
  json,
  loadTenant,
  localNow,
  sendPush,
  tenantUrl,
} from "../_shared/tenant.ts";

const CRON_SECRET = Deno.env.get("CRON_SECRET");

// Ventanas calibradas para una ejecución cada 15 minutos.
const CLIENT_WINDOW = { from: 85, to: 100 };
const BARBER_WINDOW = { from: 55, to: 70 };

Deno.serve(async (req: Request) => {
  const auth = req.headers.get("Authorization");
  const authorized = (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) || isServiceRoleToken(auth);
  if (!authorized) return json({ error: "Unauthorized" }, 401);

  const db = adminClient();
  const { data: businesses, error } = await db.from("businesses").select("id").eq("status", "active");
  if (error) return json({ error: error.message }, 500);

  const summary: Record<string, { client: number; barber: number; skipped?: string }> = {};

  for (const { id: businessId } of businesses ?? []) {
    const tenant = await loadTenant(db, businessId);
    if (!tenant?.push) {
      summary[businessId] = { client: 0, barber: 0, skipped: "push not configured" };
      continue;
    }

    const { date, minutes: nowMinutes } = localNow(tenant.timezone);
    const { data: bookings } = await db
      .from("bookings")
      .select("*")
      .eq("business_id", businessId)
      .eq("booking_date", date)
      .neq("status", "cancelled");

    const counts = { client: 0, barber: 0 };
    const url = tenantUrl(tenant, null, "/#mis-citas");

    for (const b of (bookings ?? []) as BookingRow[]) {
      const [h, m] = b.booking_time.split(":").map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) continue;
      const remaining = h * 60 + m - nowMinutes;
      const hora = b.booking_time.slice(0, 5);

      if (b.user_id && remaining > CLIENT_WINDOW.from && remaining <= CLIENT_WINDOW.to) {
        if (await acquireOnce(db, businessId, `reminder-client-${b.id}`, "push_reminder_client", b.user_id, b.id)) {
          await sendPush(
            tenant.push,
            { userIds: [b.user_id] },
            `Recordatorio de cita · ${tenant.name}`,
            `Tu cita es en 1 hora y media (a las ${hora}h). ¡Te esperamos!`,
            url,
          );
          counts.client++;
        }
      }

      if (b.barber && remaining > BARBER_WINDOW.from && remaining <= BARBER_WINDOW.to) {
        if (await acquireOnce(db, businessId, `reminder-barber-${b.id}`, "push_reminder_barber", b.barber, b.id)) {
          await sendPush(
            tenant.push,
            { tags: [{ key: "barber_id", value: b.barber }, { key: "role", value: "barber" }] },
            "Próximo cliente",
            `${b.full_name || "El cliente"} llegará en 1 hora (a las ${hora}h).`,
            tenantUrl(tenant, null, "/#admin"),
          );
          counts.barber++;
        }
      }
    }

    summary[businessId] = counts;
  }

  return json({ message: "Revisión completada", summary });
});
