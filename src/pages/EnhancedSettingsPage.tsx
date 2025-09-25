import React, { useState, useEffect } from 'react'
import {
  Settings,
  User,
  Key,
  Activity,
  Shield,
  Users,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react'
import { EnhancedErrorBoundary, withErrorBoundary } from '@/components/common/EnhancedErrorBoundary'
import { EnhancedProfileSettings } from '@/components/settings/EnhancedProfileSettings'
import { EnhancedApiKeyManager } from '@/components/settings/EnhancedApiKeyManager'
import { SyncStatusPanel } from '@/components/settings/SyncStatusPanel'
import { FreshMfaSettings } from '@/components/settings/FreshMfaSettings'
import { EnhancedUserManager } from '@/components/settings/EnhancedUserManager'

interface EnhancedSettingsPageProps {
  user: {
    id: string
    email: string
    name?: string
    role?: string
    avatar?: string
  }
}

type SettingsTab = 'profile' | 'api-keys' | 'sync-status' | 'security' | 'user-management'

const EnhancedSettingsPage: React.FC<EnhancedSettingsPageProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [systemStatus, setSystemStatus] = useState({
    isOnline: navigator.onLine,
    hasErrors: false,
    lastCheck: new Date()
  })

  useEffect(() => {
    const handleOnline = () => setSystemStatus(prev => ({ ...prev, isOnline: true }))
    const handleOffline = () => setSystemStatus(prev => ({ ...prev, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const tabs = [
    {
      id: 'profile' as SettingsTab,
      name: 'Profile',
      icon: User,
      description: 'Personal information and profile settings'
    },
    {
      id: 'api-keys' as SettingsTab,
      name: 'API Configuration',
      icon: Key,
      description: 'Retell AI API keys and integration settings'
    },
    {
      id: 'sync-status' as SettingsTab,
      name: 'Sync Status',
      icon: Activity,
      description: 'Cross-device synchronization monitoring'
    },
    {
      id: 'security' as SettingsTab,
      name: 'Security',
      icon: Shield,
      description: 'Multi-factor authentication and security settings'
    }
  ]

  // Add user management tab for admin users
  if (user.role === 'admin' || user.role === 'super_user') {
    tabs.push({
      id: 'user-management' as SettingsTab,
      name: 'User Management',
      icon: Users,
      description: 'Manage system users and permissions'
    })
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <EnhancedErrorBoundary context="Profile Settings">
            <EnhancedProfileSettings user={user} />
          </EnhancedErrorBoundary>
        )

      case 'api-keys':
        return (
          <EnhancedErrorBoundary context="API Key Manager">
            <EnhancedApiKeyManager user={user} />
          </EnhancedErrorBoundary>
        )

      case 'sync-status':
        return (
          <EnhancedErrorBoundary context="Sync Status Panel">
            <SyncStatusPanel user={user} />
          </EnhancedErrorBoundary>
        )

      case 'security':
        return (
          <EnhancedErrorBoundary context="Security Settings">
            <FreshMfaSettings />
          </EnhancedErrorBoundary>
        )

      case 'user-management':
        return (
          <EnhancedErrorBoundary context="User Management">
            <EnhancedUserManager />
          </EnhancedErrorBoundary>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                <Settings className="w-8 h-8 text-blue-600" />
                Settings
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage your account, API configurations, and system preferences
              </p>
            </div>

            {/* System Status Indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${systemStatus.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {systemStatus.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* System Status Banner */}
        {!systemStatus.isOnline && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-900 dark:text-amber-100">Limited Functionality</h4>
                <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                  You're currently offline. Some features may not be available, but your settings will be saved locally and synchronized when connection is restored.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sticky top-8">
              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors flex items-start gap-3 ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                      }`} />
                      <div className="flex-1">
                        <div className={`font-medium ${isActive ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'}`}>
                          {tab.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {tab.description}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </nav>

              {/* Quick Info Panel */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">Quick Info</span>
                  </div>
                  <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>User ID:</span>
                      <span className="font-mono">{user.id.slice(-8)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Role:</span>
                      <span className="capitalize">{user.role || 'User'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span>Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="space-y-6">
              {renderTabContent()}
            </div>
          </div>
        </div>

        {/* Footer Information */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Enhanced Settings Features</h4>
                <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                  <p>This enhanced settings page includes:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Improved profile management with department field support</li>
                    <li>Updated Retell AI validation (no agent_ prefix required)</li>
                    <li>Phone number support in E.164 format with validation</li>
                    <li>Real-time sync status monitoring and manual sync controls</li>
                    <li>Enhanced error boundaries with detailed error reporting</li>
                    <li>Comprehensive storage method detection and fallback handling</li>
                    <li>Cross-device synchronization status and health monitoring</li>
                  </ul>
                  <p className="pt-2">All changes are automatically saved and synchronized across your devices when online.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(EnhancedSettingsPage, {
  context: 'Enhanced Settings Page',
  showDetails: true
})