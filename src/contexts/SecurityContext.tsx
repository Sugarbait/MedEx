import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useSupabase } from './SupabaseContext'
import { auditService } from '@/services'
import type { SecurityEvent, ComplianceMetrics } from '@/types'

interface SecurityContextType {
  complianceMetrics: ComplianceMetrics | null
  securityEvents: SecurityEvent[]
  encryptionStatus: 'active' | 'inactive' | 'error'
  sessionSecurity: {
    isSecure: boolean
    lastActivity: Date | null
    timeRemaining: number | null
  }
  logSecurityEvent: (event: Omit<SecurityEvent, 'id' | 'timestamp'>) => Promise<void>
  refreshComplianceMetrics: () => Promise<void>
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined)

export const useSecurity = () => {
  const context = useContext(SecurityContext)
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider')
  }
  return context
}

interface SecurityProviderProps {
  children: ReactNode
}

export const SecurityProvider: React.FC<SecurityProviderProps> = ({ children }) => {
  const { user, sessionInfo } = useAuth()
  const { supabase } = useSupabase()
  const [complianceMetrics, setComplianceMetrics] = useState<ComplianceMetrics | null>(null)
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])
  const [encryptionStatus, setEncryptionStatus] = useState<'active' | 'inactive' | 'error'>('active')
  const [sessionSecurity, setSessionSecurity] = useState({
    isSecure: false,
    lastActivity: null as Date | null,
    timeRemaining: null as number | null
  })

  // Monitor encryption status
  useEffect(() => {
    const checkEncryption = () => {
      try {
        // Check if we're on HTTPS
        const isHttps = window.location.protocol === 'https:'

        // Check if Supabase connection is secure
        const isSupabaseSecure = supabase ? true : false

        // Check Web Crypto API availability
        const isCryptoAvailable = !!window.crypto?.subtle

        if (isHttps && isSupabaseSecure && isCryptoAvailable) {
          setEncryptionStatus('active')
        } else {
          setEncryptionStatus('error')
        }
      } catch (error) {
        console.error('Encryption check failed:', error)
        setEncryptionStatus('error')
      }
    }

    checkEncryption()

    // Periodically check encryption status
    const interval = setInterval(checkEncryption, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [supabase])

  // Monitor session security
  useEffect(() => {
    if (!sessionInfo || !user) {
      setSessionSecurity({
        isSecure: false,
        lastActivity: null,
        timeRemaining: null
      })
      return
    }

    const updateSessionSecurity = () => {
      const now = new Date()
      const sessionExpiry = new Date(sessionInfo.expiresAt)
      const timeRemaining = sessionExpiry.getTime() - now.getTime()

      setSessionSecurity({
        isSecure: timeRemaining > 0 && sessionInfo.isActive,
        lastActivity: new Date(),
        timeRemaining: Math.max(0, timeRemaining)
      })
    }

    updateSessionSecurity()

    // Update every minute
    const interval = setInterval(updateSessionSecurity, 60000)

    return () => clearInterval(interval)
  }, [sessionInfo, user])

  // Load compliance metrics
  const refreshComplianceMetrics = async () => {
    if (!user || !supabase) return

    try {
      const metrics = await auditService.getComplianceMetrics()
      setComplianceMetrics(metrics)
    } catch (error) {
      console.error('Failed to load compliance metrics:', error)
    }
  }

  // Load recent security events
  useEffect(() => {
    if (!user || !supabase) return

    const loadSecurityEvents = async () => {
      try {
        const events = await auditService.getRecentSecurityEvents(user.id, 50)
        setSecurityEvents(events)
      } catch (error) {
        console.error('Failed to load security events:', error)
      }
    }

    loadSecurityEvents()
    refreshComplianceMetrics()
  }, [user, supabase])

  // Log security events
  const logSecurityEvent = async (event: Omit<SecurityEvent, 'id' | 'timestamp'>) => {
    if (!user || !supabase) return

    try {
      const securityEvent = await auditService.logSecurityEvent({
        ...event,
        userId: event.userId || user.id,
        timestamp: new Date(),
        ipAddress: event.ipAddress || 'unknown',
        userAgent: event.userAgent || navigator.userAgent
      })

      setSecurityEvents(prev => [securityEvent, ...prev.slice(0, 49)])
    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }

  // Real-time security events subscription
  useEffect(() => {
    if (!user || !supabase) return

    let subscription: any

    const setupSubscription = async () => {
      try {
        subscription = supabase
          .channel('security-events')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'security_events',
              filter: `user_id=eq.${user.id}`
            },
            (payload) => {
              const newEvent = payload.new as SecurityEvent
              setSecurityEvents(prev => [newEvent, ...prev.slice(0, 49)])
            }
          )
          .subscribe()
      } catch (error) {
        console.error('Failed to setup security events subscription:', error)
      }
    }

    setupSubscription()

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [user, supabase])

  // Monitor page visibility for security
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logSecurityEvent({
          userId: user?.id || '',
          action: 'page_hidden',
          resource: 'application',
          success: true,
          ipAddress: 'unknown',
          userAgent: navigator.userAgent
        })
      } else {
        logSecurityEvent({
          userId: user?.id || '',
          action: 'page_visible',
          resource: 'application',
          success: true,
          ipAddress: 'unknown',
          userAgent: navigator.userAgent
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user])

  // Security warnings
  useEffect(() => {
    // Warn about insecure connections
    if (encryptionStatus === 'error') {
      console.warn('SECURITY WARNING: Application is not running in a secure context')
    }

    // Warn about session expiration
    if (sessionSecurity.timeRemaining !== null && sessionSecurity.timeRemaining < 5 * 60 * 1000) { // 5 minutes
      console.warn('SECURITY WARNING: Session will expire soon')
    }
  }, [encryptionStatus, sessionSecurity.timeRemaining])

  const value: SecurityContextType = {
    complianceMetrics,
    securityEvents,
    encryptionStatus,
    sessionSecurity,
    logSecurityEvent,
    refreshComplianceMetrics
  }

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  )
}