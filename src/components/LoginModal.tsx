import { ShieldCheck, LogIn, X } from 'lucide-react';

interface LoginModalProps {
  onGoogleSignIn: () => void;
  onClose: () => void;
  signingIn: boolean;
  purpose: 'booking' | 'general';
}

function GoogleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4c-7.4 0-13.8 4.1-17.1 10.1z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-1.8 14.1-5l-6.5-5.5c-2 1.4-4.6 2.3-7.6 2.3-5.2 0-9.7-3.4-11.3-8.1l-6.5 5C9.9 39.6 16.4 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C40.9 36.4 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

export function LoginModal({ onGoogleSignIn, onClose, signingIn, purpose }: LoginModalProps) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-900/70 p-6 shadow-2xl backdrop-blur-xl animate-scale-in">
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 text-zinc-500 transition-colors hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl gold-gradient">
            {purpose === 'booking' ? <ShieldCheck className="h-6 w-6 text-black" /> : <LogIn className="h-6 w-6 text-black" />}
          </div>
          {purpose === 'booking' ? (
            <>
              <h3 className="font-display text-xl font-bold text-white">Confirma que eres tú</h3>
              <p className="mt-1.5 px-2 text-xs leading-relaxed text-zinc-500">
                Para evitar citas falsas, inicia sesión con tu cuenta de Google antes de confirmar. Es rápido y no crearemos ninguna publicación en tu nombre.
              </p>
            </>
          ) : (
            <>
              <h3 className="font-display text-xl font-bold text-white">Iniciar sesión</h3>
              <p className="mt-1.5 px-2 text-xs leading-relaxed text-zinc-500">
                Accede con tu cuenta de Google. Si eres barbero o administrador, verás tu panel correspondiente.
              </p>
            </>
          )}
        </div>

        <button
          onClick={onGoogleSignIn}
          disabled={signingIn}
          className="flex w-full items-center justify-center gap-3 rounded-full bg-white py-3.5 text-sm font-bold text-zinc-800 shadow-lg transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-60"
        >
          {signingIn ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          ) : (
            <GoogleGlyph />
          )}
          {signingIn ? 'Conectando…' : 'Continuar con Google'}
        </button>

        {purpose === 'booking' && (
          <p className="mt-4 text-center text-[0.65rem] text-zinc-600">
            Tu cita se guarda automáticamente en cuanto inicies sesión, no hace falta rellenarla de nuevo.
          </p>
        )}
      </div>
    </div>
  );
}
