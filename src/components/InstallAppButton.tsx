import { useState } from 'react';
import { Download, Share, PlusSquare, X, Smartphone, Chrome } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';

interface InstallAppButtonProps {
  appName: string;
  className?: string;
  compact?: boolean;
}

export function InstallAppButton({ appName, className = '', compact = false }: InstallAppButtonProps) {
  const { canPromptInstall, isIOS, isStandalone, promptInstall } = usePwaInstall();
  const [showHelp, setShowHelp] = useState(false);

  if (isStandalone) return null;
  if (!canPromptInstall && !isIOS) return null;

  const handleClick = async () => {
    if (canPromptInstall) {
      await promptInstall();
      return;
    }
    setShowHelp(true);
  };

  const isAndroid = /android/i.test(navigator.userAgent);

  return (
    <>
      <button
        onClick={handleClick}
        aria-label={`Instalar ${appName} en el móvil`}
        title="Instala nuestra app"
        className={
          compact
            ? `flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-gold/30 bg-black/40 text-gold backdrop-blur-md transition-all hover:bg-gold/10 active:scale-95 ${className}`
            : `inline-flex items-center gap-2 rounded-full border border-gold/30 bg-black/40 px-5 py-2.5 text-sm font-semibold text-gold backdrop-blur-md transition-all hover:bg-gold/10 active:scale-95 ${className}`
        }
      >
        <Download className={compact ? 'h-4 w-4' : 'h-4 w-4'} strokeWidth={2} />
        {!compact && 'Instala nuestra app'}
      </button>

      {showHelp && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="m-4 w-full max-w-sm rounded-3xl border border-gold/20 bg-zinc-900 p-6 text-left shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">Instalar app</h3>
              <button
                onClick={() => setShowHelp(false)}
                aria-label="Cerrar"
                className="text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gold-gradient">
                <Smartphone className="h-5 w-5 text-black" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{appName}</p>
                <p className="text-xs text-zinc-500">
                  {isIOS ? 'iOS · Safari' : isAndroid ? 'Android · Chrome' : 'Tu navegador'}
                </p>
              </div>
            </div>

            {isIOS ? (
              <ol className="space-y-4 text-sm text-zinc-300">
                <li className="flex items-start gap-3 animate-fade-up">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold">1</span>
                  <span className="flex flex-wrap items-center gap-1">
                    Toca el icono <Share className="h-4 w-4 text-gold" /> <strong className="text-white">Compartir</strong> en la barra inferior de Safari.
                  </span>
                </li>
                <li className="flex items-start gap-3 animate-fade-up" style={{ animationDelay: '0.1s' }}>
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold">2</span>
                  <span className="flex flex-wrap items-center gap-1">
                    Desplázate y selecciona <PlusSquare className="h-4 w-4 text-gold" /> <strong className="text-white">Añadir a pantalla de inicio</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3 animate-fade-up" style={{ animationDelay: '0.2s' }}>
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold">3</span>
                  <span>Pulsa <strong className="text-white">Añadir</strong> en la esquina superior derecha.</span>
                </li>
              </ol>
            ) : isAndroid ? (
              <ol className="space-y-4 text-sm text-zinc-300">
                <li className="flex items-start gap-3 animate-fade-up">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold">1</span>
                  <span className="flex flex-wrap items-center gap-1">
                    Toca el menú <Chrome className="h-4 w-4 text-gold" /> <strong className="text-white">⋮</strong> en la esquina superior derecha de Chrome.
                  </span>
                </li>
                <li className="flex items-start gap-3 animate-fade-up" style={{ animationDelay: '0.1s' }}>
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold">2</span>
                  <span>Selecciona <strong className="text-white">Añadir a pantalla de inicio</strong> o <strong className="text-white">Instalar app</strong>.</span>
                </li>
                <li className="flex items-start gap-3 animate-fade-up" style={{ animationDelay: '0.2s' }}>
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold">3</span>
                  <span>Confirma pulsando <strong className="text-white">Instalar</strong> o <strong className="text-white">Añadir</strong>.</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-4 text-sm text-zinc-300">
                <li className="flex items-start gap-3 animate-fade-up">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold">1</span>
                  <span>Toca el icono <Share className="h-4 w-4 text-gold" /> <strong className="text-white">Compartir</strong> o el menú del navegador.</span>
                </li>
                <li className="flex items-start gap-3 animate-fade-up" style={{ animationDelay: '0.1s' }}>
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold">2</span>
                  <span>Selecciona <strong className="text-white">Añadir a pantalla de inicio</strong>.</span>
                </li>
              </ol>
            )}

            <button
              onClick={() => setShowHelp(false)}
              className="mt-5 w-full rounded-full gold-gradient py-3 text-sm font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
