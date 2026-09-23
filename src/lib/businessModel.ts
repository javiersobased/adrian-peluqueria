// Modelo puro del negocio: sin dependencias de navegador ni de Supabase, para poder usarse
// tanto en la SPA como en el middleware de Vercel.

export const LAYOUT_KEYS = ['classic', 'editorial', 'minimal'] as const;
export type LayoutKey = (typeof LAYOUT_KEYS)[number];

export interface BusinessPublicConfig {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  locale: string;
  currency: string;
  layoutKey: LayoutKey;
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
    theme: asRecord(raw.theme),
    publicConfig: asRecord(raw.public_config),
    contact: asRecord(raw.contact),
    hostname: typeof raw.hostname === 'string' ? raw.hostname : null,
  };
}
