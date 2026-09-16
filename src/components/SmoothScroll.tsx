import { ReactLenis, useLenis } from 'lenis/react';
import type { LenisRef } from 'lenis/react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import 'lenis/dist/lenis.css';

interface SmoothScrollProps {
  children: ReactNode;
}

export function SmoothScroll({ children }: SmoothScrollProps) {
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    // Global listener for data-lenis-start, data-lenis-stop, and data-lenis-toggle
    // Following official https://lenis-tricks.webflow.io patterns
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const stopTrigger = target.closest('[data-lenis-stop]');
      const startTrigger = target.closest('[data-lenis-start]');
      const toggleTrigger = target.closest('[data-lenis-toggle]');

      const lenisInstance = lenisRef.current?.lenis;
      if (!lenisInstance) return;

      if (stopTrigger) {
        lenisInstance.stop();
      } else if (startTrigger) {
        lenisInstance.start();
      } else if (toggleTrigger) {
        if (lenisInstance.isStopped) {
          lenisInstance.start();
        } else {
          lenisInstance.stop();
        }
      }
    };

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  return (
    <ReactLenis
      ref={lenisRef}
      root
      options={{
        lerp: 0.08,
        duration: 1.2,
        smoothWheel: true,
        syncTouch: true,
        syncTouchLerp: 0.08,
        touchInertiaExponent: 1.7,
        touchMultiplier: 1.15,
        wheelMultiplier: 0.85,
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        autoRaf: true,
      }}
    >
      {children}
    </ReactLenis>
  );
}

/**
 * Hook to pause background Lenis scrolling when a modal / overlay is active,
 * and resume it when closed.
 */
export function useLockScroll(locked: boolean) {
  const lenis = useLenis();
  useEffect(() => {
    if (!lenis) return;
    if (locked) {
      lenis.stop();
    } else {
      lenis.start();
    }
    return () => {
      lenis.start();
    };
  }, [lenis, locked]);
}

export { useLenis };
