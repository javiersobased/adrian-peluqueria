import React from 'react';

export interface BarberIconProps {
  className?: string;
  size?: number;
}

// ─── Shared SVG wrapper props ──────────────────────────────────────────────────
// In dark mode: filled solid icons (bold, high-contrast)
// In light mode: clean outline/stroke icons (Lucide-style thin lines)
// Controlled via CSS class `barber-icon-svg` in index.css

// 1. Corte de Cabello — Tijeras de estilista
export function ScissorsBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`barber-icon-svg ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      {/* Filled version (dark mode) */}
      <g className="icon-filled">
        <circle cx="6" cy="6" r="3.2" />
        <circle cx="6" cy="18" r="3.2" />
        <path d="M20 4L8.5 15.5M14.8 14.2L20 20M8.5 8.5L12.5 12.5" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      {/* Outline version (light mode) */}
      <g className="icon-outline">
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <line x1="20" y1="4" x2="8.12" y2="15.88" />
        <line x1="14.47" y1="14.48" x2="20" y2="20" />
        <line x1="8.12" y1="8.12" x2="12" y2="12" />
      </g>
    </svg>
  );
}

// 2. Arreglo de Barba — Bigote y barba perfilada
export function BeardBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`barber-icon-svg ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <g className="icon-filled">
        <path d="M4 11.5c2.5-1.5 5.5-.5 8 1.5 2.5-2 5.5-3 8-1.5 1.5 1 1 3-.5 3.5-3 1-6-.5-7.5-2.5-1.5 2-4.5 3.5-7.5 2.5-1.5-.5-2-2.5-.5-3.5z" />
        <path d="M5.5 15C6 18.5 8.8 21.5 12 21.5s6-3 6.5-6.5" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
      <g className="icon-outline">
        <path d="M4 11.5c2.5-1.5 5.5-.5 8 1.5 2.5-2 5.5-3 8-1.5 1.5 1 1 3-.5 3.5-3 1-6-.5-7.5-2.5-1.5 2-4.5 3.5-7.5 2.5-1.5-.5-2-2.5-.5-3.5z" />
        <path d="M5 14c.5 4 3.5 7.5 7 7.5s6.5-3.5 7-7.5" />
      </g>
    </svg>
  );
}

// 3. Corte + Arreglo de Barba — Combo tijera y barba
export function ComboBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`barber-icon-svg ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <g className="icon-filled">
        <circle cx="5" cy="6" r="2.7" />
        <circle cx="5" cy="14" r="2.7" />
        <path d="M17 4L7.5 13.5M12.5 11L17 16" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M12 18c.5 2.2 2 3.5 4.2 3.5S20 20.2 20.5 18" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M13.5 16.5c.8-.4 1.7 0 2.5.8.8-.8 1.7-1.2 2.5-.8" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </g>
      <g className="icon-outline">
        <circle cx="5" cy="6" r="2.5" />
        <line x1="17" y1="4" x2="7" y2="14" />
        <line x1="12" y1="11" x2="17" y2="16" />
        <circle cx="5" cy="14" r="2.5" />
        <path d="M12 17.5c.5 2.5 2 4 4.5 4s4-1.5 4.5-4" />
        <path d="M13.5 16c1-.5 2 0 3 1 1-1 2-1.5 3-1" />
      </g>
    </svg>
  );
}

// 4. Decoloración / Tinte Capilar — Brocha de tinte
export function ColorBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`barber-icon-svg ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <g className="icon-filled">
        <path d="M15 3l6 6-2 2-6-6 2-2z" />
        <path d="M19 5l-8 8" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M7 17l4-4-2-2-4 4c-.8.8-1 1.8-1 2.8V21h3.2c1 0 2-.2 2.8-1z" />
        <circle cx="19.5" cy="18.5" r="2" />
        <circle cx="16" cy="21" r="1.3" />
      </g>
      <g className="icon-outline">
        <path d="m15 3 6 6-2 2-6-6 2-2z" />
        <path d="m19 5-8 8" />
        <path d="m7 17 4-4-2-2-4 4c-.7.7-1 1.7-1 2.7V21h3.3c1 0 2-.3 2.7-1z" />
        <circle cx="19.5" cy="18.5" r="1.5" />
        <circle cx="16" cy="20.5" r="1" />
      </g>
    </svg>
  );
}

// 5. Lavado Capilar — Cabeza bajo el agua
export function WashBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`barber-icon-svg ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <g className="icon-filled">
        <path d="M4 10a8 8 0 0 1 16 0v2H4v-2z" />
        <rect x="3" y="12" width="18" height="2" rx="1" />
        <path d="M8 16v3M12 15v4M16 16v3M6 18v2M18 18v2" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
      <g className="icon-outline">
        <path d="M4 10a8 8 0 0 1 16 0v2H4v-2z" />
        <path d="M12 4V2" />
        <path d="M8 17v2" />
        <path d="M12 16v4" />
        <path d="M16 17v2" />
        <path d="M6 19v1" />
        <path d="M18 19v1" />
      </g>
    </svg>
  );
}

// 6. Tinte Barba — Pincel sobre bigote/barba
export function BeardColorBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`barber-icon-svg ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <g className="icon-filled">
        <path d="M4 11c2.5-1.5 5.5-.5 8 1.5 2.5-2 5.5-3 8-1.5" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M5 13.5c.5 4 3.5 7.5 7 7.5s6.5-3.5 7-7.5" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M15 3l5 5-7 7-2-2z" />
        <path d="M18 2l4 4" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
      <g className="icon-outline">
        <path d="M4 11c2.5-1.5 5.5-.5 8 1.5 2.5-2 5.5-3 8-1.5" />
        <path d="M5 13.5c.5 4 3.5 7.5 7 7.5s6.5-3.5 7-7.5" />
        <path d="m15 3 5 5-7 7-2-2z" />
        <path d="m18 2 4 4" />
      </g>
    </svg>
  );
}

// 7. Arreglo de Cuello y Patillas — Navaja clásica de barbero
export function RazorBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`barber-icon-svg ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <g className="icon-filled">
        <path d="M3 13l7-7 8 2-6 6z" />
        <path d="M10 6L7 3c-.6-.6-1.4-.6-2 0L3 5c-.6.6-.6 1.4 0 2l3 3" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M12 14l8 8a2 2 0 0 0 2.8-2.8l-8-8" />
        <circle cx="12" cy="14" r="1.3" />
      </g>
      <g className="icon-outline">
        <path d="M3 13l7-7 8 2-6 6z" />
        <path d="M10 6L7 3a1.5 1.5 0 0 0-2 0l-2 2a1.5 1.5 0 0 0 0 2l3 3" />
        <path d="M12 14l8 8a2 2 0 0 0 2.8-2.8l-8-8" />
        <circle cx="12" cy="14" r="1" />
      </g>
    </svg>
  );
}

// 8. Máquina / Rapado — Cortapelos eléctrico profesional
export function ClipperBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`barber-icon-svg ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <g className="icon-filled">
        <rect x="7" y="7" width="10" height="14" rx="3" />
        <rect x="7" y="3" width="10" height="5" rx="1" />
        <path d="M9.5 3v4M12 3v4M14.5 3v4" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M12 13v3" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="icon-outline">
        <rect x="7" y="7" width="10" height="14" rx="3" />
        <path d="M7 7V3h10v4" />
        <line x1="9.5" y1="3" x2="9.5" y2="7" />
        <line x1="12" y1="3" x2="12" y2="7" />
        <line x1="14.5" y1="3" x2="14.5" y2="7" />
        <line x1="12" y1="12" x2="12" y2="15" />
      </g>
    </svg>
  );
}

// 9. Degradado / Fade — Capas de transición
export function FadeBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`barber-icon-svg ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <g className="icon-filled">
        <rect x="3" y="5" width="18" height="2.5" rx="1.25" />
        <rect x="3" y="9.5" width="14" height="2" rx="1" opacity="0.75" />
        <rect x="3" y="13.5" width="10" height="1.5" rx="0.75" opacity="0.5" />
        <rect x="3" y="17" width="6" height="1" rx="0.5" opacity="0.3" />
      </g>
      <g className="icon-outline">
        <path d="M3 6h18" />
        <path d="M4 10h16" strokeDasharray="1 2" />
        <path d="M6 14h12" strokeDasharray="2 3" />
        <path d="M8 18h8" strokeDasharray="3 4" />
        <path d="M12 3v18" strokeWidth="1.5" strokeOpacity="0.4" />
      </g>
    </svg>
  );
}

// 10. Corte Infantil / Niños — Tijera con estrella
export function KidsBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`barber-icon-svg ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <g className="icon-filled">
        <circle cx="6" cy="6" r="3.2" />
        <circle cx="6" cy="18" r="3.2" />
        <path d="M19 5L8.5 15.5M14.8 14.2L19 19" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M19 12l.7 1.4 1.5.2-1.1 1.1.3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1.1 1.5-.2z" />
      </g>
      <g className="icon-outline">
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <line x1="19" y1="5" x2="8.12" y2="15.88" />
        <line x1="14.47" y1="14.48" x2="19" y2="19" />
        <path d="M19 12l.7 1.4 1.5.2-1.1 1.1.3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1.1 1.5-.2z" />
      </g>
    </svg>
  );
}

// 11. Cejas / Perfilado de Precisión — Micro-cuchilla sobre ceja
export function EyebrowBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`barber-icon-svg ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <g className="icon-filled">
        <path d="M3 17c4-4.5 8.5-6 14-5.5 1.5.2 3 .7 4 1.8" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <path d="M14 7l7-4-3 7-4-3z" />
        <path d="M8.5 14l5.5-7" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
      <g className="icon-outline">
        <path d="M3 17c4-4 8-6 13-6 2 0 4 .5 5 1.5" />
        <path d="m14 7 7-4-3 7-4-3z" />
        <line x1="8" y1="14" x2="14" y2="7" />
      </g>
    </svg>
  );
}

// 12. Servicio Prémium / VIP — Corona
export function SparklesBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`barber-icon-svg ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <g className="icon-filled">
        <path d="M3 9l4.5 3.5L12 4l4.5 8.5L21 9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
        <circle cx="12" cy="16" r="2" />
      </g>
      <g className="icon-outline">
        <path d="m3 9 4.5 3.5L12 4l4.5 8.5L21 9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
        <circle cx="12" cy="16" r="1.5" />
      </g>
    </svg>
  );
}

// ─── Mapeo canónico de componentes por ID ─────────────────────────────────────
export const BARBER_ICON_COMPONENTS: Record<string, React.ComponentType<BarberIconProps>> = {
  scissors: ScissorsBarberIcon,
  'scissors-crossed': ComboBarberIcon,
  beard: BeardBarberIcon,
  color: ColorBarberIcon,
  wash: WashBarberIcon,
  'beard-color': BeardColorBarberIcon,
  contours: RazorBarberIcon,
  razor: RazorBarberIcon,
  clipper: ClipperBarberIcon,
  fade: FadeBarberIcon,
  'kids-cut': KidsBarberIcon,
  'eyebrow-razor': EyebrowBarberIcon,
  'nose-wax': RazorBarberIcon,
  sparkles: SparklesBarberIcon,
};

export interface ServiceIconOption {
  id: string;
  label: string;
  category: 'corte' | 'barba' | 'tratamiento';
  description: string;
}

export const BARBER_SERVICE_ICON_CATALOG: ServiceIconOption[] = [
  { id: 'scissors', label: 'Corte de Cabello', category: 'corte', description: 'Tijeras clásicas de estilista' },
  { id: 'beard', label: 'Arreglo de Barba', category: 'barba', description: 'Perfilado y recorte de barba' },
  { id: 'scissors-crossed', label: 'Corte + Barba', category: 'barba', description: 'Combo corte y arreglo completo' },
  { id: 'color', label: 'Tinte / Decoloración', category: 'tratamiento', description: 'Decoloración y tinte capilar' },
  { id: 'wash', label: 'Lavado Capilar', category: 'tratamiento', description: 'Lavado de cabeza y peinado' },
  { id: 'beard-color', label: 'Tinte de Barba', category: 'barba', description: 'Tinte y cobertura para barba' },
  { id: 'contours', label: 'Cuello y Patillas', category: 'corte', description: 'Navaja de barbero para perfilado' },
  { id: 'clipper', label: 'Máquina / Rapado', category: 'corte', description: 'Cortapelos a máquina' },
  { id: 'fade', label: 'Degradado / Fade', category: 'corte', description: 'Degradados de precisión' },
  { id: 'kids-cut', label: 'Corte Niños', category: 'corte', description: 'Estilo infantil personalizado' },
  { id: 'eyebrow-razor', label: 'Perfilado de Cejas', category: 'corte', description: 'Diseño y limpieza a navaja' },
  { id: 'sparkles', label: 'Servicio Prémium', category: 'tratamiento', description: 'Atención exclusiva integral' },
];

/**
 * Componente universal para renderizar los iconos de servicios de barbería.
 * Incluye resolución inteligente: si en la base de datos un servicio tiene un icono genérico
 * o desfasado, detecta el nombre del servicio para mostrar el icono exacto.
 */
export function BarberServiceIcon({
  name,
  serviceName,
  className = 'h-5 w-5',
  size,
}: {
  name?: string | null;
  serviceName?: string | null;
  className?: string;
  size?: number;
}) {
  let resolvedKey = (name || 'scissors').toLowerCase().trim();

  // Resolución semántica inteligente para compatibilidad total con la base de datos
  if (serviceName) {
    const s = serviceName.toLowerCase();
    if (s.includes('cuello') || s.includes('patillas')) {
      resolvedKey = 'contours';
    } else if (s.includes('tinte') && s.includes('barba')) {
      resolvedKey = 'beard-color';
    } else if (s.includes('corte') && s.includes('barba')) {
      resolvedKey = 'scissors-crossed';
    } else if (s.includes('decoloraci') || s.includes('tinte')) {
      resolvedKey = 'color';
    } else if (s.includes('lavado')) {
      resolvedKey = 'wash';
    } else if (s.includes('barba') && (resolvedKey === 'clipper' || resolvedKey === 'scissors')) {
      resolvedKey = 'beard';
    }
  }

  const IconComponent = BARBER_ICON_COMPONENTS[resolvedKey] || BARBER_ICON_COMPONENTS.scissors;
  return <IconComponent className={className} size={size} />;
}
