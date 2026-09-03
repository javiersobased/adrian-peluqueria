import { useState, useEffect } from 'react';
import { StepHeader } from '@/components/ServiceStep';
import { fetchBarbers } from '@/data/services';
import type { Barber } from '@/types';
import { Check } from 'lucide-react';

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
      <StepHeader title="Elige tu barbero" subtitle="Paso 1 de 4" onBack={onBack} />

      <div className="px-5 pb-10 pt-4">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.25em] text-wood-light">Barbero</p>
          <p className="mt-1 text-sm text-marble/50">¿Con quién prefieres que te atiendan?</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-marble/20 border-t-wood" />
          </div>
        ) : barbers.length === 0 ? (
          <p className="py-20 text-center text-sm text-marble/50">No hay barberos disponibles.</p>
        ) : (
          <ul className="space-y-3">
            {barbers.map((b, i) => (
              <li key={b.id}>
                <button
                  onClick={() => onSelect(b)}
                  style={{ animationDelay: `${i * 0.08}s` }}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-marble/10 bg-marble/[0.03] p-4 text-left transition-all duration-200 hover:border-wood/40 hover:bg-marble/[0.07] active:scale-[0.98] animate-fade-up"
                >
                  {b.photo_url ? (
                    <img
                      src={b.photo_url}
                      alt={b.name}
                      className="h-14 w-14 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-wood to-wood-dark font-display text-xl font-semibold text-marble shadow-lg shadow-wood/20">
                      {b.initials}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-base font-semibold leading-tight text-marble">{b.name}</p>
                    <p className="mt-1 text-xs text-marble/55">{b.role}</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-marble/15 text-marble/40 transition-all duration-200 group-hover:border-wood group-hover:bg-wood group-hover:text-marble">
                    <Check className="h-4 w-4" strokeWidth={2} />
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
