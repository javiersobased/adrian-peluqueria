import { CalendarIcon, MapPinIcon, ClockIcon, ChevronRightIcon, Star } from '@/components/icons';
import { OPENING_HOURS, SALON_MAPS_URL, SALON_ADDRESS } from '@/data/services';
import { useState, useEffect } from 'react';
import ScrollFloat from '@/components/reactbits/ScrollFloat';
import ScrollReveal from '@/components/reactbits/ScrollReveal';
import GlassSurface from '@/components/reactbits/GlassSurface';
import Dock from '@/components/reactbits/Dock';
import CountUp from '@/components/reactbits/CountUp';
import { Home, Clock, MapPin, Calendar, X, Lock, User } from 'lucide-react';
import { login, type AdminRole } from '@/lib/auth';

interface LandingProps {
  onBook: () => void;
  onAdmin: (role: AdminRole) => void;
}

const REVIEWS = [
  { name: 'Carlos M.', rating: 5, text: 'Excelente servicio, el mejor corte que me han hecho en Huelva. Adrián es un verdadero profesional.', date: 'Hace 2 semanas' },
  { name: 'Javier R.', rating: 5, text: 'Ambiente genial y resultado impecable. Siempre salgo satisfecho, sin duda mi peluquería de confianza.', date: 'Hace 1 mes' },
  { name: 'Manuel P.', rating: 4, text: 'Muy buena atención y precio razonable. El local está cuidado y se nota que les importa el detalle.', date: 'Hace 1 mes' },
  { name: 'Antonio L.', rating: 5, text: 'Llevo años yendo y nunca me decepciona. Trato cercano y profesionalidad en cada visita.', date: 'Hace 2 meses' },
  { name: 'Francisco J.', rating: 5, text: 'La barba me la dejaron perfecta. Recomendado 100%, no hay mejor sitio en la zona.', date: 'Hace 3 meses' },
];

const REVIEW_URL = 'https://search.google.com/local/writereview?placeid=ChIJZQ8TpTLPEQ0RDdVh6plIAsU';

export function Landing({ onBook, onAdmin }: LandingProps) {
  const [showLogin, setShowLogin] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [reviewIndex, setReviewIndex] = useState(0);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const dockItems = [
    { icon: <Home size={18} />, label: 'Inicio', onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    { icon: <Clock size={18} />, label: 'Horarios', onClick: () => scrollToSection('horarios') },
    { icon: <MapPin size={18} />, label: 'Ubicación', onClick: () => scrollToSection('ubicacion') },
    { icon: <Calendar size={18} />, label: 'Reservar', onClick: onBook },
  ];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const result = login(loginUser.trim(), loginPass.trim());
    if (result.isBarber && result.role) {
      setShowLogin(false);
      onAdmin(result.role);
    } else {
      setLoginError('Usuario o contraseña incorrectos.');
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setReviewIndex((prev) => (prev + 1) % REVIEWS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen animate-fade-in">
      {/* Admin button top-right */}
      <button
        onClick={() => setShowLogin(true)}
        aria-label="Acceso administración"
        className="fixed right-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full glass-card text-zinc-400 transition-all hover:border-gold/30 hover:text-gold active:scale-90"
      >
        <Lock className="h-4 w-4" />
      </button>

      {/* Login modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowLogin(false)} />
          <div className="relative w-full max-w-sm rounded-3xl glass-panel p-6 animate-scale-in">
            <button onClick={() => setShowLogin(false)} className="absolute right-4 top-4 text-zinc-500 hover:text-white">
              <X className="h-5 w-5" />
            </button>
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl gold-gradient">
                <Lock className="h-6 w-6 text-black" />
              </div>
              <h3 className="font-display text-xl font-bold text-white">Acceso al panel</h3>
              <p className="mt-1 text-xs text-zinc-500">Introduce tus credenciales</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl glass-card px-4 py-3 focus-within:border-gold/30">
                <User className="h-4 w-4 text-zinc-500" />
                <input
                  type="text" value={loginUser} onChange={(e) => setLoginUser(e.target.value)}
                  placeholder="Usuario" autoComplete="username"
                  className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-3 rounded-xl glass-card px-4 py-3 focus-within:border-gold/30">
                <Lock className="h-4 w-4 text-zinc-500" />
                <input
                  type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="Contraseña" autoComplete="current-password"
                  className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                />
              </div>
              {loginError && <p className="text-xs text-red-400">{loginError}</p>}
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-full gold-gradient py-3.5 text-sm font-bold uppercase tracking-wider text-black transition-all hover:brightness-110 active:scale-[0.98] gold-glow"
              >
                Entrar
              </button>
            </form>
          </div>
        </div>
      )}

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
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-gold">Huelva</p>
          <ScrollFloat
            animationDuration={1.2}
            ease="back.inOut(2)"
            stagger={0.04}
            containerClassName="font-display text-4xl sm:text-5xl font-bold leading-[1.05] text-white"
            textClassName="inline-block"
          >
            Peluquería Adrián Millán
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

      {/* About */}
      <section id="inicio" className="relative px-6 py-20">
        <div className="mx-auto max-w-md">
          <div className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.3em] text-gold">Nuestro Local</div>
          <ScrollReveal
            baseOpacity={0}
            enableBlur={true}
            baseRotation={4}
            blurStrength={8}
            containerClassName="font-display text-3xl font-bold leading-snug text-white mb-6"
            textClassName="inline-block"
          >
            Tradición y estilo en nuestro barrio
          </ScrollReveal>
          <div className="overflow-hidden rounded-3xl glass-card">
            <img
              src="/images/google_maps_2048_1788027105155.jpg"
              alt="Interior luminoso del local de Peluquería Adrián Millán"
              className="h-48 w-full object-cover"
            />
          </div>
          <ScrollReveal
            baseOpacity={0.05}
            enableBlur={true}
            baseRotation={2}
            blurStrength={6}
            containerClassName="mt-5 text-[0.95rem] leading-relaxed text-zinc-400"
            textClassName="inline-block"
          >
            En Peluquería Adrián Millán combinamos la técnica clásica del oficio con las tendencias más actuales. Un espacio cercano y cuidado al detalle, pensado para que disfrutes de un momento de descanso mientras te ponemos a punto. Especialistas en corte, barba y color para hombres y niños.
          </ScrollReveal>
        </div>
      </section>

      {/* Hours */}
      <section id="horarios" className="px-6 pb-20">
        <div className="mx-auto max-w-md">
          <div className="glass-panel rounded-3xl p-6">
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
      </section>

      {/* Location */}
      <section id="ubicacion" className="px-6 pb-24">
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
                  <GlassSurface borderRadius={20} className="w-full">
                    <div className="w-full p-5 text-left">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full gold-gradient font-display text-xs font-bold text-black">
                          {r.name.charAt(0)}
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
                  </GlassSurface>
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
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-2 md:hidden">
        <Dock items={dockItems} panelHeight={56} baseItemSize={42} magnification={60} distance={150} />
      </div>

      <Footer />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 py-10 pb-24 md:pb-10">
      <div className="mx-auto max-w-md text-center">
        <p className="font-display text-xl font-bold text-white">Peluquería Adrián Millán</p>
        <p className="mt-1 text-xs text-zinc-500">Barbería y peluquería · Huelva</p>
        <p className="mt-6 text-[0.7rem] text-zinc-600">© {new Date().getFullYear()} Peluquería Adrián Millán. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
