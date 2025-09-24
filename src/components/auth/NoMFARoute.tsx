import React from 'react'

interface NoMFARouteProps {
  user: any
  children: React.ReactNode
  requiresMFA?: boolean
}

/**
 * TEMPORARY: Route that bypasses ALL MFA checks
 * This allows access without any MFA verification
 */
const NoMFARoute: React.FC<NoMFARouteProps> = ({ user, children, requiresMFA = false }) => {
  // Always allow access - no MFA enforcement
  console.warn('🔓 NO-MFA ROUTE: Allowing access without any MFA checks')

  if (!user?.id) {
    console.log('No user ID found, denying access')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-4">Please log in to access this page.</p>
            <button
              onClick={() => window.location.href = '/'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Always render children - no MFA blocking
  return <>{children}</>
}

export { NoMFARoute }