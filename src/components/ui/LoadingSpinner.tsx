import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  className?: string;
}

export function LoadingSpinner({
  size = 'md',
  label,
  className = '',
}: LoadingSpinnerProps) {
  const sizeMap = {
    sm: { box: 'w-6 h-6', outer: 'border-[2px]', inner: 'border-[1.5px]' },
    md: { box: 'w-10 h-10', outer: 'border-[2.5px]', inner: 'border-[2px]' },
    lg: { box: 'w-14 h-14', outer: 'border-[3px]', inner: 'border-[2px]' },
    xl: { box: 'w-20 h-20', outer: 'border-[3.5px]', inner: 'border-[2.5px]' },
  };

  const { box, outer, inner } = sizeMap[size];

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status" aria-label={label || 'Cargando'}>
      <div className={`relative ${box}`}>
        {/* Outer glowing track */}
        <div
          className={`absolute inset-0 rounded-full border-zinc-800 ${outer}`}
        />
        {/* Outer spinning gold arc */}
        <div
          className={`absolute inset-0 rounded-full border-transparent border-t-gold border-r-gold/60 animate-spin ${outer}`}
          style={{ animationDuration: '1.1s', filter: 'drop-shadow(0 0 6px rgba(212, 175, 55, 0.45))' }}
        />
        {/* Inner reverse counter-spinning gold ring */}
        <div
          className={`absolute inset-1.5 rounded-full border-transparent border-b-gold-light border-l-gold/40 animate-spin ${inner}`}
          style={{ animationDirection: 'reverse', animationDuration: '0.85s' }}
        />
        {/* Center luminous gold dot for larger sizes */}
        {(size === 'lg' || size === 'xl') && (
          <div className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-gold animate-pulse shadow-[0_0_8px_#d4af37]" />
        )}
      </div>
      {label && (
        <p className="text-xs font-medium tracking-wider text-zinc-400 uppercase font-display">
          {label}
        </p>
      )}
    </div>
  );
}

export function ScreenLoader({ message = 'Cargando…' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-4 bg-black/85 backdrop-blur-md">
      <LoadingSpinner size="lg" />
      <p className="text-sm font-medium tracking-wide text-zinc-300 font-display">{message}</p>
    </div>
  );
}
