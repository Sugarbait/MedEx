import React from 'react'
import { useAuth } from '@/contexts/AuthContext'

export const Header: React.FC = () => {
  const { user, logout } = useAuth()

  return (
    <header className="bg-white px-6 py-4 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-neutral-900">MedEx</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-neutral-900">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-neutral-500 capitalize">
                {user?.role === 'super_user' ? 'Super User' : user?.role?.replace('_', ' ') || 'Staff'}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}