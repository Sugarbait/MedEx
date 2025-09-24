/**
 * Test utility for Super User setup - can be run from browser console
 * Usage: await testSuperUserSetup()
 */

import { SuperUserEnsurer } from './ensureSuperUsers'

/**
 * Main test function for super user setup
 */
export async function testSuperUserSetup() {
  console.log('🚀 Starting Super User Setup Test...')

  try {
    // Step 1: Get current status
    console.log('\n📊 Step 1: Getting current super user status...')
    const currentStatus = await SuperUserEnsurer.getSuperUserStatus()
    console.log('Current status:', currentStatus)

    // Step 2: Clear any lockouts first
    console.log('\n🔓 Step 2: Clearing any existing lockouts...')
    const lockoutResult = await SuperUserEnsurer.clearSuperUserLockouts()
    console.log('Lockout clearing result:', lockoutResult)

    // Step 3: Ensure super users are configured
    console.log('\n⚙️ Step 3: Ensuring super users are properly configured...')
    const setupResult = await SuperUserEnsurer.ensureSuperUsers()
    console.log('Setup result:', setupResult)

    // Step 4: Verify access levels
    console.log('\n🔍 Step 4: Verifying super user access levels...')
    const verifyResult = await SuperUserEnsurer.verifySuperUserAccess()
    console.log('Verification result:', verifyResult)

    // Step 5: Final status check
    console.log('\n📈 Step 5: Final status check...')
    const finalStatus = await SuperUserEnsurer.getSuperUserStatus()
    console.log('Final status:', finalStatus)

    // Summary
    console.log('\n📋 SUMMARY:')
    console.log('='.repeat(50))

    setupResult.details.forEach(detail => {
      const statusEmoji = detail.status === 'error' ? '❌' :
                         detail.status === 'created' ? '✅' :
                         detail.status === 'updated' ? '🔄' :
                         '✅'
      console.log(`${statusEmoji} ${detail.email}: ${detail.message}`)
    })

    verifyResult.details.forEach(detail => {
      const accessEmoji = detail.hasCorrectRole &&
                         detail.canAccessUserManagement &&
                         detail.canAccessAuditLogs &&
                         detail.canAccessBranding ? '🔒' : '⚠️'
      console.log(`${accessEmoji} ${detail.email} Access: ${detail.message}`)
    })

    console.log('='.repeat(50))
    console.log(`✨ Super User Setup Test ${setupResult.success && verifyResult.success ? 'COMPLETED' : 'COMPLETED WITH ISSUES'}`)

    return {
      success: setupResult.success && verifyResult.success,
      setup: setupResult,
      verification: verifyResult,
      currentStatus,
      finalStatus
    }

  } catch (error) {
    console.error('❌ Super User Setup Test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Quick status check function
 */
export async function quickSuperUserStatus() {
  console.log('🔍 Quick Super User Status Check...')
  const status = await SuperUserEnsurer.getSuperUserStatus()

  console.log('\n📊 Super User Status:')
  console.log('='.repeat(40))

  status.forEach(user => {
    const roleEmoji = user.currentRole === 'super_user' ? '👑' :
                     user.currentRole === 'admin' ? '🔧' : '👤'
    const statusEmoji = user.exists ? '✅' : '❌'

    console.log(`${statusEmoji} ${user.email}`)
    if (user.exists) {
      console.log(`   ${roleEmoji} Role: ${user.currentRole}`)
      console.log(`   👤 Name: ${user.name}`)
      console.log(`   🔐 MFA: ${user.mfa_enabled ? 'Enabled' : 'Disabled'}`)
      console.log(`   🆔 ID: ${user.id}`)
    } else {
      console.log('   ❌ User does not exist')
    }
    console.log()
  })

  return status
}

/**
 * Make functions available globally for browser console
 */
declare global {
  interface Window {
    testSuperUserSetup: typeof testSuperUserSetup
    quickSuperUserStatus: typeof quickSuperUserStatus
  }
}

// Attach to window for browser console access
if (typeof window !== 'undefined') {
  window.testSuperUserSetup = testSuperUserSetup
  window.quickSuperUserStatus = quickSuperUserStatus
}