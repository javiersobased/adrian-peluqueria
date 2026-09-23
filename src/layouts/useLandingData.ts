import { useEffect, useState } from 'react';
import { fetchBarbers, fetchServices } from '@/data/services';
import { tenantFrom } from '@/lib/tenant';
import type { Barber, GalleryPhoto, Service } from '@/types';

export interface LandingData {
  services: Service[];
  barbers: Barber[];
  photos: GalleryPhoto[];
  loading: boolean;
}

// Datos del escaparate para layouts no heredados: sin fotos ni contenido de ejemplo de otro negocio.
export function useLandingData(photoLimit = 6): LandingData {
  const [data, setData] = useState<LandingData>({ services: [], barbers: [], photos: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchServices(),
      fetchBarbers(),
      photoLimit > 0
        ? tenantFrom('gallery_photos').select('*').order('created_at', { ascending: false }).limit(photoLimit)
        : Promise.resolve({ data: [] }),
    ]).then(([services, barbers, gallery]) => {
      if (cancelled) return;
      setData({
        services,
        barbers,
        photos: (gallery.data as GalleryPhoto[] | null) ?? [],
        loading: false,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [photoLimit]);

  return data;
}

export function formatPrice(value: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function serviceMinutes(service: Service): number | null {
  if (service.duration_minutes && service.duration_minutes > 0) return service.duration_minutes;
  const match = service.duration?.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
