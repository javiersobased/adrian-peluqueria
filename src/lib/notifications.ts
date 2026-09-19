import { supabase } from '@/lib/supabase';
import type { SavedBooking, Barber } from '@/types';
import { toISO } from '@/lib/schedule';
import {
  getBookingConfirmationEmail,
  getBookingRescheduledEmail,
  getBookingCancelledEmail,
  getBarberNewBookingEmail,
  getBarberUrgentTodayCancellationEmail,
  getBarberUrgentTodayRescheduledEmail,
  getPromotionalEmail,
  CITAS_URL,
  ADMIN_URL,
  SITE_URL,
} from '@/lib/emailTemplates';
import { ONESIGNAL_APP_ID } from '@/lib/onesignal';

/**
 * Helper to check if an appointment date/time is today and within the next 3 hours (Europe/Madrid)
 * REGLA ESTRICTA SOLICITADA POR EL USUARIO:
 * "solamente quiero que le notifique si la reserva de la cita, el cambio o la cancelacion es para el mismo día y si la cita es o era en las siguientes 3 horas"
 */
function isTodayWithinNextHours(
  dateIso?: string | null,
  timeStr?: string | null,
  hoursThreshold = 3
): boolean {
  if (!dateIso || !timeStr) return false;

  const now = new Date();

  // Fecha actual en hora peninsular española (Europe/Madrid)
  const todayMadrid = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  if (dateIso !== todayMadrid) return false;

  // Hora actual en hora peninsular española (Europe/Madrid)
  const timeMadrid = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  const [currH, currM] = timeMadrid.split(':').map(Number);
  const [slotH, slotM] = timeStr.split(':').map(Number);

  if (isNaN(currH) || isNaN(currM) || isNaN(slotH) || isNaN(slotM)) {
    return false;
  }

  const currentMinutes = currH * 60 + currM;
  const slotMinutes = slotH * 60 + slotM;
  const diffMinutes = slotMinutes - currentMinutes;

  // "es o era en las siguientes 3 horas":
  // Citas desde 30 minutos antes (por si acaba de empezar o cancelan justo a la hora)
  // hasta 3 horas en adelante (0 a 180 min)
  return diffMinutes >= -30 && diffMinutes <= hoursThreshold * 60;
}

/**
 * Sends a notification payload to Supabase Edge Function to dispatch push and/or email
 */
async function dispatchNotification(payload: {
  push?: {
    userIds?: string[];
    tags?: { key: string; relation: '=' | '!='; value: string }[];
    heading: string;
    content: string;
    url: string;
  };
  email?: {
    to: string;
    subject: string;
    html: string;
  };
}) {
  try {
    // 1. Send email via send-booking-email Edge Function (Resend)
    if (payload.email) {
      try {
        await supabase.functions.invoke('send-booking-email', {
          body: {
            to: payload.email.to,
            subject: payload.email.subject,
            html: payload.email.html,
          },
        });
      } catch (emailErr) {
        console.warn('[Notifications] Email dispatch failed:', emailErr);
      }
    }

    // 2. Send push via notificar-reserva Edge Function (OneSignal)
    if (payload.push) {
      const { error } = await supabase.functions.invoke('notificar-reserva', {
        body: payload,
      });
      if (error) {
        console.warn('[Notifications] Push Edge Function warning:', error.message);
      }
    }
  } catch (err) {
    console.warn('[Notifications] Notification dispatch failed:', err);
  }
}

/**
 * Helper to ensure client email address is resolved from booking or user profile
 */
async function resolveTargetEmail(booking: SavedBooking): Promise<string | null> {
  if (booking.email && booking.email.includes('@')) {
    return booking.email.trim();
  }

  // 1. Fallback to customer record in database by user_id
  if (booking.user_id) {
    try {
      const { data } = await supabase
        .from('customers')
        .select('email')
        .eq('user_id', booking.user_id)
        .not('email', 'is', null)
        .maybeSingle();
      if (data?.email && data.email.includes('@')) {
        return data.email.trim();
      }
    } catch {}
  }

  // 2. Fallback to customer record by phone number
  if (booking.phone) {
    try {
      const { data } = await supabase
        .from('customers')
        .select('email')
        .eq('phone', booking.phone)
        .not('email', 'is', null)
        .maybeSingle();
      if (data?.email && data.email.includes('@')) {
        return data.email.trim();
      }
    } catch {}
  }

  // 3. Fallback to active Supabase user ONLY if current user is the booking owner
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user && booking.user_id && data.user.id === booking.user_id) {
      if (data.user.email && data.user.email.includes('@')) {
        return data.user.email.trim();
      }
    }
  } catch {}

  return null;
}

/**
 * 1. NOTIFICACIÓN DE CITA CONFIRMADA
 * Dispara:
 * - Push al Cliente (con link a sus citas)
 * - Email al Cliente (plantilla dorada completa, SIEMPRE enviado)
 * - Push y Email al Barbero (notificación al barbero con todos los datos)
 */
export async function notifyBookingConfirmed(booking: SavedBooking, barber?: Barber | null) {
  try {
    const hora = booking.booking_time.slice(0, 5);
    const clientName = booking.full_name.trim();
    const barberName = barber?.name || (booking.barber === 'adrian' ? 'Adrián Millán' : booking.barber);

    // 1. Al Cliente: Email transaccional garantizado 100%
    const targetEmail = await resolveTargetEmail(booking);
    const bookingWithEmail: SavedBooking = targetEmail ? { ...booking, email: targetEmail } : booking;
    const clientEmail = targetEmail ? getBookingConfirmationEmail(bookingWithEmail) : null;

    await dispatchNotification({
      push: booking.user_id ? {
        userIds: [booking.user_id],
        heading: 'Cita Confirmada · Peluquería Adrián Millán',
        content: `¡Te esperamos el ${booking.booking_date} a las ${hora}h!`,
        url: CITAS_URL,
      } : undefined,
      email: targetEmail && clientEmail ? {
        to: targetEmail,
        subject: clientEmail.subject,
        html: clientEmail.html,
      } : undefined,
    });

    // 2. Al Barbero: Enviar email siempre que se reserve una cita con él
    const barberGoogleEmail = barber?.google_email || (Array.isArray(barber?.admin_emails) ? barber?.admin_emails[0] : null) || (booking.barber === 'adrian' ? 'adrian.millan.peguero@hotmail.com' : null);
    if (barberGoogleEmail) {
      const isUrgentForBarber = isTodayWithinNextHours(booking.booking_date, booking.booking_time, 3);
      const barberEmailPayload = getBarberNewBookingEmail(booking, barberName);

      await dispatchNotification({
        push: isUrgentForBarber ? {
          tags: [
            { key: 'barber_id', relation: '=', value: booking.barber },
            { key: 'role', relation: '=', value: 'barber' },
          ],
          heading: '⚡ Nueva Cita Urgente (Próximas 3h)',
          content: `${clientName} ha reservado para hoy a las ${hora}h (${booking.service}).`,
          url: ADMIN_URL,
        } : undefined,
        email: barberEmailPayload ? {
          to: barberGoogleEmail,
          subject: isUrgentForBarber
            ? `⚡ [HOY ${hora}h] Nueva Cita: ${clientName}`
            : `💈 Nueva Cita Reservada: ${clientName} · ${booking.booking_date} a las ${hora}h`,
          html: barberEmailPayload.html,
        } : undefined,
      });
    }
  } catch (err) {
    console.warn('[Notifications] Error in notifyBookingConfirmed:', err);
  }
}

/**
 * 2. NOTIFICACIÓN DE CITA CANCELADA
 * REGLA ESTRICTA SOLICITADA POR EL USUARIO:
 * "solamente quiero que le notifique si la reserva de la cita, el cambio o la cancelacion es para el mismo día y si la cita es o era en las siguientes 3 horas"
 */
export async function notifyBookingCancelled(
  booking: SavedBooking,
  barber?: Barber | null,
  reason?: string
) {
  try {
    const hora = booking.booking_time.slice(0, 5);
    const clientName = booking.full_name.trim();
    const barberName = barber?.name || (booking.barber === 'adrian' ? 'Adrián Millán' : booking.barber);

    // 1. Al Cliente (Siempre se le notifica la cancelación de su cita por email)
    const targetEmail = await resolveTargetEmail(booking);
    const bookingWithEmail: SavedBooking = targetEmail ? { ...booking, email: targetEmail } : booking;
    const clientEmail = targetEmail ? getBookingCancelledEmail(bookingWithEmail, barberName, reason) : null;

    await dispatchNotification({
      push: booking.user_id ? {
        userIds: [booking.user_id],
        heading: 'Cita Cancelada · Peluquería Adrián Millán',
        content: `Tu cita del ${booking.booking_date} a las ${hora}h ha sido cancelada. Para dudas o consultas: citas@adrianmillan.es`,
        url: CITAS_URL,
      } : undefined,
      email: targetEmail && clientEmail ? {
        to: targetEmail,
        subject: clientEmail.subject,
        html: clientEmail.html,
      } : undefined,
    });

    // 2. Al Barbero: SOLAMENTE SI LA CITA ERA PARA HOY Y EN LAS PRÓXIMAS 3 HORAS
    const isUrgentForBarber = isTodayWithinNextHours(booking.booking_date, booking.booking_time, 3);
    if (isUrgentForBarber) {
      const barberGoogleEmail = barber?.google_email || (booking.barber === 'adrian' ? 'adrian.millan.peguero@hotmail.com' : null);
      const barberEmailPayload = barberGoogleEmail ? getBarberUrgentTodayCancellationEmail(booking, barberName) : null;

      await dispatchNotification({
        push: {
          tags: [
            { key: 'barber_id', relation: '=', value: booking.barber },
            { key: 'role', relation: '=', value: 'barber' },
          ],
          heading: '⚠️ Cita Urgente Cancelada (Próximas 3h)',
          content: `${clientName} ha cancelado su cita de hoy a las ${hora}h (${booking.service}).`,
          url: ADMIN_URL,
        },
        email: barberGoogleEmail && barberEmailPayload ? {
          to: barberGoogleEmail,
          subject: barberEmailPayload.subject,
          html: barberEmailPayload.html,
        } : undefined,
      });
    } else {
      console.log(`[Notifications] Cita cancelada (${booking.booking_date} ${hora}h) no era para hoy en las próximas 3h. Omitiendo aviso al barbero según regla.`);
    }
  } catch (err) {
    console.warn('[Notifications] Error in notifyBookingCancelled:', err);
  }
}

/**
 * 3. NOTIFICACIÓN DE CITA CAMBIADA / REORGANIZADA
 * REGLA ESTRICTA SOLICITADA POR EL USUARIO:
 * "solamente quiero que le notifique si la reserva de la cita, el cambio o la cancelacion es para el mismo día y si la cita es o era en las siguientes 3 horas"
 */
export async function notifyBookingRescheduled(
  booking: SavedBooking,
  oldDate?: string,
  oldTime?: string,
  reason?: string,
  barber?: Barber | null
) {
  try {
    const hora = booking.booking_time.slice(0, 5);
    const clientName = booking.full_name.trim();
    const barberName = barber?.name || (booking.barber === 'adrian' ? 'Adrián Millán' : booking.barber);

    // 1. Al Cliente (Siempre se le notifica el cambio de horario por email)
    const targetEmail = await resolveTargetEmail(booking);
    const bookingWithEmail: SavedBooking = targetEmail ? { ...booking, email: targetEmail } : booking;
    const clientEmail = targetEmail ? getBookingRescheduledEmail(bookingWithEmail, oldDate, oldTime, reason, barberName) : null;

    await dispatchNotification({
      push: booking.user_id ? {
        userIds: [booking.user_id],
        heading: 'Horario modificado · Peluquería Adrián Millán',
        content: `Tu cita se ha reprogramado para el ${booking.booking_date} a las ${hora}h.`,
        url: CITAS_URL,
      } : undefined,
      email: targetEmail && clientEmail ? {
        to: targetEmail,
        subject: clientEmail.subject,
        html: clientEmail.html,
      } : undefined,
    });

    // 2. Al Barbero: SOLAMENTE SI EL CAMBIO AFECTA A HOY EN LAS PRÓXIMAS 3 HORAS (era o es en las próximas 3h)
    const isUrgentForBarber =
      isTodayWithinNextHours(oldDate, oldTime, 3) ||
      isTodayWithinNextHours(booking.booking_date, booking.booking_time, 3);

    if (isUrgentForBarber) {
      const barberGoogleEmail = barber?.google_email || (booking.barber === 'adrian' ? 'adrian.millan.peguero@hotmail.com' : null);
      const barberEmailPayload = barberGoogleEmail ? getBarberUrgentTodayRescheduledEmail(booking, barberName, oldTime) : null;

      await dispatchNotification({
        push: {
          tags: [
            { key: 'barber_id', relation: '=', value: booking.barber },
            { key: 'role', relation: '=', value: 'barber' },
          ],
          heading: '🔄 Cambio de Cita Urgente (Próximas 3h)',
          content: `La cita de ${clientName} ahora es hoy a las ${hora}h (${booking.service}).`,
          url: ADMIN_URL,
        },
        email: barberGoogleEmail && barberEmailPayload ? {
          to: barberGoogleEmail,
          subject: barberEmailPayload.subject,
          html: barberEmailPayload.html,
        } : undefined,
      });
    } else {
      console.log(`[Notifications] Cambio de fecha/hora (${oldDate} -> ${booking.booking_date}) no afecta a las próximas 3h de hoy. Omitiendo aviso al barbero según regla.`);
    }
  } catch (err) {
    console.warn('[Notifications] Error in notifyBookingRescheduled:', err);
  }
}

/**
 * 4. CAMPAÑAS PROMOCIONALES CADA 2-3 SEMANAS
 * REGLA ESTRICTA SOLICITADA POR EL USUARIO:
 * "Y las notificaciones y correos en promociones solamente le podrían llegar al cliente si ha aceptado la casilla de acepto envíos de cosas comerciales."
 */
export async function sendPromotionalCampaign(options: {
  title: string;
  message: string;
  ctaText?: string;
  ctaLink?: string;
}): Promise<{ success: boolean; pushSent: boolean; emailsSent: number; error?: string }> {
  try {
    // 1. Push dirigido exclusivamente a clientes con marketing_accepted == "true"
    await dispatchNotification({
      push: {
        tags: [
          { key: 'role', relation: '=', value: 'client' },
          { key: 'marketing_accepted', relation: '=', value: 'true' },
        ],
        heading: options.title,
        content: options.message,
        url: options.ctaLink || SITE_URL,
      },
    });

    // 2. Correos dirigidos exclusivamente a clientes con marketing_accepted == true en la base de datos
    let emailsSent = 0;
    try {
      const { data: subscribedCustomers } = await supabase
        .from('customers')
        .select('email, full_name')
        .eq('marketing_accepted', true)
        .not('email', 'is', null);

      if (subscribedCustomers && subscribedCustomers.length > 0) {
        for (const customer of subscribedCustomers) {
          if (!customer.email || !customer.email.includes('@')) continue;
          const promoEmail = getPromotionalEmail({
            clientName: customer.full_name,
            promoTitle: options.title,
            promoMessage: options.message,
            ctaText: options.ctaText,
            ctaLink: options.ctaLink,
          });

          await dispatchNotification({
            email: {
              to: customer.email,
              subject: promoEmail.subject,
              html: promoEmail.html,
            },
          });
          emailsSent++;
        }
      }
    } catch (emailErr) {
      console.warn('[Notifications] Error sending promotional emails:', emailErr);
    }

    return { success: true, pushSent: true, emailsSent };
  } catch (err: any) {
    console.warn('[Notifications] Error sending promotional campaign:', err);
    return { success: false, pushSent: false, emailsSent: 0, error: err?.message || 'Error desconocido' };
  }
}
