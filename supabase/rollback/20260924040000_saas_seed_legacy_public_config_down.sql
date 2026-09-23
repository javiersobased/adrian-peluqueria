-- Revierte el contenido público sembrado del tenant heredado. Antes, redesplegar el frontend
-- anterior: el nuevo usaría títulos por defecto (nombre del negocio) si public_config queda vacío.

BEGIN;

UPDATE public.businesses
SET public_config = '{}'::jsonb, contact = '{}'::jsonb, updated_at = now()
WHERE id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a';

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260924040000';

COMMIT;
