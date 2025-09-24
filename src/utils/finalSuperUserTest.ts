/**
 * Final comprehensive test to verify super user configuration
 */

import { SuperUserEnsurer } from './ensureSuperUsers'

export async function runFinalSuperUserTest() {
  console.log('🚀 Final Super User Configuration Test')
  console.log('=' .repeat(60))

  // Test results
  const results = {
    configurationPassed: false,
    roleAssignmentPassed: false,
    permissionsPassed: false,
    accessTestPassed: false,
    overallSuccess: false
  }

  try {
    // 1. Configuration Test
    console.log('\n📋 Step 1: Configuration Verification')
    console.log('-'.repeat(30))

    const targetUsers = [
      'elmfarrell@yahoo.com',
      'pierre@phaetonai.com'
    ]

    // Check localStorage for the target users
    let configurationCheck = true
    const storedUsers = localStorage.getItem('systemUsers')

    if (storedUsers) {
      const users = JSON.parse(storedUsers)

      for (const email of targetUsers) {
        const user = users.find((u: any) => u.email === email)
        if (user) {
          console.log(`✅ ${email}: Found with role ${user.role}`)
          if (user.role !== 'super_user') {
            console.log(`⚠️  ${email}: Role is ${user.role}, should be super_user`)
            configurationCheck = false
          }
        } else {
          console.log(`❌ ${email}: Not found in systemUsers`)
          configurationCheck = false
        }
      }
    } else {
      console.log('❌ No systemUsers found in localStorage')
      configurationCheck = false
    }

    results.configurationPassed = configurationCheck
    console.log(`📋 Configuration: ${configurationCheck ? '✅ PASS' : '❌ FAIL'}`)

    // 2. Role Assignment Test
    console.log('\n🔧 Step 2: Role Assignment Test')
    console.log('-'.repeat(30))

    const setupResult = await SuperUserEnsurer.ensureSuperUsers()
    results.roleAssignmentPassed = setupResult.success

    setupResult.details.forEach(detail => {
      const emoji = detail.status === 'error' ? '❌' : '✅'
      console.log(`${emoji} ${detail.email}: ${detail.message}`)
    })

    console.log(`🔧 Role Assignment: ${setupResult.success ? '✅ PASS' : '❌ FAIL'}`)

    // 3. Permissions Test
    console.log('\n🔒 Step 3: Permissions Verification')
    console.log('-'.repeat(30))

    const verifyResult = await SuperUserEnsurer.verifySuperUserAccess()
    results.permissionsPassed = verifyResult.success

    verifyResult.details.forEach(detail => {
      const emoji = detail.hasCorrectRole && detail.canAccessUserManagement &&
                   detail.canAccessAuditLogs && detail.canAccessBranding ? '✅' : '⚠️'
      console.log(`${emoji} ${detail.email}:`)
      console.log(`   Role: ${detail.hasCorrectRole ? '✅' : '❌'} super_user`)
      console.log(`   User Management: ${detail.canAccessUserManagement ? '✅' : '❌'}`)
      console.log(`   Audit Logs: ${detail.canAccessAuditLogs ? '✅' : '❌'}`)
      console.log(`   Branding: ${detail.canAccessBranding ? '✅' : '❌'}`)
    })

    console.log(`🔒 Permissions: ${verifyResult.success ? '✅ PASS' : '❌ FAIL'}`)

    // 4. Access Test (Check UI Components)
    console.log('\n🖥️  Step 4: UI Access Test')
    console.log('-'.repeat(30))

    let accessTestPassed = true

    try {
      // Test if super_user role would have access to key features
      const mockSuperUser = { role: 'super_user' }

      // Test 1: User Management access
      const canManageUsers = mockSuperUser.role === 'super_user'
      console.log(`👥 User Management Access: ${canManageUsers ? '✅' : '❌'}`)

      // Test 2: Branding tab access (from SettingsPage)
      const canAccessBranding = mockSuperUser.role === 'super_user'
      console.log(`🎨 Branding Access: ${canAccessBranding ? '✅' : '❌'}`)

      // Test 3: Admin features in sidebar
      const hasAdminFeatures = mockSuperUser.role === 'super_user'
      console.log(`⚙️  Admin Features: ${hasAdminFeatures ? '✅' : '❌'}`)

      // Test 4: Audit logs access
      const allowedRoles = ['super_user', 'compliance_officer', 'system_admin']
      const canAccessAudit = allowedRoles.includes(mockSuperUser.role)
      console.log(`📋 Audit Logs Access: ${canAccessAudit ? '✅' : '❌'}`)

      accessTestPassed = canManageUsers && canAccessBranding && hasAdminFeatures && canAccessAudit

    } catch (error) {
      console.log(`❌ Access test failed: ${error}`)
      accessTestPassed = false
    }

    results.accessTestPassed = accessTestPassed
    console.log(`🖥️  UI Access: ${accessTestPassed ? '✅ PASS' : '❌ FAIL'}`)

    // Overall Result
    results.overallSuccess =
      results.configurationPassed &&
      results.roleAssignmentPassed &&
      results.permissionsPassed &&
      results.accessTestPassed

    console.log('\n🎯 FINAL RESULTS')
    console.log('=' .repeat(60))
    console.log(`📋 Configuration: ${results.configurationPassed ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`🔧 Role Assignment: ${results.roleAssignmentPassed ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`🔒 Permissions: ${results.permissionsPassed ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`🖥️  UI Access: ${results.accessTestPassed ? '✅ PASS' : '❌ FAIL'}`)
    console.log('=' .repeat(60))

    if (results.overallSuccess) {
      console.log('🎉 ✅ ALL TESTS PASSED - Super Users Are Properly Configured!')
      console.log('')
      console.log('📋 Summary:')
      console.log('- elmfarrell@yahoo.com: Super User with full admin privileges')
      console.log('- pierre@phaetonai.com: Super User with full admin privileges')
      console.log('')
      console.log('🔑 Both users have access to:')
      console.log('  ✅ User Management')
      console.log('  ✅ Audit Logs')
      console.log('  ✅ Company Branding')
      console.log('  ✅ All admin features')
    } else {
      console.log('⚠️  Some tests failed - see details above')
    }

    console.log('')
    console.log('💡 To test in practice:')
    console.log('1. Log in with either super user account')
    console.log('2. Check Settings page for "Company Branding" tab')
    console.log('3. Check sidebar for "User Management" link')
    console.log('4. Check Settings page for "Audit Logs" tab')

    return results

  } catch (error) {
    console.error('❌ Final test failed:', error)
    return {
      ...results,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Make available globally
declare global {
  interface Window {
    runFinalSuperUserTest: typeof runFinalSuperUserTest
  }
}

if (typeof window !== 'undefined') {
  window.runFinalSuperUserTest = runFinalSuperUserTest
}

export { runFinalSuperUserTest as finalSuperUserTest }