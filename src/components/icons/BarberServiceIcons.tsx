import React from 'react';

export interface BarberIconProps {
  className?: string;
  size?: number;
}

export interface ServiceIconOption {
  id: string;
  label: string;
  category: 'corte' | 'barba' | 'tratamiento';
  description: string;
  imageSrc: string;
}

/**
 * Catálogo exclusivo de los 9 iconos de servicios de peluquería y barbería
 * enmarcados en azulejos oscuros de lujo con relieve dorado 3D.
 */
export const BARBER_SERVICE_ICON_CATALOG: ServiceIconOption[] = [
  {
    id: 'corte',
    label: 'Corte de Cabello',
    category: 'corte',
    description: 'Tijeras y peine clásico de estilista',
    imageSrc: '/images/services/corte.png',
  },
  {
    id: 'barba',
    label: 'Arreglo de Barba',
    category: 'barba',
    description: 'Barba y bigote perfilado clásico',
    imageSrc: '/images/services/barba.png',
  },
  {
    id: 'combo',
    label: 'Corte + Barba',
    category: 'corte',
    description: 'Combo integral corte de pelo y arreglo de barba',
    imageSrc: '/images/services/combo.png',
  },
  {
    id: 'tinte',
    label: 'Color / Decoloración',
    category: 'tratamiento',
    description: 'Brocha aplicadora y gota de color',
    imageSrc: '/images/services/tinte.png',
  },
  {
    id: 'lavado',
    label: 'Lavado Capilar',
    category: 'tratamiento',
    description: 'Lavado con champú y cuidado capilar',
    imageSrc: '/images/services/lavado.png',
  },
  {
    id: 'afeitado',
    label: 'Afeitado a Navaja',
    category: 'barba',
    description: 'Perfilado y afeitado tradicional a navaja',
    imageSrc: '/images/services/afeitado.png',
  },
  {
    id: 'facial',
    label: 'Tratamiento Facial',
    category: 'tratamiento',
    description: 'Mascarilla purificante facial y skincare',
    imageSrc: '/images/services/facial.png',
  },
  {
    id: 'toalla',
    label: 'Toalla Caliente',
    category: 'tratamiento',
    description: 'Ritual relajante de toallas al vapor',
    imageSrc: '/images/services/toalla.png',
  },
  {
    id: 'secado',
    label: 'Secado & Peinado',
    category: 'corte',
    description: 'Secador profesional y styling final',
    imageSrc: '/images/services/secado.png',
  },
];

const LEGACY_MAP: Record<string, string> = {
  corte: 'corte',
  scissors: 'corte',
  fade: 'corte',
  'kids-cut': 'corte',
  barba: 'barba',
  beard: 'barba',
  combo: 'combo',
  'scissors-crossed': 'combo',
  'corte-barba': 'combo',
  tinte: 'tinte',
  color: 'tinte',
  'beard-color': 'tinte',
  decoloracion: 'tinte',
  lavado: 'lavado',
  wash: 'lavado',
  afeitado: 'afeitado',
  razor: 'afeitado',
  contours: 'afeitado',
  'eyebrow-razor': 'afeitado',
  'nose-wax': 'afeitado',
  facial: 'facial',
  mascarilla: 'facial',
  sparkles: 'facial',
  toalla: 'toalla',
  toallas: 'toalla',
  spa: 'toalla',
  secado: 'secado',
  peinado: 'secado',
  styling: 'secado',
};

/**
 * Resuelve el ID canónico de icono a partir del nombre guardado en base de datos
 * o del nombre del servicio para garantizar total compatibilidad retrospectiva.
 */
export function resolveServiceIconKey(name?: string | null, serviceName?: string | null): string {
  // 1. Detección semántica por el nombre del servicio (máxima precisión)
  if (serviceName) {
    const s = serviceName.toLowerCase();
    if (s.includes('corte') && s.includes('barba')) return 'combo';
    if (s.includes('tinte') || s.includes('color') || s.includes('decoloraci')) return 'tinte';
    if (s.includes('lavado') || s.includes('champu')) return 'lavado';
    if (s.includes('cuello') || s.includes('patillas') || s.includes('navaja') || s.includes('afeitad')) return 'afeitado';
    if (s.includes('mascarill') || s.includes('facial') || s.includes('limpieza') || s.includes('skin')) return 'facial';
    if (s.includes('toalla') || s.includes('vapor') || s.includes('spa')) return 'toalla';
    if (s.includes('secad') || s.includes('peinad') || s.includes('brush') || s.includes('styling')) return 'secado';
    if (s.includes('barba') || s.includes('bigote')) return 'barba';
    if (s.includes('corte') || s.includes('degradad') || s.includes('fade') || s.includes('pelo')) return 'corte';
  }

  // 2. Mapeo del identificador guardado
  if (name) {
    const cleaned = name.toLowerCase().trim();
    if (LEGACY_MAP[cleaned]) return LEGACY_MAP[cleaned];
  }

  return 'corte';
}

/**
 * Componente universal para renderizar los iconos de servicios de barbería con su marco de lujo.
 */
export function BarberServiceIcon({
  name,
  serviceName,
  className = 'h-full w-full object-cover',
  size,
}: {
  name?: string | null;
  serviceName?: string | null;
  className?: string;
  size?: number;
}) {
  const resolvedKey = resolveServiceIconKey(name, serviceName);
  const iconOption =
    BARBER_SERVICE_ICON_CATALOG.find((o) => o.id === resolvedKey) ||
    BARBER_SERVICE_ICON_CATALOG[0];

  return (
    <img
      src={iconOption.imageSrc}
      alt={iconOption.label}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`select-none pointer-events-none ${className}`}
    />
  );
}

// ─── Componentes individuales para compatibilidad hacia atrás ─────────────────
export function ScissorsBarberIcon(props: BarberIconProps) {
  return <BarberServiceIcon name="corte" {...props} />;
}
export function BeardBarberIcon(props: BarberIconProps) {
  return <BarberServiceIcon name="barba" {...props} />;
}
export function ComboBarberIcon(props: BarberIconProps) {
  return <BarberServiceIcon name="combo" {...props} />;
}
export function ColorBarberIcon(props: BarberIconProps) {
  return <BarberServiceIcon name="tinte" {...props} />;
}
export function WashBarberIcon(props: BarberIconProps) {
  return <BarberServiceIcon name="lavado" {...props} />;
}
export function BeardColorBarberIcon(props: BarberIconProps) {
  return <BarberServiceIcon name="tinte" {...props} />;
}
export function RazorBarberIcon(props: BarberIconProps) {
  return <BarberServiceIcon name="afeitado" {...props} />;
}
export function ClipperBarberIcon(props: BarberIconProps) {
  return <BarberServiceIcon name="corte" {...props} />;
}
export function FadeBarberIcon(props: BarberIconProps) {
  return <BarberServiceIcon name="corte" {...props} />;
}
export function KidsBarberIcon(props: BarberIconProps) {
  return <BarberServiceIcon name="corte" {...props} />;
}
export function EyebrowBarberIcon(props: BarberIconProps) {
  return <BarberServiceIcon name="afeitado" {...props} />;
}
export function SparklesBarberIcon(props: BarberIconProps) {
  return <BarberServiceIcon name="facial" {...props} />;
}

export const BARBER_ICON_COMPONENTS: Record<string, React.ComponentType<BarberIconProps>> = {
  corte: ScissorsBarberIcon,
  scissors: ScissorsBarberIcon,
  barba: BeardBarberIcon,
  beard: BeardBarberIcon,
  combo: ComboBarberIcon,
  'scissors-crossed': ComboBarberIcon,
  tinte: ColorBarberIcon,
  color: ColorBarberIcon,
  'beard-color': BeardColorBarberIcon,
  lavado: WashBarberIcon,
  wash: WashBarberIcon,
  afeitado: RazorBarberIcon,
  razor: RazorBarberIcon,
  contours: RazorBarberIcon,
  facial: SparklesBarberIcon,
  sparkles: SparklesBarberIcon,
  toalla: (props) => <BarberServiceIcon name="toalla" {...props} />,
  secado: (props) => <BarberServiceIcon name="secado" {...props} />,
};
