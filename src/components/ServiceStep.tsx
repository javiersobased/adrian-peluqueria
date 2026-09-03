import { useState, useEffect } from 'react';
import { Scissors, Feather, CircleUserRound, Droplets, Paintbrush, UserRound, ChevronRight, type LucideIcon } from 'lucide-react';
import { fetchServices } from '@/data/services';
import type { Service } from '@/types';
import { ArrowLeftIcon } from '@/components/icons';

interface ServiceStepProps {
  onBack: () => void;
  onSelect: (s: Service) => void;
}

const SERVICE_ICONS: Record<string, LucideIcon> = {
  scissors: Scissors,
  beard: Feather,
  'scissors-crossed': Scissors,
  contours: CircleUserRound,
  wash: Droplets,
  color: Paintbrush,
  neck: UserRound,
};

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
    <div className="min-h-screen animate-slide-in">
      <StepHeader title="Elige tu servicio" subtitle="Paso 2 de 4" onBack={onBack} />
      <div className="px-5 pb-10 pt-4">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.25em] text-wood-light">Sesión</p>
          <p className="mt-1 text-sm text-marble/50">Elige el servicio que necesitas</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-marble/20 border-t-wood" />
          </div>
        ) : services.length === 0 ? (
          <p className="py-20 text-center text-sm text-marble/50">No hay servicios disponibles.</p>
        ) : (
          <ul className="space-y-3">
            {services.map((service, i) => {
              const Icon = SERVICE_ICONS[service.icon] ?? Scissors;
              return (
              <li key={service.id}>
                <button
                  onClick={() => onSelect(service)}
                  style={{ animationDelay: `${i * 0.05}s` }}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-marble/10 bg-marble/[0.03] p-4 text-left transition-all duration-200 hover:border-marble/25 hover:bg-marble/[0.07] active:scale-[0.98] animate-fade-up"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-marble transition-colors group-hover:text-wood-light">
                    <Icon className="h-9 w-9" strokeWidth={1.6} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold leading-tight text-marble">{service.name}</p>
                    <p className="mt-1 text-xs text-marble/55">{service.duration}</p>
                  </div>
                  {service.price > 0 && (
                    <span className="text-sm font-medium text-wood-light">{service.price}€</span>
                  )}
                  <ChevronRight className="h-5 w-5 shrink-0 text-marble/70 transition-transform duration-200 group-hover:translate-x-1" />
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
    <div className="sticky top-0 z-30 glass-panel px-5 pb-4 pt-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Volver"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marble/5 text-marble/80 transition-colors hover:bg-marble/10 active:scale-90"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-wood-light">{subtitle}</p>
          <h2 className="font-display text-2xl font-medium leading-tight text-marble">{title}</h2>
        </div>
      </div>
    </div>
  );
}
