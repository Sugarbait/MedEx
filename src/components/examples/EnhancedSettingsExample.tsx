import React, { useState, useEffect } from 'react'
import {
  Settings,
  User,
  Key,
  Activity,
  Shield,
  CheckCircle,
  AlertTriangle,
  Info,
  Code,
  Book
} from 'lucide-react'
import { EnhancedErrorBoundary } from '@/components/common/EnhancedErrorBoundary'
import { EnhancedProfileSettings } from '@/components/settings/EnhancedProfileSettings'
import { EnhancedApiKeyManager } from '@/components/settings/EnhancedApiKeyManager'
import { SyncStatusPanel } from '@/components/settings/SyncStatusPanel'
import EnhancedSettingsPage from '@/pages/EnhancedSettingsPage'

/**
 * Example component demonstrating the enhanced frontend components
 * for profile information and Retell AI integration
 */
export const EnhancedSettingsExample: React.FC = () => {
  const [demoUser, setDemoUser] = useState({
    id: 'demo-user-123',
    email: 'demo@example.com',
    name: 'Demo User',
    role: 'healthcare_provider',
    avatar: undefined
  })

  const [showFullPage, setShowFullPage] = useState(false)
  const [activeDemo, setActiveDemo] = useState<'profile' | 'api-keys' | 'sync-status' | 'full-page'>('profile')

  useEffect(() => {
    // Simulate loading user data
    console.log('Enhanced Settings Example initialized with demo user:', demoUser)
  }, [demoUser])

  const renderDemoComponent = () => {
    switch (activeDemo) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Enhanced Profile Settings Demo</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                    This component now includes proper department field handling, enhanced error boundaries,
                    and improved validation with better user feedback.
                  </p>
                </div>
              </div>
            </div>
            <EnhancedErrorBoundary context="Profile Settings Demo">
              <EnhancedProfileSettings user={demoUser} />
            </EnhancedErrorBoundary>
          </div>
        )

      case 'api-keys':
        return (
          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900 dark:text-green-100">Enhanced API Key Manager Demo</h4>
                  <div className="text-sm text-green-800 dark:text-green-200 mt-1 space-y-1">
                    <p>Key improvements in this component:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Removed incorrect "agent_" prefix validation requirements</li>
                      <li>Added proper phone number support with E.164 format validation</li>
                      <li>Enhanced user feedback showing storage method (optimal vs fallback)</li>
                      <li>Added test connection functionality for API validation</li>
                      <li>Improved error messages specific to Retell AI integration</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <EnhancedErrorBoundary context="API Key Manager Demo">
              <EnhancedApiKeyManager user={demoUser} />
            </EnhancedErrorBoundary>
          </div>
        )

      case 'sync-status':
        return (
          <div className="space-y-6">
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-purple-900 dark:text-purple-100">Sync Status Panel Demo</h4>
                  <p className="text-sm text-purple-800 dark:text-purple-200 mt-1">
                    This new component provides real-time monitoring of cross-device sync health,
                    displays which storage method is being used, and offers manual sync controls.
                  </p>
                </div>
              </div>
            </div>
            <EnhancedErrorBoundary context="Sync Status Panel Demo">
              <SyncStatusPanel user={demoUser} />
            </EnhancedErrorBoundary>
          </div>
        )

      case 'full-page':
        return (
          <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
            <EnhancedSettingsPage user={demoUser} />
          </div>
        )

      default:
        return null
    }
  }

  if (showFullPage) {
    return (
      <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 z-50 overflow-auto">
        <div className="p-4">
          <button
            onClick={() => setShowFullPage(false)}
            className="mb-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Demo
          </button>
          <EnhancedSettingsPage user={demoUser} />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <Settings className="w-8 h-8 text-blue-600" />
          Enhanced Frontend Components Demo
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Demonstration of enhanced profile information and Retell AI integration components
        </p>
      </div>

      {/* Navigation */}
      <div className="mb-8">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8">
            {[
              { id: 'profile', name: 'Profile Settings', icon: User },
              { id: 'api-keys', name: 'API Key Manager', icon: Key },
              { id: 'sync-status', name: 'Sync Status', icon: Activity }
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeDemo === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveDemo(tab.id as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    isActive
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Demo Controls */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowFullPage(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            View Full Settings Page
          </button>

          <button
            onClick={() => setDemoUser(prev => ({
              ...prev,
              name: `${prev.name} (Updated ${new Date().getSeconds()})`,
              role: prev.role === 'admin' ? 'healthcare_provider' : 'admin'
            }))}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Update Demo User
          </button>
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          User Role: <span className="font-medium capitalize">{demoUser.role.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {renderDemoComponent()}
      </div>

      {/* Technical Documentation */}
      <div className="mt-12 space-y-6">
        <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
            <Book className="w-6 h-6 text-blue-600" />
            Implementation Details
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profile Enhancement Details */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                <User className="w-5 h-5 text-green-600" />
                Profile Enhancements
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p><strong>Department Field:</strong> Added proper handling for the department column with validation</p>
                <p><strong>Error Boundaries:</strong> Wrapped with enhanced error boundaries for better error handling</p>
                <p><strong>Fallback Handling:</strong> Graceful degradation when profile data fails to save</p>
                <p><strong>Validation:</strong> Enhanced form validation with better error messages</p>
              </div>
            </div>

            {/* API Key Manager Details */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                <Key className="w-5 h-5 text-blue-600" />
                API Key Manager Fixes
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p><strong>Validation Fix:</strong> Removed incorrect "agent_" prefix requirements</p>
                <p><strong>Phone Support:</strong> Added E.164 format validation with examples</p>
                <p><strong>Storage Method:</strong> Clear indication of which storage method is being used</p>
                <p><strong>Test Connection:</strong> Built-in API validation functionality</p>
              </div>
            </div>

            {/* Sync Status Details */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-purple-600" />
                Sync Status Features
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p><strong>Real-time Status:</strong> Live monitoring of network and database connection</p>
                <p><strong>Storage Method:</strong> Visual indication of optimal vs fallback storage</p>
                <p><strong>Manual Sync:</strong> User-controllable sync triggers for troubleshooting</p>
                <p><strong>Schema Status:</strong> Database feature availability monitoring</p>
              </div>
            </div>

            {/* Error Handling Details */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-red-600" />
                Error Handling
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p><strong>Error Boundaries:</strong> Comprehensive error catching and reporting</p>
                <p><strong>User-Friendly Messages:</strong> Clear error messages with actionable steps</p>
                <p><strong>Retry Logic:</strong> Built-in retry mechanisms with exponential backoff</p>
                <p><strong>Audit Logging:</strong> Automatic error logging for debugging</p>
              </div>
            </div>
          </div>
        </div>

        {/* Code Examples */}
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
            <Code className="w-5 h-5 text-blue-600" />
            Usage Examples
          </h3>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Enhanced Profile Settings</h4>
              <pre className="bg-gray-900 dark:bg-gray-700 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`import { EnhancedProfileSettings } from '@/components/settings/EnhancedProfileSettings'
import { EnhancedErrorBoundary } from '@/components/common/EnhancedErrorBoundary'

<EnhancedErrorBoundary context="Profile Settings">
  <EnhancedProfileSettings user={user} />
</EnhancedErrorBoundary>`}
              </pre>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">API Key Manager with Test Connection</h4>
              <pre className="bg-gray-900 dark:bg-gray-700 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`import { EnhancedApiKeyManager } from '@/components/settings/EnhancedApiKeyManager'

<EnhancedApiKeyManager
  user={user}
  // Component now automatically handles:
  // - No agent_ prefix validation
  // - E.164 phone number validation
  // - Storage method detection
  // - Connection testing
/>`}
              </pre>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Sync Status Monitoring</h4>
              <pre className="bg-gray-900 dark:bg-gray-700 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`import { SyncStatusPanel } from '@/components/settings/SyncStatusPanel'

<SyncStatusPanel
  user={user}
  // Shows real-time sync health and allows manual sync
/>`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}