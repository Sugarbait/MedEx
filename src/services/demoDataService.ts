/**
 * Demo Data Service for MedEx CRM
 * Provides fake data for testing without any external API calls
 * NO CONNECTIONS TO CAREXPS OR ANY EXTERNAL APIS
 */

export interface DemoCall {
  call_id: string
  agent_id: string
  from_number: string
  to_number: string
  direction: 'inbound' | 'outbound'
  start_timestamp: number
  end_timestamp: number
  transcript: string
  recording_url: string
  summary: string
  call_analysis: any
  disconnection_reason: string
  duration_ms: number
  cost: number
}

export interface DemoSMS {
  chat_id: string
  agent_id: string
  from_number: string
  to_number: string
  direction: 'inbound' | 'outbound'
  start_timestamp: number
  end_timestamp: number
  messages: Array<{
    role: string
    content: string
    timestamp: number
  }>
  call_analysis: any
  duration_ms: number
  cost: number
}

class DemoDataService {
  private calls: DemoCall[] = []
  private smsChats: DemoSMS[] = []

  constructor() {
    this.generateDemoData()
  }

  /**
   * Generate fake demo data
   */
  private generateDemoData() {
    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000
    const oneWeek = 7 * oneDay

    // Generate 10 demo calls
    for (let i = 0; i < 10; i++) {
      const startTime = now - Math.random() * oneWeek
      const duration = Math.floor(Math.random() * 300000) + 60000 // 1-5 minutes

      this.calls.push({
        call_id: `demo-call-${i + 1}`,
        agent_id: 'demo-agent-voice',
        from_number: '+15555551234',
        to_number: `+1555555${1000 + i}`,
        direction: i % 2 === 0 ? 'inbound' : 'outbound',
        start_timestamp: startTime,
        end_timestamp: startTime + duration,
        transcript: `This is a demo call transcript for testing purposes. Call ${i + 1}.`,
        recording_url: '',
        summary: `Demo call summary ${i + 1}`,
        call_analysis: {
          call_successful: true,
          call_summary: `Demo analysis for call ${i + 1}`
        },
        disconnection_reason: 'user_hangup',
        duration_ms: duration,
        cost: Math.random() * 2 + 0.5 // $0.50 - $2.50
      })
    }

    // Generate 15 demo SMS chats
    for (let i = 0; i < 15; i++) {
      const startTime = now - Math.random() * oneWeek
      const messageCount = Math.floor(Math.random() * 10) + 3
      const messages = []

      for (let j = 0; j < messageCount; j++) {
        messages.push({
          role: j % 2 === 0 ? 'user' : 'assistant',
          content: `Demo message ${j + 1} in chat ${i + 1}`,
          timestamp: startTime + (j * 60000)
        })
      }

      const duration = messageCount * 60000

      this.smsChats.push({
        chat_id: `demo-sms-${i + 1}`,
        agent_id: 'demo-agent-sms',
        from_number: '+15555551234',
        to_number: `+1555555${2000 + i}`,
        direction: i % 2 === 0 ? 'inbound' : 'outbound',
        start_timestamp: startTime,
        end_timestamp: startTime + duration,
        messages,
        call_analysis: {
          call_successful: true,
          call_summary: `Demo SMS chat summary ${i + 1}`
        },
        duration_ms: duration,
        cost: Math.random() * 1.5 + 0.3 // $0.30 - $1.80
      })
    }
  }

  /**
   * Get all demo calls (NO API CALL)
   */
  async getCalls(): Promise<DemoCall[]> {
    // Simulate network delay for realism
    await new Promise(resolve => setTimeout(resolve, 100))
    return [...this.calls]
  }

  /**
   * Get demo calls within date range (NO API CALL)
   */
  async getCallsInRange(startDate: Date, endDate: Date): Promise<DemoCall[]> {
    await new Promise(resolve => setTimeout(resolve, 100))
    const start = startDate.getTime()
    const end = endDate.getTime()

    return this.calls.filter(call =>
      call.start_timestamp >= start && call.start_timestamp <= end
    )
  }

  /**
   * Get all demo SMS chats (NO API CALL)
   */
  async getSMSChats(): Promise<DemoSMS[]> {
    await new Promise(resolve => setTimeout(resolve, 100))
    return [...this.smsChats]
  }

  /**
   * Get demo SMS chats within date range (NO API CALL)
   */
  async getSMSChatsInRange(startDate: Date, endDate: Date): Promise<DemoSMS[]> {
    await new Promise(resolve => setTimeout(resolve, 100))
    const start = startDate.getTime()
    const end = endDate.getTime()

    return this.smsChats.filter(chat =>
      chat.start_timestamp >= start && chat.start_timestamp <= end
    )
  }

  /**
   * Get analytics summary (NO API CALL)
   */
  async getAnalytics(startDate: Date, endDate: Date) {
    const calls = await this.getCallsInRange(startDate, endDate)
    const smsChats = await this.getSMSChatsInRange(startDate, endDate)

    const totalCalls = calls.length
    const totalSMS = smsChats.length
    const totalCallCost = calls.reduce((sum, call) => sum + call.cost, 0)
    const totalSMSCost = smsChats.reduce((sum, chat) => sum + chat.cost, 0)
    const totalCost = totalCallCost + totalSMSCost

    const avgCallDuration = totalCalls > 0
      ? calls.reduce((sum, call) => sum + call.duration_ms, 0) / totalCalls / 1000
      : 0

    return {
      totalCalls,
      totalSMS,
      totalCost,
      totalCallCost,
      totalSMSCost,
      avgCallDuration,
      calls,
      smsChats
    }
  }

  /**
   * Clear all demo data
   */
  clearData() {
    this.calls = []
    this.smsChats = []
  }

  /**
   * Regenerate demo data
   */
  regenerateData() {
    this.clearData()
    this.generateDemoData()
  }

  /**
   * Check if this is demo mode (always true for this service)
   */
  isDemoMode(): boolean {
    return true
  }
}

// Export singleton instance
export const demoDataService = new DemoDataService()

// Log that demo mode is active
console.log('📊 Demo Data Service initialized - Using fake data, NO external API calls')
