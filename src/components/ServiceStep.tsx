import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { fetchServices } from '@/data/services';
import type { Service } from '@/types';
import { ArrowLeftIcon } from '@/components/icons';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { BarberServiceIcon } from '@/components/icons/BarberServiceIcons';

interface ServiceStepProps {
  onBack: () => void;
  onSelect: (s: Service) => void;
}

export function ServiceStep({ onBack, onSelect }: ServiceStepProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices().then((s) => {
      setServices(s);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen animate-slide-in max-w-xl mx-auto w-full">
      <StepHeader title="Elige tu servicio" subtitle="Paso 1 de 4" onBack={onBack} />
      <div className="px-5 pb-10 pt-4">
        <p className="mb-5 text-sm text-zinc-400">Elige el servicio que necesitas</p>

        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" label="Cargando servicios…" />
          </div>
        ) : services.length === 0 ? (
          <p className="py-20 text-center text-sm text-zinc-500">No hay servicios disponibles.</p>
        ) : (
          <ul className="space-y-2.5">
            {services.map((service, i) => {
              return (
                <li key={service.id}>
                  <button
                    onClick={() => onSelect(service)}
                    style={{ animationDelay: `${i * 0.05}s` }}
                    className="group flex w-full items-center gap-4 rounded-3xl glass-card p-4 text-left transition-all duration-300 hover:border-gold/30 hover:bg-zinc-850/80 active:scale-[0.98] animate-fade-up shadow-sm"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/20 via-gold/5 to-black/40 border border-gold/20 text-gold shadow-md shadow-gold/5 transition-all duration-300 group-hover:border-gold/40 group-hover:bg-gold/15">
                      <BarberServiceIcon name={service.icon} className="h-6 w-6 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm font-bold leading-tight text-white">{service.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{service.duration}</p>
                    </div>
                    {service.price > 0 && (
                      <span className="font-display text-sm font-bold text-gold">{service.price}€</span>
                    )}
                    <ChevronRight className="h-5 w-5 shrink-0 text-zinc-600 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-gold" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function StepHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  return (
    <div className="sticky top-0 z-30 glass-panel px-4 py-2.5 sm:px-5 sm:py-3.5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Volver"
          className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-300 transition-colors hover:bg-white/10 active:scale-90"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <div>
          <p className="text-[0.6rem] sm:text-[0.65rem] uppercase tracking-[0.2em] text-gold">{subtitle}</p>
          <h2 className="font-display text-lg sm:text-2xl font-bold leading-tight text-white">{title}</h2>
        </div>
      </div>
    </div>
  );
}
