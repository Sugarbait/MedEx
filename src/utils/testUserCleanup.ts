/**
 * Test User Cleanup Utility
 *
 * Safely identifies and removes test/fake user profiles from the system
 * while preserving legitimate user accounts.
 *
 * SAFETY FEATURES:
 * - Dry run mode to preview changes
 * - Pattern-based identification of test users
 * - Confirmation before deletion
 * - Backup creation before cleanup
 * - Rollback capability
 */

import { userManagementService, SystemUserWithCredentials } from '@/services/userManagementService'
import { auditLogger } from '@/services/auditLogger'

interface TestUserPattern {
  type: 'email' | 'name' | 'id'
  pattern: string | RegExp
  description: string
  safe: boolean // true means it's safe to delete
}

interface CleanupResult {
  identified: SystemUserWithCredentials[]
  deleted: SystemUserWithCredentials[]
  preserved: SystemUserWithCredentials[]
  errors: string[]
  backup?: string
}

interface CleanupOptions {
  dryRun?: boolean
  createBackup?: boolean
  confirmEach?: boolean
  preservePatterns?: string[]
}

export class TestUserCleanup {

  // Patterns to identify test users (VERY CONSERVATIVE - only obvious test accounts)
  private static readonly TEST_PATTERNS: TestUserPattern[] = [
    // Email patterns - ONLY obvious test emails
    { type: 'email', pattern: /^test@/i, description: 'Test email addresses (test@...)', safe: true },
    { type: 'email', pattern: /^testing@/i, description: 'Testing email addresses (testing@...)', safe: true },
    { type: 'email', pattern: /^fake@/i, description: 'Fake email addresses (fake@...)', safe: true },
    { type: 'email', pattern: /^dummy@/i, description: 'Dummy email addresses (dummy@...)', safe: true },
    { type: 'email', pattern: /^example@/i, description: 'Example email addresses (example@...)', safe: true },
    { type: 'email', pattern: /test.*test/i, description: 'Email containing test...test', safe: true },
    { type: 'email', pattern: /@test\./i, description: 'Email with test domain (@test.)', safe: true },
    { type: 'email', pattern: /@example\./i, description: 'Email with example domain (@example.)', safe: true },

    // Name patterns - ONLY obvious test names
    { type: 'name', pattern: /^test\s/i, description: 'Names starting with "Test "', safe: true },
    { type: 'name', pattern: /\stest$/i, description: 'Names ending with " Test"', safe: true },
    { type: 'name', pattern: /^john\s+doe$/i, description: 'John Doe placeholder names', safe: true },
    { type: 'name', pattern: /^jane\s+doe$/i, description: 'Jane Doe placeholder names', safe: true },
    { type: 'name', pattern: /^test\s+user$/i, description: 'Test User names', safe: true },
    { type: 'name', pattern: /^fake\s+user$/i, description: 'Fake User names', safe: true },
    { type: 'name', pattern: /^dummy\s+user$/i, description: 'Dummy User names', safe: true },
    { type: 'name', pattern: /contactus/i, description: 'Contact Us form names', safe: true },

    // PROTECTED PATTERNS - Never delete these
    { type: 'email', pattern: 'elmfarrell@yahoo.com', description: 'Dr. Farrell (PROTECTED)', safe: false },
    { type: 'email', pattern: 'pierre@phaetonai.com', description: 'Pierre (PROTECTED)', safe: false },
    { type: 'email', pattern: 'demo@carexps.com', description: 'Demo user (PROTECTED)', safe: false },
    { type: 'email', pattern: 'guest@email.com', description: 'Guest user (PROTECTED)', safe: false },
    { type: 'email', pattern: /@carexps\.com$/i, description: 'CareXPS domain emails (PROTECTED)', safe: false }
  ]

  /**
   * Analyze current users and identify test profiles
   */
  static async analyzeUsers(): Promise<{
    total: number
    testUsers: SystemUserWithCredentials[]
    legitimateUsers: SystemUserWithCredentials[]
    protectedUsers: SystemUserWithCredentials[]
    patterns: { pattern: string; matches: SystemUserWithCredentials[] }[]
  }> {
    try {
      console.log('🔍 TestUserCleanup: Starting user analysis...')

      // Load all users
      const usersResponse = await userManagementService.loadSystemUsers()
      if (usersResponse.status === 'error') {
        throw new Error(`Failed to load users: ${usersResponse.error}`)
      }

      const allUsers = usersResponse.data || []
      console.log(`📊 Found ${allUsers.length} total users`)

      const testUsers: SystemUserWithCredentials[] = []
      const legitimateUsers: SystemUserWithCredentials[] = []
      const protectedUsers: SystemUserWithCredentials[] = []
      const patternMatches: { pattern: string; matches: SystemUserWithCredentials[] }[] = []

      // Analyze each user against patterns
      for (const user of allUsers) {
        let isTest = false
        let isProtected = false
        const userPatterns: string[] = []

        // Check against each pattern
        for (const pattern of this.TEST_PATTERNS) {
          let matches = false

          switch (pattern.type) {
            case 'email':
              if (pattern.pattern instanceof RegExp) {
                matches = pattern.pattern.test(user.email)
              } else {
                matches = user.email.toLowerCase() === pattern.pattern.toLowerCase()
              }
              break
            case 'name':
              if (pattern.pattern instanceof RegExp) {
                matches = pattern.pattern.test(user.name)
              } else {
                matches = user.name.toLowerCase() === pattern.pattern.toLowerCase()
              }
              break
            case 'id':
              if (pattern.pattern instanceof RegExp) {
                matches = pattern.pattern.test(user.id)
              } else {
                matches = user.id === pattern.pattern
              }
              break
          }

          if (matches) {
            userPatterns.push(pattern.description)

            if (!pattern.safe) {
              isProtected = true
            } else {
              isTest = true
            }

            // Track pattern matches
            let patternMatch = patternMatches.find(p => p.pattern === pattern.description)
            if (!patternMatch) {
              patternMatch = { pattern: pattern.description, matches: [] }
              patternMatches.push(patternMatch)
            }
            patternMatch.matches.push(user)
          }
        }

        // Categorize user
        if (isProtected) {
          protectedUsers.push(user)
          console.log(`🛡️ PROTECTED: ${user.email} (${user.name}) - ${userPatterns.join(', ')}`)
        } else if (isTest) {
          testUsers.push(user)
          console.log(`🧪 TEST USER: ${user.email} (${user.name}) - ${userPatterns.join(', ')}`)
        } else {
          legitimateUsers.push(user)
          console.log(`✅ LEGITIMATE: ${user.email} (${user.name})`)
        }
      }

      console.log('\n📈 ANALYSIS SUMMARY:')
      console.log(`   Total Users: ${allUsers.length}`)
      console.log(`   Test Users: ${testUsers.length}`)
      console.log(`   Legitimate Users: ${legitimateUsers.length}`)
      console.log(`   Protected Users: ${protectedUsers.length}`)

      return {
        total: allUsers.length,
        testUsers,
        legitimateUsers,
        protectedUsers,
        patterns: patternMatches
      }

    } catch (error) {
      console.error('❌ TestUserCleanup: Analysis failed:', error)
      throw error
    }
  }

  /**
   * Create a backup of current user data
   */
  static async createBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupKey = `userBackup_${timestamp}`

      // Get current users from localStorage
      const systemUsers = localStorage.getItem('systemUsers')
      const currentUser = localStorage.getItem('currentUser')

      const backup = {
        timestamp: new Date().toISOString(),
        systemUsers: systemUsers ? JSON.parse(systemUsers) : null,
        currentUser: currentUser ? JSON.parse(currentUser) : null,
        userCount: systemUsers ? JSON.parse(systemUsers).length : 0
      }

      localStorage.setItem(backupKey, JSON.stringify(backup))
      console.log(`💾 Backup created: ${backupKey}`)

      return backupKey
    } catch (error) {
      console.error('❌ Failed to create backup:', error)
      throw error
    }
  }

  /**
   * Restore from backup
   */
  static async restoreFromBackup(backupKey: string): Promise<boolean> {
    try {
      const backupData = localStorage.getItem(backupKey)
      if (!backupData) {
        throw new Error(`Backup not found: ${backupKey}`)
      }

      const backup = JSON.parse(backupData)
      console.log(`🔄 Restoring from backup: ${backupKey}`)
      console.log(`   Backup timestamp: ${backup.timestamp}`)
      console.log(`   User count: ${backup.userCount}`)

      if (backup.systemUsers) {
        localStorage.setItem('systemUsers', JSON.stringify(backup.systemUsers))
      }

      if (backup.currentUser) {
        localStorage.setItem('currentUser', JSON.stringify(backup.currentUser))
      }

      console.log('✅ Backup restored successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to restore backup:', error)
      return false
    }
  }

  /**
   * List available backups
   */
  static listBackups(): { key: string; timestamp: string; userCount: number }[] {
    const backups: { key: string; timestamp: string; userCount: number }[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('userBackup_')) {
        try {
          const backupData = localStorage.getItem(key)
          if (backupData) {
            const backup = JSON.parse(backupData)
            backups.push({
              key,
              timestamp: backup.timestamp,
              userCount: backup.userCount || 0
            })
          }
        } catch (error) {
          console.warn(`Invalid backup found: ${key}`)
        }
      }
    }

    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  /**
   * Clean up test users with safety checks
   */
  static async cleanupTestUsers(options: CleanupOptions = {}): Promise<CleanupResult> {
    const {
      dryRun = true,
      createBackup = true,
      confirmEach = false,
      preservePatterns = []
    } = options

    const result: CleanupResult = {
      identified: [],
      deleted: [],
      preserved: [],
      errors: []
    }

    try {
      console.log('🧹 TestUserCleanup: Starting cleanup process...')
      console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE DELETION'}`)
      console.log(`   Backup: ${createBackup ? 'Yes' : 'No'}`)
      console.log(`   Confirm Each: ${confirmEach ? 'Yes' : 'No'}`)

      // Create backup if requested
      if (createBackup && !dryRun) {
        result.backup = await this.createBackup()
      }

      // Analyze users
      const analysis = await this.analyzeUsers()
      result.identified = analysis.testUsers

      if (result.identified.length === 0) {
        console.log('✅ No test users found to clean up')
        return result
      }

      console.log(`\n🎯 Found ${result.identified.length} test users to potentially delete:`)
      result.identified.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (${user.name}) - ID: ${user.id}`)
      })

      if (dryRun) {
        console.log('\n🔍 DRY RUN MODE - No actual deletions will occur')
        console.log('To perform actual cleanup, call with { dryRun: false }')
        return result
      }

      // Perform actual cleanup
      console.log('\n⚠️ PERFORMING LIVE DELETION...')
      await auditLogger.logSecurityEvent('TEST_USER_CLEANUP_START', 'users', true, {
        identifiedCount: result.identified.length,
        mode: 'live'
      })

      for (const user of result.identified) {
        try {
          // Additional safety check - never delete protected users
          const isProtected = this.TEST_PATTERNS.some(pattern =>
            !pattern.safe && (
              (pattern.type === 'email' && user.email.toLowerCase() === pattern.pattern.toString().toLowerCase()) ||
              (pattern.type === 'name' && user.name.toLowerCase() === pattern.pattern.toString().toLowerCase())
            )
          )

          if (isProtected) {
            console.log(`🛡️ PROTECTED - Skipping: ${user.email}`)
            result.preserved.push(user)
            continue
          }

          // Check against preserve patterns
          const shouldPreserve = preservePatterns.some(pattern =>
            user.email.includes(pattern) || user.name.includes(pattern)
          )

          if (shouldPreserve) {
            console.log(`💾 PRESERVED - Skipping: ${user.email}`)
            result.preserved.push(user)
            continue
          }

          // Confirm deletion if requested
          if (confirmEach) {
            const confirmed = confirm(`Delete user: ${user.email} (${user.name})?`)
            if (!confirmed) {
              console.log(`👤 USER SKIPPED - Not confirmed: ${user.email}`)
              result.preserved.push(user)
              continue
            }
          }

          // Delete the user
          console.log(`🗑️ DELETING: ${user.email} (${user.name})`)
          const deleteResponse = await userManagementService.deleteSystemUser(user.id)

          if (deleteResponse.status === 'success') {
            result.deleted.push(user)
            console.log(`✅ DELETED: ${user.email}`)
          } else {
            result.errors.push(`Failed to delete ${user.email}: ${deleteResponse.error}`)
            console.error(`❌ FAILED: ${user.email} - ${deleteResponse.error}`)
          }

        } catch (error) {
          const errorMsg = `Error deleting ${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`
          result.errors.push(errorMsg)
          console.error(`❌ ERROR: ${errorMsg}`)
        }
      }

      // Log completion
      await auditLogger.logSecurityEvent('TEST_USER_CLEANUP_COMPLETED', 'users', true, {
        deletedCount: result.deleted.length,
        preservedCount: result.preserved.push.length,
        errorCount: result.errors.length
      })

      console.log('\n🎉 CLEANUP COMPLETED!')
      console.log(`   Deleted: ${result.deleted.length}`)
      console.log(`   Preserved: ${result.preserved.length}`)
      console.log(`   Errors: ${result.errors.length}`)

      if (result.backup) {
        console.log(`   Backup: ${result.backup}`)
      }

      return result

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(errorMsg)
      console.error('❌ TestUserCleanup: Cleanup failed:', error)

      await auditLogger.logSecurityEvent('TEST_USER_CLEANUP_FAILED', 'users', false, {
        error: errorMsg
      })

      return result
    }
  }

  /**
   * Interactive cleanup with user confirmation
   */
  static async interactiveCleanup(): Promise<CleanupResult> {
    try {
      console.log('🎮 TestUserCleanup: Starting interactive cleanup...')

      // First, analyze users
      const analysis = await this.analyzeUsers()

      if (analysis.testUsers.length === 0) {
        console.log('✅ No test users found!')
        return {
          identified: [],
          deleted: [],
          preserved: [],
          errors: []
        }
      }

      console.log(`\n📋 INTERACTIVE CLEANUP MENU`)
      console.log(`Found ${analysis.testUsers.length} test users to potentially delete:`)

      analysis.testUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (${user.name})`)
      })

      console.log(`\nProtected users (will NOT be deleted): ${analysis.protectedUsers.length}`)
      analysis.protectedUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (${user.name})`)
      })

      // Ask for confirmation
      const proceed = confirm(
        `Do you want to delete ${analysis.testUsers.length} test users?\n\n` +
        'This action cannot be undone, but a backup will be created.\n\n' +
        'Click OK to proceed, Cancel to abort.'
      )

      if (!proceed) {
        console.log('👤 User cancelled cleanup')
        return {
          identified: analysis.testUsers,
          deleted: [],
          preserved: analysis.testUsers,
          errors: []
        }
      }

      // Perform cleanup
      return await this.cleanupTestUsers({
        dryRun: false,
        createBackup: true,
        confirmEach: false
      })

    } catch (error) {
      console.error('❌ Interactive cleanup failed:', error)
      throw error
    }
  }
}

// Export for global access in browser console
if (typeof window !== 'undefined') {
  (window as any).TestUserCleanup = TestUserCleanup
}

export default TestUserCleanup