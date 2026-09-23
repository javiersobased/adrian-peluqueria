// HTML estático por negocio para el middleware de Vercel (vistas previas de WhatsApp, redes y
// buscadores que no ejecutan JavaScript). Solo importa módulos puros.
import { absoluteUrl, businessJsonLd, getBrand, getContact, getContent, getSeo, monogramIcon } from './businessContent';
import type { BusinessPublicConfig } from './businessModel';

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function meta(attr: 'name' | 'property', key: string, value: string | null): string {
  return value ? `    <meta ${attr}="${key}" content="${esc(value)}" />` : '';
}

const FONT_LINKS: Partial<Record<BusinessPublicConfig['layoutKey'], string>> = {
  editorial: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&display=swap',
};

export function buildTenantHead(business: BusinessPublicConfig, origin: string): string {
  const seo = getSeo(business);
  const brand = getBrand(business);
  const image = absoluteUrl(origin, seo.ogImage);
  const icon = brand.faviconUrl ?? monogramIcon(brand.shortName);
  const jsonLd = JSON.stringify(businessJsonLd(business, origin)).replace(/</g, '\\u003c');
  const font = FONT_LINKS[business.layoutKey];

  return [
    '    <!-- tenant-head:start -->',
    `    <title>${esc(seo.homeTitle)}</title>`,
    meta('name', 'description', seo.description),
    '    <meta name="robots" content="index, follow, max-image-preview:large" />',
    `    <link rel="canonical" href="${esc(origin)}/" />`,
    `    <link rel="icon" href="${esc(icon)}" />`,
    `    <link rel="apple-touch-icon" href="${esc(icon)}" />`,
    meta('name', 'theme-color', brand.themeColor),
    meta('name', 'apple-mobile-web-app-title', seo.appTitle),
    '    <meta property="og:type" content="website" />',
    meta('property', 'og:url', `${origin}/`),
    meta('property', 'og:site_name', seo.siteName),
    meta('property', 'og:title', seo.ogTitle),
    meta('property', 'og:description', seo.ogDescription),
    meta('property', 'og:image', image),
    meta('property', 'og:image:alt', image ? business.name : null),
    meta('property', 'og:locale', business.locale.replace('-', '_')),
    `    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    meta('name', 'twitter:url', `${origin}/`),
    meta('name', 'twitter:title', seo.ogTitle),
    meta('name', 'twitter:description', seo.twitterDescription),
    meta('name', 'twitter:image', image),
    font ? `    <link href="${esc(font)}" rel="stylesheet" />` : '',
    `    <script type="application/ld+json" data-business="${esc(business.slug)}">${jsonLd}</script>`,
    '    <!-- tenant-head:end -->',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildTenantNoscript(business: BusinessPublicConfig): string {
  const seo = getSeo(business);
  const content = getContent(business);
  const contact = getContact(business);
  const lines = [
    `<h1>${esc(business.name)}</h1>`,
    content.tagline ? `<p>${esc(content.tagline)}</p>` : '',
    seo.description ? `<p>${esc(seo.description)}</p>` : '',
    contact.address ? `<p>Dirección: ${esc(contact.address)}</p>` : '',
    contact.phone ? `<p>Teléfono: ${esc(contact.phone)}</p>` : '',
    '<p>Para reservar tu cita online, activa JavaScript en tu navegador.</p>',
  ].filter(Boolean);
  return [
    '      <!-- tenant-noscript:start -->',
    '      <noscript>',
    `        <div style="padding:2rem;max-width:800px;margin:0 auto;text-align:center;font-family:sans-serif;">${lines.join('')}</div>`,
    '      </noscript>',
    '      <!-- tenant-noscript:end -->',
  ].join('\n');
}

// Sustituye los bloques marcados de index.html. Devuelve null si faltan marcadores.
export function rewriteIndexHtml(html: string, business: BusinessPublicConfig, origin: string): string | null {
  const head = /[ \t]*<!-- tenant-head:start -->[\s\S]*?<!-- tenant-head:end -->/;
  const noscript = /[ \t]*<!-- tenant-noscript:start -->[\s\S]*?<!-- tenant-noscript:end -->/;
  if (!head.test(html) || !noscript.test(html)) return null;

  const lang = esc(business.locale.split('-')[0] || 'es');
  return html
    .replace(head, () => buildTenantHead(business, origin))
    .replace(noscript, () => buildTenantNoscript(business))
    .replace(/<html\b[^>]*>/, `<html lang="${lang}" data-business="${esc(business.slug)}" data-layout="${business.layoutKey}">`);
}
