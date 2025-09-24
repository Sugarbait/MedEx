import React, { useState, useEffect } from 'react'
import {
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Wifi,
  WifiOff,
  Shield,
  Smartphone,
  Monitor,
  Tablet,
  X,
  Pause,
  Play,
  RotateCw
} from 'lucide-react'

interface SyncProgressStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  timestamp?: Date
  details?: string
}

interface DeviceSyncInfo {
  deviceId: string
  deviceName: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
  syncStatus: 'pending' | 'syncing' | 'completed' | 'failed'
  lastSyncTime?: Date
  isOnline: boolean
}

interface MFASyncProgressIndicatorProps {
  isVisible: boolean
  onClose?: () => void
  userId: string
  syncType: 'setup' | 'update' | 'disable'
  autoClose?: boolean
  compact?: boolean
}

export const MFASyncProgressIndicator: React.FC<MFASyncProgressIndicatorProps> = ({
  isVisible,
  onClose,
  userId,
  syncType,
  autoClose = true,
  compact = false
}) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [devices, setDevices] = useState<DeviceSyncInfo[]>([])
  const [overallProgress, setOverallProgress] = useState(0)
  const [totalSteps] = useState<SyncProgressStep[]>([
    {
      id: 'validate',
      title: 'Validating Configuration',
      description: 'Checking MFA settings and security requirements',
      status: 'pending'
    },
    {
      id: 'encrypt',
      title: 'Encrypting Data',
      description: 'Securing MFA configuration with end-to-end encryption',
      status: 'pending'
    },
    {
      id: 'upload',
      title: 'Uploading to Cloud',
      description: 'Synchronizing encrypted data to secure cloud storage',
      status: 'pending'
    },
    {
      id: 'discover',
      title: 'Discovering Devices',
      description: 'Finding your other devices for synchronization',
      status: 'pending'
    },
    {
      id: 'distribute',
      title: 'Distributing to Devices',
      description: 'Pushing MFA configuration to all authorized devices',
      status: 'pending'
    },
    {
      id: 'verify',
      title: 'Verifying Sync',
      description: 'Confirming successful synchronization across devices',
      status: 'pending'
    }
  ])
  const [steps, setSteps] = useState<SyncProgressStep[]>(totalSteps)
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'slow'>('online')
  const [error, setError] = useState<string | null>(null)

  // Helper functions to get real device information
  const getCurrentDeviceId = (): string => {
    const stored = localStorage.getItem('carexps_device_id')
    if (stored) return stored

    const deviceId = `device_${Date.now()}_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`
    localStorage.setItem('carexps_device_id', deviceId)
    return deviceId
  }

  const getCurrentDeviceName = (): string => {
    const userAgent = navigator.userAgent.toLowerCase()
    const platform = navigator.platform?.toLowerCase() || ''

    let os = 'Unknown'
    if (/windows/.test(userAgent) || /win32|win64/.test(platform)) {
      os = 'Windows'
    } else if (/mac/.test(userAgent) || /darwin/.test(platform)) {
      os = 'macOS'
    } else if (/linux/.test(userAgent)) {
      os = 'Linux'
    } else if (/android/.test(userAgent)) {
      os = 'Android'
    } else if (/iphone|ipad|ipod/.test(userAgent)) {
      os = 'iOS'
    }

    return `${os} PC (Current)`
  }

  const getCurrentDeviceType = (): 'desktop' | 'mobile' | 'tablet' => {
    const userAgent = navigator.userAgent.toLowerCase()

    if (/mobile|android|iphone|ipod/.test(userAgent)) {
      return 'mobile'
    } else if (/tablet|ipad/.test(userAgent)) {
      return 'tablet'
    }
    return 'desktop'
  }

  useEffect(() => {
    if (isVisible && !isRunning) {
      startSync()
    }
  }, [isVisible])

  useEffect(() => {
    // Monitor network status
    const handleOnline = () => {
      setConnectionStatus('online')
      if (isPaused) {
        resumeSync()
      }
    }

    const handleOffline = () => {
      setConnectionStatus('offline')
      setIsPaused(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [isPaused])

  const startSync = async () => {
    setIsRunning(true)
    setIsPaused(false)
    setError(null)

    // Initialize real devices instead of fake mock devices
    const realDevices: DeviceSyncInfo[] = [
      {
        deviceId: getCurrentDeviceId(),
        deviceName: getCurrentDeviceName(),
        deviceType: getCurrentDeviceType(),
        syncStatus: 'pending',
        isOnline: true
      }
      // Only show real devices - no fake iPhone or iPad
    ]

    setDevices(realDevices)

    try {
      for (let i = 0; i < steps.length; i++) {
        if (isPaused) {
          await waitForResume()
        }

        setCurrentStep(i)

        // Update step to in-progress
        setSteps(prev => prev.map((step, index) =>
          index === i
            ? { ...step, status: 'in-progress', timestamp: new Date() }
            : step
        ))

        // Simulate step processing time
        await simulateStepExecution(steps[i], i)

        // Update step to completed
        setSteps(prev => prev.map((step, index) =>
          index === i
            ? { ...step, status: 'completed', timestamp: new Date() }
            : step
        ))

        // Update overall progress
        const progress = ((i + 1) / steps.length) * 100
        setOverallProgress(progress)

        // Update device sync status based on current step
        if (i >= 3) { // After discover step
          setDevices(prev => prev.map(device => ({
            ...device,
            syncStatus: device.isOnline ? 'syncing' : 'pending'
          })))
        }

        if (i === steps.length - 1) { // Last step
          setDevices(prev => prev.map(device => ({
            ...device,
            syncStatus: device.isOnline ? 'completed' : 'failed',
            lastSyncTime: device.isOnline ? new Date() : undefined
          })))
        }
      }

      setIsRunning(false)

      if (autoClose) {
        setTimeout(() => {
          onClose?.()
        }, 2000)
      }
    } catch (error) {
      console.error('Sync failed:', error)
      setError('Synchronization failed. Please try again.')
      setIsRunning(false)
    }
  }

  const simulateStepExecution = async (step: SyncProgressStep, stepIndex: number) => {
    // Simulate different processing times for different steps
    const baseDuration = {
      validate: 800,
      encrypt: 1200,
      upload: 1500,
      discover: 1000,
      distribute: 1800,
      verify: 1000
    }[step.id] || 1000

    // Add some randomness
    const duration = baseDuration + (Math.random() - 0.5) * 400

    await new Promise(resolve => setTimeout(resolve, duration))
  }

  const waitForResume = (): Promise<void> => {
    return new Promise(resolve => {
      const checkResume = () => {
        if (!isPaused) {
          resolve()
        } else {
          setTimeout(checkResume, 100)
        }
      }
      checkResume()
    })
  }

  const pauseSync = () => {
    setIsPaused(true)
  }

  const resumeSync = () => {
    setIsPaused(false)
  }

  const retrySync = () => {
    setCurrentStep(0)
    setOverallProgress(0)
    setError(null)
    setSteps(totalSteps.map(step => ({ ...step, status: 'pending' })))
    startSync()
  }

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return CheckCircle
      case 'failed':
        return AlertTriangle
      case 'in-progress':
      case 'syncing':
        return RefreshCw
      default:
        return Clock
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400'
      case 'failed':
        return 'text-red-600 dark:text-red-400'
      case 'in-progress':
      case 'syncing':
        return 'text-blue-600 dark:text-blue-400'
      default:
        return 'text-gray-500 dark:text-gray-400'
    }
  }

  if (!isVisible) return null

  if (compact) {
    return (
      <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 max-w-sm z-50">
        <div className="flex items-center gap-3">
          {connectionStatus === 'online' ? (
            <Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          ) : (
            <CloudOff className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          )}

          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                MFA Sync
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {Math.round(overallProgress)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
              <div
                className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                MFA Synchronization
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Syncing your multi-factor authentication across devices
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div className="flex items-center gap-1">
              {connectionStatus === 'online' ? (
                <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              )}
              <span className={`text-sm ${
                connectionStatus === 'online'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-yellow-600 dark:text-yellow-400'
              }`}>
                {connectionStatus === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Controls */}
            {isRunning && !error && (
              <button
                onClick={isPaused ? resumeSync : pauseSync}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                title={isPaused ? 'Resume sync' : 'Pause sync'}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto">
          {/* Progress Overview */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Overall Progress
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {Math.round(overallProgress)}% Complete
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>

            {/* Current Step */}
            {isRunning && currentStep < steps.length && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {steps[currentStep]?.title}
                  </span>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 ml-6">
                  {steps[currentStep]?.description}
                </p>
              </div>
            )}

            {/* Pause Notice */}
            {isPaused && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Pause className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                    Sync Paused
                  </span>
                </div>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 ml-6">
                  {connectionStatus === 'offline'
                    ? 'Waiting for internet connection to resume'
                    : 'Sync has been manually paused'}
                </p>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span className="text-sm font-medium text-red-900 dark:text-red-100">
                      Sync Failed
                    </span>
                  </div>
                  <button
                    onClick={retrySync}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/30"
                  >
                    <RotateCw className="w-3 h-3" />
                    Retry
                  </button>
                </div>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1 ml-6">
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* Steps Details */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Sync Steps</h3>
            <div className="space-y-3">
              {steps.map((step, index) => {
                const StatusIcon = getStatusIcon(step.status)
                const isActive = index === currentStep && isRunning

                return (
                  <div key={step.id} className={`flex items-start gap-3 p-3 rounded-lg ${
                    isActive ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700' : 'bg-gray-50 dark:bg-gray-700'
                  }`}>
                    <StatusIcon className={`w-4 h-4 mt-0.5 ${getStatusColor(step.status)} ${
                      step.status === 'in-progress' ? 'animate-spin' : ''
                    }`} />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {step.title}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {step.description}
                      </p>
                      {step.timestamp && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {step.timestamp.toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Device Status */}
          <div className="p-6">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Device Status</h3>
            <div className="space-y-3">
              {devices.map((device) => {
                const DeviceIcon = getDeviceIcon(device.deviceType)
                const StatusIcon = getStatusIcon(device.syncStatus)

                return (
                  <div key={device.deviceId} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <DeviceIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {device.deviceName}
                        </span>
                        <div className={`w-2 h-2 rounded-full ${
                          device.isOnline ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                      </div>
                      {device.lastSyncTime && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Last sync: {device.lastSyncTime.toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`w-4 h-4 ${getStatusColor(device.syncStatus)} ${
                        device.syncStatus === 'syncing' ? 'animate-spin' : ''
                      }`} />
                      <span className={`text-sm capitalize ${getStatusColor(device.syncStatus)}`}>
                        {device.syncStatus}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MFASyncProgressIndicator