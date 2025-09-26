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

  // State for dynamically loaded avatar
  const [dynamicAvatar, setDynamicAvatar] = React.useState<string | null>(null)
  const [avatarLoading, setAvatarLoading] = React.useState(false)
  const [avatarLoadAttempted, setAvatarLoadAttempted] = React.useState(false)

  // Reset states when user changes
  React.useEffect(() => {
    if (user) {
      setAvatarLoadAttempted(false)
      setDynamicAvatar(null)
      setAvatarLoading(false)
      console.log('Header: User data received:', {
        id: user.id,
        name: user.name,
        email: user.email,
        hasAvatar: !!user.avatar,
        avatarUrl: user.avatar ? user.avatar.substring(0, 50) + '...' : 'none'
      })
    }
  }, [user?.id])

  // Active avatar loading if user doesn't have avatar (only attempt once per user)
  React.useEffect(() => {
    if (user?.id && !user.avatar && !avatarLoading && !dynamicAvatar && !avatarLoadAttempted) {
      setAvatarLoading(true)
      setAvatarLoadAttempted(true)
      console.log('Header: User missing avatar, attempting to load from storage...')

      // Try to load avatar from multiple storage locations
      const loadAvatar = async () => {
        try {
          // 1. Check direct avatar storage
          const directAvatar = localStorage.getItem(`avatar_data_${user.id}`)
          if (directAvatar && directAvatar.startsWith('data:image/')) {
            console.log('Header: Found avatar in direct storage')
            setDynamicAvatar(directAvatar)
            setAvatarLoading(false)
            return
          }

          // 2. Check avatar info storage
          const avatarInfo = localStorage.getItem(`avatar_${user.id}`)
          if (avatarInfo) {
            try {
              const parsedInfo = JSON.parse(avatarInfo)
              if (parsedInfo.url) {
                console.log('Header: Found avatar in avatar info storage')
                setDynamicAvatar(parsedInfo.url)
                setAvatarLoading(false)
                return
              }
            } catch (parseError) {
              console.warn('Header: Failed to parse avatar info:', parseError)
            }
          }

          // 3. Try loading via avatarStorageService
          try {
            const { avatarStorageService } = await import('../../services/avatarStorageService')
            const avatarUrl = await avatarStorageService.getAvatarUrl(user.id)
            if (avatarUrl) {
              console.log('Header: Found avatar via avatarStorageService')
              setDynamicAvatar(avatarUrl)
              setAvatarLoading(false)
              return
            }
          } catch (serviceError) {
            console.warn('Header: Failed to load via avatarStorageService:', serviceError)
          }

          // Only log once, no flooding
          setAvatarLoading(false)
        } catch (error) {
          console.error('Header: Error loading avatar:', error)
          setAvatarLoading(false)
        }
      }

      loadAvatar()
    }
  }, [user?.id, user?.avatar])

  // Determine which avatar to display
  const displayAvatar = user?.avatar || dynamicAvatar

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
            <div className="relative w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center overflow-hidden">
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  style={{ backgroundColor: '#ffffff' }}
                  onError={(e) => {
                    console.warn('Header: Avatar failed to load:', displayAvatar)
                    // Hide the broken image and show fallback
                    e.currentTarget.style.display = 'none'
                    // Show the UserIcon instead
                    const fallbackIcon = e.currentTarget.parentElement?.querySelector('.fallback-icon')
                    if (fallbackIcon) {
                      fallbackIcon.style.display = 'block'
                    }
                  }}
                  onLoad={() => {
                    console.log('Header: Avatar loaded successfully:', displayAvatar?.substring(0, 50) + '...')
                  }}
                />
              ) : null}
              {/* Fallback icon - always present but hidden when avatar loads */}
              <UserIcon
                className={`w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-300 fallback-icon ${displayAvatar ? 'hidden' : 'block'}`}
              />
              {/* Loading indicator when avatar is loading */}
              {avatarLoading && !displayAvatar && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {user?.name || user?.email || 'User'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.role === 'super_user' ? 'Super User' : user?.email || user?.name || 'User'}
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