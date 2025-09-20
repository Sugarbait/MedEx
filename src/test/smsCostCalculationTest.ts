/**
 * Test SMS Cost Calculation with Updated Logic
 * Tests the fixed 160-character segmentation and role indicator exclusion
 */

import { twilioCostService } from '../services/twilioCostService'

// Test data based on user's example
const testMessages = [
  {
    content: `Patient
Laird Douglas Ferguson 1945 Feb.11 4336-012-739 (RB) Male Cell 613 -661-4114 syljoanedwards@gmail.com`
  },
  {
    content: `AI Assistant
Thanks for the details. I've formatted your new patient intake info—please confirm if this is correct: - Full Name: Laird Douglas Ferguson - Date of Birth: 1945-02-11 - Ontario Health Card Number (first 10 digits): 4336012739 - Version Code: RB - Sex (on health card): Male - Phone Number: 6136614114 - Email: syljoanedwards@gmail.com Reply "Yes, correct" to proceed, or share any changes.`
  },
  {
    content: `Patient
Yes`
  },
  {
    content: `AI Assistant
Thanks! - A CareXPS team member will review your enrollment and reach out with next steps. - Have a great day! end_call`
  }
]

// Expected results with FIXED calculation:
// Using the new combined approach:
// - All clean content combined: ~615 characters
// - Total Segments: 615÷160=3.84, which rounds up to 4 segments
// - Cost in USD: 4 segments×$0.0083 USD/segment=$0.0332 USD
// Note: Previous per-message approach would give 6 segments (incorrect)

export function testSMSCostCalculation() {
  console.log('🧪 Testing SMS Cost Calculation')
  console.log('=====================================')

  // Test the debug calculation
  const debug = twilioCostService.debugSMSCalculation(testMessages)

  console.log('📊 Debug Results:')
  console.log('------------------')

  debug.originalMessages.forEach((msg, index) => {
    console.log(`Message ${index + 1}:`)
    console.log(`  Original: "${msg.content}" (${msg.originalLength} chars)`)
    console.log(`  Clean: "${msg.cleanContent}" (${msg.cleanLength} chars)`)
    console.log(`  Segments: ${msg.segments}`)
    console.log('')
  })

  console.log('📈 Totals:')
  console.log(`  Total Original Characters: ${debug.totalOriginalChars}`)
  console.log(`  Total Clean Characters: ${debug.totalCleanChars}`)
  console.log(`  Total Segments: ${debug.totalSegments}`)
  console.log('')

  console.log('💰 Cost Breakdown:')
  console.log(`  Messages: ${debug.costBreakdown.messageCount}`)
  console.log(`  Segments: ${debug.costBreakdown.segmentCount}`)
  console.log(`  Rate USD: $${debug.costBreakdown.ratePerSegmentUSD} per segment`)
  console.log(`  Rate CAD: $${debug.costBreakdown.ratePerSegmentCAD.toFixed(4)} per segment`)
  console.log(`  Total USD: $${debug.costBreakdown.costUSD}`)
  console.log(`  Total CAD: $${debug.costBreakdown.costCAD.toFixed(4)}`)
  console.log('')

  // Expected validation (updated for fixed calculation)
  console.log('✅ Expected vs Actual (FIXED):')
  console.log(`  Expected Combined Chars: ~615 | Actual: ${debug.combinedCleanLength || debug.totalCleanChars}`)
  console.log(`  Expected Segments: 4 | Actual: ${debug.totalSegmentsCombined || debug.totalSegments}`)
  console.log(`  Expected USD Cost: $0.0332 | Actual: $${debug.costBreakdown.costUSD}`)
  console.log(`  Old method would give: ${debug.totalSegments} segments (per-message sum)`)

  const actualSegments = debug.totalSegmentsCombined || debug.totalSegments
  const actualChars = debug.combinedCleanLength || debug.totalCleanChars

  const isCorrect = Math.abs(actualChars - 615) <= 10 && // Allow small variance for parsing differences
                   actualSegments === 4 &&
                   Math.abs(debug.costBreakdown.costUSD - 0.0332) < 0.0001

  console.log('')
  console.log(isCorrect ? '✅ CALCULATION CORRECT!' : '❌ CALCULATION INCORRECT')

  return {
    success: isCorrect,
    debug,
    expected: {
      cleanChars: 615, // Updated for fixed combined calculation
      segments: 4,
      costUSD: 0.0332
    }
  }
}

// Test individual message parsing
export function testMessageParsing() {
  console.log('🧪 Testing Message Content Parsing')
  console.log('====================================')

  const testContent = `AI Assistant
Thanks for the details. I've formatted your new patient intake info—please confirm if this is correct: - Full Name: Laird Douglas Ferguson - Date of Birth: 1945-02-11 - Ontario Health Card Number (first 10 digits): 4336012739 - Version Code: RB - Sex (on health card): Male - Phone Number: 6136614114 - Email: syljoanedwards@gmail.com Reply "Yes, correct" to proceed, or share any changes.`

  // Access private method through debug calculation
  const debug = twilioCostService.debugSMSCalculation([{ content: testContent }])
  const cleanContent = debug.combinedCleanContent || debug.originalMessages[0].cleanContent

  console.log('Original Content:')
  console.log(`"${testContent}"`)
  console.log(`Length: ${testContent.length}`)
  console.log('')
  console.log('Clean Content (roles removed):')
  console.log(`"${cleanContent}"`)
  console.log(`Length: ${cleanContent.length}`)
  console.log('')
  console.log(`Expected Length: ~389 characters (updated for fixed parsing)`)
  console.log(`Actual Length: ${cleanContent.length} characters`)
  console.log(`Difference: ${Math.abs(cleanContent.length - 389)}`)

  return {
    original: testContent,
    clean: cleanContent,
    originalLength: testContent.length,
    cleanLength: cleanContent.length,
    expectedLength: 389 // Updated expected length
  }
}

// Export for console testing
if (typeof window !== 'undefined') {
  (window as any).testSMSCosts = {
    runFullTest: testSMSCostCalculation,
    testParsing: testMessageParsing
  }

  console.log('🧪 SMS Cost Tests available:')
  console.log('  - window.testSMSCosts.runFullTest() - Full calculation test')
  console.log('  - window.testSMSCosts.testParsing() - Message parsing test')
}