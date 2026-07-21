import { Component } from 'react'

/**
 * ErrorBoundary — catches unhandled React render errors so the whole
 * app doesn't go blank. Shows a friendly recovery screen instead.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Unhandled render error:', error.message, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(150deg,#0b2318 0%,#1B4332 100%)' }}>
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">⛳</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-500 mb-6">
            An unexpected error occurred. Please refresh the page to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl font-bold text-white text-sm"
            style={{ background: '#1B4332' }}
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }
}
