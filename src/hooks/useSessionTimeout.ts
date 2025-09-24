import { useEffect, useRef, useCallback } from 'react'
import { auditLogger, AuditAction, ResourceType, AuditOutcome } from '@/services/auditLogger'

interface UseSessionTimeoutProps {
  timeout: number // in milliseconds
  onTimeout: () => void
  user?: any
  enabled?: boolean
}

export const useSessionTimeout = ({
  timeout,
  onTimeout,
  user,
  enabled = true
}: UseSessionTimeoutProps) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const resetTimeout = useCallback(() => {
    if (!enabled) return

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Update last activity time
    lastActivityRef.current = Date.now()

    // Set new timeout
    timeoutRef.current = setTimeout(async () => {
      try {
        console.log('🚪 SECURITY: Session timeout triggered - performing secure logout')

        // Log session timeout for audit
        if (user) {
          await auditLogger.logAuthenticationEvent(
            AuditAction.LOGOUT,
            user.id,
            AuditOutcome.SUCCESS,
            {
              reason: 'session_timeout',
              timeout_duration: timeout,
              last_activity: new Date(lastActivityRef.current).toISOString()
            }
          )
        }

        // SECURITY ENHANCEMENT: Clear all authentication data on timeout
        try {
          // Clear MFA sessions
          localStorage.removeItem('freshMfaVerified')

          // Clear main authentication data
          localStorage.removeItem('currentUser')
          localStorage.removeItem('mfa_verified')

          // Clear user-specific data if user available
          if (user?.id) {
            localStorage.removeItem(`settings_${user.id}`)
            localStorage.removeItem(`user_settings_${user.id}`)
          }

          console.log('🚪 SECURITY: Authentication data cleared on session timeout')
        } catch (clearError) {
          console.error('Error clearing authentication data on timeout:', clearError)
        }
      } catch (error) {
        console.error('Failed to log session timeout:', error)
      } finally {
        onTimeout()
      }
    }, timeout)
  }, [timeout, onTimeout, user, enabled])

  const getTimeRemaining = useCallback((): number => {
    const elapsed = Date.now() - lastActivityRef.current
    return Math.max(0, timeout - elapsed)
  }, [timeout])

  const getTimeRemainingFormatted = useCallback((): string => {
    const remaining = getTimeRemaining()
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [getTimeRemaining])

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    // Activity events to monitor
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'focus'
    ]

    let activityThrottle: NodeJS.Timeout | null = null

    // Reset timeout on any activity (throttled to prevent excessive calls)
    const handleActivity = () => {
      if (!activityThrottle) {
        resetTimeout()
        activityThrottle = setTimeout(() => {
          activityThrottle = null
        }, 1000) // 1 second throttle
      }
    }

    // SECURITY FEATURE: Emergency logout on Ctrl+Shift+L
    const handleEmergencyLogout = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault()
        console.log('🚨 EMERGENCY LOGOUT TRIGGERED')

        try {
          // Log emergency logout
          if (user) {
            await auditLogger.logAuthenticationEvent(
              AuditAction.LOGOUT,
              user.id,
              AuditOutcome.SUCCESS,
              {
                reason: 'emergency_logout',
                timestamp: new Date().toISOString()
              }
            )
          }

          // Clear all authentication data immediately
          localStorage.clear()
          sessionStorage.clear()

          console.log('🚪 EMERGENCY: All data cleared')
        } catch (error) {
          console.error('Emergency logout error:', error)
          // Still clear basic data
          localStorage.clear()
          sessionStorage.clear()
        }

        onTimeout() // Trigger logout callback
      }
    }

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true, capture: true })
    })
    document.addEventListener('keydown', handleEmergencyLogout)

    // Initialize timeout
    resetTimeout()

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
      document.removeEventListener('keydown', handleEmergencyLogout)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (activityThrottle) {
        clearTimeout(activityThrottle)
      }
    }
  }, [resetTimeout, enabled, user, onTimeout])

  // Handle timeout value changes - reset timer with new timeout
  useEffect(() => {
    if (enabled && timeoutRef.current) {
      console.log('⏱️ Session timeout value changed, resetting timer with new timeout:', timeout / 60000, 'minutes')
      resetTimeout()
    }
  }, [timeout, enabled, resetTimeout])

  // Initialize emergency logout notification
  useEffect(() => {
    console.log('🚨 Emergency logout available: Press Ctrl+Shift+L to immediately logout and clear all data')
  }, [])

  return {
    resetTimeout,
    getTimeRemaining,
    getTimeRemainingFormatted
  }
}