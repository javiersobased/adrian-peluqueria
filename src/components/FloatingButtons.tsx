import { WhatsAppIcon, InstagramIcon } from '@/components/icons';
import { WHATSAPP_URL, INSTAGRAM_URL } from '@/data/services';
import { ThemeToggle } from '@/components/ThemeToggle';

export function FloatingButtons() {
  return (
    <div className="fixed bottom-5 right-4 z-50 flex flex-col items-center gap-3">
      {/* Discreet theme toggle directly above WhatsApp */}
      <ThemeToggle />

      {/* WhatsApp Floating Button */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar por WhatsApp"
        className="group flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] shadow-lg shadow-black/40 transition-transform duration-300 hover:scale-110 active:scale-95"
      >
        <WhatsAppIcon className="h-6 w-6 text-white" />
        <span className="pointer-events-none absolute right-14 whitespace-nowrap rounded-md bg-ink-soft/90 px-3 py-1.5 text-xs font-medium text-marble opacity-0 transition-opacity duration-200 group-hover:opacity-100 shadow-md">
          WhatsApp
        </span>
      </a>

      {/* Instagram Floating Button */}
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ver perfil de Instagram"
        className="group flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-lg shadow-black/40 transition-transform duration-300 hover:scale-110 active:scale-95"
      >
        <InstagramIcon className="h-6 w-6 text-white" />
        <span className="pointer-events-none absolute right-14 whitespace-nowrap rounded-md bg-ink-soft/90 px-3 py-1.5 text-xs font-medium text-marble opacity-0 transition-opacity duration-200 group-hover:opacity-100 shadow-md">
          Instagram
        </span>
      </a>
    </div>
  );
}
