import React, { useState, useEffect } from 'react'
import {
  UserIcon,
  EditIcon,
  TrashIcon,
  ShieldIcon,
  ShieldCheckIcon,
  MoreVerticalIcon,
  MailIcon,
  PhoneIcon,
  KeyIcon,
  EyeIcon,
  EyeOffIcon,
  UnlockIcon,
  CheckIcon,
  HistoryIcon,
  ClockIcon,
  XIcon,
  CalendarIcon,
  MonitorIcon,
  AlertTriangleIcon
} from 'lucide-react'
import { userManagementService, SystemUserWithCredentials } from '@/services/userManagementService'
import { userProfileService } from '@/services/userProfileService'
import { fixUserIssues } from '@/utils/fixUserIssues'
import TestUserCleanup from '@/utils/testUserCleanup'
import { ensureFreshUserData } from '@/utils/clearUserCache'

// Use the SystemUserWithCredentials type from the service
type User = SystemUserWithCredentials

// Secure password generation utility - replaces hardcoded passwords
const generateSecurePassword = (length: number = 16): string => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const values = crypto.getRandomValues(new Uint32Array(length))

  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset[values[i] % charset.length]
  }

  // Ensure password complexity requirements
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[!@#$%^&*]/.test(password)

  // Regenerate if doesn't meet complexity requirements
  if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
    return generateSecurePassword(length)
  }

  return password
}

interface UserManagementPageProps {
  user: any
}

export const UserManagementPage: React.FC<UserManagementPageProps> = ({ user }) => {
  const [users, setUsers] = useState<User[]>([])
  const [isAddingUser, setIsAddingUser] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [quickCreateExpanded, setQuickCreateExpanded] = useState(false)
  const [customQuickCreate, setCustomQuickCreate] = useState({ name: '', email: '', password: '', role: 'user' as const })

  // Login History Modal State
  const [showLoginHistory, setShowLoginHistory] = useState(false)
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<User | null>(null)
  const [loginHistory, setLoginHistory] = useState<{
    loginHistory: Array<{
      timestamp: string
      action: string
      outcome: 'SUCCESS' | 'FAILURE'
      sourceIp?: string
      userAgent?: string
      failureReason?: string
    }>
    totalLogins: number
  } | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'healthcare_provider' as 'admin' | 'healthcare_provider' | 'staff'
  })

  // Quick create templates for easy user creation
  const quickCreateTemplates = [
    {
      name: 'John Smith',
      email: 'john.smith@carexps.com',
      password: generateSecurePassword(),
      role: 'user' as const,
      description: 'Standard User Template'
    },
    {
      name: 'Super Admin',
      email: 'superadmin@carexps.com',
      password: generateSecurePassword(),
      role: 'super_user' as const,
      description: 'Super User Template'
    },
    {
      name: 'Test User',
      email: 'test@carexps.com',
      password: generateSecurePassword(),
      role: 'user' as const,
      description: 'Test User Template'
    },
    {
      name: 'Manager User',
      email: 'manager@carexps.com',
      password: generateSecurePassword(),
      role: 'super_user' as const,
      description: 'Manager Super User Template'
    }
  ]

  // Check if current user is super_user - ONLY super_users can manage users
  const canManageUsers = user?.role === 'super_user'

  // Helper function to safely format dates
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'N/A'
      return date.toLocaleDateString()
    } catch (error) {
      return 'N/A'
    }
  }

  // Helper function to format last login with both date and time
  const formatLastLogin = (dateString: string | undefined) => {
    if (!dateString) return 'Never'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Never'
      const dateStr = date.toLocaleDateString()
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      return `${dateStr} at ${timeStr}`
    } catch (error) {
      return 'Never'
    }
  }

  useEffect(() => {
    loadUsers()

    // Set up real-time sync listeners for cross-device updates
    const handleUserDataUpdate = (event: CustomEvent) => {
      console.log('📥 UserManagementPage: Received user data update:', event.detail)

      if (event.detail?.action === 'user_added') {
        // Refresh the user list when a new user is added on another device
        loadUsers()
      } else if (event.detail?.action === 'user_updated') {
        // Refresh the user list when a user is updated on another device
        loadUsers()
      } else if (event.detail?.action === 'user_deleted') {
        // Refresh the user list when a user is deleted on another device
        loadUsers()
      }
    }

    // Listen for user data updates from other devices
    window.addEventListener('userDataUpdated', handleUserDataUpdate as EventListener)

    // Listen for user creation events
    const handleUserCreated = (event: CustomEvent) => {
      console.log('📥 UserManagementPage: New user created on another device:', event.detail)
      loadUsers() // Refresh to show the new user
    }

    window.addEventListener('userCreated', handleUserCreated as EventListener)

    // Cleanup event listeners
    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdate as EventListener)
      window.removeEventListener('userCreated', handleUserCreated as EventListener)
    }
  }, [])

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      console.log('🔄 UserManagement: Starting comprehensive user loading process...')

      // Clear outdated cache to ensure we get fresh data with last_login values
      ensureFreshUserData();

      // Try the primary user management service first
      const response = await userManagementService.loadSystemUsers()
      console.log('📊 UserManagement: Primary service response:', response.status, response.data?.length || 0, 'users')

      if (response.status === 'success' && response.data && response.data.length > 0) {
        console.log('✅ UserManagement: Successfully loaded users from primary service')
        setUsers(response.data)
        return
      }

      console.log('⚠️ UserManagement: Primary service failed, trying alternative sources...')

      // Fallback 1: Try userProfileService (which has better Supabase integration)
      try {
        console.log('🔄 Trying userProfileService...')
        const profileResponse = await userProfileService.loadSystemUsers()

        if (profileResponse.status === 'success' && profileResponse.data && profileResponse.data.length > 0) {
          console.log('✅ UserManagement: Loaded users from userProfileService:', profileResponse.data.length)

          // Transform to the expected format for UserManagement
          const transformedUsers = profileResponse.data.map((u: any) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            created: u.created_at || new Date().toISOString(),
            lastLogin: u.lastLogin,
            isLocked: u.isLocked || false,
            // Include additional fields that might be needed
            settings: u.settings || {},
            credentials: undefined,
            loginAttempts: 0
          }))

          setUsers(transformedUsers)

          // Update localStorage cache to sync data sources
          localStorage.setItem('systemUsers', JSON.stringify(transformedUsers))
          console.log('📦 Updated localStorage cache with userProfileService data')
          return
        }
      } catch (profileError) {
        console.log('⚠️ UserProfileService also failed:', profileError)
      }

      // Fallback 2: Direct localStorage access
      console.log('🔄 Fallback to direct localStorage access...')
      const storedUsers = localStorage.getItem('systemUsers')
      if (storedUsers) {
        try {
          const parsedUsers = JSON.parse(storedUsers)
          console.log('📊 Found users in localStorage:', parsedUsers.length)

          // Ensure users have the correct format
          const validatedUsers = parsedUsers.map((u: any) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            created: u.created || u.created_at || new Date().toISOString(),
            lastLogin: u.lastLogin,
            isLocked: u.isLocked || false,
            settings: u.settings || {},
            credentials: undefined,
            loginAttempts: 0
          }))

          setUsers(validatedUsers)
          console.log('✅ Successfully loaded users from localStorage')
          return
        } catch (parseError) {
          console.error('❌ Failed to parse localStorage users:', parseError)
        }
      }

      // MedEx: No demo users - keep system clean
      console.log('✅ MedEx: All data sources returned 0 users - this is correct for a clean system')
      setUsers([])
      // Clear any cached demo users
      localStorage.removeItem('systemUsers')

    } catch (error) {
      console.error('❌ Critical error in loadUsers:', error)
      // Final fallback - empty array to prevent crashes
      setUsers([])
    } finally {
      setIsLoading(false)
      console.log('✅ User loading process completed')
    }
  }

  const saveUsers = async (updatedUsers: User[]) => {
    try {
      const response = await userManagementService.saveSystemUsers(updatedUsers)
      if (response.status === 'success') {
        setUsers(updatedUsers)
        // Also update localStorage for backward compatibility
        localStorage.setItem('systemUsers', JSON.stringify(updatedUsers))
      } else {
        console.error('Failed to save users to Supabase:', response.error)
        // Fallback to localStorage only
        setUsers(updatedUsers)
        localStorage.setItem('systemUsers', JSON.stringify(updatedUsers))
      }
    } catch (error) {
      console.error('Error saving users:', error)
      // Fallback to localStorage only
      setUsers(updatedUsers)
      localStorage.setItem('systemUsers', JSON.stringify(updatedUsers))
    }
  }

  const handleAddUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) return

    // Check for duplicate email in current users list
    const existingUser = users.find(u => u.email.toLowerCase() === newUser.email.toLowerCase())
    if (existingUser) {
      alert('A user with this email already exists')
      return
    }

    setIsLoading(true)

    try {
      const userData = {
        email: newUser.email.trim(),
        name: newUser.name.trim(),
        role: newUser.role,
        mfa_enabled: false,
        settings: {
          theme: 'light',
          notifications: {}
        }
      }

      const credentials = {
        email: newUser.email.trim(),
        password: newUser.password,
        tempPassword: false
      }

      console.log('🔄 Creating user with data:', { email: userData.email, name: userData.name, role: userData.role })

      // Create user in Supabase
      const response = await userManagementService.createSystemUser(userData, credentials)

      if (response.status === 'success' && response.data) {
        console.log('✅ User creation successful:', response.data)

        // Format the new user data to match the User interface
        const newUserForList: User = {
          id: response.data.id,
          email: response.data.email,
          name: response.data.name,
          role: response.data.role,
          created: response.data.created_at || new Date().toISOString(),
          lastLogin: response.data.lastLogin,
          isLocked: response.data.isLocked || false
        }

        // CRITICAL FIX: Update UI state immediately and force refresh
        console.log('🔄 Updating UI state with new user')
        setUsers(currentUsers => {
          const updatedUsers = [...currentUsers, newUserForList]
          console.log('📊 Updated users list:', updatedUsers.length, 'users')
          return updatedUsers
        })

        // Reset form and close modal
        setNewUser({ name: '', email: '', password: '', role: 'healthcare_provider' })
        setIsAddingUser(false)

        // Show success message immediately
        alert('✅ User created successfully!')

        // Trigger multiple events for cross-component updates
        window.dispatchEvent(new Event('userDataUpdated'))
        window.dispatchEvent(new CustomEvent('userCreated', {
          detail: { user: newUserForList, timestamp: new Date().toISOString() }
        }))

        // Force a fresh reload from all data sources after a brief delay
        // This ensures the UI shows the most current data from all sources
        setTimeout(async () => {
          console.log('🔄 Force refreshing user list from all sources')
          await loadUsers()
          console.log('✅ User list refresh completed')
        }, 500)

        console.log('✅ User addition process completed successfully')
      } else {
        console.error('❌ Failed to create user:', response.error)
        const errorMessage = response.error || 'Unknown error occurred'
        if (errorMessage.includes('already exists')) {
          alert('❌ Cannot create user: A user with this email already exists in the system.')
        } else {
          alert(`❌ Failed to add user: ${errorMessage}`)
        }
      }
    } catch (error: any) {
      console.error('❌ Error adding user:', error)
      alert(`❌ Failed to add user: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditUser = async (updatedUser: User) => {
    setIsLoading(true)

    try {
      // Update user profile in Supabase
      const response = await userProfileService.saveUserProfile(updatedUser)

      if (response.status === 'success') {
        const updatedUsers = users.map(u => u.id === updatedUser.id ? updatedUser : u)
        await saveUsers(updatedUsers)
        setEditingUser(null)
        setNewPassword('')
        setIsChangingPassword(false)
      } else {
        console.error('Failed to update user:', response.error)
        alert(`Failed to update user: ${response.error}`)
      }
    } catch (error: any) {
      console.error('Error updating user:', error)
      alert(`Failed to update user: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!editingUser || !newPassword.trim()) {
      alert('Please enter a new password')
      return
    }

    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters long')
      return
    }

    setIsLoading(true)
    try {
      const response = await userManagementService.changeUserPassword(editingUser.id, newPassword)

      if (response.status === 'success') {
        alert('Password changed successfully! The user can now login with the new password.')
        setNewPassword('')
        setIsChangingPassword(false)
        setEditingUser(null)

        // Refresh the users list to reflect any changes
        await loadUsers()
      } else {
        alert(`Failed to change password: ${response.error}`)
      }
    } catch (error: any) {
      console.error('Error changing password:', error)
      alert(`Failed to change password: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewLoginHistory = async (userItem: User) => {
    setSelectedUserForHistory(userItem)
    setShowLoginHistory(true)
    setLoadingHistory(true)
    setLoginHistory(null)

    try {
      const response = await userManagementService.getUserLoginHistory(userItem.id)
      if (response.status === 'success') {
        setLoginHistory(response.data)
      } else {
        console.error('Failed to load login history:', response.error)
        alert(`Failed to load login history: ${response.error}`)
      }
    } catch (error: any) {
      console.error('Error loading login history:', error)
      alert(`Error loading login history: ${error.message}`)
    } finally {
      setLoadingHistory(false)
    }
  }

  const closeLoginHistoryModal = () => {
    setShowLoginHistory(false)
    setSelectedUserForHistory(null)
    setLoginHistory(null)
    setLoadingHistory(false)
  }

  const formatLoginDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    } catch {
      return timestamp
    }
  }

  const getDeviceInfo = (userAgent?: string) => {
    if (!userAgent) return 'Unknown Device'

    if (userAgent.includes('Windows')) return 'Windows PC'
    if (userAgent.includes('Mac')) return 'Mac'
    if (userAgent.includes('Linux')) return 'Linux'
    if (userAgent.includes('iPhone')) return 'iPhone'
    if (userAgent.includes('Android')) return 'Android'
    if (userAgent.includes('iPad')) return 'iPad'

    return 'Unknown Device'
  }

  const handleClearLockout = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to clear the account lockout for ${userName}?`)) return

    setIsLoading(true)
    try {
      const response = await userManagementService.clearAccountLockout(userId)

      if (response.status === 'success') {
        alert('Account lockout cleared successfully!')
        // Reload users to refresh the status
        loadUsers()
      } else {
        alert(`Failed to clear lockout: ${response.error}`)
      }
    } catch (error: any) {
      console.error('Error clearing lockout:', error)
      alert(`Failed to clear lockout: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Debug function to view and manage deleted users list (only for super users)
  const viewDeletedUsers = () => {
    const deletedUsers = localStorage.getItem('deletedUsers')
    if (deletedUsers) {
      try {
        const deletedList = JSON.parse(deletedUsers)
        console.log('Currently deleted users:', deletedList)
        alert(`${deletedList.length} users have been permanently deleted. Check console for details.`)
      } catch (error) {
        console.error('Failed to parse deleted users:', error)
        alert('Error parsing deleted users list')
      }
    } else {
      console.log('No deleted users found')
      alert('No users have been permanently deleted yet.')
    }
  }

  // Export to window for debugging
  if (typeof window !== 'undefined') {
    (window as any).viewDeletedUsers = viewDeletedUsers
  }













  // Quick create user function - mirrors the easy createGuestUser approach
  const handleQuickCreateUser = async (template: typeof quickCreateTemplates[0]) => {
    // Check for duplicate email in current users list
    const existingUser = users.find(u => u.email.toLowerCase() === template.email.toLowerCase())
    if (existingUser) {
      alert('A user with this email already exists')
      return
    }

    setIsLoading(true)

    try {
      const userData = {
        email: template.email,
        name: template.name,
        role: template.role,
        mfa_enabled: false,
        settings: {
          theme: 'light',
          notifications: {}
        }
      }

      const credentials = {
        email: template.email,
        password: template.password,
        tempPassword: false
      }

      // Create user using the same service as the main form
      const response = await userManagementService.createSystemUser(userData, credentials)

      if (response.status === 'success' && response.data) {
        // Format the new user data to match the User interface
        const newUserForList: User = {
          id: response.data.id,
          email: response.data.email,
          name: response.data.name,
          role: response.data.role,
          created: response.data.created_at || new Date().toISOString(),
          lastLogin: response.data.lastLogin,
          isLocked: response.data.isLocked || false
        }

        // Update local state immediately with the new user
        setUsers(currentUsers => [...currentUsers, newUserForList])

        alert('✅ User created successfully! The user can now log in with their credentials.')
      } else {
        const errorMessage = response.error || 'Unknown error'
        if (errorMessage.includes('already exists')) {
          alert('❌ Cannot create user: A user with this email already exists in the system.')
        } else {
          alert(`❌ Failed to create user: ${errorMessage}`)
        }
      }
    } catch (error) {
      console.error('Error creating user:', error)
      alert(`Error creating user: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Custom quick create - allows user to specify password
  const handleCustomQuickCreate = async () => {
    if (!customQuickCreate.name.trim() || !customQuickCreate.email.trim() || !customQuickCreate.password.trim()) {
      alert('Please fill in all required fields')
      return
    }

    // Check for duplicate email in current users list
    const existingUser = users.find(u => u.email.toLowerCase() === customQuickCreate.email.toLowerCase())
    if (existingUser) {
      alert('A user with this email already exists')
      return
    }

    const template = {
      name: customQuickCreate.name,
      email: customQuickCreate.email,
      password: customQuickCreate.password,
      role: customQuickCreate.role,
      description: 'Custom Quick Create'
    }

    await handleQuickCreateUser(template)

    // Reset form after successful creation
    setCustomQuickCreate({ name: '', email: '', password: '', role: 'user' })
  }

  const handleDeleteUser = async (userId: string) => {
    if (userId === user.id) {
      alert('Cannot delete your own account')
      return
    }

    // Find the user to get their details for confirmation
    const userToDelete = users.find(u => u.id === userId)
    if (!userToDelete) {
      alert('User not found')
      return
    }

    // Enhanced confirmation with user details
    const confirmMessage = `Are you sure you want to permanently delete this user?\n\nThis action cannot be undone and the user will be completely removed from the system.`

    if (!confirm(confirmMessage)) return

    setIsLoading(true)

    try {
      console.log('Deleting user')

      // Step 1: Delete from Supabase and services
      const response = await userManagementService.deleteSystemUser(userId)

      if (response.status === 'success') {
        // Step 2: Remove from current users list
        const updatedUsers = users.filter(u => u.id !== userId)
        setUsers(updatedUsers)

        // Step 3: Update localStorage systemUsers
        localStorage.setItem('systemUsers', JSON.stringify(updatedUsers))

        // Step 4: Add to deletedUsers list to prevent recreation (enhanced tracking)
        const deletedUsers = localStorage.getItem('deletedUsers')
        let deletedUserIds = []
        if (deletedUsers) {
          try {
            deletedUserIds = JSON.parse(deletedUsers)
          } catch (parseError) {
            console.warn('Failed to parse deleted users list:', parseError)
            deletedUserIds = []
          }
        }

        if (!deletedUserIds.includes(userId)) {
          deletedUserIds.push(userId)
          localStorage.setItem('deletedUsers', JSON.stringify(deletedUserIds))
          console.log('Added user to deleted list')
        }

        // Step 5: Also track deleted emails to prevent recreation via email
        const deletedEmails = localStorage.getItem('deletedUserEmails')
        let deletedEmailList = []
        if (deletedEmails) {
          try {
            deletedEmailList = JSON.parse(deletedEmails)
          } catch (parseError) {
            console.warn('Failed to parse deleted emails list:', parseError)
            deletedEmailList = []
          }
        }

        if (!deletedEmailList.includes(userToDelete.email.toLowerCase())) {
          deletedEmailList.push(userToDelete.email.toLowerCase())
          localStorage.setItem('deletedUserEmails', JSON.stringify(deletedEmailList))
          console.log('Added email to deleted list')
        }

        // Step 5: Clean up all user-related storage
        localStorage.removeItem(`userCredentials_${userId}`)
        localStorage.removeItem(`loginStats_${userId}`)

        console.log('User successfully deleted and marked as permanently deleted')
        alert('User has been permanently deleted.')

      } else {
        console.error('Failed to delete user:', response.error)
        alert(`Failed to delete user: ${response.error}`)
      }
    } catch (error: any) {
      console.error('Error deleting user:', error)
      alert(`Failed to delete user: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleUserStatus = async (userId: string) => {
    if (userId === user.id) {
      alert('Cannot toggle your own account status')
      return
    }

    // Check if this is a demo/admin user that should never be locked
    const targetUser = users.find(u => u.id === userId)
    if (targetUser && (
      targetUser.email?.toLowerCase() === 'elmfarrell@yahoo.com' ||
      targetUser.email?.toLowerCase() === 'pierre@phaetonai.com' ||
      targetUser.email?.toLowerCase() === 'demo@carexps.com' ||
      targetUser.email?.toLowerCase() === 'guest@email.com'
    )) {
      alert('Cannot lock demo/admin accounts')
      return
    }

    setIsLoading(true)

    try {
      if (targetUser?.isLocked) {
        // If user is locked, unlock them
        const response = await userManagementService.clearAccountLockout(userId)
        if (response.status === 'success') {
          loadUsers() // Reload to refresh status
        } else {
          alert(`Failed to unlock account: ${response.error}`)
        }
      } else {
        // If user is active, lock them (this would need a new service method)
        const updatedUsers = users.map(u =>
          u.id === userId ? { ...u, isLocked: true } : u
        )
        await saveUsers(updatedUsers)
      }
    } catch (error: any) {
      console.error('Error toggling user status:', error)
      alert(`Failed to toggle user status: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredUsers = users

  console.log('UserManagementPage render:', {
    totalUsers: users.length,
    filteredUsers: filteredUsers.length,
    isAddingUser,
    isLoading
  })

  const getRoleIcon = (role: string) => {
    return role === 'super_user' ? ShieldCheckIcon : UserIcon
  }

  const getRoleLabel = (role: string) => {
    return role === 'super_user' ? 'Super User' : 'User'
  }

  if (!canManageUsers) {
    return (
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-600 rounded-lg p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <ShieldIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
            <h3 className="text-sm sm:text-base font-medium text-yellow-800 dark:text-yellow-200">Access Restricted</h3>
          </div>
          <p className="text-sm sm:text-base text-yellow-700 dark:text-yellow-300 mt-2">
            Only Super Users can manage user accounts. Regular users and healthcare providers cannot add, edit, or delete users.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <UserIcon className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
            User Management
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Manage system users and their permissions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsAddingUser(true)}
            className="px-3 py-2 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm sm:text-base min-h-[44px]"
            disabled={isLoading}
          >
            <UserIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Add User</span>
            <span className="sm:hidden">Add</span>
          </button>

        </div>
      </div>


      {/* Users List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
            System Users ({filteredUsers.length})
          </h2>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredUsers.map((userItem) => {
            const RoleIcon = getRoleIcon(userItem.role)
            return (
              <div key={userItem.id} className="p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                      {userItem.avatar ? (
                        <img
                          src={userItem.avatar}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate">{userItem.name}</h3>
                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                          <div className="flex items-center gap-1">
                            <RoleIcon className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                            <span className="text-xs text-blue-600 font-medium">
                              {getRoleLabel(userItem.role)}
                            </span>
                          </div>
                          <div className={`px-2 py-1 text-xs rounded-full ${
                            !userItem.isLocked
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {!userItem.isLocked ? 'Active' : 'Locked'}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                        <div className="flex items-center gap-1">
                          <MailIcon className="w-3 h-3" />
                          <span className="truncate">{userItem.email}</span>
                        </div>
                        <span className="hidden sm:inline">Created: {formatDate(userItem.created_at)}</span>
                        <span className="sm:hidden">Created {formatDate(userItem.created_at)}</span>
                        {userItem.lastLogin ? (
                          <span className="hidden sm:inline">Last login: {formatLastLogin(userItem.lastLogin)}</span>
                        ) : (
                          <span className="text-gray-400 hidden sm:inline">Last login: Never</span>
                        )}
                        {userItem.lastLogin ? (
                          <span className="sm:hidden text-xs">Last: {formatLastLogin(userItem.lastLogin)}</span>
                        ) : (
                          <span className="text-gray-400 sm:hidden text-xs">Never logged in</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    <button
                      onClick={() => setEditingUser(userItem)}
                      className="p-2 sm:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Edit user"
                    >
                      <EditIcon className="w-4 h-4" />
                    </button>

                    {userItem.isLocked && (
                      <button
                        onClick={() => handleClearLockout(userItem.id, userItem.name)}
                        className="p-2 sm:p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Clear lockout"
                        disabled={isLoading}
                      >
                        <UnlockIcon className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteUser(userItem.id)}
                      className="p-2 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Delete user permanently"
                      disabled={isLoading || userItem.id === user.id}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setIsChangingPassword(true) || setEditingUser(userItem)}
                      className="p-2 sm:p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Change password"
                      disabled={isLoading}
                    >
                      <KeyIcon className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleViewLoginHistory(userItem)}
                      className="p-2 sm:p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="View login history"
                      disabled={isLoading}
                    >
                      <HistoryIcon className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              </div>
            )
          })}

          {filteredUsers.length === 0 && (
            <div className="p-6 sm:p-8 text-center text-gray-500 dark:text-gray-400">
              <span className="text-sm sm:text-base">No users found.</span>
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Add New User</h3>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
                  placeholder="Enter password"
                  minLength={6}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Password must be at least 6 characters long</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'super_user' | 'user' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
                >
                  <option value="user">User</option>
                  <option value="super_user">Super User</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
              <button
                onClick={() => setIsAddingUser(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors min-h-[44px] order-2 sm:order-1"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                disabled={isLoading || !newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] order-1 sm:order-2"
              >
                {isLoading ? 'Adding...' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {isChangingPassword ? 'Change User Password' : 'Edit User'}
            </h3>

            <div className="space-y-3 sm:space-y-4">
              {isChangingPassword ? (
                // Password Change Form
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      User
                    </label>
                    <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600">
                      {editingUser.name} ({editingUser.email})
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 8 characters)"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Password must be at least 8 characters long
                    </p>
                  </div>
                </>
              ) : (
                // Regular Edit Form
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editingUser.name}
                      onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={editingUser.email}
                      onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Role
                    </label>
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as 'super_user' | 'user' })}
                      disabled={editingUser.id === user.id}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    >
                      <option value="user">User</option>
                      <option value="super_user">Super User</option>
                    </select>
                    {editingUser.id === user.id && (
                      <p className="text-xs text-gray-500 mt-1">Cannot change your own role</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setEditingUser(null)
                  setNewPassword('')
                  setIsChangingPassword(false)
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors min-h-[44px] order-last sm:order-first"
                disabled={isLoading}
              >
                Cancel
              </button>

              {isChangingPassword ? (
                <button
                  onClick={handleChangePassword}
                  disabled={isLoading || !newPassword.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] order-first sm:order-last"
                >
                  {isLoading ? 'Changing...' : 'Change Password'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setIsChangingPassword(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors min-h-[44px] order-2 sm:order-2"
                    disabled={isLoading}
                  >
                    Change Password
                  </button>
                  <button
                    onClick={() => handleEditUser(editingUser)}
                    disabled={isLoading || !editingUser.name.trim() || !editingUser.email.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] order-1 sm:order-3"
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Login History Modal */}
      {showLoginHistory && selectedUserForHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-6 w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
              <div className="flex items-center gap-3">
                <HistoryIcon className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">Login History</h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    {selectedUserForHistory.name} ({selectedUserForHistory.email})
                  </p>
                </div>
              </div>
              <button
                onClick={closeLoginHistoryModal}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-gray-600 dark:text-gray-400">Loading login history...</span>
                </div>
              </div>
            ) : loginHistory ? (
              <div>
                {/* Summary */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {loginHistory.totalLogins}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Successful Logins</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {loginHistory.loginHistory.length}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Recent Login Attempts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {loginHistory.loginHistory.filter(h => h.outcome === 'FAILURE').length}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Failed Attempts</div>
                    </div>
                  </div>
                </div>

                {/* Login History List */}
                {loginHistory.loginHistory.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                      Last 10 Login Attempts
                    </h4>
                    <div className="space-y-2">
                      {loginHistory.loginHistory.map((entry, index) => (
                        <div
                          key={index}
                          className={`p-3 sm:p-4 rounded-lg border ${
                            entry.outcome === 'SUCCESS'
                              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
                              : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              {entry.outcome === 'SUCCESS' ? (
                                <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                              ) : (
                                <AlertTriangleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                                  <span className={`text-xs sm:text-sm font-medium truncate ${
                                    entry.outcome === 'SUCCESS'
                                      ? 'text-green-800 dark:text-green-200'
                                      : 'text-red-800 dark:text-red-200'
                                  }`}>
                                    {entry.action}
                                  </span>
                                  <span className={`px-2 py-1 text-xs rounded-full self-start sm:self-auto ${
                                    entry.outcome === 'SUCCESS'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                                      : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                                  }`}>
                                    {entry.outcome}
                                  </span>
                                </div>
                                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                  <div className="flex items-center gap-1">
                                    <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                    <span className="truncate">{formatLoginDate(entry.timestamp)}</span>
                                  </div>
                                  {entry.sourceIp && (
                                    <div className="truncate">IP: {entry.sourceIp}</div>
                                  )}
                                  {entry.userAgent && (
                                    <div className="flex items-center gap-1">
                                      <MonitorIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                      <span className="truncate">{getDeviceInfo(entry.userAgent)}</span>
                                    </div>
                                  )}
                                  {entry.failureReason && (
                                    <div className="text-red-600 dark:text-red-400 font-medium text-xs sm:text-sm">
                                      Reason: {entry.failureReason}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <HistoryIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">No login history found</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      This user hasn't logged in recently or audit logs are not available
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-600 dark:text-red-400">Failed to load login history</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Please try again or contact your administrator
                </p>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex justify-end mt-4 sm:mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeLoginHistoryModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}