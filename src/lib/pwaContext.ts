export type PwaContext = 'booking' | 'admin';

const CONFIG: Record<PwaContext, { manifest: string; title: string }> = {
  booking: {
    manifest: '/manifest-booking.json',
    title: 'Reservas · Adrián Millán',
  },
  admin: {
    manifest: '/manifest-admin.json',
    title: 'Admin · Adrián Millán',
  },
};

/**
 * Points the page's <link rel="manifest"> and title/apple-mobile-web-app-title
 * to the right app for the screen currently on display, so that pulsing
 * "Instalar app" from Reservas vs desde Admin creates two separate icons on
 * the home screen (each with su propio nombre y su propia start_url), aunque
 * ambas vivan en el mismo despliegue.
 */
export function setActivePwaContext(context: PwaContext) {
  const { manifest, title } = CONFIG[context];

  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== manifest) {
    link.setAttribute('href', manifest);
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
