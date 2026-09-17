import { useState, useEffect, useRef } from 'react';
import { X, Share, PlusSquare, Smartphone, Chrome, Download, CheckCircle2, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { useLockScroll } from '@/components/SmoothScroll';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  appName?: string;
}

export function InstallAppModal({ isOpen, onClose, appName = 'Adrián Millán' }: InstallAppModalProps) {
  useLockScroll(isOpen);
  const { canPromptInstall, isIOS, promptInstall } = usePwaInstall();
  const isAndroidInitial = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  const [platform, setPlatform] = useState<'ios' | 'android'>(isIOS ? 'ios' : isAndroidInitial ? 'android' : 'ios');
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-advance slides every 3.5 seconds
  useEffect(() => {
    if (!isOpen || isPaused) return;
    timerRef.current = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 3);
    }, 3500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isPaused, platform]);

  if (!isOpen) return null;

  const handleDirectInstall = async () => {
    if (canPromptInstall) {
      await promptInstall();
      onClose();
    }
  };

  const nextStep = () => setActiveStep((prev) => (prev + 1) % 3);
  const prevStep = () => setActiveStep((prev) => (prev - 1 + 3) % 3);

  const iosSteps = [
    {
      title: 'Toca el botón Compartir',
      subtitle: 'En la barra inferior de Safari en tu iPhone',
      detail: 'Pulsa el icono de compartir (el cuadrado con la flecha hacia arriba) que verás abajo del navegador.',
    },
    {
      title: 'Selecciona "Añadir a pantalla de inicio"',
      subtitle: 'Desliza el menú de opciones hacia abajo',
      detail: 'Busca la opción con el símbolo más (+) llamada "Añadir a pantalla de inicio".',
    },
    {
      title: 'Pulsa "Añadir" en la esquina',
      subtitle: '¡Y listo! App instalada al instante',
      detail: 'Confirma en la esquina superior derecha. El icono de Adrián Millán aparecerá en tu escritorio como una app nativa.',
    },
  ];

  const androidSteps = [
    {
      title: 'Abre el menú de Chrome',
      subtitle: 'En la esquina superior derecha',
      detail: 'Toca los tres puntos verticales (⋮) que aparecen junto a la barra de direcciones de Chrome.',
    },
    {
      title: 'Elige "Instalar aplicación"',
      subtitle: 'O "Añadir a pantalla de inicio"',
      detail: 'En el menú desplegable, pulsa sobre la opción "Instalar aplicación" o "Añadir a inicio".',
    },
    {
      title: 'Confirma la instalación',
      subtitle: 'Acceso directo en tus aplicaciones',
      detail: 'Acepta el mensaje emergente y la aplicación se añadirá con su propio icono sin ocupar espacio.',
    },
  ];

  const currentSteps = platform === 'ios' ? iosSteps : androidSteps;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto bg-black/85 p-3 sm:p-4 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        data-lenis-prevent
        className="relative my-auto w-full max-w-sm rounded-[2rem] border border-gold/25 bg-zinc-950 p-4 sm:p-5 shadow-2xl animate-scale-in text-left text-white max-h-[96dvh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Header - Fixed at top, NEVER cut off */}
        <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl gold-gradient shadow-md">
              <Download className="h-4 w-4 text-black" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-white">Instalar aplicación</h3>
              <p className="text-[0.65rem] text-zinc-400">Peluquería Adrián Millán en tu móvil</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Scrollable Container for middle content */}
        <div data-lenis-prevent className="flex-1 overflow-y-auto min-h-0 py-2.5 space-y-2.5 pr-0.5">
          {/* Direct native install banner */}
          {canPromptInstall && (
            <div className="rounded-xl border border-gold/40 bg-gold/10 p-2.5 flex items-center justify-between gap-2 shrink-0 animate-fade-up">
              <div>
                <p className="text-[0.75rem] font-bold text-gold">¡Instalación directa disponible!</p>
                <p className="text-[0.65rem] text-zinc-300">Añade la app a tu teléfono con un clic.</p>
              </div>
              <button
                onClick={handleDirectInstall}
                className="shrink-0 rounded-full gold-gradient px-3 py-1.5 text-[0.7rem] font-bold text-black uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md"
              >
                Instalar ya
              </button>
            </div>
          )}

          {/* Platform tabs */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-zinc-900/90 p-1 border border-white/5 shrink-0">
            <button
              onClick={() => { setPlatform('ios'); setActiveStep(0); }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                platform === 'ios'
                  ? 'bg-zinc-800 text-gold shadow-md border border-gold/20'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              iPhone (Safari)
            </button>
            <button
              onClick={() => { setPlatform('android'); setActiveStep(0); }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                platform === 'android'
                  ? 'bg-zinc-800 text-gold shadow-md border border-gold/20'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Chrome className="h-3.5 w-3.5" />
              Android (Chrome)
            </button>
          </div>

          {/* Realistic Phone Simulation Embed */}
          <div className="flex justify-center shrink-0">
            <div className="relative w-[210px] h-[195px] sm:w-[225px] sm:h-[210px] rounded-[1.75rem] border-[3px] border-zinc-700 bg-black p-1 shadow-2xl overflow-hidden ring-1 ring-white/10">
              {/* Phone Speaker / Dynamic Island */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 h-3 w-14 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-end pr-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-800 ring-1 ring-zinc-700" />
              </div>

              {/* Screen Inner Container with exact website aesthetic */}
              <div className="relative w-full h-full rounded-[1.4rem] bg-zinc-950 overflow-hidden flex flex-col justify-between border border-white/5 select-none">
                {/* Background gradient y wallpaper matching site */}
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-zinc-900/90 via-black to-zinc-950" />
                <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gold/10 blur-2xl pointer-events-none" />

                {/* Status Bar */}
                <div className="pt-1 px-2.5 flex items-center justify-between text-[0.55rem] text-zinc-400 z-20">
                  <span className="font-semibold text-white">9:41</span>
                  <div className="flex items-center gap-1">
                    <span>5G</span>
                    <div className="w-3 h-1.5 rounded-[2px] border border-zinc-500 p-[1px] flex items-center">
                      <div className="w-full h-full bg-white rounded-[1px]" />
                    </div>
                  </div>
                </div>

                {/* Top Bar for Android (Chrome) */}
                {platform === 'android' && (
                  <div className="mt-0.5 mx-2 rounded-lg bg-zinc-900 border border-white/10 px-2 py-0.5 flex items-center justify-between text-[0.6rem] text-zinc-300 z-20 shadow-sm">
                    <div className="flex items-center gap-1 text-zinc-400">
                      <span className="text-[0.55rem]">🔒</span>
                      <span className="text-white font-medium truncate max-w-[95px]">adrianmillan.es</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[0.5rem] font-bold border border-zinc-700 px-1 rounded text-zinc-400">1</span>
                      <div className={`flex items-center justify-center h-4 w-4 rounded transition-all ${activeStep === 0 ? 'bg-gold text-black font-extrabold ring-2 ring-gold/30 animate-pulse' : 'text-zinc-300'}`}>
                        ⋮
                      </div>
                    </div>
                  </div>
                )}

                {/* Central Website Content Mockup */}
                <div className="px-2 py-0.5 flex-1 flex flex-col items-center justify-center text-center z-10">
                  <div className="w-7 h-7 rounded-lg gold-gradient flex items-center justify-center text-black font-extrabold text-[0.65rem] shadow-md mb-1">
                    AM
                  </div>
                  <p className="text-[0.55rem] font-bold uppercase tracking-wider text-gold">Huelva</p>
                  <p className="text-[0.7rem] font-bold text-white leading-tight">Adrián Millán</p>
                  <div className="mt-1 rounded-full gold-gradient px-2.5 py-0.5 text-[0.55rem] font-bold text-black uppercase tracking-wider shadow">
                    Reservar Cita
                  </div>
                </div>

                {/* STEP VISUAL OVERLAYS */}
                {platform === 'ios' ? (
                  <>
                    {/* Step 2 iOS: Share Sheet Sliding up */}
                    {activeStep === 1 && (
                      <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-2xl bg-zinc-900/95 border-t border-gold/30 p-2 backdrop-blur-xl animate-slide-up shadow-2xl">
                        <div className="w-6 h-1 rounded-full bg-zinc-700 mx-auto mb-1.5" />
                        <div className="flex items-center gap-1.5 mb-1.5 px-1">
                          <div className="w-4 h-4 rounded-md gold-gradient flex items-center justify-center text-[0.5rem] font-black text-black">AM</div>
                          <span className="text-[0.6rem] font-medium text-white truncate">Peluquería Adrián Millán</span>
                        </div>
                        <div className="rounded-lg bg-gold/20 border border-gold/60 p-1 flex items-center justify-between text-[0.6rem] text-gold font-bold ring-1 ring-gold/40 animate-pulse">
                          <div className="flex items-center gap-1">
                            <PlusSquare className="h-3 w-3" />
                            <span className="text-[0.55rem]">Añadir a inicio</span>
                          </div>
                          <span className="text-[0.55rem]">➕</span>
                        </div>
                      </div>
                    )}

                    {/* Step 3 iOS: Confirmation popup */}
                    {activeStep === 2 && (
                      <div className="absolute inset-x-2 bottom-5 z-30 rounded-xl bg-zinc-900/95 border border-gold/40 p-1.5 text-center backdrop-blur-xl animate-scale-in shadow-2xl">
                        <div className="flex items-center justify-between text-[0.55rem] border-b border-white/10 pb-1 mb-1">
                          <span className="text-zinc-500">Cancelar</span>
                          <span className="font-bold text-zinc-200">Añadir a inicio</span>
                          <span className="font-bold text-black bg-gold rounded px-1.5 py-0.5 animate-bounce">Añadir</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-1 text-left">
                          <div className="w-5 h-5 rounded-md gold-gradient flex items-center justify-center text-[0.5rem] font-extrabold text-black shrink-0">AM</div>
                          <span className="text-[0.55rem] text-white font-medium truncate">Peluquería Adrián Millán</span>
                        </div>
                      </div>
                    )}

                    {/* Bottom Safari Bar for iOS */}
                    <div className="pb-1 px-3 flex items-center justify-around text-zinc-500 text-[0.6rem] border-t border-white/10 bg-zinc-950/90 z-20">
                      <span>◀</span>
                      <span>▶</span>
                      <div className={`p-0.5 rounded-md transition-all ${activeStep === 0 ? 'bg-gold text-black ring-2 ring-gold/30 animate-pulse font-bold' : 'text-zinc-400'}`}>
                        <Share className="h-3 w-3" />
                      </div>
                      <span>📖</span>
                      <span>🗂️</span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Step 2 Android: Chrome menu open */}
                    {activeStep === 1 && (
                      <div className="absolute top-8 right-2 z-30 w-32 rounded-xl bg-zinc-900 border border-gold/40 p-1 backdrop-blur-xl shadow-2xl animate-fade-down text-left">
                        <div className="text-[0.55rem] text-zinc-400 px-1.5 py-0.5">Nueva pestaña</div>
                        <div className="text-[0.55rem] text-zinc-400 px-1.5 py-0.5">Descargas</div>
                        <div className="my-0.5 border-t border-white/5" />
                        <div className="rounded-lg bg-gold/25 border border-gold/60 px-1.5 py-0.5 text-[0.6rem] font-bold text-gold flex items-center gap-1 ring-1 ring-gold/40 animate-pulse">
                          <Download className="h-2.5 w-2.5" />
                          <span className="truncate">Instalar app</span>
                        </div>
                      </div>
                    )}

                    {/* Step 3 Android: Install prompt */}
                    {activeStep === 2 && (
                      <div className="absolute inset-x-2 bottom-2.5 z-30 rounded-xl bg-zinc-900 border border-gold/40 p-1.5 backdrop-blur-xl shadow-2xl animate-scale-in text-left">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-5 h-5 rounded-md gold-gradient flex items-center justify-center text-[0.5rem] font-black text-black">AM</div>
                          <div className="min-w-0">
                            <p className="text-[0.6rem] font-bold text-white truncate">Instalar aplicación</p>
                            <p className="text-[0.5rem] text-zinc-400">adrianmillan.es</p>
                          </div>
                        </div>
                        <div className="flex justify-end gap-1">
                          <span className="text-[0.55rem] text-zinc-400 px-1.5 py-0.5">Cancelar</span>
                          <span className="text-[0.55rem] font-bold text-black bg-gold rounded px-1.5 py-0.5 animate-bounce">Instalar</span>
                        </div>
                      </div>
                    )}

                    {/* Bottom Android soft bar */}
                    <div className="pb-1 pt-0.5 flex justify-center text-zinc-600 text-[0.6rem]">
                      <div className="w-12 h-1 rounded-full bg-zinc-700" />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Step Navigation Indicators (1, 2, 3) */}
          <div className="flex items-center justify-between gap-1 px-0.5 shrink-0">
            {[0, 1, 2].map((idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`flex-1 flex items-center justify-center gap-1 py-1 sm:py-1.5 rounded-xl text-[0.62rem] font-bold uppercase tracking-wider transition-all border ${
                  activeStep === idx
                    ? 'bg-gold/20 border-gold text-gold shadow-sm'
                    : 'bg-white/5 border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[0.55rem] ${activeStep === idx ? 'bg-gold text-black font-extrabold' : 'bg-zinc-800 text-zinc-400'}`}>
                  {idx + 1}
                </span>
                <span>Paso {idx + 1}</span>
              </button>
            ))}
          </div>

          {/* Active Step Description Card with slide sync */}
          <div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-2.5 sm:p-3 relative overflow-hidden shrink-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-gold" />
                  {currentSteps[activeStep].title}
                </p>
                <p className="text-[0.68rem] text-gold font-medium mt-0.5">
                  {currentSteps[activeStep].subtitle}
                </p>
                <p className="text-[0.65rem] text-zinc-400 leading-relaxed mt-1">
                  {currentSteps[activeStep].detail}
                </p>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-white/5">
              <button
                onClick={prevStep}
                className="flex items-center gap-1 text-[0.62rem] font-medium text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="h-3 w-3" /> Anterior
              </button>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      activeStep === i ? 'w-4 bg-gold' : 'w-1.5 bg-white/20'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={nextStep}
                className="flex items-center gap-1 text-[0.62rem] font-medium text-gold hover:underline transition-colors"
              >
                Siguiente <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Button - Fixed at bottom */}
        <div className="pt-2 sm:pt-2.5 border-t border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="w-full rounded-full gold-gradient py-2 sm:py-2.5 text-xs font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98] shadow-lg"
          >
            ¡Entendido, gracias!
          </button>
        </div>
      </div>
    </div>
  );
}

