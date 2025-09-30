/**
 * Session Timeout Warning Hook
 * Provides user-friendly warnings before session expiration
 *
 * Features:
 * - Configurable warning time before timeout
 * - Automatic session extension on user activity
 * - Toast notification before logout
 * - HIPAA-compliant session management
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export interface SessionTimeoutConfig {
  /** Total session timeout in milliseconds (default: 15 minutes) */
  timeoutMs?: number

  /** Warning time before timeout in milliseconds (default: 2 minutes) */
  warningMs?: number

  /** Events that count as user activity */
  activityEvents?: string[]

  /** Callback when timeout warning is triggered */
  onWarning?: () => void

  /** Callback when session times out */
  onTimeout?: () => void

  /** Callback when session is extended */
  onExtend?: () => void
}

export interface SessionTimeoutState {
  /** Time remaining until timeout in milliseconds */
  timeRemaining: number

  /** Whether warning is currently showing */
  showWarning: boolean

  /** Whether session has timed out */
  isTimedOut: boolean

  /** Manually extend the session */
  extendSession: () => void

  /** Get formatted time remaining */
  getTimeRemaining: () => string
}

const DEFAULT_CONFIG: Required<SessionTimeoutConfig> = {
  timeoutMs: 15 * 60 * 1000, // 15 minutes
  warningMs: 2 * 60 * 1000,   // 2 minutes
  activityEvents: [
    'mousedown',
    'mousemove',
    'keypress',
    'scroll',
    'touchstart',
    'click'
  ],
  onWarning: () => {},
  onTimeout: () => {},
  onExtend: () => {}
}

/**
 * Hook for managing session timeout with warnings
 */
export function useSessionTimeoutWarning(
  config: SessionTimeoutConfig = {}
): SessionTimeoutState {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }

  const [timeRemaining, setTimeRemaining] = useState(fullConfig.timeoutMs)
  const [showWarning, setShowWarning] = useState(false)
  const [isTimedOut, setIsTimedOut] = useState(false)

  const lastActivityRef = useRef<number>(Date.now())
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null)
  const warningTriggeredRef = useRef(false)

  /**
   * Reset the session timeout
   */
  const resetTimeout = useCallback(() => {
    lastActivityRef.current = Date.now()
    setTimeRemaining(fullConfig.timeoutMs)
    setShowWarning(false)
    setIsTimedOut(false)
    warningTriggeredRef.current = false
  }, [fullConfig.timeoutMs])

  /**
   * Handle user activity
   */
  const handleActivity = useCallback(() => {
    if (isTimedOut) return

    const now = Date.now()
    const timeSinceLastActivity = now - lastActivityRef.current

    // Only reset if significant time has passed (debounce)
    if (timeSinceLastActivity > 1000) {
      lastActivityRef.current = now
      setTimeRemaining(fullConfig.timeoutMs)

      if (showWarning) {
        setShowWarning(false)
        warningTriggeredRef.current = false
        fullConfig.onExtend()
        console.log('✅ Session extended due to user activity')
      }
    }
  }, [isTimedOut, showWarning, fullConfig])

  /**
   * Manually extend the session
   */
  const extendSession = useCallback(() => {
    resetTimeout()
    fullConfig.onExtend()
    console.log('✅ Session manually extended')
  }, [resetTimeout, fullConfig])

  /**
   * Format time remaining as human-readable string
   */
  const getTimeRemaining = useCallback((): string => {
    const minutes = Math.floor(timeRemaining / 60000)
    const seconds = Math.floor((timeRemaining % 60000) / 1000)

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }, [timeRemaining])

  /**
   * Update time remaining every second
   */
  useEffect(() => {
    if (isTimedOut) return

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - lastActivityRef.current
      const remaining = fullConfig.timeoutMs - elapsed

      if (remaining <= 0) {
        // Session timed out
        setIsTimedOut(true)
        setShowWarning(false)
        setTimeRemaining(0)
        fullConfig.onTimeout()
        console.warn('⏰ Session timed out due to inactivity')
        clearInterval(interval)
      } else {
        setTimeRemaining(remaining)

        // Show warning if within warning threshold
        if (remaining <= fullConfig.warningMs && !warningTriggeredRef.current) {
          setShowWarning(true)
          warningTriggeredRef.current = true
          fullConfig.onWarning()
          console.warn('⚠️ Session timeout warning:', getTimeRemaining())
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isTimedOut, fullConfig, getTimeRemaining])

  /**
   * Register activity listeners
   */
  useEffect(() => {
    if (typeof window === 'undefined') return

    fullConfig.activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      fullConfig.activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [handleActivity, fullConfig.activityEvents])

  return {
    timeRemaining,
    showWarning,
    isTimedOut,
    extendSession,
    getTimeRemaining
  }
}

/**
 * Lightweight session timeout hook (no warnings, just timeout)
 */
export function useSessionTimeout(
  timeoutMs: number = 15 * 60 * 1000,
  onTimeout: () => void
): void {
  const lastActivityRef = useRef<number>(Date.now())
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null)

  const resetTimeout = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current)
    }

    timeoutIdRef.current = setTimeout(() => {
      console.warn('⏰ Session timed out')
      onTimeout()
    }, timeoutMs)
  }, [timeoutMs, onTimeout])

  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    resetTimeout()
  }, [resetTimeout])

  useEffect(() => {
    resetTimeout()

    const events = ['mousedown', 'keypress', 'scroll', 'touchstart']
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }
      events.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [handleActivity, resetTimeout])
}

export default useSessionTimeoutWarning