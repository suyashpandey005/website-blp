import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string | null }) {
    console.error('UNCAUGHT APP ERROR:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="setup-screen">
          <div>
            <span className="brand-mark">BLP</span>
            <h1>Something went wrong</h1>
            <p>The app hit an unexpected error and couldn&apos;t continue. Your data is safe — nothing was saved from this broken state.</p>
            <div className="auth-error">{this.state.error.message || 'Unknown error.'}</div>
            <button
              className="button primary"
              style={{ marginTop: 16 }}
              onClick={() => window.location.reload()}
            >
              Reload BLP COMMAND
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
