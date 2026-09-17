import { useState } from 'react';
import { ShieldCheck, LogOut, Check } from 'lucide-react';

interface TermsModalProps {
  onAccept: (options: { marketingAccepted: boolean }) => Promise<void>;
  onSignOut: () => Promise<void>;
  saving?: boolean;
}

export function TermsModal({ onAccept, onSignOut, saving = false }: TermsModalProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted || saving) return;
    await onAccept({ marketingAccepted });
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md animate-fade-in" />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md rounded-3xl border border-gold/30 bg-zinc-900/95 p-6 sm:p-7 shadow-2xl backdrop-blur-xl animate-scale-in text-left">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl gold-gradient text-black shadow-lg shadow-gold/20">
          <ShieldCheck className="h-6 w-6" />
        </div>

        <h2 className="text-center font-display text-xl font-bold text-white tracking-tight">
          Términos de Servicio y Privacidad
        </h2>
        <p className="mt-2 text-center text-xs text-zinc-400 leading-relaxed">
          Bienvenido a Peluquería Adrián Millán. Para tramitar tus citas de forma segura y cumplir con la legislación española (RGPD y LOPDGDD), confirma los siguientes puntos:
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Casilla 1: Obligatoria (Términos, Privacidad, +14 años, correos de cita) */}
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 cursor-pointer transition-colors hover:border-gold/30">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="peer h-5 w-5 appearance-none rounded-lg border border-white/30 bg-zinc-800 checked:border-gold checked:bg-gold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
              <Check className="pointer-events-none absolute h-3.5 w-3.5 text-black opacity-0 peer-checked:opacity-100 transition-opacity" />
            </div>
            <span className="text-xs text-zinc-300 leading-relaxed select-none">
              <strong className="text-white font-semibold">Obligatorio:</strong> He leído y acepto los{' '}
              <a
                href="/legal/#terminos-reserva"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold underline hover:text-gold-light"
                onClick={(e) => e.stopPropagation()}
              >
                términos y condiciones
              </a>
              {' '}y la{' '}
              <a
                href="/legal/#privacidad"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold underline hover:text-gold-light"
                onClick={(e) => e.stopPropagation()}
              >
                política de privacidad
              </a>
              , confirmo que tengo <strong className="text-gold">al menos 14 años</strong> y acepto recibir los correos de confirmación y recordatorio de mis citas.
            </span>
          </label>

          {/* Casilla 2: Opcional (Comunicaciones comerciales y promocionales) */}
          <label className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3 cursor-pointer transition-colors hover:border-white/15">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                checked={marketingAccepted}
                onChange={(e) => setMarketingAccepted(e.target.checked)}
                className="peer h-4 w-4 appearance-none rounded-md border border-white/20 bg-zinc-800 checked:border-gold checked:bg-gold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
              <Check className="pointer-events-none absolute h-3 w-3 text-black opacity-0 peer-checked:opacity-100 transition-opacity" />
            </div>
            <span className="text-[0.75rem] text-zinc-400 leading-relaxed select-none">
              Deseo recibir ocasionalmente ofertas especiales, descuentos y novedades exclusivas del salón por correo electrónico (puedes darte de baja cuando quieras).
            </span>
          </label>

          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              disabled={!termsAccepted || saving}
              className="w-full rounded-full gold-gradient py-3.5 text-xs font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-gold/15"
            >
              {saving ? 'Guardando preferencias…' : 'Aceptar y continuar'}
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut || saving}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-transparent py-2.5 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
            >
              <LogOut className="h-3.5 w-3.5" />
              {signingOut ? 'Cerrando sesión…' : 'Cancelar y cerrar sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
