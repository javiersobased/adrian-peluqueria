import { supabase } from '@/lib/supabase';

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

export const LEGACY_BUSINESS: BusinessPublicConfig = {
  id: 'f67af497-5e58-48a2-8bea-022c4f1d7e1a',
  slug: 'adrian-millan',
  name: 'Peluquería y Barbería Adrián Millán',
  timezone: 'Europe/Madrid',
  locale: 'es-ES',
  currency: 'EUR',
  layoutKey: 'classic',
  theme: {},
  publicConfig: {},
  contact: {},
  hostname: 'www.adrianmillan.es',
};

export function normalizeHostname(rawHost: string): string {
  return rawHost.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

// Hostname que se busca en business_domains. Las previews de Vercel solo se mapean si su build
// define VITE_TENANT_PREVIEW_HOST (variable exclusiva del entorno Preview).
export function lookupHostFor(rawHost: string): string {
  const host = normalizeHostname(rawHost);
  // Alias explícitos de desarrollo: Vite elimina esta rama en el build de producción.
  if (import.meta.env.DEV && (host === 'localhost' || host === '127.0.0.1')) return 'www.adrianmillan.es';
  const previewHost = import.meta.env.VITE_TENANT_PREVIEW_HOST;
  if (previewHost && host.endsWith('.vercel.app')) return normalizeHostname(previewHost);
  return host;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asLayoutKey(value: unknown): LayoutKey {
  return LAYOUT_KEYS.includes(value as LayoutKey) ? (value as LayoutKey) : 'classic';
}

export async function fetchBusinessByHost(host: string): Promise<BusinessPublicConfig | null> {
  const { data, error } = await supabase.rpc('resolve_business_by_host', { p_hostname: host });
  if (error) throw error;
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
