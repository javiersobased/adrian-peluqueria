import { focusRing, useLanding } from '@/themes/layouts/LandingContext';
import type { GalleryStyle, SectionMap } from '@/themes/layouts/types';

function GalleryShell({ children }: { children: React.ReactNode }) {
  const { type, data, actions } = useLanding();
  if (data.photos.length === 0) return null;
  return (
    <section id="trabajos" aria-labelledby="trabajos-titulo" className="border-t border-line">
      <div className={`${type.container} py-section`}>
        <div className="flex items-end justify-between gap-6">
          <h2 id="trabajos-titulo" className={type.heading}>Trabajos recientes</h2>
          {actions.onGoToGallery && (
            <button type="button" onClick={actions.onGoToGallery} className={`border-b border-accent/40 pb-1 text-sm hover:text-accent ${focusRing}`}>
              Ver galería
            </button>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

function usePhotos() {
  const { data, business } = useLanding();
  return data.photos.map((photo) => ({ ...photo, alt: photo.title || `Trabajo de ${business.name}` }));
}

function MosaicGallery() {
  const photos = usePhotos();
  return (
    <GalleryShell>
      <ul className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3">
        {photos.map((photo, index) => (
          <li key={photo.id} className={index === 0 ? 'col-span-2 row-span-2 md:col-span-2' : ''}>
            <img src={photo.image_url} alt={photo.alt} className="h-full w-full rounded-theme object-cover" loading="lazy" />
          </li>
        ))}
      </ul>
    </GalleryShell>
  );
}

function GridGallery() {
  const photos = usePhotos();
  return (
    <GalleryShell>
      <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => (
          <li key={photo.id} className="aspect-square overflow-hidden rounded-theme">
            <img src={photo.image_url} alt={photo.alt} className="h-full w-full object-cover transition duration-500 hover:scale-105" loading="lazy" />
          </li>
        ))}
      </ul>
    </GalleryShell>
  );
}

function StripGallery() {
  const photos = usePhotos();
  return (
    <GalleryShell>
      <ul className="-mx-5 mt-12 flex snap-x gap-4 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8" tabIndex={0} aria-label="Trabajos recientes, desplázate en horizontal">
        {photos.map((photo) => (
          <li key={photo.id} className="aspect-[3/4] w-64 shrink-0 snap-start overflow-hidden rounded-theme">
            <img src={photo.image_url} alt={photo.alt} className="h-full w-full object-cover" loading="lazy" />
          </li>
        ))}
      </ul>
    </GalleryShell>
  );
}

export const GALLERY: SectionMap<GalleryStyle> = {
  mosaic: MosaicGallery,
  grid: GridGallery,
  strip: StripGallery,
};
