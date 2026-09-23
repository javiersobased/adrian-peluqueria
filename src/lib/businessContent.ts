import type { BusinessPublicConfig } from '@/lib/business';

// Lectura validada de businesses.public_config / contact / theme. Los valores por defecto se derivan
// del propio negocio; nunca se rellenan con datos de otro tenant.

function text(value: unknown, max = 300): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean ? clean.slice(0, max) : null;
}

function url(value: unknown): string | null {
  const clean = text(value, 500);
  if (!clean) return null;
  if (clean.startsWith('/') && !clean.startsWith('//')) return clean;
  try {
    return new URL(clean).protocol === 'https:' ? clean : null;
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export interface BusinessSeo {
  homeTitle: string;
  titleSuffix: string;
  adminTitleSuffix: string;
  description: string | null;
  ogTitle: string;
  ogDescription: string | null;
  twitterDescription: string | null;
  ogImage: string | null;
  siteName: string;
  appTitle: string;
}

export interface BusinessBrand {
  shortName: string;
  faviconUrl: string | null;
  logoUrl: string | null;
  themeColor: string | null;
}

export interface BusinessContact {
  phone: string | null;
  whatsappUrl: string | null;
  email: string | null;
  instagramUrl: string | null;
  address: string | null;
  mapsUrl: string | null;
}

export interface BusinessContent {
  tagline: string | null;
  about: string | null;
  heroImageUrl: string | null;
  hours: { day: string; hours: string }[];
}

export function getSeo(business: BusinessPublicConfig): BusinessSeo {
  const seo = record(business.publicConfig.seo);
  const name = business.name;
  const homeTitle = text(seo.homeTitle, 120) ?? name;
  return {
    homeTitle,
    titleSuffix: text(seo.titleSuffix, 80) ?? name,
    adminTitleSuffix: text(seo.adminTitleSuffix, 80) ?? name,
    description: text(seo.description),
    ogTitle: text(seo.ogTitle, 120) ?? homeTitle,
    ogDescription: text(seo.ogDescription) ?? text(seo.description),
    twitterDescription: text(seo.twitterDescription) ?? text(seo.ogDescription) ?? text(seo.description),
    ogImage: url(seo.ogImage),
    siteName: text(seo.siteName, 120) ?? name,
    appTitle: text(seo.appTitle, 40) ?? name,
  };
}

export function getBrand(business: BusinessPublicConfig): BusinessBrand {
  const brand = record(business.publicConfig.brand);
  const themeColor = text(brand.themeColor, 7);
  return {
    shortName: text(brand.shortName, 40) ?? business.name,
    faviconUrl: url(brand.faviconUrl),
    logoUrl: url(brand.logoUrl),
    themeColor: themeColor && /^#[0-9a-f]{6}$/i.test(themeColor) ? themeColor : null,
  };
}

export function getContact(business: BusinessPublicConfig): BusinessContact {
  const c = business.contact;
  const phone = text(c.phone, 30);
  const whatsapp = text(c.whatsapp, 30);
  const instagram = text(c.instagram, 60)?.replace(/^@/, '') ?? null;
  return {
    phone,
    whatsappUrl: whatsapp ? `https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}` : null,
    email: text(c.email, 120),
    instagramUrl: instagram && /^[a-z0-9._]+$/i.test(instagram) ? `https://instagram.com/${instagram}` : null,
    address: text(c.address, 200),
    mapsUrl: url(c.mapsUrl),
  };
}

export function getContent(business: BusinessPublicConfig): BusinessContent {
  const cfg = business.publicConfig;
  const hours = Array.isArray(cfg.hours)
    ? cfg.hours
        .map((h) => record(h))
        .map((h) => ({ day: text(h.day, 30), hours: text(h.hours, 60) }))
        .filter((h): h is { day: string; hours: string } => !!h.day && !!h.hours)
    : [];
  return {
    tagline: text(cfg.tagline, 160),
    about: text(cfg.about, 1200),
    heroImageUrl: url(cfg.heroImageUrl),
    hours,
  };
}

const THEME_TOKENS: Record<string, string> = {
  accent: '--color-accent',
  accentLight: '--color-accent-light',
  accentDark: '--color-accent-dark',
  surface: '--color-surface',
  surfaceSoft: '--color-surface-soft',
  surfaceMuted: '--color-surface-muted',
};

// Solo colores hex válidos de una lista cerrada de tokens; nunca CSS arbitrario.
export function getThemeOverrides(business: BusinessPublicConfig): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const [key, cssVar] of Object.entries(THEME_TOKENS)) {
    const value = text(business.theme[key], 7);
    const match = value?.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (match) {
      overrides[cssVar] = match.slice(1).map((h) => parseInt(h, 16)).join(' ');
    }
  }
  return overrides;
}
