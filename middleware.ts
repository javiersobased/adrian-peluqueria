// Routing Middleware de Vercel: sirve el index.html con el <head> y el <noscript> del negocio
// que corresponde al dominio, para que WhatsApp, redes sociales y buscadores vean su propia
// marca sin ejecutar JavaScript. Los dominios de Adrián Millán pasan sin tocarse.
import { next } from '@vercel/functions/middleware';
import { normalizeHostname, parseBusinessRow, type BusinessPublicConfig } from './src/lib/businessModel';
import { rewriteIndexHtml } from './src/lib/tenantHeadHtml';

export const config = {
  // Solo rutas de la SPA: excluye /assets y cualquier fichero con extensión (incluido /index.html).
  matcher: '/((?!assets/|.*\\..*).*)',
};

const LEGACY_HOSTS = new Set(['www.adrianmillan.es', 'adrianmillan.es']);
const LEGACY_BUSINESS_ID = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a';
const CACHE_TTL_MS = 60_000;

// undefined = no se pudo consultar; null = dominio sin negocio activo.
const cache = new Map<string, { at: number; business: BusinessPublicConfig | null }>();

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.VITE_SUPABASE_URL?.match(/https:\/\/[a-z0-9-]+\.supabase\.co/)?.[0];
  const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();
  return url && key ? { url, key } : null;
}

// Las previews solo se mapean con una variable exclusiva del entorno Preview.
function lookupHost(host: string): string {
  const previewHost = process.env.VITE_TENANT_PREVIEW_HOST;
  if (process.env.VERCEL_ENV === 'preview' && previewHost && host.endsWith('.vercel.app')) {
    return normalizeHostname(previewHost);
  }
  return host;
}

async function resolveBusiness(host: string): Promise<BusinessPublicConfig | null | undefined> {
  const cached = cache.get(host);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.business;

  const supabase = supabaseConfig();
  if (!supabase) return undefined;

  const res = await fetch(`${supabase.url}/rest/v1/rpc/resolve_business_by_host`, {
    method: 'POST',
    headers: {
      apikey: supabase.key,
      Authorization: `Bearer ${supabase.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_hostname: host }),
  });
  if (!res.ok) return undefined;

  const business = parseBusinessRow(await res.json());
  cache.set(host, { at: Date.now(), business });
  return business;
}

function notFound(): Response {
  return new Response(
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Sitio no disponible</title></head>' +
      '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#e5e5e5;font-family:system-ui,sans-serif;text-align:center">' +
      '<main><h1 style="font-size:1.125rem">Sitio no disponible</h1>' +
      '<p style="color:#a3a3a3;font-size:.875rem">Este dominio no está asociado a ningún negocio activo.</p></main></body></html>',
    { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );
}

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const host = normalizeHostname(url.hostname);
  if (LEGACY_HOSTS.has(host)) return next();

  let business: BusinessPublicConfig | null | undefined;
  try {
    business = await resolveBusiness(lookupHost(host));
  } catch (err) {
    console.error('[middleware] resolve_business_by_host', err);
    business = undefined;
  }

  // Si la consulta falla se sirve la SPA tal cual: la app resuelve el negocio en el cliente.
  if (business === undefined) return next();
  if (business === null) return notFound();
  if (business.id === LEGACY_BUSINESS_ID) return next();

  const page = await fetch(new URL('/index.html', url));
  if (!page.ok) return next();

  const origin = `https://${business.hostname ?? host}`;
  const html = rewriteIndexHtml(await page.text(), business, origin);
  if (!html) return next();

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
      'x-business': business.slug,
    },
  });
}
