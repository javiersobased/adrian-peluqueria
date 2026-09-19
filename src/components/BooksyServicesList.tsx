import { useState, useEffect, useMemo } from 'react';
import { Search, Clock, Scissors, Sparkles, ChevronRight } from 'lucide-react';
import { fetchServices } from '@/data/services';
import type { Service } from '@/types';

interface BooksyServicesListProps {
  onSelectService?: (service: Service) => void;
  onBookGeneral?: () => void;
}

// Fallback services matching official pricing if network is delayed
const FALLBACK_SERVICES: Service[] = [
  { id: 'd5fc1829-b593-4f75-8790-01d06c25e427', name: 'CORTE DE CABELLO', price: 11, duration: '20min', icon: 'scissors', active: true, sort_order: 0 },
  { id: '175a7320-71f5-432d-b29d-3fc64d48f7f1', name: 'ARREGLO DE BARBA', price: 6, duration: '10min', icon: 'beard', active: true, sort_order: 1 },
  { id: '4d7f593e-f3b5-477f-b829-f82d29d01918', name: 'CORTE DE CABELLO + ARREGLO DE BARBA', price: 16, duration: '30min', icon: 'scissors-crossed', active: true, sort_order: 2 },
  { id: 'edc3620a-9ce6-467e-878e-8a262fbd7a1f', name: 'CORTE DE CABELLO + DECOLORACIÓN', price: 65, duration: '40min', icon: 'color', active: true, sort_order: 3 },
  { id: '292590c4-4b30-42e5-8cf8-b27e7e755b83', name: 'CORTE DE CABELLO + LAVADO', price: 13, duration: '30min', icon: 'wash', active: true, sort_order: 4 },
  { id: 'f4eaadfc-77bd-48d5-b4b1-78c974e39bc8', name: 'TINTE BARBA', price: 10, duration: '20min', icon: 'color', active: true, sort_order: 5 },
  { id: 'a4804097-780c-46be-b429-4b0577ee77f6', name: 'ARREGLO DE CUELLO Y PATILLAS', price: 6, duration: '10min', icon: 'scissors', active: true, sort_order: 6 },
];

export function BooksyServicesList({ onSelectService, onBookGeneral }: BooksyServicesListProps) {
  const [services, setServices] = useState<Service[]>(FALLBACK_SERVICES);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchServices().then((data) => {
      if (mounted && data && data.length > 0) {
        setServices(data);
      }
      if (mounted) setLoading(false);
    }).catch(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const filteredServices = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.toLowerCase().trim();
    return services.filter((s) => s.name.toLowerCase().includes(q));
  }, [services, search]);

  const handleBooking = (service: Service) => {
    if (onSelectService) {
      onSelectService(service);
    } else if (onBookGeneral) {
      onBookGeneral();
    }
  };

  return (
    <section id="servicios-lista" className="px-4 sm:px-6 py-8 booksy-section">
      <div className="mx-auto max-w-5xl">
        <div className="booksy-container rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-8 backdrop-blur-xl shadow-2xl transition-colors duration-300">
          
          {/* Header & Search Bar (Booksy style) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10 booksy-header-border">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold booksy-tag">Tarifas Oficiales</span>
                <span className="booksy-count-pill text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
                  {services.length} servicios
                </span>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight booksy-title">
                Servicios
              </h3>
            </div>

            {/* Quick search input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 booksy-search-icon pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar servicios..."
                aria-label="Buscar servicios"
                className="w-full rounded-2xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30 transition-all booksy-search-input"
              />
            </div>
          </div>

          {/* Service Items List */}
          <div className="divide-y divide-white/5 booksy-divide">
            {filteredServices.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-400">
                No se encontraron servicios con el término "{search}".
              </div>
            ) : (
              filteredServices.map((service, index) => {
                const formattedPrice = Number(service.price).toLocaleString('es-ES', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }) + ' €';

                return (
                  <div
                    key={service.id || index}
                    className="group flex items-center justify-between gap-3 py-4 sm:py-5 transition-colors hover:bg-white/[0.02] -mx-2 px-2 rounded-xl booksy-row"
                  >
                    {/* Service Name & Duration */}
                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className="font-display text-sm sm:text-base font-bold text-white uppercase tracking-wide group-hover:text-gold transition-colors truncate booksy-item-name">
                        {service.name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-400 booksy-item-sub">
                        <Clock className="h-3 w-3 text-zinc-500 shrink-0" />
                        <span>{service.duration || '20min'}</span>
                      </div>
                    </div>

                    {/* Price and Action Button */}
                    <div className="flex items-center gap-3 sm:gap-6 shrink-0">
                      <div className="text-right">
                        <span className="font-display text-sm sm:text-base font-bold text-white booksy-item-price block">
                          {formattedPrice}
                        </span>
                        <span className="text-[0.65rem] text-zinc-500 hidden sm:block">
                          {service.duration || '20min'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleBooking(service)}
                        className="booksy-btn-reservar inline-flex items-center justify-center gap-1.5 rounded-xl gold-gradient px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-bold uppercase tracking-wider text-black shadow-md transition-all duration-200 hover:brightness-110 active:scale-95 hover:shadow-lg"
                      >
                        <span>Reservar</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Notice footer */}
          <div className="mt-6 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-[0.7rem] text-zinc-500 gap-2 booksy-footer">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              <span>Reserva directa en tiempo real sin esperas ni comisiones</span>
            </div>
            <span>Precios con IVA incluido</span>
          </div>

        </div>
      </div>
    </section>
  );
}
