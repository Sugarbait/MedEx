import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Settings } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackComponent?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Error Boundary specifically designed to handle API key management errors
 * Provides user-friendly fallback UI when schema issues or other errors occur
 */
export class ApiKeyErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ApiKeyErrorBoundary caught an error:', error, errorInfo)

    // Log specific database schema errors
    if (error.message?.includes('encrypted_agent_config') ||
        error.message?.includes('column') ||
        error.message?.includes('schema')) {
      console.log('Database schema error detected in API key management')
    }

    this.setState({
      error,
      errorInfo
    })
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback component if provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent
      }

      // Determine if this is a schema-related error
      const isSchemaError = this.state.error?.message?.includes('encrypted_agent_config') ||
                           this.state.error?.message?.includes('column') ||
                           this.state.error?.message?.includes('schema')

      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                API Key Management
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Configure your API credentials for call and SMS services
              </p>
            </div>
          </div>

          {/* Error Display */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-start gap-3 mb-6">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                {isSchemaError ? 'Database Schema Issue' : 'Configuration Error'}
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                {isSchemaError ? (
                  <>
                    The database schema is missing required columns for API key storage.
                    The system will automatically use a fallback method to ensure your
                    API keys are still saved and accessible.
                  </>
                ) : (
                  <>
                    An error occurred while loading the API key management interface.
                    Please try refreshing or contact support if the issue persists.
                  </>
                )}
              </p>

              {/* Technical details (collapsed by default) */}
              <details className="text-xs text-red-600 dark:text-red-400 mt-2">
                <summary className="cursor-pointer hover:text-red-800 dark:hover:text-red-200">
                  Technical Details
                </summary>
                <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded font-mono whitespace-pre-wrap">
                  {this.state.error?.message}
                </div>
              </details>
            </div>
          </div>

          {/* Recovery Actions */}
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                What happens next?
              </h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                {isSchemaError ? (
                  <>
                    <li>• Your API keys will be stored using a secure fallback method</li>
                    <li>• All functionality will continue to work normally</li>
                    <li>• Contact your administrator to update the database schema</li>
                    <li>• Performance may be slightly reduced until the schema is updated</li>
                  </>
                ) : (
                  <>
                    <li>• Try refreshing the component using the button below</li>
                    <li>• Check your network connection</li>
                    <li>• Contact support if the issue persists</li>
                  </>
                )}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>

              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Refresh Page
              </button>
            </div>

            {isSchemaError && (
              <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>For Administrators:</strong> Run the following SQL to fix the schema:
                </p>
                <code className="block mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-xs font-mono">
                  ALTER TABLE user_profiles ADD COLUMN encrypted_agent_config JSONB;
                </code>
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * HOC wrapper for easy use with functional components
 */
export const withApiKeyErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallbackComponent?: ReactNode
) => {
  return (props: P) => (
    <ApiKeyErrorBoundary fallbackComponent={fallbackComponent}>
      <Component {...props} />
    </ApiKeyErrorBoundary>
  )
}