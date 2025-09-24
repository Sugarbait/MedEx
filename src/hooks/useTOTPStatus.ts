/**
 * 🔒 LOCKED DOWN - NEVER TO BE MODIFIED 🔒
 *
 * Hook to check TOTP status for conditional rendering
 *
 * ⚠️ CRITICAL SECURITY WARNING ⚠️
 * This file is PERMANENTLY PROTECTED and must NEVER be modified.
 * TOTP status management is CRITICAL for MFA enforcement.
 *
 * MFA LOCKDOWN EFFECTIVE: December 24, 2024
 * PROTECTION LEVEL: MAXIMUM - DO NOT TOUCH
 *
 * See: MFA-LOCKDOWN-PROTECTION.md for complete lockdown details
 */

import { useState, useEffect } from 'react'
import { cleanTotpService } from '../services/cleanTotpService'

interface TOTPStatus {
  hasSetup: boolean    // Whether TOTP setup exists (for route visibility)
  isEnabled: boolean   // Whether TOTP is fully enabled
  isLoading: boolean
  error: string | null
}

export const useTOTPStatus = (userId: string | undefined): TOTPStatus => {
  const [status, setStatus] = useState<TOTPStatus>({
    hasSetup: false,
    isEnabled: false,
    isLoading: true,
    error: null
  })

  useEffect(() => {
    const checkTOTPStatus = async () => {
      if (!userId) {
        setStatus({
          hasSetup: false,
          isEnabled: false,
          isLoading: false,
          error: null
        })
        return
      }

      try {
        setStatus(prev => ({ ...prev, isLoading: true, error: null }))

        // Check both setup existence and enabled status
        const [hasSetup, isEnabled] = await Promise.all([
          cleanTotpService.hasTOTPSetup(userId),
          cleanTotpService.isTOTPEnabled(userId)
        ])

        setStatus({
          hasSetup,
          isEnabled,
          isLoading: false,
          error: null
        })
      } catch (error) {
        console.error('Failed to check TOTP status:', error)
        setStatus({
          hasSetup: false,
          isEnabled: false,
          isLoading: false,
          error: 'Failed to check TOTP status'
        })
      }
    }

    checkTOTPStatus()

    // Listen for TOTP status changes
    const handleTOTPStatusChange = () => {
      checkTOTPStatus()
    }

    window.addEventListener('totpStatusChanged', handleTOTPStatusChange)
    window.addEventListener('userSettingsUpdated', handleTOTPStatusChange)

    return () => {
      window.removeEventListener('totpStatusChanged', handleTOTPStatusChange)
      window.removeEventListener('userSettingsUpdated', handleTOTPStatusChange)
    }
  }, [userId])

  return status
}