import type { BusinessPublicConfig } from '@/lib/businessModel';
import { buildTheme, googleFontsHref } from '@/themes/engine/designTokens';

const THEME_ATTRIBUTES = ['variant', 'tone', 'material', 'density', 'brand'] as const;
const FONT_LINK_ID = 'business-theme-fonts';

// Vuelca los tokens del negocio en <html> (variables CSS + data-*) y carga sus fuentes.
// Devuelve la función que deshace los cambios. Sin tokens (tenant heredado sin SaaS) no toca nada.
export function applyTheme(root: HTMLElement, business: BusinessPublicConfig): () => void {
  root.dataset.variant = business.layoutVariant;
  if (!business.designTokens) {
    return () => {
      delete root.dataset.variant;
    };
  }

  const { vars, attributes } = buildTheme(business.designTokens, business.layoutVariant);
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  for (const [name, value] of Object.entries(attributes)) root.dataset[name] = value;

  const href = googleFontsHref(business.designTokens);
  let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
  if (href) {
    if (!link) {
      link = document.createElement('link');
      link.id = FONT_LINK_ID;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  } else {
    link?.remove();
  }

  return () => {
    for (const name of Object.keys(vars)) root.style.removeProperty(name);
    for (const name of THEME_ATTRIBUTES) delete root.dataset[name];
  };
}
