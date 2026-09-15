import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('RakshaMap UI error:', error, info)
  }

  reload = () => window.location.reload()

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="app-error-screen">
        <div className="app-error-card">
          <div className="app-error-mark">!</div>
          <span className="eyebrow">RAKSHAMAP STARTUP ERROR</span>
          <h1>The dashboard could not finish loading.</h1>
          <p>
            The application caught a startup error instead of leaving the page blank. Check the browser console for the full stack trace.
          </p>
          <code>{this.state.message || 'Unknown application error'}</code>
          <div className="app-error-actions">
            <button className="primary-button" onClick={this.reload}>Reload application</button>
            <button className="outline-button" onClick={() => console.log('Startup error:', this.state.message)}>
              Log error
            </button>
          </div>
        </div>
      </div>
    )
  }
}
