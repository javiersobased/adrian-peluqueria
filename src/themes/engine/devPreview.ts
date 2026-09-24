import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LAYOUT_KEYS, isVariantOf, type BusinessPublicConfig, type LayoutKey } from '@/lib/businessModel';
import { parseDesignTokens } from '@/themes/engine/designTokens';

type VariantPreview = Pick<BusinessPublicConfig, 'layoutKey' | 'layoutVariant' | 'designTokens'>;

// Solo en desarrollo: ?variant=minimal_spa pinta el negocio resuelto con otra variante del catálogo
// (sus tokens por defecto se leen de layout_variants, que es de lectura pública).
export function useDevVariantPreview(): VariantPreview | null {
  const [preview, setPreview] = useState<VariantPreview | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const variant = new URLSearchParams(window.location.search).get('variant');
    const layoutKey = variant?.split('_')[0] as LayoutKey | undefined;
    if (!variant || !layoutKey || !LAYOUT_KEYS.includes(layoutKey) || !isVariantOf(layoutKey, variant)) return;

    let cancelled = false;
    supabase
      .from('layout_variants')
      .select('default_tokens')
      .eq('key', variant)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setPreview({ layoutKey, layoutVariant: variant, designTokens: parseDesignTokens(data.default_tokens) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return preview;
}
