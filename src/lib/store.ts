import { supabase } from '@/lib/supabase';
import type { StoreCategory, StoreProduct } from '@/types';

export async function fetchStoreCategories(): Promise<StoreCategory[]> {
  const { data, error } = await supabase
    .from('store_categories')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data as StoreCategory[]) ?? [];
}

export async function fetchAllStoreCategories(): Promise<StoreCategory[]> {
  const { data, error } = await supabase
    .from('store_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data as StoreCategory[]) ?? [];
}

export async function fetchProductsByCategory(categoryId: string): Promise<StoreProduct[]> {
  const { data, error } = await supabase
    .from('store_products')
    .select('*')
    .eq('category_id', categoryId)
    .eq('active', true)
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data as StoreProduct[]) ?? [];
}

export async function fetchAdminProductsByCategory(categoryId: string): Promise<StoreProduct[]> {
  const { data, error } = await supabase
    .from('store_products')
    .select('*')
    .eq('category_id', categoryId)
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data as StoreProduct[]) ?? [];
}

export async function fetchAllStoreProducts(): Promise<StoreProduct[]> {
  const { data, error } = await supabase
    .from('store_products')
    .select('*')
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true });
  if (error) return [];
  return (data as StoreProduct[]) ?? [];
}

export async function uploadProductImage(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (error) return null;
  return supabase.storage.from('product-images').getPublicUrl(fileName).data.publicUrl;
}
