import React, { useState, useEffect } from 'react'
import { UserPlus, Trash2, Key, Lock, Unlock, UserCheck, UserX, Clock } from 'lucide-react'
import { userManagementService } from '@/services/userManagementService'
import { userProfileService } from '@/services/userProfileService'
import { PasswordDebugger } from '@/utils/passwordDebug'

interface User {
  id: string
  name: string
  email: string
  role: string
  isLocked?: boolean
  isActive?: boolean
  lastLogin?: string
}

export const SimpleUserManager: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState<string | null>(null)

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
    role: 'healthcare_provider'
  })

  // Password change form
  const [newPassword, setNewPassword] = useState('')

  // Load users on mount
  useEffect(() => {
    loadUsers()
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
            lastLogin: u.lastLogin
          }
          console.log(`👤 DEBUG: User ${u.email} - isActive: ${mapped.isActive} (original: ${u.isActive})`)
          return mapped
        })

        setUsers(mappedUsers)
        console.log('✅ DEBUG: Set users state with', mappedUsers.length, 'users')
      }
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      alert('Please fill in all fields')
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
        is_locked: true, // New profiles are disabled by default until enabled by super user
        settings: {}
      }

      const credentials = {
        email: newUser.email,
        password: newUser.password,
        tempPassword: false
      }

      const response = await userManagementService.createSystemUser(userData, credentials)

      if (response.status === 'success') {
        alert(`User ${newUser.email} created successfully! Account is disabled by default - enable it when ready.`)
        setShowAddUser(false)
        setNewUser({ name: '', email: '', password: '', role: 'healthcare_provider' })
        await loadUsers()
      } else {
        alert(`Failed to create user: ${response.error}`)
      }
    } catch (error: any) {
      alert(`Error creating user: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async (userId: string, email: string) => {
    if (!newPassword) {
      alert('Please enter a new password')
      return
    }

    setIsLoading(true)
    try {
      // Use the PasswordDebugger method that we know works
      await PasswordDebugger.setUserPassword(userId, email, newPassword)
      alert(`Password changed successfully for ${email}`)
      setShowChangePassword(null)
      setNewPassword('')
    } catch (error: any) {
      alert(`Failed to change password: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete ${email}?`)) {
      return
    }

    setIsLoading(true)
    try {
      const response = await userManagementService.deleteSystemUser(userId)
      if (response.status === 'success') {
        alert(`User ${email} deleted successfully`)
        await loadUsers()
      } else {
        alert(`Failed to delete user: ${response.error}`)
      }
    } catch (error: any) {
      alert(`Error deleting user: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnlockUser = async (userId: string, email: string) => {
    setIsLoading(true)
    try {
      await userManagementService.clearAccountLockout(userId)
      alert(`Account ${email} unlocked successfully`)
      await loadUsers()
    } catch (error: any) {
      alert(`Failed to unlock account: ${error.message}`)
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
      alert('Cannot disable super users or demo accounts')
      return
    }

    if (!confirm(`Are you sure you want to disable ${email}? They will not be able to log in.`)) {
      return
    }

    setIsLoading(true)
    try {
      await userManagementService.disableUser(userId, 'Disabled by super user')
      alert(`Account ${email} disabled successfully`)
      await loadUsers()
    } catch (error: any) {
      alert(`Failed to disable account: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEnableUser = async (userId: string, email: string) => {
    setIsLoading(true)
    try {
      await userManagementService.enableUser(userId)
      alert(`Account ${email} enabled successfully`)
      await loadUsers()
    } catch (error: any) {
      alert(`Failed to enable account: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const pendingUsers = users.filter(u => !u.isActive)
  const activeUsers = users.filter(u => u.isActive)

  console.log('📊 DEBUG: Total users:', users.length)
  console.log('📊 DEBUG: Pending users:', pendingUsers.length, pendingUsers.map(u => u.email))
  console.log('📊 DEBUG: Active users:', activeUsers.length, activeUsers.map(u => u.email))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">User Management</h3>
        <button
          onClick={() => setShowAddUser(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
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
                    Role: <span className="font-medium">{user.role === 'user' ? 'User' : user.role.replace('_', ' ')}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEnableUser(user.id, user.email)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1 text-sm"
                    disabled={isLoading}
                  >
                    <UserCheck className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id, user.email)}
                    className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1 text-sm"
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
              <option value="healthcare_provider">Healthcare Provider</option>
              <option value="admin">Admin</option>
              <option value="super_user">Super User</option>
              <option value="staff">Staff</option>
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
                setNewUser({ name: '', email: '', password: '', role: 'healthcare_provider' })
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
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.role === 'super_user' ? 'bg-purple-100 text-purple-700' :
                      user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                      user.role === 'healthcare_provider' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700 dark:text-gray-300'
                    }`}>
                      {user.role === 'super_user' ? 'Super User' : user.role.replace('_', ' ')}
                    </span>
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
                      <button
                        onClick={() => setShowChangePassword(user.id)}
                        className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                        title="Change Password"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      {user.isLocked ? (
                        <button
                          onClick={() => handleEnableUser(user.id, user.email)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Enable Account"
                          disabled={isLoading}
                        >
                          <Unlock className="w-4 h-4" />
                        </button>
                      ) : (
                        // Only show disable button for non-super users and non-demo users
                        !(user.email.toLowerCase() === 'elmfarrell@yahoo.com' ||
                          user.email.toLowerCase() === 'pierre@phaetonai.com' ||
                          user.email.toLowerCase() === 'demo@medex.com' ||
                          user.email.toLowerCase() === 'guest@email.com') && (
                          <button
                            onClick={() => handleDisableUser(user.id, user.email)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Disable Account"
                            disabled={isLoading}
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        )
                      )}
                      <button
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete User"
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
  )
}