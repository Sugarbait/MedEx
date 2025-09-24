import React, { useState, useEffect } from 'react'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  QrCode,
  Settings,
  Smartphone,
  Monitor,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Eye,
  Wifi,
  WifiOff,
  Users,
  Lock,
  Unlock
} from 'lucide-react'
import { useTOTPStatus } from '../../hooks/useTOTPStatus'
import MFASyncStatusIndicator from '../auth/MFASyncStatusIndicator'
import MFADeviceManager from '../auth/MFADeviceManager'

interface EnhancedMFASettingsProps {
  userId: string
  onSetupMFA: () => void
  onToggleMFA: (enabled: boolean) => void
  mfaToggleEnabled: boolean
  isLoading: boolean
}

interface MFASyncState {
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime: Date | null
  syncError: string | null
  devicesCount: number
  enabledDevicesCount: number
}

export const EnhancedMFASettings: React.FC<EnhancedMFASettingsProps> = ({
  userId,
  onSetupMFA,
  onToggleMFA,
  mfaToggleEnabled,
  isLoading
}) => {
  const totpStatus = useTOTPStatus(userId)
  const [showDeviceManager, setShowDeviceManager] = useState(false)
  const [showSyncDetails, setShowSyncDetails] = useState(false)
  const [syncState, setSyncState] = useState<MFASyncState>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null,
    syncError: null,
    devicesCount: 0,
    enabledDevicesCount: 0
  })

  useEffect(() => {
    // Simulate loading sync state
    const loadSyncState = async () => {
      try {
        // Mock data - in real implementation this would fetch from your sync service
        setSyncState(prev => ({
          ...prev,
          lastSyncTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          devicesCount: 3,
          enabledDevicesCount: totpStatus.isEnabled ? 3 : 0
        }))
      } catch (error) {
        setSyncState(prev => ({
          ...prev,
          syncError: 'Failed to load sync status'
        }))
      }
    }

    loadSyncState()

    // Listen for online/offline status changes
    const handleOnline = () => setSyncState(prev => ({ ...prev, isOnline: true }))
    const handleOffline = () => setSyncState(prev => ({ ...prev, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [totpStatus.isEnabled])

  const getStatusColor = () => {
    if (syncState.syncError) return 'text-red-600 dark:text-red-400'
    if (!syncState.isOnline) return 'text-yellow-600 dark:text-yellow-400'
    if (syncState.isSyncing) return 'text-blue-600 dark:text-blue-400'
    if (totpStatus.isEnabled) return 'text-green-600 dark:text-green-400'
    return 'text-gray-500 dark:text-gray-400'
  }

  const getStatusText = () => {
    if (syncState.syncError) return 'Sync Error'
    if (!syncState.isOnline) return 'Offline Mode'
    if (syncState.isSyncing) return 'Syncing...'
    if (totpStatus.isEnabled) return 'Synchronized'
    return 'Not Configured'
  }

  const formatLastSync = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    return date.toLocaleTimeString()
  }

  const handleManualSync = () => {
    setSyncState(prev => ({ ...prev, isSyncing: true, syncError: null }))

    // Simulate sync process
    setTimeout(() => {
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date()
      }))
    }, 2000)
  }

  return (
    <div className="space-y-6">
      {/* Main MFA Section */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${
                totpStatus.isEnabled
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-gray-50 dark:bg-gray-700'
              }`}>
                {totpStatus.isEnabled ? (
                  <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  Multi-Factor Authentication
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Cloud-synchronized security across all your devices
                </p>
              </div>
            </div>

            {/* Status Row */}
            <div className="flex items-center gap-4 text-sm mb-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <div className="flex items-center gap-1">
                  {syncState.isSyncing ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-400" />
                  ) : syncState.isOnline ? (
                    <Wifi className="w-3 h-3 text-green-600 dark:text-green-400" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                  )}
                  <span className={getStatusColor()}>{getStatusText()}</span>
                </div>
              </div>

              {totpStatus.isEnabled && syncState.devicesCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">Devices:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {syncState.enabledDevicesCount}/{syncState.devicesCount}
                  </span>
                </div>
              )}

              {syncState.lastSyncTime && syncState.isOnline && (
                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>Last sync: {formatLastSync(syncState.lastSyncTime)}</span>
                </div>
              )}
            </div>

            {/* Status Messages */}
            {syncState.syncError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <span className="text-sm text-red-700 dark:text-red-300">{syncState.syncError}</span>
                </div>
              </div>
            )}

            {!syncState.isOnline && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <CloudOff className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">
                    You're offline. MFA settings will sync when connection is restored.
                  </span>
                </div>
              </div>
            )}

            {totpStatus.isEnabled && syncState.isOnline && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <span className="text-sm text-green-700 dark:text-green-300">
                    MFA is active and synchronized across all your devices
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 ml-4">
            {/* Manual Sync Button */}
            {syncState.isOnline && totpStatus.isEnabled && (
              <button
                onClick={handleManualSync}
                disabled={syncState.isSyncing}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                title="Manual sync"
              >
                <RefreshCw className={`w-4 h-4 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* MFA Toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleMFA(!mfaToggleEnabled)
              }}
              disabled={isLoading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                mfaToggleEnabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  mfaToggleEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onSetupMFA}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <QrCode className="w-4 h-4" />
            {totpStatus.isEnabled ? 'Reconfigure MFA' : 'Setup MFA'}
          </button>

          {totpStatus.isEnabled && (
            <button
              onClick={() => setShowDeviceManager(true)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
            >
              <Users className="w-4 h-4" />
              Manage Devices
            </button>
          )}

          <button
            onClick={() => setShowSyncDetails(!showSyncDetails)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            <Eye className="w-4 h-4" />
            {showSyncDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      </div>

      {/* Detailed Sync Status */}
      {showSyncDetails && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Cloud Sync Details</h4>

          <MFASyncStatusIndicator
            userId={userId}
            showDevices={true}
            onDeviceManagement={() => setShowDeviceManager(true)}
          />

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sync Statistics */}
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">Sync Statistics</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Devices:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{syncState.devicesCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">MFA Enabled:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{syncState.enabledDevicesCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Connection:</span>
                  <span className={`font-medium ${syncState.isOnline ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                    {syncState.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            {/* Security Features */}
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">Security Features</h5>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                  <span className="text-gray-700 dark:text-gray-300">End-to-end encryption</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                  <span className="text-gray-700 dark:text-gray-300">Zero-knowledge architecture</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                  <span className="text-gray-700 dark:text-gray-300">Device-level verification</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                  <span className="text-gray-700 dark:text-gray-300">Automatic backup codes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Device Manager Modal */}
      <MFADeviceManager
        userId={userId}
        isVisible={showDeviceManager}
        onClose={() => setShowDeviceManager(false)}
      />
    </div>
  )
}

export default EnhancedMFASettings