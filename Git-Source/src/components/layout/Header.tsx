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
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="p-2 rounded-md hover:bg-gray-100 lg:hidden"
          >
            <MenuIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {pageTitle && (
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {pageTitle}
            </h1>
          </div>
        )}

        <div className="flex items-center gap-4">
          {/* Session Timer */}
          {getTimeRemaining && onExtendSession && (
            <SessionTimer
              getTimeRemaining={getTimeRemaining}
              onExtendSession={onExtendSession}
              className="hidden sm:flex"
            />
          )}

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  style={{ backgroundColor: '#ffffff' }}
                />
              ) : (
                <UserIcon className="w-4 h-4 text-blue-600" />
              )}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900">
                {user?.name || 'Healthcare User'}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user?.role?.replace('_', ' ') || 'Staff'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-900"
            title="Logout"
          >
            <LogOutIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  )
}