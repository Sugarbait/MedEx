import { useState, useEffect, useCallback } from 'react'
import { userSettingsService, UserSettingsData } from '@/services/userSettingsService'

interface UseUserSettingsReturn {
  settings: UserSettingsData | null
  loading: boolean
  error: string | null
  updateSettings: (updates: Partial<UserSettingsData>) => Promise<void>
}

/**
 * Simple hook for user settings with invisible cloud sync
 */
export function useUserSettings(userId?: string): UseUserSettingsReturn {
  const [settings, setSettings] = useState<UserSettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load settings on mount and when userId changes
  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    let mounted = true

    const loadSettings = async () => {
      try {
        setLoading(true)
        setError(null)

        const settingsData = await userSettingsService.getUserSettings(userId)

        if (mounted) {
          setSettings(settingsData)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load settings')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    // Set up real-time subscription
    userSettingsService.subscribeToSettings(userId, (updatedSettings) => {
      if (mounted) {
        setSettings(updatedSettings)
      }
    })

    loadSettings()

    return () => {
      mounted = false
      userSettingsService.unsubscribeFromSettings(userId)
    }
  }, [userId])

  // Update settings function
  const updateSettings = useCallback(async (updates: Partial<UserSettingsData>) => {
    if (!userId) return

    try {
      setError(null)
      const newSettings = await userSettingsService.updateUserSettings(userId, updates)
      setSettings(newSettings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings')
      throw err
    }
  }, [userId])

  return {
    settings,
    loading,
    error,
    updateSettings
  }
}

/**
 * Hook for theme settings specifically
 */
export function useThemeSettings(userId: string | undefined) {
  const { settings, updateSettings } = useUserSettings(userId)

  const setTheme = useCallback(async (theme: 'light' | 'dark' | 'auto') => {
    await updateSettings({ theme })
  }, [updateSettings])

  const toggleTheme = useCallback(async () => {
    const currentTheme = settings?.theme || 'light'
    const newTheme = currentTheme === 'light' ? 'dark' : 'light'
    await setTheme(newTheme)
  }, [settings?.theme, setTheme])

  return {
    theme: settings?.theme || 'light',
    setTheme,
    toggleTheme,
    isDark: settings?.theme === 'dark',
    isLight: settings?.theme === 'light',
    isAuto: settings?.theme === 'auto'
  }
}

/**
 * Hook for notification settings
 */
export function useNotificationSettings(userId: string | undefined) {
  const { settings, updateSettings } = useUserSettings(userId)

  const updateNotification = useCallback(async (
    type: keyof NonNullable<UserSettingsData['notifications']>,
    enabled: boolean
  ) => {
    const currentNotifications = settings?.notifications || {
      email: true,
      sms: true,
      push: true,
      in_app: true,
      call_alerts: true,
      sms_alerts: true,
      security_alerts: true
    }

    await updateSettings({
      notifications: {
        ...currentNotifications,
        [type]: enabled
      }
    })
  }, [settings?.notifications, updateSettings])

  return {
    notifications: settings?.notifications,
    updateNotification
  }
}

/**
 * Hook for Retell configuration
 */
export function useRetellSettings(userId: string | undefined) {
  const { settings, updateSettings } = useUserSettings(userId)

  const updateRetellConfig = useCallback(async (config: {
    api_key?: string
    call_agent_id?: string
    sms_agent_id?: string
  }) => {
    const currentConfig = settings?.retell_config || {}

    await updateSettings({
      retell_config: {
        ...currentConfig,
        ...config
      }
    })
  }, [settings?.retell_config, updateSettings])

  return {
    retellConfig: settings?.retell_config,
    updateRetellConfig,
    hasApiKey: !!(settings?.retell_config?.api_key),
    hasCallAgent: !!(settings?.retell_config?.call_agent_id),
    hasSmsAgent: !!(settings?.retell_config?.sms_agent_id)
  }
}