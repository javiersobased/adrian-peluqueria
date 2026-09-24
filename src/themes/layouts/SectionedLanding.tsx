import { useMemo, type ComponentType } from 'react';
import type { LandingProps } from '@/components/Landing';
import { useBusiness } from '@/context/BusinessContext';
import { getBrand, getContact, getContent } from '@/lib/businessContent';
import type { FeatureKey } from '@/lib/features';
import { LAYOUT_TYPOGRAPHY, VARIANT_CONFIGS } from '@/themes/layouts/catalog';
import { LandingContext, type LandingContextValue } from '@/themes/layouts/LandingContext';
import { useLandingData } from '@/themes/layouts/useLandingData';
import type { SectionKind } from '@/themes/layouts/types';
import { GALLERY } from '@/themes/layouts/sections/Gallery';
import { HERO } from '@/themes/layouts/sections/Hero';
import { NAV } from '@/themes/layouts/sections/Nav';
import { SERVICES } from '@/themes/layouts/sections/Services';
import { StoreSection } from '@/themes/layouts/sections/Store';
import { TEAM } from '@/themes/layouts/sections/Team';
import { FOOTER, VISIT } from '@/themes/layouts/sections/Visit';

// Módulo del plan del que depende cada bloque (los que no aparecen están siempre disponibles).
const SECTION_FEATURE: Partial<Record<SectionKind, FeatureKey>> = {
  store: 'has_store',
  gallery: 'has_gallery',
};

// Escaparate de cualquier variante: la variante decide la forma de cada bloque y su orden; aquí
// solo se resuelven por tabla, sin ramas por layout.
export default function SectionedLanding(props: LandingProps) {
  const business = useBusiness();
  const config = VARIANT_CONFIGS[business.layoutVariant];
  const data = useLandingData(business.features);

  const value = useMemo<LandingContextValue>(
    () => ({
      business,
      brand: getBrand(business),
      content: getContent(business),
      contact: getContact(business),
      data,
      type: LAYOUT_TYPOGRAPHY[business.layoutKey],
      config,
      actions: props,
      isStaff: props.role?.status === 'verified' && (props.role.role === 'admin' || props.role.role === 'barber'),
    }),
    [business, data, config, props],
  );

  const sections: Record<SectionKind, ComponentType> = {
    services: SERVICES[config.services],
    store: StoreSection,
    team: TEAM[config.team],
    gallery: GALLERY[config.gallery],
    visit: VISIT[config.visit],
  };
  const visible = config.order.filter((kind) => {
    const feature = SECTION_FEATURE[kind];
    return !feature || business.features[feature];
  });

  const Nav = NAV[config.nav];
  const Hero = HERO[config.hero];
  const Footer = FOOTER[config.footer];

  return (
    <LandingContext.Provider value={value}>
      <div className="min-h-screen bg-surface font-sans text-fg">
        <Nav />
        <main id="inicio">
          <Hero />
          {visible.map((kind) => {
            const Section = sections[kind];
            return <Section key={kind} />;
          })}
        </main>
        <Footer />
      </div>
    </LandingContext.Provider>
  );
}
