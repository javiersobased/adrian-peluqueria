import { useState } from 'react';
import { useBusiness } from '@/context/BusinessContext';
import { LAYOUT_VARIANTS, type LayoutKey, type LayoutVariant } from '@/lib/businessModel';

interface VariantInfo {
  key: LayoutVariant;
  name: string;
  desc: string;
}

const VARIANTS_BY_LAYOUT: Record<LayoutKey, { title: string; icon: string; items: VariantInfo[] }> = {
  classic: {
    title: 'Clásico / Barbería',
    icon: '🏛️',
    items: [
      { key: 'classic_prestige', name: 'Prestige (Adrián)', desc: 'Dorado noble, estilo tradicional' },
      { key: 'classic_heritage', name: 'Heritage', desc: 'Tonos cálidos, aire vintage' },
      { key: 'classic_industrial', name: 'Industrial', desc: 'Madera oscura, metal y cuero' },
      { key: 'classic_street', name: 'Street', desc: 'Urbano, tipografía display audaz' },
      { key: 'classic_club', name: 'Club Privado', desc: 'Exclusivo, navegación pill' },
    ],
  },
  editorial: {
    title: 'Editorial / Salón',
    icon: '📰',
    items: [
      { key: 'editorial_magazine', name: 'Magazine', desc: 'Estilo revista de moda, asimétrico' },
      { key: 'editorial_studio', name: 'Studio', desc: 'Fotografía y arte, tipografía serif' },
      { key: 'editorial_gallery', name: 'Gallery', desc: 'Mosaico visual de alta costura' },
      { key: 'editorial_fluid', name: 'Fluid', desc: 'Líneas curvas, paleta suave' },
      { key: 'editorial_pop', name: 'Pop Editorial', desc: 'Contemporáneo y vibrante' },
    ],
  },
  minimal: {
    title: 'Minimal / Clínica / Spa',
    icon: '🌿',
    items: [
      { key: 'minimal_clinic', name: 'Clinic', desc: 'Fondo claro, estética médica limpia' },
      { key: 'minimal_spa', name: 'Spa & Wellness', desc: 'Tonos tierra, calma y bienestar' },
      { key: 'minimal_luxury', name: 'Luxury Minimal', desc: 'Elegancia sobria, tipografía fina' },
      { key: 'minimal_botanical', name: 'Botanical', desc: 'Orgánico, verde suave y natural' },
      { key: 'minimal_chic', name: 'Chic Studio', desc: 'Líneas puras, blanco y negro' },
    ],
  },
  playful: {
    title: 'Playful / Creativo / Pet',
    icon: '🎈',
    items: [
      { key: 'playful_vibrant', name: 'Vibrant', desc: 'Colores dinámicos, juvenil' },
      { key: 'playful_bubble', name: 'Bubble', desc: 'Bordes redondeados, amigable' },
      { key: 'playful_paws', name: 'Paws & Grooming', desc: 'Peluquería canina y mascotas' },
      { key: 'playful_boutique', name: 'Boutique', desc: 'Artesanal, diseño fresco' },
      { key: 'playful_nature', name: 'Nature', desc: 'Colorido natural, aire libre' },
    ],
  },
};

export function ThemeDemoBar() {
  const business = useBusiness();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<LayoutKey>(business?.layoutKey ?? 'editorial');

  // Solo mostrar en dominios de prueba (vercel.app, localhost o con ?demo/?preview)
  if (typeof window === 'undefined') return null;
  const isDemoEnv =
    import.meta.env.DEV ||
    window.location.hostname.includes('vercel.app') ||
    window.location.search.includes('demo') ||
    window.location.search.includes('preview') ||
    window.location.search.includes('variant');

  if (!isDemoEnv) return null;

  const currentVariant = business?.layoutVariant ?? 'editorial_magazine';

  const handleSelectVariant = (variantKey: LayoutVariant) => {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', variantKey);
    window.location.href = url.toString();
  };

  return (
    <aside
      aria-label="Selector de estilos de demostración"
      className="fixed bottom-4 right-4 z-50 font-sans"
    >
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-neutral-900/95 px-4 py-2.5 text-xs font-semibold text-amber-300 shadow-2xl backdrop-blur-md transition-all hover:scale-105 hover:bg-neutral-800 hover:text-amber-200"
        >
          <span className="text-base">🎨</span>
          <span>Explorar 20 Estilos</span>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">
            {currentVariant}
          </span>
        </button>
      ) : (
        <div className="flex w-[360px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-neutral-700/80 bg-neutral-900/95 p-4 shadow-2xl backdrop-blur-xl text-neutral-100">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎨</span>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Selector de Estilos SaaS
                </h2>
                <p className="text-[10px] text-neutral-400">20 variantes en tiempo real</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Selector de Layouts (Pestañas) */}
          <div className="grid grid-cols-4 gap-1 py-2">
            {(Object.keys(VARIANTS_BY_LAYOUT) as LayoutKey[]).map((layoutKey) => {
              const tab = VARIANTS_BY_LAYOUT[layoutKey];
              const isActive = activeTab === layoutKey;
              return (
                <button
                  key={layoutKey}
                  type="button"
                  onClick={() => setActiveTab(layoutKey)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-all ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50'
                      : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                  }`}
                >
                  <span className="text-xs">{tab.icon}</span>
                  <span className="capitalize">{layoutKey}</span>
                </button>
              );
            })}
          </div>

          {/* Lista de Variantes del Layout seleccionado */}
          <div className="mt-2 flex max-h-[280px] flex-col gap-1.5 overflow-y-auto pr-1">
            {VARIANTS_BY_LAYOUT[activeTab].items.map((variant) => {
              const isSelected = currentVariant === variant.key;
              return (
                <button
                  key={variant.key}
                  type="button"
                  onClick={() => handleSelectVariant(variant.key)}
                  className={`flex flex-col items-start rounded-xl p-2.5 text-left transition-all ${
                    isSelected
                      ? 'bg-amber-500/20 ring-1 ring-amber-500 text-white'
                      : 'bg-neutral-800/50 hover:bg-neutral-800 text-neutral-300'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-semibold">{variant.name}</span>
                    {isSelected && (
                      <span className="rounded bg-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-400">{variant.desc}</span>
                  <span className="mt-1 font-mono text-[9px] text-neutral-500">{variant.key}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-2 text-center text-[10px] text-neutral-500 border-t border-neutral-800">
            Cada cliente tendrá su propio dominio y su variante asignada por defecto.
          </div>
        </div>
      )}
    </aside>
  );
}
