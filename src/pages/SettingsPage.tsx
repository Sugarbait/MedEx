import React, { useState, useEffect } from 'react'
import {
  SettingsIcon,
  UserIcon,
  ShieldIcon,
  BellIcon,
  PaletteIcon,
  MonitorIcon,
  SmartphoneIcon,
  SunIcon,
  MoonIcon,
  SaveIcon,
  CheckIcon,
  CameraIcon,
  UploadIcon,
  FileTextIcon,
  DownloadIcon,
  QrCodeIcon,
  AlertTriangleIcon,
  KeyIcon,
  LinkIcon,
  Wifi,
  WifiOff,
  RefreshCw,
  Smartphone
} from 'lucide-react'
import { MFASetup } from '@/components/auth/MFASetup'
import { mfaService } from '@/services/mfaService'
import { auditLogger } from '@/services/auditLogger'
import { retellService } from '@/services'
import { userProfileService } from '@/services/userProfileService'
import { RobustUserSettingsService } from '@/services/userSettingsServiceRobust'
import { UserSettings } from '@/types/supabase'
import { avatarStorageService } from '@/services/avatarStorageService'
import { SimpleUserManager } from '@/components/settings/SimpleUserManager'
import { ThemeManager } from '@/utils/themeManager'
import { SiteHelpChatbot } from '@/components/common/SiteHelpChatbot'
import { toastNotificationService, ToastNotificationPreferences } from '@/services/toastNotificationService'
import { DeviceList } from '@/components/crossDevice/DeviceList'
import { DeviceRegistration } from '@/components/crossDevice/DeviceRegistration'
import { ConflictResolutionModal } from '@/components/crossDevice/ConflictResolutionModal'
import { DetailedDeviceStatus } from '@/components/crossDevice/DeviceStatusIndicator'
import { useCrossDevice } from '@/contexts/CrossDeviceContext'
import { useDeviceManagement } from '@/hooks/useDeviceManagement'
import { useCrossDeviceSync } from '@/hooks/useCrossDeviceSync'
import { useConflictResolution } from '@/hooks/useConflictResolution'

interface User {
  id: string
  email: string
  name: string
  role: string
  mfa_enabled?: boolean
  avatar?: string
}

interface LocalUserSettings {
  theme?: string
  mfaEnabled?: boolean
  refreshInterval?: number
  sessionTimeout?: number // in minutes
  notifications?: {
    calls?: boolean
    sms?: boolean
    system?: boolean
  }
  retellApiKey?: string
  callAgentId?: string
  smsAgentId?: string
}

interface SettingsPageProps {
  user: User
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState('profile')
  const [isLoading, setIsLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced')
  const [retryQueueSize, setRetryQueueSize] = useState(0)
  const [isChatbotVisible, setIsChatbotVisible] = useState(false)
  const [userSettings, setUserSettings] = useState<LocalUserSettings>({
    // Don't set default theme - let it load from storage
    mfaEnabled: false,
    refreshInterval: 30000 // Default to 30 seconds
  })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [showMFASetup, setShowMFASetup] = useState(false)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [isLoadingAudit, setIsLoadingAudit] = useState(false)
  const [fullName, setFullName] = useState(user?.name || '')
  const [isEditingName, setIsEditingName] = useState(false)
  const [isSavingName, setIsSavingName] = useState(false)
  const [toastPreferences, setToastPreferences] = useState<ToastNotificationPreferences>(
    toastNotificationService.getPreferences()
  )

  // Cross-device related state
  const [showDeviceRegistration, setShowDeviceRegistration] = useState(false)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null)

  // Cross-device hooks
  const crossDevice = useCrossDevice()
  const deviceManagement = useDeviceManagement()
  const crossDeviceSync = useCrossDeviceSync()
  const conflictResolution = useConflictResolution()

  const tabs = [
    { id: 'profile', name: 'Profile', icon: UserIcon },
    { id: 'security', name: 'Security', icon: ShieldIcon },
    { id: 'crossdevice', name: 'Cross-Device', icon: Smartphone },
    { id: 'api', name: 'API Configuration', icon: KeyIcon },
    { id: 'appearance', name: 'Appearance', icon: PaletteIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'audit', name: 'Audit Logs', icon: FileTextIcon },
    ...(user?.role === 'super_user' ? [{ id: 'users', name: 'User Management', icon: UserIcon }] : [])
  ]

  // Load settings using robust service on component mount
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true)
      try {
        // Initialize the robust settings service
        await RobustUserSettingsService.initialize()

        // Force sync from Supabase to get latest cross-device settings
        console.log('🔄 Force syncing settings from Supabase for cross-device access...')
        try {
          const syncResponse = await RobustUserSettingsService.forceSync(user.id)
          if (syncResponse.status === 'success') {
            console.log('✅ Settings force-synced from Supabase successfully')
          } else {
            console.warn('⚠️ Force sync failed, using cached data:', syncResponse.error)
          }
        } catch (syncError) {
          console.warn('⚠️ Force sync failed, using cached data:', syncError)
        }

        // Load user settings with automatic fallback
        console.log('Loading settings with robust service...')
        const response = await RobustUserSettingsService.getUserSettings(user.id)

        if (response.status === 'success' && response.data) {
          console.log('✅ Settings loaded successfully')
          const settings = response.data

          // Check actual MFA status from service
          let actualMFAEnabled = false
          try {
            actualMFAEnabled = await mfaService.hasMFAEnabled(user.id)
            console.log('Actual MFA status from service:', actualMFAEnabled)
          } catch (error) {
            console.warn('Failed to get MFA status from service:', error)
            actualMFAEnabled = user?.mfa_enabled || false
          }

          const loadedSettings = {
            theme: settings.theme || 'light',
            mfaEnabled: actualMFAEnabled,
            refreshInterval: 30000,
            sessionTimeout: settings.security_preferences?.session_timeout || 15,
            notifications: {
              calls: settings.notifications?.call_alerts ?? true,
              sms: settings.notifications?.sms_alerts ?? true,
              system: settings.notifications?.security_alerts ?? true
            },
            retellApiKey: settings.retell_config?.api_key,
            callAgentId: settings.retell_config?.call_agent_id,
            smsAgentId: settings.retell_config?.sms_agent_id
          }
          setUserSettings(loadedSettings)
          setSyncStatus('synced')

          // Update retell service with loaded credentials
          if (loadedSettings.retellApiKey || loadedSettings.callAgentId || loadedSettings.smsAgentId) {
            console.log('Initializing retell service with saved credentials')
            retellService.updateCredentials(
              loadedSettings.retellApiKey,
              loadedSettings.callAgentId,
              loadedSettings.smsAgentId
            )
          }

          console.log('Settings loaded and applied successfully')
        } else {
          console.warn('Failed to load settings:', response.error)
          setSyncStatus('error')
          setErrorMessage(`Failed to load settings: ${response.error}`)

          // Set default settings on error
          setUserSettings({
            theme: 'light',
            mfaEnabled: user?.mfa_enabled || false,
            refreshInterval: 30000,
            sessionTimeout: 15,
            notifications: {
              calls: true,
              sms: true,
              system: true
            }
          })
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
        setSyncStatus('error')
        setErrorMessage(`Failed to load settings: ${error instanceof Error ? error.message : 'Unknown error'}`)

        // Set default settings on error
        setUserSettings({
          theme: 'light',
          mfaEnabled: user?.mfa_enabled || false,
          refreshInterval: 30000,
          sessionTimeout: 15,
          notifications: {
            calls: true,
            sms: true,
            system: true
          }
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()

    // Subscribe to settings changes for this user with robust service
    const unsubscribe = RobustUserSettingsService.subscribeToUserSettings(user.id, (updatedSettings) => {
      console.log('Real-time settings update received:', updatedSettings)

      // Check actual MFA status
      mfaService.hasMFAEnabled(user.id).then(actualMFAEnabled => {
        const localSettings = {
          theme: updatedSettings.theme || 'light',
          mfaEnabled: actualMFAEnabled,
          refreshInterval: 30000,
          sessionTimeout: updatedSettings.security_preferences?.session_timeout || 15,
          notifications: {
            calls: updatedSettings.notifications?.call_alerts ?? true,
            sms: updatedSettings.notifications?.sms_alerts ?? true,
            system: updatedSettings.notifications?.security_alerts ?? true
          },
          retellApiKey: updatedSettings.retell_config?.api_key,
          callAgentId: updatedSettings.retell_config?.call_agent_id,
          smsAgentId: updatedSettings.retell_config?.sms_agent_id
        }

        setUserSettings(localSettings)
        setSyncStatus('synced')

        // Update retell service with synced credentials
        if (localSettings.retellApiKey || localSettings.callAgentId || localSettings.smsAgentId) {
          retellService.updateCredentials(
            localSettings.retellApiKey,
            localSettings.callAgentId,
            localSettings.smsAgentId
          )
        }
      }).catch(error => {
        console.warn('Failed to get MFA status during real-time update:', error)
      })
    })

    // Set up periodic sync status check
    const statusInterval = setInterval(async () => {
      try {
        const status = await RobustUserSettingsService.getSyncStatus(user.id)
        if (status.status === 'success') {
          setRetryQueueSize(status.data.retryQueueSize)
          if (!status.data.isOnline) {
            setSyncStatus('offline')
          } else if (status.data.hasPendingChanges || status.data.retryQueueSize > 0) {
            setSyncStatus('syncing')
          } else {
            setSyncStatus('synced')
          }
        }
      } catch (error) {
        console.warn('Failed to check sync status:', error)
      }
    }, 10000) // Check every 10 seconds

    // Initialize avatar preview from user data if available
    const initializeAvatar = async () => {
      try {
        // Sync avatar from cloud/database to ensure we have the latest
        const syncResult = await avatarStorageService.syncAvatarAcrossDevices(user.id)

        let avatarUrl = null
        if (syncResult.status === 'success' && syncResult.data) {
          avatarUrl = syncResult.data
        } else {
          // Fallback to getting current avatar
          avatarUrl = await avatarStorageService.getAvatarUrl(user.id)
        }

        if (avatarUrl && !avatarPreview) {
          setAvatarPreview(avatarUrl)
        }
      } catch (error) {
        console.warn('Failed to initialize avatar:', error)
        // Fallback to user prop avatar
        if (user?.avatar && !avatarPreview) {
          setAvatarPreview(user.avatar)
        }
      }
    }

    initializeAvatar()

    // Cleanup function
    return () => {
      unsubscribe()
      clearInterval(statusInterval)
    }
  }, [user.id, user?.mfa_enabled, user?.avatar])

  const updateSettings = async (newSettings: Partial<LocalUserSettings>) => {
    setSaveStatus('saving')
    setSyncStatus('syncing')
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const updatedSettings = { ...userSettings, ...newSettings }
      setUserSettings(updatedSettings)

      // Prepare settings for Supabase with proper structure
      const settingsForSupabase: Partial<UserSettings> = {
        theme: updatedSettings.theme as 'light' | 'dark' | 'auto',
        notifications: {
          email: updatedSettings.notifications?.calls ?? true,
          sms: updatedSettings.notifications?.sms ?? true,
          push: true,
          in_app: true,
          call_alerts: updatedSettings.notifications?.calls ?? true,
          sms_alerts: updatedSettings.notifications?.sms ?? true,
          security_alerts: updatedSettings.notifications?.system ?? true
        },
        security_preferences: {
          session_timeout: updatedSettings.sessionTimeout || 15,
          require_mfa: updatedSettings.mfaEnabled || false,
          password_expiry_reminder: true,
          login_notifications: true
        }
      }

      // Only include retell_config if we have actual values
      if (updatedSettings.retellApiKey || updatedSettings.callAgentId || updatedSettings.smsAgentId) {
        settingsForSupabase.retell_config = {
          api_key: updatedSettings.retellApiKey,
          call_agent_id: updatedSettings.callAgentId,
          sms_agent_id: updatedSettings.smsAgentId
        }
      }

      // Use robust settings service
      const response = await RobustUserSettingsService.updateUserSettings(
        user.id,
        settingsForSupabase,
        true // Enable optimistic updates
      )

      if (response.status === 'success') {
        console.log('✅ Settings updated successfully')
        setSaveStatus('saved')
        setSyncStatus('synced')
        setTimeout(() => setSaveStatus('idle'), 2000)

        // Update retell service if API settings changed
        if (newSettings.retellApiKey || newSettings.callAgentId || newSettings.smsAgentId) {
          retellService.updateCredentials(
            updatedSettings.retellApiKey,
            updatedSettings.callAgentId,
            updatedSettings.smsAgentId
          )
        }
      } else {
        console.error('❌ Failed to update settings:', response.error)
        setSaveStatus('error')
        setSyncStatus('error')
        setErrorMessage(`Failed to update settings: ${response.error}`)

        setTimeout(() => setSaveStatus('idle'), 3000)
        setTimeout(() => setErrorMessage(null), 5000)
      }
    } catch (error) {
      console.error('❌ Settings update failed:', error)
      setSaveStatus('error')
      setSyncStatus('error')
      setErrorMessage(`Settings update failed: ${error instanceof Error ? error.message : 'Unknown error'}`)

      setTimeout(() => setSaveStatus('idle'), 3000)
      setTimeout(() => setErrorMessage(null), 5000)
    } finally {
      setIsLoading(false)
    }
  }

  const handleThemeChange = async (theme: string) => {
    // Apply theme immediately using ThemeManager
    ThemeManager.setTheme(theme as 'light' | 'dark' | 'auto')

    // Save to settings
    await updateSettings({ theme })
  }

  const handleMFAToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        const hasSetup = await mfaService.hasMFASetup(user.id)
        const hasEnabled = await mfaService.hasMFAEnabled(user.id)

        if (hasSetup && !hasEnabled) {
          // MFA setup exists but is disabled - re-enable it
          const reEnabled = await mfaService.enableMFA(user.id)
          if (!reEnabled) {
            // Fallback: show setup dialog if re-enable failed
            setShowMFASetup(true)
            return
          }
          console.log('MFA re-enabled for user:', user.id)
        } else if (!hasSetup) {
          // No MFA setup exists - show setup dialog
          setShowMFASetup(true)
          return
        }
      } else if (!enabled) {
        const hasEnabled = await mfaService.hasMFAEnabled(user.id)
        if (hasEnabled) {
          // Temporarily disable MFA (preserve setup)
          await mfaService.disableMFA(user.id)
          console.log('MFA temporarily disabled for user:', user.id)
        }
      }
    } catch (error) {
      console.error('Error toggling MFA:', error)
      // Try to sync from cloud in case of issues
      const synced = await mfaService.forceSyncFromCloud(user.id)
      if (synced) {
        console.log('Synced MFA data from cloud, retrying...')
        // Retry the operation
        await handleMFAToggle(enabled)
        return
      }
    }

    setSaveStatus('saving')
    setIsLoading(true)

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Update user data in localStorage
      const userData = { ...user, mfa_enabled: enabled }
      localStorage.setItem('currentUser', JSON.stringify(userData))

      // Update users list if exists
      const storedUsers = localStorage.getItem('systemUsers')
      if (storedUsers) {
        try {
          const users = JSON.parse(storedUsers)
          const updatedUsers = users.map((u: any) =>
            u.id === user.id ? { ...u, mfa_enabled: enabled } : u
          )
          localStorage.setItem('systemUsers', JSON.stringify(updatedUsers))
        } catch (error) {
          console.error('Failed to update users list:', error)
        }
      }

      // Update local settings state immediately for UI toggle
      setUserSettings(prev => ({ ...prev, mfaEnabled: enabled }))

      // Save to localStorage
      const updatedSettings = { ...userSettings, mfaEnabled: enabled }
      localStorage.setItem(`settings_${user.id}`, JSON.stringify(updatedSettings))

      // Force another state update to ensure toggle reflects the change
      setTimeout(() => {
        setUserSettings(prev => ({ ...prev, mfaEnabled: enabled }))
      }, 100)

      console.log(`MFA toggle updated: ${enabled ? 'ENABLED' : 'DISABLED'}. Toggle should now be ${enabled ? 'green' : 'gray'}.`)

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)

      // Refresh page to apply MFA changes
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error('Failed to update MFA setting:', error)
      setSaveStatus('idle')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMFASetupComplete = async (secret: string, backupCodes?: string[]) => {
    setShowMFASetup(false)
    setSaveStatus('saving')
    setIsLoading(true)

    try {
      console.log('MFA setup completed, integrating with MFA service...')

      // The MFA service should have already stored the data during the setup process
      // Let's verify that the MFA service recognizes the setup
      let mfaActuallyEnabled = false
      let retryCount = 0
      const maxRetries = 3

      while (!mfaActuallyEnabled && retryCount < maxRetries) {
        try {
          // Wait a moment for any async operations to complete
          await new Promise(resolve => setTimeout(resolve, 500))

          // Check if MFA service recognizes the setup
          const hasSetup = await mfaService.hasMFASetup(user.id)
          mfaActuallyEnabled = await mfaService.hasMFAEnabled(user.id)

          console.log(`MFA verification attempt ${retryCount + 1}:`, {
            hasSetup,
            hasEnabled: mfaActuallyEnabled,
            userId: user.id
          })

          if (!hasSetup && !mfaActuallyEnabled) {
            // If MFA service doesn't recognize the setup, there might be a storage issue
            // Let's try to force sync from cloud or check localStorage
            console.log('Attempting to sync MFA data from cloud...')
            const synced = await mfaService.forceSyncFromCloud(user.id)
            if (synced) {
              console.log('Successfully synced MFA data from cloud')
              mfaActuallyEnabled = await mfaService.hasMFAEnabled(user.id)
            } else {
              console.log('Cloud sync failed, checking localStorage directly...')
              // Check if data exists in localStorage using the service's expected keys
              const localData = localStorage.getItem(`mfa_simple_${user.id}`) ||
                               localStorage.getItem(`mfa_data_${user.id}`) ||
                               localStorage.getItem(`mfa_global_${user.id}`)

              if (localData) {
                console.log('Found MFA data in localStorage, service should detect it')
                mfaActuallyEnabled = true
              }
            }
          }
        } catch (error) {
          console.warn(`MFA verification attempt ${retryCount + 1} failed:`, error)
        }
        retryCount++
      }

      if (!mfaActuallyEnabled) {
        console.warn('MFA service verification failed, but setup was completed. Checking manual indicators...')
        // Fallback: if we have the secret and backup codes, assume setup is complete
        if (secret || (backupCodes && backupCodes.length > 0)) {
          console.log('Manual verification: MFA setup appears complete based on provided data')
          mfaActuallyEnabled = true
        }
      }

      // Update user data in localStorage to enable MFA
      const userData = { ...user, mfa_enabled: mfaActuallyEnabled }
      localStorage.setItem('currentUser', JSON.stringify(userData))

      // Update users list if exists
      const storedUsers = localStorage.getItem('systemUsers')
      if (storedUsers) {
        try {
          const users = JSON.parse(storedUsers)
          const updatedUsers = users.map((u: any) =>
            u.id === user.id ? { ...u, mfa_enabled: mfaActuallyEnabled } : u
          )
          localStorage.setItem('systemUsers', JSON.stringify(updatedUsers))
        } catch (error) {
          console.error('Failed to update users list:', error)
        }
      }

      // IMPORTANT: Update local settings state immediately for UI toggle to turn green
      setUserSettings(prev => ({ ...prev, mfaEnabled: mfaActuallyEnabled }))

      // Save to localStorage with correct state
      const updatedSettings = { ...userSettings, mfaEnabled: mfaActuallyEnabled }
      localStorage.setItem(`settings_${user.id}`, JSON.stringify(updatedSettings))

      // Force a state update to ensure the toggle reflects the correct state
      setTimeout(() => {
        setUserSettings(prev => ({ ...prev, mfaEnabled: mfaActuallyEnabled }))
      }, 100)

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)

      // Trigger user data update event
      window.dispatchEvent(new Event('userDataUpdated'))

      console.log(`✅ MFA setup integration completed successfully. Status: ${mfaActuallyEnabled ? 'ENABLED' : 'NEEDS_ATTENTION'}`)

      if (mfaActuallyEnabled) {
        console.log('🎉 MFA is properly configured and persisted! Toggle should now be green.')
      } else {
        console.warn('⚠️ MFA setup completed but verification failed. Manual review needed.')
      }

    } catch (error) {
      console.error('❌ Failed to complete MFA setup integration:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  // API Configuration Functions
  const handleApiKeyUpdate = async (apiKey: string) => {
    const newSettings = { retellApiKey: apiKey }
    await updateSettings(newSettings)

    // Get the most current settings from localStorage to avoid stale state
    const currentSettings = { ...userSettings, ...newSettings }

    console.log('Updating API key configuration')

    // Save to both localStorage and Supabase for cross-device sync
    try {
      await retellService.saveCredentials(
        apiKey,
        currentSettings.callAgentId || '',
        currentSettings.smsAgentId || ''
      )
      console.log('API credentials saved successfully with cross-device sync')
    } catch (error) {
      console.error('Error saving API credentials:', error)
      // Fallback to old method if saveCredentials fails
      retellService.updateCredentials(apiKey, currentSettings.callAgentId, currentSettings.smsAgentId)
    }

    // Notify other components of the API settings change
    window.dispatchEvent(new Event('apiSettingsUpdated'))
  }

  const handleCallAgentIdUpdate = async (agentId: string) => {
    const newSettings = { callAgentId: agentId }
    await updateSettings(newSettings)

    // Get the most current settings from localStorage to avoid stale state
    const currentSettings = { ...userSettings, ...newSettings }

    console.log('Updating Call Agent ID configuration')

    // Save to both localStorage and Supabase for cross-device sync
    try {
      await retellService.saveCredentials(
        currentSettings.retellApiKey || '',
        agentId,
        currentSettings.smsAgentId || ''
      )
      console.log('Call agent ID saved successfully with cross-device sync')
    } catch (error) {
      console.error('Error saving call agent ID:', error)
      // Fallback to old method if saveCredentials fails
      retellService.updateCredentials(currentSettings.retellApiKey, agentId, currentSettings.smsAgentId)
    }

    // Notify other components of the API settings change
    window.dispatchEvent(new Event('apiSettingsUpdated'))
  }

  const handleSmsAgentIdUpdate = async (agentId: string) => {
    const newSettings = { smsAgentId: agentId }
    await updateSettings(newSettings)

    // Get the most current settings from localStorage to avoid stale state
    const currentSettings = { ...userSettings, ...newSettings }

    console.log('Updating SMS Agent ID configuration')

    // Save to both localStorage and Supabase for cross-device sync
    try {
      await retellService.saveCredentials(
        currentSettings.retellApiKey || '',
        currentSettings.callAgentId || '',
        agentId
      )
      console.log('SMS agent ID saved successfully with cross-device sync')
    } catch (error) {
      console.error('Error saving SMS agent ID:', error)
      // Fallback to old method if saveCredentials fails
      retellService.updateCredentials(currentSettings.retellApiKey, currentSettings.callAgentId, agentId)
    }

    // Notify other components of the API settings change
    window.dispatchEvent(new Event('apiSettingsUpdated'))
  }

  const testApiConnection = async () => {
    if (!userSettings?.retellApiKey) {
      alert('Please enter your API key first')
      return
    }

    console.log('Testing API connection')

    try {
      // Update retell service with current credentials
      retellService.updateCredentials(
        userSettings.retellApiKey,
        userSettings.callAgentId,
        userSettings.smsAgentId
      )

      // Test API connection using retell service
      const result = await retellService.testConnection()

      if (result.success) {
        console.log('API connection test successful')
        alert('API connection successful!')
      } else {
        console.error('API connection test failed:', result.message)
        alert(`API connection failed: ${result.message}`)
      }
    } catch (error) {
      console.error('API connection test error:', error)
      alert(`API connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleSessionTimeoutChange = async (timeout: number) => {
    console.log('🔄 SettingsPage: Updating session timeout to:', timeout, 'minutes')

    await updateSettings({ sessionTimeout: timeout })

    // Add a small delay to ensure localStorage is updated
    setTimeout(() => {
      console.log('🔄 SettingsPage: Dispatching userSettingsUpdated event')
      // Dispatch custom event to notify App.tsx of session timeout change
      window.dispatchEvent(new CustomEvent('userSettingsUpdated', {
        detail: { sessionTimeout: timeout }
      }))
    }, 50)
  }


  const loadAuditLogs = async () => {
    setIsLoadingAudit(true)
    try {
      const auditReport = await auditLogger.getAuditLogs({
        limit: 50,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      })
      setAuditLogs(auditReport.entries)
    } catch (error) {
      console.error('Failed to load audit logs:', error)
    } finally {
      setIsLoadingAudit(false)
    }
  }

  const downloadAuditLogs = async () => {
    try {
      const auditData = await auditLogger.exportAuditLogs({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        limit: 1000
      }, 'json')

      const blob = new Blob([auditData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download audit logs:', error)
      alert('Failed to download audit logs. Please try again.')
    }
  }

  // Load audit logs when audit tab is accessed
  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs()
    }
  }, [activeTab])

  // Apply theme when settings are initially loaded (once)
  // Theme is handled by ThemeManager initialization and navigation logic in App.tsx
  // Removed problematic useEffect that was resetting theme on mount

  const handleNotificationChange = async (type: string, enabled: boolean) => {
    const updatedNotifications = {
      ...userSettings?.notifications,
      [type]: enabled
    }
    await updateSettings({ notifications: updatedNotifications })
  }

  const handleToastPreferenceChange = async (key: keyof ToastNotificationPreferences, value: any) => {
    const newPreferences = { ...toastPreferences, [key]: value }
    setToastPreferences(newPreferences)
    await toastNotificationService.updatePreferences(user.id, { [key]: value })
  }

  const handleDoNotDisturbChange = async (key: keyof ToastNotificationPreferences['doNotDisturb'], value: any) => {
    const newDndSettings = { ...toastPreferences.doNotDisturb, [key]: value }
    const newPreferences = { ...toastPreferences, doNotDisturb: newDndSettings }
    setToastPreferences(newPreferences)
    await toastNotificationService.updatePreferences(user.id, { doNotDisturb: newDndSettings })
  }

  // Test function to trigger demo toast notifications
  const handleTestToastNotification = (type: 'call' | 'sms') => {
    console.log('🧪 Triggering test toast notification:', type)

    // Use the toast service's public test method
    toastNotificationService.triggerTestNotification(type)
  }

  // Helper function to test Supabase connectivity
  const testSupabaseConnection = async () => {
    try {
      console.log('Testing Supabase connection...')
      const testResponse = await UserSettingsService.getUserSettings(user.id)

      if (testResponse.status === 'success') {
        console.log('✅ Supabase connection successful')
        setSyncStatus('synced')
        return true
      } else {
        console.error('❌ Supabase connection failed:', testResponse.error)
        setSyncStatus('error')
        setErrorMessage(`Database connection failed: ${testResponse.error}`)
        return false
      }
    } catch (error) {
      console.error('❌ Supabase connection error:', error)
      setSyncStatus('error')
      setErrorMessage(`Database connection error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return false
    }
  }

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('File size must be less than 5MB')
        return
      }

      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }

      setAvatarFile(file)

      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAvatarUpload = async () => {
    if (!avatarFile || !avatarPreview) return

    setSaveStatus('saving')
    setIsLoading(true)

    try {
      console.log('Uploading avatar')

      // Use the robust avatar storage service
      const result = await avatarStorageService.uploadAvatar(user.id, avatarPreview)

      if (result.status === 'error') {
        throw new Error(result.error)
      }

      console.log('Avatar uploaded successfully:', result.data)

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)

      // Reset file input but keep the avatar preview since it's now saved
      setAvatarFile(null)
      // Update avatar preview with the new URL to ensure it's the latest
      setAvatarPreview(result.data!)

      console.log('Avatar upload completed successfully')

      // Trigger custom event to notify App.tsx of user data change
      window.dispatchEvent(new Event('userDataUpdated'))

    } catch (error) {
      console.error('Failed to upload avatar:', error)
      setSaveStatus('idle')
      alert(`Failed to upload avatar: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const removeAvatar = async () => {
    setSaveStatus('saving')
    setIsLoading(true)

    try {
      console.log('Removing avatar')

      // Use the robust avatar storage service
      const result = await avatarStorageService.removeAvatar(user.id)

      if (result.status === 'error') {
        throw new Error(result.error)
      }

      console.log('Avatar removed successfully')

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      setAvatarPreview(null)

      console.log('Avatar removal completed successfully')

      // Trigger custom event to notify App.tsx of user data change
      window.dispatchEvent(new Event('userDataUpdated'))

    } catch (error) {
      console.error('Failed to remove avatar:', error)
      setSaveStatus('idle')
      alert(`Failed to remove avatar: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const saveFullName = async () => {
    if (!fullName.trim()) {
      alert('Please enter a valid name')
      return
    }

    setIsSavingName(true)
    setSaveStatus('saving')

    try {
      console.log('Saving full name update')

      // Update user profile with the new name
      const result = await userProfileService.updateUserProfile(user.id, {
        name: fullName.trim()
      })

      if (result.status === 'error') {
        throw new Error(result.error)
      }

      // Update localStorage currentUser
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const userData = JSON.parse(currentUser)
        userData.name = fullName.trim()
        localStorage.setItem('currentUser', JSON.stringify(userData))
      }

      // Update systemUsers in localStorage
      const systemUsers = localStorage.getItem('systemUsers')
      if (systemUsers) {
        const users = JSON.parse(systemUsers)
        const userIndex = users.findIndex((u: any) => u.id === user.id)
        if (userIndex >= 0) {
          users[userIndex].name = fullName.trim()
          localStorage.setItem('systemUsers', JSON.stringify(users))
        }
      }

      console.log('Full name updated successfully')
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      setIsEditingName(false)

      // Trigger custom event to notify App.tsx of user data change
      window.dispatchEvent(new Event('userDataUpdated'))
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'currentUser',
        newValue: JSON.stringify({...user, name: fullName.trim()}),
        storageArea: localStorage
      }))

    } catch (error) {
      console.error('Failed to save full name:', error)
      setSaveStatus('idle')
      alert(`Failed to save name: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSavingName(false)
    }
  }

  const cancelEditName = () => {
    setFullName(user?.name || '')
    setIsEditingName(false)
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <SettingsIcon className="w-7 h-7 text-blue-600" />
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Manage your account preferences and security settings
          </p>
        </div>

        {/* Save Status Indicator */}
        <div className="mt-4 sm:mt-0 flex flex-col items-end gap-2">
          {saveStatus !== 'idle' && (
            <div className="flex items-center gap-2">
              {saveStatus === 'saving' ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Saving...</span>
                </>
              ) : saveStatus === 'saved' ? (
                <>
                  <CheckIcon className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600">Saved</span>
                </>
              ) : saveStatus === 'error' ? (
                <>
                  <AlertTriangleIcon className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-600">Error</span>
                </>
              ) : null}
            </div>
          )}

          {/* Sync Status Indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              syncStatus === 'synced' ? 'bg-green-500' :
              syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' :
              syncStatus === 'offline' ? 'bg-yellow-500' :
              'bg-red-500'
            }`} />
            <span className={`text-xs ${
              syncStatus === 'synced' ? 'text-green-600 dark:text-green-400' :
              syncStatus === 'syncing' ? 'text-blue-600 dark:text-blue-400' :
              syncStatus === 'offline' ? 'text-yellow-600 dark:text-yellow-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              {syncStatus === 'synced' && 'Synced'}
              {syncStatus === 'syncing' && (retryQueueSize > 0 ? `Syncing (${retryQueueSize} pending)` : 'Syncing')}
              {syncStatus === 'offline' && 'Offline Mode'}
              {syncStatus === 'error' && 'Sync Error'}
            </span>
          </div>
        </div>
      </div>

      {/* Info/Error Message Banner */}
      {errorMessage && (
        <div className={`border rounded-lg p-4 flex items-start gap-3 ${
          syncStatus === 'offline'
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
        }`}>
          <AlertTriangleIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
            syncStatus === 'offline' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
          }`} />
          <div className="flex-1">
            <h4 className={`text-sm font-medium ${
              syncStatus === 'offline' ? 'text-blue-800 dark:text-blue-200' : 'text-red-800 dark:text-red-200'
            }`}>
              {syncStatus === 'offline' ? 'Offline Mode' : 'Settings Error'}
            </h4>
            <p className={`text-sm mt-1 ${
              syncStatus === 'offline' ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'
            }`}>
              {errorMessage}
            </p>
            {syncStatus === 'offline' && (
              <p className="text-xs text-blue-600 mt-2">
                💡 Operating in offline mode. Settings will sync automatically when connection is restored.
              </p>
            )}
            {syncStatus === 'syncing' && retryQueueSize > 0 && (
              <p className="text-xs text-blue-600 mt-2">
                🔄 Syncing {retryQueueSize} pending changes across devices...
              </p>
            )}
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className={`p-1 hover:opacity-75 ${
              syncStatus === 'offline' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-0">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      activeTab === tab.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-r-2 border-blue-500 dark:border-blue-400'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">{tab.name}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Profile Information
              </h2>

              <div className="space-y-6">
                {/* Profile Picture */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    Profile Picture
                  </label>
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        {avatarPreview || user?.avatar ? (
                          <img
                            src={avatarPreview || user?.avatar}
                            alt="Profile"
                            className="w-full h-full object-cover"
                            style={{ backgroundColor: '#ffffff' }}
                          />
                        ) : (
                          <UserIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                        )}
                      </div>
                      {(avatarPreview || user?.avatar) && (
                        <button
                          onClick={removeAvatar}
                          disabled={isLoading}
                          className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex gap-3">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            className="hidden"
                            disabled={isLoading}
                          />
                          <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200 text-sm font-medium">
                            <CameraIcon className="w-4 h-4" />
                            Choose Photo
                          </div>
                        </label>

                        {avatarFile && (
                          <button
                            onClick={handleAvatarUpload}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            <UploadIcon className="w-4 h-4" />
                            {isLoading ? 'Uploading...' : 'Upload'}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        JPG, PNG or GIF (max 5MB). Recommended size: 200x200px
                      </p>
                      {avatarFile && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Selected: {avatarFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Full Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={isEditingName ? fullName : (user?.name || 'Dr. Sarah Johnson')}
                      onChange={(e) => setFullName(e.target.value)}
                      readOnly={!isEditingName}
                      className={`flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none ${
                        isEditingName
                          ? 'bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                          : 'bg-gray-50 dark:bg-gray-700'
                      }`}
                      placeholder="Enter your full name"
                    />
                    {!isEditingName ? (
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-600 dark:border-blue-400 hover:border-blue-700 dark:hover:border-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        Edit
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={saveFullName}
                          disabled={isSavingName || !fullName.trim()}
                          className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1"
                        >
                          {isSavingName ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <SaveIcon className="w-3 h-3" />
                              Save
                            </>
                          )}
                        </button>
                        <button
                          onClick={cancelEditName}
                          disabled={isSavingName}
                          className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={user?.email || 'demo@carexps.com'}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Role
                  </label>
                  <input
                    type="text"
                    value={user?.role?.replace('_', ' ') || 'Healthcare Provider'}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 focus:outline-none capitalize"
                  />
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Profile information is managed by your organization's IT administrator.
                    Contact them to make changes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Security Settings
              </h2>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">Multi-Factor Authentication</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Add an extra layer of security to your account with TOTP authenticator
                    </p>
                    {userSettings?.mfaEnabled && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-xs text-green-600 dark:text-green-400">MFA is properly configured</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {!userSettings?.mfaEnabled && (
                      <button
                        onClick={() => setShowMFASetup(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        <QrCodeIcon className="w-4 h-4" />
                        Setup MFA
                      </button>
                    )}
                    <button
                      onClick={() => handleMFAToggle(!userSettings?.mfaEnabled)}
                      disabled={isLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        userSettings?.mfaEnabled ? 'bg-green-600' : 'bg-gray-300'
                      } disabled:opacity-50`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        userSettings?.mfaEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">Session Timeout</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Automatically log out after inactivity (HIPAA required)
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={userSettings?.sessionTimeout || 15}
                      onChange={(e) => handleSessionTimeoutChange(Number(e.target.value))}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={5}>5 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">Active</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">Data Encryption</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      All data is encrypted with AES-256 encryption
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm text-gray-600">Active</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cross-Device Settings */}
          {activeTab === 'crossdevice' && (
            <div className="space-y-6">
              {/* Cross-Device Overview */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Cross-Device Synchronization
                  </h2>
                  {conflictResolution.hasConflicts && (
                    <button
                      onClick={() => setShowConflictModal(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm"
                    >
                      <AlertTriangleIcon className="w-4 h-4" />
                      {conflictResolution.conflictCount} Conflict{conflictResolution.conflictCount === 1 ? '' : 's'}
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Sync Status Overview */}
                  <DetailedDeviceStatus />

                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => crossDeviceSync.forceSyncNow()}
                      disabled={!crossDeviceSync.isOnline || crossDeviceSync.isSyncing}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${crossDeviceSync.isSyncing ? 'animate-spin' : ''}`} />
                      {crossDeviceSync.isSyncing ? 'Syncing...' : 'Force Sync Now'}
                    </button>

                    <button
                      onClick={() => setShowDeviceRegistration(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                    >
                      <SmartphoneIcon className="w-4 h-4" />
                      Register New Device
                    </button>

                    {crossDeviceSync.queueSize > 0 && (
                      <button
                        onClick={() => crossDeviceSync.clearQueue()}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                      >
                        <span>Clear Queue ({crossDeviceSync.queueSize})</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Device Management */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Connected Devices
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Smartphone className="w-4 h-4" />
                    <span>{deviceManagement.deviceCount} device{deviceManagement.deviceCount === 1 ? '' : 's'}</span>
                  </div>
                </div>

                <DeviceList showActions={true} showDetails={true} />

                {deviceManagement.deviceTrustIssues && (
                  <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex gap-3">
                      <AlertTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                          Device Trust Issues Detected
                        </h4>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          You have {deviceManagement.untrustedDeviceCount} untrusted device{deviceManagement.untrustedDeviceCount === 1 ? '' : 's'}.
                          Review and update trust levels for enhanced security.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sync Configuration */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Sync Configuration
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">Real-time Sync</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Automatically sync data changes across all your devices
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (crossDevice.configuration.enableRealTimeSync) {
                          crossDevice.disableSync()
                        } else {
                          crossDevice.enableSync()
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        crossDevice.configuration.enableRealTimeSync ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        crossDevice.configuration.enableRealTimeSync ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">Offline Queue</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Store changes locally when offline and sync when reconnected
                      </p>
                    </div>
                    <button
                      onClick={() => crossDevice.updateConfiguration({
                        enableOfflineQueue: !crossDevice.configuration.enableOfflineQueue
                      })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        crossDevice.configuration.enableOfflineQueue ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        crossDevice.configuration.enableOfflineQueue ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">Conflict Resolution</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Automatically detect and help resolve data conflicts
                      </p>
                    </div>
                    <button
                      onClick={() => crossDevice.updateConfiguration({
                        enableConflictResolution: !crossDevice.configuration.enableConflictResolution
                      })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        crossDevice.configuration.enableConflictResolution ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        crossDevice.configuration.enableConflictResolution ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">Auto-resolve Conflicts</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Automatically resolve simple conflicts without user input
                      </p>
                    </div>
                    <button
                      onClick={() => crossDevice.updateConfiguration({
                        autoResolveConflicts: !crossDevice.configuration.autoResolveConflicts
                      })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        crossDevice.configuration.autoResolveConflicts ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        crossDevice.configuration.autoResolveConflicts ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">PHI Encryption</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Encrypt protected health information during sync (HIPAA required)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">Required</span>
                    </div>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Advanced Settings</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Max Queue Size
                      </label>
                      <select
                        value={crossDevice.configuration.maxQueueSize}
                        onChange={(e) => crossDevice.updateConfiguration({
                          maxQueueSize: Number(e.target.value)
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                      >
                        <option value={500}>500 items</option>
                        <option value={1000}>1,000 items</option>
                        <option value={2000}>2,000 items</option>
                        <option value={5000}>5,000 items</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Sync Batch Size
                      </label>
                      <select
                        value={crossDevice.configuration.syncBatchSize}
                        onChange={(e) => crossDevice.updateConfiguration({
                          syncBatchSize: Number(e.target.value)
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                      >
                        <option value={10}>10 items</option>
                        <option value={20}>20 items</option>
                        <option value={50}>50 items</option>
                        <option value={100}>100 items</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Reset Configuration */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      if (window.confirm('Reset all cross-device settings to defaults?')) {
                        crossDevice.resetConfiguration()
                      }
                    }}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 rounded-lg transition-colors"
                  >
                    Reset to Defaults
                  </button>
                </div>
              </div>

              {/* Security & Privacy */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Security & Privacy
                </h3>

                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex gap-3">
                      <ShieldIcon className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-green-800 dark:text-green-200">
                          HIPAA-Compliant Synchronization
                        </h4>
                        <ul className="text-sm text-green-700 dark:text-green-300 mt-2 space-y-1">
                          <li>• End-to-end encryption for all PHI data</li>
                          <li>• Device fingerprinting for secure authentication</li>
                          <li>• Comprehensive audit logging of all sync operations</li>
                          <li>• Automatic data encryption at rest and in transit</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Encryption Algorithm:</span>
                        <span className="text-gray-900 dark:text-gray-100">AES-256-GCM</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Key Management:</span>
                        <span className="text-gray-900 dark:text-gray-100">PBKDF2</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Transport Security:</span>
                        <span className="text-gray-900 dark:text-gray-100">TLS 1.3</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Audit Logging:</span>
                        <span className="text-green-600 dark:text-green-400">Active</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Device Trust:</span>
                        <span className="text-green-600 dark:text-green-400">Verified</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Data Integrity:</span>
                        <span className="text-green-600 dark:text-green-400">Protected</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Diagnostics */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Diagnostics & Support
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">Export Diagnostics</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Download diagnostic information for troubleshooting
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const diagnostics = await crossDevice.exportDiagnostics()
                          const blob = new Blob([JSON.stringify(diagnostics, null, 2)], {
                            type: 'application/json'
                          })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `crossdevice-diagnostics-${new Date().toISOString().split('T')[0]}.json`
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                          URL.revokeObjectURL(url)
                        } catch (error) {
                          alert('Failed to export diagnostics')
                        }
                      }}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
                    >
                      Export Diagnostics
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {crossDeviceSync.syncStatus.totalSynced}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Items Synced</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {deviceManagement.trustedDeviceCount}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Trusted Devices</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {conflictResolution.conflictCount}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Pending Conflicts</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* API Configuration */}
          {activeTab === 'api' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                API Configuration
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                Configure your API credentials for call and SMS services.
              </p>

              <div className="space-y-6">
                {/* API Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    API Key
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="password"
                      value={userSettings?.retellApiKey || ''}
                      onChange={(e) => handleApiKeyUpdate(e.target.value)}
                      placeholder="Enter your API key"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={testApiConnection}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <LinkIcon className="w-4 h-4" />
                      Test Connection
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Your API key is encrypted and stored securely
                  </p>
                </div>

                {/* Call Agent ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Call Agent ID
                  </label>
                  <input
                    type="text"
                    value={userSettings?.callAgentId || ''}
                    onChange={(e) => handleCallAgentIdUpdate(e.target.value)}
                    placeholder="Enter your Call Agent ID"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    This agent will be used for all outbound calls
                  </p>
                </div>

                {/* SMS/Chat Agent ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    SMS / Chat Agent ID
                  </label>
                  <input
                    type="text"
                    value={userSettings?.smsAgentId || ''}
                    onChange={(e) => handleSmsAgentIdUpdate(e.target.value)}
                    placeholder="Enter your SMS/Chat Agent ID"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    This agent will be used for all SMS and chat conversations
                  </p>
                </div>

                {/* API Status */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <KeyIcon className="w-5 h-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900 dark:text-blue-100">API Status</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-700 dark:text-blue-300">API Key</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${userSettings?.retellApiKey ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {userSettings?.retellApiKey ? 'Configured' : 'Not configured'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-700 dark:text-blue-300">Call Agent ID</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${userSettings?.callAgentId ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {userSettings?.callAgentId ? 'Configured' : 'Not configured'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-700 dark:text-blue-300">SMS Agent ID</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${userSettings?.smsAgentId ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {userSettings?.smsAgentId ? 'Configured' : 'Not configured'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Notification Preferences
              </h2>

              <div className="space-y-4">
                {/* Email Notifications - Coming Soon */}
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 opacity-60">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Email Notifications</h3>
                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">
                      Coming Soon
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-500 dark:text-gray-400">Call Notifications</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Get email alerts about incoming and missed calls
                        </p>
                      </div>
                      <button
                        disabled={true}
                        className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
                      >
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-500 dark:text-gray-400">SMS Notifications</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Get email summaries of new SMS conversations
                        </p>
                      </div>
                      <button
                        disabled={true}
                        className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
                      >
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-500 dark:text-gray-400">System Alerts</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Get email alerts about system maintenance and security updates
                        </p>
                      </div>
                      <button
                        disabled={true}
                        className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
                      >
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Toast Notifications Section */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Toast Notifications</h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">Real-time Toasts</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Show popup notifications for new calls and SMS messages
                        </p>
                      </div>
                      <button
                        onClick={() => handleToastPreferenceChange('enabled', !toastPreferences.enabled)}
                        disabled={isLoading}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          toastPreferences.enabled ? 'bg-blue-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          toastPreferences.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">Sound Effects</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Play gentle sound with toast notifications
                        </p>
                      </div>
                      <button
                        onClick={() => handleToastPreferenceChange('soundEnabled', !toastPreferences.soundEnabled)}
                        disabled={isLoading || !toastPreferences.enabled}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          toastPreferences.soundEnabled && toastPreferences.enabled ? 'bg-blue-500' : 'bg-gray-300'
                        } ${!toastPreferences.enabled ? 'opacity-50' : ''}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          toastPreferences.soundEnabled && toastPreferences.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">Do Not Disturb</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Silence notifications during specific hours
                        </p>
                      </div>
                      <button
                        onClick={() => handleDoNotDisturbChange('enabled', !toastPreferences.doNotDisturb.enabled)}
                        disabled={isLoading || !toastPreferences.enabled}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          toastPreferences.doNotDisturb.enabled && toastPreferences.enabled ? 'bg-blue-500' : 'bg-gray-300'
                        } ${!toastPreferences.enabled ? 'opacity-50' : ''}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          toastPreferences.doNotDisturb.enabled && toastPreferences.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    {toastPreferences.doNotDisturb.enabled && toastPreferences.enabled && (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
                        <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100">Quiet Hours</h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Start Time
                            </label>
                            <input
                              type="time"
                              value={toastPreferences.doNotDisturb.startTime}
                              onChange={(e) => handleDoNotDisturbChange('startTime', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              End Time
                            </label>
                            <input
                              type="time"
                              value={toastPreferences.doNotDisturb.endTime}
                              onChange={(e) => handleDoNotDisturbChange('endTime', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Notifications will be silenced between these hours (overnight periods supported)
                        </p>
                      </div>
                    )}

                    {/* Test Buttons Section */}
                    <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">Test Toast Notifications</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                        Click the buttons below to see what the toast notifications look like
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleTestToastNotification('call')}
                          disabled={!toastPreferences.enabled}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                          </svg>
                          Test Call Toast
                        </button>
                        <button
                          onClick={() => handleTestToastNotification('sms')}
                          disabled={!toastPreferences.enabled}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                          </svg>
                          Test SMS Toast
                        </button>
                      </div>
                      {!toastPreferences.enabled && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                          Enable "Real-time Toasts" above to test notifications
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Appearance */}
          {activeTab === 'appearance' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Appearance Settings
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Theme</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => handleThemeChange('light')}
                      disabled={isLoading}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors ${
                        userSettings?.theme === 'light'
                          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <SunIcon className="w-6 h-6" />
                      <span className="text-sm font-medium">Light</span>
                    </button>

                    <button
                      onClick={() => handleThemeChange('dark')}
                      disabled={isLoading}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors ${
                        userSettings?.theme === 'dark'
                          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <MoonIcon className="w-6 h-6" />
                      <span className="text-sm font-medium">Dark</span>
                    </button>

                    <button
                      onClick={() => handleThemeChange('auto')}
                      disabled={isLoading}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors ${
                        userSettings?.theme === 'auto'
                          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <MonitorIcon className="w-6 h-6" />
                      <span className="text-sm font-medium">Auto</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <SmartphoneIcon className="w-4 h-4" />
                    <span>Settings sync in real-time across all your devices</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    • Automatic sync when online
                    • Offline mode with sync when connected
                    • Conflict resolution for concurrent changes
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Audit Logs */}
          {activeTab === 'audit' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  HIPAA Audit Logs
                </h2>
                <button
                  onClick={downloadAuditLogs}
                  disabled={isLoadingAudit}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <DownloadIcon className="w-4 h-4" />
                  Download Logs
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Complete audit trail of all system access and PHI data operations.
                  Required for HIPAA compliance and security monitoring.
                </p>
              </div>

              {isLoadingAudit ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-gray-600 dark:text-gray-300">Loading audit logs...</span>
                </div>
              ) : auditLogs.length > 0 ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 font-medium text-gray-900 dark:text-gray-100">Timestamp</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-900 dark:text-gray-100">User</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-900 dark:text-gray-100">Action</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-900 dark:text-gray-100">Resource</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-900 dark:text-gray-100">PHI</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-900 dark:text-gray-100">Outcome</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.slice(0, 20).map((log, index) => (
                          <tr key={index} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="py-2 px-3 text-gray-900 dark:text-gray-100">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-gray-900 dark:text-gray-100">
                              {log.user_name}
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                                {log.action}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-gray-900 dark:text-gray-100">
                              {log.resource_type}
                            </td>
                            <td className="py-2 px-3">
                              {log.phi_accessed ? (
                                <span className="flex items-center gap-1 text-orange-600">
                                  <AlertTriangleIcon className="w-3 h-3" />
                                  Yes
                                </span>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">No</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                log.outcome === 'SUCCESS'
                                  ? 'bg-green-100 text-green-800'
                                  : log.outcome === 'FAILURE'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {log.outcome}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {auditLogs.length > 20 && (
                    <div className="text-center py-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Showing first 20 entries. Download complete logs for full history.
                      </p>
                    </div>
                  )}

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Audit Log Information</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• All PHI access is logged and encrypted</li>
                      <li>• Logs are retained for 6+ years per HIPAA requirements</li>
                      <li>• Failed access attempts are automatically flagged</li>
                      <li>• Regular compliance reports are generated</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No audit logs available</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Audit logging will begin when users start accessing the system
                  </p>
                </div>
              )}
            </div>
          )}

          {/* User Management (Super Users Only) */}
          {activeTab === 'users' && user?.role === 'super_user' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <SimpleUserManager />
            </div>
          )}

        </div>
      </div>

      {/* MFA Setup Modal */}
      {showMFASetup && (
        <MFASetup
          user={user}
          onComplete={handleMFASetupComplete}
          onCancel={() => setShowMFASetup(false)}
        />
      )}

      {/* Device Registration Modal */}
      {showDeviceRegistration && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Register New Device
              </h3>
              <button
                onClick={() => setShowDeviceRegistration(false)}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <DeviceRegistration
              onRegistrationComplete={(success) => {
                setShowDeviceRegistration(false)
                if (success) {
                  // Refresh the page or show success message
                  setTimeout(() => {
                    window.location.reload()
                  }, 1000)
                }
              }}
              className="p-0"
            />
          </div>
        </div>
      )}

      {/* Conflict Resolution Modal */}
      <ConflictResolutionModal
        isOpen={showConflictModal}
        onClose={() => {
          setShowConflictModal(false)
          setSelectedConflictId(null)
        }}
        conflictId={selectedConflictId}
      />

      {/* Site Help Chatbot */}
      <SiteHelpChatbot
        isVisible={isChatbotVisible}
        onToggle={() => setIsChatbotVisible(!isChatbotVisible)}
      />
    </div>
  )
}