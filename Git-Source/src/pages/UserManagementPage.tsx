import React, { useState, useEffect } from 'react'
import {
  UserIcon,
  UserPlusIcon,
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
  CheckIcon
} from 'lucide-react'
import { userManagementService, SystemUserWithCredentials } from '@/services/userManagementService'
import { userProfileService } from '@/services/userProfileService'
import { runDuplicatePreventionTests, displayTestResults } from '@/utils/duplicateUserTest'
import { fixUserIssues } from '@/utils/fixUserIssues'
import { testUserFixes } from '@/utils/testUserFixes'
import { AuthenticationFixer } from '@/utils/authenticationFixer'
import { AuthenticationDebugger } from '@/utils/authenticationDebugger'
import { NewUserAuthTester } from '@/utils/newUserAuthTest'

// Use the SystemUserWithCredentials type from the service
type User = SystemUserWithCredentials

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
      password: 'User123!',
      role: 'user' as const,
      description: 'Standard User Template'
    },
    {
      name: 'Super Admin',
      email: 'superadmin@carexps.com',
      password: 'Super123!',
      role: 'super_user' as const,
      description: 'Super User Template'
    },
    {
      name: 'Test User',
      email: 'test@carexps.com',
      password: 'Test123!',
      role: 'user' as const,
      description: 'Test User Template'
    },
    {
      name: 'Manager User',
      email: 'manager@carexps.com',
      password: 'Manager123!',
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
  }, [])

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      console.log('UserManagement: Loading system users...')
      const response = await userManagementService.loadSystemUsers()
      console.log('UserManagement: Response received:', response)

      if (response.status === 'success' && response.data) {
        console.log('UserManagement: Found users:', response.data.length, response.data)
        setUsers(response.data)
      } else {
        console.error('Failed to load users:', response.error)
        console.log('UserManagement: Falling back to localStorage...')
        // Fallback to localStorage for backward compatibility
        const storedUsers = localStorage.getItem('systemUsers')
        if (storedUsers) {
          try {
            const parsedUsers = JSON.parse(storedUsers)
            // Transform legacy format to new format
            const transformedUsers = parsedUsers.map((u: any) => ({
              ...u,
              role: u.role === 'super_user' ? 'admin' : u.role,
              settings: u.settings || {},
              credentials: undefined,
              isLocked: false,
              loginAttempts: 0
            }))
            setUsers(transformedUsers)
          } catch (error) {
            console.error('Failed to parse stored users:', error)
            setUsers([])
          }
        } else {
          console.log('UserManagement: No localStorage users, loading from userProfileService...')
          // Try to load from userProfileService which handles demo users properly
          try {
            const profileResponse = await userProfileService.loadSystemUsers()
            if (profileResponse.status === 'success' && profileResponse.data) {
              const usersWithCredentials = profileResponse.data.map((u: any) => ({
                ...u,
                credentials: undefined,
                isLocked: false,
                loginAttempts: 0
              }))
              setUsers(usersWithCredentials)
              console.log('UserManagement: Loaded users from userProfileService:', usersWithCredentials.length)
            } else {
              console.log('UserManagement: userProfileService failed, creating minimal demo users...')
              // Only as last resort, create minimal demo users
              const demoUsers = [
                {
                  id: 'super-user-456',
                  email: 'elmfarrell@yahoo.com',
                  name: 'Dr. Farrell',
                  role: 'super_user',
                  mfa_enabled: false,
                  settings: { theme: 'dark', notifications: {} },
                  credentials: undefined,
                  isLocked: false,
                  loginAttempts: 0
                },
                {
                  id: 'pierre-user-789',
                  email: 'pierre@phaetonai.com',
                  name: 'Pierre PhaetonAI',
                  role: 'super_user',
                  mfa_enabled: false,
                  settings: { theme: 'light', notifications: { calls: true, sms: true, system: true } },
                  credentials: undefined,
                  isLocked: false,
                  loginAttempts: 0
                },
                {
                  id: 'guest-user-456',
                  email: 'guest@email.com',
                  name: 'Guest User',
                  role: 'user',
                  mfa_enabled: false,
                  settings: { theme: 'light', notifications: {} },
                  credentials: undefined,
                  isLocked: false,
                  loginAttempts: 0
                }
              ]
              setUsers(demoUsers)
            }
          } catch (serviceError) {
            console.error('UserManagement: userProfileService error:', serviceError)
            // Fallback to hardcoded demo users only if everything fails
            setUsers([])
          }
        }
      }
    } catch (error) {
      console.error('Error loading users:', error)
      console.log('UserManagement: Error occurred, trying userProfileService as fallback...')
      // Try userProfileService as fallback when there are errors
      try {
        const profileResponse = await userProfileService.loadSystemUsers()
        if (profileResponse.status === 'success' && profileResponse.data) {
          const usersWithCredentials = profileResponse.data.map((u: any) => ({
            ...u,
            credentials: undefined,
            isLocked: false,
            loginAttempts: 0
          }))
          setUsers(usersWithCredentials)
          console.log('UserManagement: Error fallback successful with userProfileService')
        } else {
          console.log('UserManagement: All methods failed, showing empty state')
          setUsers([])
        }
      } catch (serviceError) {
        console.error('UserManagement: Even userProfileService failed:', serviceError)
        setUsers([])
      }
    } finally {
      setIsLoading(false)
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

      // Create user in Supabase
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

        // Reset form and close modal
        setNewUser({ name: '', email: '', password: '', role: 'healthcare_provider' })
        setIsAddingUser(false)

        // Trigger custom event to notify other components of user data changes
        window.dispatchEvent(new Event('userDataUpdated'))

        // Also reload the user list to ensure consistency
        await loadUsers()

        console.log('User added successfully:', response.data)
        alert(`✅ User "${response.data.name}" created successfully!`)
      } else {
        console.error('Failed to create user:', response.error)
        const errorMessage = response.error || 'Unknown error occurred'
        if (errorMessage.includes('already exists')) {
          alert(`❌ Cannot create user: A user with email "${newUser.email}" already exists in the system.`)
        } else {
          alert(`❌ Failed to add user: ${errorMessage}`)
        }
      }
    } catch (error: any) {
      console.error('Error adding user:', error)
      alert(`Failed to add user: ${error.message}`)
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
        alert(`Password changed successfully!\\nUser: ${editingUser.email}\\nNew Password: ${newPassword}\\n\\nThe user can now login with the new password.`)
        setNewPassword('')
        setIsChangingPassword(false)
        setEditingUser(null)

        // Refresh the users list to reflect any changes
        await fetchUsers()
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
        alert(`Deleted Users:\n${deletedList.join('\n')}\n\nCheck console for full details.`)
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

  // Clean up duplicate users function
  const handleCleanupDuplicates = async () => {
    if (!confirm('This will remove duplicate users based on email addresses. The earliest created user for each email will be kept. Continue?')) {
      return
    }

    setIsLoading(true)
    try {
      const response = await userManagementService.cleanupDuplicateUsers()
      if (response.status === 'success') {
        const { removed, remaining } = response.data || { removed: 0, remaining: 0 }
        alert(`Cleanup completed!\n\nRemoved: ${removed} duplicate users\nRemaining: ${remaining} unique users`)
        // Reload the users list to reflect changes
        await loadUsers()
      } else {
        alert(`Cleanup failed: ${response.error}`)
      }
    } catch (error: any) {
      console.error('Error during cleanup:', error)
      alert(`Cleanup failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Test duplicate prevention function
  const handleTestDuplicatePrevention = async () => {
    setIsLoading(true)
    try {
      console.log('🧪 Starting duplicate prevention tests...')
      const result = await runDuplicatePreventionTests()
      displayTestResults(result)

      // Reload users after tests to show any changes
      await loadUsers()
    } catch (error: any) {
      console.error('Error running tests:', error)
      alert(`Test failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Fix all user issues function
  const handleFixAllUserIssues = async () => {
    if (!confirm('This will attempt to fix user recreation and profile image persistence issues. Continue?')) {
      return
    }

    setIsLoading(true)
    try {
      console.log('🔧 Starting comprehensive user issues fix...')
      const result = await fixUserIssues.fixAllUserIssues()

      const message = `User Issues Fix Complete!

Fixed Issues:
${result.fixes.length > 0 ? result.fixes.map(fix => `✅ ${fix}`).join('\n') : '• No fixes were needed'}

${result.issues.length > 0 ? `\nRemaining Issues:\n${result.issues.map(issue => `⚠️ ${issue}`).join('\n')}` : ''}

User Recreation Fixed: ${result.userRecreationFixed ? 'Yes' : 'No'}
Profile Images Fixed: ${result.profileImageFixed ? 'Yes' : 'No'}`

      alert(message)

      // Reload users to show changes
      await loadUsers()
    } catch (error: any) {
      console.error('Error fixing user issues:', error)
      alert(`Fix failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Test user fixes function
  const handleTestUserFixes = async () => {
    setIsLoading(true)
    try {
      console.log('🧪 Starting user fixes test suite...')
      const results = await testUserFixes.runAllTests()
      testUserFixes.displayResults(results)

      // Reload users after tests
      await loadUsers()
    } catch (error: any) {
      console.error('Error running user fixes tests:', error)
      alert(`Tests failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Fix all authentication issues
  const handleFixAuthentication = async () => {
    if (!confirm('This will fix all authentication issues including double-encrypted passwords, lockouts, and missing credentials. Continue?')) {
      return
    }

    setIsLoading(true)
    try {
      console.log('🔧 Starting comprehensive authentication fix...')
      const result = await AuthenticationFixer.fixAllAuthenticationIssues()

      const message = `Authentication Fix Complete!

${result.message}

Details:
${result.details.map(detail => `• ${detail}`).join('\n')}

${result.errors.length > 0 ? `\nErrors:\n${result.errors.map(error => `❌ ${error}`).join('\n')}` : ''}

Users Fixed: ${result.usersFixed}`

      alert(message)

      // Reload users to show changes
      await loadUsers()
    } catch (error: any) {
      console.error('Error fixing authentication:', error)
      alert(`Authentication fix failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Test all user authentication
  const handleTestAuthentication = async () => {
    setIsLoading(true)
    try {
      console.log('🧪 Testing authentication for all users...')
      const result = await AuthenticationFixer.testAllUserAuthentication()

      const message = `Authentication Test Results:

Total Users: ${result.totalUsers}
✅ Working Authentication: ${result.workingAuth}
❌ Failed Authentication: ${result.failedAuth}

Details:
${result.details.map(detail => `${detail.status === 'SUCCESS' ? '✅' : detail.status === 'FAILED' ? '❌' : '⚠️'} ${detail.email}: ${detail.details}`).join('\n')}`

      alert(message)
      console.log('Authentication test results:', result)
    } catch (error: any) {
      console.error('Error testing authentication:', error)
      alert(`Authentication test failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Fix Pierre specifically
  const handleFixPierre = async () => {
    if (!confirm('This will specifically fix authentication for pierre@phaetonai.com. Continue?')) {
      return
    }

    setIsLoading(true)
    try {
      console.log('🔧 Fixing Pierre authentication...')
      const result = await AuthenticationFixer.fixPierreAuthentication()

      const message = `Pierre Authentication Fix:

${result.message}

Details:
${result.details.map(detail => `• ${detail}`).join('\n')}

${result.errors.length > 0 ? `\nErrors:\n${result.errors.map(error => `❌ ${error}`).join('\n')}` : ''}

You can now test login with:
Email: pierre@phaetonai.com
Password: Pierre123!`

      alert(message)

      // Reload users to show changes
      await loadUsers()
    } catch (error: any) {
      console.error('Error fixing Pierre authentication:', error)
      alert(`Pierre fix failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Run authentication diagnostic
  const handleAuthDiagnostic = async () => {
    setIsLoading(true)
    try {
      console.log('🔍 Running comprehensive authentication diagnostic...')
      const report = await AuthenticationDebugger.runFullSystemDiagnostic()

      const message = `Authentication System Diagnostic:

Overall Health: ${report.overallHealth.toUpperCase()}
Users Checked: ${report.usersChecked}
Issues Found: ${report.issuesFound}

${report.systemIssues.length > 0 ? `System Issues:\n${report.systemIssues.map(issue => `❌ ${issue}`).join('\n')}\n` : ''}

User Status:
${report.userReports.map(user =>
  `${user.status === 'healthy' ? '✅' : user.status === 'issues_found' ? '⚠️' : '❌'} ${user.email}: ${user.issues.length} issues`
).join('\n')}

Recommendations:
${report.recommendations.map(rec => `• ${rec}`).join('\n')}`

      alert(message)
      console.log('Full diagnostic report:', report)
    } catch (error: any) {
      console.error('Error running diagnostic:', error)
      alert(`Diagnostic failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Test new user creation and authentication flow
  const handleTestNewUserAuth = async () => {
    setIsLoading(true)
    try {
      console.log('🧪 Testing new user creation and authentication flow...')
      const results = await NewUserAuthTester.runFullTestSuite()

      NewUserAuthTester.displayTestResults(results)

      // Reload users to show any test users that might still exist
      await loadUsers()
    } catch (error: any) {
      console.error('Error testing new user auth:', error)
      alert(`New user auth test failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Quick create user function - mirrors the easy createGuestUser approach
  const handleQuickCreateUser = async (template: typeof quickCreateTemplates[0]) => {
    // Check for duplicate email in current users list
    const existingUser = users.find(u => u.email.toLowerCase() === template.email.toLowerCase())
    if (existingUser) {
      alert(`A user with email ${template.email} already exists`)
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

        alert(`✅ User "${template.name}" created successfully!\n\nEmail: ${template.email}\nPassword: ${template.password}\n\nThe user can now log in with these credentials.`)
      } else {
        const errorMessage = response.error || 'Unknown error'
        if (errorMessage.includes('already exists')) {
          alert(`❌ Cannot create user: A user with email "${template.email}" already exists in the system.`)
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
      alert(`A user with email ${customQuickCreate.email} already exists`)
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
    const confirmMessage = `Are you sure you want to permanently delete this user?\n\nUser: ${userToDelete.name}\nEmail: ${userToDelete.email}\nRole: ${userToDelete.role}\n\nThis action cannot be undone and the user will be completely removed from the system.`

    if (!confirm(confirmMessage)) return

    setIsLoading(true)

    try {
      console.log('Deleting user:', userId, userToDelete.name)

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
          console.log('Added user to deleted list:', userId)
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
          console.log('Added email to deleted list:', userToDelete.email)
        }

        // Step 5: Clean up all user-related storage
        localStorage.removeItem(`userCredentials_${userId}`)
        localStorage.removeItem(`loginStats_${userId}`)

        console.log('User successfully deleted and marked as permanently deleted:', userId)
        alert(`User "${userToDelete.name}" has been permanently deleted.`)

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
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <ShieldIcon className="w-5 h-5 text-yellow-600" />
            <h3 className="font-medium text-yellow-800">Access Restricted</h3>
          </div>
          <p className="text-yellow-700 mt-2">
            Only Super Users can manage user accounts. Regular users and healthcare providers cannot add, edit, or delete users.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserIcon className="w-7 h-7 text-blue-600" />
            User Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage system users and their permissions
          </p>
        </div>

      </div>



      {/* Users List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            System Users ({filteredUsers.length})
          </h2>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredUsers.map((userItem) => {
            const RoleIcon = getRoleIcon(userItem.role)
            return (
              <div key={userItem.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                      {userItem.avatar ? (
                        <img
                          src={userItem.avatar}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserIcon className="w-5 h-5 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{userItem.name}</h3>
                        <div className="flex items-center gap-1">
                          <RoleIcon className="w-4 h-4 text-blue-600" />
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
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <div className="flex items-center gap-1">
                          <MailIcon className="w-3 h-3" />
                          {userItem.email}
                        </div>
                        <span>Created: {formatDate(userItem.created_at)}</span>
                        {userItem.lastLogin ? (
                          <span>Last login: {formatLastLogin(userItem.lastLogin)}</span>
                        ) : (
                          <span className="text-gray-400">Last login: Never</span>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )
          })}

          {filteredUsers.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No users found.
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New User</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter password"
                  minLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters long</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'super_user' | 'user' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="user">User</option>
                  <option value="super_user">Super User</option>
                </select>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {isChangingPassword ? 'Change User Password' : 'Edit User'}
            </h3>

            <div className="space-y-4">
              {isChangingPassword ? (
                // Password Change Form
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      User
                    </label>
                    <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600">
                      {editingUser.name} ({editingUser.email})
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editingUser.name}
                      onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={editingUser.email}
                      onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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

          </div>
        </div>
      )}
    </div>
  )
}