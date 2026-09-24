import type { LayoutKey, LayoutVariant } from '@/lib/businessModel';
import type { LayoutTypography, SectionKind, VariantConfig } from '@/themes/layouts/types';

export const LAYOUT_TYPOGRAPHY: Record<LayoutKey, LayoutTypography> = {
  // Barberías clásicas: mayúsculas espaciadas, estructura sólida.
  classic: {
    container: 'mx-auto w-full max-w-6xl px-5 sm:px-8',
    eyebrow: 'text-xs font-semibold uppercase tracking-[0.35em] text-accent',
    heading: 'font-display text-3xl uppercase tracking-wide sm:text-4xl',
    title: 'font-display text-4xl uppercase leading-[1.05] tracking-wide sm:text-6xl',
    body: 'text-base leading-relaxed text-fg-muted',
  },
  // Clínicas y estética: aire, contención y jerarquía suave.
  minimal: {
    container: 'mx-auto w-full max-w-4xl px-6 sm:px-10',
    eyebrow: 'text-[0.7rem] uppercase tracking-[0.3em] text-fg-muted',
    heading: 'font-display text-2xl font-light tracking-tight sm:text-3xl',
    title: 'font-display text-4xl font-light leading-tight tracking-tight sm:text-5xl',
    body: 'text-sm leading-relaxed text-fg-muted',
  },
  // Salones de belleza: tipografía grande y composición de revista.
  editorial: {
    container: 'mx-auto w-full max-w-6xl px-5 sm:px-8',
    eyebrow: 'text-xs uppercase tracking-[0.3em] text-accent',
    heading: 'font-display text-4xl italic sm:text-5xl',
    title: 'font-display text-5xl leading-[1.02] sm:text-6xl lg:text-7xl',
    body: 'text-lg leading-relaxed text-fg-muted',
  },
  // Negocios informales y mascotas: redondeado, cercano y con peso visual.
  playful: {
    container: 'mx-auto w-full max-w-5xl px-5 sm:px-8',
    eyebrow: 'text-sm font-bold text-accent',
    heading: 'font-display text-3xl font-bold sm:text-4xl',
    title: 'font-display text-5xl font-bold leading-[1.05] sm:text-6xl',
    body: 'text-base leading-relaxed text-fg-muted',
  },
};

const STANDARD_ORDER: SectionKind[] = ['services', 'store', 'team', 'gallery', 'visit'];
const VISUAL_ORDER: SectionKind[] = ['gallery', 'services', 'team', 'store', 'visit'];

export const VARIANT_CONFIGS: Record<LayoutVariant, VariantConfig> = {
  classic_heritage: { nav: 'centered', hero: 'fullbleed', services: 'menu', team: 'portraits', gallery: 'grid', visit: 'card', footer: 'bold', order: STANDARD_ORDER },
  classic_industrial: { nav: 'bar', hero: 'fullbleed', services: 'cards', team: 'circles', gallery: 'strip', visit: 'split', footer: 'simple', order: STANDARD_ORDER },
  classic_prestige: { nav: 'bar', hero: 'centered', services: 'menu', team: 'circles', gallery: 'mosaic', visit: 'card', footer: 'bold', order: STANDARD_ORDER },
  classic_street: { nav: 'bar', hero: 'magazine', services: 'cards', team: 'portraits', gallery: 'strip', visit: 'split', footer: 'bold', order: VISUAL_ORDER },
  classic_club: { nav: 'pill', hero: 'split', services: 'tiles', team: 'circles', gallery: 'grid', visit: 'card', footer: 'bold', order: STANDARD_ORDER },

  minimal_clinic: { nav: 'compact', hero: 'stack', services: 'compact', team: 'inline', gallery: 'grid', visit: 'minimal', footer: 'simple', order: STANDARD_ORDER },
  minimal_spa: { nav: 'centered', hero: 'centered', services: 'compact', team: 'circles', gallery: 'mosaic', visit: 'card', footer: 'simple', order: STANDARD_ORDER },
  minimal_luxury: { nav: 'centered', hero: 'split', services: 'menu', team: 'portraits', gallery: 'mosaic', visit: 'split', footer: 'simple', order: STANDARD_ORDER },
  minimal_botanical: { nav: 'compact', hero: 'blob', services: 'cards', team: 'circles', gallery: 'grid', visit: 'card', footer: 'simple', order: STANDARD_ORDER },
  minimal_chic: { nav: 'bar', hero: 'magazine', services: 'numbered', team: 'portraits', gallery: 'strip', visit: 'minimal', footer: 'simple', order: VISUAL_ORDER },

  editorial_magazine: { nav: 'bar', hero: 'split', services: 'numbered', team: 'portraits', gallery: 'mosaic', visit: 'split', footer: 'simple', order: STANDARD_ORDER },
  editorial_studio: { nav: 'pill', hero: 'magazine', services: 'cards', team: 'circles', gallery: 'strip', visit: 'card', footer: 'bold', order: STANDARD_ORDER },
  editorial_gallery: { nav: 'bar', hero: 'fullbleed', services: 'numbered', team: 'portraits', gallery: 'grid', visit: 'split', footer: 'simple', order: VISUAL_ORDER },
  editorial_fluid: { nav: 'pill', hero: 'blob', services: 'cards', team: 'circles', gallery: 'mosaic', visit: 'card', footer: 'bold', order: STANDARD_ORDER },
  editorial_pop: { nav: 'bar', hero: 'magazine', services: 'tiles', team: 'circles', gallery: 'grid', visit: 'card', footer: 'bold', order: VISUAL_ORDER },

  playful_paws: { nav: 'pill', hero: 'blob', services: 'tiles', team: 'circles', gallery: 'grid', visit: 'card', footer: 'bold', order: STANDARD_ORDER },
  playful_boutique: { nav: 'centered', hero: 'split', services: 'cards', team: 'circles', gallery: 'mosaic', visit: 'card', footer: 'simple', order: STANDARD_ORDER },
  playful_nature: { nav: 'pill', hero: 'fullbleed', services: 'tiles', team: 'circles', gallery: 'strip', visit: 'split', footer: 'bold', order: STANDARD_ORDER },
  playful_bubble: { nav: 'pill', hero: 'blob', services: 'cards', team: 'circles', gallery: 'grid', visit: 'card', footer: 'bold', order: STANDARD_ORDER },
  playful_vibrant: { nav: 'bar', hero: 'magazine', services: 'tiles', team: 'portraits', gallery: 'strip', visit: 'card', footer: 'bold', order: VISUAL_ORDER },
};
