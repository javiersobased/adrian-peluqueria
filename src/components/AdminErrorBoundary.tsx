import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onGoPublic?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AdminErrorBoundary] Caught unhandled error:', error, errorInfo);
  }

  handleHardRefresh = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem('admin_sidebar_collapsed');
      localStorage.removeItem('admin_active_tab');
    } catch {}
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onGoPublic) {
      this.props.onGoPublic();
    } else {
      window.location.hash = '';
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h2 className="font-display text-xl font-bold text-white mb-2">
              Panel de Administración
            </h2>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              Se ha detectado un problema al cargar los componentes del panel. Esto suele ocurrir tras actualizarse la aplicación con una nueva versión.
            </p>

            {this.state.error?.message && (
              <div className="mb-6 rounded-xl bg-black/40 border border-white/5 p-3 text-left">
                <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1">
                  Detalle del error
                </p>
                <p className="text-xs font-mono text-red-300 break-words line-clamp-3">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={this.handleHardRefresh}
                className="flex w-full items-center justify-center gap-2 rounded-xl gold-gradient py-2.5 text-xs font-bold text-black transition-all hover:brightness-110 active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Limpiar caché y reintentar</span>
              </button>

              <button
                onClick={this.handleReset}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 py-2.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Volver a la web principal</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
