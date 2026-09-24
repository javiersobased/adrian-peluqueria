import type { ComponentType } from 'react';

export type NavStyle = 'bar' | 'centered' | 'compact' | 'pill';
export type HeroStyle = 'split' | 'fullbleed' | 'centered' | 'stack' | 'magazine' | 'blob';
export type ServicesStyle = 'numbered' | 'menu' | 'cards' | 'compact' | 'tiles';
export type TeamStyle = 'portraits' | 'circles' | 'inline';
export type GalleryStyle = 'mosaic' | 'grid' | 'strip';
export type VisitStyle = 'split' | 'card' | 'minimal';
export type FooterStyle = 'simple' | 'bold';

// Bloques del escaparate que se pueden ordenar. Los que dependen de un módulo del plan se omiten
// solos si el negocio no lo tiene contratado.
export type SectionKind = 'services' | 'store' | 'team' | 'gallery' | 'visit';

// Una variante es pura configuración: qué forma toma cada bloque y en qué orden aparecen.
export interface VariantConfig {
  nav: NavStyle;
  hero: HeroStyle;
  services: ServicesStyle;
  team: TeamStyle;
  gallery: GalleryStyle;
  visit: VisitStyle;
  footer: FooterStyle;
  order: SectionKind[];
}

// Personalidad tipográfica y de maquetación común a todas las variantes de un layout.
export interface LayoutTypography {
  container: string;
  eyebrow: string;
  heading: string;
  title: string;
  body: string;
}

export type SectionMap<Style extends string> = Record<Style, ComponentType>;
