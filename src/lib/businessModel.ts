// Modelo puro del negocio: sin dependencias de navegador ni de Supabase, para poder usarse
// tanto en la SPA como en el middleware de Vercel.

export const LAYOUT_KEYS = ['classic', 'editorial', 'minimal'] as const;
export type LayoutKey = (typeof LAYOUT_KEYS)[number];

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

  return {
    id: raw.id,
    slug: raw.slug,
    name: typeof raw.name === 'string' ? raw.name : raw.slug,
    timezone: typeof raw.timezone === 'string' ? raw.timezone : 'Europe/Madrid',
    locale: typeof raw.locale === 'string' ? raw.locale : 'es-ES',
    currency: typeof raw.currency === 'string' ? raw.currency : 'EUR',
    layoutKey: asLayoutKey(raw.layout_key),
    slotIntervalMinutes: asSlotInterval(raw.slot_interval_minutes),
    theme: asRecord(raw.theme),
    publicConfig: asRecord(raw.public_config),
    contact: asRecord(raw.contact),
    hostname: typeof raw.hostname === 'string' ? raw.hostname : null,
  };
}
