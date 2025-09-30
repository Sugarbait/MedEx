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
  RefreshCw,
  Cloud,
  Wifi,
  WifiOff,
  Clock,
  Zap
} from 'lucide-react'
import { useEnhancedProfileSync } from '@/hooks/useEnhancedProfileSync'

interface EnhancedCrossDeviceProfileSettingsProps {
  user: {
    id: string
    email: string
    name: string
    role: string
    avatar?: string
    mfa_enabled?: boolean
  }
}

export const EnhancedCrossDeviceProfileSettings: React.FC<EnhancedCrossDeviceProfileSettingsProps> = ({ user }) => {
  // Use the enhanced profile sync hook
  const {
    profileData,
    isLoading,
    error,
    syncStatus,
    isOnline,
    isSyncing,
    lastSyncTime,
    updateProfile,
    uploadAvatar,
    forceSync,
    clearError,
    syncEvents,
    clearSyncEvents
  } = useEnhancedProfileSync({
    userId: user.id,
    autoSync: true,
    syncInterval: 30000,
    enableRealtime: true
  })

  // Local state for editing
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    display_name: '',
    department: '',
    phone: '',
    bio: '',
    location: ''
  })

  // Avatar upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Form validation
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Initialize form when profile data loads
  useEffect(() => {
    if (profileData && !isEditing) {
      setEditForm({
        name: profileData.name || '',
        display_name: profileData.display_name || profileData.name || '',
        department: profileData.department || '',
        phone: profileData.phone || '',
        bio: profileData.bio || '',
        location: profileData.location || ''
      })
      setAvatarPreview(profileData.avatar || null)
    }
  }, [profileData, isEditing])

  // Handle success messages with auto-clear
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!editForm.name.trim()) {
      errors.name = 'Full name is required'
    }

    if (editForm.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(editForm.phone.replace(/[\s\-\(\)]/g, ''))) {
      errors.phone = 'Please enter a valid phone number'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  /**
   * Handle form submission
   */
  const handleSave = async () => {
    if (!validateForm()) {
      setSuccessMessage(null)
      return
    }

    const result = await updateProfile(editForm)
    if (result.success) {
      setSuccessMessage('✅ Profile updated and synced across all devices!')
      setIsEditing(false)
    }
    // Error is handled by the hook
  }

  /**
   * Handle form cancellation
   */
  const handleCancel = () => {
    if (profileData) {
      setEditForm({
        name: profileData.name || '',
        display_name: profileData.display_name || profileData.name || '',
        department: profileData.department || '',
        phone: profileData.phone || '',
        bio: profileData.bio || '',
        location: profileData.location || ''
      })
    }
    setIsEditing(false)
    setValidationErrors({})
    clearError()
  }

  /**
   * Handle avatar file selection
   */
  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setSuccessMessage(null)
        return
      }

      if (!file.type.startsWith('image/')) {
        setSuccessMessage(null)
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
   * Handle avatar upload
   */
  const handleAvatarUpload = async () => {
    if (!avatarFile) return

    const result = await uploadAvatar(avatarFile)
    if (result.success) {
      setSuccessMessage('✅ Profile picture updated and synced across all devices!')
      setAvatarFile(null)
      if (result.avatarUrl) {
        setAvatarPreview(result.avatarUrl)
      }
    }
    // Error is handled by the hook
  }

  /**
   * Handle force sync
   */
  const handleForceSync = async () => {
    const result = await forceSync()
    if (result.success) {
      setSuccessMessage('✅ Profile synced successfully from cloud!')
    }
    // Error is handled by the hook
  }

  /**
   * Format sync status
   */
  const getSyncStatusColor = () => {
    if (!isOnline) return 'text-red-500'
    if (syncStatus.isRealtimeConnected) return 'text-green-500'
    return 'text-yellow-500'
  }

  const getSyncStatusText = () => {
    if (!isOnline) return 'Offline'
    if (isSyncing) return 'Syncing...'
    if (syncStatus.isRealtimeConnected) return 'Real-time Connected'
    return 'Cloud Connected'
  }

  const getSyncStatusIcon = () => {
    if (!isOnline) return <WifiOff className="w-4 h-4" />
    if (isSyncing) return <RefreshCw className="w-4 h-4 animate-spin" />
    if (syncStatus.isRealtimeConnected) return <Zap className="w-4 h-4" />
    return <Cloud className="w-4 h-4" />
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading profile...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Header with Sync Status */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Enhanced Cross-Device Profile
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Real-time synchronized across all your devices
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sync Status Indicator */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${getSyncStatusColor()}`}>
            {getSyncStatusIcon()}
            {getSyncStatusText()}
          </div>
          {/* Force Sync Button */}
          <button
            onClick={handleForceSync}
            disabled={isSyncing || !isOnline}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            title="Force sync from cloud"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Success Message */}
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

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-start gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
          <button
            onClick={clearError}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* Email Display */}
        <div className="pb-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Mail className="w-4 h-4 inline mr-2" />
              Account Email
            </label>
            <span className="text-lg font-medium text-gray-900 dark:text-gray-100">{user.email}</span>
            <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
              <Shield className="w-3 h-3" />
              Role: {user.role === 'super_user' ? 'Super User' : user.role?.replace('_', ' ') || 'User'}
            </div>
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
              {/* Real-time sync indicator for avatar */}
              {profileData?.avatar && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full flex items-center justify-center">
                  <Cloud className="w-2 h-2 text-white" />
                </div>
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
                    disabled={isSyncing}
                  />
                  <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200 text-sm font-medium">
                    <Camera className="w-4 h-4" />
                    Choose Photo
                  </div>
                </label>

                {avatarFile && (
                  <button
                    onClick={handleAvatarUpload}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {isSyncing ? 'Syncing...' : 'Upload & Sync'}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                JPG, PNG or GIF (max 5MB). Auto-syncs across all devices.
              </p>
            </div>
          </div>
        </div>

        {/* Profile Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Full Name *
            </label>
            {isEditing ? (
              <div>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
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
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg flex items-center justify-between">
                <span className="text-gray-900 dark:text-gray-100">{profileData?.name || 'Not set'}</span>
                {profileData?.name && <Cloud className="w-3 h-3 text-green-500" />}
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
                value={editForm.display_name}
                onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="How should we display your name?"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg flex items-center justify-between">
                <span className="text-gray-900 dark:text-gray-100">{profileData?.display_name || 'Not set'}</span>
                {profileData?.display_name && <Cloud className="w-3 h-3 text-green-500" />}
              </div>
            )}
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Department
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editForm.department}
                onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Cardiology, Emergency Medicine"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg flex items-center justify-between">
                <span className="text-gray-900 dark:text-gray-100">{profileData?.department || 'Not set'}</span>
                {profileData?.department && <Cloud className="w-3 h-3 text-green-500" />}
              </div>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Phone Number
            </label>
            {isEditing ? (
              <div>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
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
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg flex items-center justify-between">
                <span className="text-gray-900 dark:text-gray-100">{profileData?.phone || 'Not set'}</span>
                {profileData?.phone && <Cloud className="w-3 h-3 text-green-500" />}
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Location
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Toronto, ON or Remote"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg flex items-center justify-between">
                <span className="text-gray-900 dark:text-gray-100">{profileData?.location || 'Not set'}</span>
                {profileData?.location && <Cloud className="w-3 h-3 text-green-500" />}
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
              value={editForm.bio}
              onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
              placeholder="Brief description about yourself, your specialties, or role..."
            />
          ) : (
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg min-h-[80px] flex items-start justify-between">
              <span className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap flex-1">{profileData?.bio || 'Not set'}</span>
              {profileData?.bio && <Cloud className="w-3 h-3 text-green-500 flex-shrink-0 mt-1" />}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-start pt-4">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
            >
              <Edit className="w-4 h-4" />
              Edit Profile
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isSyncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSyncing ? 'Syncing...' : 'Save & Sync'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSyncing}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Sync Status Panel */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Real-Time Sync Status
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-800 dark:text-blue-200">Connection:</span>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-blue-700 dark:text-blue-300">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            <div>
              <span className="font-medium text-blue-800 dark:text-blue-200">Real-time:</span>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${syncStatus.isRealtimeConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="text-blue-700 dark:text-blue-300">
                  {syncStatus.isRealtimeConnected ? 'Connected' : 'Connecting...'}
                </span>
              </div>
            </div>

            <div>
              <span className="font-medium text-blue-800 dark:text-blue-200">Last Sync:</span>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Never'}
              </p>
            </div>

            <div>
              <span className="font-medium text-blue-800 dark:text-blue-200">Device:</span>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                {syncStatus.deviceId.slice(-8)}
              </p>
            </div>
          </div>

          {/* Recent Sync Events */}
          {syncEvents.length > 0 && (
            <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-600">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-blue-800 dark:text-blue-200">Recent Activity:</h4>
                <button
                  onClick={clearSyncEvents}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {syncEvents.slice(0, 3).map((event, index) => (
                  <div key={index} className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <div className="w-1 h-1 bg-blue-500 rounded-full" />
                    <span className="capitalize">{event.type.replace('_', ' ')}</span>
                    {event.field && <span>({event.field})</span>}
                    <Clock className="w-3 h-3" />
                    <span className="text-blue-500 dark:text-blue-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-600">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {isOnline
                ? '✅ Your profile changes are instantly synchronized across all devices in real-time.'
                : '⚠️ Offline mode: Changes are saved locally and will sync when connection is restored.'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}