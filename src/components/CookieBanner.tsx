import { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      // Small delay so it transitions smoothly after initial render
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setVisible(false);
  };

  const handleEssentialOnly = () => {
    localStorage.setItem('cookie_consent', 'essential');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Aviso de cookies y almacenamiento"
      className="fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-xl animate-fade-up rounded-2xl border border-gold/25 bg-zinc-950/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl md:bottom-8 md:left-8 md:right-auto"
    >
      <div className="flex items-start gap-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
          <Cookie className="h-5 w-5" />
        </div>
        <div className="flex-1 text-xs text-zinc-300 leading-relaxed">
          <p className="font-semibold text-white text-sm mb-1">
            Privacidad & Cookies
          </p>
          <p>
            En Peluquería Adrián Millán utilizamos almacenamiento local y cookies técnicas estrictamente necesarias para el funcionamiento de tus reservas y la sesión. No empleamos cookies de rastreo publicitario.{' '}
            <a
              href="/legal/#cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold underline hover:text-gold-light"
            >
              Más información
            </a>.
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <button
              onClick={handleAccept}
              className="rounded-full gold-gradient px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-95 shadow-md"
            >
              Aceptar todas
            </button>
            <button
              onClick={handleEssentialOnly}
              className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition-all hover:bg-white/10 active:scale-95"
            >
              Solo necesarias
            </button>
          </div>
        </div>

        <button
          onClick={handleEssentialOnly}
          aria-label="Cerrar aviso de cookies"
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 -mr-1 -mt-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
