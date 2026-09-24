import { focusRing, useLanding } from '@/themes/layouts/LandingContext';
import type { FooterStyle, SectionMap, VisitStyle } from '@/themes/layouts/types';

function useContactLinks() {
  const { contact } = useLanding();
  return [
    contact.mapsUrl && { label: 'Cómo llegar ↗', href: contact.mapsUrl },
    contact.phone && { label: contact.phone, href: `tel:${contact.phone}` },
    contact.whatsappUrl && { label: 'WhatsApp ↗', href: contact.whatsappUrl },
    contact.instagramUrl && { label: 'Instagram ↗', href: contact.instagramUrl },
    contact.email && { label: contact.email, href: `mailto:${contact.email}` },
  ].filter(Boolean) as { label: string; href: string }[];
}

function ContactList({ className }: { className: string }) {
  const links = useContactLinks();
  return (
    <ul className={className}>
      {links.map((link) => (
        <li key={link.href}>
          <a
            className={`hover:text-accent ${focusRing}`}
            href={link.href}
            {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

function Hours({ className }: { className: string }) {
  const { content } = useLanding();
  if (content.hours.length === 0) return null;
  return (
    <dl className={className}>
      {content.hours.map((h) => (
        <div key={h.day} className="flex justify-between gap-6 py-3 text-sm">
          <dt className="font-display text-base">{h.day}</dt>
          <dd className="text-fg-muted tabular-nums">{h.hours}</dd>
        </div>
      ))}
    </dl>
  );
}

function SplitVisit() {
  const { type, contact } = useLanding();
  return (
    <section id="visitanos" aria-labelledby="visitanos-titulo" className="border-t border-line bg-surface-soft">
      <div className={`${type.container} grid gap-12 py-section md:grid-cols-2`}>
        <div>
          <h2 id="visitanos-titulo" className={type.heading}>Visítanos</h2>
          {contact.address && <p className="mt-6 text-lg">{contact.address}</p>}
          <ContactList className="mt-6 space-y-2 text-sm text-fg-muted" />
        </div>
        <Hours className="divide-y divide-line border-y border-line" />
      </div>
    </section>
  );
}

function CardVisit() {
  const { type, contact } = useLanding();
  return (
    <section id="visitanos" aria-labelledby="visitanos-titulo" className="border-t border-line">
      <div className={`${type.container} py-section`}>
        <div className="theme-card grid gap-10 p-8 sm:p-12 md:grid-cols-2">
          <div>
            <h2 id="visitanos-titulo" className={type.heading}>Visítanos</h2>
            {contact.address && <p className="mt-6 text-lg">{contact.address}</p>}
            <ContactList className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg-muted" />
          </div>
          <Hours className="divide-y divide-line" />
        </div>
      </div>
    </section>
  );
}

function MinimalVisit() {
  const { type, contact } = useLanding();
  return (
    <section id="visitanos" aria-labelledby="visitanos-titulo">
      <div className={`${type.container} space-y-6 py-section`}>
        <h2 id="visitanos-titulo" className={type.eyebrow}>Horario y contacto</h2>
        <Hours className="max-w-md space-y-1" />
        {contact.address && <p className="text-sm text-fg-muted">{contact.address}</p>}
        <ContactList className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted" />
      </div>
    </section>
  );
}

function SimpleFooter() {
  const { type, business, actions } = useLanding();
  return (
    <footer className="border-t border-line">
      <div className={`${type.container} flex flex-col items-start justify-between gap-4 py-8 text-xs text-fg-muted sm:flex-row sm:items-center`}>
        <p>© {new Date().getFullYear()} {business.name}</p>
        <button type="button" onClick={actions.onBook} className={`uppercase tracking-[0.2em] text-accent hover:text-accent-light ${focusRing}`}>
          Reservar cita →
        </button>
      </div>
    </footer>
  );
}

function BoldFooter() {
  const { type, business, content, actions } = useLanding();
  return (
    <footer>
      <div className="bg-accent text-accent-contrast">
        <div className={`${type.container} flex flex-col items-start justify-between gap-6 py-section sm:flex-row sm:items-center`}>
          <p className="font-display text-3xl sm:text-4xl">{content.tagline ?? '¿Te guardamos un hueco?'}</p>
          <button
            type="button"
            onClick={actions.onBook}
            className={`rounded-control border-2 border-current px-8 py-4 text-sm font-semibold transition hover:bg-accent-contrast hover:text-accent ${focusRing}`}
          >
            Reservar cita
          </button>
        </div>
      </div>
      <div className={`${type.container} py-6 text-xs text-fg-muted`}>© {new Date().getFullYear()} {business.name}</div>
    </footer>
  );
}

export const VISIT: SectionMap<VisitStyle> = {
  split: SplitVisit,
  card: CardVisit,
  minimal: MinimalVisit,
};

export const FOOTER: SectionMap<FooterStyle> = {
  simple: SimpleFooter,
  bold: BoldFooter,
};
