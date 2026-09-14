/*
# Create store catalog: categories and products

## What this migration does
Creates a dynamic product catalog system so the salon admin (Adrián) can manage
categories (sections) and products with images, prices and descriptions. Clients
see the catalog in the public app with tab navigation and a product detail modal.

## New Tables

### store_categories
- `id` (uuid, primary key)
- `name` (text, not null) — display name e.g. "Teléfonos reacondicionados"
- `slug` (text, not null, unique) — URL-safe identifier
- `sort_order` (int, default 0) — ordering for tabs
- `active` (boolean, default true) — soft-hide a category
- `created_at` (timestamptz)

### store_products
- `id` (uuid, primary key)
- `category_id` (uuid, FK → store_categories, ON DELETE CASCADE)
- `name` (text, not null)
- `description` (text, nullable)
- `price` (numeric, default 0)
- `image_url` (text, nullable) — public URL from Supabase Storage
- `sort_order` (int, default 0)
- `active` (boolean, default true)
- `created_at` (timestamptz)

## Security (RLS)
- Both tables: public SELECT (anon + authenticated can read).
- INSERT/UPDATE/DELETE: restricted to authenticated users who are verified staff
  (checked via the existing `staff` table).
- A SECURITY DEFINER helper function `is_verified_staff()` checks the staff table.

## Storage
- Creates a public bucket `product-images` for uploading product photos.
- Public read access; write restricted to authenticated users.
*/

-- Helper: check if the current user is a verified staff member
CREATE OR REPLACE FUNCTION public.is_verified_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
    AND status = 'verified'
  );
$$;

-- Categories
CREATE TABLE IF NOT EXISTS public.store_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_store_categories" ON public.store_categories;
CREATE POLICY "public_read_store_categories"
  ON public.store_categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_store_categories" ON public.store_categories;
CREATE POLICY "staff_insert_store_categories"
  ON public.store_categories FOR INSERT
  TO authenticated WITH CHECK (public.is_verified_staff());

DROP POLICY IF EXISTS "staff_update_store_categories" ON public.store_categories;
CREATE POLICY "staff_update_store_categories"
  ON public.store_categories FOR UPDATE
  TO authenticated USING (public.is_verified_staff())
  WITH CHECK (public.is_verified_staff());

DROP POLICY IF EXISTS "staff_delete_store_categories" ON public.store_categories;
CREATE POLICY "staff_delete_store_categories"
  ON public.store_categories FOR DELETE
  TO authenticated USING (public.is_verified_staff());

-- Products
CREATE TABLE IF NOT EXISTS public.store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.store_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_store_products" ON public.store_products;
CREATE POLICY "public_read_store_products"
  ON public.store_products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_store_products" ON public.store_products;
CREATE POLICY "staff_insert_store_products"
  ON public.store_products FOR INSERT
  TO authenticated WITH CHECK (public.is_verified_staff());

DROP POLICY IF EXISTS "staff_update_store_products" ON public.store_products;
CREATE POLICY "staff_update_store_products"
  ON public.store_products FOR UPDATE
  TO authenticated USING (public.is_verified_staff())
  WITH CHECK (public.is_verified_staff());

DROP POLICY IF EXISTS "staff_delete_store_products" ON public.store_products;
CREATE POLICY "staff_delete_store_products"
  ON public.store_products FOR DELETE
  TO authenticated USING (public.is_verified_staff());

-- Index for querying products by category ordered
CREATE INDEX IF NOT EXISTS idx_store_products_category_sort
  ON public.store_products (category_id, sort_order);

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, authenticated write
DROP POLICY IF EXISTS "public_read_product_images" ON storage.objects;
CREATE POLICY "public_read_product_images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "auth_write_product_images" ON storage.objects;
CREATE POLICY "auth_write_product_images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "auth_update_product_images" ON storage.objects;
CREATE POLICY "auth_update_product_images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "auth_delete_product_images" ON storage.objects;
CREATE POLICY "auth_delete_product_images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');

-- Seed initial categories
INSERT INTO public.store_categories (name, slug, sort_order) VALUES
  ('Teléfonos reacondicionados', 'telefonos-reacondicionados', 0),
  ('Perfumes', 'perfumes', 1),
  ('Líneas Digi', 'lineas-digi', 2),
  ('Reparaciones', 'reparaciones', 3),
  ('Vapes', 'vapes', 4)
ON CONFLICT (slug) DO NOTHING;
