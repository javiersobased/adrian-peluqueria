import React from 'react';

export interface BarberIconProps {
  className?: string;
  size?: number;
}

// 1. Corte de pelo / Tijeras profesionales con peine
export function ScissorsBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
      {/* Comb spine & teeth */}
      <path d="M19 8v6M17 9v4M15 9.5v3" strokeWidth="1.5" strokeOpacity="0.8" />
    </svg>
  );
}

// 2. Barba / Arreglo de barba
export function BeardBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      {/* Mustache */}
      <path d="M4 10.5c2-1 4.5-.5 6 1 1-1.5 3.5-2 5.5-1 2.5 1.2 3.5 3 2.5 4.5-2 1-5 0-6-2-1 2-4 3-6 2-1-1.5 0-3.3 2-4.5z" />
      {/* Beard contour */}
      <path d="M6 13c.5 4.5 3 7.5 6 7.5s5.5-3 6-7.5" />
      {/* Soul patch */}
      <path d="M12 14.5v2" strokeWidth="2" />
    </svg>
  );
}

// 3. Corte + Barba / Combo estrella
export function ComboBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      {/* Shears top */}
      <circle cx="5" cy="5" r="2.2" />
      <path d="M7 6.5L16 15.5" />
      <circle cx="19" cy="5" r="2.2" />
      <path d="M17 6.5L8 15.5" />
      {/* Beard curve bottom */}
      <path d="M7 16c1 3.5 3 5.5 5 5.5s4-2 5-5.5" />
      <path d="M10 14c1-.5 3-.5 4 0" strokeWidth="1.5" />
    </svg>
  );
}

// 4. Color / Tinte & Decoloración
export function ColorBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      {/* Dye bowl */}
      <path d="M4 14c0 4.4 3.6 7 8 7s8-2.6 8-7H4z" />
      {/* Brush handle & bristles */}
      <path d="M15 3l4 4-7 7-3-1 6-10z" />
      {/* Droplet */}
      <path d="M7 6a2 2 0 0 1 2 2c0 1.1-.9 2-2 3-1.1-1-2-1.9-2-3a2 2 0 0 1 2-2z" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

// 5. Lavado & Polvos de volumen / Tratamiento
export function WashBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      {/* Shower head / sprayer */}
      <path d="M4 4h4l3 3H7z" />
      <path d="M8 8l-4 4" />
      {/* Water spray / bubbles */}
      <circle cx="13" cy="10" r="1.5" fill="currentColor" fillOpacity="0.3" />
      <circle cx="18" cy="8" r="1.5" fill="currentColor" fillOpacity="0.3" />
      <circle cx="15" cy="14" r="2" fill="currentColor" fillOpacity="0.3" />
      <circle cx="10" cy="16" r="1.5" fill="currentColor" fillOpacity="0.3" />
      <path d="M12 18c2 2 5 2 7 0" strokeWidth="1.5" />
    </svg>
  );
}

// 6. Máquina de pelar / Clipper
export function ClipperBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      {/* Blade teeth */}
      <path d="M7 3h10M7 5h10M8 3v2M10 3v2M12 3v2M14 3v2M16 3v2" />
      {/* Body */}
      <path d="M8 5l-1 9a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3l-1-9H8z" />
      {/* Power switch / grip */}
      <rect x="10.5" y="9" width="3" height="4" rx="1" strokeWidth="1.5" />
      {/* Cord loop */}
      <path d="M12 17v4a1.5 1.5 0 0 1-3 0" strokeWidth="1.5" />
    </svg>
  );
}

// 7. Degradado / Fade
export function FadeBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      {/* Head silhouette profile */}
      <path d="M6 19c0-5 3-9 8-9h2a4 4 0 0 1 4 4v5" />
      {/* Layered fade lines (gradient) */}
      <line x1="8" y1="13" x2="16" y2="13" strokeWidth="2.5" />
      <line x1="9" y1="15" x2="16" y2="15" strokeWidth="2" strokeOpacity="0.75" />
      <line x1="10" y1="17" x2="16" y2="17" strokeWidth="1.5" strokeOpacity="0.5" />
      <line x1="11" y1="19" x2="16" y2="19" strokeWidth="1" strokeOpacity="0.3" />
      {/* Sparkle touch */}
      <path d="M18 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}

// 8. Peinado / Perfilado / Patillas & Cuello
export function ContoursBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      {/* Straight razor */}
      <path d="M4 14l9-9 3 3-9 9H4v-3z" />
      <path d="M13 5l2-2 4 4-2 2" />
      <line x1="4" y1="20" x2="20" y2="20" strokeWidth="1.5" strokeDasharray="3 3" />
      {/* Blade gleam */}
      <path d="M6 16l3-3" strokeWidth="1.5" />
    </svg>
  );
}

// 9. Corte Niños
export function KidsBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      {/* Child face */}
      <circle cx="12" cy="13" r="8" />
      {/* Quirky hair tuft */}
      <path d="M10 5c1-2 3-2 4 0" strokeWidth="2" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      {/* Smile */}
      <path d="M9.5 16a4 4 0 0 0 5 0" />
      {/* Scissor small star */}
      <path d="M19 4l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z" fill="currentColor" fillOpacity="0.6" />
    </svg>
  );
}

// 10. Cejas / Cuchilla de precisión
export function EyebrowBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      {/* Eyebrow arch */}
      <path d="M4 9c3-3 8-3.5 13-1 2 .8 3 2.5 3 2.5s-2-.5-4-1c-5-1-9-.5-12 1.5" fill="currentColor" fillOpacity="0.2" />
      {/* Micro razor blade */}
      <path d="M7 14l8-8 3 1-8 8H7v-1z" />
      <line x1="8" y1="18" x2="16" y2="18" strokeWidth="1.5" />
    </svg>
  );
}

// 11. Depilación Nasal / Cera
export function NoseWaxBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      {/* Nose contour */}
      <path d="M11 3c0 6-4 8-4 12a5 5 0 0 0 10 0c0-2-1-3.5-2-4.5" />
      {/* Precision applicator stick */}
      <line x1="12" y1="13" x2="16" y2="21" strokeWidth="2" />
      {/* Wax drop */}
      <circle cx="12" cy="13" r="2" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}

// 12. VIP / Premium / Especial
export function SparklesBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      <path d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5z" fill="currentColor" fillOpacity="0.15" />
      <path d="M18 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
      <path d="M6 4l.8 1.7L8.5 6.5 6.8 7.3 6 9l-.8-1.7L3.5 6.5l1.7-.8z" />
    </svg>
  );
}

// Map of canonical service icon IDs to component
export const BARBER_ICON_COMPONENTS: Record<string, React.ComponentType<BarberIconProps>> = {
  scissors: ScissorsBarberIcon,
  'scissors-crossed': ComboBarberIcon,
  beard: BeardBarberIcon,
  color: ColorBarberIcon,
  wash: WashBarberIcon,
  clipper: ClipperBarberIcon,
  fade: FadeBarberIcon,
  contours: ContoursBarberIcon,
  'kids-cut': KidsBarberIcon,
  'eyebrow-razor': EyebrowBarberIcon,
  'nose-wax': NoseWaxBarberIcon,
  sparkles: SparklesBarberIcon,
};

export interface ServiceIconOption {
  id: string;
  label: string;
  category: 'corte' | 'barba' | 'tratamiento';
  description: string;
}

export const BARBER_SERVICE_ICON_CATALOG: ServiceIconOption[] = [
  { id: 'scissors', label: 'Corte Clásico', category: 'corte', description: 'Tijera y peine profesional' },
  { id: 'fade', label: 'Degradado / Fade', category: 'corte', description: 'Skin fade, taper y transición' },
  { id: 'clipper', label: 'Máquina / Rapado', category: 'corte', description: 'Corte a máquina y rasurado' },
  { id: 'kids-cut', label: 'Corte Niños', category: 'corte', description: 'Estilo especial para los más pequeños' },
  { id: 'beard', label: 'Arreglo de Barba', category: 'barba', description: 'Perfilado y recorte de barba' },
  { id: 'scissors-crossed', label: 'Corte + Barba', category: 'barba', description: 'Combo estrella completo' },
  { id: 'contours', label: 'Peinado & Perfilado', category: 'barba', description: 'Cuello, patillas y estilo' },
  { id: 'eyebrow-razor', label: 'Cejas a Navaja', category: 'barba', description: 'Perfilado y diseño de cejas' },
  { id: 'color', label: 'Tinte & Color', category: 'tratamiento', description: 'Decoloración, mechas o tinte' },
  { id: 'wash', label: 'Lavado & Polvos', category: 'tratamiento', description: 'Lavado, peinado y volumen' },
  { id: 'nose-wax', label: 'Depilación Cera', category: 'tratamiento', description: 'Cera nasal y facial higiénica' },
  { id: 'sparkles', label: 'Servicio VIP', category: 'tratamiento', description: 'Tratamiento completo premium' },
];

/**
 * Universal component to render service icons with luxury golden gradient framing.
 */
export function BarberServiceIcon({
  name,
  className = 'h-5 w-5',
  size,
}: {
  name?: string | null;
  className?: string;
  size?: number;
}) {
  const cleanId = (name || 'scissors').toLowerCase().trim();
  const IconComponent = BARBER_ICON_COMPONENTS[cleanId] || BARBER_ICON_COMPONENTS.scissors;

  return <IconComponent className={className} size={size} />;
}
