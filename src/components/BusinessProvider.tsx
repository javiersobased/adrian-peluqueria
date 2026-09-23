import { useEffect, useState, type ReactNode } from 'react';
import { BusinessContext } from '@/context/BusinessContext';
import { fetchBusinessByHost, LEGACY_BUSINESS, lookupHostFor, type BusinessPublicConfig } from '@/lib/business';
import { SAAS_MODE_ENABLED } from '@/lib/featureFlags';

type State =
  | { status: 'loading' }
  | { status: 'ready'; business: BusinessPublicConfig }
  | { status: 'not-found' }
  | { status: 'error' };

// Con el flag SaaS apagado se pinta al instante el tenant heredado y la configuración remota solo
// se acepta si es la suya. Con el flag encendido no hay fallback: dominio desconocido = "no encontrado".
export function BusinessProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() =>
    SAAS_MODE_ENABLED ? { status: 'loading' } : { status: 'ready', business: LEGACY_BUSINESS },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchBusinessByHost(lookupHostFor(window.location.hostname))
      .then((business) => {
        if (cancelled) return;
        if (SAAS_MODE_ENABLED) {
          setState(business ? { status: 'ready', business } : { status: 'not-found' });
        } else if (business?.id === LEGACY_BUSINESS.id) {
          setState({ status: 'ready', business });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[BusinessProvider] No se pudo resolver el negocio:', err);
        if (SAAS_MODE_ENABLED) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const business = state.status === 'ready' ? state.business : null;

  useEffect(() => {
    const root = document.documentElement;
    if (business) {
      root.dataset.business = business.slug;
      root.dataset.layout = business.layoutKey;
    } else {
      delete root.dataset.business;
      delete root.dataset.layout;
    }
  }, [business]);

  if (business) {
    return <BusinessContext.Provider value={business}>{children}</BusinessContext.Provider>;
  }

  if (state.status === 'loading') {
    return <StatusScreen title="Cargando…" />;
  }

  if (state.status === 'not-found') {
    return (
      <StatusScreen
        title="Sitio no disponible"
        message="Este dominio no está asociado a ningún negocio activo."
      />
    );
  }

  return (
    <StatusScreen
      title="No se pudo cargar el sitio"
      message="Comprueba tu conexión e inténtalo de nuevo."
      action={{ label: 'Reintentar', onClick: () => { setState({ status: 'loading' }); setAttempt((n) => n + 1); } }}
    />
  );
}

function StatusScreen({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-950 px-4 text-center text-neutral-200"
    >
      <h1 className="text-lg font-semibold">{title}</h1>
      {message && <p className="max-w-sm text-sm text-neutral-400">{message}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 rounded-lg border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          {action.label}
        </button>
      )}
    </main>
  );
}
