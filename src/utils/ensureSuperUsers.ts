/**
 * Utility to ensure elmfarrell@yahoo.com and pierre@phaetonai.com are configured as Super Users
 * with proper admin privileges and access levels
 */

import { userManagementService } from '@/services/userManagementService'
import { userProfileService, UserProfileData } from '@/services/userProfileService'
import { auditLogger } from '@/services/auditLogger'

export class SuperUserEnsurer {
  private static readonly SUPER_USERS = [
    {
      id: 'super-user-456',
      email: 'elmfarrell@yahoo.com',
      name: 'Dr. Farrell',
      role: 'super_user' as const,
      mfa_enabled: false,
      settings: {
        theme: 'dark',
        notifications: {
          email: true,
          sms: true,
          push: true,
          in_app: true,
          call_alerts: true,
          sms_alerts: true,
          security_alerts: true
        }
      }
    },
    {
      id: 'pierre-user-789',
      email: 'pierre@phaetonai.com',
      name: 'Pierre PhaetonAI',
      role: 'super_user' as const,
      mfa_enabled: false,
      settings: {
        theme: 'dark',
        notifications: {
          email: true,
          sms: true,
          push: true,
          in_app: true,
          call_alerts: true,
          sms_alerts: true,
          security_alerts: true
        }
      }
    }
  ]

  /**
   * Ensure both target users exist with super_user privileges
   */
  static async ensureSuperUsers(): Promise<{
    success: boolean
    message: string
    details: Array<{
      email: string
      status: 'updated' | 'created' | 'already_correct' | 'error'
      message: string
    }>
  }> {
    console.log('🔒 SuperUserEnsurer: Starting super user configuration...')

    const results = []
    let overallSuccess = true

    await auditLogger.logSecurityEvent('SUPER_USER_SETUP_START', 'users', true, {
      targetEmails: this.SUPER_USERS.map(u => u.email)
    })

    for (const superUserConfig of this.SUPER_USERS) {
      try {
        console.log(`🔍 Checking super user: ${superUserConfig.email}`)

        // Check if user exists
        const existingUserResponse = await userProfileService.getUserByEmail(superUserConfig.email)

        if (existingUserResponse.status === 'error') {
          throw new Error(`Failed to check existing user: ${existingUserResponse.error}`)
        }

        let result: { email: string; status: 'updated' | 'created' | 'already_correct' | 'error'; message: string }

        if (!existingUserResponse.data) {
          // User doesn't exist - create them
          console.log(`➕ Creating super user: ${superUserConfig.email}`)

          const createResponse = await userManagementService.createSystemUser(
            superUserConfig,
            {
              email: superUserConfig.email,
              password: superUserConfig.email === 'elmfarrell@yahoo.com' ? 'Super123!' : 'Pierre123!',
              tempPassword: false
            }
          )

          if (createResponse.status === 'error') {
            throw new Error(`Failed to create user: ${createResponse.error}`)
          }

          result = {
            email: superUserConfig.email,
            status: 'created',
            message: 'Super user created successfully with super_user role'
          }

        } else {
          // User exists - check and update role if needed
          const existingUser = existingUserResponse.data

          if (existingUser.role === 'super_user') {
            console.log(`✅ User ${superUserConfig.email} already has super_user role`)
            result = {
              email: superUserConfig.email,
              status: 'already_correct',
              message: 'User already has super_user role'
            }
          } else {
            console.log(`🔄 Updating ${superUserConfig.email} role from ${existingUser.role} to super_user`)

            // Update the user's role
            const updateResponse = await userProfileService.updateUserProfile(existingUser.id, {
              role: 'super_user',
              settings: {
                ...existingUser.settings,
                ...superUserConfig.settings
              }
            })

            if (updateResponse.status === 'error') {
              throw new Error(`Failed to update user role: ${updateResponse.error}`)
            }

            result = {
              email: superUserConfig.email,
              status: 'updated',
              message: `Role updated from ${existingUser.role} to super_user`
            }
          }
        }

        results.push(result)
        console.log(`✅ Super user ${superUserConfig.email}: ${result.message}`)

      } catch (error: any) {
        console.error(`❌ Failed to configure super user ${superUserConfig.email}:`, error)
        overallSuccess = false

        results.push({
          email: superUserConfig.email,
          status: 'error',
          message: `Error: ${error.message}`
        })
      }
    }

    // Log the final result
    const successCount = results.filter(r => r.status !== 'error').length
    const finalMessage = `Super user configuration completed: ${successCount}/${this.SUPER_USERS.length} users configured successfully`

    await auditLogger.logSecurityEvent('SUPER_USER_SETUP_COMPLETED', 'users', overallSuccess, {
      results,
      successCount,
      totalCount: this.SUPER_USERS.length
    })

    console.log(`🔒 SuperUserEnsurer: ${finalMessage}`)

    return {
      success: overallSuccess,
      message: finalMessage,
      details: results
    }
  }

  /**
   * Verify super user permissions and access levels
   */
  static async verifySuperUserAccess(): Promise<{
    success: boolean
    message: string
    details: Array<{
      email: string
      hasCorrectRole: boolean
      canAccessUserManagement: boolean
      canAccessAuditLogs: boolean
      canAccessBranding: boolean
      message: string
    }>
  }> {
    console.log('🔍 SuperUserEnsurer: Verifying super user access levels...')

    const results = []
    let overallSuccess = true

    for (const superUserConfig of this.SUPER_USERS) {
      try {
        const userResponse = await userProfileService.getUserByEmail(superUserConfig.email)

        if (userResponse.status === 'error' || !userResponse.data) {
          results.push({
            email: superUserConfig.email,
            hasCorrectRole: false,
            canAccessUserManagement: false,
            canAccessAuditLogs: false,
            canAccessBranding: false,
            message: 'User not found or error retrieving user'
          })
          overallSuccess = false
          continue
        }

        const user = userResponse.data
        const hasCorrectRole = user.role === 'super_user'

        // Super users should have access to:
        // 1. User Management (role === 'super_user')
        // 2. Audit Logs (role in ['super_user', 'compliance_officer', 'system_admin'])
        // 3. Branding settings (role === 'super_user')

        const canAccessUserManagement = hasCorrectRole
        const canAccessAuditLogs = hasCorrectRole
        const canAccessBranding = hasCorrectRole

        const allAccessGranted = canAccessUserManagement && canAccessAuditLogs && canAccessBranding

        results.push({
          email: superUserConfig.email,
          hasCorrectRole,
          canAccessUserManagement,
          canAccessAuditLogs,
          canAccessBranding,
          message: allAccessGranted
            ? 'All super user privileges verified'
            : `Missing privileges: ${[
                !hasCorrectRole && 'incorrect role',
                !canAccessUserManagement && 'user management',
                !canAccessAuditLogs && 'audit logs',
                !canAccessBranding && 'branding'
              ].filter(Boolean).join(', ')}`
        })

        if (!allAccessGranted) {
          overallSuccess = false
        }

        console.log(`🔍 ${superUserConfig.email}: Role=${user.role}, Access=${allAccessGranted ? '✅' : '❌'}`)

      } catch (error: any) {
        console.error(`❌ Failed to verify super user ${superUserConfig.email}:`, error)
        overallSuccess = false

        results.push({
          email: superUserConfig.email,
          hasCorrectRole: false,
          canAccessUserManagement: false,
          canAccessAuditLogs: false,
          canAccessBranding: false,
          message: `Verification error: ${error.message}`
        })
      }
    }

    const finalMessage = overallSuccess
      ? 'All super users have correct privileges'
      : 'Some super users are missing privileges'

    console.log(`🔍 SuperUserEnsurer: ${finalMessage}`)

    return {
      success: overallSuccess,
      message: finalMessage,
      details: results
    }
  }

  /**
   * Get current super user status (for debugging)
   */
  static async getSuperUserStatus(): Promise<Array<{
    email: string
    exists: boolean
    currentRole?: string
    id?: string
    name?: string
    mfa_enabled?: boolean
  }>> {
    console.log('🔍 SuperUserEnsurer: Getting current super user status...')

    const status = []

    for (const superUserConfig of this.SUPER_USERS) {
      try {
        const userResponse = await userProfileService.getUserByEmail(superUserConfig.email)

        if (userResponse.status === 'error' || !userResponse.data) {
          status.push({
            email: superUserConfig.email,
            exists: false
          })
        } else {
          const user = userResponse.data
          status.push({
            email: superUserConfig.email,
            exists: true,
            currentRole: user.role,
            id: user.id,
            name: user.name,
            mfa_enabled: user.mfa_enabled
          })
        }
      } catch (error) {
        console.error(`Error getting status for ${superUserConfig.email}:`, error)
        status.push({
          email: superUserConfig.email,
          exists: false
        })
      }
    }

    console.table(status)
    return status
  }

  /**
   * Clear any lockouts for super users (emergency access)
   */
  static async clearSuperUserLockouts(): Promise<{
    success: boolean
    message: string
    details: Array<{
      email: string
      cleared: boolean
      message: string
    }>
  }> {
    console.log('🔓 SuperUserEnsurer: Clearing super user lockouts...')

    const results = []
    let overallSuccess = true

    for (const superUserConfig of this.SUPER_USERS) {
      try {
        const userResponse = await userProfileService.getUserByEmail(superUserConfig.email)

        if (userResponse.status === 'error' || !userResponse.data) {
          results.push({
            email: superUserConfig.email,
            cleared: false,
            message: 'User not found'
          })
          continue
        }

        const clearResponse = await userManagementService.clearAccountLockout(userResponse.data.id)

        results.push({
          email: superUserConfig.email,
          cleared: clearResponse.status === 'success',
          message: clearResponse.status === 'success' ? 'Lockout cleared' : clearResponse.error || 'Failed to clear lockout'
        })

        if (clearResponse.status !== 'success') {
          overallSuccess = false
        }

      } catch (error: any) {
        console.error(`❌ Failed to clear lockout for ${superUserConfig.email}:`, error)
        overallSuccess = false

        results.push({
          email: superUserConfig.email,
          cleared: false,
          message: `Error: ${error.message}`
        })
      }
    }

    const finalMessage = overallSuccess
      ? 'All super user lockouts cleared'
      : 'Some super user lockouts could not be cleared'

    console.log(`🔓 SuperUserEnsurer: ${finalMessage}`)

    return {
      success: overallSuccess,
      message: finalMessage,
      details: results
    }
  }
}

export const superUserEnsurer = SuperUserEnsurer