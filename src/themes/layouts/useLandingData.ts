import { useEffect, useState } from 'react';
import { fetchBarbers, fetchServices } from '@/data/services';
import type { BusinessFeatures } from '@/lib/features';
import { tenantFrom } from '@/lib/tenant';
import type { Barber, GalleryPhoto, Service, StoreProduct } from '@/types';

export interface LandingData {
  services: Service[];
  barbers: Barber[];
  photos: GalleryPhoto[];
  products: StoreProduct[];
  loading: boolean;
}

const EMPTY = { data: [] as unknown[] };

// Datos del escaparate. Solo se piden los módulos que el plan del negocio incluye.
export function useLandingData(features: BusinessFeatures, photoLimit = 7, productLimit = 3): LandingData {
  const [data, setData] = useState<LandingData>({ services: [], barbers: [], photos: [], products: [], loading: true });
  const { has_gallery: withGallery, has_store: withStore } = features;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchServices(),
      fetchBarbers(),
      withGallery
        ? tenantFrom('gallery_photos').select('*').order('created_at', { ascending: false }).limit(photoLimit)
        : Promise.resolve(EMPTY),
      withStore
        ? tenantFrom('store_products').select('*').eq('active', true).order('sort_order', { ascending: true }).limit(productLimit)
        : Promise.resolve(EMPTY),
    ]).then(([services, barbers, gallery, store]) => {
      if (cancelled) return;
      setData({
        services,
        barbers,
        photos: (gallery.data as GalleryPhoto[] | null) ?? [],
        products: (store.data as StoreProduct[] | null) ?? [],
        loading: false,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [withGallery, withStore, photoLimit, productLimit]);

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
