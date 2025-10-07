import React, { useState, useEffect } from 'react'
import { UserPlus, Trash2, Key, Lock, Unlock, UserCheck, UserX, Clock, ShieldCheck, Shield } from 'lucide-react'
import { userManagementService } from '@/services/userManagementService'
import { userProfileService } from '@/services/userProfileService'
import { PasswordDebugger } from '@/utils/passwordDebug'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/common/ToastContainer'

interface User {
  id: string
  name: string
  email: string
  role: string
  isLocked?: boolean
  isActive?: boolean
  lastLogin?: string
  created_at?: string
}

export const SimpleUserManager: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ userId: string; email: string } | null>(null)
  const [confirmDisable, setConfirmDisable] = useState<{ userId: string; email: string } | null>(null)
  const [confirmRoleChange, setConfirmRoleChange] = useState<{ userId: string; email: string; currentRole: string; newRole: 'user' | 'super_user' } | null>(null)
  const [firstUserId, setFirstUserId] = useState<string | null>(null)
  const { toasts, showToast, removeToast } = useToast()

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

  // New user form
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user'
  })

  // Password change form
  const [newPassword, setNewPassword] = useState('')

  // Load users on mount
  useEffect(() => {
    loadUsers()
    loadFirstUser()
  }, [])

  const loadUsers = async () => {
    try {
      console.log('🔍 DEBUG: Loading users from userManagementService...')
      const response = await userManagementService.loadSystemUsers()
      console.log('📊 DEBUG: userManagementService response:', response)

      if (response.status === 'success' && response.data) {
        console.log(`✅ DEBUG: Loaded ${response.data.length} users from service`)

        const mappedUsers = response.data.map(u => {
          const mapped = {
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            // Ensure demo/admin users are never shown as locked
            isLocked: (u.email?.toLowerCase() === 'elmfarrell@yahoo.com' ||
                       u.email?.toLowerCase() === 'pierre@phaetonai.com' ||
                       u.email?.toLowerCase() === 'demo@medex.com' ||
                       u.email?.toLowerCase() === 'guest@email.com') ? false : (u.isLocked || false),
            isActive: u.isActive !== undefined ? u.isActive : true, // Default to true for existing users
            lastLogin: u.lastLogin,
            created_at: u.created_at
          }
          console.log(`👤 DEBUG: User ${u.email} - Role: ${u.role}, isActive: ${mapped.isActive} (original: ${u.isActive})`)
          return mapped
        })

        setUsers(mappedUsers)
        console.log('✅ DEBUG: Set users state with', mappedUsers.length, 'users')
        console.log('✅ DEBUG: User roles in state:', mappedUsers.map(u => `${u.email}: ${u.role}`))
      }
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }

  const loadFirstUser = async () => {
    try {
      const response = await userManagementService.getFirstRegisteredUser()
      if (response.status === 'success' && response.data) {
        setFirstUserId(response.data.id)
        console.log('🛡️ First registered user ID:', response.data.id, response.data.email)
      }
    } catch (error) {
      console.error('Failed to load first registered user:', error)
    }
  }

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      showToast('Please fill in all fields', 'warning')
      return
    }

    setIsLoading(true)
    try {
      // Create user using the same method as programmatic creation
      const userData = {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role as any,
        mfa_enabled: false,
        isActive: false, // New profiles are disabled by default until enabled by super user
        settings: {}
      }

      const credentials = {
        email: newUser.email,
        password: newUser.password,
        tempPassword: false
      }

      const response = await userManagementService.createSystemUser(userData, credentials)

      if (response.status === 'success') {
        showToast(`User ${newUser.email} created successfully! Account is disabled by default - enable it when ready.`, 'success')
        setShowAddUser(false)
        setNewUser({ name: '', email: '', password: '', role: 'user' })
        await loadUsers()
      } else {
        showToast(`Failed to create user: ${response.error}`, 'error')
      }
    } catch (error: any) {
      showToast(`Error creating user: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async (userId: string, email: string) => {
    if (!newPassword) {
      showToast('Please enter a new password', 'warning')
      return
    }

    setIsLoading(true)
    try {
      // Use the PasswordDebugger method that we know works
      await PasswordDebugger.setUserPassword(userId, email, newPassword)
      showToast(`Password changed successfully for ${email}`, 'success')
      setShowChangePassword(null)
      setNewPassword('')
    } catch (error: any) {
      showToast(`Failed to change password: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string, email: string) => {
    setIsLoading(true)
    try {
      const response = await userManagementService.deleteSystemUser(userId)
      if (response.status === 'success') {
        showToast(`User ${email} deleted successfully`, 'success')
        await loadUsers()
      } else {
        showToast(`Failed to delete user: ${response.error}`, 'error')
      }
    } catch (error: any) {
      showToast(`Error deleting user: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
      setConfirmDelete(null)
    }
  }

  const handleUnlockUser = async (userId: string, email: string) => {
    setIsLoading(true)
    try {
      await userManagementService.clearAccountLockout(userId)
      showToast(`Account ${email} unlocked successfully`, 'success')
      await loadUsers()
    } catch (error: any) {
      showToast(`Failed to unlock account: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisableUser = async (userId: string, email: string) => {
    // Prevent disabling super users and demo users
    if (email.toLowerCase() === 'elmfarrell@yahoo.com' ||
        email.toLowerCase() === 'pierre@phaetonai.com' ||
        email.toLowerCase() === 'demo@medex.com' ||
        email.toLowerCase() === 'guest@email.com') {
      showToast('Cannot disable super users or demo accounts', 'warning')
      return
    }

    setIsLoading(true)
    try {
      await userManagementService.disableUser(userId, 'Disabled by super user')
      showToast(`Account ${email} disabled successfully`, 'success')
      await loadUsers()
    } catch (error: any) {
      showToast(`Failed to disable account: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
      setConfirmDisable(null)
    }
  }

  const handleEnableUser = async (userId: string, email: string) => {
    setIsLoading(true)
    try {
      await userManagementService.enableUser(userId)
      showToast(`Account ${email} enabled successfully`, 'success')
      await loadUsers()
    } catch (error: any) {
      showToast(`Failed to enable account: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangeRole = async (userId: string, email: string, currentRole: string, newRole: 'user' | 'super_user') => {
    setIsLoading(true)
    try {
      console.log(`🔄 Changing role for ${email} from ${currentRole} to ${newRole}`)
      const response = await userManagementService.updateUserRole(userId, newRole)
      console.log('🔄 Role update response:', response)

      if (response.status === 'success') {
        showToast(`Role changed successfully for ${email}`, 'success')
        console.log(`✅ Role changed successfully, updating UI state...`)

        // Update the user in the local state immediately for instant UI feedback
        setUsers(prevUsers => {
          const updatedUsers = prevUsers.map(u =>
            u.id === userId
              ? { ...u, role: newRole }
              : u
          )
          console.log('✅ Updated users state:', updatedUsers.map(u => `${u.email}: ${u.role}`))
          return updatedUsers
        })

        // Also reload from the service to ensure consistency
        console.log('🔄 Reloading users from service...')
        await loadUsers()
      } else {
        console.error('❌ Role change failed:', response.error)
        showToast(response.error || 'Failed to change role', 'error')
      }
    } catch (error: any) {
      console.error('❌ Role change error:', error)
      showToast(`Error changing role: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
      setConfirmRoleChange(null)
    }
  }

  const pendingUsers = users.filter(u => !u.isActive)
  const activeUsers = users.filter(u => u.isActive)

  console.log('📊 DEBUG: Total users:', users.length)
  console.log('📊 DEBUG: Pending users:', pendingUsers.length, pendingUsers.map(u => u.email))
  console.log('📊 DEBUG: Active users:', activeUsers.length, activeUsers.map(u => u.email))

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">User Management</h3>
          <button
            onClick={() => setShowAddUser(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 flex items-center gap-2 transition-colors"
            title="Add New User: Create a new user account for the system"
            disabled={isLoading}
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>

      {/* Pending Approvals Section */}
      {pendingUsers.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h4 className="font-semibold text-amber-900 dark:text-amber-100">
              Pending Approvals ({pendingUsers.length})
            </h4>
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
            The following users are awaiting activation. Click "Approve" to activate their accounts.
          </p>
          <div className="space-y-2">
            {pendingUsers.map(user => (
              <div key={user.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{user.email}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Role: <span className="font-medium">
                      {user.role === 'super_user' ? 'Super User' :
                       user.role === 'user' ? 'User' :
                       user.role === 'staff' ? 'Staff' :
                       user.role === 'admin' ? 'Admin' :
                       user.role === 'healthcare_provider' ? 'Healthcare Provider' :
                       user.role.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEnableUser(user.id, user.email)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 flex items-center gap-1 text-sm transition-colors"
                    title="Approve User: Activate this account and grant access to the system"
                    disabled={isLoading}
                  >
                    <UserCheck className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ userId: user.id, email: user.email })}
                    className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 flex items-center gap-1 text-sm transition-colors"
                    title="Reject User: Delete this pending registration request"
                    disabled={isLoading}
                  >
                    <UserX className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add User Form */}
      {showAddUser && (
        <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border border-gray-200 dark:border-gray-700 max-w-4xl">
          <h4 className="font-medium mb-4 text-lg">Add New User</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Name"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
            <input
              type="email"
              placeholder="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
            <input
              type="password"
              placeholder="Password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            >
              <option value="user">User</option>
              <option value="super_user">Super User</option>
            </select>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleAddUser}
              className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
              disabled={isLoading}
            >
              Create User
            </button>
            <button
              onClick={() => {
                setShowAddUser(false)
                setNewUser({ name: '', email: '', password: '', role: 'user' })
              }}
              className="px-6 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-700 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active Users List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
            Active Users ({activeUsers.length})
          </h4>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Email</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Role</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Last Login</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeUsers.map((user) => (
              <React.Fragment key={user.id}>
                <tr className="border-b hover:bg-gray-50 dark:bg-gray-700">
                  <td className="px-4 py-3 text-sm">{user.name}</td>
                  <td className="px-4 py-3 text-sm">{user.email}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        user.role === 'super_user' ? 'bg-purple-100 text-purple-700' :
                        user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                        user.role === 'healthcare_provider' ? 'bg-green-100 text-green-700' :
                        user.role === 'user' ? 'bg-gray-100 text-gray-700' :
                        user.role === 'staff' ? 'bg-gray-100 text-gray-700' :
                        'bg-gray-100 text-gray-700 dark:text-gray-300'
                      }`}>
                        {user.role === 'super_user' ? 'Super User' :
                         user.role === 'user' ? 'User' :
                         user.role === 'staff' ? 'Staff' :
                         user.role === 'admin' ? 'Admin' :
                         user.role === 'healthcare_provider' ? 'Healthcare Provider' :
                         user.role.replace('_', ' ')}
                      </span>
                      {user.id === firstUserId && (
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 border border-blue-300 flex items-center gap-1" title="First registered user - role cannot be changed">
                          <Lock className="w-3 h-3" />
                          Protected
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    <span className={user.lastLogin ? "" : "text-gray-400"}>
                      {formatLastLogin(user.lastLogin)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {user.isLocked ? (
                      <span className="text-red-600 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Locked
                      </span>
                    ) : (
                      <span className="text-green-600">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <div className="flex justify-end gap-2">
                      {/* Role Change Button - only show if not the first user */}
                      {user.id !== firstUserId && (
                        <button
                          onClick={() => {
                            const newRole = user.role === 'super_user' ? 'user' : 'super_user'
                            setConfirmRoleChange({
                              userId: user.id,
                              email: user.email,
                              currentRole: user.role,
                              newRole
                            })
                          }}
                          className={`p-1 rounded transition-colors ${
                            user.role === 'super_user'
                              ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                              : 'text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                          }`}
                          title={user.role === 'super_user' ? 'Change Role: Demote to User' : 'Change Role: Promote to Super User'}
                          disabled={isLoading}
                        >
                          {user.role === 'super_user' ? (
                            <Shield className="w-4 h-4" />
                          ) : (
                            <ShieldCheck className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => setShowChangePassword(user.id)}
                        className="p-1 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                        title="Change Password: Set a new password for this user"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleUnlockUser(user.id, user.email)}
                        className="p-1 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                        title="Unlock Account: Clear all failed login attempts and unlock this account"
                        disabled={isLoading}
                      >
                        <Unlock className="w-4 h-4" />
                      </button>
                      {user.isLocked ? (
                        <button
                          onClick={() => handleEnableUser(user.id, user.email)}
                          className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                          title="Enable Account: Activate this user account"
                          disabled={isLoading}
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      ) : (
                        // Only show disable button for non-super users and non-demo users
                        !(user.email.toLowerCase() === 'elmfarrell@yahoo.com' ||
                          user.email.toLowerCase() === 'pierre@phaetonai.com' ||
                          user.email.toLowerCase() === 'demo@medex.com' ||
                          user.email.toLowerCase() === 'guest@email.com') && (
                          <button
                            onClick={() => setConfirmDisable({ userId: user.id, email: user.email })}
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Disable Account: Prevent this user from logging in"
                            disabled={isLoading}
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        )
                      )}
                      <button
                        onClick={() => setConfirmDelete({ userId: user.id, email: user.email })}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Delete User: Permanently remove this user from the system"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                {showChangePassword === user.id && (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 bg-purple-50">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">New Password:</span>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="px-3 py-1 border rounded flex-1 max-w-xs"
                          placeholder="Enter new password"
                        />
                        <button
                          onClick={() => handleChangePassword(user.id, user.email)}
                          className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                          disabled={isLoading}
                        >
                          Set Password
                        </button>
                        <button
                          onClick={() => {
                            setShowChangePassword(null)
                            setNewPassword('')
                          }}
                          className="px-3 py-1 bg-gray-50 dark:bg-gray-7000 text-white rounded text-sm hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {activeUsers.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No active users found
          </div>
        )}
      </div>
    </div>

    {/* Delete Confirmation Modal */}
    {confirmDelete && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Confirm Delete
          </h3>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Are you sure you want to delete <strong>{confirmDelete.email}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setConfirmDelete(null)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={() => handleDeleteUser(confirmDelete.userId, confirmDelete.email)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              disabled={isLoading}
            >
              Delete User
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Disable Confirmation Modal */}
    {confirmDisable && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Confirm Disable
          </h3>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Are you sure you want to disable <strong>{confirmDisable.email}</strong>?
            They will not be able to log in until you enable their account again.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setConfirmDisable(null)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={() => handleDisableUser(confirmDisable.userId, confirmDisable.email)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              disabled={isLoading}
            >
              Disable Account
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Role Change Confirmation Modal */}
    {confirmRoleChange && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
            {confirmRoleChange.newRole === 'super_user' ? (
              <>
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                Promote to Super User
              </>
            ) : (
              <>
                <Shield className="w-5 h-5 text-blue-600" />
                Demote to User
              </>
            )}
          </h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Are you sure you want to change the role of <strong>{confirmRoleChange.email}</strong> from{' '}
            <strong className="text-blue-600">
              {confirmRoleChange.currentRole === 'super_user' ? 'Super User' : 'User'}
            </strong> to{' '}
            <strong className="text-purple-600">
              {confirmRoleChange.newRole === 'super_user' ? 'Super User' : 'User'}
            </strong>?
          </p>
          {confirmRoleChange.newRole === 'super_user' && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-3 mb-4">
              <p className="text-sm text-purple-800 dark:text-purple-200">
                <strong>Super Users</strong> have full administrative access including:
              </p>
              <ul className="text-xs text-purple-700 dark:text-purple-300 mt-2 space-y-1 ml-4 list-disc">
                <li>User management</li>
                <li>System configuration</li>
                <li>Audit log access</li>
                <li>Company branding control</li>
              </ul>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setConfirmRoleChange(null)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={() => handleChangeRole(
                confirmRoleChange.userId,
                confirmRoleChange.email,
                confirmRoleChange.currentRole,
                confirmRoleChange.newRole
              )}
              className={`px-4 py-2 text-white rounded ${
                confirmRoleChange.newRole === 'super_user'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              disabled={isLoading}
            >
              {confirmRoleChange.newRole === 'super_user' ? 'Promote to Super User' : 'Demote to User'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  )
}