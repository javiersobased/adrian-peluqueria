import OneSignal from 'react-onesignal';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from '@/types';

export const ONESIGNAL_APP_ID = '86a6a369-9e5f-472b-8461-cac4fb762af7';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

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
 * Requests native browser permission for push notifications
 */
export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    await initOneSignal();
    const permission = await OneSignal.Notifications.requestPermission();
    return permission;
  } catch (err) {
    console.warn('[OneSignal] Error requesting permission:', err);
    return false;
  }
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
