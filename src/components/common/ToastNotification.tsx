import React, { useState, useEffect } from 'react'
import { X, Phone, MessageSquare, Bell } from 'lucide-react'

export interface ToastNotificationData {
  id: string
  type: 'call' | 'sms'
  title: string
  timestamp: Date
  recordId: string
}

interface ToastNotificationProps {
  notification: ToastNotificationData
  onDismiss: (id: string) => void
  onClose: (id: string) => void
  soundEnabled?: boolean
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  notification,
  onDismiss,
  onClose,
  soundEnabled = true
}) => {
  const [isVisible, setIsVisible] = useState(true)
  const [isAnimating, setIsAnimating] = useState(false)

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss()
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  // Play gentle notification sound
  useEffect(() => {
    if (soundEnabled && isVisible) {
      playNotificationSound()
    }
  }, [soundEnabled, isVisible])

  const playNotificationSound = () => {
    try {
      // Create a gentle notification sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Gentle bell-like sound: 800Hz for 0.1s then 600Hz for 0.2s
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1)

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch (error) {
      // Fallback: no sound if Web Audio API not available
      console.log('Audio notification not available')
    }
  }

  const handleDismiss = () => {
    setIsAnimating(true)
    setTimeout(() => {
      setIsVisible(false)
      onDismiss(notification.id)
    }, 200)
  }

  const handleClick = () => {
    onClose(notification.id)
    handleDismiss()
  }

  if (!isVisible) return null

  const getIcon = () => {
    switch (notification.type) {
      case 'call':
        return <Phone className="w-5 h-5 text-blue-500" />
      case 'sms':
        return <MessageSquare className="w-5 h-5 text-green-500" />
      default:
        return <Bell className="w-5 h-5 text-gray-500" />
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      className={`
        relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
        rounded-lg shadow-lg p-3 cursor-pointer transition-all duration-200
        hover:shadow-xl hover:scale-105
        ${isAnimating ? 'opacity-0 transform translate-x-full' : 'opacity-100 transform translate-x-0'}
      `}
      style={{
        minWidth: '280px',
        maxWidth: '320px'
      }}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {notification.title}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatTime(notification.timestamp)}
            </div>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDismiss()
          }}
          className="ml-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                     transition-colors rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar for auto-dismiss */}
      <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
        <div
          className="bg-blue-500 h-1 rounded-full transition-all duration-5000 ease-linear"
          style={{ animation: 'shrink 5s linear forwards' }}
        />
      </div>

      <style>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  )
}