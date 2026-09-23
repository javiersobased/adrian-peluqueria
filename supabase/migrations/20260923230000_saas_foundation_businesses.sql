-- SaaS multi-tenant · Paso 2 (fundación aditiva).
-- Solo añade objetos: no modifica filas existentes, políticas, funciones ni triggers vigentes.
-- business_id queda NULL en todas las filas heredadas hasta el backfill (Paso 3).
-- Rollback: supabase/rollback/20260923230000_saas_foundation_businesses_down.sql

BEGIN;

-- 1. Catálogo de negocios (tenants)
CREATE TABLE IF NOT EXISTS public.businesses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE
                CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  name          text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'active', 'suspended')),
  timezone      text NOT NULL DEFAULT 'Europe/Madrid',
  locale        text NOT NULL DEFAULT 'es-ES',
  currency      char(3) NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  layout_key    text NOT NULL DEFAULT 'classic'
                CHECK (layout_key IN ('classic', 'editorial', 'minimal')),
  contact       jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(contact) = 'object'),
  theme         jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(theme) = 'object'),
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(public_config) = 'object'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. Dominios por negocio. Hostname canónico: minúsculas, ASCII/punycode, sin puerto ni punto final.
CREATE TABLE IF NOT EXISTS public.business_domains (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  hostname    text NOT NULL UNIQUE
              CHECK (
                hostname ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$'
                AND length(hostname) <= 253
              ),
  is_primary  boolean NOT NULL DEFAULT false,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'active', 'disabled')),
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_domains_active_requires_verification
    CHECK (status <> 'active' OR verified_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_business_domains_business_id
  ON public.business_domains (business_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_domains_one_primary
  ON public.business_domains (business_id) WHERE is_primary;

-- 3. Membresías por negocio (sustituirá a staff + emails maestros en el Paso 4).
-- email permite invitar antes del primer login; user_id se enlaza al entrar con Google.
CREATE TABLE IF NOT EXISTS public.business_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL CHECK (email = lower(btrim(email)) AND email LIKE '%@%'),
  role        text NOT NULL CHECK (role IN ('owner', 'admin', 'barber')),
  barber_id   text,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'verified', 'rejected', 'revoked')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_members_business_email_key UNIQUE (business_id, email)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_members_business_user
  ON public.business_members (business_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_business_members_user_id
  ON public.business_members (user_id);

-- 4. RLS de las tablas nuevas. Escrituras solo vía service_role / SQL de plataforma.
ALTER TABLE public.businesses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.businesses       FROM anon, authenticated;
REVOKE ALL ON public.business_domains FROM anon, authenticated;
REVOKE ALL ON public.business_members FROM anon, authenticated;

GRANT SELECT ON public.businesses       TO anon, authenticated;
GRANT SELECT ON public.business_members TO authenticated;

DROP POLICY IF EXISTS public_read_active_businesses ON public.businesses;
CREATE POLICY public_read_active_businesses ON public.businesses
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

-- business_domains: sin políticas → invisible para anon/authenticated.
-- La resolución host → negocio se hará en servidor (Paso 5).

DROP POLICY IF EXISTS members_read_own_membership ON public.business_members;
CREATE POLICY members_read_own_membership ON public.business_members
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 5. Tenant heredado: Adrián Millán. UUID fijo, compartido con src/lib/tenantHosts.ts.
INSERT INTO public.businesses (id, slug, name, status, timezone, locale, currency, layout_key)
VALUES (
  'f67af497-5e58-48a2-8bea-022c4f1d7e1a',
  'adrian-millan',
  'Peluquería y Barbería Adrián Millán',
  'active',
  'Europe/Madrid',
  'es-ES',
  'EUR',
  'classic'
)
ON CONFLICT (id) DO NOTHING;

-- Dominios asignados hoy al proyecto Vercel "adrian-peluqueria" (verificados en Vercel).
-- citas./admin./reserva./reservar. no están configurados en Vercel: no se registran.
INSERT INTO public.business_domains (business_id, hostname, is_primary, status, verified_at)
VALUES
  ('f67af497-5e58-48a2-8bea-022c4f1d7e1a', 'www.adrianmillan.es', true,  'active', now()),
  ('f67af497-5e58-48a2-8bea-022c4f1d7e1a', 'adrianmillan.es',     false, 'active', now())
ON CONFLICT (hostname) DO NOTHING;

-- 6. business_id nullable + índice en todas las tablas de aplicación (sin DEFAULT, sin backfill).
ALTER TABLE public.bookings                 ADD COLUMN IF NOT EXISTS business_id uuid
  CONSTRAINT bookings_business_id_fkey                 REFERENCES public.businesses(id) ON DELETE RESTRICT;
ALTER TABLE public.barbers                  ADD COLUMN IF NOT EXISTS business_id uuid
  CONSTRAINT barbers_business_id_fkey                  REFERENCES public.businesses(id) ON DELETE RESTRICT;
ALTER TABLE public.services                 ADD COLUMN IF NOT EXISTS business_id uuid
  CONSTRAINT services_business_id_fkey                 REFERENCES public.businesses(id) ON DELETE RESTRICT;
ALTER TABLE public.barber_schedules         ADD COLUMN IF NOT EXISTS business_id uuid
  CONSTRAINT barber_schedules_business_id_fkey         REFERENCES public.businesses(id) ON DELETE RESTRICT;
ALTER TABLE public.barber_blocks            ADD COLUMN IF NOT EXISTS business_id uuid
  CONSTRAINT barber_blocks_business_id_fkey            REFERENCES public.businesses(id) ON DELETE RESTRICT;
ALTER TABLE public.barber_vacations         ADD COLUMN IF NOT EXISTS business_id uuid
  CONSTRAINT barber_vacations_business_id_fkey         REFERENCES public.businesses(id) ON DELETE RESTRICT;
ALTER TABLE public.staff                    ADD COLUMN IF NOT EXISTS business_id uuid
  CONSTRAINT staff_business_id_fkey                    REFERENCES public.businesses(id) ON DELETE RESTRICT;
ALTER TABLE public.customers                ADD COLUMN IF NOT EXISTS business_id uuid
  CONSTRAINT customers_business_id_fkey                REFERENCES public.businesses(id) ON DELETE RESTRICT;
ALTER TABLE public.booking_notifications    ADD COLUMN IF NOT EXISTS business_id uuid
  CONSTRAINT booking_notifications_business_id_fkey    REFERENCES public.businesses(id) ON DELETE RESTRICT;
ALTER TABLE public.notification_idempotency ADD COLUMN IF NOT EXISTS business_id uuid
  CONSTRAINT notification_idempotency_business_id_fkey REFERENCES public.businesses(id) ON DELETE RESTRICT;
ALTER TABLE public.store_categories         ADD COLUMN IF NOT EXISTS business_id uuid
  CONSTRAINT store_categories_business_id_fkey         REFERENCES public.businesses(id) ON DELETE RESTRICT;
ALTER TABLE public.store_products           ADD COLUMN IF NOT EXISTS business_id uuid
  CONSTRAINT store_products_business_id_fkey           REFERENCES public.businesses(id) ON DELETE RESTRICT;
ALTER TABLE public.gallery_photos           ADD COLUMN IF NOT EXISTS business_id uuid
  CONSTRAINT gallery_photos_business_id_fkey           REFERENCES public.businesses(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_bookings_business_id                 ON public.bookings (business_id);
CREATE INDEX IF NOT EXISTS idx_barbers_business_id                  ON public.barbers (business_id);
CREATE INDEX IF NOT EXISTS idx_services_business_id                 ON public.services (business_id);
CREATE INDEX IF NOT EXISTS idx_barber_schedules_business_id         ON public.barber_schedules (business_id);
CREATE INDEX IF NOT EXISTS idx_barber_blocks_business_id            ON public.barber_blocks (business_id);
CREATE INDEX IF NOT EXISTS idx_barber_vacations_business_id         ON public.barber_vacations (business_id);
CREATE INDEX IF NOT EXISTS idx_staff_business_id                    ON public.staff (business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_id                ON public.customers (business_id);
CREATE INDEX IF NOT EXISTS idx_booking_notifications_business_id    ON public.booking_notifications (business_id);
CREATE INDEX IF NOT EXISTS idx_notification_idempotency_business_id ON public.notification_idempotency (business_id);
CREATE INDEX IF NOT EXISTS idx_store_categories_business_id         ON public.store_categories (business_id);
CREATE INDEX IF NOT EXISTS idx_store_products_business_id           ON public.store_products (business_id);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_business_id           ON public.gallery_photos (business_id);

COMMIT;
