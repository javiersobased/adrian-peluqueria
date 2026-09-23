// Mapeo explícito de hosts heredados. No es un fallback: un host ausente no resuelve a ningún negocio.
// La fuente de verdad en producción será business_domains resuelto en servidor (Paso 5).

export interface LegacyTenant {
  businessId: string;
  slug: string;
}

export const ADRIAN_TENANT: LegacyTenant = {
  businessId: 'f67af497-5e58-48a2-8bea-022c4f1d7e1a',
  slug: 'adrian-millan',
};

const PRODUCTION_HOSTS = new Map<string, LegacyTenant>([
  ['www.adrianmillan.es', ADRIAN_TENANT],
  ['adrianmillan.es', ADRIAN_TENANT],
]);

const DEV_HOSTS = new Map<string, LegacyTenant>([
  ['localhost', ADRIAN_TENANT],
  ['127.0.0.1', ADRIAN_TENANT],
]);

export function normalizeHostname(rawHost: string): string {
  return rawHost.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

export function resolveLegacyTenant(rawHost: string): LegacyTenant | null {
  const host = normalizeHostname(rawHost);
  return PRODUCTION_HOSTS.get(host) ?? (import.meta.env.DEV ? DEV_HOSTS.get(host) ?? null : null);
}
