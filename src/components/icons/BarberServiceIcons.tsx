import React from 'react';

export interface BarberIconProps {
  className?: string;
  size?: number;
}

// 1. Corte de Cabello (Tijeras clásicas de estilista - geometría limpia Lucide)
export function ScissorsBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
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
    </svg>
  );
}

// 2. Arreglo de Barba (Silueta limpia de bigote y barba perfilada)
export function BeardBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      {/* Bigote clásico */}
      <path d="M4 11.5c2.5-1.5 5.5-.5 8 1.5 2.5-2 5.5-3 8-1.5 1.5 1 1 3-.5 3.5-3 1-6-.5-7.5-2.5-1.5 2-4.5 3.5-7.5 2.5-1.5-.5-2-2.5-.5-3.5z" />
      {/* Contorno de barba */}
      <path d="M5 14c.5 4 3.5 7.5 7 7.5s6.5-3.5 7-7.5" />
    </svg>
  );
}

// 3. Corte + Arreglo de Barba (Combo integral: Tijera y perfilado)
export function ComboBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      <circle cx="5" cy="6" r="2.5" />
      <line x1="17" y1="4" x2="7" y2="14" />
      <line x1="12" y1="11" x2="17" y2="16" />
      <circle cx="5" cy="14" r="2.5" />
      {/* Barba inferior derecha */}
      <path d="M12 17.5c.5 2.5 2 4 4.5 4s4-1.5 4.5-4" />
      <path d="M13.5 16c1-.5 2 0 3 1 1-1 2-1.5 3-1" />
    </svg>
  );
}

// 4. Decoloración / Tinte Capilar (Brocha de tinte y cuenco)
export function ColorBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      <path d="m15 3 6 6-2 2-6-6 2-2z" />
      <path d="m19 5-8 8" />
      <path d="m7 17 4-4-2-2-4 4c-.7.7-1 1.7-1 2.7V21h3.3c1 0 2-.3 2.7-1z" />
      <circle cx="19.5" cy="18.5" r="1.5" fill="currentColor" fillOpacity="0.2" />
      <circle cx="16" cy="20.5" r="1" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

// 5. Lavado Capilar (Lavado de cabeza y agua)
export function WashBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      <path d="M4 10a8 8 0 0 1 16 0v2H4v-2z" />
      <path d="M12 4V2" />
      <path d="M8 17v2" />
      <path d="M12 16v4" />
      <path d="M16 17v2" />
      <path d="M6 19v1" />
      <path d="M18 19v1" />
    </svg>
  );
}

// 6. Tinte Barba (Pincel de precisión sobre barba)
export function BeardColorBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      <path d="M4 11c2.5-1.5 5.5-.5 8 1.5 2.5-2 5.5-3 8-1.5" />
      <path d="M5 13.5c.5 4 3.5 7.5 7 7.5s6.5-3.5 7-7.5" />
      <path d="m15 3 5 5-7 7-2-2z" />
      <path d="m18 2 4 4" />
    </svg>
  );
}

// 7. Arreglo de Cuello y Patillas (Navaja clásica de barbero)
export function RazorBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      <path d="M3 13l7-7 8 2-6 6z" />
      <path d="M10 6L7 3a1.5 1.5 0 0 0-2 0l-2 2a1.5 1.5 0 0 0 0 2l3 3" />
      <path d="M12 14l8 8a2 2 0 0 0 2.8-2.8l-8-8" />
      <circle cx="12" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

// 8. Máquina / Rapado (Cortapelos eléctrico profesional)
export function ClipperBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      <rect x="7" y="7" width="10" height="14" rx="3" />
      <path d="M7 7V3h10v4" />
      <line x1="9.5" y1="3" x2="9.5" y2="7" />
      <line x1="12" y1="3" x2="12" y2="7" />
      <line x1="14.5" y1="3" x2="14.5" y2="7" />
      <line x1="12" y1="12" x2="12" y2="15" />
    </svg>
  );
}

// 9. Degradado / Fade (Capas de transición de texturas)
export function FadeBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      <path d="M3 6h18" />
      <path d="M4 10h16" strokeDasharray="1 2" />
      <path d="M6 14h12" strokeDasharray="2 3" />
      <path d="M8 18h8" strokeDasharray="3 4" />
      <path d="M12 3v18" strokeWidth="1.5" strokeOpacity="0.4" />
    </svg>
  );
}

// 10. Corte Infantil / Niños (Tijera y destello de estilo)
export function KidsBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="19" y1="5" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="19" y2="19" />
      <path d="M19 12l.7 1.4 1.5.2-1.1 1.1.3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1.1 1.5-.2z" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

// 11. Cejas / Perfilado de Precisión (Micro-cuchilla)
export function EyebrowBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      <path d="M3 17c4-4 8-6 13-6 2 0 4 .5 5 1.5" />
      <path d="m14 7 7-4-3 7-4-3z" />
      <line x1="8" y1="14" x2="14" y2="7" />
    </svg>
  );
}

// 12. Servicio Prémium / VIP (Corona y excelencia)
export function SparklesBarberIcon({ className = 'h-5 w-5', size }: BarberIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      <path d="m3 9 4.5 3.5L12 4l4.5 8.5L21 9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}

// Mapeo canónico de componentes por ID
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
