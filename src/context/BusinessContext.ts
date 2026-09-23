import { createContext, useContext } from 'react';
import type { BusinessPublicConfig } from '@/lib/businessModel';

export const BusinessContext = createContext<BusinessPublicConfig | null>(null);

// BusinessProvider solo renderiza a sus hijos con un negocio resuelto, así que nunca es null dentro.
export function useBusiness(): BusinessPublicConfig {
  const business = useContext(BusinessContext);
  if (!business) throw new Error('useBusiness debe usarse dentro de <BusinessProvider>');
  return business;
}
