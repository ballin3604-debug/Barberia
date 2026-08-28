import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Si ocurre un error de ejecución, muestra un mensaje legible en pantalla
 * en lugar de una pantalla en negro silenciosa.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Registra el error en la consola del navegador para diagnóstico.
    console.error('[Barberia] Error de ejecución:', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F8FAFC',
            padding: '2rem',
            fontFamily: 'Plus Jakarta Sans, -apple-system, sans-serif',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: 480 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: '#FEF2F2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                margin: '0 auto',
              }}
            >
              ⚠️
            </div>
            <h1
              style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginTop: '1rem' }}
            >
              Ocurrió un error al cargar la aplicación
            </h1>
            <p style={{ fontSize: '.875rem', color: '#6B7280', marginTop: '.5rem' }}>
              Podés recargar la página. Si el problema continúa, abrí la consola del navegador (F12
              → pestaña Console) y revisá el mensaje de error.
            </p>
            <pre
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                padding: '1rem',
                borderRadius: '.5rem',
                fontSize: '.75rem',
                marginTop: '1rem',
                overflow: 'auto',
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
              }}
            >
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: '1rem',
                padding: '.5rem 1.25rem',
                background: '#111827',
                color: '#fff',
                border: 'none',
                borderRadius: '.5rem',
                fontSize: '.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
