import React, { useState, useEffect } from 'react'
import { AlertTriangleIcon, ClockIcon, XIcon } from 'lucide-react'

interface SessionTimeoutWarningProps {
  isVisible: boolean
  timeRemaining: number
  onExtendSession: () => void
  onLogout: () => void
  onDismiss: () => void
}

export const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  isVisible,
  timeRemaining,
  onExtendSession,
  onLogout,
  onDismiss
}) => {
  const [countdown, setCountdown] = useState(timeRemaining)

  useEffect(() => {
    setCountdown(timeRemaining)
  }, [timeRemaining])

  useEffect(() => {
    if (!isVisible || countdown <= 0) return

    const interval = setInterval(() => {
      setCountdown(prev => {
        const newValue = prev - 1000
        if (newValue <= 0) {
          onLogout()
          return 0
        }
        return newValue
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isVisible, countdown, onLogout])

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center">
                <AlertTriangleIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Session Expiring Soon
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Your session will expire due to inactivity
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <ClockIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span className="text-sm font-medium text-orange-800 dark:text-orange-300">
                Time Remaining
              </span>
            </div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatTime(countdown)}
            </div>
            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
              You will be automatically logged out when the timer reaches zero
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangleIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                HIPAA Security Notice
              </span>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Automatic logout protects patient health information (PHI) in compliance
              with HIPAA security regulations. Any unsaved changes will be lost.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onLogout}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Logout Now
            </button>
            <button
              onClick={onExtendSession}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Extend Session
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}