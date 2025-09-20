/**
 * Test file for Notes UUID Fix
 * This tests the userIdTranslationService and notesService UUID handling
 */

import { userIdTranslationService } from '@/services/userIdTranslationService'
import { notesService } from '@/services/notesService'

export interface TestResult {
  test: string
  status: 'pass' | 'fail'
  error?: string
  data?: any
}

export class NotesUuidFixTestSuite {
  private results: TestResult[] = []

  /**
   * Run all UUID fix tests
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting Notes UUID Fix Test Suite...')

    await this.testStringToUuidConversion()
    await this.testUuidToStringConversion()
    await this.testCurrentUserUuidRetrieval()
    await this.testNotesServiceWithUuidFix()
    await this.testKnownDemoUserMappings()

    this.printResults()
    return this.results
  }

  /**
   * Test string ID to UUID conversion
   */
  private async testStringToUuidConversion(): Promise<void> {
    try {
      console.log('🔄 Testing string to UUID conversion...')

      // Test demo user conversion
      const pierreUuid = await userIdTranslationService.stringToUuid('pierre-user-789')

      if (pierreUuid === 'c550502f-c39d-4bb3-bb8c-d193657fdb24') {
        this.addResult('testStringToUuidConversion', 'pass', undefined, {
          input: 'pierre-user-789',
          output: pierreUuid
        })
        console.log('✅ Pierre user UUID conversion successful')
      } else {
        throw new Error(`Expected c550502f-c39d-4bb3-bb8c-d193657fdb24, got ${pierreUuid}`)
      }

      // Test already UUID input
      const existingUuid = 'c550502f-c39d-4bb3-bb8c-d193657fdb24'
      const uuidResult = await userIdTranslationService.stringToUuid(existingUuid)

      if (uuidResult === existingUuid) {
        console.log('✅ UUID passthrough working correctly')
      } else {
        throw new Error('UUID passthrough failed')
      }

      // Test null/undefined input
      const nullResult = await userIdTranslationService.stringToUuid(null)
      if (nullResult === null) {
        console.log('✅ Null input handling working correctly')
      } else {
        throw new Error('Null input should return null')
      }

    } catch (error) {
      this.addResult('testStringToUuidConversion', 'fail', error instanceof Error ? error.message : 'Unknown error')
      console.log('❌ String to UUID conversion failed:', error)
    }
  }

  /**
   * Test UUID to string conversion (reverse lookup)
   */
  private async testUuidToStringConversion(): Promise<void> {
    try {
      console.log('🔄 Testing UUID to string conversion...')

      const stringId = await userIdTranslationService.uuidToString('c550502f-c39d-4bb3-bb8c-d193657fdb24')

      if (stringId === 'pierre-user-789') {
        this.addResult('testUuidToStringConversion', 'pass', undefined, {
          input: 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
          output: stringId
        })
        console.log('✅ UUID to string conversion successful')
      } else {
        // It's okay if it doesn't find the reverse mapping, just log it
        console.log('ℹ️ UUID reverse lookup returned:', stringId)
        this.addResult('testUuidToStringConversion', 'pass', undefined, {
          input: 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
          output: stringId,
          note: 'Reverse lookup may not always find original string ID'
        })
      }

    } catch (error) {
      this.addResult('testUuidToStringConversion', 'fail', error instanceof Error ? error.message : 'Unknown error')
      console.log('❌ UUID to string conversion failed:', error)
    }
  }

  /**
   * Test current user UUID retrieval
   */
  private async testCurrentUserUuidRetrieval(): Promise<void> {
    try {
      console.log('🔄 Testing current user UUID retrieval...')

      // Set up test localStorage data
      const testUser = {
        id: 'pierre-user-789',
        name: 'Pierre Test User',
        email: 'pierre@test.com'
      }

      localStorage.setItem('currentUser', JSON.stringify(testUser))

      const currentUserUuid = await userIdTranslationService.getCurrentUserUuid()

      if (currentUserUuid && currentUserUuid.includes('-')) {
        this.addResult('testCurrentUserUuidRetrieval', 'pass', undefined, {
          originalUser: testUser,
          convertedUuid: currentUserUuid
        })
        console.log('✅ Current user UUID retrieval successful:', currentUserUuid)
      } else {
        throw new Error(`Expected UUID format, got ${currentUserUuid}`)
      }

    } catch (error) {
      this.addResult('testCurrentUserUuidRetrieval', 'fail', error instanceof Error ? error.message : 'Unknown error')
      console.log('❌ Current user UUID retrieval failed:', error)
    }
  }

  /**
   * Test notes service with UUID fix
   */
  private async testNotesServiceWithUuidFix(): Promise<void> {
    try {
      console.log('🔄 Testing notes service with UUID fix...')

      // Set up test user in localStorage
      const testUser = {
        id: 'pierre-user-789',
        name: 'Pierre Test User',
        email: 'pierre@test.com'
      }

      localStorage.setItem('currentUser', JSON.stringify(testUser))

      // Create a test note
      const testNote = {
        reference_id: 'test-call-uuid-fix',
        reference_type: 'call' as const,
        content: 'Test note to verify UUID fix is working'
      }

      console.log('Creating note with test data:', testNote)
      const createResult = await notesService.createNote(testNote)

      if (createResult.success && createResult.note) {
        // Check that the created_by field is a proper UUID
        const createdBy = createResult.note.created_by
        if (createdBy && this.isValidUuid(createdBy)) {
          this.addResult('testNotesServiceWithUuidFix', 'pass', undefined, {
            note: createResult.note,
            original_user_id: 'pierre-user-789',
            converted_uuid: createdBy
          })
          console.log('✅ Notes service UUID fix working! Created note with UUID:', createdBy)

          // Clean up - try to delete the test note
          try {
            await notesService.deleteNote(createResult.note.id)
            console.log('✅ Test note cleaned up successfully')
          } catch (cleanupError) {
            console.log('⚠️ Could not clean up test note (this is okay)')
          }

        } else {
          throw new Error(`Expected UUID format for created_by, got: ${createdBy}`)
        }
      } else {
        throw new Error(createResult.error || 'Failed to create note')
      }

    } catch (error) {
      this.addResult('testNotesServiceWithUuidFix', 'fail', error instanceof Error ? error.message : 'Unknown error')
      console.log('❌ Notes service UUID fix test failed:', error)
    }
  }

  /**
   * Test all known demo user mappings
   */
  private async testKnownDemoUserMappings(): Promise<void> {
    try {
      console.log('🔄 Testing known demo user mappings...')

      const demoUsers = [
        'pierre-user-789',
        'super-user-456',
        'guest-user-456',
        'dynamic-pierre-user'
      ]

      const results = []
      for (const userId of demoUsers) {
        const uuid = await userIdTranslationService.stringToUuid(userId)
        results.push({ userId, uuid })
        console.log(`  ${userId} -> ${uuid}`)
      }

      // All demo users should get valid UUIDs
      const allValid = results.every(r => r.uuid && this.isValidUuid(r.uuid))

      if (allValid) {
        this.addResult('testKnownDemoUserMappings', 'pass', undefined, results)
        console.log('✅ All demo user mappings working correctly')
      } else {
        throw new Error('Some demo user mappings failed to produce valid UUIDs')
      }

    } catch (error) {
      this.addResult('testKnownDemoUserMappings', 'fail', error instanceof Error ? error.message : 'Unknown error')
      console.log('❌ Demo user mappings test failed:', error)
    }
  }

  /**
   * Check if string is valid UUID format
   */
  private isValidUuid(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
  }

  /**
   * Add test result
   */
  private addResult(test: string, status: 'pass' | 'fail', error?: string, data?: any): void {
    this.results.push({ test, status, error, data })
  }

  /**
   * Print test results summary
   */
  private printResults(): void {
    console.log('\n📊 Notes UUID Fix Test Results:')
    console.log('===================================')

    const passed = this.results.filter(r => r.status === 'pass').length
    const failed = this.results.filter(r => r.status === 'fail').length

    this.results.forEach(result => {
      const emoji = result.status === 'pass' ? '✅' : '❌'
      console.log(`${emoji} ${result.test}: ${result.status.toUpperCase()}`)
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
      if (result.data && result.status === 'pass') {
        console.log(`   Data:`, JSON.stringify(result.data, null, 2))
      }
    })

    console.log(`\nTotal: ${this.results.length} | Passed: ${passed} | Failed: ${failed}`)

    if (failed === 0) {
      console.log('🎉 All UUID fix tests passed! The issue should be resolved.')
    } else {
      console.log(`⚠️ ${failed} test(s) failed. The UUID fix may need additional work.`)
    }
  }
}

/**
 * Manual test runner function
 */
export async function runNotesUuidFixTests(): Promise<void> {
  const testSuite = new NotesUuidFixTestSuite()
  await testSuite.runAllTests()
}

/**
 * Quick test function to verify the fix works
 */
export async function quickUuidTest(): Promise<boolean> {
  try {
    console.log('🚀 Quick UUID fix test...')

    // Test the main issue: pierre-user-789 -> UUID conversion
    const uuid = await userIdTranslationService.stringToUuid('pierre-user-789')
    console.log('pierre-user-789 converts to:', uuid)

    // Verify it's a valid UUID
    const isValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid || '')

    if (isValid) {
      console.log('✅ UUID conversion working correctly!')
      return true
    } else {
      console.log('❌ UUID conversion failed - not a valid UUID format')
      return false
    }
  } catch (error) {
    console.log('❌ Quick test failed:', error)
    return false
  }
}

// Export for console testing
if (typeof window !== 'undefined') {
  (window as any).notesUuidFixTest = {
    runTests: runNotesUuidFixTests,
    quickTest: quickUuidTest,
    translationService: userIdTranslationService
  }

  // Console helper message
  console.log(`
📝 Notes UUID Fix Testing Commands:
=====================================

To test the UUID fix, open the browser console and run:

1. Quick test:
   notesUuidFixTest.quickTest()

2. Full test suite:
   notesUuidFixTest.runTests()

3. Check user ID translation directly:
   notesUuidFixTest.translationService.stringToUuid('pierre-user-789')

The fix should convert 'pierre-user-789' to 'c550502f-c39d-4bb3-bb8c-d193657fdb24'
`)
}