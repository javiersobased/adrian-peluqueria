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
 * Helper to check if a booking date is today in local time
 */
function isDateToday(dateIso?: string | null): boolean {
  if (!dateIso) return false;
  const today = toISO(new Date());
  return dateIso === today;
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
    // 1. Send via Supabase Edge Function
    const { error } = await supabase.functions.invoke('notificar-reserva', {
      body: payload,
    });
    if (error) {
      console.warn('[Notifications] Edge Function warning:', error.message);
    }
  } catch (err) {
    console.warn('[Notifications] Edge function dispatch failed, falling back:', err);
  }
}

/**
 * 1. NOTIFICACIÓN DE CITA CONFIRMADA
 * Dispara:
 * - Push al Cliente (con link a sus citas)
 * - Email al Cliente (plantilla dorada completa)
 * - Push al Barbero (nueva cita recibida, link al panel)
 * - Email al Barbero (datos completos del cliente)
 */
export async function notifyBookingConfirmed(booking: SavedBooking, barber?: Barber | null) {
  try {
    const hora = booking.booking_time.slice(0, 5);
    const clientName = booking.full_name.trim();
    const barberName = barber?.name || (booking.barber === 'adrian' ? 'Adrián Millán' : booking.barber);

    // 1. Al Cliente
    const clientEmail = booking.email ? getBookingConfirmationEmail(booking) : null;

    await dispatchNotification({
      push: booking.user_id ? {
        userIds: [booking.user_id],
        heading: 'Cita Confirmada · Peluquería Adrián Millán',
        content: `¡Te esperamos el ${booking.booking_date} a las ${hora}h!`,
        url: CITAS_URL,
      } : undefined,
      email: booking.email && clientEmail ? {
        to: booking.email,
        subject: clientEmail.subject,
        html: clientEmail.html,
      } : undefined,
    });

    // 2. Al Barbero (Siempre se avisa de una nueva reserva)
    const barberGoogleEmail = barber?.google_email || (booking.barber === 'adrian' ? 'adrian.millan.peguero@hotmail.com' : null);
    const barberEmailPayload = barberGoogleEmail ? getBarberNewBookingEmail(booking, barberName) : null;

    await dispatchNotification({
      push: {
        tags: [
          { key: 'barber_id', relation: '=', value: booking.barber },
          { key: 'role', relation: '=', value: 'barber' },
        ],
        heading: '✂️ Nueva Cita Reservada',
        content: `${clientName} ha reservado para el ${booking.booking_date} a las ${hora}h (${booking.service}).`,
        url: ADMIN_URL,
      },
      email: barberGoogleEmail && barberEmailPayload ? {
        to: barberGoogleEmail,
        subject: barberEmailPayload.subject,
        html: barberEmailPayload.html,
      } : undefined,
    });
  } catch (err) {
    console.warn('[Notifications] Error in notifyBookingConfirmed:', err);
  }
}

/**
 * 2. NOTIFICACIÓN DE CITA CANCELADA
 * REGLA ESTRICTA SOLICITADA POR EL USUARIO:
 * "El aviso al barbero de una cita cancelada o cambiada de horario solamente debería ocurrir si la cita es en el mismo día, no de días posteriores."
 */
export async function notifyBookingCancelled(booking: SavedBooking, barber?: Barber | null) {
  try {
    const hora = booking.booking_time.slice(0, 5);
    const clientName = booking.full_name.trim();
    const barberName = barber?.name || (booking.barber === 'adrian' ? 'Adrián Millán' : booking.barber);
    const isToday = isDateToday(booking.booking_date);

    // 1. Al Cliente (Siempre se le notifica la cancelación de su cita)
    const clientEmail = booking.email ? getBookingCancelledEmail(booking) : null;

    await dispatchNotification({
      push: booking.user_id ? {
        userIds: [booking.user_id],
        heading: 'Cita Cancelada · Peluquería Adrián Millán',
        content: `Tu cita del ${booking.booking_date} a las ${hora}h ha sido cancelada.`,
        url: CITAS_URL,
      } : undefined,
      email: booking.email && clientEmail ? {
        to: booking.email,
        subject: clientEmail.subject,
        html: clientEmail.html,
      } : undefined,
    });

    // 2. Al Barbero: SOLAMENTE SI ES EN EL MISMO DÍA (HOY)
    if (isToday) {
      const barberGoogleEmail = barber?.google_email || (booking.barber === 'adrian' ? 'adrian.millan.peguero@hotmail.com' : null);
      const barberEmailPayload = barberGoogleEmail ? getBarberUrgentTodayCancellationEmail(booking, barberName) : null;

      await dispatchNotification({
        push: {
          tags: [
            { key: 'barber_id', relation: '=', value: booking.barber },
            { key: 'role', relation: '=', value: 'barber' },
          ],
          heading: '⚠️ Cita de HOY Cancelada',
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
      console.log(`[Notifications] Cita cancelada para fecha posterior (${booking.booking_date}). Omitiendo aviso urgente al barbero según regla.`);
    }
  } catch (err) {
    console.warn('[Notifications] Error in notifyBookingCancelled:', err);
  }
}

/**
 * 3. NOTIFICACIÓN DE CITA CAMBIADA / REORGANIZADA
 * REGLA ESTRICTA SOLICITADA POR EL USUARIO:
 * "El aviso al barbero de una cita cancelada o cambiada de horario solamente debería ocurrir si la cita es en el mismo día, no de días posteriores."
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
    
    // El cambio afecta a hoy si la fecha anterior era hoy O la nueva fecha es hoy
    const affectsToday = isDateToday(oldDate) || isDateToday(booking.booking_date);

    // 1. Al Cliente
    const clientEmail = booking.email ? getBookingRescheduledEmail(booking, oldDate, oldTime, reason) : null;

    await dispatchNotification({
      push: booking.user_id ? {
        userIds: [booking.user_id],
        heading: 'Horario modificado · Peluquería Adrián Millán',
        content: `Tu cita se ha reprogramado para el ${booking.booking_date} a las ${hora}h.`,
        url: CITAS_URL,
      } : undefined,
      email: booking.email && clientEmail ? {
        to: booking.email,
        subject: clientEmail.subject,
        html: clientEmail.html,
      } : undefined,
    });

    // 2. Al Barbero: SOLAMENTE SI AFECTA AL MISMO DÍA (HOY)
    if (affectsToday) {
      const barberGoogleEmail = barber?.google_email || (booking.barber === 'adrian' ? 'adrian.millan.peguero@hotmail.com' : null);
      const barberEmailPayload = barberGoogleEmail ? getBarberUrgentTodayRescheduledEmail(booking, barberName, oldTime) : null;

      await dispatchNotification({
        push: {
          tags: [
            { key: 'barber_id', relation: '=', value: booking.barber },
            { key: 'role', relation: '=', value: 'barber' },
          ],
          heading: '🔄 Cambio de Cita de HOY',
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
      console.log(`[Notifications] Cambio de fecha posterior (${oldDate} -> ${booking.booking_date}). Omitiendo aviso urgente al barbero según regla.`);
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
            title: options.title,
            message: options.message,
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
