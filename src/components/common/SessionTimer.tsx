import React, { useState, useEffect } from 'react'
import { ClockIcon, RefreshCwIcon, AlertTriangleIcon } from 'lucide-react'

interface SessionTimerProps {
  getTimeRemaining: () => number
  onExtendSession: () => void
  className?: string
}

export const SessionTimer: React.FC<SessionTimerProps> = ({
  getTimeRemaining,
  onExtendSession,
  className = ''
}) => {
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining())
  const [isExtending, setIsExtending] = useState(false)

  useEffect(() => {
    const updateTimer = () => {
      setTimeRemaining(getTimeRemaining())
    }

    // Update every second
    const interval = setInterval(updateTimer, 1000)

    // Update immediately
    updateTimer()

    return () => clearInterval(interval)
  }, [getTimeRemaining])

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getTimerState = (ms: number) => {
    const minutes = Math.floor(ms / (1000 * 60))

    if (minutes <= 2) {
      return {
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-950',
        borderColor: 'border-red-200 dark:border-red-800',
        iconColor: 'text-red-500 dark:text-red-400',
        pulse: true,
        urgency: 'critical'
      }
    } else if (minutes <= 5) {
      return {
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-950',
        borderColor: 'border-orange-200 dark:border-orange-800',
        iconColor: 'text-orange-500 dark:text-orange-400',
        pulse: false,
        urgency: 'warning'
      }
    } else {
      return {
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-50 dark:bg-green-950',
        borderColor: 'border-green-200 dark:border-green-800',
        iconColor: 'text-green-500 dark:text-green-400',
        pulse: false,
        urgency: 'normal'
      }
    }
  }

  const handleExtendSession = async () => {
    setIsExtending(true)
    onExtendSession()

    // Show feedback for a moment
    setTimeout(() => {
      setIsExtending(false)
    }, 1000)
  }

  const timerState = getTimerState(timeRemaining)

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300 ${timerState.bgColor} ${timerState.borderColor} ${timerState.pulse ? 'animate-pulse' : ''} ${className}`}>
      <div className="flex items-center gap-2">
        {timerState.urgency === 'critical' ? (
          <AlertTriangleIcon className={`w-4 h-4 ${timerState.iconColor}`} />
        ) : (
          <ClockIcon className={`w-4 h-4 ${timerState.iconColor}`} />
        )}

        <div className="flex flex-col">
          <span className={`text-sm font-medium ${timerState.color}`}>
            {formatTime(timeRemaining)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {timerState.urgency === 'critical'
              ? 'Session expiring!'
              : timerState.urgency === 'warning'
              ? 'Session ending soon'
              : 'Session time'
            }
          </span>
        </div>
      </div>

      {(timerState.urgency === 'critical' || timerState.urgency === 'warning') && (
        <button
          onClick={handleExtendSession}
          disabled={isExtending}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          title="Extend session"
        >
          <RefreshCwIcon className={`w-3 h-3 ${isExtending ? 'animate-spin' : ''}`} />
          {isExtending ? 'Extending...' : 'Extend'}
        </button>
      )}
    </div>
  )
}