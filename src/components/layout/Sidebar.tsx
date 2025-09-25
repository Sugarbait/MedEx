import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useCompanyLogos } from '@/hooks/useCompanyLogos'
// Removed old TOTP hook - using fresh MFA service
import {
  HomeIcon,
  PhoneIcon,
  BarChart3Icon,
  MessageSquareIcon,
  TrendingUpIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
  ActivityIcon,
  UserIcon
} from 'lucide-react'
// TOTP service not needed in sidebar - access controlled by TOTPProtectedRoute

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  user: any
}

const hasMFAAccess = (totpStatus: any): boolean => {
  // Use TOTP setup status to determine if protected routes should be shown
  const hasAccess = totpStatus.hasSetup && !totpStatus.isLoading

  console.log('Sidebar TOTP Access Check:', {
    hasSetup: totpStatus.hasSetup,
    isEnabled: totpStatus.isEnabled,
    isLoading: totpStatus.isLoading,
    error: totpStatus.error,
    finalAccess: hasAccess
  })

  if (hasAccess) {
    console.log('✅ User has TOTP setup - showing protected routes in sidebar')
  } else {
    console.log('🔒 User lacks TOTP setup - hiding protected routes in sidebar')
  }

  return hasAccess
}

const getNavigationItems = (user: any, totpStatus: any) => {
  const hasMFA = hasMFAAccess(totpStatus)

  return [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: HomeIcon,
      description: 'System overview'
    },
    // Protected pages - only show if user has MFA access
    ...(hasMFA ? [
      {
        name: 'Calls',
        href: '/calls',
        icon: PhoneIcon,
        description: 'Call management and analytics',
        requiresMFA: true
},
      {
        name: 'SMS',
        href: '/sms',
        icon: MessageSquareIcon,
        description: 'SMS management and analytics',
        requiresMFA: true
}
    ] : []),
    // Admin-only pages
    ...(user?.role === 'super_user' ? [{
      name: 'User Management',
      href: '/users',
      icon: UserIcon,
      description: 'Manage system users'
    }] : []),
    {
      name: 'Settings',
      href: '/settings',
      icon: SettingsIcon,
      description: 'System configuration'
    }
  ]
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, user }) => {
  const location = useLocation()
  const { logos } = useCompanyLogos()

  // Create a simple MFA status object (Fresh MFA system doesn't need complex status)
  const totpStatus = {
    hasSetup: true, // Always show routes - MFA will be handled by individual pages
    isLoading: false,
    isEnabled: true,
    error: null
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <NavLink to="/dashboard" className="hover:opacity-80 transition-opacity">
              <img
                src={logos.headerLogo || "https://nexasync.ca/images/Logo.png"}
                alt="CareXPS Logo"
                className="h-8 sm:h-10 w-auto object-contain cursor-pointer"
                referrerPolicy="no-referrer"
              />
            </NavLink>
          </div>
          <button
            onClick={onToggle}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close sidebar"
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>


        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {getNavigationItems(user, totpStatus).map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href

            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={`group flex items-center gap-3 px-3 py-3 sm:py-2 text-sm font-medium rounded-lg transition-all duration-200 min-h-[48px] sm:min-h-[auto] ${
                  isActive
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                onClick={() => {
                  // Close sidebar on mobile when navigation item is clicked
                  if (window.innerWidth < 1024) {
                    onToggle()
                  }
                }}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400'
                  }`}
                />
                <div className="flex-1">
                  <span>{item.name}</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.description}</p>
                </div>
                {isActive && (
                  <div className="w-2 h-2 bg-gray-600 dark:bg-gray-400 rounded-full"></div>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <ActivityIcon className="w-4 h-4" />
            <span>All activities are logged</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>System healthy</span>
          </div>
        </div>
      </div>
    </>
  )
}