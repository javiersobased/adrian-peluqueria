import { lazy, type ComponentType } from 'react';
import { Landing, type LandingProps } from '@/components/Landing';
import { isLegacyBusiness } from '@/lib/business';
import type { BusinessPublicConfig } from '@/lib/businessModel';

// Las 20 variantes comparten un único escaparate por bloques (se descarga aparte). La web clásica
// original de Adrián Millán tiene contenido propio y se conserva intacta para su variante.
const SectionedLanding = lazy(() => import('@/themes/layouts/SectionedLanding'));

export function landingFor(business: BusinessPublicConfig): ComponentType<LandingProps> {
  return isLegacyBusiness(business) && business.layoutVariant === 'classic_prestige' ? Landing : SectionedLanding;
}
