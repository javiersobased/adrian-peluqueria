// Módulos contratados por el negocio (businesses.active_features). El servidor los aplica en RLS;
// el frontend solo evita mostrar lo que el plan no incluye.

export const FEATURE_KEYS = [
  'has_store',
  'has_gallery',
  'allow_manual_booking',
  'enable_emails',
  'enable_campaigns',
  'enable_pwa',
  'enable_seo_advanced',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type BusinessFeatures = Record<FeatureKey, boolean>;

export const ALL_FEATURES: BusinessFeatures = Object.fromEntries(
  FEATURE_KEYS.map((key) => [key, true]),
) as BusinessFeatures;

// Una clave ausente o no booleana cuenta como desactivada (igual que has_feature() en SQL).
export function parseFeatures(value: unknown): BusinessFeatures {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, raw[key] === true])) as BusinessFeatures;
}
