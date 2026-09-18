import type { SavedBooking } from '@/types';
import { WEEKDAY_NAMES, MONTH_NAMES } from '@/lib/schedule';

export const SITE_URL = 'https://www.adrianmillan.es';
export const CITAS_URL = 'https://www.adrianmillan.es/#mis-citas';
export const SUBDOMAIN_CITAS_URL = 'https://citas.adrianmillan.es';
export const ADMIN_URL = 'https://www.adrianmillan.es/#admin';
export const SALON_PHONE = '+34 612 345 678';
export const SALON_ADDRESS = 'Huelva, España';

function formatDateHuman(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T00:00:00');
    return `${WEEKDAY_NAMES[d.getDay()]}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
  } catch {
    return isoDate;
  }
}

const baseStyles = `
  body { margin: 0; padding: 0; background-color: #0a0a0c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e4e4e7; -webkit-font-smoothing: antialiased; }
  .wrapper { width: 100%; max-width: 600px; margin: 0 auto; background-color: #121216; border: 1px solid rgba(212, 175, 55, 0.2); border-radius: 20px; overflow: hidden; }
  .header { padding: 32px 24px; text-align: center; background: linear-gradient(180deg, rgba(212, 175, 55, 0.12) 0%, rgba(18, 18, 22, 0) 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
  .brand-title { color: #d4af37; font-size: 13px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; margin: 0; }
  .brand-name { color: #ffffff; font-size: 22px; font-weight: 800; margin: 6px 0 0 0; }
  .content { padding: 32px 24px; }
  .hero-title { color: #ffffff; font-size: 20px; font-weight: 700; margin: 0 0 12px 0; text-align: center; }
  .hero-text { color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; text-align: center; }
  .card { background-color: #18181d; border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 16px; padding: 20px; margin-bottom: 24px; }
  .card-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 14px; }
  .card-row:last-child { border-bottom: none; }
  .card-label { color: #71717a; font-weight: 500; }
  .card-value { color: #ffffff; font-weight: 600; text-align: right; }
  .card-value.highlight { color: #d4af37; font-weight: 700; }
  .btn-container { text-align: center; margin: 28px 0 20px 0; }
  .btn-gold { display: inline-block; background: linear-gradient(135deg, #d4af37 0%, #f3e5ab 50%, #aa8c2c 100%); color: #000000 !important; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; padding: 14px 32px; border-radius: 9999px; text-decoration: none; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.25); }
  .btn-secondary { display: inline-block; background-color: rgba(255, 255, 255, 0.08); color: #ffffff !important; font-weight: 600; font-size: 13px; padding: 12px 24px; border-radius: 9999px; text-decoration: none; margin-left: 8px; }
  .footer { padding: 24px; text-align: center; background-color: #0d0d10; border-top: 1px solid rgba(255, 255, 255, 0.05); color: #71717a; font-size: 12px; line-height: 1.5; }
  .footer a { color: #d4af37; text-decoration: none; }
`;

function wrapTemplate(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div style="padding: 24px 12px;">
    <div class="wrapper">
      <div class="header">
        <p class="brand-title">Peluquería & Barbería</p>
        <h1 class="brand-name">ADRIÁN MILLÁN</h1>
      </div>
      <div class="content">
        ${bodyContent}
      </div>
      <div class="footer">
        <p><strong>Peluquería y Barbería Adrián Millán</strong></p>
        <p>${SALON_ADDRESS} · Teléfono: ${SALON_PHONE} · Email: <a href="mailto:citas@adrianmillan.es">citas@adrianmillan.es</a></p>
        <p style="margin-top: 12px;">
          <a href="${CITAS_URL}">Ver mis citas online</a> · <a href="${SITE_URL}">Visitar web oficial</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function renderDetailsTable(rows: { label: string; value: string; highlight?: boolean; strike?: boolean; italic?: boolean }[]): string {
  const trs = rows.map((r, i) => {
    const isLast = i === rows.length - 1;
    const border = isLast ? 'border-bottom: none;' : 'border-bottom: 1px solid rgba(255, 255, 255, 0.07);';
    const valColor = r.highlight ? '#d4af37' : '#ffffff';
    const valWeight = r.highlight ? '700' : '600';
    const textDecor = r.strike ? 'text-decoration: line-through; opacity: 0.65;' : '';
    const fontStyle = r.italic ? 'font-style: italic;' : '';
    const labelText = r.label.endsWith(':') ? r.label : `${r.label}:`;

    return `<tr>
      <td style="padding: 12px 16px; ${border} color: #a1a1aa; font-size: 14px; font-weight: 500; width: 42%; vertical-align: top; text-align: left;">${labelText}</td>
      <td style="padding: 12px 16px; ${border} color: ${valColor}; font-size: 14px; font-weight: ${valWeight}; ${textDecor} ${fontStyle} text-align: right; vertical-align: top;">${r.value}</td>
    </tr>`;
  }).join('');

  return `<table style="width: 100%; border-collapse: collapse; background-color: #18181d; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; overflow: hidden; margin: 20px 0 24px 0;">
    <tbody>
      ${trs}
    </tbody>
  </table>`;
}

/**
 * 1. Email de Confirmación de Cita al Cliente
 */
export function getBookingConfirmationEmail(booking: SavedBooking) {
  const subject = `¡Cita confirmada! Te esperamos el ${formatDateHuman(booking.booking_date)} a las ${booking.booking_time}h`;

  const html = wrapTemplate(`
    <h2 class="hero-title">¡Tu cita ha sido confirmada! ✂️</h2>
    <p class="hero-text">Hola <strong>${booking.full_name}</strong>, gracias por confiar en nosotros. Tu reserva ha quedado registrada con los siguientes detalles:</p>
    
    ${renderDetailsTable([
      { label: 'Servicio', value: booking.service },
      { label: 'Precio', value: `${booking.service_price} €`, highlight: true },
      { label: 'Barbero asignado', value: booking.barber === 'adrian' ? 'Adrián Millán' : booking.barber },
      { label: 'Fecha', value: formatDateHuman(booking.booking_date), highlight: true },
      { label: 'Hora', value: `${booking.booking_time} h`, highlight: true },
      ...(booking.comments ? [{ label: 'Tus notas', value: `"${booking.comments}"`, italic: true }] : []),
    ])}

    <div class="btn-container">
      <a href="${CITAS_URL}" class="btn-gold">Ver o gestionar mi cita</a>
    </div>

    <p style="text-align: center; color: #71717a; font-size: 12px; margin-top: 20px;">
      Si necesitas reprogramar o cancelar, puedes hacerlo directamente desde el botón superior en cualquier momento.
    </p>
  `);

  return { subject, html };
}

/**
 * 2. Email de Cambio de Horario / Reorganización al Cliente
 */
export function getBookingRescheduledEmail(
  booking: SavedBooking,
  oldDate?: string,
  oldTime?: string,
  reason?: string,
  barberName?: string
) {
  const subject = `Cambio de horario en tu cita · Peluquería Adrián Millán`;
  const resolvedBarber = barberName || (booking.barber === 'adrian' ? 'Adrián Millán' : booking.barber);

  const html = wrapTemplate(`
    <h2 class="hero-title" style="color: #d4af37;">Horario de tu cita actualizado 🔄</h2>
    <p class="hero-text">Hola <strong>${booking.full_name}</strong>, te informamos de que el horario o profesional de tu cita ha sido actualizado:</p>

    ${renderDetailsTable([
      ...(oldDate || oldTime ? [{
        label: 'Horario anterior',
        value: `${oldDate ? formatDateHuman(oldDate) : ''} a las ${oldTime || ''}h`,
        strike: true,
      }] : []),
      { label: 'Fecha', value: formatDateHuman(booking.booking_date), highlight: true },
      { label: 'Hora', value: `${booking.booking_time} h`, highlight: true },
      { label: 'Servicio', value: `${booking.service} (${booking.service_price} €)` },
      { label: 'Barbero', value: resolvedBarber, highlight: true },
      ...(reason ? [{ label: 'Motivo', value: reason, italic: true }] : []),
    ])}

    <div class="btn-container">
      <a href="${CITAS_URL}" class="btn-gold">Ver mi cita actualizada</a>
    </div>
  `);

  return { subject, html };
}

/**
 * 3. Email de Cancelación de Cita al Cliente
 */
export function getBookingCancelledEmail(
  booking: SavedBooking,
  barberName?: string,
  reason?: string
) {
  const subject = `Tu cita del ${formatDateHuman(booking.booking_date)} ha sido cancelada · Peluquería Adrián Millán`;
  const resolvedBarber = barberName || (booking.barber === 'adrian' ? 'Adrián Millán' : booking.barber);

  const html = wrapTemplate(`
    <h2 class="hero-title" style="color: #f87171;">Tu cita ha sido cancelada</h2>
    <p class="hero-text">Hola <strong>${booking.full_name}</strong>, te confirmamos que tu cita programada para el <strong>${formatDateHuman(booking.booking_date)} a las ${booking.booking_time}h</strong> ha sido cancelada.</p>

    ${renderDetailsTable([
      { label: 'Servicio programado', value: booking.service },
      { label: 'Barbero', value: resolvedBarber },
      { label: 'Estado', value: 'Cancelada', highlight: true },
      ...(reason ? [{ label: 'Motivo', value: reason, italic: true }] : []),
    ])}

    <p class="hero-text" style="font-size: 13px; color: #a1a1aa; margin-top: 16px;">
      Si tienes cualquier duda sobre esta cancelación o necesitas contactarnos, puedes responder directamente a este correo o escribir a <a href="mailto:citas@adrianmillan.es" style="color: #d4af37; text-decoration: underline;">citas@adrianmillan.es</a>.
    </p>

    <p class="hero-text">Si deseas volver a reservar cuando te venga bien, puedes hacerlo en 1 minuto desde nuestra web oficial:</p>

    <div class="btn-container">
      <a href="${SITE_URL}" class="btn-gold">Pedir nueva cita</a>
    </div>
  `);

  return { subject, html };
}

/**
 * 4. Email al Barbero: Nueva Cita Recibida
 */
export function getBarberNewBookingEmail(booking: SavedBooking, barberName: string) {
  const subject = `✂️ Nueva cita: ${booking.full_name} - ${formatDateHuman(booking.booking_date)} a las ${booking.booking_time}h`;

  const html = wrapTemplate(`
    <h2 class="hero-title">¡Nueva cita en tu agenda!</h2>
    <p class="hero-text">Hola <strong>${barberName}</strong>, un cliente ha reservado una cita contigo:</p>

    ${renderDetailsTable([
      { label: 'Cliente', value: booking.full_name, highlight: true },
      { label: 'Teléfono', value: `<a href="tel:${booking.phone}" style="color:#d4af37; text-decoration:none;">${booking.phone}</a>` },
      ...(booking.email ? [{ label: 'Email', value: booking.email }] : []),
      { label: 'Servicio', value: booking.service },
      { label: 'Precio', value: `${booking.service_price} €`, highlight: true },
      { label: 'Fecha', value: formatDateHuman(booking.booking_date), highlight: true },
      { label: 'Hora', value: `${booking.booking_time} h`, highlight: true },
      ...(booking.comments ? [{ label: 'Nota cliente', value: `"${booking.comments}"`, italic: true }] : []),
    ])}

    <div class="btn-container">
      <a href="${ADMIN_URL}" class="btn-gold">Ver en Panel de Gestión</a>
    </div>
  `);

  return { subject, html };
}

/**
 * 5. Email al Barbero: Cita CANCELADA DE HOY (solo se dispara si es del mismo día)
 */
export function getBarberUrgentTodayCancellationEmail(booking: SavedBooking, barberName: string) {
  const subject = `⚠️ URGENTE: Cita de HOY cancelada por ${booking.full_name} (${booking.booking_time}h)`;

  const html = wrapTemplate(`
    <h2 class="hero-title" style="color: #ef4444;">⚠️ Cita de HOY cancelada</h2>
    <p class="hero-text">Hola <strong>${barberName}</strong>, se ha cancelado una cita para <strong>HOY</strong> en tu agenda:</p>

    ${renderDetailsTable([
      { label: 'Cliente', value: booking.full_name },
      { label: 'Hora liberada', value: `Hoy a las ${booking.booking_time} h`, highlight: true },
      { label: 'Servicio', value: booking.service },
      { label: 'Teléfono cliente', value: `<a href="tel:${booking.phone}" style="color:#d4af37; text-decoration:none;">${booking.phone}</a>` },
    ])}

    <p style="text-align:center; color: #a1a1aa; font-size: 13px;">
      El hueco de las <strong>${booking.booking_time}h</strong> ha quedado libre en tu turno de hoy.
    </p>

    <div class="btn-container">
      <a href="${ADMIN_URL}" class="btn-gold">Abrir Agenda de Hoy</a>
    </div>
  `);

  return { subject, html };
}

/**
 * 6. Email al Barbero: Cita CAMBIADA DE HOY (solo si la fecha anterior o nueva es hoy)
 */
export function getBarberUrgentTodayRescheduledEmail(
  booking: SavedBooking,
  barberName: string,
  oldTime?: string
) {
  const subject = `🔄 AVISO: Cambio en tu cita de HOY: ${booking.full_name} (${booking.booking_time}h)`;

  const html = wrapTemplate(`
    <h2 class="hero-title" style="color: #f59e0b;">🔄 Cita de HOY modificada</h2>
    <p class="hero-text">Hola <strong>${barberName}</strong>, la cita de <strong>${booking.full_name}</strong> ha cambiado de horario para tu turno de hoy:</p>

    ${renderDetailsTable([
      ...(oldTime ? [{ label: 'Hora anterior', value: `${oldTime} h`, strike: true }] : []),
      { label: 'Nueva hora fijada', value: `Hoy a las ${booking.booking_time} h`, highlight: true },
      { label: 'Servicio', value: booking.service },
      { label: 'Teléfono', value: `<a href="tel:${booking.phone}" style="color:#d4af37; text-decoration:none;">${booking.phone}</a>` },
    ])}

    <div class="btn-container">
      <a href="${ADMIN_URL}" class="btn-gold">Ver en Agenda de Hoy</a>
    </div>
  `);

  return { subject, html };
}

/**
 * 7. Email Promocional (Solo para clientes que aceptaron la casilla de cosas comerciales)
 */
export function getPromotionalEmail(options: {
  clientName: string;
  promoTitle: string;
  promoMessage: string;
  ctaText?: string;
  ctaLink?: string;
}) {
  const subject = `${options.promoTitle} · Peluquería Adrián Millán`;

  const html = wrapTemplate(`
    <h2 class="hero-title" style="color: #d4af37;">${options.promoTitle} ✨</h2>
    <p class="hero-text">Hola <strong>${options.clientName}</strong>,</p>
    
    <div style="background-color: #18181d; border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 16px; padding: 24px; margin-bottom: 24px; text-align: center;">
      <p style="color: #ffffff; font-size: 15px; line-height: 1.7; margin: 0;">
        ${options.promoMessage.replace(/\n/g, '<br/>')}
      </p>
    </div>

    <div class="btn-container">
      <a href="${options.ctaLink || SITE_URL}" class="btn-gold">${options.ctaText || 'Reservar con esta promoción'}</a>
    </div>

    <p style="text-align: center; color: #52525b; font-size: 11px; margin-top: 30px;">
      Recibes este correo porque aceptaste recibir comunicaciones comerciales de Peluquería Adrián Millán. Puedes gestionar tus preferencias desde <a href="${CITAS_URL}" style="color: #71717a;">tu perfil</a>.
    </p>
  `);

  return { subject, html };
}
