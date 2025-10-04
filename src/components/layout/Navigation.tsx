import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  HomeIcon,
  PhoneIcon,
  MessageSquareIcon,
  BarChart3Icon,
  SettingsIcon,
  ShieldCheckIcon
} from 'lucide-react'

const navigationItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
    permission: { resource: 'dashboard', action: 'read' }
  },
  {
    name: 'Calls',
    href: '/calls',
    icon: PhoneIcon,
    permission: { resource: 'calls', action: 'read' }
  },
  {
    name: 'SMS',
    href: '/sms',
    icon: MessageSquareIcon,
    permission: { resource: 'sms', action: 'read' }
  },
  {
    name: 'Analytics',
    href: '/calls/analytics',
    icon: BarChart3Icon,
    permission: { resource: 'analytics', action: 'read' }
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: SettingsIcon,
    permission: { resource: 'settings', action: 'read' }
  }
]

export const Navigation: React.FC = () => {
  const { hasPermission } = useAuth()

  const filteredItems = navigationItems.filter(item =>
    hasPermission(item.permission.resource, item.permission.action)
  )

  return (
    <nav className="h-full bg-white dark:bg-gray-800 border-r border-neutral-200 dark:border-gray-700 md:w-64 relative z-10">
      {/* Desktop Navigation */}
      <div className="hidden md:block h-full">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <ShieldCheckIcon className="w-8 h-8 text-primary-500" />
            <div>
              <h1 className="text-lg font-semibold text-neutral-900 dark:text-gray-100">MedEx</h1>
              <p className="text-sm text-neutral-600 dark:text-gray-400">Healthcare CRM</p>
            </div>
          </div>

          <div className="space-y-2">
            {filteredItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `healthcare-nav-item ${isActive ? 'active' : ''}`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </NavLink>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        <div className="flex justify-around py-2">
          {filteredItems.slice(0, 4).map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                    isActive
                      ? 'text-primary-600 bg-primary-50'
                      : 'text-neutral-600 dark:text-gray-400 hover:text-neutral-900 dark:hover:text-gray-100 dark:text-gray-100'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.name}</span>
              </NavLink>
            )
          })}
        </div>
      </div>
    </nav>
  )
}