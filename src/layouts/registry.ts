import { lazy, type ComponentType } from 'react';
import { Landing, type LandingProps } from '@/components/Landing';
import type { LayoutKey } from '@/lib/businessModel';

// Todas las variantes reciben las mismas props y delegan la reserva en el mismo motor (useBooking).
export const LANDING_LAYOUTS: Record<LayoutKey, ComponentType<LandingProps>> = {
  classic: Landing,
  editorial: lazy(() => import('@/layouts/editorial/EditorialLanding')),
  minimal: lazy(() => import('@/layouts/minimal/MinimalLanding')),
};
