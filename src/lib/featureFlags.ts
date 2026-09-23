// Solo el literal "true" activa el modo SaaS; cualquier otro valor o ausencia lo deja apagado.
export const SAAS_MODE_ENABLED = import.meta.env.VITE_SAAS_MODE === 'true';
