import { CheckIcon, CalendarIcon, ClockIcon, HomeIcon } from '@/components/icons';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { SavedBooking, Barber } from '@/types';
import { safeCap, googleCalendarUrl, downloadIcs } from '@/lib/calendar';
import { notifyBookingConfirmed } from '@/lib/notifications';
import { requestPushPermission } from '@/lib/onesignal';
import { notify } from '@/lib/notify';
import { SALON_ADDRESS } from '@/data/services';
import { Mail, Bell, Lock, Share2, PlusSquare, X } from 'lucide-react';

interface SuccessStepProps {
  booking: SavedBooking;
  onHome: () => void;
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function prettyDate(iso: string | null | undefined): string {
  if (!iso) return 'Fecha por confirmar';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return 'Fecha por confirmar';
  return `${safeCap(MONTHS_ES[d.getMonth()])} ${d.getDate()}, ${d.getFullYear()}`;
}

export function SuccessStep({ booking, onHome }: SuccessStepProps) {
  const [barber, setBarber] = useState<Barber | null>(null);
  const [showModal, setShowModal] = useState(true);
  const [enablingPush, setEnablingPush] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const notifiedBookingIdRef = useRef<string | null>(null);

  // Check if push/reminders have already been activated previously on this device/account
  const [alreadyConfigured, setAlreadyConfigured] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored =
      localStorage.getItem('push_notifications_enabled') === 'true' ||
      localStorage.getItem('notification_prompt_completed') === 'true';
    const browserGranted = 'Notification' in window && Notification.permission === 'granted';
    return stored || browserGranted;
  });

  // Disparar confirmación de cita (Push y Email) EXACTAMENTE UNA VEZ por cita
  useEffect(() => {
    if (!booking?.id) return;
    if (notifiedBookingIdRef.current === booking.id) return;
    notifiedBookingIdRef.current = booking.id;

    const resolveBarberAndNotify = async () => {
      let resolvedBarber: Barber | null = null;
      if (booking.barber) {
        try {
          const { data } = await supabase
            .from('barbers')
            .select('*')
            .eq('id', booking.barber)
            .maybeSingle();
          resolvedBarber = data as Barber | null;
          setBarber(resolvedBarber);
        } catch {
          // ignore
        }
      }
      // Envía push y email transaccional tanto al cliente como al barbero
      notifyBookingConfirmed(booking, resolvedBarber);

      // Despacho directo garantizado a sendBookingEmail
      const barberEmail = resolvedBarber?.google_email || (Array.isArray(resolvedBarber?.admin_emails) ? resolvedBarber?.admin_emails[0] : null);
      sendBookingEmail(booking, barberEmail, resolvedBarber?.name);
    };

    resolveBarberAndNotify();
  }, [booking?.id, booking?.barber]);

  const handleEnablePush = async () => {
    setEnablingPush(true);
    try {
      const res = await requestPushPermission();

      // En iOS Safari no-PWA, guiar para añadir a pantalla de inicio
      if (res.status === 'ios_pwa_required') {
        setShowIosModal(true);
        return;
      }

      // Si el usuario/navegador tiene denegadas las notificaciones
      if (res.status === 'denied') {
        setShowBlockedModal(true);
        return;
      }

      // Si el permiso fue otorgado
      if (res.granted) {
        setPushEnabled(true);
        setAlreadyConfigured(true);
        localStorage.setItem('push_notifications_enabled', 'true');
        localStorage.setItem('notification_prompt_completed', 'true');

        notify.success('¡Avisos activados!', 'Recibirás recordatorios de tu cita en tu móvil');
      } else {
        notify.error(
          'Permiso no concedido',
          'Puedes activarlo cuando quieras en la configuración de tu navegador.'
        );
      }
    } catch (err) {
      console.error('Error enabling push:', err);
    } finally {
      setEnablingPush(false);
    }
  };

  const gcalUrl = googleCalendarUrl({
    title: `Cita: ${booking?.service ?? 'Peluquería'}`,
    date: booking?.booking_date ?? '',
    time: booking?.booking_time ?? '',
    durationMin: 30,
    location: SALON_ADDRESS,
    details: `Barbero: ${barber?.name ?? booking?.barber ?? ''}`,
  });

  const handleAppleCalendar = () => {
    downloadIcs({
      title: `Cita: ${booking?.service ?? 'Peluquería'}`,
      date: booking?.booking_date ?? '',
      time: booking?.booking_time ?? '',
      durationMin: 30,
      location: SALON_ADDRESS,
      description: `Barbero: ${barber?.name ?? booking?.barber ?? ''}`,
    });
  };

  const safeTime = booking?.booking_time ?? '--:--';
  const safeName = booking?.full_name ?? 'Cliente';
  const safeService = booking?.service ?? 'Servicio';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center animate-fade-in">
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-ping rounded-full bg-gold/20" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full gold-gradient luxe-shadow animate-scale-in gold-glow">
          <CheckIcon className="h-12 w-12 text-black" />
        </div>
      </div>

      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Reserva confirmada</p>
      <h2 className="mt-3 font-display text-4xl font-bold text-white">¡Hasta pronto!</h2>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-400">
        Tu cita ha sido registrada correctamente. Te esperamos en la peluquería a la hora indicada.
      </p>

      <div className="mt-8 w-full max-w-sm rounded-3xl glass-panel p-6 text-left animate-fade-up">
        <div className="mb-4 border-b border-white/5 pb-4">
          <p className="text-[0.65rem] uppercase tracking-wider text-zinc-500">Servicio</p>
          <p className="mt-1 font-display text-xl font-bold text-white">{safeService}</p>
        </div>

        <div className="space-y-4">
          {barber && (
            <div className="flex items-center gap-3">
              {barber.photo_url ? (
                <img src={barber.photo_url} alt={barber.name} className="h-9 w-9 rounded-xl object-cover ring-1 ring-white/10" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl gold-gradient font-display text-xs font-bold text-black/80">
                  {barber.initials}
                </div>
              )}
              <div>
                <p className="text-[0.65rem] uppercase tracking-wider text-zinc-500">Barbero</p>
                <p className="text-sm font-medium text-white">{barber.name}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-4 w-4 text-gold" />
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-zinc-500">Fecha</p>
              <p className="text-sm font-medium text-white">{prettyDate(booking?.booking_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ClockIcon className="h-4 w-4 text-gold" />
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-zinc-500">Hora</p>
              <p className="text-sm font-medium text-white">{safeTime} h</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-4 w-4 items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-wider text-zinc-500">A nombre de</p>
              <p className="text-sm font-medium text-white">{safeName}</p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onHome}
        className="mt-10 inline-flex items-center gap-2 rounded-full glass-card px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition-all duration-300 hover:border-gold/30 active:scale-95"
      >
        <HomeIcon className="h-4 w-4" />
        Volver al inicio
      </button>

      {/* Success modal with calendar buttons */}
      {showModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fade-in"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-gold/20 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl animate-scale-in text-center">
            <button
              onClick={() => setShowModal(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="relative mx-auto mb-5 h-16 w-16">
              <div className="absolute inset-0 animate-ping rounded-full bg-gold/20" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full gold-gradient animate-scale-in">
                <CheckIcon className="h-8 w-8 text-black" />
              </div>
            </div>

            <h3 className="font-display text-xl font-bold text-white">¡Cita confirmada con éxito!</h3>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-zinc-300">
              Te hemos enviado los detalles a tu correo electrónico. Recuerda que las confirmaciones, cambios y cancelaciones se te enviarán <span className="text-gold font-semibold">siempre a tu email automáticamente</span>.
            </p>

            <div className="mt-5 space-y-2.5">
              <a
                href={gcalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-3 rounded-full bg-white/5 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98] border border-white/5 shadow-sm"
              >
                <img
                  src="/images/google-calendar.png"
                  alt="Google Calendar"
                  className="h-5 w-5 shrink-0 object-contain"
                />
                <span>Añadir a Google Calendar</span>
              </a>
              <button
                onClick={handleAppleCalendar}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-white/5 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98] border border-white/5 shadow-sm"
              >
                <img
                  src="/images/apple-logo.png"
                  alt="Apple Calendar"
                  className="h-5 w-5 shrink-0 object-contain"
                />
                <span>Añadir a Apple Calendar</span>
              </button>

              {!alreadyConfigured && !pushEnabled && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleEnablePush}
                    disabled={enablingPush}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-gold/15 px-5 py-3 text-sm font-bold text-gold transition-all hover:bg-gold/25 active:scale-[0.98] border border-gold/30 shadow-sm shadow-gold/10 disabled:opacity-60"
                  >
                    <Bell className="h-4 w-4 text-gold" />
                    <span>{enablingPush ? 'Activando avisos...' : 'Activar avisos y recordatorios en el móvil'}</span>
                  </button>
                  <p className="mt-1.5 text-[0.68rem] text-zinc-400">
                    Solo se te solicitará esta primera vez para avisarte en pantalla antes de tu cita.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full text-xs font-medium text-zinc-500 transition-colors hover:text-white"
            >
              Ver resumen de mi cita
            </button>
          </div>
        </div>
      )}

      {/* Modal explicativo si el navegador tiene bloqueadas las notificaciones (Brave / Chrome) */}
      {showBlockedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in"
            onClick={() => setShowBlockedModal(false)}
          />
          <div className="relative w-full max-w-sm rounded-3xl border border-gold/30 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl animate-scale-in text-left">
            <button
              onClick={() => setShowBlockedModal(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 text-zinc-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/30">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-display text-base font-bold text-white">Notificaciones bloqueadas</h4>
                <p className="text-[0.7rem] text-zinc-400">En tu navegador web</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Tu navegador tiene las notificaciones desactivadas o bloqueadas para este sitio. Para activarlas:
            </p>

            <ol className="my-4 space-y-2.5 text-xs text-zinc-300">
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 font-bold text-[0.7rem] text-gold">1</span>
                <span>Pulsa en el candado 🔒 o el escudo del navegador junto a la barra de dirección (URL).</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 font-bold text-[0.7rem] text-gold">2</span>
                <span>Busca <strong className="text-white">Permisos</strong> o <strong className="text-white">Notificaciones</strong> y cámbialo a <strong className="text-gold">Permitir</strong>.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 font-bold text-[0.7rem] text-gold">3</span>
                <span>Vuelve aquí y pulsa nuevamente en "Activar avisos y recordatorios".</span>
              </li>
            </ol>

            <button
              onClick={() => setShowBlockedModal(false)}
              className="w-full rounded-2xl gold-gradient py-2.5 text-xs font-bold text-black uppercase tracking-wider transition-all hover:brightness-110 active:scale-95"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal explicativo para iPhone (iOS Safari PWA) */}
      {showIosModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in"
            onClick={() => setShowIosModal(false)}
          />
          <div className="relative w-full max-w-sm rounded-3xl border border-gold/30 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl animate-scale-in text-left">
            <button
              onClick={() => setShowIosModal(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 text-zinc-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold border border-gold/30">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-display text-base font-bold text-white">Avisos en iPhone</h4>
                <p className="text-[0.7rem] text-zinc-400">Requisito del sistema iOS</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Apple solo permite recibir notificaciones en iPhone si añades la web a tu pantalla de inicio:
            </p>

            <ol className="my-4 space-y-2.5 text-xs text-zinc-300">
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 font-bold text-[0.7rem] text-gold">1</span>
                <span>
                  Pulsa el botón <strong className="text-white">Compartir</strong> <Share2 className="inline h-3.5 w-3.5 text-gold mx-0.5" /> en la barra inferior de Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 font-bold text-[0.7rem] text-gold">2</span>
                <span>
                  Selecciona <strong className="text-white">Añadir a la pantalla de inicio</strong> <PlusSquare className="inline h-3.5 w-3.5 text-gold mx-0.5" />.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 font-bold text-[0.7rem] text-gold">3</span>
                <span>Abre la app desde tu pantalla de inicio para recibir todos tus recordatorios.</span>
              </li>
            </ol>

            <button
              onClick={() => setShowIosModal(false)}
              className="w-full rounded-2xl gold-gradient py-2.5 text-xs font-bold text-black uppercase tracking-wider transition-all hover:brightness-110 active:scale-95"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
