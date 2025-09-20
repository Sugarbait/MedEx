import React from 'react'

interface FooterProps {
  variant?: 'default' | 'transparent'
}

export const Footer: React.FC<FooterProps> = ({ variant = 'default' }) => {
  const currentYear = new Date().getFullYear()

  const backgroundClass = variant === 'transparent'
    ? 'bg-transparent'
    : 'bg-white border-t border-gray-100'

  return (
    <footer className={`${backgroundClass} py-4 px-6`}>
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <img
            src="https://nexasync.ca/images/NexaSync-logo.png"
            alt="NexaSync Logo"
            className="h-4 w-auto object-contain opacity-60"
          />
          <span className="text-xs">
            © {currentYear} NexaSync. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  )
}