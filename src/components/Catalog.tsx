import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, ShoppingBag, X, MessageCircle } from 'lucide-react';
import { fetchStoreCategories, fetchProductsByCategory } from '@/lib/store';
import { WHATSAPP_NUMBER } from '@/data/services';
import type { StoreCategory, StoreProduct } from '@/types';

interface CatalogProps {
  onBack: () => void;
}

export function Catalog({ onBack }: CatalogProps) {
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStoreCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setActiveCategory(cats[0].id);
      setLoading(false);
    });
  }, []);

  const loadProducts = useCallback(async (categoryId: string) => {
    const data = await fetchProductsByCategory(categoryId);
    setProducts(data);
  }, []);

  useEffect(() => {
    if (activeCategory) loadProducts(activeCategory);
  }, [activeCategory, loadProducts]);

  const handleSelectCategory = (id: string) => {
    setActiveCategory(id);
    const idx = categories.findIndex((c) => c.id === id);
    if (idx >= 0 && tabsRef.current) {
      const tab = tabsRef.current.children[idx] as HTMLElement;
      tab?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const handleContactWhatsApp = (product: StoreProduct) => {
    const msg = `Hola Adrián, estoy interesado en el producto: ${product.name} que he visto en la web`;
    const url = `https://wa.me/${WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-panel px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Volver"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-300 transition-colors hover:bg-white/10 active:scale-90"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-gold">Catálogo</p>
            <h2 className="font-display text-2xl font-bold leading-tight text-white">Productos</h2>
          </div>
          <ShoppingBag className="h-6 w-6 text-gold/50" />
        </div>
      </header>

      {/* Tabs */}
      {categories.length > 0 && (
        <div
          ref={tabsRef}
          className="no-scrollbar sticky top-[72px] z-20 flex gap-2 overflow-x-auto bg-ink/80 px-5 py-3 backdrop-blur-xl"
        >
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleSelectCategory(cat.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                  active
                    ? 'gold-gradient text-black'
                    : 'glass-card text-zinc-400 hover:text-white'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="px-5 pb-28 pt-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-gold" />
          </div>
        ) : categories.length === 0 ? (
          <div className="py-20 text-center">
            <ShoppingBag className="mx-auto mb-3 h-12 w-12 text-zinc-700" />
            <p className="text-sm text-zinc-500">No hay productos disponibles todavía.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-zinc-500">No hay productos en esta categoría.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {products.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setSelectedProduct(p)}
                style={{ animationDelay: `${i * 0.04}s` }}
                className="group flex flex-col overflow-hidden rounded-2xl glass-card text-left transition-all duration-300 hover:border-gold/20 hover:bg-zinc-850/80 active:scale-[0.97] animate-fade-up"
              >
                <div className="aspect-square w-full overflow-hidden bg-zinc-900">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ShoppingBag className="h-8 w-8 text-zinc-700" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-xs font-bold leading-tight text-white">{p.name}</p>
                  {p.price > 0 && (
                    <p className="mt-1.5 font-display text-sm font-bold text-gold">{p.price}€</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product detail modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-gold/20 bg-zinc-900 shadow-2xl animate-slide-up sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedProduct(null)}
              aria-label="Cerrar"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-zinc-300 backdrop-blur-md transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="aspect-square w-full overflow-hidden bg-zinc-800">
              {selectedProduct.image_url ? (
                <img src={selectedProduct.image_url} alt={selectedProduct.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ShoppingBag className="h-16 w-16 text-zinc-700" />
                </div>
              )}
            </div>

            <div className="max-h-[40vh] overflow-y-auto p-5">
              <h3 className="font-display text-xl font-bold leading-tight text-white">{selectedProduct.name}</h3>
              {selectedProduct.price > 0 && (
                <p className="mt-2 font-display text-2xl font-bold text-gold">{selectedProduct.price}€</p>
              )}
              {selectedProduct.description && (
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{selectedProduct.description}</p>
              )}

              <button
                onClick={() => handleContactWhatsApp(selectedProduct)}
                className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-full gold-gradient py-4 text-sm font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98] gold-glow"
              >
                <MessageCircle className="h-5 w-5" />
                Contactar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
