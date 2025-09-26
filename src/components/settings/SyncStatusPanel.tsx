import React, { useState, useEffect } from 'react'
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  Wifi,
  WifiOff,
  Database,
  HardDrive,
  Shield,
  Clock,
  Activity
} from 'lucide-react'
import { userSyncService } from '@/services/userSyncService'
import { apiKeyFallbackService } from '@/services/apiKeyFallbackService'
import { supabase } from '@/config/supabase'

interface SyncStatusPanelProps {
  user: {
    id: string
    email: string
    name?: string
  }
}

interface SyncStatus {
  isOnline: boolean
  supabaseConnected: boolean
  storageMethod: string
  lastSync: Date | null
  syncInProgress: boolean
  error: string | null
  schemaStatus: {
    hasAgentConfig: boolean
    hasRetellKey: boolean
    hasDepartmentField: boolean
  } | null
}

export const SyncStatusPanel: React.FC<SyncStatusPanelProps> = ({ user }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    supabaseConnected: false,
    storageMethod: 'unknown',
    lastSync: null,
    syncInProgress: false,
    error: null,
    schemaStatus: null
  })

  const [isChecking, setIsChecking] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    checkSyncStatus()

    // Listen for online/offline events
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }))
      checkSyncStatus()
    }
    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false, supabaseConnected: false }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check status periodically
    const interval = setInterval(checkSyncStatus, 30000) // Every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [user.id])

  const checkSyncStatus = async () => {
    try {
      setIsChecking(true)
      setSyncStatus(prev => ({ ...prev, error: null }))

      // Check Supabase connection
      let supabaseConnected = false
      try {
        const { error } = await supabase.from('users').select('id').limit(1)
        supabaseConnected = !error
      } catch (err) {
        supabaseConnected = false
      }

      // Check schema status
      let schemaStatus = null
      let storageMethod = 'localStorage_fallback'

      try {
        const testResult = await apiKeyFallbackService.testSchemaHandling(user.id)
        schemaStatus = testResult.schemaSupported
        storageMethod = testResult.fallbackMethod
      } catch (err) {
        console.warn('Could not check schema status:', err)
      }

      // Get last sync time
      let lastSync = null
      try {
        const lastSyncStr = localStorage.getItem('lastSuccessfulSync')
        if (lastSyncStr) {
          lastSync = new Date(lastSyncStr)
        }
      } catch (err) {
        console.warn('Could not get last sync time:', err)
      }

      setSyncStatus(prev => ({
        ...prev,
        supabaseConnected,
        storageMethod,
        lastSync,
        schemaStatus
      }))

    } catch (err: any) {
      setSyncStatus(prev => ({
        ...prev,
        error: err.message || 'Failed to check sync status'
      }))
    } finally {
      setIsChecking(false)
    }
  }

  const handleManualSync = async () => {
    setSyncStatus(prev => ({ ...prev, syncInProgress: true, error: null }))
    setSuccessMessage(null)

    try {
      // Trigger manual sync through user sync service
      const syncResult = await userSyncService.forceSyncUserData(user.id)

      if (syncResult.status === 'success') {
        setSuccessMessage('Manual sync completed successfully!')

        // Update last sync time
        localStorage.setItem('lastSuccessfulSync', new Date().toISOString())

        // Refresh status
        await checkSyncStatus()

        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        throw new Error(syncResult.error || 'Sync failed')
      }

    } catch (err: any) {
      setSyncStatus(prev => ({
        ...prev,
        error: err.message || 'Manual sync failed'
      }))
    } finally {
      setSyncStatus(prev => ({ ...prev, syncInProgress: false }))
    }
  }

  const getStorageMethodDisplay = (method: string) => {
    switch (method) {
      case 'user_profiles_full':
        return { label: 'Optimal (Primary Database)', icon: Database, color: 'text-green-600' }
      case 'user_profiles_partial_plus_user_settings':
        return { label: 'Good (Backup Method)', icon: Database, color: 'text-blue-600' }
      case 'user_settings_or_localStorage':
        return { label: 'Fallback (Schema Issues)', icon: AlertTriangle, color: 'text-amber-600' }
      case 'localStorage_fallback':
        return { label: 'Local Only (Offline)', icon: HardDrive, color: 'text-red-600' }
      default:
        return { label: 'Unknown', icon: AlertTriangle, color: 'text-gray-600' }
    }
  }

  const formatLastSync = (lastSync: Date | null) => {
    if (!lastSync) return 'Never'

    const now = new Date()
    const diffMs = now.getTime() - lastSync.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays < 7) return `${diffDays} days ago`
    return lastSync.toLocaleDateString()
  }

  const storageDisplay = getStorageMethodDisplay(syncStatus.storageMethod)
  const StorageIcon = storageDisplay.icon

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Sync Status
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Monitor cross-device synchronization and data storage
          </p>
        </div>
        <button
          onClick={checkSyncStatus}
          disabled={isChecking}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Refresh status"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 flex items-start gap-3 mb-6">
          <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
          <div className="flex-1">
            <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {syncStatus.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-start gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-200">{syncStatus.error}</p>
          </div>
          <button
            onClick={() => setSyncStatus(prev => ({ ...prev, error: null }))}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* Connection Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              {syncStatus.isOnline ? (
                <Wifi className="w-5 h-5 text-green-600" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-600" />
              )}
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-100">Network</span>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {syncStatus.isOnline ? 'Connected' : 'Offline'}
                </p>
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full ${syncStatus.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              {syncStatus.supabaseConnected ? (
                <Cloud className="w-5 h-5 text-green-600" />
              ) : (
                <CloudOff className="w-5 h-5 text-red-600" />
              )}
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-100">Database</span>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {syncStatus.supabaseConnected ? 'Connected' : 'Disconnected'}
                </p>
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full ${syncStatus.supabaseConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
        </div>

        {/* Storage Method - Only show if there are actual issues */}
        {syncStatus.storageMethod !== 'user_profiles_full' && syncStatus.storageMethod !== 'unknown' && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <StorageIcon className={`w-5 h-5 ${storageDisplay.color}`} />
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">Storage Method</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Current data storage approach</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${storageDisplay.color}`}>
                {storageDisplay.label}
              </span>
            </div>
          </div>
        )}

        {/* Schema Status */}
        {syncStatus.schemaStatus && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-5 h-5 text-blue-600" />
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-100">Database Schema</span>
                <p className="text-sm text-gray-600 dark:text-gray-400">Available database features</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${syncStatus.schemaStatus.hasAgentConfig ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-gray-900 dark:text-gray-100">Agent Config</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${syncStatus.schemaStatus.hasRetellKey ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-gray-900 dark:text-gray-100">Retell API Key</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${syncStatus.schemaStatus.hasDepartmentField ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-gray-900 dark:text-gray-100">Department Field</span>
              </div>
            </div>
          </div>
        )}

        {/* Last Sync */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-100">Last Sync</span>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatLastSync(syncStatus.lastSync)}
                </p>
              </div>
            </div>
            <button
              onClick={handleManualSync}
              disabled={syncStatus.syncInProgress || !syncStatus.isOnline}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {syncStatus.syncInProgress ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {syncStatus.syncInProgress ? 'Syncing...' : 'Manual Sync'}
            </button>
          </div>
        </div>

        {/* Info Panel */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Sync Information</h4>
              <div className="text-sm text-blue-800 dark:text-blue-200 mt-1 space-y-1">
                <p>• <strong>Optimal:</strong> All features available, data stored in primary database</p>
                <p>• <strong>Good:</strong> Most features available, using backup storage method</p>
                <p>• <strong>Fallback:</strong> Basic features, database schema needs updating</p>
                <p>• <strong>Local Only:</strong> Offline mode, data stored locally until connection restored</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}