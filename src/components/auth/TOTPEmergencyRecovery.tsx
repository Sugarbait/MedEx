/**
 * TOTP Emergency Recovery Component
 * Provides UI for emergency recovery options when TOTP setup fails
 */

import React, { useState } from 'react'
import { AlertTriangle, Shield, RefreshCw, Settings, HelpCircle, CheckCircle } from 'lucide-react'
import { mfaEmergencyRecovery } from '../../utils/mfaEmergencyRecovery'

interface TOTPEmergencyRecoveryProps {
  userId: string
  userEmail?: string
  onClose: () => void
  onBypassActivated?: () => void
  onMFAReset?: () => void
}

const TOTPEmergencyRecovery: React.FC<TOTPEmergencyRecoveryProps> = ({
  userId,
  userEmail,
  onClose,
  onBypassActivated,
  onMFAReset
}) => {
  const [selectedOption, setSelectedOption] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)

  const recoveryOptions = mfaEmergencyRecovery.generateRecoveryInstructions(userId)
  const criticalUsers = ['c550502f-c39d-4bb3-bb8c-d193657fdb24', 'pierre@phaetonai.com', 'pierre-user-789', 'super-user-456']
  const isEmergencyUser = criticalUsers.includes(userId) || (userEmail && criticalUsers.includes(userEmail))

  const handleEmergencyReset = async () => {
    setIsProcessing(true)
    setResult(null)

    try {
      console.log('🚨 Starting emergency MFA reset for user:', userId)
      const resetResult = await mfaEmergencyRecovery.emergencyMFAReset(userId)
      setResult(resetResult)

      if (resetResult.success && onMFAReset) {
        setTimeout(() => {
          onMFAReset()
        }, 3000)
      }
    } catch (error) {
      console.error('Emergency MFA reset failed:', error)
      setResult({
        success: false,
        message: 'Emergency reset failed. Please try manual recovery options.'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTemporaryBypass = () => {
    if (!isEmergencyUser) {
      alert('Emergency bypass is only available for authorized users.')
      return
    }

    const created = mfaEmergencyRecovery.createTemporaryMFABypass(userId, 1)

    if (created) {
      setResult({
        success: true,
        message: 'Temporary 1-hour bypass activated. You can now access the app without MFA.'
      })

      if (onBypassActivated) {
        setTimeout(() => {
          onBypassActivated()
        }, 2000)
      }
    } else {
      setResult({
        success: false,
        message: 'Failed to create temporary bypass. You may not have permission for this action.'
      })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Code copied to clipboard!')
    }).catch(() => {
      alert('Failed to copy code. Please select and copy manually.')
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <AlertTriangle className="w-8 h-8 text-red-600 mr-3" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">MFA Emergency Recovery</h2>
                <p className="text-sm text-gray-600">Resolve TOTP authentication issues</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          {/* User Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <Shield className="w-5 h-5 text-blue-600 mr-2" />
              <div className="text-sm">
                <div><strong>User ID:</strong> {userId}</div>
                {userEmail && <div><strong>Email:</strong> {userEmail}</div>}
                <div><strong>Emergency Access:</strong> {isEmergencyUser ? '✅ Authorized' : '❌ Limited Options'}</div>
              </div>
            </div>
          </div>

          {/* Result Display */}
          {result && (
            <div className={`border rounded-lg p-4 mb-6 ${
              result.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                )}
                <div className={`text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.message}
                </div>
              </div>
            </div>
          )}

          {/* Recovery Options */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recovery Options</h3>

            {/* Option 1: Fresh Setup */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start">
                <Settings className="w-5 h-5 text-blue-600 mr-3 mt-1" />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">Setup Fresh MFA (Recommended)</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Go to Settings → Security and setup new MFA with a fresh QR code. This is the safest option.
                  </p>
                  <button
                    onClick={() => {
                      onClose()
                      // Navigate to settings
                      window.location.hash = '#settings'
                    }}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Go to Settings
                  </button>
                </div>
              </div>
            </div>

            {/* Option 2: Emergency Reset */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start">
                <RefreshCw className="w-5 h-5 text-orange-600 mr-3 mt-1" />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">Emergency MFA Reset</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Clear all MFA data and reset authentication. You'll need to setup MFA again after this.
                  </p>
                  <button
                    onClick={handleEmergencyReset}
                    disabled={isProcessing}
                    className="mt-3 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-orange-300 transition-colors text-sm"
                  >
                    {isProcessing ? 'Resetting...' : 'Emergency Reset'}
                  </button>
                </div>
              </div>
            </div>

            {/* Option 3: Temporary Bypass (Emergency Users Only) */}
            {isEmergencyUser && (
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-red-600 mr-3 mt-1" />
                  <div className="flex-1">
                    <h4 className="font-medium text-red-800">Temporary Emergency Bypass</h4>
                    <p className="text-sm text-red-700 mt-1">
                      Create a 1-hour bypass to access the app without MFA. Use this only in emergencies.
                    </p>
                    <button
                      onClick={handleTemporaryBypass}
                      className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                    >
                      Activate 1-Hour Bypass
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Option 4: Manual Instructions */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start">
                <HelpCircle className="w-5 h-5 text-purple-600 mr-3 mt-1" />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">Manual Recovery Instructions</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Advanced recovery options using browser console commands.
                  </p>
                  <button
                    onClick={() => setShowInstructions(!showInstructions)}
                    className="mt-3 px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors text-sm"
                  >
                    {showInstructions ? 'Hide Instructions' : 'Show Instructions'}
                  </button>

                  {showInstructions && (
                    <div className="mt-4 space-y-3">
                      {recoveryOptions.recoveryMethods.map((method, index) => (
                        method.code && (
                          <div key={index} className="bg-gray-100 border rounded-lg p-3">
                            <div className="font-medium text-sm text-gray-900 mb-2">
                              {method.description}
                            </div>
                            <div className="bg-gray-900 text-gray-100 text-xs p-3 rounded font-mono overflow-x-auto">
                              <pre>{method.code.trim()}</pre>
                            </div>
                            <button
                              onClick={() => copyToClipboard(method.code)}
                              className="mt-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                            >
                              Copy Code
                            </button>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <div className="text-xs text-gray-500">
                Need additional help? Contact your system administrator.
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TOTPEmergencyRecovery