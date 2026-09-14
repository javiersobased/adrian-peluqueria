import { useState } from 'react';
import { X, Share, PlusSquare, Smartphone, Chrome, Download, CheckCircle2, ArrowRight } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  appName?: string;
}

export function InstallAppModal({ isOpen, onClose, appName = 'Adrián Millán' }: InstallAppModalProps) {
  const { canPromptInstall, isIOS, promptInstall } = usePwaInstall();
  const isAndroidInitial = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  const [platform, setPlatform] = useState<'ios' | 'android'>(isIOS ? 'ios' : isAndroidInitial ? 'android' : 'ios');

  if (!isOpen) return null;

  const handleDirectInstall = async () => {
    if (canPromptInstall) {
      await promptInstall();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-gold/25 bg-zinc-950 p-6 shadow-2xl animate-scale-in text-left text-white max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gold-gradient shadow-md">
              <Download className="h-5 w-5 text-black" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">Instalar aplicación</h3>
              <p className="text-[0.7rem] text-zinc-400">Acceso rápido desde tu pantalla de inicio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Direct native install banner (Android Chrome / Edge / Desktop PWA) */}
        {canPromptInstall && (
          <div className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 p-3.5 flex items-center justify-between gap-3 animate-fade-up">
            <div>
              <p className="text-xs font-bold text-gold">¡Tu navegador permite instalación directa!</p>
              <p className="text-[0.7rem] text-zinc-300">Pulsa el botón para añadir {appName} con 1 clic.</p>
            </div>
            <button
              onClick={handleDirectInstall}
              className="shrink-0 rounded-full gold-gradient px-4 py-2 text-xs font-bold text-black uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md"
            >
              Instalar ya
            </button>
          </div>
        )}

        {/* Platform tabs */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-900/90 p-1 border border-white/5">
          <button
            onClick={() => setPlatform('ios')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-all ${
              platform === 'ios'
                ? 'bg-zinc-800 text-gold shadow-md border border-gold/20'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            iPhone / iOS (Safari)
          </button>
          <button
            onClick={() => setPlatform('android')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-all ${
              platform === 'android'
                ? 'bg-zinc-800 text-gold shadow-md border border-gold/20'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Chrome className="h-4 w-4" />
            Android (Chrome)
          </button>
        </div>

        {/* Scrollable Visual Steps */}
        <div className="mt-4 space-y-4 overflow-y-auto pr-1 no-scrollbar flex-1">
          {platform === 'ios' ? (
            <>
              {/* Step 1 iOS */}
              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 transition-all hover:border-gold/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/20 text-[0.65rem] font-bold text-gold">1</span>
                  <p className="text-xs font-bold text-white">Pulsa el botón Compartir en Safari</p>
                </div>
                <p className="text-[0.75rem] text-zinc-400 mb-3">
                  En la barra inferior de navegación de Safari en tu iPhone, toca el icono cuadrado con la flecha hacia arriba.
                </p>
                {/* Visual simulation card */}
                <div className="rounded-xl border border-white/10 bg-zinc-950 p-2.5 flex items-center justify-around text-zinc-500 text-xs">
                  <span className="opacity-40">◀</span>
                  <span className="opacity-40">▶</span>
                  <div className="flex items-center gap-1.5 rounded-lg bg-gold/20 border border-gold/40 px-3 py-1 text-gold font-bold animate-pulse">
                    <Share className="h-4 w-4" />
                    <span className="text-[0.65rem]">Compartir</span>
                  </div>
                  <span className="opacity-40">📖</span>
                  <span className="opacity-40">🗂️</span>
                </div>
              </div>

              {/* Step 2 iOS */}
              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 transition-all hover:border-gold/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/20 text-[0.65rem] font-bold text-gold">2</span>
                  <p className="text-xs font-bold text-white">Selecciona "Añadir a pantalla de inicio"</p>
                </div>
                <p className="text-[0.75rem] text-zinc-400 mb-3">
                  Baja un poco en el menú de opciones hasta encontrar la opción con el símbolo más (+).
                </p>
                {/* Visual simulation card */}
                <div className="rounded-xl border border-white/10 bg-zinc-950 p-2.5 flex items-center justify-between text-xs text-white">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/20 text-gold">
                      <PlusSquare className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-xs">Añadir a pantalla de inicio</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gold" />
                </div>
              </div>

              {/* Step 3 iOS */}
              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 transition-all hover:border-gold/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/20 text-[0.65rem] font-bold text-gold">3</span>
                  <p className="text-xs font-bold text-white">Confirma pulsando "Añadir"</p>
                </div>
                <p className="text-[0.75rem] text-zinc-400 mb-3">
                  Toca "Añadir" en la esquina superior derecha y la app aparecerá en tu escritorio como una aplicación nativa.
                </p>
                {/* Visual simulation card */}
                <div className="rounded-xl border border-white/10 bg-zinc-950 p-2.5 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Cancelar</span>
                  <span className="font-bold text-zinc-300">{appName}</span>
                  <span className="font-bold text-gold rounded-md bg-gold/15 px-2.5 py-1">Añadir</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Step 1 Android */}
              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 transition-all hover:border-gold/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/20 text-[0.65rem] font-bold text-gold">1</span>
                  <p className="text-xs font-bold text-white">Abre el menú de Chrome</p>
                </div>
                <p className="text-[0.75rem] text-zinc-400 mb-3">
                  En la parte superior derecha de tu navegador Chrome, pulsa sobre los tres puntos verticales (⋮).
                </p>
                {/* Visual simulation card */}
                <div className="rounded-xl border border-white/10 bg-zinc-950 p-2.5 flex items-center justify-between text-xs">
                  <span className="text-zinc-400 truncate max-w-[200px]">adrianmillan.es</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-[0.65rem] border border-zinc-700 px-1 rounded">1</span>
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gold/20 text-gold font-bold">
                      ⋮
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 Android */}
              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 transition-all hover:border-gold/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/20 text-[0.65rem] font-bold text-gold">2</span>
                  <p className="text-xs font-bold text-white">Elige "Instalar aplicación" o "Añadir a inicio"</p>
                </div>
                <p className="text-[0.75rem] text-zinc-400 mb-3">
                  Busca la opción que indica instalar o añadir a la pantalla de inicio.
                </p>
                {/* Visual simulation card */}
                <div className="rounded-xl border border-white/10 bg-zinc-950 p-2.5 flex items-center justify-between text-xs text-white">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/20 text-gold">
                      <Download className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-xs">Instalar aplicación</span>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-gold" />
                </div>
              </div>

              {/* Step 3 Android */}
              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 transition-all hover:border-gold/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/20 text-[0.65rem] font-bold text-gold">3</span>
                  <p className="text-xs font-bold text-white">Confirma la instalación</p>
                </div>
                <p className="text-[0.75rem] text-zinc-400 mb-3">
                  Acepta el mensaje emergente y la app se añadirá directamente a tus aplicaciones.
                </p>
                {/* Visual simulation card */}
                <div className="rounded-xl border border-white/10 bg-zinc-950 p-2.5 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">¿Instalar aplicación?</span>
                  <span className="font-bold text-gold rounded-md bg-gold/20 border border-gold/40 px-3 py-1">Instalar</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full rounded-full gold-gradient py-3 text-xs font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98] shadow-lg"
          >
            ¡Entendido!
          </button>
        </div>
      </div>
    </div>
  );
}
