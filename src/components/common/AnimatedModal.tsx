import React, { useEffect, useState } from 'react'
import { XIcon } from 'lucide-react'

interface AnimatedModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full'
  showCloseButton?: boolean
  closeOnBackdropClick?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  full: 'max-w-full mx-4'
}

export const AnimatedModal: React.FC<AnimatedModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  className = ''
}) => {
  const [isAnimating, setIsAnimating] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      // Small delay to ensure DOM is ready before animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    } else {
      setIsAnimating(false)
      // Delay unmounting to allow exit animation
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, 300) // Match animation duration
      // Restore body scroll
      document.body.style.overflow = ''
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onClose()
    }
  }

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Cleanup: restore body scroll
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!shouldRender) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleBackdropClick}
    >
      {/* Backdrop with blur effect */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-all duration-300 ${
          isAnimating ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 backdrop-blur-none'
        }`}
      />

      {/* Modal container with animation */}
      <div
        className={`relative w-full ${sizeClasses[size]} transform transition-all duration-300 ${
          isAnimating
            ? 'translate-y-0 scale-100 opacity-100'
            : '-translate-y-8 scale-95 opacity-0'
        }`}
      >
        {/* Modal content */}
        <div
          className={`bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden ${className}`}
          style={{
            animation: isAnimating ? 'modalSlideIn 0.3s ease-out' : 'none'
          }}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              {title && (
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="ml-auto p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label="Close modal"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>

      {/* Inline styles for animations */}
      <style>
        {`
          @keyframes modalSlideIn {
            from {
              transform: translateY(-2rem) scale(0.95);
              opacity: 0;
            }
            to {
              transform: translateY(0) scale(1);
              opacity: 1;
            }
          }

          @keyframes backdropFadeIn {
            from {
              opacity: 0;
              backdrop-filter: blur(0px);
            }
            to {
              opacity: 1;
              backdrop-filter: blur(12px);
            }
          }
        `}
      </style>
    </div>
  )
}
