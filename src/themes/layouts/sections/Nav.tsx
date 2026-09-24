import { focusRing, useLanding } from '@/themes/layouts/LandingContext';
import type { NavStyle, SectionMap } from '@/themes/layouts/types';

function useNavLinks() {
  const { data, config, business } = useLanding();
  return [
    { href: '#servicios', label: 'Servicios', show: true },
    { href: '#equipo', label: 'Equipo', show: data.barbers.length > 0 },
    { href: '#trabajos', label: 'Trabajos', show: business.features.has_gallery && data.photos.length > 0 && config.order.includes('gallery') },
    { href: '#visitanos', label: 'Visítanos', show: true },
  ].filter((link) => link.show);
}

function AccountActions({ className = '' }: { className?: string }) {
  const { actions, isStaff } = useLanding();
  const { user, onGoToPanel, onGoToMyBookings, onSignOut, onSignIn } = actions;
  const item = `text-fg-muted hover:text-accent ${focusRing}`;

  return (
    <div className={`flex items-center gap-4 text-sm ${className}`}>
      {user ? (
        <>
          {isStaff && <button type="button" onClick={onGoToPanel} className={item}>Panel</button>}
          {onGoToMyBookings && <button type="button" onClick={onGoToMyBookings} className={item}>Mis citas</button>}
          {onSignOut && <button type="button" onClick={onSignOut} className={item}>Salir</button>}
        </>
      ) : (
        <button type="button" onClick={onSignIn} className={item}>Acceder</button>
      )}
    </div>
  );
}

function Links({ className }: { className: string }) {
  const links = useNavLinks();
  return (
    <ul className={className}>
      {links.map((link) => (
        <li key={link.href}>
          <a className={`hover:text-accent ${focusRing}`} href={link.href}>{link.label}</a>
        </li>
      ))}
    </ul>
  );
}

function BarNav() {
  const { brand, type } = useLanding();
  return (
    <header className="border-b border-line">
      <nav aria-label="Principal" className={`${type.container} flex items-center justify-between gap-6 py-5`}>
        <a href="#inicio" className={`font-display text-xl tracking-tight sm:text-2xl ${focusRing}`}>{brand.shortName}</a>
        <Links className="hidden items-center gap-8 text-sm text-fg-muted md:flex" />
        <AccountActions />
      </nav>
    </header>
  );
}

function CenteredNav() {
  const { brand, type } = useLanding();
  return (
    <header className="border-b border-line">
      <nav aria-label="Principal" className={`${type.container} flex flex-col items-center gap-4 py-6`}>
        <div className="flex w-full items-center justify-between">
          <span className="hidden w-32 md:block" aria-hidden="true" />
          <a href="#inicio" className={`font-display text-2xl tracking-wide sm:text-3xl ${focusRing}`}>{brand.shortName}</a>
          <AccountActions className="w-32 justify-end" />
        </div>
        <Links className="hidden items-center gap-10 text-xs uppercase tracking-[0.25em] text-fg-muted md:flex" />
      </nav>
    </header>
  );
}

function CompactNav() {
  const { brand, type } = useLanding();
  return (
    <header>
      <nav aria-label="Principal" className={`${type.container} flex items-center justify-between py-8 text-xs uppercase tracking-[0.25em] text-fg-muted`}>
        <a href="#inicio" className={focusRing}>{brand.shortName}</a>
        <AccountActions className="text-xs" />
      </nav>
    </header>
  );
}

function PillNav() {
  const { brand, type } = useLanding();
  return (
    <header className="sticky top-3 z-30">
      <nav aria-label="Principal" className={`${type.container}`}>
        <div className="theme-card flex items-center justify-between gap-4 !rounded-full px-5 py-3">
          <a href="#inicio" className={`font-display text-lg font-semibold ${focusRing}`}>{brand.shortName}</a>
          <Links className="hidden items-center gap-6 text-sm text-fg-muted md:flex" />
          <AccountActions />
        </div>
      </nav>
    </header>
  );
}

export const NAV: SectionMap<NavStyle> = {
  bar: BarNav,
  centered: CenteredNav,
  compact: CompactNav,
  pill: PillNav,
};
