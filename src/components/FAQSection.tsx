import { useState } from 'react';
import { ChevronDown, HelpCircle, Sparkles, Calendar, MapPin, Scissors, Clock } from 'lucide-react';
import { SALON_ADDRESS, WHATSAPP_URL } from '@/data/services';

interface FAQItem {
  question: string;
  answer: string;
  icon: React.ElementType;
}

const FAQS: FAQItem[] = [
  {
    question: '¿Dónde está ubicada la peluquería y barbería de Adrián Millán en Huelva?',
    answer: `Nos encontramos en ${SALON_ADDRESS} (entre las barriadas de Santa Marta y La Orden). El salón está situado en una zona de muy fácil acceso y cómodo aparcamiento en Huelva capital. Si vienes en coche o a pie, puedes encontrarnos fácilmente en Google Maps con indicaciones directas.`,
    icon: MapPin,
  },
  {
    question: '¿Cómo reservar cita previa online y es necesario pagar por adelantado?',
    answer: 'La reserva online se realiza de forma inmediata y 100% gratuita a través de esta misma web (adrianmillan.es), sin necesidad de instalar aplicaciones de terceros ni pagar por adelantado. Solo debes seleccionar tu barbero preferido, el servicio, la fecha y hora que mejor te convenga, e iniciar sesión con tu cuenta de Google para confirmar tu hueco en tiempo real.',
    icon: Calendar,
  },
  {
    question: '¿Cuáles son los precios y servicios de barbería que ofrecéis?',
    answer: 'Ofrecemos una carta de servicios profesional y transparente adaptada a cada cliente: Corte de Cabello (11 € · 20 min), Arreglo de Barba (6 € · 10 min), Corte de Cabello + Arreglo de Barba (16 € · 30 min), Corte de Cabello + Decoloración (65 € · 40 min), Corte de Cabello + Lavado (13 € · 30 min), Tinte Barba (10 € · 20 min) y Arreglo de Cuello y Patillas (6 € · 10 min). Todos nuestros servicios se realizan con productos de primera calidad y sin costes ocultos.',
    icon: Scissors,
  },
  {
    question: '¿Qué tipo de cortes de pelo y degradados (fades) realizáis?',
    answer: 'Somos especialistas en cortes modernos y clásicos masculinos: degradados al cero (skin fade, low fade, mid fade, high fade, taper fade), cortes a tijera clásicos, mullet moderno, textured crop, buzz cut y peinados con productos de alta fijación mate y brillo de nuestra tienda.',
    icon: Sparkles,
  },
  {
    question: '¿Cuál es el horario de apertura de la barbería?',
    answer: 'Abrimos de Lunes a Viernes en horario de mañana y tarde: de 09:30 a 13:30 h y de 16:30 a 20:30 h. Los Sábados abrimos por la mañana de 09:30 a 13:30 h. Los Domingos y festivos permanecemos cerrados por descanso del personal.',
    icon: Clock,
  },
  {
    question: '¿Puedo reservar dos citas consecutivas para mí y mi hijo o amigo?',
    answer: '¡Por supuesto! Nuestro sistema de reservas permite reservar dos citas el mismo día (por ejemplo, a las 10:00 y a las 10:30 con el mismo peluquero) para que podáis venir juntos. También podéis reservar a la misma hora exacta si elegís barberos diferentes (como Adrián y David Luna).',
    icon: HelpCircle,
  },
];

interface FAQSectionProps {
  onBook?: () => void;
}

export function FAQSection({ onBook }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <section id="faq" className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
      {/* Glow background accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gold/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 text-center space-y-3 mb-12">
        <div className="inline-flex items-center gap-2 rounded-full glass-card px-3.5 py-1.5 text-xs font-semibold text-gold uppercase tracking-wider">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Preguntas Frecuentes</span>
        </div>
        <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white">
          Resolvemos tus dudas sobre <span className="gold-gradient-text">nuestra barbería</span>
        </h2>
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto">
          Todo lo que necesitas saber sobre cómo reservar cita previa online, nuestros horarios, precios de corte y ubicación en Huelva.
        </p>
      </div>

      <div className="relative z-10 space-y-3">
        {FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx;
          const Icon = faq.icon;
          return (
            <div
              key={faq.question}
              className={`rounded-2xl transition-all duration-300 overflow-hidden border ${
                isOpen
                  ? 'glass-card border-gold/30 bg-zinc-900/90 shadow-lg shadow-gold/5'
                  : 'glass-card border-white/5 bg-zinc-950/40 hover:border-white/10 hover:bg-zinc-900/50'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleItem(idx)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 p-4 sm:p-5 text-left focus:outline-none"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isOpen ? 'gold-gradient text-black font-bold shadow-md shadow-gold/20' : 'bg-white/5 text-gold'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm sm:text-base font-semibold text-white">
                    {faq.question}
                  </span>
                </div>
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 border border-white/10 transition-transform duration-300 ${
                    isOpen ? 'rotate-180 bg-gold/15 text-gold border-gold/30' : 'text-zinc-500'
                  }`}
                >
                  <ChevronDown className="h-4 w-4" />
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-zinc-300 leading-relaxed border-t border-white/5 mt-1">
                  <p className="pt-2">{faq.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Booking CTA */}
      <div className="relative z-10 mt-12 text-center p-6 sm:p-8 rounded-3xl glass-card border border-gold/20 bg-gradient-to-b from-zinc-900/80 to-black/80 shadow-xl shadow-gold/5">
        <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
          ¿Listo para renovar tu estilo con nosotros?
        </h3>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto mb-5">
          Reserva tu cita online en menos de 1 minuto sin esperas y con confirmación inmediata en tu móvil.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {onBook && (
            <button
              onClick={onBook}
              className="inline-flex items-center gap-2 rounded-xl gold-gradient px-6 py-3 text-xs sm:text-sm font-bold text-black shadow-lg shadow-gold/20 transition-all hover:brightness-110 active:scale-95"
            >
              <Calendar className="h-4 w-4" />
              <span>Reservar Cita Ahora</span>
            </button>
          )}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl glass-card border border-white/10 px-5 py-3 text-xs sm:text-sm font-semibold text-zinc-300 hover:text-gold hover:border-gold/30 transition-all"
          >
            <span>Preguntar por WhatsApp</span>
          </a>
        </div>
      </div>
    </section>
  );
}
