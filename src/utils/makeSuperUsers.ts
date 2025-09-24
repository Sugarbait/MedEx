/**
 * Utility to update specified users to super_user role
 */

import { userManagementService } from '@/services/userManagementService'
import { auditLogger } from '@/services/auditLogger'

const SUPER_USER_EMAILS = [
  'elmfarrell@yahoo.com',
  'pierre@phaetonai.com'
]

export async function makeSuperUsers() {
  try {
    console.log('🔄 Updating specified users to super_user role...')
    console.log('👥 Target users:', SUPER_USER_EMAILS)

    // Load all system users
    const response = await userManagementService.loadSystemUsers()

    if (response.status !== 'success' || !response.data) {
      console.error('❌ Failed to load system users:', response.error)
      return false
    }

    const users = response.data
    let updatedCount = 0
    let needsSave = false

    // Check each target user
    for (const targetEmail of SUPER_USER_EMAILS) {
      const userIndex = users.findIndex(user =>
        user.email?.toLowerCase() === targetEmail.toLowerCase()
      )

      if (userIndex === -1) {
        console.warn(`⚠️ User ${targetEmail} not found in system users`)

        // Try to create the user if it's Pierre (we have a utility for that)
        if (targetEmail === 'pierre@phaetonai.com') {
          try {
            const { createPierreUser } = await import('./createPierreUser')
            const created = await createPierreUser()

            if (created) {
              // Reload users and try again
              const newResponse = await userManagementService.loadSystemUsers()
              if (newResponse.status === 'success' && newResponse.data) {
                const newUserIndex = newResponse.data.findIndex(u =>
                  u.email?.toLowerCase() === targetEmail.toLowerCase()
                )
                if (newUserIndex >= 0) {
                  newResponse.data[newUserIndex].role = 'super_user'
                  const saveResponse = await userManagementService.saveSystemUsers(newResponse.data)

                  if (saveResponse.status === 'success') {
                    console.log(`✅ Created and promoted ${targetEmail} to super_user`)
                    updatedCount++

                    // Log the role change
                    await auditLogger.logSecurityEvent(
                      'USER_ROLE_CHANGE',
                      'users',
                      true,
                      {
                        userId: newResponse.data[newUserIndex].id,
                        email: targetEmail,
                        oldRole: 'admin',
                        newRole: 'super_user',
                        changedBy: 'system_utility'
                      }
                    )
                  }
                }
              }
            }
          } catch (error) {
            console.warn(`Failed to create Pierre user: ${error}`)
          }
        }
        continue
      }

      const user = users[userIndex]
      const oldRole = user.role

      console.log(`📋 Found user: ${user.email} (current role: ${oldRole})`)

      if (user.role === 'super_user') {
        console.log(`✅ ${user.email} is already a super_user!`)
        continue
      }

      // Update role to super_user
      users[userIndex].role = 'super_user'
      needsSave = true
      updatedCount++

      console.log(`🔄 Promoting ${user.email} from ${oldRole} to super_user`)

      // Log the role change for audit
      await auditLogger.logSecurityEvent(
        'USER_ROLE_CHANGE',
        'users',
        true,
        {
          userId: user.id,
          email: user.email,
          oldRole: oldRole,
          newRole: 'super_user',
          changedBy: 'system_utility'
        }
      )

      // Update localStorage if this user is currently logged in
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        try {
          const currentUserObj = JSON.parse(currentUser)
          if (currentUserObj.email?.toLowerCase() === user.email?.toLowerCase()) {
            currentUserObj.role = 'super_user'
            localStorage.setItem('currentUser', JSON.stringify(currentUserObj))
            console.log(`📱 Updated ${user.email}'s role in current session`)

            // Dispatch event to update UI
            window.dispatchEvent(new Event('userDataUpdated'))
          }
        } catch (error) {
          console.warn('Failed to update currentUser:', error)
        }
      }
    }

    // Save all changes at once if any were made
    if (needsSave) {
      const saveResponse = await userManagementService.saveSystemUsers(users)

      if (saveResponse.status === 'success') {
        console.log(`✅ Successfully promoted ${updatedCount} users to super_user!`)
        return true
      } else {
        console.error('❌ Failed to save updated user roles:', saveResponse.error)
        return false
      }
    } else if (updatedCount === 0) {
      console.log('✅ All target users are already super_users!')
      return true
    } else {
      console.log(`✅ Processed ${updatedCount} users successfully!`)
      return true
    }

  } catch (error) {
    console.error('❌ Error updating users to super_user:', error)
    return false
  }
}

// Export to window for easy browser console access
if (typeof window !== 'undefined') {
  (window as any).makeSuperUsers = makeSuperUsers
}

// Also export as default for module imports
export default makeSuperUsers