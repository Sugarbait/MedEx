/**
 * Utility to update Pierre's role to super_user
 */

import { userManagementService } from '@/services/userManagementService'
import { auditLogger } from '@/services/auditLogger'

export async function makePierreSuperUser() {
  try {
    console.log('🔄 Updating Pierre to super_user role...')

    // Load all system users
    const response = await userManagementService.loadSystemUsers()

    if (response.status !== 'success' || !response.data) {
      console.error('❌ Failed to load system users:', response.error)
      return false
    }

    // Find Pierre's user record
    const users = response.data
    const pierreIndex = users.findIndex(user =>
      user.email === 'pierre@phaetonai.com' ||
      user.email?.toLowerCase() === 'pierre@phaetonai.com'
    )

    if (pierreIndex === -1) {
      console.error('❌ Pierre user not found. Creating Pierre user first...')

      // Import and run createPierreUser
      const { createPierreUser } = await import('./createPierreUser')
      const created = await createPierreUser()

      if (!created) {
        console.error('❌ Failed to create Pierre user')
        return false
      }

      // Reload users and try again
      const newResponse = await userManagementService.loadSystemUsers()
      if (newResponse.status !== 'success' || !newResponse.data) {
        console.error('❌ Failed to reload users after creation')
        return false
      }

      const newUsers = newResponse.data
      const newPierreIndex = newUsers.findIndex(user =>
        user.email === 'pierre@phaetonai.com'
      )

      if (newPierreIndex === -1) {
        console.error('❌ Pierre user still not found after creation')
        return false
      }

      // Update the newly created user to super_user
      newUsers[newPierreIndex].role = 'super_user'

      const saveResponse = await userManagementService.saveSystemUsers(newUsers)
      if (saveResponse.status === 'success') {
        console.log('✅ Pierre created and promoted to super_user successfully!')

        // Log the role change
        await auditLogger.logSecurityEvent(
          'USER_ROLE_CHANGE',
          'users',
          true,
          {
            userId: newUsers[newPierreIndex].id,
            email: 'pierre@phaetonai.com',
            oldRole: 'admin',
            newRole: 'super_user',
            changedBy: 'system'
          }
        )

        return true
      } else {
        console.error('❌ Failed to save Pierre as super_user:', saveResponse.error)
        return false
      }
    }

    // Pierre exists, update role
    const pierreUser = users[pierreIndex]
    const oldRole = pierreUser.role

    console.log(`📋 Found Pierre user: ${pierreUser.email} (current role: ${oldRole})`)

    if (pierreUser.role === 'super_user') {
      console.log('✅ Pierre is already a super_user!')
      return true
    }

    // Update role to super_user
    users[pierreIndex].role = 'super_user'

    // Save the updated users list
    const saveResponse = await userManagementService.saveSystemUsers(users)

    if (saveResponse.status === 'success') {
      console.log('✅ Pierre successfully promoted to super_user!')

      // Log the role change for audit
      await auditLogger.logSecurityEvent(
        'USER_ROLE_CHANGE',
        'users',
        true,
        {
          userId: pierreUser.id,
          email: pierreUser.email,
          oldRole: oldRole,
          newRole: 'super_user',
          changedBy: 'system'
        }
      )

      // Update localStorage if Pierre is currently logged in
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        const user = JSON.parse(currentUser)
        if (user.email === 'pierre@phaetonai.com') {
          user.role = 'super_user'
          localStorage.setItem('currentUser', JSON.stringify(user))
          console.log('📱 Updated Pierre\'s role in current session')
        }
      }

      return true
    } else {
      console.error('❌ Failed to save updated user role:', saveResponse.error)
      return false
    }

  } catch (error) {
    console.error('❌ Error updating Pierre to super_user:', error)
    return false
  }
}

// Export to window for easy browser console access
if (typeof window !== 'undefined') {
  (window as any).makePierreSuperUser = makePierreSuperUser
}