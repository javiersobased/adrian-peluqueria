import type { Barber } from '@/types';
import { useLanding } from '@/themes/layouts/LandingContext';
import type { SectionMap, TeamStyle } from '@/themes/layouts/types';

function TeamShell({ children }: { children: React.ReactNode }) {
  const { type, data } = useLanding();
  if (data.barbers.length === 0) return null;
  return (
    <section id="equipo" aria-labelledby="equipo-titulo" className="border-t border-line bg-surface-soft">
      <div className={`${type.container} py-section`}>
        <h2 id="equipo-titulo" className={type.heading}>El equipo</h2>
        {children}
      </div>
    </section>
  );
}

function Photo({ barber, className }: { barber: Barber; className: string }) {
  return (
    <div className={`overflow-hidden bg-surface-muted ${className}`}>
      {barber.photo_url ? (
        <img src={barber.photo_url} alt={barber.name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full items-center justify-center font-display text-4xl text-accent/50" aria-hidden="true">
          {barber.initials}
        </div>
      )}
    </div>
  );
}

function PortraitTeam() {
  const { data } = useLanding();
  return (
    <TeamShell>
      <ul className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-4">
        {data.barbers.map((barber) => (
          <li key={barber.id}>
            <Photo barber={barber} className="aspect-[3/4] rounded-theme" />
            <p className="mt-4 font-display text-xl">{barber.name}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-fg-muted">{barber.role}</p>
          </li>
        ))}
      </ul>
    </TeamShell>
  );
}

function CircleTeam() {
  const { data } = useLanding();
  return (
    <TeamShell>
      <ul className="mt-12 flex flex-wrap justify-center gap-10">
        {data.barbers.map((barber) => (
          <li key={barber.id} className="flex w-36 flex-col items-center text-center">
            <Photo barber={barber} className="h-32 w-32 rounded-full ring-4 ring-accent/30" />
            <p className="mt-4 font-display text-lg">{barber.name}</p>
            <p className="text-xs text-fg-muted">{barber.role}</p>
          </li>
        ))}
      </ul>
    </TeamShell>
  );
}

function InlineTeam() {
  const { data, type } = useLanding();
  return (
    <TeamShell>
      <p className={`mt-4 ${type.body}`}>{data.barbers.map((barber) => barber.name).join(' · ')}</p>
    </TeamShell>
  );
}

export const TEAM: SectionMap<TeamStyle> = {
  portraits: PortraitTeam,
  circles: CircleTeam,
  inline: InlineTeam,
};
