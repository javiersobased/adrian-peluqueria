import { CalendarIcon, MapPinIcon, ClockIcon, ChevronRightIcon } from '@/components/icons';
import { Star, LogIn, LayoutDashboard, Scissors, ChevronDown, CalendarDays, ShoppingBag, Camera, Download } from 'lucide-react';
import { OPENING_HOURS, SALON_MAPS_URL, SALON_ADDRESS } from '@/data/services';
import { useState, useEffect } from 'react';
import ScrollFloat from '@/components/reactbits/ScrollFloat';
import ScrollReveal from '@/components/reactbits/ScrollReveal';
import Dock from '@/components/reactbits/Dock';
import CountUp from '@/components/reactbits/CountUp';
import { InstallAppButton } from '@/components/InstallAppButton';
import { InstallAppModal } from '@/components/InstallAppModal';
import { Home, Clock, Calendar, ShoppingBag as ShoppingBagIcon } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { UserRole, GalleryPhoto } from '@/types';
import { safeInitial } from '@/lib/calendar';
import { fetchGalleryPhotos } from '@/lib/gallery';
import { useLenis, useLockScroll } from '@/components/SmoothScroll';

interface LandingProps {
  onBook: () => void;
  onSignIn: () => void;
  onGoToPanel: () => void;
  user?: SupabaseUser | null;
  role?: UserRole | null;
  onSignOut?: () => void;
  onGoToMyBookings?: () => void;
  onGoToCatalog?: () => void;
  onGoToGallery?: () => void;
}

const REVIEWS = [
  { name: 'Jose Manuel Quintero Ortiz', rating: 5, text: 'Amabilidad, profesionalidad y económico... con la gentileza de invitarte a café o té con dulces si vas en horario de 17:00 / 20:00.', date: 'Hace 3 meses' },
  { name: 'Oscar Paredes', rating: 5, text: 'Buen trato al cliente y sitio muy agradable y mucha limpieza, situado en sitio bien accesible.', date: 'Hace 5 meses' },
  { name: 'Antonio Vázquez', rating: 5, text: 'Estupendo en todo, tanto en el pelado como en el trato al cliente. Ya tiene un cliente fijo. Gracias!!!', date: 'Hace 5 meses' },
  { name: 'Dani', rating: 5, text: 'Llevo tiempo pelándome y haciéndome la barba y los que me quedan, buenos profesionales y mejor atención.', date: 'Hace 4 meses' },
  { name: 'Carluten', rating: 5, text: 'Gran peluquero, servicio espléndido y una decoración moderna con precios superbuenos.', date: 'Hace 5 meses' },
  { name: 'Francisco Javier González Humanes', rating: 5, text: 'El trato ha sido inmejorable!', date: 'Hace 6 meses' },
  { name: 'Maria Cano Padilla', rating: 5, text: 'Buen trato, rapidez y buen precio.', date: 'Hace 6 meses' },
];

const REVIEW_URL = 'https://search.google.com/local/writereview?placeid=ChIJZQ8TpTLPEQ0RDdVh6plIAsU';

export function Landing({ onBook, onSignIn, onGoToPanel, user, role, onSignOut, onGoToMyBookings, onGoToCatalog, onGoToGallery }: LandingProps) {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [galleryPreview, setGalleryPreview] = useState<GalleryPhoto[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);

  const lenis = useLenis();
  useLockScroll(showInstallModal);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenis) {
      lenis.scrollTo(el, { offset: -24, duration: 1.2 });
    } else {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const dockItems = [
    {
      icon: <Home size={18} />,
      label: 'Inicio',
      onClick: () => {
        if (lenis) {
          lenis.scrollTo(0, { duration: 1.2 });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },
    },
    { icon: <Camera size={18} />, label: 'Cortes', onClick: () => onGoToGallery?.() },
    { icon: <Download size={18} />, label: 'Instalar app', onClick: () => setShowInstallModal(true) },
    { icon: <ShoppingBagIcon size={18} />, label: 'Productos', onClick: () => onGoToCatalog?.() },
    { icon: <Calendar size={16} />, label: 'Reservar', onClick: onBook, highlight: true },
  ];

  useEffect(() => {
    fetchGalleryPhotos().then((res) => setGalleryPreview(res.slice(0, 4)));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setReviewIndex((prev) => (prev + 1) % REVIEWS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const isVerifiedStaff = role?.role && role?.status === 'verified';
  const panelLabel = role?.role === 'admin' ? 'Panel de Administración' : 'Panel de Barbero';

  return (
    <div className="min-h-screen animate-fade-in">
      {/* Top-right: unified login / panel access */}
      <div className="fixed right-4 top-4 z-40 flex items-center gap-2">
        {isVerifiedStaff && (
          <button
            onClick={onGoToPanel}
            className="flex items-center gap-2 rounded-full gold-gradient px-4 py-2 text-xs font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-95 gold-glow"
          >
            {role?.role === 'barber' ? <Scissors className="h-3.5 w-3.5" /> : <LayoutDashboard className="h-3.5 w-3.5" />}
            {panelLabel}
          </button>
        )}

        {user ? (
          <div className="relative flex items-center gap-2">
            <InstallAppButton appName="Reservas Adrián Millán" compact />
            <button
              onClick={() => setShowAccountMenu((v) => !v)}
              className="flex items-center gap-2 rounded-full bg-zinc-900/70 backdrop-blur-xl border border-white/10 py-1.5 pl-1.5 pr-3 text-xs font-medium text-zinc-300 transition-all hover:border-gold/30"
            >
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt={user.user_metadata?.full_name || 'Perfil de usuario'} className="h-6 w-6 rounded-full" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full gold-gradient text-[0.6rem] font-bold text-black">
                  {safeInitial(user.user_metadata?.full_name || user.email)}
                </div>
              )}
              <span className="max-w-[8rem] truncate">{user.user_metadata?.full_name || user.email}</span>
              <ChevronDown className="h-3 w-3 text-zinc-500" />
            </button>

            {showAccountMenu && (
              <div className="absolute right-0 top-12 w-44 rounded-2xl border border-white/10 bg-zinc-900/90 p-1.5 shadow-2xl backdrop-blur-xl animate-scale-in">
                {isVerifiedStaff && (
                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      onGoToPanel();
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-gold transition-colors hover:bg-gold/10"
                  >
                    {panelLabel}
                  </button>
                )}
                {onGoToMyBookings && (
                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      onGoToMyBookings();
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Mis citas</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowAccountMenu(false);
                    onSignOut?.();
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <InstallAppButton appName="Reservas Adrián Millán" compact />
            <button
              onClick={onSignIn}
              className="flex items-center gap-2 rounded-full bg-zinc-900/70 backdrop-blur-xl border border-white/10 px-4 py-2 text-xs font-medium text-zinc-300 transition-all hover:border-gold/30 hover:text-gold active:scale-95"
            >
              <LogIn className="h-3.5 w-3.5" />
              Iniciar sesión
            </button>
          </div>
        )}
      </div>

      {/* Hero */}
      <header className="relative flex min-h-[92vh] flex-col items-center justify-center px-6 text-center">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <img
            src="https://images.pexels.com/photos/7195803/pexels-photo-7195803.jpeg?auto=compress&cs=tinysrgb&w=1260&h=1680"
            alt="Interior de Peluquería y Barbería Adrián Millán en Huelva"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/75 to-black/95" />
          <div className="absolute inset-0 backdrop-blur-md" />
        </div>

        <h1 className="sr-only">Peluquería y Barbería Adrián Millán en Huelva · Cita Previa Online</h1>
        <div className="animate-fade-up w-full max-w-4xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-gold">Huelva</p>
          <ScrollFloat
            as="h2"
            animationDuration={1.1}
            ease="back.inOut(2)"
            stagger={0.035}
            containerClassName="font-display text-3xl sm:text-5xl md:text-7xl font-bold leading-tight text-white whitespace-normal break-words max-w-full tracking-tight"
            textClassName="inline-block"
          >
            Adrián Millán
          </ScrollFloat>
          <div className="mx-auto mt-4 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-gold/60" />
            <span className="text-[0.65rem] uppercase tracking-[0.3em] text-zinc-300">Barbería y peluquería</span>
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

        <div className="mt-6 flex items-center gap-2 text-xs text-zinc-400 animate-fade-up" style={{ animationDelay: '0.25s' }}>
          <ClockIcon className="h-3.5 w-3.5" />
          <span>Reserva online en menos de un minuto</span>
        </div>
      </header>

      {/* Products CTA */}
      {onGoToCatalog && (
        <section className="px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <div className="relative overflow-hidden rounded-3xl border border-gold/20 bg-zinc-900/70 backdrop-blur-xl shadow-2xl">
              <div className="absolute inset-0 -z-10 opacity-20">
                <img
                  src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80"
                  alt="Productos de barbería y cuidado profesional"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="relative flex flex-col items-center gap-5 p-8 text-center md:flex-row md:text-left">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl gold-gradient">
                  <ShoppingBag className="h-8 w-8 text-black" />
                </div>
                <div className="flex-1">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.3em] text-gold">Novedad</p>
                  <h3 className="font-display text-xl font-bold text-white sm:text-2xl">Descubre nuestros productos</h3>
                  <p className="mt-1.5 text-sm text-zinc-400">Teléfonos reacondicionados, perfumes, reparaciones y mucho más.</p>
                </div>
                <button
                  onClick={onGoToCatalog}
                  className="group flex shrink-0 items-center gap-2.5 rounded-full gold-gradient px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-black transition-all duration-300 hover:brightness-110 active:scale-95 gold-glow"
                >
                  Ver productos
                  <ChevronRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Haircuts Gallery Section */}
      <section id="cortes" className="px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Nuestros Cortes</p>
              <h3 className="font-display text-2xl font-bold text-white sm:text-3xl">Estilos & Degradados</h3>
              <p className="mt-1 text-xs text-zinc-400">Trabajos reales realizados en nuestro salón en Huelva.</p>
            </div>
            {onGoToGallery && (
              <button
                onClick={onGoToGallery}
                className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-black/40 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-gold backdrop-blur-md transition-all hover:bg-gold/10 hover:border-gold active:scale-95 shadow-lg"
              >
                <Camera className="h-4 w-4" />
                Ver galería completa
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Organic preview grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {galleryPreview.slice(0, 4).map((p, idx) => (
              <div
                key={p.id}
                onClick={onGoToGallery}
                style={{ animationDelay: `${idx * 0.08}s` }}
                className="group relative aspect-[3/4] overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 cursor-pointer shadow-xl transition-all duration-300 hover:border-gold/40 hover:shadow-gold/10 hover:-translate-y-1 animate-fade-up"
              >
                <img
                  src={p.image_url}
                  alt={p.title || 'Corte de pelo y degradado en Adrián Millán Peluquería Huelva'}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity flex items-end p-3.5">
                  <p className="text-xs font-semibold text-white truncate drop-shadow">{p.title || 'Corte Adrián Millán'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About + Hours — grid on desktop */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 md:grid-cols-2">
            {/* About */}
            <div id="inicio">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-gold">Nuestro Local</div>
              <ScrollReveal
                baseOpacity={0.1}
                enableBlur={true}
                baseRotation={3}
                blurStrength={8}
                containerClassName="font-display text-xl sm:text-2xl font-bold leading-snug text-white mb-4"
                textClassName="inline-block"
              >
                Tradición y estilo en nuestro barrio
              </ScrollReveal>
              <div className="overflow-hidden rounded-3xl bg-zinc-900/70 backdrop-blur-xl border border-white/10 shadow-2xl">
                <img
                  src="/images/google_maps_2048_1788027105155.jpg"
                  alt="Interior luminoso del local de Peluquería Adrián Millán"
                  className="h-48 w-full object-cover"
                />
              </div>
              <ScrollReveal
                baseOpacity={0.1}
                enableBlur={true}
                baseRotation={2}
                blurStrength={8}
                containerClassName="mt-4 text-sm leading-relaxed text-zinc-400"
                textClassName="inline-block"
              >
                En Peluquería Adrián Millán combinamos la técnica clásica del oficio con las tendencias más actuales. Un espacio cercano y cuidado al detalle, pensado para que disfrutes de un momento de descanso mientras te ponemos a punto. Especialistas en corte, barba y color para hombres y niños.
              </ScrollReveal>
            </div>

            {/* Hours */}
            <div id="horarios">
              <div className="rounded-3xl bg-zinc-900/70 backdrop-blur-xl border border-white/10 shadow-2xl p-6">
                <div className="mb-5 flex items-center gap-2.5">
                  <ClockIcon className="h-5 w-5 text-gold" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">Horario de apertura</h3>
                </div>
                <ul className="space-y-3">
                  {OPENING_HOURS.map((row) => {
                    const closed = row.hours === 'Cerrado';
                    return (
                      <li key={row.day} className="flex items-center justify-between border-b border-white/5 pb-3 text-sm last:border-0 last:pb-0">
                        <span className="text-zinc-300">{row.day}</span>
                        <span className={closed ? 'text-zinc-600' : 'text-zinc-400'}>{row.hours}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Location */}
      <section id="ubicacion" className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <a
            href={SALON_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group block overflow-hidden rounded-3xl bg-zinc-900/70 backdrop-blur-xl border border-white/10 shadow-2xl transition-transform duration-300 active:scale-[0.98]"
          >
            <div className="relative h-40 md:h-56">
              <img
                src="/images/google_maps_2048_1788027110699.jpg"
                alt="Exterior y entrada de Peluquería y Barbería Adrián Millán en Huelva"
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
        </div>
      </section>

      {/* Reviews */}
      <section className="px-6 pb-12">
        <div className="mx-auto max-w-md">
          <div className="mb-5 text-center">
            <div className="mb-2 flex items-center justify-center gap-1.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`h-4 w-4 ${i < 4 ? 'text-gold' : 'text-gold/50'}`} />
              ))}
              <span className="ml-1.5 font-display text-2xl font-bold text-white">
                <CountUp to={4.7} from={0} duration={2} separator="." />
              </span>
              <span className="text-sm text-zinc-500">estrellas</span>
            </div>
            <a
              href={REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full gold-gradient px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-95 gold-glow"
            >
              <Star className="h-3.5 w-3.5" />
              Déjanos tu reseña
            </a>
          </div>

          <div className="relative overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${reviewIndex * 100}%)` }}
            >
              {REVIEWS.map((r, i) => (
                <div key={i} className="w-full shrink-0 px-1">
                  <div className="w-full rounded-3xl bg-zinc-900/70 backdrop-blur-xl border border-white/10 shadow-2xl p-5 text-left">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full gold-gradient font-display text-xs font-bold text-black">
                        {safeInitial(r.name)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{r.name}</p>
                        <p className="text-[0.6rem] text-zinc-500">{r.date}</p>
                      </div>
                      <div className="ml-auto flex gap-0.5">
                        {[...Array(5)].map((_, j) => (
                          <Star key={j} className={`h-3 w-3 ${j < r.rating ? 'text-gold' : 'text-zinc-700'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-400">"{r.text}"</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Dots */}
            <div className="mt-4 flex justify-center gap-1.5">
              {REVIEWS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setReviewIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${i === reviewIndex ? 'w-6 bg-gold' : 'w-1.5 bg-white/20'}`}
                  aria-label={`Reseña ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Dock */}
      <div className="fixed bottom-8 left-0 right-0 z-40 flex justify-center">
        <Dock items={dockItems} panelHeight={56} baseItemSize={42} magnification={60} distance={150} />
      </div>

      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        appName="Reservas Adrián Millán"
      />

      <Footer />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 py-10 pb-28 md:pb-28">
      <div className="mx-auto max-w-md text-center">
        <p className="font-display text-xl font-bold text-white">Peluquería Adrián Millán</p>
        <p className="mt-1 text-xs text-zinc-500">Barbería y peluquería · Huelva</p>
        <p className="mt-6 text-[0.7rem] text-zinc-600">© {new Date().getFullYear()} Peluquería Adrián Millán. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
