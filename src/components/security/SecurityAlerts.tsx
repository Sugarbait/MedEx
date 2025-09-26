import React, { useEffect, useState } from 'react'
import { AlertTriangle, Shield, Lock, X } from 'lucide-react'

interface SecurityAlert {
  id: string
  type: 'warning' | 'danger' | 'info'
  message: string
  timestamp: Date
}

export const SecurityAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [showBadge, setShowBadge] = useState(false)

  useEffect(() => {
    // Listen for security events from our monitoring services
    const checkSecurityEvents = () => {
      try {
        // Check for recent security events in localStorage
        const incidentData = localStorage.getItem('recent_security_incidents')
        if (incidentData) {
          const incidents = JSON.parse(incidentData)
          const recentIncidents = incidents.filter((i: any) => {
            const incidentTime = new Date(i.timestamp).getTime()
            const now = Date.now()
            return now - incidentTime < 300000 // Last 5 minutes
          })

          if (recentIncidents.length > 0) {
            const newAlerts = recentIncidents.map((incident: any) => ({
              id: `${incident.type}_${incident.timestamp}`,
              type: incident.severity === 'high' ? 'danger' : incident.severity === 'medium' ? 'warning' : 'info',
              message: incident.message || formatIncidentMessage(incident),
              timestamp: new Date(incident.timestamp)
            }))

            setAlerts(prev => {
              // Avoid duplicates
              const existingIds = new Set(prev.map(a => a.id))
              const uniqueNew = newAlerts.filter((a: SecurityAlert) => !existingIds.has(a.id))
              return [...prev, ...uniqueNew].slice(-5) // Keep only last 5 alerts
            })

            setShowBadge(true)
          }
        }
      } catch (error) {
        console.error('Error checking security events:', error)
      }
    }

    // Check immediately and then every 30 seconds
    checkSecurityEvents()
    const interval = setInterval(checkSecurityEvents, 30000)

    // Listen for custom security events
    const handleSecurityEvent = (event: CustomEvent) => {
      const alert: SecurityAlert = {
        id: `${Date.now()}_${Math.random()}`,
        type: event.detail.severity || 'warning',
        message: event.detail.message,
        timestamp: new Date()
      }
      setAlerts(prev => [...prev, alert].slice(-5))
      setShowBadge(true)
    }

    window.addEventListener('securityAlert', handleSecurityEvent as EventListener)

    return () => {
      clearInterval(interval)
      window.removeEventListener('securityAlert', handleSecurityEvent as EventListener)
    }
  }, [])

  const formatIncidentMessage = (incident: any): string => {
    switch (incident.type) {
      case 'failed_login':
        return `Failed login attempt from IP: ${incident.ip || 'Unknown'}`
      case 'account_locked':
        return `Account locked due to multiple failed attempts`
      case 'suspicious_activity':
        return `Suspicious activity detected: ${incident.details || 'Review audit logs'}`
      case 'integrity_violation':
        return `Data integrity check failed - potential tampering detected`
      case 'certificate_issue':
        return `SSL certificate issue detected - verify security`
      default:
        return `Security event: ${incident.type}`
    }
  }

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
    if (alerts.length <= 1) {
      setShowBadge(false)
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'danger':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <Shield className="h-4 w-4 text-yellow-500" />
      default:
        return <Lock className="h-4 w-4 text-blue-500" />
    }
  }

  const getAlertClass = (type: string) => {
    switch (type) {
      case 'danger':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
    }
  }

  if (alerts.length === 0) return null

  return (
    <>
      {/* Security Badge in Header */}
      {showBadge && (
        <div className="fixed top-4 right-20 z-50">
          <div className="relative">
            <Shield className="h-6 w-6 text-red-500 animate-pulse" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
              {alerts.length}
            </span>
          </div>
        </div>
      )}

      {/* Alert Notifications */}
      <div className="fixed top-16 right-4 z-40 space-y-2 max-w-sm">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={`${getAlertClass(alert.type)} border rounded-lg p-3 shadow-lg transition-all duration-300 animate-slide-in-right`}
          >
            <div className="flex items-start gap-2">
              {getAlertIcon(alert.type)}
              <div className="flex-1">
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {alert.message}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// Add animation styles
const style = document.createElement('style')
style.textContent = `
  @keyframes slide-in-right {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  .animate-slide-in-right {
    animation: slide-in-right 0.3s ease-out;
  }
`
document.head.appendChild(style)