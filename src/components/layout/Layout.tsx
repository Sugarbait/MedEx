import React, { ReactNode } from 'react'
import { Navigation } from './Navigation'
import { Header } from './SimpleHeader'
import { SecurityIndicator } from '../ui/SecurityIndicator'

interface LayoutProps {
  children: ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-gray-900">
      {/* Security Indicator */}
      <SecurityIndicator />

      {/* Desktop Layout */}
      <div className="hidden md:flex h-screen">
        {/* Fixed Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-b border-neutral-200 dark:border-gray-700">
          <Header />
        </div>

        {/* Sidebar Navigation - positioned below header */}
        <div className="w-64 flex-shrink-0 pt-16">
          <Navigation />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col pt-16">
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        <Header />
        <main className="p-4 pb-20">
          {children}
        </main>
        {/* Mobile Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-neutral-200 dark:border-gray-700 safe-bottom">
          <Navigation />
        </div>
      </div>
    </div>
  )
}