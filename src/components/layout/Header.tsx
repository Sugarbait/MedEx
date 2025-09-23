import React from 'react'
import { MenuIcon, UserIcon, LogOutIcon } from 'lucide-react'
import { SessionTimer } from '../common/SessionTimer'

interface HeaderProps {
  user: any
  onMenuToggle: () => void
  sidebarOpen: boolean
  onLogout: () => void
  pageTitle?: string
  getTimeRemaining?: () => number
  onExtendSession?: () => void
}

export const Header: React.FC<HeaderProps> = ({ user, onMenuToggle, sidebarOpen, onLogout, pageTitle, getTimeRemaining, onExtendSession }) => {
  const handleLogout = () => {
    onLogout()
  }

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onMenuToggle}
            className="p-2 sm:p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Toggle menu"
          >
            <MenuIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>

          {/* Mobile page title - positioned next to menu button */}
          {pageTitle && (
            <div className="lg:hidden">
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate max-w-[150px] sm:max-w-[200px]">
                {pageTitle}
              </h1>
            </div>
          )}
        </div>

        {/* Desktop page title - centered */}
        {pageTitle && (
          <div className="hidden lg:block absolute left-1/2 transform -translate-x-1/2">
            <h1 className="text-3xl xl:text-4xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {pageTitle}
            </h1>
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Session Timer */}
          {getTimeRemaining && onExtendSession && (
            <SessionTimer
              getTimeRemaining={getTimeRemaining}
              onExtendSession={onExtendSession}
              className="hidden sm:flex"
            />
          )}

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center overflow-hidden">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  style={{ backgroundColor: '#ffffff' }}
                />
              ) : (
                <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-300" />
              )}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {user?.name || 'Healthcare User'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {user?.role?.replace('_', ' ') || 'Staff'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Logout"
            aria-label="Logout"
          >
            <LogOutIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  )
}