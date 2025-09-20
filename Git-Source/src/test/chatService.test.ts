/**
 * Test file for ChatService functionality
 * Run this to verify the chat service is working correctly
 */

import { describe, it, expect } from 'vitest'
import { chatService, ChatFilters } from '../services/chatService'

/**
 * Test basic chat service functionality
 */
export async function testChatService() {
  console.log('🧪 Testing Chat Service...')

  try {
    // Test 1: Connection test
    console.log('\n1. Testing connection...')
    const connectionResult = await chatService.testConnection()
    console.log('Connection result:', connectionResult)

    // Test 2: Check if configured
    console.log('\n2. Checking configuration...')
    const isConfigured = chatService.isConfigured()
    console.log('Is configured:', isConfigured)

    // Test 3: Get all chats (should work in demo mode)
    console.log('\n3. Fetching all chats...')
    const allChats = await chatService.getAllChats()
    console.log(`Found ${allChats.length} chats`)
    if (allChats.length > 0) {
      console.log('Sample chat:', {
        chat_id: allChats[0].chat_id,
        agent_id: allChats[0].agent_id,
        status: allChats[0].chat_status,
        messages: allChats[0].message_with_tool_calls.length
      })
    }

    // Test 4: Get chat history with filters
    console.log('\n4. Testing filtered chat history...')
    const filters: ChatFilters = {
      chat_status: 'ended'
    }
    const filteredChats = await chatService.getChatHistory({
      filter_criteria: filters,
      limit: 10
    })
    console.log(`Found ${filteredChats.chats.length} ended chats`)

    // Test 5: Get chat by ID
    if (allChats.length > 0) {
      console.log('\n5. Testing get chat by ID...')
      const specificChat = await chatService.getChatById(allChats[0].chat_id)
      console.log('Retrieved chat:', {
        chat_id: specificChat.chat_id,
        transcript_length: specificChat.transcript.length
      })
    }

    // Test 6: Calculate chat statistics
    console.log('\n6. Testing chat statistics...')
    const stats = chatService.getChatStats(allChats)
    console.log('Chat stats:', {
      totalChats: stats.totalChats,
      activeChats: stats.activeChats,
      successRate: stats.successRate,
      totalCost: stats.totalCost
    })

    // Test 7: Get analytics
    console.log('\n7. Testing chat analytics...')
    const analytics = await chatService.getChatAnalytics()
    console.log('Analytics summary:', {
      todayChats: analytics.today.totalChats,
      weekChats: analytics.thisWeek.totalChats,
      monthChats: analytics.thisMonth.totalChats,
      sentimentDistribution: analytics.sentimentDistribution
    })

    // Test 8: Date range filtering
    console.log('\n8. Testing date range filtering...')
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
    const dateRangeChats = await chatService.getChatsByDateRange(startDate, endDate)
    console.log(`Found ${dateRangeChats.chats.length} chats in last 7 days`)

    // Test 9: Create SMS chat (demo mode)
    console.log('\n9. Testing create SMS chat...')
    const createResult = await chatService.createSMSChat({
      agent_id: 'agent_demo_001',
      phone_number: '+1234567890',
      customer_name: 'Test Patient',
      initial_message: 'Hello, this is a test message'
    })
    console.log('Create chat result:', createResult)

    // Test 10: End chat (demo mode)
    if (createResult.success && createResult.chat_id) {
      console.log('\n10. Testing end chat...')
      const endResult = await chatService.endChat(createResult.chat_id)
      console.log('End chat result:', endResult)
    }

    console.log('\n✅ All chat service tests completed successfully!')
    return true

  } catch (error) {
    console.error('❌ Chat service test failed:', error)
    return false
  }
}

/**
 * Test error handling
 */
export async function testChatServiceErrorHandling() {
  console.log('\n🧪 Testing Chat Service Error Handling...')

  try {
    // Test invalid chat ID
    console.log('\n1. Testing invalid chat ID...')
    try {
      await chatService.getChatById('invalid_chat_id')
      console.log('❌ Should have thrown an error')
    } catch (error) {
      console.log('✅ Correctly handled invalid chat ID:', (error as Error).message)
    }

    // Test credential updates
    console.log('\n2. Testing credential updates...')
    chatService.updateCredentials('test_api_key', 'test_agent_id')
    console.log('✅ Credentials updated successfully')

    console.log('\n✅ Error handling tests completed!')
    return true

  } catch (error) {
    console.error('❌ Error handling test failed:', error)
    return false
  }
}

// Proper Vitest test suite
describe('ChatService', () => {
  it('should be able to create instance', () => {
    expect(chatService).toBeDefined()
  })

  it('should handle demo mode when no localStorage', async () => {
    const connectionResult = await chatService.testConnection()
    expect(connectionResult.success).toBe(true)
    expect(connectionResult.message).toContain('Demo mode')
  })

  it('should fetch all chats in demo mode', async () => {
    const allChats = await chatService.getAllChats()
    expect(Array.isArray(allChats)).toBe(true)
    expect(allChats.length).toBeGreaterThan(0)
  })

  it('should filter chats by status', async () => {
    const filters: ChatFilters = { chat_status: 'ended' }
    const filteredChats = await chatService.getChatHistory({
      filter_criteria: filters
    })
    expect(filteredChats.chats).toBeDefined()
    expect(Array.isArray(filteredChats.chats)).toBe(true)
  })

  it('should get chat by ID', async () => {
    const allChats = await chatService.getAllChats()
    if (allChats.length > 0) {
      const specificChat = await chatService.getChatById(allChats[0].chat_id)
      expect(specificChat).toBeDefined()
      expect(specificChat.chat_id).toBe(allChats[0].chat_id)
    }
  })

  it('should calculate chat statistics', async () => {
    const allChats = await chatService.getAllChats()
    const stats = chatService.getChatStats(allChats)
    expect(stats).toBeDefined()
    expect(typeof stats.totalChats).toBe('number')
    expect(typeof stats.successRate).toBe('number')
    expect(typeof stats.totalCost).toBe('number')
  })

  it('should get chat analytics', async () => {
    const analytics = await chatService.getChatAnalytics()
    expect(analytics).toBeDefined()
    expect(analytics.today).toBeDefined()
    expect(analytics.thisWeek).toBeDefined()
    expect(analytics.thisMonth).toBeDefined()
    expect(analytics.sentimentDistribution).toBeDefined()
  })

  it('should create SMS chat in demo mode', async () => {
    const createResult = await chatService.createSMSChat({
      agent_id: 'agent_demo_001',
      phone_number: '+1234567890',
      customer_name: 'Test Patient'
    })
    expect(createResult.success).toBe(true)
    expect(createResult.chat_id).toBeDefined()
  })

  it('should handle date range filtering', async () => {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    const dateRangeChats = await chatService.getChatsByDateRange(startDate, endDate)
    expect(dateRangeChats.chats).toBeDefined()
    expect(Array.isArray(dateRangeChats.chats)).toBe(true)
  })

  it('should handle invalid chat ID gracefully', async () => {
    await expect(chatService.getChatById('invalid_chat_id')).rejects.toThrow()
  })

  it('should update credentials', () => {
    expect(() => {
      chatService.updateCredentials('test_api_key', 'test_agent_id')
    }).not.toThrow()
  })
})

/**
 * Run all tests
 */
export async function runAllChatTests() {
  console.log('🚀 Starting Chat Service Test Suite...')

  const basicTests = await testChatService()
  const errorTests = await testChatServiceErrorHandling()

  console.log('\n📊 Test Results:')
  console.log(`Basic functionality: ${basicTests ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Error handling: ${errorTests ? '✅ PASS' : '❌ FAIL'}`)

  if (basicTests && errorTests) {
    console.log('\n🎉 All tests passed! Chat service is ready for use.')
  } else {
    console.log('\n⚠️ Some tests failed. Please check the implementation.')
  }

  return basicTests && errorTests
}

// Export for use in other test files or manual testing
export { chatService }