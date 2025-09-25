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
    first_name: '',
    last_name: '',
    display_name: '',
    department: '',
    phone: ''
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

  useEffect(() => {
    loadUserProfile()
  }, [user.id])

  const loadUserProfile = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await enhancedUserService.getCompleteUserProfile(user.id)
      if (response.status === 'success' && response.data) {
        const userData = response.data
        setProfile({
          name: userData.name,
          first_name: userData.profile.first_name || '',
          last_name: userData.profile.last_name || '',
          display_name: userData.profile.display_name || '',
          department: userData.profile.department || '',
          phone: userData.profile.phone || ''
        })
      } else {
        console.warn('Failed to load enhanced profile, using basic profile')
        setProfile({
          name: user.name || '',
          first_name: '',
          last_name: '',
          display_name: '',
          department: '',
          phone: ''
        })
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
    } finally {
      setIsLoading(false)
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
    if (!validateForm()) {
      setError('Please fix the validation errors before saving')
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await enhancedUserService.updateUserProfile(user.id, profile)

      if (response.status === 'success') {
        setSuccessMessage('Profile updated successfully!')
        setIsEditing(false)

        // Update localStorage for immediate UI updates
        try {
          const currentUser = localStorage.getItem('currentUser')
          if (currentUser) {
            const userData = JSON.parse(currentUser)
            if (userData.id === user.id) {
              userData.name = profile.name
              userData.updated_at = new Date().toISOString()
              localStorage.setItem('currentUser', JSON.stringify(userData))
            }
          }

          // Update systemUsers
          const systemUsers = localStorage.getItem('systemUsers')
          if (systemUsers) {
            const users = JSON.parse(systemUsers)
            const userIndex = users.findIndex((u: any) => u.id === user.id)
            if (userIndex >= 0) {
              users[userIndex].name = profile.name
              users[userIndex].updated_at = new Date().toISOString()
              localStorage.setItem('systemUsers', JSON.stringify(users))
            }
          }

          // Trigger update events
          window.dispatchEvent(new Event('userDataUpdated'))
          window.dispatchEvent(new CustomEvent('userProfileUpdated', {
            detail: { userId: user.id, name: profile.name }
          }))
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'currentUser',
            newValue: JSON.stringify({...user, name: profile.name, updated_at: new Date().toISOString()}),
            storageArea: localStorage
          }))

        } catch (storageError) {
          console.warn('Failed to update localStorage:', storageError)
        }

        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        setError(response.error || 'Failed to update profile')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setProfile({
      name: user.name || '',
      first_name: '',
      last_name: '',
      display_name: '',
      department: '',
      phone: ''
    })
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
      const result = await avatarStorageService.uploadAvatar(user.id, avatarFile)

      if (result.status === 'success') {
        setSuccessMessage('Profile picture updated successfully!')
        setAvatarFile(null)
        if (result.data) {
          setAvatarPreview(result.data)
        }

        // Trigger update events
        window.dispatchEvent(new Event('userDataUpdated'))
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
              First Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={profile.first_name}
                onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="First name"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100">{profile.first_name || 'Not set'}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Last Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={profile.last_name}
                onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Last name"
              />
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100">{profile.last_name || 'Not set'}</span>
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
        </div>

        {/* Read-only Information */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Account Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                Email Address
              </label>
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100">{user.email}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Shield className="w-4 h-4 inline mr-2" />
                Role
              </label>
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-gray-900 dark:text-gray-100 capitalize">
                  {user.role?.replace('_', ' ') || 'User'}
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

        {/* Info Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Profile Information</h4>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                Your profile information is synchronized across all devices and applications.
                Changes are automatically saved to ensure consistency.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}