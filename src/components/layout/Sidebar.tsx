import React, { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useCompanyLogos } from '@/hooks/useCompanyLogos'
import FreshMfaService from '@/services/freshMfaService'
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
  UserIcon,
  Shield,
  AlertTriangle
} from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  user: any
}

interface MfaStatus {
  isLoading: boolean
  hasSetup: boolean
  isEnabled: boolean
  error: string | null
}

const getNavigationItems = (user: any, mfaStatus: MfaStatus) => {
  const hasMFA = mfaStatus.hasSetup && mfaStatus.isEnabled

  return [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: HomeIcon,
      description: 'System overview'
    },
    // Protected pages - show with indication if MFA required
    {
      name: 'Calls',
      href: '/calls',
      icon: PhoneIcon,
      description: hasMFA ? 'Call management and analytics' : 'Requires MFA setup',
      requiresMFA: true,
      mfaEnabled: hasMFA
    },
    {
      name: 'SMS',
      href: '/sms',
      icon: MessageSquareIcon,
      description: hasMFA ? 'SMS management and analytics' : 'Requires MFA setup',
      requiresMFA: true,
      mfaEnabled: hasMFA
    },
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

  const [mfaStatus, setMfaStatus] = useState<MfaStatus>({
    isLoading: true,
    hasSetup: false,
    isEnabled: false,
    error: null
  })

  useEffect(() => {
    checkMfaStatus()

    // Listen for MFA status changes
    const handleMfaStatusChange = () => {
      checkMfaStatus()
    }

    window.addEventListener('totpStatusChanged', handleMfaStatusChange)
    window.addEventListener('mfaSetupCompleted', handleMfaStatusChange)

    return () => {
      window.removeEventListener('totpStatusChanged', handleMfaStatusChange)
      window.removeEventListener('mfaSetupCompleted', handleMfaStatusChange)
    }
  }, [user?.id])

  const checkMfaStatus = async () => {
    if (!user?.id) {
      setMfaStatus({
        isLoading: false,
        hasSetup: false,
        isEnabled: false,
        error: null
      })
      return
    }

    setMfaStatus(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const isEnabled = await FreshMfaService.isMfaEnabled(user.id)

      setMfaStatus({
        isLoading: false,
        hasSetup: isEnabled,
        isEnabled: isEnabled,
        error: null
      })

      console.log('🛡️ Sidebar MFA Status Check:', {
        userId: user.id,
        hasSetup: isEnabled,
        isEnabled: isEnabled,
        hasMFA: isEnabled,
        willShowMFARequired: !isEnabled
      })

      // Force re-render of navigation items
      setTimeout(() => {
        console.log('🔄 Sidebar forcing navigation refresh after MFA status change')
      }, 100)

    } catch (error: any) {
      console.error('MFA status check failed:', error)
      setMfaStatus({
        isLoading: false,
        hasSetup: false,
        isEnabled: false,
        error: error.message || 'Failed to check MFA status'
      })
    }
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
          <div className="flex items-center justify-center gap-3 flex-1">
            <NavLink to="/dashboard" className="hover:opacity-80 transition-opacity">
              <img
                src={logos.headerLogo || "https://nexasync.ca/images/Logo.png"}
                alt="MedEx Logo"
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
          {getNavigationItems(user, mfaStatus).map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href
            const requiresMFA = item.requiresMFA
            const mfaEnabled = item.mfaEnabled

            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={`group flex items-center gap-3 px-3 py-3 sm:py-2 text-sm font-medium rounded-lg transition-all duration-200 min-h-[48px] sm:min-h-[auto] ${
                  isActive
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    : requiresMFA && !mfaEnabled
                    ? 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                    isActive
                      ? 'text-gray-700 dark:text-gray-300'
                      : requiresMFA && !mfaEnabled
                      ? 'text-gray-400 dark:text-gray-500'
                      : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400'
                  }`}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={requiresMFA && !mfaEnabled ? 'text-gray-400 dark:text-gray-500' : ''}>{item.name}</span>
                    {requiresMFA && (
                      mfaEnabled ? (
                        <Shield className="w-3 h-3 text-green-600 dark:text-green-400" title="MFA Protected" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" title="MFA Required" />
                      )
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ${
                    requiresMFA && !mfaEnabled
                      ? 'text-amber-600 dark:text-amber-400'
                      : requiresMFA && mfaEnabled
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {item.description}
                  </p>
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
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-[10px] text-gray-400 dark:text-gray-500 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Version:</span>
                <span className="font-mono">{import.meta.env.VITE_APP_VERSION || '1.1.0'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Build:</span>
                <span className="font-mono text-[9px]">{import.meta.env.VITE_GIT_COMMIT_HASH?.substring(0, 7) || 'dev'}</span>
              </div>
              <div className="text-center text-[9px] text-gray-400 dark:text-gray-600 mt-1">
                Last updated: {import.meta.env.VITE_BUILD_DATE || new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}