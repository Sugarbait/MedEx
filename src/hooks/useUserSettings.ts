import { useState, useEffect, useCallback, useRef } from 'react'
import { UserSettings, ServiceResponse } from '@/types/supabase'
import { UserSettingsService } from '@/services/userSettingsService'

interface UseUserSettingsReturn {
  settings: UserSettings | null
  loading: boolean
  error: string | null
  isOnline: boolean
  syncStatus: {
    lastSynced: string | null
    needsSync: boolean
    hasPendingChanges: boolean
    deviceCount?: number
  } | null

  // Actions
  updateSettings: (updates: Partial<UserSettings>, optimistic?: boolean) => Promise<ServiceResponse<UserSettings>>
  forceSync: () => Promise<ServiceResponse<UserSettings>>
  refreshSyncStatus: () => Promise<void>
  exportSettings: () => Promise<ServiceResponse<any>>
  importSettings: (settingsData: Partial<UserSettings>, overwrite?: boolean) => Promise<ServiceResponse<UserSettings>>
}

/**
 * Enhanced hook for user settings with cross-device synchronization
 */
export function useUserSettings(userId?: string): UseUserSettingsReturn {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [syncStatus, setSyncStatus] = useState<{
    lastSynced: string | null
    needsSync: boolean
    hasPendingChanges: boolean
    deviceCount?: number
  } | null>(null)

  const unsubscribeRef = useRef<(() => void) | null>(null)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Initialize settings service
  useEffect(() => {
    UserSettingsService.initializeSync()

    return () => {
      UserSettingsService.cleanupSync()
    }
  }, [])

  // Load initial settings and set up subscription
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

        const response = await UserSettingsService.getUserSettings(userId)

        if (!mounted) return

        if (response.status === 'success') {
          setSettings(response.data)
        } else {
          setError(response.error || 'Failed to load settings')
        }
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    const setupSubscription = () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }

      unsubscribeRef.current = UserSettingsService.subscribeToUserSettings(
        userId,
        (updatedSettings) => {
          if (mounted) {
            setSettings(updatedSettings)
            console.log('Settings updated via real-time sync')
          }
        }
      )
    }

    loadSettings()
    setupSubscription()

    return () => {
      mounted = false
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [userId])

  // Refresh sync status periodically
  const refreshSyncStatus = useCallback(async () => {
    if (!userId) return

    try {
      const response = await UserSettingsService.getSyncStatus(userId)
      if (response.status === 'success') {
        setSyncStatus(response.data)
      }
    } catch (err) {
      console.warn('Failed to refresh sync status:', err)
    }
  }, [userId])

  // Set up periodic sync status refresh
  useEffect(() => {
    if (!userId) return

    // Initial sync status check
    refreshSyncStatus()

    // Refresh sync status every 30 seconds
    syncIntervalRef.current = setInterval(refreshSyncStatus, 30000)

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
    }
  }, [userId, refreshSyncStatus])

  // Update settings function
  const updateSettings = useCallback(async (
    updates: Partial<UserSettings>,
    optimistic: boolean = true
  ): Promise<ServiceResponse<UserSettings>> => {
    if (!userId) {
      return { status: 'error', error: 'No user ID provided' }
    }

    try {
      setError(null)

      const response = await UserSettingsService.updateUserSettingsSync(
        userId,
        updates,
        optimistic
      )

      if (response.status === 'success' && response.data) {
        setSettings(response.data)

        // Refresh sync status after update
        setTimeout(refreshSyncStatus, 1000)
      } else {
        setError(response.error || 'Failed to update settings')
      }

      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return { status: 'error', error: errorMessage }
    }
  }, [userId, refreshSyncStatus])

  // Force sync across devices
  const forceSync = useCallback(async (): Promise<ServiceResponse<UserSettings>> => {
    if (!userId) {
      return { status: 'error', error: 'No user ID provided' }
    }

    try {
      setError(null)

      const response = await UserSettingsService.syncAcrossDevices(userId)

      if (response.status === 'success' && response.data) {
        setSettings(response.data)

        // Refresh sync status after force sync
        setTimeout(refreshSyncStatus, 1000)
      } else {
        setError(response.error || 'Failed to sync settings')
      }

      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return { status: 'error', error: errorMessage }
    }
  }, [userId, refreshSyncStatus])

  // Export settings
  const exportSettings = useCallback(async (): Promise<ServiceResponse<any>> => {
    if (!userId) {
      return { status: 'error', error: 'No user ID provided' }
    }

    try {
      return await UserSettingsService.exportSettings(userId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      return { status: 'error', error: errorMessage }
    }
  }, [userId])

  // Import settings
  const importSettings = useCallback(async (
    settingsData: Partial<UserSettings>,
    overwrite: boolean = false
  ): Promise<ServiceResponse<UserSettings>> => {
    if (!userId) {
      return { status: 'error', error: 'No user ID provided' }
    }

    try {
      setError(null)

      const response = await UserSettingsService.importSettings(userId, settingsData, overwrite)

      if (response.status === 'success' && response.data) {
        setSettings(response.data)

        // Refresh sync status after import
        setTimeout(refreshSyncStatus, 1000)
      } else {
        setError(response.error || 'Failed to import settings')
      }

      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return { status: 'error', error: errorMessage }
    }
  }, [userId, refreshSyncStatus])

  return {
    settings,
    loading,
    error,
    isOnline,
    syncStatus,
    updateSettings,
    forceSync,
    refreshSyncStatus,
    exportSettings,
    importSettings
  }
}

/**
 * Hook for accessing specific setting values with type safety
 */
export function useSettingValue<K extends keyof UserSettings>(
  userId: string | undefined,
  key: K,
  defaultValue?: UserSettings[K]
): [UserSettings[K] | undefined, (value: UserSettings[K]) => Promise<ServiceResponse<UserSettings>>] {
  const { settings, updateSettings } = useUserSettings(userId)

  const value = settings?.[key] ?? defaultValue

  const setValue = useCallback(async (newValue: UserSettings[K]) => {
    return updateSettings({ [key]: newValue } as Partial<UserSettings>)
  }, [key, updateSettings])

  return [value, setValue]
}

/**
 * Hook for theme settings specifically
 */
export function useThemeSettings(userId: string | undefined) {
  const [theme, setTheme] = useSettingValue(userId, 'theme', 'light')

  const toggleTheme = useCallback(async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    return setTheme(newTheme)
  }, [theme, setTheme])

  const setAutoTheme = useCallback(async () => {
    return setTheme('auto')
  }, [setTheme])

  return {
    theme,
    setTheme,
    toggleTheme,
    setAutoTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    isAuto: theme === 'auto'
  }
}

/**
 * Hook for notification settings
 */
export function useNotificationSettings(userId: string | undefined) {
  const [notifications, setNotifications] = useSettingValue(userId, 'notifications', {
    email: true,
    sms: false,
    push: true,
    in_app: true,
    call_alerts: true,
    sms_alerts: true,
    security_alerts: true
  })

  const updateNotification = useCallback(async (
    type: keyof NonNullable<typeof notifications>,
    enabled: boolean
  ) => {
    if (!notifications) return { status: 'error', error: 'Notifications not initialized' } as ServiceResponse<UserSettings>

    return setNotifications({
      ...notifications,
      [type]: enabled
    })
  }, [notifications, setNotifications])

  return {
    notifications,
    setNotifications,
    updateNotification
  }
}

/**
 * Hook for Retell configuration
 */
export function useRetellSettings(userId: string | undefined) {
  const [retellConfig, setRetellConfig] = useSettingValue(userId, 'retell_config', null)

  const updateRetellConfig = useCallback(async (config: {
    api_key?: string
    call_agent_id?: string
    sms_agent_id?: string
  }) => {
    const newConfig = {
      ...retellConfig,
      ...config
    }
    return setRetellConfig(newConfig)
  }, [retellConfig, setRetellConfig])

  const clearRetellConfig = useCallback(async () => {
    return setRetellConfig(null)
  }, [setRetellConfig])

  return {
    retellConfig,
    setRetellConfig,
    updateRetellConfig,
    clearRetellConfig,
    hasApiKey: !!(retellConfig?.api_key),
    hasCallAgent: !!(retellConfig?.call_agent_id),
    hasSmsAgent: !!(retellConfig?.sms_agent_id)
  }
}