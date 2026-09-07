import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function detectIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isAppleTouch = /iphone|ipad|ipod/i.test(ua);
  const isIpadOS = ua.includes('Macintosh') && 'ontouchend' in document;
  return isAppleTouch || isIpadOS;
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true;
}

/**
 * Handles the "Add to Home Screen" flow for both:
 * - Chrome/Edge/Android, which fire `beforeinstallprompt` and support a native prompt.
 * - iOS Safari, which has no such event; the caller should show manual instructions instead.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(detectStandalone());
  const isIOS = detectIOS();

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome;
  }, [deferredPrompt]);

  return {
    /** True when the browser has offered a native install prompt we can trigger. */
    canPromptInstall: !!deferredPrompt,
    /** True on iOS Safari, which needs manual "Compartir → Añadir a pantalla de inicio" instructions. */
    isIOS,
    /** True if the app is already running installed/standalone. */
    isStandalone,
    promptInstall,
  };
}
