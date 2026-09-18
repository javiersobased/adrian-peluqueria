import OneSignal from 'react-onesignal';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from '@/types';

export const ONESIGNAL_APP_ID = '86a6a369-9e5f-472b-8461-cac4fb762af7';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

export type PushPermissionResult = {
  granted: boolean;
  status: 'granted' | 'denied' | 'unsupported' | 'ios_pwa_required';
};

function isIosNonStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isApple = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isApple && !isStandalone;
}

/**
 * Initializes OneSignal Web Push SDK
 */
export async function initOneSignal(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: {
          enable: false, // We use custom subtle prompts instead of the default intrusive bell
        } as any,
        promptOptions: {
          slidedown: {
            prompts: [
              {
                type: 'push',
                autoPrompt: false,
                text: {
                  actionMessage: '¿Deseas recibir avisos de tu cita y recordatorios en tu móvil?',
                  acceptButton: 'Permitir',
                  cancelButton: 'Ahora no',
                },
                delay: {
                  pageViews: 1,
                  timeDelay: 0,
                },
              },
            ],
          },
        },
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: '/OneSignalSDKWorker.js',
      });
      isInitialized = true;
    } catch (err) {
      console.warn('[OneSignal] Initialized or failed to init:', err);
    }
  })();

  return initPromise;
}

/**
 * Synchronizes authenticated user identity and segmentation tags with OneSignal.
 * Separates clients from barbers, and records marketing consent.
 */
export async function syncOneSignalUser(
  user: User | null | undefined,
  role: UserRole | null | undefined
): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    await initOneSignal();

    if (user) {
      // Set external user id in OneSignal so notifications can be targeted by user_id
      try {
        await OneSignal.login(user.id);
      } catch (err) {
        console.warn('[OneSignal] Error on login:', err);
      }

      const isAdmin = role?.role === 'admin';
      const isBarber = role?.role === 'barber' || isAdmin;
      const barberId = role?.barber_id || (isAdmin ? 'adrian' : '');

      // Determine marketing acceptance
      const marketingAccepted = Boolean(
        user.user_metadata?.marketing_accepted ??
        (localStorage.getItem(`marketing_accepted_${user.id}`) === 'true')
      );

      const tags: Record<string, string> = {
        role: isBarber ? 'barber' : 'client',
        is_admin: isAdmin ? 'true' : 'false',
        marketing_accepted: marketingAccepted ? 'true' : 'false',
      };

      if (barberId) {
        tags.barber_id = barberId;
      }

      if (user.email) {
        tags.email = user.email.toLowerCase().trim();
      }

      try {
        await OneSignal.User.addTags(tags);
      } catch (err) {
        console.warn('[OneSignal] Error adding tags:', err);
      }
    } else {
      // Anonymous / logged-out user
      try {
        await OneSignal.logout();
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.warn('[OneSignal] Error during user sync:', err);
  }
}

/**
 * Requests native browser permission for push notifications.
 * Preserves transient user activation by calling Notification.requestPermission() immediately.
 */
export async function requestPushPermission(): Promise<PushPermissionResult> {
  if (typeof window === 'undefined') return { granted: false, status: 'unsupported' };

  // 1. iOS Safari check: Web push requires PWA (Home Screen) in iOS
  if (isIosNonStandalone()) {
    return { granted: false, status: 'ios_pwa_required' };
  }

  // 2. Check native Notification status
  if ('Notification' in window) {
    if (Notification.permission === 'denied') {
      console.warn('[Push] Notifications are blocked by user in browser settings');
      return { granted: false, status: 'denied' };
    }

    if (Notification.permission === 'granted') {
      initOneSignal()
        .then(() => OneSignal.User.PushSubscription.optIn())
        .catch(() => {});
      return { granted: true, status: 'granted' };
    }

    // Synchronously initiate permission request within the user gesture context!
    let nativePerm: NotificationPermission = 'default';
    try {
      nativePerm = await Notification.requestPermission();
    } catch (e) {
      console.warn('[Push] Notification.requestPermission failed:', e);
    }

    if (nativePerm === 'granted') {
      try {
        await initOneSignal();
        await OneSignal.User.PushSubscription.optIn();
      } catch (e) {
        console.warn('[OneSignal] optIn error after grant:', e);
      }
      return { granted: true, status: 'granted' };
    }

    if (nativePerm === 'denied') {
      return { granted: false, status: 'denied' };
    }
  }

  // 3. Fallback to OneSignal Slidedown (in-page prompt that cannot be suppressed by browsers)
  try {
    await initOneSignal();
    if (OneSignal.Slidedown) {
      await OneSignal.Slidedown.promptPush({ force: true });
    } else if (OneSignal.Notifications) {
      const permission = await OneSignal.Notifications.requestPermission();
      if (permission) {
        await OneSignal.User.PushSubscription.optIn().catch(() => {});
        return { granted: true, status: 'granted' };
      }
    }
  } catch (err) {
    console.warn('[OneSignal] Error requesting permission via fallback:', err);
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    return { granted: true, status: 'granted' };
  }

  return {
    granted: false,
    status: 'Notification' in window && Notification.permission === 'denied' ? 'denied' : 'unsupported',
  };
}

/**
 * Updates marketing consent tag specifically
 */
export async function updateOneSignalMarketingConsent(accepted: boolean): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await initOneSignal();
    await OneSignal.User.addTag('marketing_accepted', accepted ? 'true' : 'false');
  } catch (err) {
    console.warn('[OneSignal] Error updating marketing tag:', err);
  }
}
