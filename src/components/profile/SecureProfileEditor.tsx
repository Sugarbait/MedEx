import React, { useState, useEffect, useCallback } from 'react'
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
  RefreshCw,
  Clock,
  Globe,
  Phone,
  MapPin,
  Briefcase,
  FileText,
  AlertCircle,
  Wifi,
  WifiOff,
  SyncIcon as Sync
} from 'lucide-react'
import { secureProfileEditingService, ProfileData } from '@/services/secureProfileEditingService'
import { avatarStorageService } from '@/services/avatarStorageService'
import { auditLogger } from '@/services/auditLogger'

interface SecureProfileEditorProps {
  user: {
    id: string
    email: string
    name: string
    role: string
    avatar?: string
  }
  onProfileUpdate?: (profile: ProfileData) => void
  deviceId?: string
}

interface ValidationError {
  field: string
  message: string
}

interface SyncStatus {
  supabase: boolean
  localStorage: boolean
  crossDevice: boolean
  lastSync?: string
  isOnline: boolean
}

export const SecureProfileEditor: React.FC<SecureProfileEditorProps> = ({
  user,
  onProfileUpdate,
  deviceId
}) => {
  // Profile state
  const [profile, setProfile] = useState<ProfileData>({
    id: user.id,
    name: user.name,
    display_name: user.name,
    department: '',
    phone: '',
    bio: '',
    location: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    preferences: {}
  })

  // UI state
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [warnings, setWarnings] = useState<string[]>([])

  // Avatar state
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar || null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    supabase: false,
    localStorage: false,
    crossDevice: false,
    isOnline: navigator.onLine
  })

  // Conflict resolution state
  const [hasConflicts, setHasConflicts] = useState(false)
  const [showConflictModal, setShowConflictModal] = useState(false)

  // Auto-save state
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [unsavedChanges, setUnsavedChanges] = useState(false)

  // Load profile data on mount
  useEffect(() => {
    loadProfile()
  }, [user.id])

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setSyncStatus(prev => ({ ...prev, isOnline: true }))
    const handleOffline = () => setSyncStatus(prev => ({ ...prev, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Auto-save functionality
  useEffect(() => {
    if (autoSaveEnabled && unsavedChanges && !isEditing) {
      const autoSaveTimer = setTimeout(() => {
        handleSave(true) // Silent auto-save
      }, 5000) // Auto-save after 5 seconds of inactivity

      return () => clearTimeout(autoSaveTimer)
    }
  }, [profile, autoSaveEnabled, unsavedChanges, isEditing])

  // Cross-device sync listener
  useEffect(() => {
    const handleCrossDeviceSync = (event: CustomEvent) => {
      if (event.detail.userId === user.id) {
        console.log('Profile updated on another device')
        setWarnings(prev => [...prev, 'Profile was updated on another device. Consider refreshing.'])
      }
    }

    window.addEventListener('crossDeviceProfileSync', handleCrossDeviceSync as EventListener)
    return () => {
      window.removeEventListener('crossDeviceProfileSync', handleCrossDeviceSync as EventListener)
    }
  }, [user.id])

  /**
   * Load current profile data
   */
  const loadProfile = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const currentProfile = await secureProfileEditingService.getCurrentProfile(user.id)
      if (currentProfile) {
        setProfile(currentProfile)
        setUnsavedChanges(false)

        // Update sync status
        setSyncStatus(prev => ({
          ...prev,
          lastSync: new Date().toISOString(),
          localStorage: true
        }))
      }

      // Load avatar
      try {
        const avatarUrl = await avatarStorageService.getAvatarUrl(user.id)
        if (avatarUrl) {
          setAvatarPreview(avatarUrl)
        }
      } catch (avatarError) {
        console.warn('Could not load avatar:', avatarError)
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load profile')
      await auditLogger.logSecurityEvent('PROFILE_LOAD_FAILED', 'user_profiles', false, {
        userId: user.id,
        error: err.message
      })
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle profile field changes
   */
  const handleFieldChange = useCallback((field: keyof ProfileData, value: string) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }))
    setUnsavedChanges(true)

    // Clear validation error for this field
    setValidationErrors(prev => prev.filter(error => error.field !== field))
  }, [])

  /**
   * Validate form before save
   */
  const validateForm = (): boolean => {
    const errors: ValidationError[] = []

    if (!profile.name.trim()) {
      errors.push({ field: 'name', message: 'Full name is required' })
    }

    if (profile.phone && !/^[\+]?[1-9][\d\s\-\(\)]{9,20}$/.test(profile.phone)) {
      errors.push({ field: 'phone', message: 'Please enter a valid phone number' })
    }

    if (profile.bio && profile.bio.length > 500) {
      errors.push({ field: 'bio', message: 'Bio must not exceed 500 characters' })
    }

    setValidationErrors(errors)
    return errors.length === 0
  }

  /**
   * Save profile changes
   */
  const handleSave = async (silent = false) => {
    if (!validateForm()) {
      if (!silent) {
        setError('Please fix the validation errors before saving')
      }
      return
    }

    setIsSaving(true)
    if (!silent) {
      setError(null)
      setSuccessMessage(null)
      setWarnings([])
    }

    try {
      const result = await secureProfileEditingService.editProfile({
        userId: user.id,
        updates: profile,
        deviceId
      })

      if (result.success) {
        if (!silent) {
          setSuccessMessage('Profile updated successfully!')
          setIsEditing(false)
        }
        setUnsavedChanges(false)

        // Update sync status
        setSyncStatus(prev => ({
          ...prev,
          ...result.syncStatus,
          lastSync: new Date().toISOString()
        }))

        // Check for conflicts
        if (result.conflictResolution === 'manual') {
          setHasConflicts(true)
          setShowConflictModal(true)
        }

        // Notify parent component
        if (onProfileUpdate && result.data) {
          onProfileUpdate(result.data)
        }

        // Update localStorage immediately for UI consistency
        try {
          const currentUser = localStorage.getItem('currentUser')
          if (currentUser) {
            const userData = JSON.parse(currentUser)
            if (userData.id === user.id) {
              userData.name = profile.name
              userData.display_name = profile.display_name
              userData.department = profile.department
              userData.phone = profile.phone
              userData.updated_at = new Date().toISOString()
              localStorage.setItem('currentUser', JSON.stringify(userData))

              // Trigger UI update events
              window.dispatchEvent(new CustomEvent('userProfileUpdated', {
                detail: { userId: user.id, name: profile.name }
              }))
            }
          }
        } catch (storageError) {
          console.warn('Failed to update localStorage:', storageError)
        }

        if (!silent) {
          setTimeout(() => setSuccessMessage(null), 5000)
        }
      } else {
        setError(result.error || 'Failed to update profile')
        if (result.warnings) {
          setWarnings(result.warnings)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Cancel editing
   */
  const handleCancel = () => {
    // Reset to original profile data
    loadProfile()
    setIsEditing(false)
    setValidationErrors([])
    setError(null)
    setWarnings([])
    setUnsavedChanges(false)
  }

  /**
   * Handle avatar file selection
   */
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

  /**
   * Upload avatar
   */
  const handleAvatarUpload = async () => {
    if (!avatarFile) return

    setIsUploadingAvatar(true)
    setError(null)

    try {
      const result = await avatarStorageService.uploadAvatar(user.id, avatarFile)

      if (result.status === 'success') {
        setSuccessMessage('Profile picture updated successfully!')
        setAvatarFile(null)
        if (result.data) {
          setAvatarPreview(result.data)
        }

        // Trigger update events
        window.dispatchEvent(new CustomEvent('avatarUpdated', {
          detail: { userId: user.id, avatarUrl: result.data }
        }))

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

  /**
   * Remove avatar
   */
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

  /**
   * Force sync with cloud
   */
  const handleForceSync = async () => {
    setIsLoading(true)
    try {
      await loadProfile()
      setSuccessMessage('Profile synced successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      setError('Failed to sync profile')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Get field validation error
   */
  const getFieldError = (field: string): string | undefined => {
    return validationErrors.find(error => error.field === field)?.message
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Secure Profile Editor
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            HIPAA-compliant profile management with real-time synchronization
          </p>
        </div>

        {/* Sync status and controls */}
        <div className="flex items-center gap-2">
          {/* Online/Offline indicator */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            syncStatus.isOnline
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
          }`}>
            {syncStatus.isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {syncStatus.isOnline ? 'Online' : 'Offline'}
          </div>

          {/* Auto-save toggle */}
          <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={autoSaveEnabled}
              onChange={(e) => setAutoSaveEnabled(e.target.checked)}
              className="w-3 h-3"
            />
            Auto-save
          </label>

          {/* Force sync button */}
          <button
            onClick={handleForceSync}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Force sync with cloud"
          >
            <Sync className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sync Status Display */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Sync Status:</div>
        <div className="flex gap-4 text-xs">
          <div className={`flex items-center gap-1 ${syncStatus.localStorage ? 'text-green-600' : 'text-red-600'}`}>
            <div className={`w-2 h-2 rounded-full ${syncStatus.localStorage ? 'bg-green-500' : 'bg-red-500'}`}></div>
            Local Storage
          </div>
          <div className={`flex items-center gap-1 ${syncStatus.supabase ? 'text-green-600' : 'text-red-600'}`}>
            <div className={`w-2 h-2 rounded-full ${syncStatus.supabase ? 'bg-green-500' : 'bg-red-500'}`}></div>
            Cloud (Supabase)
          </div>
          <div className={`flex items-center gap-1 ${syncStatus.crossDevice ? 'text-green-600' : 'text-red-600'}`}>
            <div className={`w-2 h-2 rounded-full ${syncStatus.crossDevice ? 'bg-green-500' : 'bg-red-500'}`}></div>
            Cross-Device
          </div>
          {syncStatus.lastSync && (
            <div className="text-gray-500 ml-auto">
              Last sync: {new Date(syncStatus.lastSync).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Unsaved changes indicator */}
      {unsavedChanges && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
          <span className="text-sm text-yellow-800 dark:text-yellow-200">
            You have unsaved changes
            {autoSaveEnabled && ' (auto-saving in a few seconds)'}
          </span>
        </div>
      )}

      {/* Success/Error/Warning Messages */}
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

      {warnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 flex items-start gap-3 mb-6">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" />
          <div className="flex-1">
            {warnings.map((warning, index) => (
              <p key={index} className="text-sm text-yellow-800 dark:text-yellow-200">{warning}</p>
            ))}
          </div>
          <button
            onClick={() => setWarnings([])}
            className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* Email Display */}
        <div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Mail className="w-4 h-4 inline mr-2" />
              Email Address
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

        {/* Profile Information Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Full Name *
            </label>
            {isEditing ? (
              <div>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('name') ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Enter your full name"
                />
                {getFieldError('name') && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{getFieldError('name')}</p>
                )}
              </div>
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100">{profile.name || 'Not set'}</span>
              </div>
            )}
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Display Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={profile.display_name || ''}
                onChange={(e) => handleFieldChange('display_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="How should we display your name?"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100">{profile.display_name || 'Not set'}</span>
              </div>
            )}
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              <Briefcase className="w-4 h-4 inline mr-1" />
              Department
            </label>
            {isEditing ? (
              <input
                type="text"
                value={profile.department || ''}
                onChange={(e) => handleFieldChange('department', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Cardiology, Emergency Medicine"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100">{profile.department || 'Not set'}</span>
              </div>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              <Phone className="w-4 h-4 inline mr-1" />
              Phone Number
            </label>
            {isEditing ? (
              <div>
                <input
                  type="tel"
                  value={profile.phone || ''}
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('phone') ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="+1 (555) 123-4567"
                />
                {getFieldError('phone') && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{getFieldError('phone')}</p>
                )}
              </div>
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100">{profile.phone || 'Not set'}</span>
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Location
            </label>
            {isEditing ? (
              <input
                type="text"
                value={profile.location || ''}
                onChange={(e) => handleFieldChange('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., New York, NY"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100">{profile.location || 'Not set'}</span>
              </div>
            )}
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              <Globe className="w-4 h-4 inline mr-1" />
              Timezone
            </label>
            {isEditing ? (
              <select
                value={profile.timezone || ''}
                onChange={(e) => handleFieldChange('timezone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select timezone</option>
                {Intl.supportedValuesOf('timeZone').map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100">{profile.timezone || 'Not set'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            <FileText className="w-4 h-4 inline mr-1" />
            Bio
          </label>
          {isEditing ? (
            <div>
              <textarea
                value={profile.bio || ''}
                onChange={(e) => handleFieldChange('bio', e.target.value)}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  getFieldError('bio') ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Tell us about yourself..."
              />
              <div className="flex justify-between items-center mt-1">
                {getFieldError('bio') && (
                  <p className="text-xs text-red-600 dark:text-red-400">{getFieldError('bio')}</p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                  {(profile.bio || '').length}/500 characters
                </p>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg min-h-[80px]">
              <span className="text-gray-900 dark:text-gray-100">{profile.bio || 'Not set'}</span>
            </div>
          )}
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

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          {isEditing ? (
            <>
              <button
                onClick={() => handleSave(false)}
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
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
            >
              <Edit className="w-4 h-4" />
              Edit Profile
            </button>
          )}
        </div>

        {/* Security Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">HIPAA-Compliant Profile Management</h4>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                Your profile information is encrypted, synchronized across devices, and all changes are audited for compliance.
                Sensitive fields like phone numbers are encrypted using AES-256-GCM encryption.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}