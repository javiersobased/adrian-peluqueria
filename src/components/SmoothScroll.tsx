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
    // Detect mobile / touch device
    const checkDevice = () => {
      const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 768 || window.matchMedia('(pointer: coarse)').matches);
      const lenisInstance = lenisRef.current?.lenis;
      if (!lenisInstance) return;

      if (isMobile) {
        // Detener Lenis por completo en dispositivos móviles para delegar al scroll táctil nativo del SO
        // y evitar cualquier conflicto con gestos de arrastre, tirones o desplazamientos hacia arriba
        lenisInstance.stop();
        document.documentElement.classList.remove('lenis');
      } else {
        lenisInstance.start();
      }
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => {
      window.removeEventListener('resize', checkDevice);
    };
  }, []);

  useEffect(() => {
    // Global listener for data-lenis-start, data-lenis-stop, and data-lenis-toggle
    // Following official https://lenis-tricks.webflow.io patterns
    const handleDocumentClick = (e: MouseEvent) => {
      const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 768 || window.matchMedia('(pointer: coarse)').matches);
      if (isMobile) return;

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
        lerp: 0.1,
        duration: 1.0,
        smoothWheel: true,
        syncTouch: false,
        touchMultiplier: 0,
        wheelMultiplier: 0.9,
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        autoRaf: true,
        prevent: (node: any) => {
          if (!node || !(node instanceof HTMLElement)) return false;
          if (node.closest('[data-lenis-prevent], .no-lenis, .admin-embed, [role="dialog"], .overflow-y-auto, .overflow-y-scroll')) {
            return true;
          }
          let curr: HTMLElement | null = node;
          while (curr && curr !== document.body && curr !== document.documentElement) {
            const style = window.getComputedStyle(curr);
            const overflowY = style.overflowY;
            if ((overflowY === 'auto' || overflowY === 'scroll') && curr.scrollHeight > curr.clientHeight) {
              return true;
            }
            const overflowX = style.overflowX;
            if ((overflowX === 'auto' || overflowX === 'scroll') && curr.scrollWidth > curr.clientWidth) {
              return true;
            }
            curr = curr.parentElement;
          }
          return false;
        },
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
    const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 768 || window.matchMedia('(pointer: coarse)').matches);
    if (lenis && !isMobile) {
      if (locked) {
        lenis.stop();
      } else {
        lenis.start();
      }
      return () => {
        lenis.start();
      };
    } else {
      if (locked) {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
          document.body.style.overflow = originalOverflow;
        };
      }
    }
  }, [lenis, locked]);
}

export { useLenis };
