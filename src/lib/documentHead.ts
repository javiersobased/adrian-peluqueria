import { isLegacyBusiness } from '@/lib/business';
import type { BusinessPublicConfig } from '@/lib/businessModel';
import { absoluteUrl, businessJsonLd, getBrand, getSeo, monogramIcon } from '@/lib/businessContent';

export type PageKey =
  | 'home'
  | 'admin'
  | 'catalog'
  | 'gallery'
  | 'my-bookings'
  | 'barber'
  | 'service'
  | 'datetime'
  | 'details'
  | 'success';

const PAGE_LABELS: Record<Exclude<PageKey, 'home' | 'admin'>, string> = {
  catalog: 'Tienda y Productos',
  gallery: 'Galería de Cortes y Estilos',
  'my-bookings': 'Mis Citas',
  barber: 'Seleccionar Barbero',
  service: 'Seleccionar Servicio',
  datetime: 'Elegir Fecha y Hora',
  details: 'Tus Datos de Contacto',
  success: '¡Cita Confirmada!',
};

export function pageTitle(business: BusinessPublicConfig, page: PageKey): string {
  const seo = getSeo(business);
  if (page === 'home') return seo.homeTitle;
  if (page === 'admin') return `Panel de Gestión | ${seo.adminTitleSuffix}`;
  return `${PAGE_LABELS[page]} | ${seo.titleSuffix}`;
}

// Etiquetas estáticas de index.html que solo describen al tenant heredado (por si el HTML no
// pasó por el middleware, p. ej. en desarrollo o previews).
const LEGACY_ONLY_SELECTORS = [
  'meta[name="keywords"]',
  'meta[name="author"]',
  'meta[name="google-site-verification"]',
  'meta[name="geo.region"]',
  'meta[name="geo.placename"]',
  'meta[name="geo.position"]',
  'meta[name="ICBM"]',
  'meta[property="og:image:width"]',
  'meta[property="og:image:height"]',
  'meta[property="og:image:alt"]',
  'script[type="application/ld+json"]:not([data-business])',
];

function setMeta(attr: 'name' | 'property', key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  if (el.getAttribute('content') !== content) el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  if (el.getAttribute('href') !== href) el.setAttribute('href', href);
}

const LAYOUT_FONTS: Partial<Record<BusinessPublicConfig['layoutKey'], string>> = {
  editorial: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&display=swap',
};

export function applyBusinessHead(business: BusinessPublicConfig) {
  const seo = getSeo(business);
  const brand = getBrand(business);
  const legacy = isLegacyBusiness(business);
  const origin = business.hostname ? `https://${business.hostname}` : window.location.origin;
  const image = absoluteUrl(origin, seo.ogImage);

  if (!legacy) {
    for (const selector of LEGACY_ONLY_SELECTORS) {
      document.head.querySelectorAll(selector).forEach((el) => el.remove());
    }
  }

  document.documentElement.lang = business.locale.split('-')[0] || 'es';

  setMeta('name', 'description', seo.description);
  setMeta('property', 'og:url', `${origin}/`);
  setMeta('property', 'og:site_name', seo.siteName);
  setMeta('property', 'og:title', seo.ogTitle);
  setMeta('property', 'og:description', seo.ogDescription);
  setMeta('property', 'og:image', image);
  setMeta('property', 'og:locale', business.locale.replace('-', '_'));
  setMeta('name', 'twitter:url', `${origin}/`);
  setMeta('name', 'twitter:title', seo.ogTitle);
  setMeta('name', 'twitter:description', seo.twitterDescription);
  setMeta('name', 'twitter:image', image);
  setMeta('name', 'theme-color', brand.themeColor);
  setMeta('name', 'apple-mobile-web-app-title', seo.appTitle);
  setLink('canonical', `${origin}/`);

  const icon = brand.faviconUrl ?? monogramIcon(brand.shortName);
  setLink('icon', icon);
  setLink('apple-touch-icon', icon);

  if (!legacy) {
    let script = document.head.querySelector<HTMLScriptElement>('script[data-business]');
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.business = business.slug;
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(businessJsonLd(business, origin));
  }

  const fontHref = LAYOUT_FONTS[business.layoutKey];
  if (fontHref && !document.head.querySelector(`link[href="${fontHref}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fontHref;
    document.head.appendChild(link);
  }
}
