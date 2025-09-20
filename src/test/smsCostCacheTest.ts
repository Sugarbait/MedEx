/**
 * Test file to verify SMS cost cache functionality
 * This can be run in the browser console to test the cost caching system
 */

import { smsCostCacheService } from '@/services/smsCostCacheService'

// Mock chat data for testing
const mockChats = [
  {
    chat_id: 'test_chat_1',
    agent_id: 'agent_643486efd4b5a0e9d7e094ab99',
    start_timestamp: Date.now() / 1000,
    end_timestamp: (Date.now() / 1000) + 300,
    chat_status: 'ended',
    transcript: 'Test chat 1',
    message_with_tool_calls: []
  },
  {
    chat_id: 'test_chat_2',
    agent_id: 'agent_643486efd4b5a0e9d7e094ab99',
    start_timestamp: Date.now() / 1000,
    end_timestamp: (Date.now() / 1000) + 600,
    chat_status: 'ended',
    transcript: 'Test chat 2',
    message_with_tool_calls: []
  },
  {
    chat_id: 'test_chat_3',
    agent_id: 'agent_643486efd4b5a0e9d7e094ab99',
    start_timestamp: Date.now() / 1000,
    end_timestamp: (Date.now() / 1000) + 450,
    chat_status: 'ended',
    transcript: 'Test chat 3',
    message_with_tool_calls: []
  }
]

/**
 * Test the singleton pattern and prevent duplicate loading
 */
async function testSingletonLoading() {
  console.log('🧪 Testing singleton loading pattern...')

  // Clear cache first
  smsCostCacheService.clearCacheForDateRange()

  const chat = mockChats[0]

  // Start multiple concurrent loads of the same chat
  const promises = Array(5).fill(null).map((_, i) => {
    console.log(`Starting load ${i + 1} for ${chat.chat_id}`)
    return smsCostCacheService.loadChatCost(chat)
  })

  try {
    const results = await Promise.all(promises)

    // All results should be the same
    const firstResult = results[0]
    const allSame = results.every(result => result === firstResult)

    console.log('✅ Results:', results)
    console.log(`✅ All results same: ${allSame}`)
    console.log(`✅ Cost for ${chat.chat_id}: CAD $${firstResult.toFixed(4)}`)

    return allSame
  } catch (error) {
    console.error('❌ Test failed:', error)
    return false
  }
}

/**
 * Test cache expiry and cleanup
 */
async function testCacheExpiry() {
  console.log('🧪 Testing cache behavior...')

  const chat = mockChats[1]

  // Load cost and check cache
  const cost1 = await smsCostCacheService.loadChatCost(chat)
  const cached1 = smsCostCacheService.getChatCost(chat.chat_id)

  console.log(`✅ First load: CAD $${cost1.toFixed(4)}`)
  console.log(`✅ Cached result: ${cached1.cached}, cost: CAD $${cached1.cost.toFixed(4)}`)

  // Second load should use cache
  const cost2 = await smsCostCacheService.loadChatCost(chat)
  const cached2 = smsCostCacheService.getChatCost(chat.chat_id)

  console.log(`✅ Second load: CAD $${cost2.toFixed(4)}`)
  console.log(`✅ Still cached: ${cached2.cached}, cost: CAD $${cached2.cost.toFixed(4)}`)

  return cost1 === cost2 && cached2.cached
}

/**
 * Test multiple chat loading with progress
 */
async function testMultipleChatLoading() {
  console.log('🧪 Testing multiple chat loading...')

  smsCostCacheService.clearCacheForDateRange()

  let progressCalls = 0
  const costs = await smsCostCacheService.loadMultipleChatCosts(
    mockChats,
    (loaded, total) => {
      progressCalls++
      console.log(`📊 Progress: ${loaded}/${total}`)
    }
  )

  console.log('✅ Final costs:', costs)
  console.log(`✅ Progress callbacks: ${progressCalls}`)
  console.log(`✅ Loaded ${Object.keys(costs).length} of ${mockChats.length} chat costs`)

  return Object.keys(costs).length === mockChats.length
}

/**
 * Test cleanup and abortion
 */
async function testCleanupAndAbortion() {
  console.log('🧪 Testing cleanup and abortion...')

  smsCostCacheService.clearCacheForDateRange()

  // Start loading costs
  const loadPromise = smsCostCacheService.loadMultipleChatCosts(mockChats)

  // Cancel after a short delay
  setTimeout(() => {
    console.log('🛑 Cancelling all loading operations...')
    smsCostCacheService.cancelAllLoading()
  }, 100)

  try {
    await loadPromise
    console.log('✅ Load completed (some may have been cancelled)')
  } catch (error) {
    console.log('✅ Load was cancelled as expected:', error.message)
  }

  const stats = smsCostCacheService.getCacheStats()
  console.log('✅ Cache stats after cleanup:', stats)

  return stats.loadingOperations === 0
}

/**
 * Run all tests
 */
export async function runSMSCostCacheTests() {
  console.log('🚀 Starting SMS Cost Cache Tests...')
  console.log('=====================================')

  const results = {
    singletonLoading: false,
    cacheExpiry: false,
    multipleChatLoading: false,
    cleanupAndAbortion: false
  }

  try {
    results.singletonLoading = await testSingletonLoading()
    await new Promise(resolve => setTimeout(resolve, 500))

    results.cacheExpiry = await testCacheExpiry()
    await new Promise(resolve => setTimeout(resolve, 500))

    results.multipleChatLoading = await testMultipleChatLoading()
    await new Promise(resolve => setTimeout(resolve, 500))

    results.cleanupAndAbortion = await testCleanupAndAbortion()

  } catch (error) {
    console.error('❌ Test suite failed:', error)
  }

  console.log('=====================================')
  console.log('📊 Test Results:')
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`)
  })

  const allPassed = Object.values(results).every(result => result === true)
  console.log(`🎯 Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`)

  return results
}

// Export for console usage
if (typeof window !== 'undefined') {
  (window as any).runSMSCostCacheTests = runSMSCostCacheTests
  (window as any).smsCostCacheService = smsCostCacheService
}