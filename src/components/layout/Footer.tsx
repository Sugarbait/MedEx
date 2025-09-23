import React from 'react'
import { useCompanyLogos } from '@/hooks/useCompanyLogos'

interface FooterProps {
  variant?: 'default' | 'transparent'
}

export const Footer: React.FC<FooterProps> = ({ variant = 'default' }) => {
  const currentYear = new Date().getFullYear()
  const { logos } = useCompanyLogos()

  const backgroundClass = variant === 'transparent'
    ? 'bg-transparent'
    : 'bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700'

  return (
    <footer className={`${backgroundClass} py-4 px-6`}>
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
          {/* Light mode logo */}
          <img
            src={logos.footerLogoLight || "https://nexasync.ca/images/NexaSync-logo.png"}
            alt="NexaSync Logo"
            className="h-4 w-auto object-contain opacity-60 dark:hidden"
            referrerPolicy="no-referrer"
          />
          {/* Dark mode logo */}
          <img
            src={logos.footerLogoDark || "https://nexasync.ca/images/nexasync-white.png"}
            alt="NexaSync Logo"
            className="h-4 w-auto object-contain opacity-60 hidden dark:block"
            referrerPolicy="no-referrer"
          />
          <span className="text-xs">
            © {currentYear} NexaSync. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  )
}