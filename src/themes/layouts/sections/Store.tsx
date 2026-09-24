import { focusRing, useLanding } from '@/themes/layouts/LandingContext';
import { formatPrice } from '@/themes/layouts/useLandingData';

// Escaparate de la tienda (módulo has_store): una muestra de productos y acceso al catálogo.
export function StoreSection() {
  const { type, data, business, actions } = useLanding();
  if (data.products.length === 0) return null;

  return (
    <section id="tienda" aria-labelledby="tienda-titulo" className="border-t border-line">
      <div className={`${type.container} py-section`}>
        <div className="flex items-end justify-between gap-6">
          <h2 id="tienda-titulo" className={type.heading}>Tienda</h2>
          {actions.onGoToCatalog && (
            <button type="button" onClick={actions.onGoToCatalog} className={`border-b border-accent/40 pb-1 text-sm hover:text-accent ${focusRing}`}>
              Ver catálogo
            </button>
          )}
        </div>
        <ul className="mt-10 grid gap-5 sm:grid-cols-3">
          {data.products.map((product) => (
            <li key={product.id} className="theme-card overflow-hidden">
              <div className="aspect-square bg-surface-muted">
                {product.image_url && (
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="flex items-baseline justify-between gap-3 p-5">
                <span className="font-display text-lg">{product.name}</span>
                <span className="shrink-0 text-accent">{formatPrice(Number(product.price), business.currency, business.locale)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
