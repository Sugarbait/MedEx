import React, { useState, useEffect } from 'react'
import { UserPlus, Trash2, Key, Lock, Unlock } from 'lucide-react'
import { userManagementService } from '@/services/userManagementService'
import { userProfileService } from '@/services/userProfileService'
import { PasswordDebugger } from '@/utils/passwordDebug'

interface User {
  id: string
  name: string
  email: string
  role: string
  isLocked?: boolean
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
      const response = await userManagementService.loadSystemUsers()
      if (response.status === 'success' && response.data) {
        setUsers(response.data.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          // Ensure demo/admin users are never shown as locked
          isLocked: (u.email?.toLowerCase() === 'elmfarrell@yahoo.com' ||
                     u.email?.toLowerCase() === 'pierre@phaetonai.com' ||
                     u.email?.toLowerCase() === 'demo@carexps.com' ||
                     u.email?.toLowerCase() === 'guest@email.com') ? false : (u.isLocked || false),
          lastLogin: u.lastLogin
        })))
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
        settings: {}
      }

      const credentials = {
        email: newUser.email,
        password: newUser.password,
        tempPassword: false
      }

      const response = await userManagementService.createSystemUser(userData, credentials)

      if (response.status === 'success') {
        alert(`User ${newUser.email} created successfully!`)
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

      {/* Add User Form */}
      {showAddUser && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="font-medium mb-3">Add New User</h4>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Name"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="px-3 py-2 border rounded"
            />
            <input
              type="email"
              placeholder="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="px-3 py-2 border rounded"
            />
            <input
              type="password"
              placeholder="Password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="px-3 py-2 border rounded"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="px-3 py-2 border rounded"
            >
              <option value="healthcare_provider">Healthcare Provider</option>
              <option value="admin">Admin</option>
              <option value="super_user">Super User</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleAddUser}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              disabled={isLoading}
            >
              Create User
            </button>
            <button
              onClick={() => {
                setShowAddUser(false)
                setNewUser({ name: '', email: '', password: '', role: 'healthcare_provider' })
              }}
              className="px-4 py-2 bg-gray-50 dark:bg-gray-7000 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
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
            {users.map((user) => (
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
                      {user.role.replace('_', ' ')}
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
                      {user.isLocked && (
                        <button
                          onClick={() => handleUnlockUser(user.id, user.email)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Unlock Account"
                        >
                          <Unlock className="w-4 h-4" />
                        </button>
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
        {users.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No users found
          </div>
        )}
      </div>
    </div>
  )
}