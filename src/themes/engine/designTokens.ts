// Tokens de diseño de un negocio (layout_variants.default_tokens + businesses.design_tokens).
// Módulo puro: el esquema replica is_valid_design_tokens() de la base de datos, así que un valor
// que no pase aquí tampoco pudo guardarse allí.

export const PALETTE_KEYS = [
  'accent', 'accentLight', 'accentDark', 'accentContrast', 'surface', 'surfaceSoft',
  'surfaceMuted', 'marble', 'text', 'textMuted', 'border',
] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];

export const FONT_FAMILIES = [
  'Inter', 'Plus Jakarta Sans', 'Manrope', 'DM Sans', 'Space Grotesk', 'Archivo', 'Syne',
  'Josefin Sans', 'Poppins', 'Nunito', 'Quicksand', 'Fredoka', 'Baloo 2', 'Oswald', 'Bebas Neue',
  'Fraunces', 'Playfair Display', 'Cormorant Garamond', 'DM Serif Display', 'Lora',
] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export const RADII = ['none', 'sm', 'md', 'lg', 'xl', 'full'] as const;
export const SHADOWS = ['none', 'soft', 'medium', 'hard', 'glow'] as const;
export const MATERIALS = ['matte', 'glass', 'paper', 'metal', 'neon'] as const;
export const DENSITIES = ['compact', 'comfortable', 'spacious'] as const;

export interface DesignTokens {
  palette: Record<PaletteKey, string>;
  fonts: { display: FontFamily; body: FontFamily };
  radius: (typeof RADII)[number];
  shadow: (typeof SHADOWS)[number];
  material: (typeof MATERIALS)[number];
  density: (typeof DENSITIES)[number];
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function oneOf<T extends string>(list: readonly T[], value: unknown): T | null {
  return list.includes(value as T) ? (value as T) : null;
}

// Solo acepta tokens completos y válidos; cualquier otra cosa devuelve null (se usan los del CSS).
export function parseDesignTokens(value: unknown): DesignTokens | null {
  const raw = record(value);
  const palette = record(raw?.palette);
  const fonts = record(raw?.fonts);
  if (!raw || !palette || !fonts) return null;

  const parsedPalette = {} as Record<PaletteKey, string>;
  for (const key of PALETTE_KEYS) {
    const color = palette[key];
    if (typeof color !== 'string' || !HEX.test(color)) return null;
    parsedPalette[key] = color.toLowerCase();
  }

  const display = oneOf(FONT_FAMILIES, fonts.display);
  const body = oneOf(FONT_FAMILIES, fonts.body);
  const radius = oneOf(RADII, raw.radius);
  const shadow = oneOf(SHADOWS, raw.shadow);
  const material = oneOf(MATERIALS, raw.material);
  const density = oneOf(DENSITIES, raw.density);
  if (!display || !body || !radius || !shadow || !material || !density) return null;

  return { palette: parsedPalette, fonts: { display, body }, radius, shadow, material, density };
}

// ── Color ────────────────────────────────────────────────────────────────────────────────────

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channels(rgb: Rgb): string {
  return rgb.map((c) => Math.round(c)).join(' ');
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function saturation([r, g, b]: Rgb): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

export type Tone = 'light' | 'dark';

export function toneOf(tokens: DesignTokens): Tone {
  return luminance(hexToRgb(tokens.palette.surface)) > 0.4 ? 'light' : 'dark';
}

// ── Variables CSS ─────────────────────────────────────────────────────────────────────────────

const FONT_FALLBACK: Record<FontFamily, string> = {
  Inter: 'system-ui, sans-serif',
  'Plus Jakarta Sans': 'Inter, system-ui, sans-serif',
  Manrope: 'Inter, system-ui, sans-serif',
  'DM Sans': 'Inter, system-ui, sans-serif',
  'Space Grotesk': 'Inter, system-ui, sans-serif',
  Archivo: 'Inter, system-ui, sans-serif',
  Syne: 'Inter, system-ui, sans-serif',
  'Josefin Sans': 'Inter, system-ui, sans-serif',
  Poppins: 'Inter, system-ui, sans-serif',
  Nunito: 'Inter, system-ui, sans-serif',
  Quicksand: 'Inter, system-ui, sans-serif',
  Fredoka: 'Nunito, system-ui, sans-serif',
  'Baloo 2': 'Nunito, system-ui, sans-serif',
  Oswald: "'Arial Narrow', system-ui, sans-serif",
  'Bebas Neue': "'Arial Narrow', system-ui, sans-serif",
  Fraunces: "Georgia, 'Times New Roman', serif",
  'Playfair Display': "Georgia, 'Times New Roman', serif",
  'Cormorant Garamond': "Georgia, 'Times New Roman', serif",
  'DM Serif Display': "Georgia, 'Times New Roman', serif",
  Lora: "Georgia, 'Times New Roman', serif",
};

function fontStack(family: FontFamily): string {
  return `'${family}', ${FONT_FALLBACK[family]}`;
}

const RADIUS: Record<DesignTokens['radius'], [string, string]> = {
  none: ['0px', '0px'],
  sm: ['0.375rem', '0.25rem'],
  md: ['0.75rem', '0.5rem'],
  lg: ['1.25rem', '0.75rem'],
  xl: ['1.75rem', '1rem'],
  full: ['2.5rem', '9999px'],
};

const SHADOW: Record<DesignTokens['shadow'], string> = {
  none: 'none',
  soft: '0 10px 30px -12px rgb(0 0 0 / 0.25)',
  medium: '0 14px 40px -14px rgb(0 0 0 / 0.45)',
  hard: '6px 6px 0 0 rgb(var(--color-text))',
  glow: '0 0 0 1px rgb(var(--color-accent) / 0.45), 0 0 28px -4px rgb(var(--color-accent) / 0.55)',
};

const SECTION_PADDING: Record<DesignTokens['density'], string> = {
  compact: '3.5rem',
  comfortable: '5rem',
  spacious: '7rem',
};

const ZINC_STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '850', '900', '950'] as const;

// Escala neutra (zinc/white de Tailwind) teñida con la marca: el panel, la reserva y el resto de
// pantallas compartidas adoptan la identidad del negocio sin tocar su maquetación.
function neutralScale(tokens: DesignTokens, tone: Tone): Record<string, string> | null {
  const p = Object.fromEntries(PALETTE_KEYS.map((k) => [k, hexToRgb(tokens.palette[k])])) as Record<PaletteKey, Rgb>;
  const surface = p.surface;

  // Fondos casi negros y neutros ya son la escala zinc por defecto: no se toca (web clásica intacta).
  if (tone === 'dark' && luminance(surface) < 0.012 && saturation(surface) < 0.2) return null;

  const white: Rgb = [255, 255, 255];
  const steps: Record<(typeof ZINC_STEPS)[number], Rgb> =
    tone === 'dark'
      ? {
          '950': surface,
          '900': p.surfaceSoft,
          '850': mix(p.surfaceSoft, p.surfaceMuted, 0.5),
          '800': p.surfaceMuted,
          '700': p.border,
          '600': mix(p.border, p.textMuted, 0.5),
          '500': mix(p.border, p.textMuted, 0.8),
          '400': p.textMuted,
          '300': mix(p.textMuted, p.text, 0.5),
          '200': p.text,
          '100': mix(p.text, white, 0.35),
          '50': mix(p.text, white, 0.65),
        }
      : {
          '950': surface,
          '900': p.surfaceSoft,
          '850': mix(p.surfaceSoft, p.surfaceMuted, 0.5),
          '800': p.surfaceMuted,
          '700': p.border,
          '600': mix(p.border, p.textMuted, 0.55),
          '500': p.textMuted,
          '400': mix(p.textMuted, p.text, 0.3),
          '300': mix(p.textMuted, p.text, 0.55),
          '200': mix(p.textMuted, p.text, 0.8),
          '100': p.text,
          '50': p.text,
        };

  const vars: Record<string, string> = {};
  for (const step of ZINC_STEPS) vars[`--zinc-${step}`] = channels(steps[step]);
  vars['--white'] = channels(tone === 'dark' ? white : p.text);
  return vars;
}

export interface ThemeApplication {
  vars: Record<string, string>;
  attributes: Record<string, string>;
}

export function buildTheme(tokens: DesignTokens, variant: string): ThemeApplication {
  const { palette } = tokens;
  const tone = toneOf(tokens);
  const [cardRadius, controlRadius] = RADIUS[tokens.radius];
  const neutrals = neutralScale(tokens, tone);

  const vars: Record<string, string> = {
    '--color-accent': channels(hexToRgb(palette.accent)),
    '--color-accent-light': channels(hexToRgb(palette.accentLight)),
    '--color-accent-dark': channels(hexToRgb(palette.accentDark)),
    '--color-accent-contrast': channels(hexToRgb(palette.accentContrast)),
    '--color-surface': channels(hexToRgb(palette.surface)),
    '--color-surface-soft': channels(hexToRgb(palette.surfaceSoft)),
    '--color-surface-muted': channels(hexToRgb(palette.surfaceMuted)),
    '--color-marble': channels(hexToRgb(palette.marble)),
    '--color-text': channels(hexToRgb(palette.text)),
    '--color-text-muted': channels(hexToRgb(palette.textMuted)),
    '--color-border': channels(hexToRgb(palette.border)),
    '--font-display': fontStack(tokens.fonts.display),
    '--font-body': fontStack(tokens.fonts.body),
    '--radius-card': cardRadius,
    '--radius-control': controlRadius,
    '--shadow-card': SHADOW[tokens.shadow],
    '--section-py': SECTION_PADDING[tokens.density],
    ...(neutrals ?? {}),
  };

  const attributes: Record<string, string> = {
    variant,
    tone,
    material: tokens.material,
    density: tokens.density,
  };
  // data-brand marca que la escala neutra se ha teñido (activa los ajustes de index.css).
  if (neutrals) attributes.brand = '';

  return { vars, attributes };
}

// Fuentes que index.html ya carga siempre.
const PRELOADED_FONTS: FontFamily[] = ['Inter', 'Plus Jakarta Sans'];

// Google Fonts rechaza la petición entera si se pide un peso que la familia no tiene.
const SINGLE_WEIGHT: Partial<Record<FontFamily, string>> = {
  'Bebas Neue': '400',
  'DM Serif Display': '400',
};

export function googleFontsHref(tokens: DesignTokens): string | null {
  const families = [...new Set([tokens.fonts.display, tokens.fonts.body])].filter(
    (family) => !PRELOADED_FONTS.includes(family),
  );
  if (families.length === 0) return null;
  const query = families
    .map((family) => `family=${family.replace(/ /g, '+')}:wght@${SINGLE_WEIGHT[family] ?? '400;500;600;700'}`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}
