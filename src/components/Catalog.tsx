import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  ShoppingBag,
  X,
  MessageCircle,
  Plus,
  Pencil,
  Trash2,
  Flame,
  Maximize2,
  Minimize2,
  Check,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import {
  fetchStoreCategories,
  fetchAllStoreCategories,
  fetchProductsByCategory,
  fetchAdminProductsByCategory,
  uploadProductImage,
} from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/notify';
import { WHATSAPP_NUMBER } from '@/data/services';
import type { StoreCategory, StoreProduct, UserRole } from '@/types';
import { useLockScroll } from '@/components/SmoothScroll';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ModalPortal } from '@/components/ui/ModalPortal';

interface CatalogProps {
  onBack: () => void;
  userRole?: UserRole | null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function Catalog({ onBack, userRole }: CatalogProps) {
  const isAdminOrStaff = userRole?.role === 'admin' || userRole?.role === 'barber';

  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Client view modal
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);

  // Admin modals & state
  const [editingCategory, setEditingCategory] = useState<StoreCategory | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [creatingProduct, setCreatingProduct] = useState(false);

  useLockScroll(Boolean(selectedProduct || editingProduct || creatingProduct || editingCategory || creatingCategory));
  const tabsRef = useRef<HTMLDivElement>(null);

  const loadCategories = useCallback(async () => {
    const cats = isAdminOrStaff
      ? await fetchAllStoreCategories()
      : await fetchStoreCategories();
    setCategories(cats);
    if (cats.length > 0) {
      setActiveCategory((prev) => (prev && cats.some((c) => c.id === prev) ? prev : cats[0].id));
    } else {
      setActiveCategory(null);
    }
  }, [isAdminOrStaff]);

  const loadProducts = useCallback(async (categoryId: string) => {
    const data = isAdminOrStaff
      ? await fetchAdminProductsByCategory(categoryId)
      : await fetchProductsByCategory(categoryId);
    setProducts(data);
  }, [isAdminOrStaff]);

  useEffect(() => {
    setLoading(true);
    loadCategories().finally(() => setLoading(false));
  }, [loadCategories]);

  useEffect(() => {
    if (activeCategory) {
      loadProducts(activeCategory);
    } else {
      setProducts([]);
    }
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

  // --- Admin actions on categories ---
  const handleDeleteCategory = async (cat: StoreCategory) => {
    if (!confirm(`¿Eliminar la sección "${cat.name}" y todos sus productos asociados?`)) return;
    try {
      const { error } = await supabase.from('store_categories').delete().eq('id', cat.id);
      if (error) throw error;
      notify.success('Sección eliminada', `La sección "${cat.name}" se ha borrado`);
      await loadCategories();
    } catch (err: any) {
      notify.error('Error al eliminar sección', err?.message || 'No se pudo eliminar');
    }
  };

  const handleMoveCategory = async (cat: StoreCategory, dir: -1 | 1) => {
    const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((c) => c.id === cat.id);
    const swapWith = sorted[idx + dir];
    if (!swapWith) return;
    try {
      await Promise.all([
        supabase.from('store_categories').update({ sort_order: swapWith.sort_order }).eq('id', cat.id),
        supabase.from('store_categories').update({ sort_order: cat.sort_order }).eq('id', swapWith.id),
      ]);
      await loadCategories();
    } catch (err: any) {
      notify.error('Error al reordenar', err?.message);
    }
  };

  // --- Admin actions on products ---
  const handleDeleteProduct = async (p: StoreProduct) => {
    if (!confirm(`¿Eliminar definitivamente el producto "${p.name}"?`)) return;
    try {
      const { error } = await supabase.from('store_products').delete().eq('id', p.id);
      if (error) throw error;
      notify.success('Producto eliminado', p.name);
      if (activeCategory) loadProducts(activeCategory);
    } catch (err: any) {
      notify.error('Error al eliminar producto', err?.message);
    }
  };

  const handleToggleProductActive = async (p: StoreProduct) => {
    const nextState = !p.active;
    try {
      const { error } = await supabase.from('store_products').update({ active: nextState }).eq('id', p.id);
      if (error) throw error;
      notify.info('Visibilidad actualizada', `${p.name} marcado como ${nextState ? 'activo' : 'oculto'}`);
      if (activeCategory) loadProducts(activeCategory);
    } catch (err: any) {
      notify.error('Error', err?.message);
    }
  };

  const handleToggleFeatured = async (p: StoreProduct) => {
    const nextFeatured = !p.is_featured;
    const nextBadge = nextFeatured ? (p.badge || 'MÁS VENDIDO') : null;
    try {
      const { error } = await supabase.from('store_products').update({
        is_featured: nextFeatured,
        badge: nextBadge,
      }).eq('id', p.id);
      if (error) throw error;
      notify.success(
        nextFeatured ? 'Producto destacado' : 'Destacado quitado',
        nextFeatured ? `${p.name} ahora tiene stamp de Más Vendido y aparece al principio` : p.name
      );
      if (activeCategory) loadProducts(activeCategory);
    } catch (err: any) {
      notify.error('Error', err?.message);
    }
  };

  const handleToggleCardSize = async (p: StoreProduct) => {
    const nextSize = p.card_size === 'wide' ? 'normal' : 'wide';
    try {
      const { error } = await supabase.from('store_products').update({ card_size: nextSize }).eq('id', p.id);
      if (error) throw error;
      notify.info('Tamaño de embed cambiado', `Formato: ${nextSize === 'wide' ? 'Ancho (2 columnas)' : 'Normal (1 columna)'}`);
      if (activeCategory) loadProducts(activeCategory);
    } catch (err: any) {
      notify.error('Error', err?.message);
    }
  };

  const activeCategoryObj = categories.find((c) => c.id === activeCategory);

  return (
    <div className="min-h-screen animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-panel px-5 pb-4 pt-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Volver"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-300 transition-colors hover:bg-white/10 active:scale-90"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-gold font-bold">Catálogo Oficial</p>
              {isAdminOrStaff && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[0.65rem] font-bold text-gold border border-gold/30">
                  <Sparkles className="h-2.5 w-2.5" /> Modo Editor
                </span>
              )}
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold leading-tight text-white truncate">
              Productos & Cuidado
            </h2>
          </div>
          <ShoppingBag className="h-6 w-6 text-gold/60 shrink-0" />
        </div>
      </header>

      {/* Categories Tabs & Add Section Button */}
      <div
        data-lenis-prevent
        ref={tabsRef}
        className="no-scrollbar sticky top-[72px] z-20 flex items-center gap-2 overflow-x-auto bg-ink/90 px-5 py-3 backdrop-blur-xl border-b border-white/5"
      >
        {categories.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleSelectCategory(cat.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                active
                  ? 'gold-gradient text-black shadow-md shadow-gold/20'
                  : 'glass-card text-zinc-400 hover:text-white border border-white/5'
              } ${!cat.active ? 'opacity-50 line-through' : ''}`}
            >
              {cat.name}
            </button>
          );
        })}

        {/* Admin Add Section Button */}
        {isAdminOrStaff && (
          <button
            onClick={() => {
              setCreatingCategory(true);
              setEditingCategory(null);
            }}
            className="shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold border-2 border-dashed border-gold/40 text-gold hover:bg-gold/10 hover:border-gold transition-all active:scale-95 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Añadir sección</span>
          </button>
        )}
      </div>

      {/* Admin Section Control Bar (for active category) */}
      {isAdminOrStaff && activeCategoryObj && (
        <div className="mx-5 mt-3 rounded-2xl glass-card p-3 border border-gold/20 bg-gold/[0.02] flex flex-wrap items-center justify-between gap-2.5 animate-fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-white truncate">
              Sección: <span className="text-gold">{activeCategoryObj.name}</span>
            </span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[0.65rem] text-zinc-400">
              {products.length} {products.length === 1 ? 'producto' : 'productos'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => handleMoveCategory(activeCategoryObj, -1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg glass-card text-zinc-400 hover:text-white"
              title="Mover sección a la izquierda"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleMoveCategory(activeCategoryObj, 1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg glass-card text-zinc-400 hover:text-white"
              title="Mover sección a la derecha"
            >
              <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
            </button>
            <button
              onClick={() => {
                setEditingCategory(activeCategoryObj);
                setCreatingCategory(false);
              }}
              className="flex items-center gap-1 rounded-lg glass-card px-2.5 py-1 text-xs text-zinc-300 hover:text-gold hover:border-gold/30 transition-colors"
              title="Editar nombre de la sección"
            >
              <Pencil className="h-3 w-3" />
              <span>Editar</span>
            </button>
            <button
              onClick={() => handleDeleteCategory(activeCategoryObj)}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              title="Eliminar sección"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="px-5 pb-28 pt-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" label="Cargando productos…" />
          </div>
        ) : categories.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <ShoppingBag className="mx-auto h-12 w-12 text-zinc-700" />
            <p className="text-sm text-zinc-400">No hay secciones ni productos disponibles todavía.</p>
            {isAdminOrStaff && (
              <button
                onClick={() => setCreatingCategory(true)}
                className="inline-flex items-center gap-2 rounded-xl gold-gradient px-4 py-2.5 text-xs font-bold text-black uppercase tracking-wider hover:brightness-110 active:scale-95"
              >
                <Plus className="h-4 w-4" /> Crear primera sección
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 [grid-auto-flow:dense]">
            {/* Embed "Añadir Producto" (con el mismo tamaño y proporciones del embed) */}
            {isAdminOrStaff && activeCategory && (
              <button
                type="button"
                onClick={() => {
                  setCreatingProduct(true);
                  setEditingProduct(null);
                }}
                className="group col-span-1 flex flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-gold/30 bg-gold/[0.03] p-4 text-center transition-all duration-300 hover:border-gold hover:bg-gold/[0.08] hover:shadow-lg hover:shadow-gold/10 active:scale-[0.97] min-h-[250px] sm:min-h-[290px]"
              >
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl gold-gradient text-black shadow-lg shadow-gold/20 group-hover:scale-110 transition-transform">
                  <Plus className="h-6 w-6 sm:h-7 sm:w-7 stroke-[2.5]" />
                </div>
                <p className="mt-3.5 font-display text-sm font-bold text-white group-hover:text-gold transition-colors">
                  Añadir producto
                </p>
                <p className="mt-1 text-[0.65rem] sm:text-[0.7rem] text-zinc-400 max-w-[130px] leading-tight">
                  Nuevo embed en {activeCategoryObj?.name || 'esta sección'}
                </p>
              </button>
            )}

            {/* Products list */}
            {products.map((p, i) => {
              const isWide = p.card_size === 'wide';
              const isFeatured = Boolean(p.is_featured || p.badge);
              const badgeLabel = p.badge || (p.is_featured ? 'MÁS VENDIDO' : null);

              return (
                <div
                  key={p.id}
                  style={{ animationDelay: `${i * 0.04}s` }}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl glass-card text-left transition-all duration-300 hover:border-gold/30 hover:bg-zinc-850/90 active:scale-[0.98] animate-fade-up ${
                    isWide ? 'col-span-2 sm:col-span-2 md:col-span-2' : 'col-span-1'
                  } ${isFeatured ? 'ring-1 ring-red-500/30 border-red-500/20' : 'border-white/5'} ${
                    !p.active ? 'opacity-50' : ''
                  }`}
                >
                  {/* RED STAMP "MÁS VENDIDO" / BADGE */}
                  {isFeatured && (
                    <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 rounded-md bg-red-600 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[0.6rem] sm:text-[0.65rem] font-black uppercase tracking-wider text-white shadow-xl shadow-red-950/80 ring-1 ring-red-400/40">
                      <Flame className="h-3 w-3 fill-white text-white" />
                      <span>{badgeLabel}</span>
                    </div>
                  )}

                  {/* ADMIN ACTION OVERLAY BUTTONS */}
                  {isAdminOrStaff && (
                    <div className="absolute top-2 right-2 z-20 flex flex-wrap items-center justify-end gap-1 rounded-xl bg-black/80 p-1 backdrop-blur-md border border-white/10 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Toggle Featured Stamp */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFeatured(p);
                        }}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                          p.is_featured
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-white/5 text-zinc-400 hover:text-white'
                        }`}
                        title={p.is_featured ? 'Quitar stamp de Más Vendido' : 'Marcar como MÁS VENDIDO'}
                      >
                        <Flame className="h-3.5 w-3.5" />
                      </button>

                      {/* Toggle Size Wide/Normal */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleCardSize(p);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-zinc-400 hover:text-gold hover:bg-white/10 transition-colors"
                        title={isWide ? 'Cambiar a tamaño Normal (1 col)' : 'Destacar tamaño Ancho (2 col)'}
                      >
                        {isWide ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                      </button>

                      {/* Edit Product */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProduct(p);
                          setCreatingProduct(false);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="Editar producto"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {/* Toggle Active */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleProductActive(p);
                        }}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                          p.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                        }`}
                        title={p.active ? 'Ocultar producto' : 'Hacer visible'}
                      >
                        {p.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProduct(p);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Eliminar producto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Card Click Target */}
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(p)}
                    className="flex flex-1 flex-col text-left w-full h-full"
                  >
                    {/* Media Container */}
                    <div
                      className={`w-full overflow-hidden bg-zinc-900 ${
                        isWide ? 'aspect-[16/9] sm:aspect-[2/1]' : 'aspect-square'
                      }`}
                    >
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

                    {/* Content Details */}
                    <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-1">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-xs sm:text-sm font-bold leading-snug text-white group-hover:text-gold transition-colors">
                            {p.name}
                          </p>
                          {p.price > 0 && (
                            <p className="font-display text-xs sm:text-sm font-bold text-gold shrink-0">
                              {p.price}€
                            </p>
                          )}
                        </div>
                        {isWide && p.description && (
                          <p className="mt-1 line-clamp-2 text-[0.7rem] text-zinc-400">
                            {p.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-[0.65rem] text-zinc-500 font-medium">Ver detalles</span>
                        <span className="text-[0.65rem] font-bold text-gold opacity-0 group-hover:opacity-100 transition-opacity">
                          Pedir por WhatsApp →
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Client View Detail Modal */}
      {selectedProduct && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/80 backdrop-blur-md sm:items-center p-0 sm:p-4"
            onClick={() => setSelectedProduct(null)}
          >
            <div
              data-lenis-prevent
              className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-gold/20 bg-zinc-950 shadow-2xl animate-slide-up sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedProduct(null)}
                aria-label="Cerrar"
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-zinc-300 backdrop-blur-md transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="aspect-square w-full overflow-hidden bg-zinc-900 relative">
                {selectedProduct.image_url ? (
                  <img src={selectedProduct.image_url} alt={selectedProduct.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ShoppingBag className="h-16 w-16 text-zinc-700" />
                  </div>
                )}

                {(selectedProduct.is_featured || selectedProduct.badge) && (
                  <div className="absolute top-4 left-4 z-10 flex items-center gap-1 rounded-md bg-red-600 px-3 py-1 text-xs font-black uppercase tracking-wider text-white shadow-xl">
                    <Flame className="h-3.5 w-3.5 fill-white text-white" />
                    <span>{selectedProduct.badge || 'MÁS VENDIDO'}</span>
                  </div>
                )}
              </div>

              <div data-lenis-prevent className="max-h-[40vh] overflow-y-auto p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-xl font-bold leading-tight text-white">{selectedProduct.name}</h3>
                  {selectedProduct.price > 0 && (
                    <p className="font-display text-2xl font-bold text-gold shrink-0">{selectedProduct.price}€</p>
                  )}
                </div>

                {selectedProduct.description && (
                  <p className="text-sm leading-relaxed text-zinc-300">{selectedProduct.description}</p>
                )}

                <button
                  onClick={() => handleContactWhatsApp(selectedProduct)}
                  className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-full gold-gradient py-3.5 text-sm font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98] shadow-lg shadow-gold/20"
                >
                  <MessageCircle className="h-5 w-5" />
                  Pedir por WhatsApp
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Admin Category Modal (Create / Edit) */}
      {(creatingCategory || editingCategory) && (
        <CategoryModal
          category={editingCategory}
          onClose={() => {
            setCreatingCategory(false);
            setEditingCategory(null);
          }}
          onSaved={async () => {
            setCreatingCategory(false);
            setEditingCategory(null);
            await loadCategories();
          }}
        />
      )}

      {/* Admin Product Modal (Create / Edit with sizes and stamp) */}
      {(creatingProduct || editingProduct) && activeCategory && (
        <ProductModal
          product={editingProduct}
          categoryId={editingProduct?.category_id || activeCategory}
          categories={categories}
          onClose={() => {
            setCreatingProduct(false);
            setEditingProduct(null);
          }}
          onSaved={async () => {
            setCreatingProduct(false);
            setEditingProduct(null);
            if (activeCategory) loadProducts(activeCategory);
          }}
        />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Sub-component: CategoryModal
// --------------------------------------------------------------------------
function CategoryModal({
  category,
  onClose,
  onSaved,
}: {
  category: StoreCategory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [active, setActive] = useState(category?.active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (category) {
        const { error } = await supabase
          .from('store_categories')
          .update({
            name: name.trim(),
            slug: slugify(name.trim()),
            active,
          })
          .eq('id', category.id);
        if (error) throw error;
        notify.success('Sección actualizada', name.trim());
      } else {
        const { data: maxOrder } = await supabase
          .from('store_categories')
          .select('sort_order')
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextOrder = (maxOrder as StoreCategory | null)?.sort_order ?? -1;
        const { error } = await supabase.from('store_categories').insert({
          name: name.trim(),
          slug: slugify(name.trim()),
          sort_order: nextOrder + 1,
          active: true,
        });
        if (error) throw error;
        notify.success('Sección creada', name.trim());
      }
      onSaved();
    } catch (err: any) {
      notify.error('Error al guardar sección', err?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
        <div
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-gold/20 bg-zinc-950 p-6 shadow-2xl animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <h3 className="font-display text-lg font-bold text-white">
              {category ? 'Editar Sección' : 'Nueva Sección'}
            </h3>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Nombre de la sección
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Cuidado de Barba, Pomadas, Accesorios..."
                autoFocus
                className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none"
              />
            </div>

            {category && (
              <label className="flex items-center gap-3 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-gold focus:ring-gold"
                />
                <span className="text-xs text-zinc-300">Sección visible para los clientes</span>
              </label>
            )}

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl bg-white/5 py-3 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl gold-gradient py-3 text-xs font-bold uppercase tracking-wider text-black hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <Check className="h-4 w-4" />}
                Guardar
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

// --------------------------------------------------------------------------
// Sub-component: ProductModal (with sizes, stamps, and full customizer)
// --------------------------------------------------------------------------
function ProductModal({
  product,
  categoryId,
  categories,
  onClose,
  onSaved,
}: {
  product: StoreProduct | null;
  categoryId: string;
  categories: StoreCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedCatId, setSelectedCatId] = useState(product?.category_id || categoryId);
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(String(product?.price ?? 0));
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');
  const [cardSize, setCardSize] = useState<'normal' | 'wide'>(product?.card_size ?? 'normal');
  const [isFeatured, setIsFeatured] = useState<boolean>(product?.is_featured ?? false);
  const [badge, setBadge] = useState<string>(product?.badge ?? 'MÁS VENDIDO');
  const [customBadge, setCustomBadge] = useState<string>('');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const STAMP_PRESETS = ['MÁS VENDIDO', 'TOP VENTAS', 'OFERTA', 'DESTACADO'];

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      if (url) {
        setImageUrl(url);
        notify.success('Foto subida', 'Imagen lista para el producto');
      }
    } catch (err: any) {
      notify.error('Error al subir imagen', err?.message || 'No se pudo subir');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const resolvedBadge = isFeatured
        ? (customBadge.trim() || badge || 'MÁS VENDIDO')
        : null;

      const payload = {
        name: name.trim(),
        category_id: selectedCatId,
        description: description.trim() || null,
        price: Number(price) || 0,
        image_url: imageUrl || null,
        card_size: cardSize,
        is_featured: isFeatured,
        badge: resolvedBadge,
      };

      if (product) {
        const { error } = await supabase.from('store_products').update(payload).eq('id', product.id);
        if (error) throw error;
        notify.success('Producto actualizado', payload.name);
      } else {
        const { data: maxOrder } = await supabase
          .from('store_products')
          .select('sort_order')
          .eq('category_id', selectedCatId)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextOrder = (maxOrder as StoreProduct | null)?.sort_order ?? -1;
        const { error } = await supabase.from('store_products').insert({
          ...payload,
          sort_order: nextOrder + 1,
          active: true,
        });
        if (error) throw error;
        notify.success('Producto creado', payload.name);
      }
      onSaved();
    } catch (err: any) {
      notify.error('Error al guardar producto', err?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
        <div
          data-lenis-prevent
          className="relative my-auto w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-3xl border border-gold/25 bg-zinc-950 shadow-2xl shadow-gold/5 animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-zinc-900/60">
            <div>
              <h3 className="font-display text-lg font-bold text-white">
                {product ? 'Editar Producto' : 'Añadir Producto a la Tienda'}
              </h3>
              <p className="text-xs text-zinc-400">Configura la información visual y tamaño del embed</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body Form with Scroll */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Category Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Sección / Categoría
              </label>
              <select
                value={selectedCatId}
                onChange={(e) => setSelectedCatId(e.target.value)}
                className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white bg-zinc-900 border border-white/10 focus:border-gold/40 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Fotografía del Producto
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-900 border border-white/10">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-7 w-7 text-zinc-600" />
                  )}
                  {isFeatured && (
                    <span className="absolute bottom-1 right-1 rounded bg-red-600 p-0.5 text-[0.55rem] font-bold text-white">
                      ★
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 rounded-xl glass-card px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:text-gold hover:border-gold/30 transition-all disabled:opacity-50"
                  >
                    {uploading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                    {uploading ? 'Subiendo foto…' : 'Subir o cambiar imagen'}
                  </button>
                  <p className="text-[0.65rem] text-zinc-500">JPG, PNG o WebP. Se ajustará al embed automáticamente.</p>
                </div>
              </div>
            </div>

            {/* Name & Price */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Cera Mate Fijación Fuerte"
                  required
                  className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Precio (€)
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none font-mono font-bold"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Descripción del producto (opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Beneficios, modo de uso o tipo de cabello..."
                className="w-full resize-none rounded-xl glass-card px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-gold/40 focus:outline-none"
              />
            </div>

            {/* EMBED SIZE SELECTOR */}
            <div className="rounded-2xl glass-card p-3.5 border border-white/10 space-y-2">
              <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gold">
                <span>Tamaño del Embed en Tienda</span>
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCardSize('normal')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                    cardSize === 'normal'
                      ? 'border-gold bg-gold/10 text-white shadow-md shadow-gold/10'
                      : 'border-white/5 bg-zinc-900/60 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Minimize2 className="h-4 w-4 text-gold mb-1" />
                  <span className="text-xs font-bold">Normal</span>
                  <span className="text-[0.65rem] text-zinc-500">1 Columna estándar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCardSize('wide')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                    cardSize === 'wide'
                      ? 'border-gold bg-gold/10 text-white shadow-md shadow-gold/10'
                      : 'border-white/5 bg-zinc-900/60 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Maximize2 className="h-4 w-4 text-gold mb-1" />
                  <span className="text-xs font-bold">Ancho / Destacado</span>
                  <span className="text-[0.65rem] text-zinc-500">2 Columnas en cuadrícula</span>
                </button>
              </div>
            </div>

            {/* FEATURED & RED STAMP SELECTOR */}
            <div className="rounded-2xl glass-card p-3.5 border border-red-500/20 bg-red-950/[0.05] space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="h-4 w-4 rounded border-red-500/40 bg-zinc-900 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-red-500 fill-red-500" />
                    Producto Destacado (aparece al principio)
                  </span>
                </label>
              </div>

              {isFeatured && (
                <div className="space-y-2 pt-1 animate-fade-in">
                  <p className="text-[0.7rem] text-zinc-400">
                    Selecciona el stamp rojo que se estampará sobre la foto:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {STAMP_PRESETS.map((preset) => {
                      const isSel = badge === preset && !customBadge;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setBadge(preset);
                            setCustomBadge('');
                          }}
                          className={`rounded-lg px-2.5 py-1 text-[0.65rem] font-black tracking-wider uppercase transition-all ${
                            isSel
                              ? 'bg-red-600 text-white shadow-md shadow-red-950/60 ring-1 ring-red-400'
                              : 'bg-white/5 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    value={customBadge}
                    onChange={(e) => {
                      setCustomBadge(e.target.value);
                      setBadge(e.target.value);
                    }}
                    placeholder="O escribe un texto personalizado para el stamp..."
                    className="w-full rounded-xl glass-card px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-red-500/40 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl bg-white/5 py-3 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl gold-gradient py-3 text-xs font-bold uppercase tracking-wider text-black hover:brightness-110 active:scale-95 disabled:opacity-50 shadow-lg shadow-gold/20"
              >
                {saving ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Guardar producto
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
