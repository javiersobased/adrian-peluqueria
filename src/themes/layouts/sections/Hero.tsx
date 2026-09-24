import { focusRing, useLanding } from '@/themes/layouts/LandingContext';
import type { HeroStyle, SectionMap } from '@/themes/layouts/types';

function useHeroData() {
  const { business, content, data, brand } = useLanding();
  return {
    eyebrow: business.name,
    title: content.tagline ?? business.name,
    about: content.about,
    image: content.heroImageUrl ?? data.photos[0]?.image_url ?? null,
    initial: brand.shortName.charAt(0),
    alt: `Interior de ${business.name}`,
  };
}

function PrimaryCta({ className = '' }: { className?: string }) {
  const { actions } = useLanding();
  return (
    <button type="button" onClick={actions.onBook} className={`theme-button px-8 py-4 text-sm font-semibold ${focusRing} ${className}`}>
      Reservar cita
    </button>
  );
}

function SecondaryCta() {
  return (
    <a href="#servicios" className={`border-b border-accent/40 pb-1 text-sm text-fg-muted hover:text-accent ${focusRing}`}>
      Ver servicios
    </a>
  );
}

function ImageOrMonogram({ className }: { className: string }) {
  const hero = useHeroData();
  return (
    <div className={`overflow-hidden bg-surface-soft ${className}`}>
      {hero.image ? (
        <img src={hero.image} alt={hero.alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center font-display text-8xl text-accent/30" aria-hidden="true">
          {hero.initial}
        </div>
      )}
    </div>
  );
}

function SplitHero() {
  const { type, contact } = useLanding();
  const hero = useHeroData();
  return (
    <section className={`${type.container} grid gap-10 py-section md:grid-cols-12`}>
      <div className="flex flex-col justify-center md:col-span-7 md:pr-6">
        <p className={type.eyebrow}>{hero.eyebrow}</p>
        <h1 className={`mt-6 ${type.title}`}>{hero.title}</h1>
        {hero.about && <p className={`mt-8 max-w-xl ${type.body}`}>{hero.about}</p>}
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <PrimaryCta />
          <SecondaryCta />
        </div>
      </div>
      <figure className="md:col-span-5">
        <ImageOrMonogram className="aspect-[4/5] rounded-theme" />
        {contact.address && <figcaption className="mt-3 text-xs uppercase tracking-[0.25em] text-fg-muted">{contact.address}</figcaption>}
      </figure>
    </section>
  );
}

function FullbleedHero() {
  const { type } = useLanding();
  const hero = useHeroData();
  return (
    <section className="relative isolate overflow-hidden">
      {hero.image ? (
        <img src={hero.image} alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-surface-muted via-surface-soft to-surface" aria-hidden="true" />
      )}
      <div className="absolute inset-0 -z-10 bg-surface/75" aria-hidden="true" />
      <div className={`${type.container} flex min-h-[70vh] flex-col items-center justify-center py-section text-center`}>
        <p className={type.eyebrow}>{hero.eyebrow}</p>
        <h1 className={`mt-6 max-w-4xl ${type.title}`}>{hero.title}</h1>
        {hero.about && <p className={`mt-6 max-w-2xl ${type.body}`}>{hero.about}</p>}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
          <PrimaryCta />
          <SecondaryCta />
        </div>
      </div>
    </section>
  );
}

function CenteredHero() {
  const { type } = useLanding();
  const hero = useHeroData();
  return (
    <section className={`${type.container} flex flex-col items-center py-section text-center`}>
      <span className="h-px w-16 bg-accent" aria-hidden="true" />
      <p className={`mt-8 ${type.eyebrow}`}>{hero.eyebrow}</p>
      <h1 className={`mt-6 max-w-3xl ${type.title}`}>{hero.title}</h1>
      {hero.about && <p className={`mt-6 max-w-xl ${type.body}`}>{hero.about}</p>}
      <PrimaryCta className="mt-10" />
    </section>
  );
}

function StackHero() {
  const { type, business } = useLanding();
  const hero = useHeroData();
  return (
    <section className={`${type.container} py-section`}>
      <div className="max-w-md">
        <h1 className={type.title}>{business.name}</h1>
        {hero.title !== business.name && <p className={`mt-4 ${type.body}`}>{hero.title}</p>}
        <PrimaryCta className="mt-10 w-full" />
      </div>
    </section>
  );
}

function MagazineHero() {
  const { type } = useLanding();
  const hero = useHeroData();
  return (
    <section className={`${type.container} py-section`}>
      <p className={type.eyebrow}>{hero.eyebrow}</p>
      <h1 className="mt-6 font-display text-6xl uppercase leading-[0.9] tracking-tight sm:text-8xl lg:text-9xl">
        {hero.title}
      </h1>
      <div className="mt-12 grid gap-10 md:grid-cols-12">
        <ImageOrMonogram className="aspect-[16/9] rounded-theme md:col-span-8" />
        <div className="flex flex-col justify-end gap-8 md:col-span-4">
          {hero.about && <p className={type.body}>{hero.about}</p>}
          <PrimaryCta className="self-start" />
        </div>
      </div>
    </section>
  );
}

function BlobHero() {
  const { type } = useLanding();
  const hero = useHeroData();
  return (
    <section className={`${type.container} grid items-center gap-12 py-section md:grid-cols-2`}>
      <div>
        <p className={type.eyebrow}>{hero.eyebrow}</p>
        <h1 className={`mt-4 ${type.title}`}>{hero.title}</h1>
        {hero.about && <p className={`mt-6 ${type.body}`}>{hero.about}</p>}
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <PrimaryCta />
          <SecondaryCta />
        </div>
      </div>
      <div className="relative mx-auto w-full max-w-md">
        <div className="absolute -inset-4 -z-10 rounded-[42%_58%_63%_37%/45%_40%_60%_55%] bg-accent/25" aria-hidden="true" />
        <ImageOrMonogram className="aspect-square rounded-[58%_42%_38%_62%/52%_60%_40%_48%]" />
      </div>
    </section>
  );
}

export const HERO: SectionMap<HeroStyle> = {
  split: SplitHero,
  fullbleed: FullbleedHero,
  centered: CenteredHero,
  stack: StackHero,
  magazine: MagazineHero,
  blob: BlobHero,
};
