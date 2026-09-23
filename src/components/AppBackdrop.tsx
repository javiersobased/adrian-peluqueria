import { useBusiness } from '@/context/BusinessContext';
import { isLegacyBusiness } from '@/lib/business';
import { getContent } from '@/lib/businessContent';

// Fondo fijo de las vistas públicas. El layout classic del tenant heredado conserva su foto y
// velos originales; el resto usa la superficie del tema o la imagen propia del negocio.
export function AppBackdrop() {
  const business = useBusiness();

  if (business.layoutKey === 'classic') {
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
