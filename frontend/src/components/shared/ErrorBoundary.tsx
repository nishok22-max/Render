import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ThinkSync] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', background: '#0a0a0f',
          color: '#fff', fontFamily: 'system-ui, sans-serif', padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem',
            marginBottom: '1.5rem', maxWidth: '400px',
          }}>
            ThinkSync encountered an unexpected error. Your data is safe.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/';
            }}
            style={{
              padding: '0.75rem 2rem', background: '#fff', color: '#0a0a0f',
              border: 'none', cursor: 'pointer', fontWeight: 600,
              fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase',
            }}
          >
            Return to Dashboard
          </button>
          {this.state.error && (
            <details style={{
              marginTop: '2rem', color: 'rgba(255,255,255,0.3)',
              fontSize: '0.75rem', maxWidth: '600px', textAlign: 'left',
            }}>
              <summary style={{ cursor: 'pointer' }}>Technical Details</summary>
              <pre style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
