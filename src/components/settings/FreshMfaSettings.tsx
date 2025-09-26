/**
 * 🆕 FRESH MFA SETTINGS COMPONENT - Built from scratch with zero corruption
 *
 * This is a completely new, clean MFA settings component that:
 * - Uses the fresh MFA service
 * - Clean UI with no legacy code
 * - Simple toggle and setup functionality
 * - No corruption from old system
 */

import React, { useState, useEffect } from 'react'
import { Shield, ShieldCheck, Settings, AlertCircle, CheckCircle, X } from 'lucide-react'
import FreshMfaService from '../../services/freshMfaService'
import { FreshMfaSetup } from '../auth/FreshMfaSetup'

interface FreshMfaSettingsProps {
  userId: string
  userEmail?: string
  onSetupMfa?: () => void
  className?: string
}

export const FreshMfaSettings: React.FC<FreshMfaSettingsProps> = ({
  userId,
  userEmail = 'user@carexps.com',
  onSetupMfa,
  className = ''
}) => {
  const [isMfaEnabled, setIsMfaEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [autoGenerateSetup, setAutoGenerateSetup] = useState(false)

  /**
   * Load MFA status on component mount
   */
  useEffect(() => {
    loadMfaStatus()
  }, [userId])

  /**
   * Load fresh MFA status
   */
  const loadMfaStatus = async () => {
    if (!userId) return

    setIsLoading(true)
    try {
      const enabled = await FreshMfaService.isMfaEnabled(userId)
      setIsMfaEnabled(enabled)
      console.log('🆕 Fresh MFA status loaded:', enabled)
    } catch (error) {
      console.error('❌ Failed to load MFA status:', error)
      setError('Failed to load MFA status')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle MFA toggle
   */
  const handleMfaToggle = async (enabled: boolean) => {
    if (enabled && !isMfaEnabled) {
      // User wants to enable MFA - show setup modal with auto-generate
      setAutoGenerateSetup(true)
      setShowSetupModal(true)
      if (onSetupMfa) onSetupMfa()
    } else if (!enabled && isMfaEnabled) {
      // User wants to disable MFA
      setIsUpdating(true)
      setError(null)

      try {
        const success = await FreshMfaService.disableMfa(userId)

        if (success) {
          setIsMfaEnabled(false)
          console.log('✅ Fresh MFA disabled successfully')
        } else {
          setError('Failed to disable MFA')
        }
      } catch (error) {
        console.error('❌ Failed to disable MFA:', error)
        setError('Failed to disable MFA')
      } finally {
        setIsUpdating(false)
      }
    }
  }

  /**
   * Handle setup completion
   */
  const handleSetupComplete = () => {
    setIsMfaEnabled(true)
    console.log('✅ Fresh MFA setup completed')
  }

  // Add event listener for setup completion
  useEffect(() => {
    const handleMfaSetupComplete = () => {
      handleSetupComplete()
    }

    window.addEventListener('freshMfaSetupComplete', handleMfaSetupComplete)

    return () => {
      window.removeEventListener('freshMfaSetupComplete', handleMfaSetupComplete)
    }
  }, [])

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Shield className="w-6 h-6 text-blue-600 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Multi-Factor Authentication</h3>
            <p className="text-sm text-gray-600">
              Secure your account with time-based one-time passwords
            </p>
          </div>
        </div>

        <div className="flex items-center">
          {isMfaEnabled ? (
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Enabled</span>
            </div>
          ) : (
            <div className="flex items-center text-gray-500">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Disabled</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* MFA Status */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            {isMfaEnabled ? (
              <ShieldCheck className="w-8 h-8 text-green-600 mr-3" />
            ) : (
              <Shield className="w-8 h-8 text-gray-400 mr-3" />
            )}
            <div>
              <h4 className="font-medium text-gray-900">
                {isMfaEnabled ? 'MFA is Active' : 'MFA is Inactive'}
              </h4>
              <p className="text-sm text-gray-600">
                {isMfaEnabled
                  ? 'Your account is protected with multi-factor authentication'
                  : 'Enable MFA to secure your account with an additional layer of protection'
                }
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isMfaEnabled}
              onChange={(e) => handleMfaToggle(e.target.checked)}
              disabled={isUpdating}
              className="sr-only peer"
            />
            <div className={`w-11 h-6 ${isMfaEnabled ? 'bg-green-600' : 'bg-gray-200'} peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${isMfaEnabled ? 'after:translate-x-full after:border-white' : ''} dark:border-gray-600`}></div>
          </label>
        </div>

        {/* Setup Button */}
        {!isMfaEnabled && (
          <button
            onClick={() => {
              setAutoGenerateSetup(true)
              setShowSetupModal(true)
            }}
            disabled={isUpdating}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Settings className="w-5 h-5 mr-2" />
            Setup MFA
          </button>
        )}

        {/* Disable Button */}
        {isMfaEnabled && (
          <button
            onClick={() => handleMfaToggle(false)}
            disabled={isUpdating}
            className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isUpdating ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Disabling...
              </>
            ) : (
              'Disable MFA'
            )}
          </button>
        )}
      </div>

      {/* Security Note */}
      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-800">
          <strong>Security Note:</strong> Multi-factor authentication adds an extra layer of security to your account.
          We strongly recommend keeping it enabled to protect your healthcare data.
        </p>
      </div>

      {/* MFA Setup Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Setup Multi-Factor Authentication
                </h2>
                <button
                  onClick={() => {
                    setShowSetupModal(false)
                    setAutoGenerateSetup(false)
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4">
              <FreshMfaSetup
                userId={userId}
                userEmail={userEmail}
                autoGenerate={autoGenerateSetup}
                onSetupComplete={() => {
                  setShowSetupModal(false)
                  setAutoGenerateSetup(false)
                  setIsMfaEnabled(true)
                  window.dispatchEvent(new CustomEvent('freshMfaSetupComplete'))
                  console.log('✅ Fresh MFA setup completed via modal')
                }}
                onCancel={() => {
                  setShowSetupModal(false)
                  setAutoGenerateSetup(false)
                  console.log('❌ Fresh MFA setup cancelled via modal')
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}