import React, { useState, useEffect } from 'react'
import {
  User,
  Edit,
  Save,
  X,
  Check,
  AlertTriangle,
  Camera,
  Upload,
  Trash2,
  Mail,
  Shield,
  Calendar,
  RefreshCw
} from 'lucide-react'
import { enhancedUserService } from '@/services/enhancedUserService'
import { avatarStorageService } from '@/services/avatarStorageService'
import { userProfileService } from '@/services/userProfileService'
import { enhancedProfileSyncService, ProfileSyncEvent, ProfileSyncStatus as SyncStatus } from '@/services/enhancedProfileSyncService'
import { robustProfileSyncService, ProfileData } from '@/services/robustProfileSyncService'
// import { ProfileSyncStatus as ProfileSyncStatusComponent } from './ProfileSyncStatus'

interface EnhancedProfileSettingsProps {
  user: {
    id: string
    email: string
    name: string
    role: string
    avatar?: string
  }
}

export const EnhancedProfileSettings: React.FC<EnhancedProfileSettingsProps> = ({ user }) => {
  const [profile, setProfile] = useState({
    name: user.name || '',
    display_name: '',
    department: '',
    phone: '',
    bio: '',
    location: ''
  })

  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Avatar states
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar || null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // Form validation
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Enhanced sync states
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [syncEvents, setSyncEvents] = useState<ProfileSyncEvent[]>([])
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(false)

  useEffect(() => {
    console.log(`🔧 PROFILE COMPONENT: useEffect triggered`, {
      userId: user?.id,
      userObject: user
    })

    if (user?.id) {
      // Debug localStorage before loading
      const profileFieldsKey = `profileFields_${user.id}`
      const profileFields = localStorage.getItem(profileFieldsKey)
      console.log(`🔧 PROFILE COMPONENT: localStorage check for ${profileFieldsKey}:`, profileFields)

      loadUserProfile()
      initializeEnhancedSync()
    } else {
      console.warn(`⚠️ PROFILE LOAD: No user ID available, skipping profile load`)
    }
  }, [user.id])

  // Cleanup enhanced sync on unmount
  useEffect(() => {
    return () => {
      enhancedProfileSyncService.cleanup()
    }
  }, [])

  const loadUserProfile = async () => {
    console.log(`🔧 LOADUSERPROFILE: Function called with user:`, user)

    if (!user?.id) {
      console.warn(`⚠️ PROFILE LOAD: Cannot load profile - user ID is missing`)
      setIsLoading(false)
      return
    }

    // Test direct localStorage access first
    const directProfileFields = localStorage.getItem(`profileFields_${user.id}`)
    console.log(`🔧 LOADUSERPROFILE: Direct localStorage check for profileFields_${user.id}:`, directProfileFields)

    // AZURE FIX: Ensure global services are initialized before using them
    try {
      const { globalServiceInitializer } = await import('../../services/globalServiceInitializer')
      await globalServiceInitializer.initialize()
      console.log('✅ PROFILE LOAD: Global services initialized successfully')
    } catch (initError) {
      console.warn('⚠️ PROFILE LOAD: Global service initialization failed:', initError)
    }

    // Test if robustProfileSyncService is accessible
    console.log(`🔧 LOADUSERPROFILE: robustProfileSyncService available:`, typeof robustProfileSyncService, robustProfileSyncService)

    setIsLoading(true)
    setError(null)
    try {
      console.log(`🔧 PROFILE LOAD: Loading profile for user ${user.id} using robust sync service`)

      // Use the robust profile sync service for loading with cloud sync
      const profileResult = await robustProfileSyncService.loadProfileData(user.id)

      console.log(`🔧 PROFILE LOAD: Robust sync result:`, profileResult)

      if (profileResult.status === 'success' && profileResult.data) {
        const profileData = {
          name: profileResult.data.name || user.name || '',
          display_name: profileResult.data.display_name || profileResult.data.name || user.name || '',
          department: profileResult.data.department || '',
          phone: profileResult.data.phone || '',
          bio: profileResult.data.bio || '',
          location: profileResult.data.location || ''
        }

        setProfile(profileData)
        console.log(`✅ PROFILE LOAD: Loaded profile fields successfully using robust sync:`, {
          department: profileData.department || 'EMPTY',
          phone: profileData.phone || 'EMPTY',
          location: profileData.location || 'EMPTY',
          display_name: profileData.display_name || 'EMPTY',
          bio: profileData.bio || 'EMPTY'
        })

        // Update avatar preview if available
        if (profileResult.data.avatar) {
          setAvatarPreview(profileResult.data.avatar)
        }
      } else {
        // Fallback to basic profile if loading fails
        console.log(`⚠️ PROFILE LOAD: Using basic profile fallback, error:`, profileResult.error)
        setProfile({
          name: user.name || '',
          display_name: user.name || '',
          department: '',
          phone: '',
          bio: '',
          location: ''
        })
      }

      // Load avatar separately as additional fallback
      try {
        const avatarUrl = await avatarStorageService.getAvatarUrl(user.id)
        if (avatarUrl && !avatarPreview) {
          setAvatarPreview(avatarUrl)
        }
      } catch (avatarError) {
        console.warn('Could not load avatar:', avatarError)
      }

    } catch (err: any) {
      console.error('Profile load failed:', err)
      setError(err.message || 'Failed to load profile')

      // Fallback to basic profile
      setProfile({
        name: user.name || '',
        display_name: user.name || '',
        department: '',
        phone: '',
        bio: '',
        location: ''
      })
    } finally {
      setIsLoading(false)
    }
  }

  const initializeEnhancedSync = async () => {
    try {
      console.log('🔄 ENHANCED SYNC: Initializing for user:', user.id)

      const syncInit = await enhancedProfileSyncService.initialize(user.id)
      if (syncInit.status === 'success' && syncInit.data) {
        setSyncStatus(syncInit.data)
        setIsRealTimeEnabled(syncInit.data.connectionState === 'connected')
        console.log('✅ ENHANCED SYNC: Initialized successfully')
      } else {
        console.warn('ENHANCED SYNC: Initialization failed:', syncInit.error)
      }

      // Subscribe to sync events
      const unsubscribe = enhancedProfileSyncService.subscribeToSyncEvents((event: ProfileSyncEvent) => {
        console.log('📡 ENHANCED SYNC: Received sync event:', event)
        setSyncEvents(prev => [event, ...prev.slice(0, 9)]) // Keep last 10 events

        // Update UI immediately when receiving changes from other devices
        if (event.deviceId !== syncStatus?.deviceId) {
          if (event.eventType === 'avatar_changed') {
            setAvatarPreview(event.newValue)
          } else if (event.eventType === 'field_updated' && event.field && event.newValue !== undefined) {
            setProfile(prev => ({
              ...prev,
              [event.field!]: event.newValue
            }))
          }

          // Show success message for external updates
          setSuccessMessage(`Profile updated from another device (${event.eventType})`)
          setTimeout(() => setSuccessMessage(null), 3000)
        }
      })

      // Store cleanup function
      return unsubscribe
    } catch (error) {
      console.error('Enhanced sync initialization failed:', error)
    }
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!profile.name.trim()) {
      errors.name = 'Full name is required'
    }

    if (profile.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(profile.phone.replace(/[\s\-\(\)]/g, ''))) {
      errors.phone = 'Please enter a valid phone number'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!user?.id) {
      setError('Cannot save profile - user ID is missing')
      return
    }

    if (!validateForm()) {
      setError('Please fix the validation errors before saving')
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      console.log(`🔧 PROFILE UPDATE: Saving profile fields for user ${user.id}`)

      // AZURE FIX: Ensure global services are initialized before saving
      try {
        const { globalServiceInitializer } = await import('../../services/globalServiceInitializer')
        await globalServiceInitializer.initialize()
        console.log('✅ PROFILE SAVE: Global services initialized successfully')
      } catch (initError) {
        console.warn('⚠️ PROFILE SAVE: Global service initialization failed:', initError)
      }

      // Prepare complete profile data for robust sync service
      const profileData: ProfileData = {
        id: user.id,
        email: user.email,
        name: profile.name,
        role: user.role,
        avatar: user.avatar,
        mfa_enabled: user.mfa_enabled,
        display_name: profile.display_name || profile.name,
        department: profile.department,
        phone: profile.phone,
        bio: profile.bio,
        location: profile.location
      }

      console.log(`🔧 PROFILE UPDATE: Using robust sync service for profile save`)

      // Use the robust profile sync service for reliable cloud saving
      const saveResult = await robustProfileSyncService.saveProfileData(profileData)

      if (saveResult.status === 'success') {
        const syncResult = saveResult.data!

        if (syncResult.cloudSaved) {
          setSuccessMessage('Profile updated and synced to cloud successfully!')
        } else if (syncResult.localSaved) {
          setSuccessMessage('Profile updated locally (cloud sync will retry automatically)')
        }

        setIsEditing(false)
        console.log(`✅ PROFILE UPDATE: Profile saved using robust sync service`)
        console.log(`📊 SYNC RESULT:`, {
          cloudSaved: syncResult.cloudSaved,
          localSaved: syncResult.localSaved,
          warnings: syncResult.warnings
        })

        // CRITICAL: ALWAYS preserve Super User role during profile updates
        if (user.email === 'elmfarrell@yahoo.com' || user.email === 'pierre@phaetonai.com') {
          // Re-apply super user role after profile update
          const preserveRoleResponse = await userProfileService.updateUserProfile(user.id, { role: 'super_user' }, {
            syncToCloud: true,
            broadcastToOtherDevices: false
          })
          if (preserveRoleResponse.status === 'success') {
            console.log(`✅ PROFILE SAVE: Preserved Super User role for ${user.email}`)
          }
        }

        // CRITICAL: Force re-application of hardwired credentials after profile save
        const hardwiredApiSettings = {
          theme: 'light',
          mfaEnabled: false,
          refreshInterval: 30000,
          sessionTimeout: 15,
          notifications: { calls: true, sms: true, system: true },
          retellApiKey: 'key_c3f084f5ca67781070e188b47d7f',
          callAgentId: 'agent_447a1b9da540237693b0440df6',
          smsAgentId: 'agent_643486efd4b5a0e9d7e094ab99'
        }

        // Store hardwired credentials for this user
        localStorage.setItem(`settings_${user.id}`, JSON.stringify(hardwiredApiSettings))
        console.log(`✅ PROFILE SAVE: Re-applied hardwired credentials for ${user.email}`)

        // Update last sync time
        robustProfileSyncService.updateLastSyncTime()

        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        console.error('Profile save failed:', saveResult.error)
        setError(saveResult.error || 'Failed to update profile')
      }

    } catch (err: any) {
      console.error('Profile save failed:', err)
      setError(err.message || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    // Reload the original profile data instead of clearing fields
    loadUserProfile()
    setIsEditing(false)
    setValidationErrors({})
    setError(null)
  }

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('File size must be less than 5MB')
        return
      }

      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
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
    if (!avatarFile) return

    setIsUploadingAvatar(true)
    setError(null)

    try {
      console.log('🔄 AVATAR UPLOAD: Starting reliable avatar upload for user:', user.id)

      // Use avatar storage service as the primary and most reliable method
      // This completely bypasses the enhanced sync service initialization issues
      console.log('📱 Using avatar storage service for reliable upload')
      const result = await avatarStorageService.uploadAvatar(user.id, avatarFile)
      console.log('✅ AVATAR UPLOAD: Avatar storage service result:', result.status)

      if (result && result.status === 'success') {
        setSuccessMessage('Profile picture updated and synced across devices!')
        setAvatarFile(null)
        if (result.data) {
          setAvatarPreview(result.data)
        }

        // Skip sync status update to avoid enhanced sync service dependencies
        console.log('📁 Avatar uploaded successfully via avatar storage service')

        // CRITICAL FIX: Preserve Super User role and credentials during avatar upload
        try {
          const currentUser = localStorage.getItem('currentUser')
          if (currentUser) {
            const userData = JSON.parse(currentUser)
            if (userData.id === user.id) {
              // Update avatar but preserve ALL other user data including role and credentials
              userData.avatar = result.data
              userData.updated_at = new Date().toISOString()

              // CRITICAL: Ensure Super User role is preserved
              if (user.email === 'elmfarrell@yahoo.com' || user.email === 'pierre@phaetonai.com') {
                userData.role = 'super_user'
                console.log(`✅ AVATAR UPLOAD: Preserved Super User role for ${user.email}`)
              }

              localStorage.setItem('currentUser', JSON.stringify(userData))
            }
          }

          // Update systemUsers while preserving role
          const systemUsers = localStorage.getItem('systemUsers')
          if (systemUsers) {
            const users = JSON.parse(systemUsers)
            const userIndex = users.findIndex((u: any) => u.id === user.id)
            if (userIndex >= 0) {
              // Update avatar but preserve role
              users[userIndex].avatar = result.data
              users[userIndex].updated_at = new Date().toISOString()

              // CRITICAL: Ensure Super User role is preserved
              if (user.email === 'elmfarrell@yahoo.com' || user.email === 'pierre@phaetonai.com') {
                users[userIndex].role = 'super_user'
                console.log(`✅ SYSTEM USERS: Preserved Super User role for ${user.email}`)
              }

              localStorage.setItem('systemUsers', JSON.stringify(users))
            }
          }

          // CRITICAL: Force re-application of hardwired credentials after avatar upload
          const hardwiredApiSettings = {
            theme: 'light',
            mfaEnabled: false,
            refreshInterval: 30000,
            sessionTimeout: 15,
            notifications: { calls: true, sms: true, system: true },
            retellApiKey: 'key_c3f084f5ca67781070e188b47d7f',
            callAgentId: 'agent_447a1b9da540237693b0440df6',
            smsAgentId: 'agent_643486efd4b5a0e9d7e094ab99'
          }

          // Store hardwired credentials for this user
          localStorage.setItem(`settings_${user.id}`, JSON.stringify(hardwiredApiSettings))
          console.log(`✅ AVATAR UPLOAD: Re-applied hardwired credentials for ${user.email}`)

        } catch (storageError) {
          console.warn('Failed to update localStorage during avatar upload:', storageError)
        }

        // CRITICAL FIX: Delay events to prevent immediate reload that causes role loss
        setTimeout(() => {
          // CRITICAL: Ensure Super User role is preserved before triggering events
          if (user.email === 'elmfarrell@yahoo.com' || user.email === 'pierre@phaetonai.com') {
            // Force localStorage preservation right before events
            const currentUser = localStorage.getItem('currentUser')
            if (currentUser) {
              const userData = JSON.parse(currentUser)
              userData.role = 'super_user'
              localStorage.setItem('currentUser', JSON.stringify(userData))
              console.log(`✅ FINAL PRESERVATION: Super User role locked for ${user.email}`)
            }
          }

          // Trigger update events with delay to allow preservation to complete
          window.dispatchEvent(new Event('userDataUpdated'))
          window.dispatchEvent(new CustomEvent('avatarUpdated', {
            detail: { userId: user.id, avatarUrl: result.data }
          }))
        }, 100) // 100ms delay to ensure localStorage update completes

        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(result.error || 'Failed to upload profile picture')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload profile picture')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleAvatarRemove = async () => {
    if (!avatarPreview) return

    setIsUploadingAvatar(true)
    setError(null)

    try {
      const result = await avatarStorageService.removeAvatar(user.id)

      if (result.status === 'success') {
        setSuccessMessage('Profile picture removed successfully!')
        setAvatarPreview(null)
        setAvatarFile(null)

        // Trigger update events
        window.dispatchEvent(new Event('userDataUpdated'))

        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(result.error || 'Failed to remove profile picture')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove profile picture')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Profile Information
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage your personal information and profile settings
          </p>
        </div>
        <button
          onClick={loadUserProfile}
          disabled={isLoading}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Refresh profile"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 flex items-start gap-3 mb-6">
          <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
          <div className="flex-1">
            <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-start gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* Email Display at Top */}
        <div className="pb-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Mail className="w-4 h-4 inline mr-2" />
              Logged in as
            </label>
            <span className="text-lg font-medium text-gray-900 dark:text-gray-100">{user.email}</span>
          </div>
        </div>

        {/* Profile Picture Section */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Profile Picture
          </label>
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                )}
              </div>
              {avatarPreview && (
                <button
                  onClick={handleAvatarRemove}
                  disabled={isUploadingAvatar}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex-1">
              <div className="flex gap-3 mb-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                    disabled={isUploadingAvatar}
                  />
                  <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200 text-sm font-medium">
                    <Camera className="w-4 h-4" />
                    Choose Photo
                  </div>
                </label>

                {avatarFile && (
                  <button
                    onClick={handleAvatarUpload}
                    disabled={isUploadingAvatar}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {isUploadingAvatar ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {isUploadingAvatar ? 'Uploading...' : 'Upload'}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
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

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Full Name *
            </label>
            {isEditing ? (
              <div>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    validationErrors.name ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Enter your full name"
                />
                {validationErrors.name && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.name}</p>
                )}
              </div>
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100">{profile.name || 'Not set'}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Display Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={profile.display_name}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="How should we display your name?"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100">{profile.display_name || 'Not set'}</span>
              </div>
            )}
          </div>


          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Department
            </label>
            {isEditing ? (
              <input
                type="text"
                value={profile.department}
                onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Cardiology, Emergency Medicine"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100">{profile.department || 'Not set'}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Phone Number
            </label>
            {isEditing ? (
              <div>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    validationErrors.phone ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="+1 (555) 123-4567"
                />
                {validationErrors.phone && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.phone}</p>
                )}
              </div>
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100">{profile.phone || 'Not set'}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Location
            </label>
            {isEditing ? (
              <input
                type="text"
                value={profile.location}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Toronto, ON or Remote"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100">{profile.location || 'Not set'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bio Section */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Bio
          </label>
          {isEditing ? (
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
              placeholder="Brief description about yourself, your specialties, or role..."
            />
          ) : (
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg min-h-[80px]">
              <span className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{profile.bio || 'Not set'}</span>
            </div>
          )}
        </div>

        {/* Edit Profile Button / Save and Cancel Buttons */}
        <div className="flex justify-start pt-4">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
            >
              <Edit className="w-4 h-4" />
              Edit Profile
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Enhanced Sync Status Section */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${syncStatus?.connectionState === 'syncing' ? 'animate-spin' : ''}`} />
            Cross-Device Synchronization
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-800 dark:text-blue-200">Status:</span>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${
                  syncStatus?.connectionState === 'connected' ? 'bg-green-500' :
                  syncStatus?.connectionState === 'syncing' ? 'bg-yellow-500' :
                  'bg-gray-500'
                }`} />
                <span className="text-blue-700 dark:text-blue-300 capitalize">
                  {syncStatus?.connectionState || 'unknown'}
                </span>
              </div>
            </div>

            <div>
              <span className="font-medium text-blue-800 dark:text-blue-200">Last Sync:</span>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                {syncStatus?.lastFullSync
                  ? new Date(syncStatus.lastFullSync).toLocaleTimeString()
                  : 'Never'
                }
              </p>
            </div>

            <div>
              <span className="font-medium text-blue-800 dark:text-blue-200">Pending Fields:</span>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                {syncStatus?.pendingFields.length || 0} fields
              </p>
            </div>
          </div>

          {syncEvents.length > 0 && (
            <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-600">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Recent Sync Events:</h4>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {syncEvents.slice(0, 3).map((event, index) => (
                  <div key={index} className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <div className="w-1 h-1 bg-blue-500 rounded-full" />
                    <span className="capitalize">{event.eventType.replace('_', ' ')}</span>
                    {event.field && <span>({event.field})</span>}
                    <span className="text-blue-500 dark:text-blue-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={async () => {
                setIsLoading(true)
                const fullSync = await enhancedProfileSyncService.forceFullProfileSync()
                if (fullSync.status === 'success') {
                  setSyncStatus(fullSync.data!)
                  setSuccessMessage('Full profile sync completed!')
                  setTimeout(() => setSuccessMessage(null), 3000)
                }
                setIsLoading(false)
              }}
              disabled={isLoading}
              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Syncing...' : 'Force Sync'}
            </button>

            <div className="text-xs text-blue-600 dark:text-blue-400">
              Device: {syncStatus?.deviceId?.slice(-8) || 'Unknown'}
            </div>
          </div>
        </div>

        {/* Role Information */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Shield className="w-4 h-4 inline mr-2" />
                Account Role
              </label>
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100 capitalize">
                  {user.role === 'super_user' ? 'Super User' : user.role?.replace('_', ' ') || 'User'}
                </span>
              </div>
            </div>
          </div>
        </div>


        {/* New Robust Profile Sync Status - Temporarily disabled for testing */}
        {/* <ProfileSyncStatusComponent
          userId={user.id}
          onForceSync={loadUserProfile}
        /> */}

        {/* Info Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Enhanced Cloud Synchronization</h4>
              <div className="text-sm text-blue-800 dark:text-blue-200 mt-1 space-y-1">
                <p>✅ Real-time profile field synchronization across all devices</p>
                <p>✅ Instant avatar sync with robust cloud storage (Supabase Storage)</p>
                <p>✅ Automatic conflict resolution with last-write-wins strategy</p>
                <p>✅ Offline support with automatic sync when reconnected</p>
                <p>✅ Cross-device change notifications and status monitoring</p>
                <p>✅ HIPAA-compliant encryption for all synchronized data</p>
                <p>🔧 Robust fallback handling with local storage persistence</p>
                <p>🔄 Automatic retry logic for failed cloud operations</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}