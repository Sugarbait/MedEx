import React, { useState, useEffect } from 'react'
import {
  Smartphone,
  Monitor,
  Tablet,
  Wifi,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  Key,
  Fingerprint
} from 'lucide-react'
import { useDeviceManagement } from '@/hooks/useDeviceManagement'
import { deviceFingerprintService } from '@/services/deviceFingerprintService'

interface DeviceRegistrationProps {
  onRegistrationComplete?: (success: boolean) => void
  className?: string
}

export const DeviceRegistration: React.FC<DeviceRegistrationProps> = ({
  onRegistrationComplete,
  className = ''
}) => {
  const {
    registerDevice,
    isRegistering,
    registrationResult,
    getCurrentDeviceFingerprint
  } = useDeviceManagement()

  const [step, setStep] = useState<'info' | 'name' | 'registering' | 'complete'>('info')
  const [deviceName, setDeviceName] = useState('')
  const [deviceInfo, setDeviceInfo] = useState<any>(null)
  const [fingerprint, setFingerprint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Get device info on mount
  useEffect(() => {
    const getDeviceInfo = async () => {
      try {
        const info = await deviceFingerprintService.getDeviceInfo()
        const fp = await getCurrentDeviceFingerprint()

        setDeviceInfo(info)
        setFingerprint(fp)

        // Generate default device name
        const platform = info.platform || 'Unknown'
        const browser = info.browser || 'Browser'
        setDeviceName(`${platform} - ${browser}`)
      } catch (err) {
        setError('Failed to gather device information')
      }
    }

    getDeviceInfo()
  }, [getCurrentDeviceFingerprint])

  const handleStartRegistration = () => {
    setStep('name')
    setError(null)
  }

  const handleRegister = async () => {
    if (!deviceName.trim()) {
      setError('Please enter a device name')
      return
    }

    setStep('registering')
    setError(null)

    try {
      const success = await registerDevice(deviceName.trim())

      if (success) {
        setStep('complete')
        onRegistrationComplete?.(true)
      } else {
        setError('Failed to register device. Please try again.')
        setStep('name')
        onRegistrationComplete?.(false)
      }
    } catch (err) {
      setError('Registration failed. Please check your connection and try again.')
      setStep('name')
      onRegistrationComplete?.(false)
    }
  }

  const getDeviceIcon = () => {
    if (!deviceInfo?.platform) return Monitor

    const platform = deviceInfo.platform.toLowerCase()
    if (platform.includes('mobile') || platform.includes('android') || platform.includes('ios')) {
      return Smartphone
    }
    if (platform.includes('tablet') || platform.includes('ipad')) {
      return Tablet
    }
    return Monitor
  }

  const DeviceIcon = getDeviceIcon()

  const renderStep = () => {
    switch (step) {
      case 'info':
        return (
          <div className="text-center space-y-6">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                <DeviceIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Register This Device
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Register this device to enable secure cross-device synchronization
                  of your healthcare data and settings.
                </p>
              </div>
            </div>

            {/* Device Information Preview */}
            {deviceInfo && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Device Information
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Platform:</span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {deviceInfo.platform || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Browser:</span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {deviceInfo.browser || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Screen:</span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {deviceInfo.screenResolution || 'Unknown'}
                    </span>
                  </div>
                  {fingerprint && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">ID:</span>
                      <span className="text-gray-900 dark:text-gray-100 font-mono text-xs">
                        {fingerprint.slice(0, 8)}...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Security Notice */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex gap-3">
                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-blue-800 dark:text-blue-200 font-medium mb-1">
                    HIPAA-Compliant Security
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    All data is encrypted end-to-end and your device fingerprint
                    is used for secure authentication across your devices.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleStartRegistration}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 min-h-[44px]"
            >
              Continue with Registration
            </button>
          </div>
        )

      case 'name':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-4">
                <Key className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Name Your Device
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Choose a name to help you identify this device in your device list.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="deviceName"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Device Name
                </label>
                <input
                  id="deviceName"
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g., Work Laptop, Personal Phone"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
                  maxLength={50}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {deviceName.length}/50 characters
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('info')}
                className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium py-3 px-4 rounded-lg transition-colors duration-200 min-h-[44px]"
              >
                Back
              </button>
              <button
                onClick={handleRegister}
                disabled={!deviceName.trim() || isRegistering}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 min-h-[44px] flex items-center justify-center gap-2"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  'Register Device'
                )}
              </button>
            </div>
          </div>
        )

      case 'registering':
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Registering Device...
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Please wait while we securely register your device with our servers.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-center gap-3 text-sm text-blue-700 dark:text-blue-300">
                <Fingerprint className="w-5 h-5" />
                <span>Creating secure device fingerprint...</span>
              </div>
            </div>
          </div>
        )

      case 'complete':
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Device Registered Successfully!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your device has been securely registered and is now ready for
                cross-device synchronization.
              </p>
            </div>

            {registrationResult && registrationResult.success && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-300">Device Name:</span>
                    <span className="text-green-800 dark:text-green-200 font-medium">
                      {deviceName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-300">Trust Level:</span>
                    <span className="text-green-800 dark:text-green-200 font-medium">
                      Trusted
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-300">Status:</span>
                    <span className="text-green-800 dark:text-green-200 font-medium">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>✓ Device fingerprint created and stored securely</p>
              <p>✓ Cross-device sync enabled</p>
              <p>✓ End-to-end encryption activated</p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className={`max-w-md mx-auto ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {renderStep()}
      </div>
    </div>
  )
}