import { useState, useEffect } from 'react';
import { fetchBarbers } from '@/data/services';
import type { Barber } from '@/types';
import { ArrowLeftIcon } from '@/components/icons';
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
      <div className="sticky top-0 z-30 glass-panel px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Volver"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-300 transition-colors hover:bg-white/10 active:scale-90"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-gold">Paso 1 de 4</p>
            <h2 className="font-display text-2xl font-bold leading-tight text-white">Elige tu barbero</h2>
          </div>
        </div>
      </div>

      <div className="px-5 pb-10 pt-4">
        <p className="mb-5 text-sm text-zinc-400">¿Con quién prefieres que te atiendan?</p>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-gold" />
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
