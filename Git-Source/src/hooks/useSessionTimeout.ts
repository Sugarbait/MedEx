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

    // Reset timeout on any activity
    const handleActivity = () => {
      resetTimeout()
    }

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true)
    })

    // Initialize timeout
    resetTimeout()

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [resetTimeout, enabled])

  return {
    resetTimeout,
    getTimeRemaining,
    getTimeRemainingFormatted
  }
}