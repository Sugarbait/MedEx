import React, { useEffect } from 'react'
import { auditLogger, AuditAction, ResourceType, AuditOutcome } from '@/services/auditLogger'

interface AuditLoggerProps {
  user: any
}

export const AuditLogger: React.FC<AuditLoggerProps> = ({ user }) => {
  useEffect(() => {
    if (!user) return

    const logPageView = async (path: string) => {
      try {
        // Use PHIAccess for system navigation logging
        await auditLogger.logPHIAccess(
          AuditAction.VIEW,
          ResourceType.SYSTEM,
          `page:${path}`,
          AuditOutcome.SUCCESS,
          {
            page_path: path,
            session_id: localStorage.getItem('carexps-auth') || 'demo-session'
          }
        )
      } catch (error) {
        console.warn('Audit logging failed:', error)
      }
    }

    const logUserAction = async (action: string, details: any = {}) => {
      try {
        // Map string action to AuditAction enum
        const auditAction = action === 'user_interaction' ? AuditAction.VIEW :
                           action === 'form_submission' ? AuditAction.CREATE :
                           action === 'session_heartbeat' ? AuditAction.SYSTEM_ACCESS :
                           AuditAction.VIEW

        await auditLogger.logPHIAccess(
          auditAction,
          ResourceType.SYSTEM,
          `user_action:${action}`,
          AuditOutcome.SUCCESS,
          {
            ...details,
            session_id: localStorage.getItem('carexps-auth') || 'demo-session'
          }
        )
      } catch (error) {
        console.warn('Audit logging failed:', error)
      }
    }

    // Log initial page load
    logPageView(window.location.pathname)

    // Listen for navigation changes
    const handleLocationChange = () => {
      logPageView(window.location.pathname)
    }

    // Listen for user interactions
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'BUTTON' || target.tagName === 'A') {
        logUserAction('user_interaction', {
          element_type: target.tagName,
          element_text: target.textContent?.slice(0, 50),
          element_id: target.id,
          element_class: target.className
        })
      }
    }

    // Monitor form submissions for HIPAA compliance
    const handleFormSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement
      logUserAction('form_submission', {
        form_id: form.id,
        form_action: form.action,
        form_method: form.method
      })
    }

    // Add event listeners
    window.addEventListener('popstate', handleLocationChange)
    document.addEventListener('click', handleClick)
    document.addEventListener('submit', handleFormSubmit)

    // Log session activity every 5 minutes for HIPAA compliance
    const sessionInterval = setInterval(() => {
      logUserAction('session_heartbeat', {
        active_time: Date.now() - (parseInt(localStorage.getItem('session_start') || '0') || Date.now())
      })
    }, 5 * 60 * 1000) // 5 minutes

    // Set session start time if not exists
    if (!localStorage.getItem('session_start')) {
      localStorage.setItem('session_start', Date.now().toString())
    }

    // Cleanup function
    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      document.removeEventListener('click', handleClick)
      document.removeEventListener('submit', handleFormSubmit)
      clearInterval(sessionInterval)
    }
  }, [user])

  // This component doesn't render anything - it's purely for logging
  return null
}