/**
 * Simple verification that super user configuration is correct in the codebase
 * This can be run as a static check without needing browser environment
 */

import fs from 'fs'
import path from 'path'

interface ConfigCheck {
  file: string
  check: string
  status: 'pass' | 'fail' | 'warning'
  details: string
}

/**
 * Verify super user configuration in static files
 */
export function verifySuperUserConfiguration(): {
  success: boolean
  message: string
  checks: ConfigCheck[]
} {
  const checks: ConfigCheck[] = []
  let overallSuccess = true

  // Check 1: TypeScript interface includes super_user
  try {
    const typesPath = path.join(process.cwd(), 'src', 'types', 'index.ts')
    const typesContent = fs.readFileSync(typesPath, 'utf8')

    if (typesContent.includes("'super_user'")) {
      checks.push({
        file: 'src/types/index.ts',
        check: 'TypeScript interface includes super_user role',
        status: 'pass',
        details: 'User interface includes super_user in role union type'
      })
    } else {
      checks.push({
        file: 'src/types/index.ts',
        check: 'TypeScript interface includes super_user role',
        status: 'fail',
        details: 'User interface missing super_user in role union type'
      })
      overallSuccess = false
    }
  } catch (error) {
    checks.push({
      file: 'src/types/index.ts',
      check: 'TypeScript interface includes super_user role',
      status: 'fail',
      details: `Could not read types file: ${error}`
    })
    overallSuccess = false
  }

  // Check 2: UserProfileService includes super_user in interface
  try {
    const servicePath = path.join(process.cwd(), 'src', 'services', 'userProfileService.ts')
    const serviceContent = fs.readFileSync(servicePath, 'utf8')

    if (serviceContent.includes("'super_user'") &&
        serviceContent.includes('elmfarrell@yahoo.com') &&
        serviceContent.includes('pierre@phaetonai.com')) {
      checks.push({
        file: 'src/services/userProfileService.ts',
        check: 'UserProfileService configured for super users',
        status: 'pass',
        details: 'Service includes super_user role and target user emails'
      })
    } else {
      checks.push({
        file: 'src/services/userProfileService.ts',
        check: 'UserProfileService configured for super users',
        status: 'fail',
        details: 'Service missing super_user role or target user configuration'
      })
      overallSuccess = false
    }
  } catch (error) {
    checks.push({
      file: 'src/services/userProfileService.ts',
      check: 'UserProfileService configured for super users',
      status: 'fail',
      details: `Could not read service file: ${error}`
    })
    overallSuccess = false
  }

  // Check 3: Super user utility exists
  try {
    const utilityPath = path.join(process.cwd(), 'src', 'utils', 'ensureSuperUsers.ts')
    const utilityContent = fs.readFileSync(utilityPath, 'utf8')

    if (utilityContent.includes('elmfarrell@yahoo.com') &&
        utilityContent.includes('pierre@phaetonai.com') &&
        utilityContent.includes('super_user')) {
      checks.push({
        file: 'src/utils/ensureSuperUsers.ts',
        check: 'Super user management utility exists',
        status: 'pass',
        details: 'Utility includes both target users with super_user roles'
      })
    } else {
      checks.push({
        file: 'src/utils/ensureSuperUsers.ts',
        check: 'Super user management utility exists',
        status: 'fail',
        details: 'Utility missing or not properly configured'
      })
      overallSuccess = false
    }
  } catch (error) {
    checks.push({
      file: 'src/utils/ensureSuperUsers.ts',
      check: 'Super user management utility exists',
      status: 'fail',
      details: `Could not read utility file: ${error}`
    })
    overallSuccess = false
  }

  // Check 4: Test utilities exist and are imported
  try {
    const testPath = path.join(process.cwd(), 'src', 'utils', 'testSuperUserSetup.ts')
    const mainPath = path.join(process.cwd(), 'src', 'main.tsx')
    const testContent = fs.readFileSync(testPath, 'utf8')
    const mainContent = fs.readFileSync(mainPath, 'utf8')

    if (testContent.includes('testSuperUserSetup') &&
        mainContent.includes('testSuperUserSetup')) {
      checks.push({
        file: 'src/utils/testSuperUserSetup.ts + main.tsx',
        check: 'Test utilities configured',
        status: 'pass',
        details: 'Test utilities exist and are imported in development'
      })
    } else {
      checks.push({
        file: 'src/utils/testSuperUserSetup.ts + main.tsx',
        check: 'Test utilities configured',
        status: 'warning',
        details: 'Test utilities may not be properly imported'
      })
    }
  } catch (error) {
    checks.push({
      file: 'src/utils/testSuperUserSetup.ts + main.tsx',
      check: 'Test utilities configured',
      status: 'warning',
      details: `Could not verify test utilities: ${error}`
    })
  }

  const passCount = checks.filter(c => c.status === 'pass').length
  const failCount = checks.filter(c => c.status === 'fail').length
  const warnCount = checks.filter(c => c.status === 'warning').length

  const message = `Configuration check completed: ${passCount} passed, ${failCount} failed, ${warnCount} warnings`

  return {
    success: overallSuccess,
    message,
    checks
  }
}

/**
 * Print configuration check results
 */
export function printConfigurationCheck() {
  console.log('🔒 Super User Configuration Verification')
  console.log('=' .repeat(50))

  const result = verifySuperUserConfiguration()

  result.checks.forEach(check => {
    const statusEmoji = check.status === 'pass' ? '✅' :
                       check.status === 'fail' ? '❌' :
                       '⚠️'

    console.log(`${statusEmoji} ${check.check}`)
    console.log(`   File: ${check.file}`)
    console.log(`   Details: ${check.details}`)
    console.log()
  })

  console.log('=' .repeat(50))
  console.log(`📊 ${result.message}`)
  console.log(`🎯 Overall Status: ${result.success ? '✅ PASS' : '❌ FAIL'}`)

  return result
}

// Run check if called directly
if (require.main === module) {
  printConfigurationCheck()
}