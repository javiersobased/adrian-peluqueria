import type { LandingProps } from '@/components/Landing';
import { useBusiness } from '@/context/BusinessContext';
import { getBrand, getContact, getContent } from '@/lib/businessContent';
import { formatPrice, serviceMinutes, useLandingData } from '@/layouts/useLandingData';

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

export default function EditorialLanding({
  onBook,
  onSignIn,
  onGoToPanel,
  user,
  role,
  onSignOut,
  onGoToMyBookings,
  onGoToGallery,
  onSelectService,
}: LandingProps) {
  const business = useBusiness();
  const brand = getBrand(business);
  const content = getContent(business);
  const contact = getContact(business);
  const { services, barbers, photos, loading } = useLandingData(5);
  const isStaff = role?.status === 'verified' && (role.role === 'admin' || role.role === 'barber');

  return (
    <div className="min-h-screen bg-surface text-marble">
      <header className="border-b border-accent/15">
        <nav aria-label="Principal" className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-5 sm:px-8">
          <a href="#inicio" className={`font-display text-xl tracking-tight sm:text-2xl ${focusRing}`}>
            {brand.shortName}
          </a>
          <ul className="hidden items-center gap-8 text-sm text-marble/70 md:flex">
            <li><a className={`hover:text-accent ${focusRing}`} href="#servicios">Servicios</a></li>
            {barbers.length > 0 && <li><a className={`hover:text-accent ${focusRing}`} href="#equipo">Equipo</a></li>}
            {photos.length > 0 && <li><a className={`hover:text-accent ${focusRing}`} href="#trabajos">Trabajos</a></li>}
            <li><a className={`hover:text-accent ${focusRing}`} href="#visitanos">Visítanos</a></li>
          </ul>
          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                {isStaff && (
                  <button type="button" onClick={onGoToPanel} className={`text-marble/70 hover:text-accent ${focusRing}`}>
                    Panel
                  </button>
                )}
                {onGoToMyBookings && (
                  <button type="button" onClick={onGoToMyBookings} className={`text-marble/70 hover:text-accent ${focusRing}`}>
                    Mis citas
                  </button>
                )}
                {onSignOut && (
                  <button type="button" onClick={onSignOut} className={`text-marble/50 hover:text-accent ${focusRing}`}>
                    Salir
                  </button>
                )}
              </>
            ) : (
              <button type="button" onClick={onSignIn} className={`text-marble/70 hover:text-accent ${focusRing}`}>
                Acceder
              </button>
            )}
          </div>
        </nav>
      </header>

      <main id="inicio">
        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-12 md:py-24">
          <div className="md:col-span-7 md:pr-6">
            <p className="text-xs uppercase tracking-[0.3em] text-accent">{business.name}</p>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
              {content.tagline ?? business.name}
            </h1>
            {content.about && (
              <p className="mt-8 max-w-xl text-lg leading-relaxed text-marble/70">{content.about}</p>
            )}
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <button
                type="button"
                onClick={onBook}
                className={`bg-accent px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-surface transition hover:bg-accent-light ${focusRing}`}
              >
                Reservar cita
              </button>
              <a href="#servicios" className={`border-b border-accent/40 pb-1 text-sm text-marble/80 hover:text-accent ${focusRing}`}>
                Ver servicios
              </a>
            </div>
          </div>
          <figure className="md:col-span-5">
            <div className="aspect-[4/5] overflow-hidden bg-surface-soft">
              {content.heroImageUrl || photos[0] ? (
                <img
                  src={content.heroImageUrl ?? photos[0].image_url}
                  alt={`Interior de ${business.name}`}
                  className="h-full w-full object-cover grayscale-[20%]"
                />
              ) : (
                <div className="flex h-full items-center justify-center font-display text-8xl text-accent/30" aria-hidden="true">
                  {brand.shortName.charAt(0)}
                </div>
              )}
            </div>
            {contact.address && (
              <figcaption className="mt-3 text-xs uppercase tracking-[0.25em] text-marble/50">{contact.address}</figcaption>
            )}
          </figure>
        </section>

        <section id="servicios" aria-labelledby="servicios-titulo" className="border-t border-accent/15">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-12 md:py-24">
            <div className="md:col-span-4">
              <h2 id="servicios-titulo" className="font-display text-4xl italic">Servicios</h2>
              <p className="mt-4 text-sm leading-relaxed text-marble/60">
                Elige un servicio para empezar tu reserva. La duración es orientativa.
              </p>
            </div>
            <ol className="md:col-span-8">
              {loading && <li className="py-6 text-marble/50">Cargando servicios…</li>}
              {!loading && services.length === 0 && <li className="py-6 text-marble/50">Pronto publicaremos nuestros servicios.</li>}
              {services.map((service, index) => {
                const minutes = serviceMinutes(service);
                return (
                  <li key={service.id} className="border-b border-accent/10">
                    <button
                      type="button"
                      onClick={() => (onSelectService ? onSelectService(service) : onBook())}
                      className={`group flex w-full items-baseline gap-4 py-6 text-left ${focusRing}`}
                    >
                      <span className="w-8 shrink-0 font-display text-sm text-accent">{String(index + 1).padStart(2, '0')}</span>
                      <span className="font-display text-2xl group-hover:text-accent">{service.name}</span>
                      <span className="hidden flex-1 border-b border-dotted border-marble/20 sm:block" aria-hidden="true" />
                      <span className="ml-auto shrink-0 text-right">
                        <span className="block text-lg">{formatPrice(service.price, business.currency, business.locale)}</span>
                        {minutes && <span className="block text-xs text-marble/50">{minutes} min</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {barbers.length > 0 && (
          <section id="equipo" aria-labelledby="equipo-titulo" className="border-t border-accent/15 bg-surface-soft">
            <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-24">
              <h2 id="equipo-titulo" className="font-display text-4xl italic">El equipo</h2>
              <ul className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-4">
                {barbers.map((barber) => (
                  <li key={barber.id}>
                    <div className="aspect-[3/4] overflow-hidden bg-surface-muted">
                      {barber.photo_url ? (
                        <img src={barber.photo_url} alt={barber.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center font-display text-5xl text-accent/40" aria-hidden="true">
                          {barber.initials}
                        </div>
                      )}
                    </div>
                    <p className="mt-4 font-display text-xl">{barber.name}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-marble/50">{barber.role}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {photos.length > 0 && (
          <section id="trabajos" aria-labelledby="trabajos-titulo" className="border-t border-accent/15">
            <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-24">
              <div className="flex items-end justify-between gap-6">
                <h2 id="trabajos-titulo" className="font-display text-4xl italic">Trabajos recientes</h2>
                {onGoToGallery && (
                  <button type="button" onClick={onGoToGallery} className={`border-b border-accent/40 pb-1 text-sm hover:text-accent ${focusRing}`}>
                    Ver galería
                  </button>
                )}
              </div>
              <ul className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3">
                {photos.map((photo, index) => (
                  <li key={photo.id} className={index === 0 ? 'col-span-2 row-span-2 md:col-span-2' : ''}>
                    <img
                      src={photo.image_url}
                      alt={photo.title || `Trabajo de ${business.name}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section id="visitanos" aria-labelledby="visitanos-titulo" className="border-t border-accent/15 bg-surface-soft">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-2 md:py-24">
            <div>
              <h2 id="visitanos-titulo" className="font-display text-4xl italic">Visítanos</h2>
              {contact.address && <p className="mt-6 text-lg">{contact.address}</p>}
              <ul className="mt-6 space-y-2 text-sm text-marble/70">
                {contact.mapsUrl && <li><a className={`hover:text-accent ${focusRing}`} href={contact.mapsUrl} target="_blank" rel="noreferrer">Cómo llegar ↗</a></li>}
                {contact.phone && <li><a className={`hover:text-accent ${focusRing}`} href={`tel:${contact.phone}`}>{contact.phone}</a></li>}
                {contact.whatsappUrl && <li><a className={`hover:text-accent ${focusRing}`} href={contact.whatsappUrl} target="_blank" rel="noreferrer">WhatsApp ↗</a></li>}
                {contact.instagramUrl && <li><a className={`hover:text-accent ${focusRing}`} href={contact.instagramUrl} target="_blank" rel="noreferrer">Instagram ↗</a></li>}
                {contact.email && <li><a className={`hover:text-accent ${focusRing}`} href={`mailto:${contact.email}`}>{contact.email}</a></li>}
              </ul>
            </div>
            {content.hours.length > 0 && (
              <dl className="divide-y divide-accent/10 border-y border-accent/10">
                {content.hours.map((h) => (
                  <div key={h.day} className="flex justify-between gap-6 py-3 text-sm">
                    <dt className="font-display text-base">{h.day}</dt>
                    <dd className="text-marble/70">{h.hours}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-accent/15">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 text-xs text-marble/50 sm:flex-row sm:items-center sm:px-8">
          <p>© {new Date().getFullYear()} {business.name}</p>
          <button type="button" onClick={onBook} className={`uppercase tracking-[0.2em] text-accent hover:text-accent-light ${focusRing}`}>
            Reservar cita →
          </button>
        </div>
      </footer>
    </div>
  );
}
