-- SaaS multi-tenant · Paso 7. Contenido público del tenant heredado (SEO, marca, horario, contacto),
-- idéntico a src/lib/legacyBusinessContent.ts. Son datos ya públicos en la web actual.
-- Rollback: supabase/rollback/20260924040000_saas_seed_legacy_public_config_down.sql

BEGIN;

UPDATE public.businesses
SET public_config = $json${
  "seo": {
    "homeTitle": "Peluquería y Barbería Adrián Millán | Huelva",
    "titleSuffix": "Adrián Millán Peluquería Huelva",
    "adminTitleSuffix": "Adrián Millán Peluquería",
    "description": "Peluquería y barbería Adrián Millán en Huelva (Calle Artesanos 6, zona Santa Marta / La Orden). Especialistas en degradados fade, corte clásico y barba. Cita previa online.",
    "ogTitle": "Peluquería y Barbería Adrián Millán | Huelva",
    "ogDescription": "Peluquería y barbería profesional en Huelva. Especialistas en corte masculino, degradados fade y cuidado de barba. Reserva tu cita online.",
    "twitterDescription": "Peluquería y barbería profesional en Huelva. Reserva tu cita previa online de forma rápida.",
    "ogImage": "https://www.adrianmillan.es/images/image.png",
    "siteName": "Adrián Millán Peluquería y Barbería",
    "appTitle": "Adrián Millán"
  },
  "brand": {
    "shortName": "Adrián Millán",
    "faviconUrl": "/icon-512.png",
    "logoUrl": "/icon-512.png",
    "themeColor": "#0a0a0a"
  },
  "tagline": "Barbería y peluquería en Huelva",
  "hours": [
    { "day": "Lunes", "hours": "9:30 – 13:30 · 16:30 – 20:30" },
    { "day": "Martes", "hours": "9:30 – 13:30 · 16:30 – 20:30" },
    { "day": "Miércoles", "hours": "9:30 – 13:30 · 16:30 – 20:30" },
    { "day": "Jueves", "hours": "9:30 – 13:30 · 16:30 – 20:30" },
    { "day": "Viernes", "hours": "9:30 – 13:30 · 16:30 – 20:30" },
    { "day": "Sábado", "hours": "9:30 – 13:30" },
    { "day": "Domingo", "hours": "Cerrado" }
  ]
}$json$::jsonb,
    contact = $json${
  "phone": "+34614922082",
  "whatsapp": "+34614922082",
  "instagram": "barberiaadrianmillan_",
  "address": "Calle Artesanos 6, 21005 Huelva",
  "mapsUrl": "https://maps.app.goo.gl/VVebf6S9uxo3F5rC9"
}$json$::jsonb,
    updated_at = now()
WHERE id = 'f67af497-5e58-48a2-8bea-022c4f1d7e1a';

COMMIT;
