/**
 * Hook to check TOTP status for conditional rendering
 */

import { useState, useEffect } from 'react'
import { totpService } from '../services/totpService'

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
          totpService.hasTOTPSetup(userId),
          totpService.isTOTPEnabled(userId)
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