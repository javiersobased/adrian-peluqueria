import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllStoreCategories, fetchAllStoreProducts, uploadProductImage } from '@/lib/store';
import type { StoreCategory, StoreProduct } from '@/types';
import { Plus, Trash2, Pencil, Check, X, ShoppingBag, ArrowUp, ArrowDown, Image as ImageIcon } from 'lucide-react';

export function AdminStore() {
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<StoreCategory | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [creatingProduct, setCreatingProduct] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [cats, prods] = await Promise.all([fetchAllStoreCategories(), fetchAllStoreProducts()]);
    setCategories(cats);
    setProducts(prods);
    if (!selectedCategory && cats.length > 0) setSelectedCategory(cats[0].id);
    setLoading(false);
  }, [selectedCategory]);

  useEffect(() => { load(); }, [load]);

  const categoryProducts = products.filter((p) => p.category_id === selectedCategory);

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('¿Eliminar esta categoría y todos sus productos?')) return;
    await supabase.from('store_categories').delete().eq('id', id);
    if (selectedCategory === id) setSelectedCategory(null);
    load();
  };

  const handleMoveCategory = async (cat: StoreCategory, dir: -1 | 1) => {
    const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((c) => c.id === cat.id);
    const swapWith = sorted[idx + dir];
    if (!swapWith) return;
    await Promise.all([
      supabase.from('store_categories').update({ sort_order: swapWith.sort_order }).eq('id', cat.id),
      supabase.from('store_categories').update({ sort_order: cat.sort_order }).eq('id', swapWith.id),
    ]);
    load();
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return;
    await supabase.from('store_products').delete().eq('id', id);
    load();
  };

  const handleToggleProductActive = async (p: StoreProduct) => {
    await supabase.from('store_products').update({ active: !p.active }).eq('id', p.id);
    load();
  };

  const handleMoveProduct = async (prod: StoreProduct, dir: -1 | 1) => {
    const sorted = [...categoryProducts].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((p) => p.id === prod.id);
    const swapWith = sorted[idx + dir];
    if (!swapWith) return;
    await Promise.all([
      supabase.from('store_products').update({ sort_order: swapWith.sort_order }).eq('id', prod.id),
      supabase.from('store_products').update({ sort_order: prod.sort_order }).eq('id', swapWith.id),
    ]);
    load();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-gold" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Categories section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gold">Categorías</h3>
          <button
            onClick={() => { setCreatingCategory(true); setEditingCategory(null); }}
            className="flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition-all hover:bg-gold/20 active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> Nueva
          </button>
        </div>

        {creatingCategory && (
          <CategoryForm
            category={null}
            onClose={() => setCreatingCategory(false)}
            onSaved={() => { setCreatingCategory(false); load(); }}
          />
        )}

        {categories.map((cat) => (
          <div key={cat.id}>
            {editingCategory?.id === cat.id ? (
              <CategoryForm
                category={cat}
                onClose={() => setEditingCategory(null)}
                onSaved={() => { setEditingCategory(null); load(); }}
              />
            ) : (
              <div className={`flex items-center gap-2 rounded-2xl glass-card p-3.5 transition-colors ${selectedCategory === cat.id ? 'border-gold/30' : ''}`}>
                <button onClick={() => setSelectedCategory(cat.id)} className="flex flex-1 items-center gap-2 text-left">
                  <span className={`text-sm font-bold ${cat.active ? 'text-white' : 'text-zinc-600'}`}>{cat.name}</span>
                  <span className="text-[0.6rem] text-zinc-600">{products.filter((p) => p.category_id === cat.id).length} prod.</span>
                </button>
                <button onClick={() => handleMoveCategory(cat, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg glass-card text-zinc-400 hover:text-white" title="Subir">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleMoveCategory(cat, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg glass-card text-zinc-400 hover:text-white" title="Bajar">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { setEditingCategory(cat); setCreatingCategory(false); }} className="flex h-7 w-7 items-center justify-center rounded-lg glass-card text-zinc-400 hover:text-white" title="Editar">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDeleteCategory(cat.id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20" title="Eliminar">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Products section */}
      {selectedCategory && (
        <div className="space-y-3 border-t border-white/5 pt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gold">
              Productos · {categories.find((c) => c.id === selectedCategory)?.name}
            </h3>
            <button
              onClick={() => { setCreatingProduct(true); setEditingProduct(null); }}
              className="flex items-center gap-1.5 rounded-full gold-gradient px-3 py-1.5 text-xs font-bold text-black transition-all hover:brightness-110 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" /> Nuevo producto
            </button>
          </div>

          {creatingProduct && (
            <ProductForm
              product={null}
              categoryId={selectedCategory}
              onClose={() => setCreatingProduct(false)}
              onSaved={() => { setCreatingProduct(false); load(); }}
            />
          )}

          {categoryProducts.map((p) => (
            <div key={p.id}>
              {editingProduct?.id === p.id ? (
                <ProductForm
                  product={p}
                  categoryId={selectedCategory}
                  onClose={() => setEditingProduct(null)}
                  onSaved={() => { setEditingProduct(null); load(); }}
                />
              ) : (
                <div className={`flex items-center gap-3 rounded-2xl glass-card p-3.5 ${!p.active ? 'opacity-50' : ''}`}>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gold/5">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-zinc-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-bold text-white">{p.name}</p>
                    <p className="text-xs text-zinc-500">{p.price > 0 ? `${p.price}€` : 'Sin precio'}</p>
                  </div>
                  <button onClick={() => handleMoveProduct(p, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg glass-card text-zinc-400 hover:text-white" title="Subir">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleMoveProduct(p, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg glass-card text-zinc-400 hover:text-white" title="Bajar">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleToggleProductActive(p)} className="text-xs font-medium text-zinc-500 hover:text-gold">
                    {p.active ? 'Activo' : 'Inactivo'}
                  </button>
                  <button onClick={() => { setEditingProduct(p); setCreatingProduct(false); }} className="flex h-7 w-7 items-center justify-center rounded-lg glass-card text-zinc-400 hover:text-white" title="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDeleteProduct(p.id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20" title="Eliminar">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {categoryProducts.length === 0 && !creatingProduct && (
            <p className="py-8 text-center text-sm text-zinc-600">No hay productos en esta categoría.</p>
          )}
        </div>
      )}
    </div>
  );
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function CategoryForm({ category, onClose, onSaved }: { category: StoreCategory | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (category) {
        await supabase.from('store_categories').update({ name: name.trim(), slug: slugify(name.trim()) }).eq('id', category.id);
      } else {
        const { data: maxOrder } = await supabase.from('store_categories').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
        const nextOrder = (maxOrder as StoreCategory | null)?.sort_order ?? -1;
        await supabase.from('store_categories').insert({ name: name.trim(), slug: slugify(name.trim()), sort_order: nextOrder + 1, active: true });
      }
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">{category ? 'Editar categoría' : 'Nueva categoría'}</p>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la categoría" autoFocus
        className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none" />
      <button type="submit" disabled={saving || !name.trim()}
        className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold uppercase tracking-wider transition-all ${name.trim() && !saving ? 'gold-gradient text-black hover:brightness-110 active:scale-[0.98]' : 'bg-white/5 text-zinc-600'}`}>
        {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <Check className="h-4 w-4" />}
        Guardar
      </button>
    </form>
  );
}

function ProductForm({ product, categoryId, onClose, onSaved }: { product: StoreProduct | null; categoryId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(String(product?.price ?? 0));
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadProductImage(file);
    if (url) setImageUrl(url);
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price: Number(price) || 0,
        image_url: imageUrl || null,
      };
      if (product) {
        await supabase.from('store_products').update(payload).eq('id', product.id);
      } else {
        const { data: maxOrder } = await supabase.from('store_products').select('sort_order').eq('category_id', categoryId).order('sort_order', { ascending: false }).limit(1).maybeSingle();
        const nextOrder = (maxOrder as StoreProduct | null)?.sort_order ?? -1;
        await supabase.from('store_products').insert({ ...payload, category_id: categoryId, sort_order: nextOrder + 1, active: true });
      }
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">{product ? 'Editar producto' : 'Nuevo producto'}</p>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
      </div>

      {/* Image upload */}
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-800">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-8 w-8 text-zinc-600" />
          )}
        </div>
        <div className="flex-1">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-xl glass-card px-4 py-2.5 text-xs font-medium text-zinc-300 transition-all hover:border-gold/30 hover:text-gold disabled:opacity-50"
          >
            {uploading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold/30 border-t-gold" /> : <ImageIcon className="h-4 w-4" />}
            {uploading ? 'Subiendo...' : 'Subir imagen'}
          </button>
        </div>
      </div>

      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del producto" autoFocus
        className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none" />

      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción (opcional)" rows={3}
        className="w-full resize-none rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none" />

      <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Precio (€)" min="0" step="0.01"
        className="w-full rounded-xl glass-card px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-gold/30 focus:outline-none" />

      <button type="submit" disabled={saving || !name.trim()}
        className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${name.trim() && !saving ? 'gold-gradient text-black hover:brightness-110 active:scale-[0.98]' : 'bg-white/5 text-zinc-600'}`}>
        {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <Check className="h-4 w-4" />}
        Guardar
      </button>
    </form>
  );
}
