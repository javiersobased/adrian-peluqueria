// Modelo puro del negocio: sin dependencias de navegador ni de Supabase.
import { ALL_FEATURES, parseFeatures, type BusinessFeatures } from '@/lib/features';
import { parseDesignTokens, type DesignTokens } from '@/themes/engine/designTokens';

export const LAYOUT_KEYS = ['classic', 'editorial', 'minimal', 'playful'] as const;
export type LayoutKey = (typeof LAYOUT_KEYS)[number];

// Debe coincidir con el catálogo public.layout_variants.
export const LAYOUT_VARIANTS = {
  classic: ['classic_heritage', 'classic_industrial', 'classic_prestige', 'classic_street', 'classic_club'],
  minimal: ['minimal_clinic', 'minimal_spa', 'minimal_luxury', 'minimal_botanical', 'minimal_chic'],
  editorial: ['editorial_magazine', 'editorial_studio', 'editorial_gallery', 'editorial_fluid', 'editorial_pop'],
  playful: ['playful_paws', 'playful_boutique', 'playful_nature', 'playful_bubble', 'playful_vibrant'],
} as const satisfies Record<LayoutKey, readonly string[]>;

export type LayoutVariant = (typeof LAYOUT_VARIANTS)[LayoutKey][number];

export const DEFAULT_VARIANT: Record<LayoutKey, LayoutVariant> = {
  classic: 'classic_prestige',
  minimal: 'minimal_clinic',
  editorial: 'editorial_magazine',
  playful: 'playful_paws',
};

export function isVariantOf(layoutKey: LayoutKey, value: unknown): value is LayoutVariant {
  return (LAYOUT_VARIANTS[layoutKey] as readonly string[]).includes(value as string);
}

// Debe coincidir con businesses_slot_interval_check en la base de datos.
export const SLOT_INTERVALS = [5, 10, 15, 20, 30, 60] as const;
export const DEFAULT_SLOT_INTERVAL = 10;

export interface BusinessPublicConfig {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  locale: string;
  currency: string;
  layoutKey: LayoutKey;
  layoutVariant: LayoutVariant;
  // Tokens efectivos (variante + sobrescrituras del negocio). null = los valores por defecto del CSS.
  designTokens: DesignTokens | null;
  features: BusinessFeatures;
  slotIntervalMinutes: number;
  theme: Record<string, unknown>;
  publicConfig: Record<string, unknown>;
  contact: Record<string, unknown>;
  hostname: string | null;
}

export function normalizeHostname(rawHost: string): string {
  return rawHost.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asSlotInterval(value: unknown): number {
  return SLOT_INTERVALS.includes(value as (typeof SLOT_INTERVALS)[number]) ? (value as number) : DEFAULT_SLOT_INTERVAL;
}

function asLayoutKey(value: unknown): LayoutKey {
  return LAYOUT_KEYS.includes(value as LayoutKey) ? (value as LayoutKey) : 'classic';
}

// Convierte la respuesta de resolve_business_by_host en configuración pública validada.
export function parseBusinessRow(data: unknown): BusinessPublicConfig | null {
  const raw = asRecord(data);
  if (typeof raw.id !== 'string' || typeof raw.slug !== 'string') return null;
  const layoutKey = asLayoutKey(raw.layout_key);

  return {
    id: raw.id,
    slug: raw.slug,
    name: typeof raw.name === 'string' ? raw.name : raw.slug,
    timezone: typeof raw.timezone === 'string' ? raw.timezone : 'Europe/Madrid',
    locale: typeof raw.locale === 'string' ? raw.locale : 'es-ES',
    currency: typeof raw.currency === 'string' ? raw.currency : 'EUR',
    layoutKey,
    layoutVariant: isVariantOf(layoutKey, raw.layout_variant) ? raw.layout_variant : DEFAULT_VARIANT[layoutKey],
    designTokens: parseDesignTokens(raw.design_tokens),
    // Sin la clave (API anterior al motor de temas) no se oculta nada.
    features: raw.active_features === undefined ? ALL_FEATURES : parseFeatures(raw.active_features),
    slotIntervalMinutes: asSlotInterval(raw.slot_interval_minutes),
    theme: asRecord(raw.theme),
    publicConfig: asRecord(raw.public_config),
    contact: asRecord(raw.contact),
    hostname: typeof raw.hostname === 'string' ? raw.hostname : null,
  };
}
