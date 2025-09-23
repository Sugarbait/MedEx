import React from 'react'
import {
  Smartphone,
  Monitor,
  Tablet,
  Wifi,
  WifiOff,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Clock,
  RefreshCw,
  AlertTriangle
} from 'lucide-react'
import { useDevicePresence } from '@/hooks/useDevicePresence'
import { useCrossDeviceSync } from '@/hooks/useCrossDeviceSync'
import { useConflictResolution } from '@/hooks/useConflictResolution'

interface DeviceStatusIndicatorProps {
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  showDetails?: boolean
  className?: string
}

export const DeviceStatusIndicator: React.FC<DeviceStatusIndicatorProps> = ({
  size = 'md',
  showLabel = false,
  showDetails = false,
  className = ''
}) => {
  const { onlineCount, totalDeviceCount, isCurrentDeviceOnline } = useDevicePresence()
  const { syncStatus, isOnline, isSyncing } = useCrossDeviceSync()
  const { hasConflicts, conflictCount } = useConflictResolution()

  // Determine icon size based on size prop
  const iconSize = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }[size]

  // Determine status color and icon
  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        color: 'text-gray-400',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        icon: WifiOff,
        status: 'Offline',
        description: 'No internet connection'
      }
    }

    if (hasConflicts) {
      return {
        color: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-100 dark:bg-amber-900/50',
        icon: AlertTriangle,
        status: 'Conflicts',
        description: `${conflictCount} sync conflict${conflictCount === 1 ? '' : 's'} need attention`
      }
    }

    if (isSyncing) {
      return {
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-100 dark:bg-blue-900/50',
        icon: RefreshCw,
        status: 'Syncing',
        description: 'Synchronizing data across devices'
      }
    }

    if (syncStatus.queueSize > 0) {
      return {
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-100 dark:bg-orange-900/50',
        icon: Clock,
        status: 'Pending',
        description: `${syncStatus.queueSize} items waiting to sync`
      }
    }

    if (onlineCount > 1) {
      return {
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/50',
        icon: ShieldCheck,
        status: 'Connected',
        description: `${onlineCount} of ${totalDeviceCount} devices online`
      }
    }

    return {
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/50',
      icon: Shield,
      status: 'Ready',
      description: 'Cross-device sync ready'
    }
  }

  const statusInfo = getStatusInfo()
  const StatusIcon = statusInfo.icon

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Status Indicator */}
      <div
        className={`p-2 rounded-full ${statusInfo.bgColor} transition-colors duration-200`}
        title={statusInfo.description}
      >
        <StatusIcon
          className={`${iconSize} ${statusInfo.color} ${isSyncing ? 'animate-spin' : ''}`}
        />
      </div>

      {/* Status Label */}
      {showLabel && (
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.status}
          </span>
          {showDetails && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {statusInfo.description}
            </span>
          )}
        </div>
      )}

      {/* Device Count Badge */}
      {onlineCount > 1 && (
        <div className="relative">
          <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {onlineCount}
          </div>
        </div>
      )}

      {/* Conflict Count Badge */}
      {hasConflicts && (
        <div className="relative">
          <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
            {conflictCount}
          </div>
        </div>
      )}
    </div>
  )
}

interface DetailedDeviceStatusProps {
  className?: string
}

export const DetailedDeviceStatus: React.FC<DetailedDeviceStatusProps> = ({ className = '' }) => {
  const {
    onlineDevices,
    offlineDevices,
    totalDeviceCount,
    currentDevicePresence,
    getLastSeenText
  } = useDevicePresence()
  const { syncStatus, lastSyncTime } = useCrossDeviceSync()
  const { hasConflicts, conflictCount } = useConflictResolution()

  const getDeviceIcon = (platform?: string) => {
    if (!platform) return Monitor

    const platformLower = platform.toLowerCase()
    if (platformLower.includes('mobile') || platformLower.includes('android') || platformLower.includes('ios')) {
      return Smartphone
    }
    if (platformLower.includes('tablet') || platformLower.includes('ipad')) {
      return Tablet
    }
    return Monitor
  }

  const getTrustIcon = (trustLevel: string) => {
    switch (trustLevel) {
      case 'trusted':
        return ShieldCheck
      case 'untrusted':
        return ShieldAlert
      default:
        return Shield
    }
  }

  const getTrustColor = (trustLevel: string) => {
    switch (trustLevel) {
      case 'trusted':
        return 'text-green-600 dark:text-green-400'
      case 'untrusted':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Current Device */}
      {currentDevicePresence && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                {React.createElement(getDeviceIcon(currentDevicePresence.platform), {
                  className: 'w-5 h-5 text-blue-600 dark:text-blue-400'
                })}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {currentDevicePresence.deviceName}
                  </span>
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    (This Device)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Wifi className="w-4 h-4" />
                  <span>Online now</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {React.createElement(getTrustIcon(currentDevicePresence.trustLevel), {
                className: `w-4 h-4 ${getTrustColor(currentDevicePresence.trustLevel)}`
              })}
            </div>
          </div>
        </div>
      )}

      {/* Online Devices */}
      {onlineDevices.filter(d => !d.isCurrentDevice).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Online Devices ({onlineDevices.filter(d => !d.isCurrentDevice).length})
          </h4>
          <div className="space-y-2">
            {onlineDevices.filter(d => !d.isCurrentDevice).map(device => (
              <div
                key={device.deviceId}
                className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                    {React.createElement(getDeviceIcon(device.platform), {
                      className: 'w-4 h-4 text-green-600 dark:text-green-400'
                    })}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {device.deviceName}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Online now</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {React.createElement(getTrustIcon(device.trustLevel), {
                    className: `w-4 h-4 ${getTrustColor(device.trustLevel)}`
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Offline Devices */}
      {offlineDevices.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Offline Devices ({offlineDevices.length})
          </h4>
          <div className="space-y-2">
            {offlineDevices.map(device => (
              <div
                key={device.deviceId}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    {React.createElement(getDeviceIcon(device.platform), {
                      className: 'w-4 h-4 text-gray-400'
                    })}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {device.deviceName}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span>{getLastSeenText(device.deviceId)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {React.createElement(getTrustIcon(device.trustLevel), {
                    className: `w-4 h-4 ${getTrustColor(device.trustLevel)}`
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync Status */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          Sync Status
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Queue Size:</span>
            <span className="text-gray-900 dark:text-gray-100">{syncStatus.queueSize}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Total Synced:</span>
            <span className="text-gray-900 dark:text-gray-100">{syncStatus.totalSynced}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Errors:</span>
            <span className="text-gray-900 dark:text-gray-100">{syncStatus.errors}</span>
          </div>
          {lastSyncTime && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Last Sync:</span>
              <span className="text-gray-900 dark:text-gray-100">
                {lastSyncTime.toLocaleTimeString()}
              </span>
            </div>
          )}
          {hasConflicts && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Conflicts:</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {conflictCount}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}