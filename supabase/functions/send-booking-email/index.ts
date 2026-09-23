import {
  acquireOnce,
  adminClient,
  type BookingRow,
  escapeHtml,
  getBarberRecipients,
  getCaller,
  getStaffMembership,
  json,
  loadTenant,
  normalizeEmail,
  resolveBusiness,
  sendEmail,
  type Tenant,
} from "../_shared/tenant.ts";

interface RequestBody {
  booking?: { id?: string } | null;
  booking_id?: string | null;
  business_id?: string | null;
  to?: string | null;
  subject?: string | null;
  html?: string | null;
  idempotency_key?: string | null;
  notification_type?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(null);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "Unauthorized: Invalid or expired session" }, 401);

    const body = (await req.json()) as RequestBody;
    const db = adminClient();

    const resolved = await resolveBusiness(db, body.booking_id || body.booking?.id, body.business_id);
    if ("error" in resolved) return json({ error: resolved.error }, resolved.status);
    const { businessId, booking } = resolved;

    const tenant = await loadTenant(db, businessId);
    if (!tenant) return json({ error: "Business not found" }, 404);
    if (tenant.status !== "active") return json({ warning: "Business is not active" });
    if (!tenant.email) {
      console.warn(`[send-booking-email] Email not configured for business ${businessId}`);
      return json({ warning: "Email not configured for this business" });
    }

    const staff = await getStaffMembership(db, businessId, caller.email);
    const ownsBooking = !!booking && booking.user_id === caller.id;

    // Envío directo de plantilla ya renderizada por el cliente
    if (body.to && body.subject && body.html) {
      const to = normalizeEmail(body.to);
      let allowed = to === caller.email || !!staff;
      if (!allowed && ownsBooking) {
        const { emails } = await getBarberRecipients(db, businessId, booking!.barber);
        allowed = emails.includes(to);
      }
      if (!allowed) return json({ error: "Forbidden: Destination email not authorized for this account" }, 403);

      if (body.idempotency_key) {
        const first = await acquireOnce(
          db, businessId, body.idempotency_key, body.notification_type || "direct_email", to, booking?.id ?? null,
        );
        if (!first) return json({ success: true, duplicate: true });
      }

      const ok = await sendEmail(tenant.email, to, body.subject, body.html);
      return json({ success: ok });
    }

    // Confirmación de reserva: datos y destinatarios salen de la base de datos, no del cliente
    if (!booking) return json({ error: "booking_id is required" }, 400);
    if (!ownsBooking && !staff) return json({ error: "Forbidden" }, 403);

    const { name: barberName, emails: barberEmails } = await getBarberRecipients(db, businessId, booking.barber);
    const results: { clientSent?: boolean; barbersSent: string[] } = { barbersSent: [] };

    for (const email of barberEmails) {
      const first = await acquireOnce(
        db, businessId, `booking-barber-${booking.id}-${email}`, "barber_booking_email", email, booking.id,
      );
      if (!first || await sendEmail(tenant.email, email, barberSubject(booking), barberHtml(tenant, booking, barberName))) {
        results.barbersSent.push(email);
      }
    }

    const clientEmail = normalizeEmail(booking.email) || (ownsBooking ? caller.email : "");
    if (clientEmail) {
      const first = await acquireOnce(
        db, businessId, `booking-client-${booking.id}-${clientEmail}`, "client_booking_email", clientEmail, booking.id,
      );
      results.clientSent = !first ||
        await sendEmail(tenant.email, clientEmail, `Confirmación de tu cita · ${tenant.name}`, clientHtml(tenant, booking, barberName));
    }

    return json({ success: true, results });
  } catch (err) {
    console.error("[send-booking-email]", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

function barberSubject(b: BookingRow): string {
  return `💈 Nueva cita con ${b.full_name} · ${b.booking_date} a las ${b.booking_time}h`;
}

function row(label: string, value: string, highlight = false): string {
  const color = highlight ? "#d4af37" : "#ffffff";
  return `<tr style="border-bottom: 1px solid #27272a;">
    <td style="padding: 10px 0; color: #a1a1aa;">${label}</td>
    <td style="padding: 10px 0; font-weight: bold; color: ${color}; text-align: right;">${value}</td>
  </tr>`;
}

function shell(title: string, tenant: Tenant, inner: string, footer: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #d4af37; font-size: 24px; margin: 0;">${title}</h1>
        <p style="color: #a1a1aa; font-size: 14px; margin-top: 6px;">${escapeHtml(tenant.name)}</p>
      </div>
      ${inner}
      <div style="text-align: center; margin-top: 24px; border-top: 1px solid #27272a; padding-top: 16px;">
        <p style="color: #71717a; font-size: 12px; margin: 0;">${footer}</p>
      </div>
    </div>`;
}

function barberHtml(tenant: Tenant, b: BookingRow, barberName: string): string {
  const phone = escapeHtml(b.phone);
  const rows = [
    row("Cliente:", escapeHtml(b.full_name)),
    row("Teléfono:", `<a href="tel:${phone}" style="color: #d4af37; text-decoration: none;">${phone}</a>`, true),
    b.email ? row("Email cliente:", escapeHtml(b.email)) : "",
    row("Fecha:", escapeHtml(b.booking_date)),
    row("Hora:", `${escapeHtml(b.booking_time)} h`, true),
    row("Servicio:", `${escapeHtml(b.service)} (${escapeHtml(b.service_price)} €)`),
    row("Barbero:", escapeHtml(barberName)),
    b.comments ? row("Notas:", `"${escapeHtml(b.comments)}"`) : "",
  ].join("");
  return shell(
    "💈 Nueva Cita Reservada",
    tenant,
    `<div style="background-color: #18181b; border-radius: 12px; padding: 20px; border: 1px solid #27272a;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">${rows}</table>
    </div>`,
    `Gestiona tus citas desde el panel de administración de ${escapeHtml(tenant.name)}.`,
  );
}

function clientHtml(tenant: Tenant, b: BookingRow, barberName: string): string {
  const rows = [
    row("Servicio:", `${escapeHtml(b.service)} (${escapeHtml(b.service_price)} €)`),
    row("Fecha:", escapeHtml(b.booking_date)),
    row("Hora:", `${escapeHtml(b.booking_time)} h`, true),
    row("Barbero:", escapeHtml(barberName)),
  ].join("");
  return shell(
    "¡Cita Confirmada!",
    tenant,
    `<p style="font-size: 15px; color: #e4e4e7;">Hola <strong>${escapeHtml(b.full_name)}</strong>,</p>
     <p style="font-size: 14px; color: #a1a1aa; line-height: 1.5;">Tu cita ha sido reservada correctamente. Aquí tienes los detalles:</p>
     <div style="background-color: #18181b; border-radius: 12px; padding: 20px; border: 1px solid #27272a; margin: 20px 0;">
       <table style="width: 100%; border-collapse: collapse; font-size: 14px;">${rows}</table>
     </div>
     <p style="font-size: 13px; color: #a1a1aa;">Si necesitas cambiar tu hora o consultar tu cita, puedes hacerlo desde nuestra web.</p>`,
    escapeHtml(tenant.name),
  );
}
