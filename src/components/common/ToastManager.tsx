import React, { useState, useEffect } from 'react'
import { ToastNotification, ToastNotificationData } from './ToastNotification'
import { toastNotificationService } from '@/services/toastNotificationService'

interface ToastManagerProps {
  userId?: string
}

export const ToastManager: React.FC<ToastManagerProps> = ({ userId }) => {
  const [toasts, setToasts] = useState<ToastNotificationData[]>([])
  const [preferences] = useState(toastNotificationService.getPreferences())

  console.log('🔔 ToastManager render - userId: [USER-ID-REDACTED - HIPAA PROTECTED], toasts count:', toasts.length)

  useEffect(() => {
    if (!userId) return

    // Initialize the service
    toastNotificationService.initialize(userId)

    // Subscribe to new notifications
    const unsubscribe = toastNotificationService.subscribe((notification) => {
      console.log('🔔 ToastManager received notification:', notification)
      setToasts(current => {
        // Limit to maximum 3 toasts to prevent screen overflow
        const newToasts = [notification, ...current.slice(0, 2)]
        console.log('🔔 ToastManager updated toasts count:', newToasts.length)
        return newToasts
      })
    })

    return () => {
      unsubscribe()
    }
  }, [userId])

  const handleDismiss = (id: string) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }

  const handleClose = (id: string) => {
    // User clicked the toast - could navigate to relevant page in future
    console.log(`Toast clicked: ${id}`)
    handleDismiss(id)
  }

  // Don't render anything if no userId or no toasts
  if (!userId || toasts.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none space-y-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto"
        >
          <ToastNotification
            notification={toast}
            onDismiss={handleDismiss}
            onClose={handleClose}
            soundEnabled={preferences.soundEnabled}
          />
        </div>
      ))}
    </div>
  )
}