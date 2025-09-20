/**
 * Test file for Call Notes functionality
 * This demonstrates how to test the CallNotesService and validate CRUD operations
 */

import { CallNotesService } from '@/services/callNotesService'
import { DecryptedCallNote } from '@/types/supabase'

// Mock test data
const mockCallId = 'test-call-123'
const mockUserId = 'test-user-456'

/**
 * Test suite for CallNotesService
 * NOTE: These are example tests. In a real implementation, you would:
 * 1. Set up proper test database environment
 * 2. Mock Supabase client for unit tests
 * 3. Use proper test runners like Jest or Vitest
 */

interface TestResult {
  test: string
  status: 'pass' | 'fail'
  error?: string
  data?: any
}

export class CallNotesTestSuite {
  private results: TestResult[] = []

  /**
   * Run all tests
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting Call Notes Test Suite...')

    await this.testCreateNote()
    await this.testGetNotes()
    await this.testUpdateNote()
    await this.testTogglePin()
    await this.testDeleteNote()
    await this.testRealTimeSubscription()

    this.printResults()
    return this.results
  }

  /**
   * Test creating a new note
   */
  private async testCreateNote(): Promise<void> {
    try {
      console.log('📝 Testing note creation...')

      const noteContent = 'This is a test note for call validation'
      const options = {
        isPinned: false,
        tags: ['test', 'validation'],
        metadata: {
          priority: 'medium' as const,
          category: 'test',
          follow_up_required: true
        }
      }

      const response = await CallNotesService.upsertCallNote(
        mockCallId,
        noteContent,
        options
      )

      if (response.status === 'success') {
        this.addResult('testCreateNote', 'pass', undefined, response.data)
        console.log('✅ Note created successfully')
      } else {
        throw new Error(response.error || 'Unknown error')
      }
    } catch (error) {
      this.addResult('testCreateNote', 'fail', error instanceof Error ? error.message : 'Unknown error')
      console.log('❌ Note creation failed:', error)
    }
  }

  /**
   * Test retrieving notes
   */
  private async testGetNotes(): Promise<void> {
    try {
      console.log('📖 Testing note retrieval...')

      const response = await CallNotesService.getCallNotes(mockCallId)

      if (response.status === 'success') {
        const notes = response.data
        if (Array.isArray(notes)) {
          this.addResult('testGetNotes', 'pass', undefined, notes)
          console.log(`✅ Retrieved ${notes.length} notes successfully`)
        } else {
          throw new Error('Expected array of notes')
        }
      } else {
        throw new Error(response.error || 'Unknown error')
      }
    } catch (error) {
      this.addResult('testGetNotes', 'fail', error instanceof Error ? error.message : 'Unknown error')
      console.log('❌ Note retrieval failed:', error)
    }
  }

  /**
   * Test updating an existing note
   */
  private async testUpdateNote(): Promise<void> {
    try {
      console.log('✏️ Testing note update...')

      const updatedContent = 'Updated test note content with additional information'
      const options = {
        isPinned: true,
        tags: ['test', 'validation', 'updated'],
        metadata: {
          priority: 'high' as const,
          category: 'test',
          follow_up_required: false
        }
      }

      const response = await CallNotesService.upsertCallNote(
        mockCallId,
        updatedContent,
        options
      )

      if (response.status === 'success') {
        this.addResult('testUpdateNote', 'pass', undefined, response.data)
        console.log('✅ Note updated successfully')
      } else {
        throw new Error(response.error || 'Unknown error')
      }
    } catch (error) {
      this.addResult('testUpdateNote', 'fail', error instanceof Error ? error.message : 'Unknown error')
      console.log('❌ Note update failed:', error)
    }
  }

  /**
   * Test toggling pin status
   */
  private async testTogglePin(): Promise<void> {
    try {
      console.log('📌 Testing pin toggle...')

      const response = await CallNotesService.togglePinNote(mockCallId)

      if (response.status === 'success') {
        this.addResult('testTogglePin', 'pass', undefined, response.data)
        console.log('✅ Pin toggle successful')
      } else {
        throw new Error(response.error || 'Unknown error')
      }
    } catch (error) {
      this.addResult('testTogglePin', 'fail', error instanceof Error ? error.message : 'Unknown error')
      console.log('❌ Pin toggle failed:', error)
    }
  }

  /**
   * Test deleting a note
   */
  private async testDeleteNote(): Promise<void> {
    try {
      console.log('🗑️ Testing note deletion...')

      const response = await CallNotesService.deleteCallNote(mockCallId)

      if (response.status === 'success') {
        this.addResult('testDeleteNote', 'pass')
        console.log('✅ Note deleted successfully')
      } else {
        throw new Error(response.error || 'Unknown error')
      }
    } catch (error) {
      this.addResult('testDeleteNote', 'fail', error instanceof Error ? error.message : 'Unknown error')
      console.log('❌ Note deletion failed:', error)
    }
  }

  /**
   * Test real-time subscription functionality
   */
  private async testRealTimeSubscription(): Promise<void> {
    try {
      console.log('🔄 Testing real-time subscription...')

      let subscriptionWorking = false
      let unsubscribe: (() => void) | null = null

      // Set up subscription
      const testPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Subscription test timeout'))
        }, 5000)

        unsubscribe = CallNotesService.subscribeToCallNotes(
          mockCallId,
          (note, eventType) => {
            subscriptionWorking = true
            clearTimeout(timeout)
            resolve()
          }
        )

        // Create a test note to trigger the subscription
        setTimeout(async () => {
          try {
            await CallNotesService.upsertCallNote(
              mockCallId,
              'Real-time test note',
              { isPinned: false, tags: ['realtime-test'] }
            )
          } catch (err) {
            clearTimeout(timeout)
            reject(err)
          }
        }, 1000)
      })

      await testPromise

      if (unsubscribe) {
        unsubscribe()
      }

      this.addResult('testRealTimeSubscription', 'pass')
      console.log('✅ Real-time subscription working')
    } catch (error) {
      this.addResult('testRealTimeSubscription', 'fail', error instanceof Error ? error.message : 'Unknown error')
      console.log('❌ Real-time subscription failed:', error)
    }
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
    console.log('\n📊 Test Results Summary:')
    console.log('========================')

    const passed = this.results.filter(r => r.status === 'pass').length
    const failed = this.results.filter(r => r.status === 'fail').length

    this.results.forEach(result => {
      const emoji = result.status === 'pass' ? '✅' : '❌'
      console.log(`${emoji} ${result.test}: ${result.status.toUpperCase()}`)
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
    })

    console.log(`\nTotal: ${this.results.length} | Passed: ${passed} | Failed: ${failed}`)

    if (failed === 0) {
      console.log('🎉 All tests passed!')
    } else {
      console.log(`⚠️ ${failed} test(s) failed. Please check the errors above.`)
    }
  }
}

/**
 * Manual test runner function
 * Call this function to run the test suite
 */
export async function runCallNotesTests(): Promise<void> {
  const testSuite = new CallNotesTestSuite()
  await testSuite.runAllTests()
}

/**
 * Validation helper functions
 */
export class CallNotesValidator {
  /**
   * Validate note structure
   */
  static validateNote(note: DecryptedCallNote): boolean {
    const requiredFields = ['id', 'call_id', 'user_id', 'content', 'created_at', 'updated_at']
    return requiredFields.every(field => note.hasOwnProperty(field))
  }

  /**
   * Validate note content
   */
  static validateNoteContent(content: string): { valid: boolean; error?: string } {
    if (!content || content.trim().length === 0) {
      return { valid: false, error: 'Note content cannot be empty' }
    }

    if (content.length > 10000) {
      return { valid: false, error: 'Note content exceeds maximum length (10,000 characters)' }
    }

    return { valid: true }
  }

  /**
   * Validate note tags
   */
  static validateNoteTags(tags: string[]): { valid: boolean; error?: string } {
    if (tags.length > 10) {
      return { valid: false, error: 'Maximum 10 tags allowed per note' }
    }

    const invalidTags = tags.filter(tag => tag.length > 50)
    if (invalidTags.length > 0) {
      return { valid: false, error: 'Tag length cannot exceed 50 characters' }
    }

    return { valid: true }
  }

  /**
   * Validate HIPAA compliance
   */
  static validateHIPAACompliance(note: DecryptedCallNote): { compliant: boolean; issues: string[] } {
    const issues: string[] = []

    // Check if content is properly encrypted in storage (this would be checked server-side)
    // For client-side validation, we can check other compliance factors

    // Check for potentially sensitive data patterns
    const phonePattern = /\b\d{3}-?\d{3}-?\d{4}\b/g
    const ssnPattern = /\b\d{3}-?\d{2}-?\d{4}\b/g
    const creditCardPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g

    if (phonePattern.test(note.content)) {
      issues.push('Potential phone number detected in note content')
    }

    if (ssnPattern.test(note.content)) {
      issues.push('Potential SSN detected in note content')
    }

    if (creditCardPattern.test(note.content)) {
      issues.push('Potential credit card number detected in note content')
    }

    return {
      compliant: issues.length === 0,
      issues
    }
  }
}

// Export for console testing
if (typeof window !== 'undefined') {
  (window as any).callNotesTest = {
    runTests: runCallNotesTests,
    validator: CallNotesValidator
  }
}