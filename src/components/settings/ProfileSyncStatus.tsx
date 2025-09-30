import React, { useState, useEffect } from 'react'
import { RefreshCw, Cloud, HardDrive, CheckCircle, AlertTriangle } from 'lucide-react'
import { robustProfileSyncService } from '@/services/robustProfileSyncService'

interface ProfileSyncStatusProps {
  userId: string
  onForceSync?: () => void
}

export const ProfileSyncStatus: React.FC<ProfileSyncStatusProps> = ({ userId, onForceSync }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState(() => robustProfileSyncService.getSyncStatus())
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null)

  useEffect(() => {
    // Update sync status every 30 seconds
    const interval = setInterval(() => {
      setSyncStatus(robustProfileSyncService.getSyncStatus())
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const handleForceSync = async () => {
    setIsLoading(true)
    setLastSyncMessage(null)

    try {
      const result = await robustProfileSyncService.forceSyncFromCloud(userId)

      if (result.status === 'success') {
        setLastSyncMessage('✅ Profile synced from cloud successfully!')
        robustProfileSyncService.updateLastSyncTime()
        setSyncStatus(robustProfileSyncService.getSyncStatus())
        onForceSync?.()
      } else {
        setLastSyncMessage(`❌ Sync failed: ${result.error}`)
      }
    } catch (error: any) {
      setLastSyncMessage(`❌ Sync failed: ${error.message}`)
    } finally {
      setIsLoading(false)
      setTimeout(() => setLastSyncMessage(null), 5000)
    }
  }

  const handleRefreshStatus = () => {
    setSyncStatus(robustProfileSyncService.getSyncStatus())
    setLastSyncMessage('🔄 Status refreshed')
    setTimeout(() => setLastSyncMessage(null), 2000)
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
      <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        Profile Sync Status
      </h3>

      {/* Sync Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {syncStatus.cloudAvailable ? (
              <Cloud className="w-4 h-4 text-green-600" />
            ) : (
              <HardDrive className="w-4 h-4 text-gray-600" />
            )}
            <span className="font-medium text-blue-800 dark:text-blue-200">Cloud:</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              syncStatus.cloudAvailable ? 'bg-green-500' : 'bg-gray-500'
            }`} />
            <span className="text-blue-700 dark:text-blue-300">
              {syncStatus.cloudAvailable ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>

        <div>
          <span className="font-medium text-blue-800 dark:text-blue-200">Mode:</span>
          <p className="text-blue-700 dark:text-blue-300 mt-1 flex items-center gap-2">
            {syncStatus.localStorageMode ? (
              <>
                <HardDrive className="w-3 h-3" />
                Local Only
              </>
            ) : (
              <>
                <Cloud className="w-3 h-3" />
                Cloud Sync
              </>
            )}
          </p>
        </div>

        <div>
          <span className="font-medium text-blue-800 dark:text-blue-200">Last Sync:</span>
          <p className="text-blue-700 dark:text-blue-300 mt-1">
            {syncStatus.lastSync
              ? new Date(syncStatus.lastSync).toLocaleString()
              : 'Never'
            }
          </p>
        </div>
      </div>

      {/* Status Message */}
      {lastSyncMessage && (
        <div className="mb-4 p-3 rounded-lg bg-blue-100 dark:bg-blue-800/30 border border-blue-200 dark:border-blue-600">
          <p className="text-sm text-blue-800 dark:text-blue-200">{lastSyncMessage}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={handleForceSync}
            disabled={isLoading || !syncStatus.cloudAvailable}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4" />
            )}
            {isLoading ? 'Syncing...' : 'Force Cloud Sync'}
          </button>

          <button
            onClick={handleRefreshStatus}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-blue-600 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
          {syncStatus.cloudAvailable ? (
            <>
              <CheckCircle className="w-3 h-3 text-green-500" />
              Online
            </>
          ) : (
            <>
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              Offline
            </>
          )}
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-600">
        <p className="text-xs text-blue-600 dark:text-blue-400">
          {syncStatus.cloudAvailable
            ? '✅ Your profile changes are automatically saved to the cloud and synced across devices.'
            : '⚠️ Cloud sync is unavailable. Profile changes are saved locally and will sync when connection is restored.'
          }
        </p>
      </div>
    </div>
  )
}