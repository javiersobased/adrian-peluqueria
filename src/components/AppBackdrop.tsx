import { useBusiness } from '@/context/BusinessContext';
import { isLegacyBusiness } from '@/lib/business';
import { getContent } from '@/lib/businessContent';

// Fondo fijo de las vistas públicas. La variante classic_prestige conserva la foto y los velos
// originales (la del tenant heredado o la imagen propia del negocio); el resto usa su superficie.
export function AppBackdrop() {
  const business = useBusiness();

  if (business.layoutVariant === 'classic_prestige') {
    const image = isLegacyBusiness(business) ? '/images/hero-bg.jpg' : getContent(business).heroImageUrl;
    return (
      <div className="fixed inset-0 -z-20">
        {image && <img src={image} alt="" aria-hidden="true" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-black/85 backdrop-overlay transition-colors duration-300" />
        <div className="absolute inset-0 backdrop-blur-xl" />
      </div>
    );
  }

  return <div className="fixed inset-0 -z-20 bg-surface" aria-hidden="true" />;
}
