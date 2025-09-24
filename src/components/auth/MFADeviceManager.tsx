import React, { useState, useEffect } from 'react'
import {
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  MapPin,
  Clock,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  MoreVertical,
  CheckCircle,
  X,
  Wifi,
  Battery,
  Chrome,
  Safari,
  Firefox,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react'

interface DeviceInfo {
  id: string
  name: string
  type: 'desktop' | 'mobile' | 'tablet'
  os: string
  browser: string
  location: string
  ipAddress: string
  lastActive: Date
  firstSeen: Date
  mfaEnabled: boolean
  isCurrent: boolean
  isTrusted: boolean
  batteryLevel?: number
  isOnline: boolean
}

interface MFADeviceManagerProps {
  userId: string
  isVisible: boolean
  onClose: () => void
}

export const MFADeviceManager: React.FC<MFADeviceManagerProps> = ({
  userId,
  isVisible,
  onClose
}) => {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [showConfirmRemove, setShowConfirmRemove] = useState<string | null>(null)
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(false)

  useEffect(() => {
    if (isVisible) {
      loadDevices()
    }
  }, [isVisible, userId])

  const loadDevices = async () => {
    setLoading(true)
    try {
      // Mock device data - in real implementation this would fetch from your MFA/device service
      const mockDevices: DeviceInfo[] = [
        {
          id: 'current-device',
          name: 'Windows PC - Primary',
          type: 'desktop',
          os: 'Windows 11',
          browser: 'Chrome',
          location: 'Toronto, ON',
          ipAddress: '192.168.1.100',
          lastActive: new Date(),
          firstSeen: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          mfaEnabled: true,
          isCurrent: true,
          isTrusted: true,
          isOnline: true
        },
        {
          id: 'iphone-device',
          name: 'iPhone 15 Pro',
          type: 'mobile',
          os: 'iOS 17.1',
          browser: 'Safari',
          location: 'Toronto, ON',
          ipAddress: '192.168.1.105',
          lastActive: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          firstSeen: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
          mfaEnabled: true,
          isCurrent: false,
          isTrusted: true,
          batteryLevel: 87,
          isOnline: true
        },
        {
          id: 'macbook-device',
          name: 'MacBook Pro M3',
          type: 'desktop',
          os: 'macOS 14.1',
          browser: 'Safari',
          location: 'Toronto, ON',
          ipAddress: '192.168.1.102',
          lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          firstSeen: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
          mfaEnabled: true,
          isCurrent: false,
          isTrusted: true,
          isOnline: false
        },
        {
          id: 'tablet-device',
          name: 'iPad Air',
          type: 'tablet',
          os: 'iPadOS 17.1',
          browser: 'Safari',
          location: 'Montreal, QC',
          ipAddress: '10.0.1.45',
          lastActive: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          firstSeen: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
          mfaEnabled: false,
          isCurrent: false,
          isTrusted: false,
          isOnline: false
        },
        {
          id: 'old-device',
          name: 'Work Laptop (Dell)',
          type: 'desktop',
          os: 'Windows 10',
          browser: 'Firefox',
          location: 'Unknown',
          ipAddress: '203.0.113.45',
          lastActive: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
          firstSeen: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 180 days ago
          mfaEnabled: true,
          isCurrent: false,
          isTrusted: false,
          isOnline: false
        }
      ]

      setDevices(mockDevices)
    } catch (error) {
      console.error('Failed to load devices:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDeviceIcon = (type: string, isOnline: boolean) => {
    const baseClass = `w-5 h-5 ${isOnline ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`
    switch (type) {
      case 'mobile':
        return <Smartphone className={baseClass} />
      case 'tablet':
        return <Tablet className={baseClass} />
      default:
        return <Monitor className={baseClass} />
    }
  }

  const getBrowserIcon = (browser: string) => {
    const iconClass = "w-4 h-4 text-gray-500"
    switch (browser.toLowerCase()) {
      case 'chrome':
        return <Chrome className={iconClass} />
      case 'safari':
        return <Safari className={iconClass} />
      case 'firefox':
        return <Firefox className={iconClass} />
      default:
        return <Globe className={iconClass} />
    }
  }

  const formatLastSeen = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Active now'
    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 30) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const handleRemoveDevice = async (deviceId: string) => {
    try {
      // In real implementation, this would call your device management API
      setDevices(prev => prev.filter(d => d.id !== deviceId))
      setShowConfirmRemove(null)
      setSelectedDevice(null)
    } catch (error) {
      console.error('Failed to remove device:', error)
    }
  }

  const handleToggleMFA = async (deviceId: string) => {
    try {
      // In real implementation, this would call your MFA management API
      setDevices(prev =>
        prev.map(d =>
          d.id === deviceId
            ? { ...d, mfaEnabled: !d.mfaEnabled }
            : d
        )
      )
    } catch (error) {
      console.error('Failed to toggle MFA:', error)
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Device Management
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage MFA settings across all your devices
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSensitiveInfo(!showSensitiveInfo)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title={showSensitiveInfo ? 'Hide sensitive info' : 'Show sensitive info'}
            >
              {showSensitiveInfo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={loadDevices}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              title="Refresh devices"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400 mr-2" />
              <span className="text-gray-600 dark:text-gray-400">Loading devices...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-blue-900 dark:text-blue-100">Total Devices</span>
                  </div>
                  <div className="mt-1 text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {devices.length}
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="font-medium text-green-900 dark:text-green-100">MFA Enabled</span>
                  </div>
                  <div className="mt-1 text-2xl font-bold text-green-900 dark:text-green-100">
                    {devices.filter(d => d.mfaEnabled).length}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">Online Now</span>
                  </div>
                  <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {devices.filter(d => d.isOnline).length}
                  </div>
                </div>
              </div>

              {/* Device List */}
              <div className="space-y-3">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className={`border rounded-lg p-4 transition-all ${
                      device.isCurrent
                        ? 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10'
                        : device.isTrusted
                        ? 'border-green-200 dark:border-green-700 bg-gray-50 dark:bg-gray-700'
                        : 'border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getDeviceIcon(device.type, device.isOnline)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {device.name}
                            </h3>
                            {device.isCurrent && (
                              <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full">
                                Current Device
                              </span>
                            )}
                            {device.isTrusted && !device.isCurrent && (
                              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" title="Trusted Device" />
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                              <div className="flex items-center gap-1">
                                {getBrowserIcon(device.browser)}
                                <span>{device.browser} on {device.os}</span>
                              </div>
                              {device.batteryLevel && (
                                <div className="flex items-center gap-1">
                                  <Battery className="w-3 h-3" />
                                  <span>{device.batteryLevel}%</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatLastSeen(device.lastActive)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                <span>{device.location}</span>
                              </div>
                              {showSensitiveInfo && (
                                <div className="flex items-center gap-1 font-mono">
                                  <Globe className="w-3 h-3" />
                                  <span>{device.ipAddress}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600 dark:text-gray-400">MFA Status:</span>
                                {device.mfaEnabled ? (
                                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <ShieldCheck className="w-3 h-3" />
                                    Enabled
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                                    <AlertTriangle className="w-3 h-3" />
                                    Disabled
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                                <div className={`w-2 h-2 rounded-full ${device.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                                <span className={device.isOnline ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>
                                  {device.isOnline ? 'Online' : 'Offline'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Device Actions */}
                      <div className="flex items-center gap-2">
                        {!device.isCurrent && (
                          <>
                            <button
                              onClick={() => handleToggleMFA(device.id)}
                              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                                device.mfaEnabled
                                  ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/30'
                                  : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/30'
                              }`}
                            >
                              {device.mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
                            </button>
                            <button
                              onClick={() => setShowConfirmRemove(device.id)}
                              className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Remove device"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Device Security Tips</h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Enable MFA on all trusted devices for maximum security</li>
              <li>• Remove old or unused devices to reduce security risk</li>
              <li>• Regularly review device access from unfamiliar locations</li>
              <li>• Contact IT immediately if you see unauthorized devices</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Device Removal */}
      {showConfirmRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Remove Device</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to remove this device? This action will revoke its access and cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmRemove(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveDevice(showConfirmRemove)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Remove Device
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MFADeviceManager