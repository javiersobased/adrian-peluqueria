import { supabase } from '@/lib/supabase';
import { LEGACY_CONTACT, LEGACY_PUBLIC_CONFIG } from '@/lib/legacyBusinessContent';
import { normalizeHostname, parseBusinessRow, type BusinessPublicConfig } from '@/lib/businessModel';
import { ALL_FEATURES } from '@/lib/features';

export const LEGACY_BUSINESS: BusinessPublicConfig = {
  id: 'f67af497-5e58-48a2-8bea-022c4f1d7e1a',
  slug: 'adrian-millan',
  name: 'Peluquería y Barbería Adrián Millán',
  timezone: 'Europe/Madrid',
  locale: 'es-ES',
  currency: 'EUR',
  layoutKey: 'classic',
  layoutVariant: 'classic_prestige',
  designTokens: null,
  features: ALL_FEATURES,
  slotIntervalMinutes: 10,
  theme: {},
  publicConfig: LEGACY_PUBLIC_CONFIG,
  contact: LEGACY_CONTACT,
  hostname: 'www.adrianmillan.es',
};

export function isLegacyBusiness(business: BusinessPublicConfig): boolean {
  return business.id === LEGACY_BUSINESS.id;
}

// Hostname que se busca en business_domains. Las previews de Vercel solo se mapean si su build
// define VITE_TENANT_PREVIEW_HOST (variable exclusiva del entorno Preview).
export function lookupHostFor(rawHost: string): string {
  const host = normalizeHostname(rawHost);
  // Alias explícitos de desarrollo: Vite elimina esta rama en el build de producción.
  if (import.meta.env.DEV && (host === 'localhost' || host === '127.0.0.1')) return 'www.adrianmillan.es';
  if (host === 'saas-demo-preview.vercel.app') return host;
  const previewHost = import.meta.env.VITE_TENANT_PREVIEW_HOST;
  if (previewHost && host.endsWith('.vercel.app')) return normalizeHostname(previewHost);
  return host;
}

export async function fetchBusinessByHost(host: string): Promise<BusinessPublicConfig | null> {
  const { data, error } = await supabase.rpc('resolve_business_by_host', { p_hostname: host });
  if (error) throw error;
  return parseBusinessRow(data);
}
