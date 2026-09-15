import { useState, useEffect } from 'react';
import { fetchBarbers } from '@/data/services';
import type { Barber } from '@/types';
import { StepHeader } from '@/components/ServiceStep';
import { Check } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface BarberStepProps {
  onBack: () => void;
  onSelect: (b: Barber) => void;
}

export function BarberStep({ onBack, onSelect }: BarberStepProps) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBarbers().then((b) => {
      setBarbers(b);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen animate-slide-in">
      <StepHeader title="Elige tu barbero" subtitle="Paso 2 de 4" onBack={onBack} />

      <div className="px-4 pb-10 pt-2 sm:px-5 sm:pt-4">
        <p className="mb-3 text-xs sm:text-sm text-zinc-400">¿Con quién prefieres que te atiendan?</p>

        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" label="Cargando barberos…" />
          </div>
        ) : barbers.length === 0 ? (
          <p className="py-20 text-center text-sm text-zinc-500">No hay barberos disponibles.</p>
        ) : (
          <ul className="space-y-3">
            {barbers.map((b, i) => (
              <li key={b.id}>
                <button
                  onClick={() => onSelect(b)}
                  style={{ animationDelay: `${i * 0.08}s` }}
                  className="group flex w-full items-center gap-4 rounded-3xl glass-card p-4 text-left transition-all duration-300 hover:border-gold/30 hover:bg-zinc-850/80 active:scale-[0.98] animate-fade-up"
                >
                  {b.photo_url ? (
                    <img
                      src={b.photo_url}
                      alt={b.name}
                      className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl gold-gradient font-display text-xl font-bold text-black/80">
                      {b.initials}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-display text-base font-bold leading-tight text-white">{b.name}</p>
                    <p className="mt-1 text-xs text-zinc-400">{b.role}</p>
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-gold/10 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-gold">
                      Disponible
                    </span>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-zinc-500 transition-all duration-300 group-hover:border-gold group-hover:bg-gold group-hover:text-black">
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
