import React, { useState } from 'react'
import {
  Smartphone,
  Monitor,
  Tablet,
  Wifi,
  WifiOff,
  Shield,
  ShieldAlert,
  ShieldCheck,
  MoreVertical,
  Trash2,
  Edit3,
  Clock,
  MapPin,
  Info
} from 'lucide-react'
import { useDeviceManagement } from '@/hooks/useDeviceManagement'
import { useDevicePresence } from '@/hooks/useDevicePresence'

interface DeviceListProps {
  showActions?: boolean
  showDetails?: boolean
  className?: string
}

export const DeviceList: React.FC<DeviceListProps> = ({
  showActions = true,
  showDetails = true,
  className = ''
}) => {
  const {
    currentDevice,
    connectedDevices,
    removeDevice,
    updateDeviceName,
    updateDeviceTrust,
    isDeviceTrusted
  } = useDeviceManagement()

  const {
    getDevicePresence,
    isDeviceOnline,
    getLastSeenText
  } = useDevicePresence()

  const [editingDevice, setEditingDevice] = useState<string | null>(null)
  const [newDeviceName, setNewDeviceName] = useState('')
  const [showDropdown, setShowDropdown] = useState<string | null>(null)

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

  const getTrustLabel = (trustLevel: string) => {
    switch (trustLevel) {
      case 'trusted':
        return 'Trusted'
      case 'untrusted':
        return 'Untrusted'
      default:
        return 'Unknown'
    }
  }

  const handleEditName = (deviceId: string, currentName: string) => {
    setEditingDevice(deviceId)
    setNewDeviceName(currentName)
    setShowDropdown(null)
  }

  const handleSaveName = async (deviceId: string) => {
    if (newDeviceName.trim() && newDeviceName !== connectedDevices.find(d => d.id === deviceId)?.name) {
      await updateDeviceName(deviceId, newDeviceName.trim())
    }
    setEditingDevice(null)
    setNewDeviceName('')
  }

  const handleCancelEdit = () => {
    setEditingDevice(null)
    setNewDeviceName('')
  }

  const handleRemoveDevice = async (deviceId: string) => {
    if (window.confirm('Are you sure you want to remove this device? This action cannot be undone.')) {
      await removeDevice(deviceId)
    }
    setShowDropdown(null)
  }

  const handleTrustChange = async (deviceId: string, trustLevel: 'trusted' | 'untrusted') => {
    await updateDeviceTrust(deviceId, trustLevel)
    setShowDropdown(null)
  }

  const formatDeviceInfo = (device: any) => {
    const parts = []
    if (device.platform) parts.push(device.platform)
    if (device.browser) parts.push(device.browser)
    return parts.join(' • ')
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {connectedDevices.map(device => {
        const presence = getDevicePresence(device.id)
        const isOnline = isDeviceOnline(device.id)
        const isCurrentDev = device.id === currentDevice?.id
        const DeviceIcon = getDeviceIcon(device.platform)
        const TrustIcon = getTrustIcon(device.trustLevel)

        return (
          <div
            key={device.id}
            className={`bg-white dark:bg-gray-800 rounded-lg border ${
              isCurrentDev
                ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700'
            } p-4 transition-colors duration-200`}
          >
            <div className="flex items-center justify-between">
              {/* Device Icon and Info */}
              <div className="flex items-center gap-3 flex-1">
                <div className={`p-3 rounded-lg ${
                  isOnline
                    ? 'bg-green-100 dark:bg-green-900/50'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <DeviceIcon className={`w-5 h-5 ${
                    isOnline
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-400'
                  }`} />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Device Name */}
                  <div className="flex items-center gap-2 mb-1">
                    {editingDevice === device.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={newDeviceName}
                          onChange={(e) => setNewDeviceName(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName(device.id)
                            if (e.key === 'Escape') handleCancelEdit()
                          }}
                          onBlur={() => handleSaveName(device.id)}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <>
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {device.name || `${device.platform} Device`}
                        </h3>
                        {isCurrentDev && (
                          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full font-medium">
                            This Device
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Status and Details */}
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    {/* Online Status */}
                    <div className="flex items-center gap-1">
                      {isOnline ? (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Online now</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span>{getLastSeenText(device.id)}</span>
                        </>
                      )}
                    </div>

                    {/* Trust Level */}
                    <div className="flex items-center gap-1">
                      <TrustIcon className={`w-3 h-3 ${getTrustColor(device.trustLevel)}`} />
                      <span className={getTrustColor(device.trustLevel)}>
                        {getTrustLabel(device.trustLevel)}
                      </span>
                    </div>
                  </div>

                  {/* Additional Details */}
                  {showDetails && (
                    <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                      {formatDeviceInfo(device) && (
                        <div className="flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          <span>{formatDeviceInfo(device)}</span>
                        </div>
                      )}
                      {device.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>{device.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Added {new Date(device.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {showActions && !isCurrentDev && (
                <div className="relative">
                  <button
                    onClick={() => setShowDropdown(showDropdown === device.id ? null : device.id)}
                    className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Device options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showDropdown === device.id && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                      <button
                        onClick={() => handleEditName(device.id, device.name || '')}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <Edit3 className="w-4 h-4" />
                        Rename Device
                      </button>

                      <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

                      <button
                        onClick={() => handleTrustChange(device.id, 'trusted')}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                          device.trustLevel === 'trusted'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Mark as Trusted
                      </button>

                      <button
                        onClick={() => handleTrustChange(device.id, 'untrusted')}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                          device.trustLevel === 'untrusted'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <ShieldAlert className="w-4 h-4" />
                        Mark as Untrusted
                      </button>

                      <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

                      <button
                        onClick={() => handleRemoveDevice(device.id)}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove Device
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Empty State */}
      {connectedDevices.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Monitor className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-medium">No devices connected</p>
          <p className="text-sm">Register a device to start cross-device synchronization</p>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowDropdown(null)}
        />
      )}
    </div>
  )
}