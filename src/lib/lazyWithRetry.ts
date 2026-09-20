import { lazy, type ComponentType } from 'react';

/**
 * Wraps dynamic imports to handle stale chunk 404s across deployments safely,
 * guaranteeing AT MOST 1 automatic page refresh per session to prevent infinite reload loops.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  chunkName: string = 'component'
) {
  return lazy(async () => {
    const reloadKey = `amm_lazy_retried_${chunkName}`;
    try {
      const module = await componentImport();
      // On success, reset the retry tracker
      try {
        sessionStorage.removeItem(reloadKey);
      } catch {}
      return module;
    } catch (error) {
      console.error(`[lazyWithRetry] Error loading chunk "${chunkName}":`, error);

      let alreadyRetried = false;
      try {
        alreadyRetried = sessionStorage.getItem(reloadKey) === 'true';
      } catch {}

      if (!alreadyRetried) {
        try {
          sessionStorage.setItem(reloadKey, 'true');
        } catch {}
        console.warn(`[lazyWithRetry] First load failure for "${chunkName}". Refreshing page once...`);
        window.location.reload();
        // Return dummy component while window reloads
        return { default: (() => null) as unknown as T };
      }

      // If already retried once and still failing, DO NOT RELOAD AGAIN.
      // Throw the error so the Error Boundary displays a graceful recovery screen.
      throw error;
    }
  });
}
