// Routing Middleware de Vercel: sirve el index.html con el <head> y el <noscript> del negocio
// que corresponde al dominio, para que WhatsApp, redes sociales y buscadores vean su propia
// marca sin ejecutar JavaScript. Los dominios de Adrián Millán pasan sin tocarse.
//
// Autocontenido a propósito: Vercel compila este archivo con resolución `nodenext` y sin empaquetar
// imports relativos, así que no puede importar módulos de src/ (fallaría al cargar en el edge).
// La lectura de public_config replica la de src/lib/businessContent.ts y la de las fuentes la de
// src/themes/engine/designTokens.ts.
import { next } from '@vercel/functions/middleware';

export const config = {
  // Solo rutas de la SPA: excluye /assets y cualquier fichero con extensión (incluido /index.html).
  matcher: '/((?!assets/|.*\\..*).*)',
};

const LEGACY_HOSTS = new Set(['www.adrianmillan.es', 'adrianmillan.es']);
const LEGACY_BUSINESS_ID = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a';
const LAYOUT_KEYS = ['classic', 'editorial', 'minimal', 'playful'];
const CACHE_TTL_MS = 60_000;
const FONT_FAMILIES = new Set([
  'Inter', 'Plus Jakarta Sans', 'Manrope', 'DM Sans', 'Space Grotesk', 'Archivo', 'Syne',
  'Josefin Sans', 'Poppins', 'Nunito', 'Quicksand', 'Fredoka', 'Baloo 2', 'Oswald', 'Bebas Neue',
  'Fraunces', 'Playfair Display', 'Cormorant Garamond', 'DM Serif Display', 'Lora',
]);
const PRELOADED_FONTS = new Set(['Inter', 'Plus Jakarta Sans']);
const SINGLE_WEIGHT_FONTS = new Set(['Bebas Neue', 'DM Serif Display']);

type Json = Record<string, unknown>;

interface Business {
  id: string;
  slug: string;
  name: string;
  locale: string;
  layoutKey: string;
  layoutVariant: string | null;
  fonts: string[];
  surfaceColor: string | null;
  seoAdvanced: boolean;
  publicConfig: Json;
  contact: Json;
  hostname: string | null;
}

// Valor null = dominio sin negocio activo. Los fallos de consulta no se cachean.
const cache = new Map<string, { at: number; business: Business | null }>();

function normalizeHostname(rawHost: string): string {
  return rawHost.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

function record(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
}

function text(value: unknown, max = 300): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean ? clean.slice(0, max) : null;
}

function safeUrl(value: unknown): string | null {
  const clean = text(value, 500);
  if (!clean) return null;
  if (clean.startsWith('/') && !clean.startsWith('//')) return clean;
  try {
    return new URL(clean).protocol === 'https:' ? clean : null;
  } catch {
    return null;
  }
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseBusiness(data: unknown): Business | null {
  const raw = record(data);
  if (typeof raw.id !== 'string' || typeof raw.slug !== 'string') return null;
  const tokens = record(raw.design_tokens);
  const fonts = record(tokens.fonts);
  const surface = record(tokens.palette).surface;
  const features = record(raw.active_features);
  return {
    id: raw.id,
    slug: raw.slug,
    name: typeof raw.name === 'string' ? raw.name : raw.slug,
    locale: typeof raw.locale === 'string' ? raw.locale : 'es-ES',
    layoutKey: LAYOUT_KEYS.includes(raw.layout_key as string) ? (raw.layout_key as string) : 'classic',
    layoutVariant: typeof raw.layout_variant === 'string' && /^[a-z]+_[a-z]+$/.test(raw.layout_variant) ? raw.layout_variant : null,
    fonts: [...new Set([fonts.display, fonts.body])].filter((f): f is string => FONT_FAMILIES.has(f as string)),
    surfaceColor: typeof surface === 'string' && /^#[0-9a-f]{6}$/i.test(surface) ? surface : null,
    // Sin la clave (API anterior al motor de temas) se conserva el comportamiento completo.
    seoAdvanced: raw.active_features === undefined || features.enable_seo_advanced === true,
    publicConfig: record(raw.public_config),
    contact: record(raw.contact),
    hostname: typeof raw.hostname === 'string' ? raw.hostname : null,
  };
}

function monogramIcon(name: string): string {
  const letter = (name.trim()[0] ?? '·').toUpperCase().replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#111"/><text x="32" y="43" font-family="Georgia,serif" font-size="34" text-anchor="middle" fill="#fff">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function googleFontsHref(families: string[]): string | null {
  const toLoad = families.filter((family) => !PRELOADED_FONTS.has(family));
  if (toLoad.length === 0) return null;
  const query = toLoad
    .map((family) => `family=${family.replace(/ /g, '+')}:wght@${SINGLE_WEIGHT_FONTS.has(family) ? '400' : '400;500;600;700'}`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

function meta(attr: 'name' | 'property', key: string, value: string | null): string {
  return value ? `    <meta ${attr}="${key}" content="${esc(value)}" />` : '';
}

function buildHead(business: Business, origin: string): string {
  const seo = record(business.publicConfig.seo);
  const brand = record(business.publicConfig.brand);
  const homeTitle = text(seo.homeTitle, 120) ?? business.name;
  const description = text(seo.description);
  const ogTitle = text(seo.ogTitle, 120) ?? homeTitle;
  const ogDescription = text(seo.ogDescription) ?? description;
  const twitterDescription = text(seo.twitterDescription) ?? ogDescription;
  const siteName = text(seo.siteName, 120) ?? business.name;
  const appTitle = text(seo.appTitle, 40) ?? business.name;
  const shortName = text(brand.shortName, 40) ?? business.name;
  const themeColor = text(brand.themeColor, 7) ?? business.surfaceColor;
  const ogImage = safeUrl(seo.ogImage);
  const image = ogImage?.startsWith('/') ? `${origin}${ogImage}` : ogImage;
  const icon = safeUrl(brand.faviconUrl) ?? monogramIcon(shortName);
  const phone = text(business.contact.phone, 30);
  const address = text(business.contact.address, 200);
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name,
    url: `${origin}/`,
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(address ? { address } : {}),
  }).replace(/</g, '\\u003c');
  const font = googleFontsHref(business.fonts);

  return [
    '    <!-- tenant-head:start -->',
    `    <title>${esc(homeTitle)}</title>`,
    meta('name', 'description', description),
    '    <meta name="robots" content="index, follow, max-image-preview:large" />',
    `    <link rel="canonical" href="${esc(origin)}/" />`,
    `    <link rel="icon" href="${esc(icon)}" />`,
    `    <link rel="apple-touch-icon" href="${esc(icon)}" />`,
    meta('name', 'theme-color', themeColor && /^#[0-9a-f]{6}$/i.test(themeColor) ? themeColor : null),
    meta('name', 'apple-mobile-web-app-title', appTitle),
    '    <meta property="og:type" content="website" />',
    meta('property', 'og:url', `${origin}/`),
    meta('property', 'og:site_name', siteName),
    meta('property', 'og:title', ogTitle),
    meta('property', 'og:description', ogDescription),
    meta('property', 'og:image', image),
    meta('property', 'og:image:alt', image ? business.name : null),
    meta('property', 'og:locale', business.locale.replace('-', '_')),
    `    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    meta('name', 'twitter:url', `${origin}/`),
    meta('name', 'twitter:title', ogTitle),
    meta('name', 'twitter:description', twitterDescription),
    meta('name', 'twitter:image', image),
    font ? `    <link href="${esc(font)}" rel="stylesheet" />` : '',
    // Los datos estructurados forman parte del módulo de SEO avanzado.
    business.seoAdvanced ? `    <script type="application/ld+json" data-business="${esc(business.slug)}">${jsonLd}</script>` : '',
    '    <!-- tenant-head:end -->',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildNoscript(business: Business): string {
  const seo = record(business.publicConfig.seo);
  const parts = [
    `<h1>${esc(business.name)}</h1>`,
    text(business.publicConfig.tagline, 160),
    text(seo.description),
    text(business.contact.address, 200) && `Dirección: ${text(business.contact.address, 200)}`,
    text(business.contact.phone, 30) && `Teléfono: ${text(business.contact.phone, 30)}`,
    'Para reservar tu cita online, activa JavaScript en tu navegador.',
  ]
    .filter((p): p is string => !!p)
    .map((p) => (p.startsWith('<h1>') ? p : `<p>${esc(p)}</p>`));
  return [
    '      <!-- tenant-body:start -->',
    '      <noscript>',
    `        <div style="padding:2rem;max-width:800px;margin:0 auto;text-align:center;font-family:sans-serif;">${parts.join('')}</div>`,
    '      </noscript>',
    '      <!-- tenant-body:end -->',
  ].join('\n');
}

// Sustituye los bloques marcados de index.html. Devuelve null si faltan marcadores.
function rewriteIndexHtml(html: string, business: Business, origin: string): string | null {
  const head = /[ \t]*<!-- tenant-head:start -->[\s\S]*?<!-- tenant-head:end -->/;
  // Incluye el <noscript> y el contenido SEO prerenderizado del tenant heredado dentro de #root.
  const body = /[ \t]*<!-- tenant-body:start -->[\s\S]*?<!-- tenant-body:end -->/;
  if (!head.test(html) || !body.test(html)) return null;
  const lang = esc(business.locale.split('-')[0] || 'es');
  return html
    .replace(head, () => buildHead(business, origin))
    .replace(body, () => buildNoscript(business))
    .replace(/<html\b[^>]*>/, `<html lang="${lang}" data-business="${esc(business.slug)}" data-layout="${business.layoutKey}"${business.layoutVariant ? ` data-variant="${business.layoutVariant}"` : ''}>`);
}

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.VITE_SUPABASE_URL?.match(/https:\/\/[a-z0-9-]+\.supabase\.co/)?.[0];
  const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();
  return url && key ? { url, key } : null;
}

// Las previews solo se mapean con una variable exclusiva del entorno Preview.
function lookupHost(host: string): string {
  if (host === 'saas-demo-preview.vercel.app') return host;
  const previewHost = process.env.VITE_TENANT_PREVIEW_HOST;
  if (process.env.VERCEL_ENV === 'preview' && previewHost && host.endsWith('.vercel.app')) {
    return normalizeHostname(previewHost);
  }
  return host;
}

// undefined = no se pudo consultar; null = dominio sin negocio activo.
async function resolveBusiness(host: string): Promise<Business | null | undefined> {
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

  const business = parseBusiness(await res.json());
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

  let business: Business | null | undefined;
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

  try {
    // Reenvía la cookie para que la petición interna pase la protección de las previews.
    const cookie = request.headers.get('cookie');
    const page = await fetch(new URL('/index.html', url), {
      headers: cookie ? { cookie } : undefined,
      redirect: 'manual',
    });
    if (!page.ok) {
      console.error('[middleware] index.html', page.status);
      return next();
    }
    const html = rewriteIndexHtml(await page.text(), business, `https://${business.hostname ?? host}`);
    if (!html) return next();
    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, must-revalidate',
        'x-business': business.slug,
      },
    });
  } catch (err) {
    console.error('[middleware] rewrite', err);
    return next();
  }
}
