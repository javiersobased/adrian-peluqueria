import { useState } from 'react';
import { Download } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { InstallAppModal } from '@/components/InstallAppModal';

interface InstallAppButtonProps {
  appName: string;
  className?: string;
  compact?: boolean;
}

export function InstallAppButton({ appName, className = '', compact = false }: InstallAppButtonProps) {
  const { canPromptInstall, isStandalone, promptInstall } = usePwaInstall();
  const [showHelp, setShowHelp] = useState(false);

  if (isStandalone) return null;

  const handleClick = async () => {
    if (canPromptInstall) {
      await promptInstall();
      return;
    }
    setShowHelp(true);
  };

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

      <InstallAppModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        appName={appName}
      />
    </>
  );
}
