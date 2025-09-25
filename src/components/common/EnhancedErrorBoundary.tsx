import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Bug, Home, Shield } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackComponent?: ReactNode
  showDetails?: boolean
  context?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
  isRetrying: boolean
}

export class EnhancedErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      isRetrying: false
    }
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate unique error ID for tracking
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId,
      isRetrying: false
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error('EnhancedErrorBoundary caught an error:', error, errorInfo)

    // Log to audit system if available
    try {
      if (typeof window !== 'undefined' && (window as any).auditLogger) {
        (window as any).auditLogger.logError({
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          context: this.props.context || 'Unknown',
          errorId: this.state.errorId,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }
    } catch (loggingError) {
      console.warn('Failed to log error to audit system:', loggingError)
    }

    this.setState({
      errorInfo
    })
  }

  handleRetry = async () => {
    this.setState({ isRetrying: true })

    // Wait a moment before retrying
    await new Promise(resolve => setTimeout(resolve, 1000))

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      isRetrying: false
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback component if provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent
      }

      const { error, errorInfo, errorId } = this.state
      const showDetails = this.props.showDetails !== false // Default to true
      const context = this.props.context || 'Application'

      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8">
              {/* Error Icon and Title */}
              <div className="text-center mb-8">
                <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Something went wrong
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  An unexpected error occurred in the {context.toLowerCase()} component.
                </p>
              </div>

              {/* Error Details */}
              {showDetails && error && (
                <div className="mb-8">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Bug className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">Error Details</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Message: </span>
                        <span className="text-red-600 dark:text-red-400">{error.message}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Error ID: </span>
                        <span className="font-mono text-gray-600 dark:text-gray-400">{errorId}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Context: </span>
                        <span className="text-gray-600 dark:text-gray-400">{context}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stack Trace */}
                  {error.stack && (
                    <details className="mb-4">
                      <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        View Stack Trace
                      </summary>
                      <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-xs text-gray-300 dark:text-gray-400 whitespace-pre-wrap">
                          {error.stack}
                        </pre>
                      </div>
                    </details>
                  )}

                  {/* Component Stack */}
                  {errorInfo?.componentStack && (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        View Component Stack
                      </summary>
                      <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-xs text-gray-300 dark:text-gray-400 whitespace-pre-wrap">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={this.handleRetry}
                  disabled={this.state.isRetrying}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {this.state.isRetrying ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {this.state.isRetrying ? 'Retrying...' : 'Try Again'}
                </button>

                <button
                  onClick={this.handleReload}
                  className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reload Page
                </button>

                <button
                  onClick={this.handleGoHome}
                  className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </button>
              </div>

              {/* Help Information */}
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">What happened?</h4>
                      <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                        <p>The application encountered an unexpected error and couldn't continue. This has been automatically logged for investigation.</p>
                        <p>Your data is safe and secure. You can try the following:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Click "Try Again" to retry the operation</li>
                          <li>Reload the page to refresh the application</li>
                          <li>Go back to the home page and try a different action</li>
                          <li>Clear your browser cache if the problem persists</li>
                        </ul>
                        <p>If you continue experiencing issues, please contact support and provide the Error ID above.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// HOC wrapper for easier usage
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryConfig?: Omit<Props, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <EnhancedErrorBoundary {...errorBoundaryConfig}>
      <Component {...props} />
    </EnhancedErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  return WrappedComponent
}

// Hook for programmatic error reporting
export const useErrorReporting = () => {
  const reportError = (error: Error, context?: string, additionalInfo?: any) => {
    console.error('Manual error report:', error, { context, additionalInfo })

    try {
      if (typeof window !== 'undefined' && (window as any).auditLogger) {
        (window as any).auditLogger.logError({
          error: error.message,
          stack: error.stack,
          context: context || 'Manual Report',
          additionalInfo,
          errorId: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }
    } catch (loggingError) {
      console.warn('Failed to log error to audit system:', loggingError)
    }
  }

  return { reportError }
}