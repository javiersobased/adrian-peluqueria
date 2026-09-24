import { createContext, useContext } from 'react';
import type { BusinessPublicConfig } from '@/lib/businessModel';
import type { FeatureKey } from '@/lib/features';

export const BusinessContext = createContext<BusinessPublicConfig | null>(null);

// BusinessProvider solo renderiza a sus hijos con un negocio resuelto, así que nunca es null dentro.
export function useBusiness(): BusinessPublicConfig {
  const business = useContext(BusinessContext);
  if (!business) throw new Error('useBusiness debe usarse dentro de <BusinessProvider>');
  return business;
}

// Módulo del plan activo para el negocio actual (el servidor lo aplica igualmente en RLS).
export function useFeature(key: FeatureKey): boolean {
  return useBusiness().features[key];
}
