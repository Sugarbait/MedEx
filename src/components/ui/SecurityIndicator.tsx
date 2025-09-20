import React from 'react'
import { useSecurity } from '@/contexts/SecurityContext'
import { ShieldCheckIcon, ShieldXIcon, AlertTriangleIcon } from 'lucide-react'

export const SecurityIndicator: React.FC = () => {
  const { encryptionStatus, sessionSecurity } = useSecurity()

  if (encryptionStatus === 'active' && sessionSecurity.isSecure) {
    return null // Don't show indicator when everything is secure
  }

  const getIndicatorContent = () => {
    if (encryptionStatus === 'error') {
      return {
        icon: ShieldXIcon,
        text: 'Insecure Connection',
        className: 'bg-danger-500 text-white'
      }
    }

    if (!sessionSecurity.isSecure) {
      return {
        icon: AlertTriangleIcon,
        text: 'Session Expired',
        className: 'bg-warning-500 text-white'
      }
    }

    return {
      icon: ShieldCheckIcon,
      text: 'Secure',
      className: 'bg-success-500 text-white'
    }
  }

  const { icon: Icon, text, className } = getIndicatorContent()

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${className} px-4 py-2`}>
      <div className="flex items-center justify-center gap-2 text-sm font-medium">
        <Icon className="w-4 h-4" />
        <span>{text}</span>
      </div>
    </div>
  )
}