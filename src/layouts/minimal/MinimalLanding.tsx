import type { LandingProps } from '@/components/Landing';
import { useBusiness } from '@/context/BusinessContext';
import { getBrand, getContact, getContent } from '@/lib/businessContent';
import { formatPrice, serviceMinutes, useLandingData } from '@/layouts/useLandingData';

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-surface';

export default function MinimalLanding({
  onBook,
  onSignIn,
  onGoToPanel,
  user,
  role,
  onSignOut,
  onGoToMyBookings,
  onSelectService,
}: LandingProps) {
  const business = useBusiness();
  const brand = getBrand(business);
  const content = getContent(business);
  const contact = getContact(business);
  const { services, barbers, loading } = useLandingData(0);
  const isStaff = role?.status === 'verified' && (role.role === 'admin' || role.role === 'barber');

  const links = [
    contact.phone && { label: contact.phone, href: `tel:${contact.phone}` },
    contact.whatsappUrl && { label: 'WhatsApp', href: contact.whatsappUrl },
    contact.instagramUrl && { label: 'Instagram', href: contact.instagramUrl },
    contact.mapsUrl && { label: 'Mapa', href: contact.mapsUrl },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="min-h-screen bg-surface text-zinc-300">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <header className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-zinc-500">
          <span>{brand.shortName}</span>
          <div className="flex gap-4">
            {user ? (
              <>
                {isStaff && <button type="button" onClick={onGoToPanel} className={`hover:text-accent ${focusRing}`}>Panel</button>}
                {onGoToMyBookings && <button type="button" onClick={onGoToMyBookings} className={`hover:text-accent ${focusRing}`}>Citas</button>}
                {onSignOut && <button type="button" onClick={onSignOut} className={`hover:text-accent ${focusRing}`}>Salir</button>}
              </>
            ) : (
              <button type="button" onClick={onSignIn} className={`hover:text-accent ${focusRing}`}>Acceder</button>
            )}
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center py-16">
          <h1 className="font-display text-3xl font-light tracking-tight text-accent-light">{business.name}</h1>
          {content.tagline && <p className="mt-3 text-sm text-zinc-500">{content.tagline}</p>}

          <button
            type="button"
            onClick={onBook}
            className={`mt-10 w-full rounded-full bg-accent py-4 text-sm font-medium text-surface transition hover:bg-accent-light ${focusRing}`}
          >
            Reservar cita
          </button>

          <section aria-labelledby="servicios-min" className="mt-16">
            <h2 id="servicios-min" className="text-xs uppercase tracking-[0.25em] text-zinc-500">Servicios</h2>
            <ul className="mt-4">
              {loading && <li className="py-3 text-sm text-zinc-600">Cargando…</li>}
              {services.map((service) => {
                const minutes = serviceMinutes(service);
                return (
                  <li key={service.id}>
                    <button
                      type="button"
                      onClick={() => (onSelectService ? onSelectService(service) : onBook())}
                      className={`flex w-full items-baseline justify-between gap-4 border-b border-zinc-800/80 py-3 text-left hover:text-accent-light ${focusRing}`}
                    >
                      <span className="text-sm">
                        {service.name}
                        {minutes && <span className="ml-2 text-xs text-zinc-600">{minutes}′</span>}
                      </span>
                      <span className="text-sm tabular-nums">{formatPrice(service.price, business.currency, business.locale)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {barbers.length > 0 && (
            <section aria-labelledby="equipo-min" className="mt-12">
              <h2 id="equipo-min" className="text-xs uppercase tracking-[0.25em] text-zinc-500">Equipo</h2>
              <p className="mt-4 text-sm text-zinc-400">{barbers.map((b) => b.name).join(' · ')}</p>
            </section>
          )}

          {content.hours.length > 0 && (
            <section aria-labelledby="horario-min" className="mt-12">
              <h2 id="horario-min" className="text-xs uppercase tracking-[0.25em] text-zinc-500">Horario</h2>
              <dl className="mt-4 space-y-1 text-sm">
                {content.hours.map((h) => (
                  <div key={h.day} className="flex justify-between gap-4">
                    <dt className="text-zinc-500">{h.day}</dt>
                    <dd className="text-right tabular-nums">{h.hours}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </main>

        <footer className="space-y-3 text-xs text-zinc-600">
          {contact.address && <p>{contact.address}</p>}
          {links.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className={`hover:text-accent ${focusRing}`}
                    {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </footer>
      </div>
    </div>
  );
}
