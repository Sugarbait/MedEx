import React, { useState, useEffect } from 'react'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Monitor,
  Tablet,
  Wifi,
  WifiOff,
  RotateCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  Cloud,
  CloudOff
} from 'lucide-react'

interface Device {
  id: string
  name: string
  type: 'desktop' | 'mobile' | 'tablet'
  lastSeen: Date
  mfaEnabled: boolean
  isCurrent: boolean
}

interface MFASyncStatus {
  isEnabled: boolean
  isSyncing: boolean
  isOnline: boolean
  lastSyncTime: Date | null
  syncError: string | null
  devices: Device[]
  totalDevices: number
  enabledDevices: number
}

interface MFASyncStatusIndicatorProps {
  userId: string
  compact?: boolean
  showDevices?: boolean
  onDeviceManagement?: () => void
}

export const MFASyncStatusIndicator: React.FC<MFASyncStatusIndicatorProps> = ({
  userId,
  compact = false,
  showDevices = false,
  onDeviceManagement
}) => {
  const [syncStatus, setSyncStatus] = useState<MFASyncStatus>({
    isEnabled: false,
    isSyncing: false,
    isOnline: navigator.onLine,
    lastSyncTime: null,
    syncError: null,
    devices: [],
    totalDevices: 0,
    enabledDevices: 0
  })

  useEffect(() => {
    // Simulate loading MFA sync status
    const loadSyncStatus = async () => {
      try {
        // Mock data for demonstration - in real implementation this would fetch from your MFA service
        const mockDevices: Device[] = [
          {
            id: 'current-device',
            name: 'Windows PC (Current)',
            type: 'desktop',
            lastSeen: new Date(),
            mfaEnabled: true,
            isCurrent: true
          },
          {
            id: 'iphone-device',
            name: 'iPhone 15',
            type: 'mobile',
            lastSeen: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
            mfaEnabled: true,
            isCurrent: false
          },
          {
            id: 'laptop-device',
            name: 'MacBook Pro',
            type: 'desktop',
            lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            mfaEnabled: true,
            isCurrent: false
          }
        ]

        setSyncStatus({
          isEnabled: true,
          isSyncing: false,
          isOnline: navigator.onLine,
          lastSyncTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          syncError: null,
          devices: mockDevices,
          totalDevices: mockDevices.length,
          enabledDevices: mockDevices.filter(d => d.mfaEnabled).length
        })
      } catch (error) {
        setSyncStatus(prev => ({
          ...prev,
          syncError: 'Failed to load sync status'
        }))
      }
    }

    loadSyncStatus()

    // Listen for online/offline status changes
    const handleOnline = () => setSyncStatus(prev => ({ ...prev, isOnline: true }))
    const handleOffline = () => setSyncStatus(prev => ({ ...prev, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [userId])

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return Smartphone
      case 'tablet':
        return Tablet
      default:
        return Monitor
    }
  }

  const getStatusColor = () => {
    if (syncStatus.syncError) return 'text-red-600 dark:text-red-400'
    if (!syncStatus.isOnline) return 'text-yellow-600 dark:text-yellow-400'
    if (syncStatus.isSyncing) return 'text-blue-600 dark:text-blue-400'
    if (syncStatus.isEnabled) return 'text-green-600 dark:text-green-400'
    return 'text-gray-500 dark:text-gray-400'
  }

  const getStatusIcon = () => {
    if (syncStatus.syncError) return AlertTriangle
    if (!syncStatus.isOnline) return CloudOff
    if (syncStatus.isSyncing) return RotateCw
    if (syncStatus.isEnabled) return ShieldCheck
    return ShieldAlert
  }

  const formatLastSeen = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  const StatusIcon = getStatusIcon()

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <StatusIcon
          className={`w-4 h-4 ${getStatusColor()} ${syncStatus.isSyncing ? 'animate-spin' : ''}`}
        />
        <span className={`text-sm ${getStatusColor()}`}>
          {syncStatus.syncError ? 'Sync Error' :
           !syncStatus.isOnline ? 'Offline' :
           syncStatus.isSyncing ? 'Syncing...' :
           syncStatus.isEnabled ? `${syncStatus.enabledDevices}/${syncStatus.totalDevices} devices` :
           'Not configured'}
        </span>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            syncStatus.isEnabled
              ? 'bg-green-50 dark:bg-green-900/20'
              : 'bg-gray-50 dark:bg-gray-700'
          }`}>
            <StatusIcon className={`w-5 h-5 ${getStatusColor()} ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              Multi-Factor Authentication
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {syncStatus.syncError ? 'Sync Error - Check connection' :
               !syncStatus.isOnline ? 'Offline - Will sync when online' :
               syncStatus.isSyncing ? 'Syncing across devices...' :
               syncStatus.isEnabled ? 'Synchronized across all devices' :
               'Not configured'}
            </p>
          </div>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2">
          {syncStatus.isOnline ? (
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <Cloud className="w-4 h-4" />
              <span className="text-xs">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <CloudOff className="w-4 h-4" />
              <span className="text-xs">Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Sync Status Details */}
      <div className="space-y-3">
        {/* Device Summary */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Device Status</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {syncStatus.enabledDevices} of {syncStatus.totalDevices} devices enabled
          </span>
        </div>

        {/* Last Sync Time */}
        {syncStatus.lastSyncTime && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Last Sync</span>
            <div className="flex items-center gap-1 text-gray-900 dark:text-gray-100">
              <Clock className="w-3 h-3" />
              <span>{formatLastSeen(syncStatus.lastSyncTime)}</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {syncStatus.syncError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-300">{syncStatus.syncError}</span>
            </div>
          </div>
        )}

        {/* Device List (if enabled) */}
        {showDevices && syncStatus.devices.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Connected Devices</span>
              {onDeviceManagement && (
                <button
                  onClick={onDeviceManagement}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Manage
                </button>
              )}
            </div>
            <div className="space-y-2">
              {syncStatus.devices.slice(0, 3).map((device) => {
                const DeviceIcon = getDeviceIcon(device.type)
                return (
                  <div key={device.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <DeviceIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {device.name}
                        </span>
                        {device.isCurrent && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Last active {formatLastSeen(device.lastSeen)}
                      </span>
                    </div>
                    <div className="flex-shrink-0">
                      {device.mfaEnabled ? (
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                      )}
                    </div>
                  </div>
                )
              })}

              {syncStatus.devices.length > 3 && (
                <div className="text-center">
                  <button
                    onClick={onDeviceManagement}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    +{syncStatus.devices.length - 3} more devices
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Offline Notice */}
        {!syncStatus.isOnline && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <span className="text-sm text-yellow-700 dark:text-yellow-300">
                You're offline. MFA settings will sync when connection is restored.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MFASyncStatusIndicator