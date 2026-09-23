import { isLegacyBusiness, type BusinessPublicConfig } from '@/lib/business';
import { pageTitle } from '@/lib/documentHead';

export type PwaContext = 'booking' | 'admin';

// Los manifests estáticos de /public describen al tenant heredado; otros negocios no ofrecen
// instalación hasta disponer de manifest propio.
const LEGACY_MANIFESTS: Record<PwaContext, string> = {
  booking: '/manifest-booking.json',
  admin: '/manifest-admin.json',
};

/**
 * Points the page's <link rel="manifest"> and title/apple-mobile-web-app-title
 * to the right app for the screen currently on display, so that pulsing
 * "Instalar app" from Reservas vs desde Admin creates two separate icons on
 * the home screen (each with su propio nombre y su propia start_url), aunque
 * ambas vivan en el mismo despliegue.
 */
export function setActivePwaContext(context: PwaContext, business: BusinessPublicConfig) {
  const title = pageTitle(business, context === 'admin' ? 'admin' : 'home');

  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (isLegacyBusiness(business)) {
    const manifest = LEGACY_MANIFESTS[context];
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== manifest) {
      link.setAttribute('href', manifest);
    }
  } else {
    link?.remove();
  }

  document.title = title;

  let appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (!appleTitle) {
    appleTitle = document.createElement('meta');
    appleTitle.name = 'apple-mobile-web-app-title';
    document.head.appendChild(appleTitle);
  }
  appleTitle.setAttribute('content', title);
}
