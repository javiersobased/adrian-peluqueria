import type { Service } from '@/types';
import { focusRing, useLanding } from '@/themes/layouts/LandingContext';
import { formatPrice, serviceMinutes } from '@/themes/layouts/useLandingData';
import type { SectionMap, ServicesStyle } from '@/themes/layouts/types';

function useServices() {
  const { data, business, actions } = useLanding();
  return {
    services: data.services,
    loading: data.loading,
    price: (service: Service) => formatPrice(service.price, business.currency, business.locale),
    select: (service: Service) => (actions.onSelectService ? actions.onSelectService(service) : actions.onBook()),
  };
}

function SectionShell({ children, intro = true }: { children: React.ReactNode; intro?: boolean }) {
  const { type } = useLanding();
  return (
    <section id="servicios" aria-labelledby="servicios-titulo" className="border-t border-line">
      <div className={`${type.container} py-section`}>
        <h2 id="servicios-titulo" className={type.heading}>Servicios</h2>
        {intro && <p className={`mt-4 max-w-xl ${type.body}`}>Elige un servicio para empezar tu reserva. La duración es orientativa.</p>}
        {children}
      </div>
    </section>
  );
}

function Status() {
  const { services, loading } = useServices();
  if (loading) return <p className="py-6 text-fg-muted">Cargando servicios…</p>;
  if (services.length === 0) return <p className="py-6 text-fg-muted">Pronto publicaremos nuestros servicios.</p>;
  return null;
}

function NumberedServices() {
  const { services, price, select } = useServices();
  return (
    <SectionShell>
      <Status />
      <ol className="mt-10">
        {services.map((service, index) => {
          const minutes = serviceMinutes(service);
          return (
            <li key={service.id} className="border-b border-line">
              <button type="button" onClick={() => select(service)} className={`group flex w-full items-baseline gap-4 py-6 text-left ${focusRing}`}>
                <span className="w-8 shrink-0 font-display text-sm text-accent">{String(index + 1).padStart(2, '0')}</span>
                <span className="font-display text-2xl group-hover:text-accent">{service.name}</span>
                <span className="hidden flex-1 border-b border-dotted border-line sm:block" aria-hidden="true" />
                <span className="ml-auto shrink-0 text-right">
                  <span className="block text-lg">{price(service)}</span>
                  {minutes && <span className="block text-xs text-fg-muted">{minutes} min</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </SectionShell>
  );
}

function MenuServices() {
  const { services, price, select } = useServices();
  return (
    <SectionShell>
      <Status />
      <ul className="theme-card mt-10 grid gap-x-12 p-6 sm:p-10 md:grid-cols-2">
        {services.map((service) => {
          const minutes = serviceMinutes(service);
          return (
            <li key={service.id}>
              <button type="button" onClick={() => select(service)} className={`group flex w-full items-baseline gap-3 py-4 text-left ${focusRing}`}>
                <span className="font-display text-lg uppercase tracking-wide group-hover:text-accent">{service.name}</span>
                <span className="flex-1 border-b border-dotted border-fg-muted/40" aria-hidden="true" />
                <span className="font-display text-lg text-accent">{price(service)}</span>
              </button>
              {minutes && <p className="-mt-3 pb-2 text-xs text-fg-muted">{minutes} min</p>}
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}

function CardServices() {
  const { services, price, select } = useServices();
  return (
    <SectionShell>
      <Status />
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const minutes = serviceMinutes(service);
          return (
            <li key={service.id}>
              <button type="button" onClick={() => select(service)} className={`theme-card group flex h-full w-full flex-col p-6 text-left transition hover:-translate-y-0.5 ${focusRing}`}>
                <span className="font-display text-xl group-hover:text-accent">{service.name}</span>
                {minutes && <span className="mt-1 text-sm text-fg-muted">{minutes} min</span>}
                <span className="mt-6 flex items-center justify-between">
                  <span className="text-2xl font-semibold">{price(service)}</span>
                  <span className="text-sm text-accent">Reservar →</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}

function CompactServices() {
  const { services, price, select } = useServices();
  return (
    <SectionShell intro={false}>
      <Status />
      <ul className="mt-6 max-w-md">
        {services.map((service) => {
          const minutes = serviceMinutes(service);
          return (
            <li key={service.id}>
              <button type="button" onClick={() => select(service)} className={`flex w-full items-baseline justify-between gap-4 border-b border-line py-3 text-left hover:text-accent ${focusRing}`}>
                <span className="text-sm">
                  {service.name}
                  {minutes && <span className="ml-2 text-xs text-fg-muted">{minutes}′</span>}
                </span>
                <span className="text-sm tabular-nums">{price(service)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}

function TileServices() {
  const { services, price, select } = useServices();
  return (
    <SectionShell>
      <Status />
      <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
        {services.map((service, index) => {
          const minutes = serviceMinutes(service);
          const filled = index % 3 === 0;
          return (
            <li key={service.id}>
              <button
                type="button"
                onClick={() => select(service)}
                className={`flex aspect-square w-full flex-col justify-between rounded-theme p-5 text-left shadow-theme transition hover:scale-[1.02] ${
                  filled ? 'bg-accent text-accent-contrast' : 'border-2 border-accent/40 bg-surface-soft'
                } ${focusRing}`}
              >
                <span className="font-display text-lg font-bold leading-tight sm:text-xl">{service.name}</span>
                <span>
                  <span className="block text-2xl font-bold">{price(service)}</span>
                  {minutes && <span className="text-xs opacity-75">{minutes} min</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}

export const SERVICES: SectionMap<ServicesStyle> = {
  numbered: NumberedServices,
  menu: MenuServices,
  cards: CardServices,
  compact: CompactServices,
  tiles: TileServices,
};
