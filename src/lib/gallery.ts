import { supabase } from '@/lib/supabase';
import type { GalleryPhoto } from '@/types';

export const DEFAULT_GALLERY_PHOTOS: GalleryPhoto[] = [
  {
    id: 'seed-1',
    image_url: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=compress&cs=tinysrgb&w=800&q=80',
    title: 'Fade clásico & textura',
    barber_id: 'adrian',
    created_at: new Date().toISOString(),
  },
  {
    id: 'seed-2',
    image_url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=compress&cs=tinysrgb&w=800&q=80',
    title: 'Arreglo de barba & perfilado',
    barber_id: 'adrian',
    created_at: new Date().toISOString(),
  },
  {
    id: 'seed-3',
    image_url: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=compress&cs=tinysrgb&w=800&q=80',
    title: 'Degradado medio Skin Fade',
    barber_id: 'adrian',
    created_at: new Date().toISOString(),
  },
  {
    id: 'seed-4',
    image_url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=compress&cs=tinysrgb&w=800&q=80',
    title: 'Taper Fade con acabado natural',
    barber_id: 'adrian',
    created_at: new Date().toISOString(),
  },
  {
    id: 'seed-5',
    image_url: 'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=compress&cs=tinysrgb&w=800&q=80',
    title: 'Diseño moderno & peinado',
    barber_id: 'adrian',
    created_at: new Date().toISOString(),
  },
  {
    id: 'seed-6',
    image_url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=compress&cs=tinysrgb&w=800&q=80',
    title: 'Corte tradicional a tijera',
    barber_id: 'adrian',
    created_at: new Date().toISOString(),
  },
];

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function getDeletedSeedIds(): string[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('am_deleted_seed_photos') : null;
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function fetchGalleryPhotos(): Promise<GalleryPhoto[]> {
  const deletedSeeds = getDeletedSeedIds();
  try {
    const { data, error } = await supabase
      .from('gallery_photos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching gallery_photos, using default seed photos:', error.message);
      return DEFAULT_GALLERY_PHOTOS.filter((p) => !deletedSeeds.includes(p.id));
    }

    if (!data || data.length === 0) {
      return DEFAULT_GALLERY_PHOTOS.filter((p) => !deletedSeeds.includes(p.id));
    }

    return data as GalleryPhoto[];
  } catch (err) {
    console.warn('Network error fetching gallery photos:', err);
    return DEFAULT_GALLERY_PHOTOS.filter((p) => !deletedSeeds.includes(p.id));
  }
}

export async function uploadGalleryPhoto(
  file: File,
  title: string = '',
  barberId: string | null = null
): Promise<{ photo: GalleryPhoto | null; error: string | null }> {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `cut_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('gallery-photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading to gallery-photos bucket:', uploadError);
      return { photo: null, error: `Error de almacenamiento: ${uploadError.message}` };
    }

    const { data: urlData } = supabase.storage
      .from('gallery-photos')
      .getPublicUrl(fileName);

    const imageUrl = urlData.publicUrl;

    const { data: insertData, error: insertError } = await supabase
      .from('gallery_photos')
      .insert({
        image_url: imageUrl,
        title: title.trim() || null,
        barber_id: barberId || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting into gallery_photos table:', insertError);
      return { photo: null, error: `Error de base de datos: ${insertError.message}` };
    }

    return { photo: insertData as GalleryPhoto, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al subir la fotografía';
    return { photo: null, error: msg };
  }
}

export async function deleteGalleryPhoto(id: string, imageUrl?: string): Promise<{ error: string | null }> {
  try {
    // If it is a seed demo photo (not a database UUID)
    if (!isUUID(id)) {
      try {
        const deleted = getDeletedSeedIds();
        if (!deleted.includes(id)) {
          deleted.push(id);
          localStorage.setItem('am_deleted_seed_photos', JSON.stringify(deleted));
        }
      } catch { /* ignore */ }
      return { error: null };
    }

    if (imageUrl && imageUrl.includes('/gallery-photos/')) {
      const parts = imageUrl.split('/gallery-photos/');
      if (parts[1]) {
        await supabase.storage.from('gallery-photos').remove([parts[1]]);
      }
    }

    const { error } = await supabase.from('gallery_photos').delete().eq('id', id);
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al eliminar la foto';
    return { error: msg };
  }
}
