import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

/**
 * ErrorBoundary — Capture les erreurs React non gérées et affiche un fallback.
 *
 * Sans cela, une erreur dans un composant enfant = écran blanc (crash total).
 * Avec ErrorBoundary, on isole l'erreur et on permet à l'utilisateur de :
 *  - Recharger la page
 *  - Retourner à l'accueil (sans perdre la session)
 *  - Signaler le bug (avec details techniques pour le support)
 *
 * Architecture :
 *  - getDerivedStateFromError : met à jour le state pour afficher le fallback
 *  - componentDidCatch : logge l'erreur (console + future télémétrie)
 *  - Reset via key change (permet de remonter l'arbre sans recharger)
 *
 * Utilisation :
 *  <ErrorBoundary>
 *    <App />
 *  </ErrorBoundary>
 */

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  // Permet de reset l'ErrorBoundary depuis l'extérieur (ex: après navigation)
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Met à jour le state pour que le prochain rendu affiche le fallback
    return {
      hasError: true,
      error,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log l'erreur pour debug
    console.error('[ErrorBoundary] Erreur capturée:', error);
    console.error('[ErrorBoundary] Stack:', errorInfo.componentStack);

    // Callback optionnel (télémétrie, Sentry, etc.)
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({ errorInfo });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset automatique si resetKey change (ex: navigation)
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
      });
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    // Reset l'ErrorBoundary sans recharger la page
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
    // Redirige vers la racine (l'app gère l'auth)
    window.location.href = '/';
  };

  handleCopyError = (): void => {
    const { error, errorInfo, errorId } = this.state;
    if (!error) return;
    const errorReport = `
=== Rapport d'erreur OneDesk ===
ID: ${errorId}
Date: ${new Date().toISOString()}
Navigateur: ${navigator.userAgent}
URL: ${window.location.href}

Erreur: ${error.name}: ${error.message}

Stack:
${error.stack || 'N/A'}

Component Stack:
${errorInfo?.componentStack || 'N/A'}
`.trim();

    navigator.clipboard.writeText(errorReport).then(() => {
      // Feedback visuel (le bouton change de couleur brièvement)
      const btn = document.getElementById('error-copy-btn');
      if (btn) {
        btn.textContent = 'Copié !';
        setTimeout(() => {
          btn.textContent = 'Copier le rapport';
        }, 2000);
      }
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorId } = this.state;

      return (
        <div
          className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 shadow-clinical-lg">
            {/* Header */}
            <div className="bg-red-600 text-white p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 shrink-0" />
                <div>
                  <h1 className="text-base font-extrabold">
                    Erreur inattendue
                  </h1>
                  <p className="text-xs text-red-100 mt-0.5">
                    L'application a rencontré une erreur. Vos données sont préservées.
                  </p>
                </div>
              </div>
            </div>

            {/* Corps */}
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Message d'erreur
                </p>
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs font-mono text-red-900 dark:text-red-200 break-all">
                  {error?.name}: {error?.message}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Identifiant
                </p>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {errorId}
                </p>
              </div>

              {/* Stack (collapsible) */}
              {error?.stack && (
                <details className="group">
                  <summary className="cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Bug className="h-3.5 w-3.5" />
                    Détails techniques (pour le support)
                  </summary>
                  <pre className="mt-2 p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto max-h-48 overflow-y-auto">
                    {error.stack}
                  </pre>
                </details>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={this.handleReload}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition-all"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Recharger la page
                </button>
                <button
                  onClick={this.handleGoHome}
                  className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 text-xs font-bold transition-all"
                >
                  <Home className="h-3.5 w-3.5" />
                  Retour à l'accueil
                </button>
                <button
                  id="error-copy-btn"
                  onClick={this.handleCopyError}
                  className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 text-xs font-semibold transition-all"
                >
                  Copier le rapport
                </button>
              </div>

              {/* Note de sécurité */}
              <p className="text-[10px] text-slate-400 dark:text-slate-600 pt-3 border-t border-slate-100 dark:border-slate-800 leading-relaxed">
                🔒 Vos données cliniques sont préservées en local (IndexedDB).
                Cette erreur n'affecte que l'affichage. Si le problème persiste,
                contactez le support avec l'identifiant ci-dessus.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
