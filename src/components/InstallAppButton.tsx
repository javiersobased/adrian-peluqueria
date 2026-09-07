import { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';

interface InstallAppButtonProps {
  /** Shown in the iOS instructions dialog, e.g. "Reservas Adrián Millán". */
  appName: string;
  className?: string;
  /** Icon-only, for tight header spaces (mobile top bars). */
  compact?: boolean;
}

export function InstallAppButton({ appName, className = '', compact = false }: InstallAppButtonProps) {
  const { canPromptInstall, isIOS, isStandalone, promptInstall } = usePwaInstall();
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  if (isStandalone) return null;
  if (!canPromptInstall && !isIOS) return null;

  const handleClick = async () => {
    if (canPromptInstall) {
      await promptInstall();
      return;
    }
    setShowIOSHelp(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        aria-label={`Instalar ${appName} en el móvil`}
        title="Instalar app"
        className={
          compact
            ? `flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-gold/30 bg-black/40 text-gold backdrop-blur-md transition-colors hover:bg-gold/10 active:scale-95 ${className}`
            : `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gold/30 bg-black/40 px-3.5 py-2 text-xs font-semibold text-gold backdrop-blur-md transition-colors hover:bg-gold/10 active:scale-95 ${className}`
        }
      >
        <Download className={compact ? 'h-4 w-4' : 'h-3.5 w-3.5'} strokeWidth={2} />
        {!compact && 'Instalar app'}
      </button>

      {showIOSHelp && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setShowIOSHelp(false)}
        >
          <div
            className="m-4 w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-5 text-left shadow-2xl animate-fade-up"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-white">Añadir a pantalla de inicio</h3>
              <button
                onClick={() => setShowIOSHelp(false)}
                aria-label="Cerrar"
                className="text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ol className="space-y-3.5 text-sm text-zinc-300">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-gold/15 text-[0.65rem] font-bold text-gold">1</span>
                <span className="flex flex-wrap items-center gap-1">
                  Toca el icono <Share className="h-4 w-4 text-gold" /> <strong className="text-white">Compartir</strong> en Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-gold/15 text-[0.65rem] font-bold text-gold">2</span>
                <span className="flex flex-wrap items-center gap-1">
                  Selecciona <PlusSquare className="h-4 w-4 text-gold" /> <strong className="text-white">Añadir a pantalla de inicio</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-gold/15 text-[0.65rem] font-bold text-gold">3</span>
                <span>Confirma pulsando <strong className="text-white">Añadir</strong>.</span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
