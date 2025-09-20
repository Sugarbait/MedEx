import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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
import { mfaService } from '@/services/mfaService'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  user: any
}

const hasMFAAccess = (user: any): boolean => {
  if (!user?.id) return false

  try {
    // Check if user has valid MFA session using MFA service
    const currentSession = mfaService.getCurrentSession(user.id)

    console.log('Sidebar MFA Access Check:', {
      userId: user.id,
      userEmail: user.email,
      hasValidSession: !!currentSession,
      sessionExpiry: currentSession?.expiresAt,
      mfaVerifiedFallback: localStorage.getItem('mfa_verified') === 'true'
    })

    // Return true if valid session exists OR fallback verification is true
    const hasAccess = !!currentSession || localStorage.getItem('mfa_verified') === 'true'

    if (hasAccess) {
      console.log('✅ User has MFA access - showing full sidebar')
    } else {
      console.log('🔒 User lacks MFA access - showing limited sidebar')
    }

    return hasAccess
  } catch (error) {
    console.error('Error checking MFA access:', error)
    // Fallback to localStorage check
    return localStorage.getItem('mfa_verified') === 'true'
  }
}

const getNavigationItems = (user: any) => {
  const hasMFA = hasMFAAccess(user)

  return [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: HomeIcon,
      description: 'Overview and system status'
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
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <NavLink to="/dashboard" className="hover:opacity-80 transition-opacity">
              <img
                src="https://carexps.nexasync.ca/images/Logo.png"
                alt="CareXPS Logo"
                className="h-10 w-auto object-contain cursor-pointer"
              />
            </NavLink>
          </div>
          <button
            onClick={onToggle}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>


        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {getNavigationItems(user).map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href

            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={`group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
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