import { createContext, useContext } from 'react';
import type { LandingProps } from '@/components/Landing';
import type { BusinessPublicConfig } from '@/lib/businessModel';
import type { BusinessContact, BusinessContent, BusinessBrand } from '@/lib/businessContent';
import type { LandingData } from '@/themes/layouts/useLandingData';
import type { LayoutTypography, VariantConfig } from '@/themes/layouts/types';

export interface LandingContextValue {
  business: BusinessPublicConfig;
  brand: BusinessBrand;
  content: BusinessContent;
  contact: BusinessContact;
  data: LandingData;
  type: LayoutTypography;
  config: VariantConfig;
  actions: LandingProps;
  isStaff: boolean;
}

export const LandingContext = createContext<LandingContextValue | null>(null);

export function useLanding(): LandingContextValue {
  const value = useContext(LandingContext);
  if (!value) throw new Error('useLanding debe usarse dentro de SectionedLanding');
  return value;
}

export const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface';
