import { CalendarIcon, MapPinIcon, ClockIcon, ChevronRightIcon } from '@/components/icons';
import { OPENING_HOURS, SALON_MAPS_URL, SALON_ADDRESS } from '@/data/services';

interface LandingProps {
  onBook: () => void;
  onAdmin: () => void;
}

export function Landing({ onBook, onAdmin }: LandingProps) {
  return (
    <div className="min-h-screen animate-fade-in">
      {/* Hero */}
      <header className="relative flex min-h-[92vh] flex-col items-center justify-center px-6 text-center">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <img
            src="https://images.pexels.com/photos/7195803/pexels-photo-7195803.jpeg?auto=compress&cs=tinysrgb&w=1260&h=1680"
            alt="Interior de la peluquería"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/75 to-black/95" />
          <div className="absolute inset-0 backdrop-blur-md" />
        </div>

        <div className="animate-fade-up">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-gold">
            Huelva
          </p>
          <h1 className="font-display text-5xl font-bold leading-[1.05] text-white sm:text-6xl">
            Peluquería Adrián Millán
          </h1>
          <div className="mx-auto mt-4 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-gold/60" />
            <span className="text-[0.65rem] uppercase tracking-[0.3em] text-zinc-300">
              Barbería y peluquería
            </span>
            <span className="h-px w-10 bg-gold/60" />
          </div>
        </div>

        <button
          onClick={onBook}
          className="group mt-10 inline-flex items-center gap-2.5 rounded-full gold-gradient px-8 py-4 text-sm font-bold uppercase tracking-wider text-black shadow-2xl shadow-black/50 transition-all duration-300 hover:brightness-110 gold-glow active:scale-95 animate-fade-up"
          style={{ animationDelay: '0.15s' }}
        >
          <CalendarIcon className="h-5 w-5" />
          Reservar cita
          <ChevronRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </button>

        <div
          className="mt-6 flex items-center gap-2 text-xs text-zinc-400 animate-fade-up"
          style={{ animationDelay: '0.25s' }}
        >
          <ClockIcon className="h-3.5 w-3.5" />
          <span>Reserva online en menos de un minuto</span>
        </div>
      </header>

      {/* About */}
      <section className="relative px-6 py-20">
        <div className="mx-auto max-w-md">
          <div className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.3em] text-gold">
            Nuestro Local
          </div>
          <h2 className="font-display text-3xl font-bold leading-snug text-white">
            Tradición y estilo en nuestro barrio
          </h2>
          <div className="mt-6 overflow-hidden rounded-3xl glass-card">
            <img
              src="/images/google_maps_2048_1788027105155.jpg"
              alt="Interior luminoso del local de Peluquería Adrián Millán"
              className="h-48 w-full object-cover"
            />
          </div>
          <p className="mt-5 text-[0.95rem] leading-relaxed text-zinc-400">
            En Peluquería Adrián Millán combinamos la técnica clásica del oficio con
            las tendencias más actuales. Un espacio cercano y cuidado al detalle,
            pensado para que disfrutes de un momento de descanso mientras te ponemos
            a punto. Especialistas en corte, barba y color para hombres y niños.
          </p>
        </div>
      </section>

      {/* Hours */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-md">
          <div className="glass-panel rounded-3xl p-6">
            <div className="mb-5 flex items-center gap-2.5">
              <ClockIcon className="h-5 w-5 text-gold" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Horario de apertura
              </h3>
            </div>
            <ul className="space-y-3">
              {OPENING_HOURS.map((row) => {
                const closed = row.hours === 'Cerrado';
                return (
                  <li
                    key={row.day}
                    className="flex items-center justify-between border-b border-white/5 pb-3 text-sm last:border-0 last:pb-0"
                  >
                    <span className="text-zinc-300">{row.day}</span>
                    <span className={closed ? 'text-zinc-600' : 'text-zinc-400'}>
                      {row.hours}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="px-6 pb-24">
        <a
          href={SALON_MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group block overflow-hidden rounded-3xl glass-panel transition-transform duration-300 active:scale-[0.98]"
        >
          <div className="relative h-40">
            <img
              src="/images/google_maps_2048_1788027110699.jpg"
              alt="Exterior de la peluquería"
              className="h-full w-full object-cover opacity-50 transition-opacity duration-300 group-hover:opacity-65"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 text-gold">
                  <MapPinIcon className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Dónde estamos</span>
                </div>
                <p className="mt-1 text-sm font-medium text-white">{SALON_ADDRESS}</p>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-zinc-400 transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
        </a>
      </section>

      <Footer onAdmin={onAdmin} />
    </div>
  );
}

export function Footer({ onAdmin }: { onAdmin: () => void }) {
  return (
    <footer className="border-t border-white/5 px-6 py-10">
      <div className="mx-auto max-w-md text-center">
        <p className="font-display text-xl font-bold text-white">Peluquería Adrián Millán</p>
        <p className="mt-1 text-xs text-zinc-500">Barbería y peluquería · Huelva</p>
        <p className="mt-6 text-[0.7rem] text-zinc-600">
          © {new Date().getFullYear()} Peluquería Adrián Millán. Todos los derechos reservados.
        </p>
        <button
          onClick={onAdmin}
          className="mt-4 text-[0.65rem] text-zinc-700 transition-colors hover:text-zinc-400"
        >
          Acceso administración
        </button>
      </div>
    </footer>
  );
}
