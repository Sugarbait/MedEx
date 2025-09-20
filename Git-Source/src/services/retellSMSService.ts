/**
 * Enhanced Retell AI SMS Service for capturing and processing SMS data
 * Integrates with Retell AI Chat API to capture SMS conversations
 */

import { retellService, type RetellChat } from './retellService'

export interface SMSMessage {
  message_id: string
  patient_id?: string
  phone_number: string
  message_content: string
  direction: 'inbound' | 'outbound'
  status: 'sent' | 'delivered' | 'failed' | 'pending'
  timestamp: string
  cost?: number
  metadata?: {
    patient_name?: string
    message_type?: string
    campaign_id?: string
    chat_id?: string
    agent_id?: string
    [key: string]: any
  }
  sentiment_analysis?: {
    overall_sentiment: 'positive' | 'negative' | 'neutral'
    confidence_score: number
  }
}

export interface SMSAnalytics {
  totalMessages: number
  deliveryRate: number
  responseRate: number
  avgResponseTime: string
  totalCost: number
  positiveSentiment: number
  highestEngagement: number
  failedMessages: number
  avgCostPerSMS: number
}

export interface SMSConversation {
  conversation_id: string
  patient_id: string
  phone_number: string
  patient_name?: string
  start_time: string
  end_time?: string
  total_messages: number
  total_cost: number
  status: 'active' | 'completed' | 'failed'
  messages: SMSMessage[]
  summary?: {
    purpose: string
    outcome: string
    next_steps?: string
  }
}

class RetellSMSService {
  private static instance: RetellSMSService
  private smsCache = new Map<string, SMSMessage[]>()
  private conversationCache = new Map<string, SMSConversation>()

  static getInstance(): RetellSMSService {
    if (!RetellSMSService.instance) {
      RetellSMSService.instance = new RetellSMSService()
    }
    return RetellSMSService.instance
  }

  /**
   * Create SMS chat using Retell AI API
   */
  async createSMSChat(params: {
    agent_id: string
    phone_number: string
    patient_id?: string
    patient_name?: string
    initial_message?: string
    metadata?: Record<string, any>
  }): Promise<{ success: boolean; chat_id?: string; error?: string }> {
    try {
      if (!retellService.isConfigured()) {
        throw new Error('Retell AI API not configured')
      }

      // Use the create-chat endpoint for SMS
      const chatData = {
        agent_id: params.agent_id,
        metadata: {
          phone_number: params.phone_number,
          patient_id: params.patient_id,
          patient_name: params.patient_name,
          message_type: 'SMS',
          initial_message: params.initial_message,
          ...params.metadata
        }
      }

      const response = await fetch('https://api.retellai.com/create-chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${retellService.getApiKey()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chatData)
      })

      if (!response.ok) {
        throw new Error(`Retell API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      return {
        success: true,
        chat_id: result.chat_id
      }

    } catch (error: any) {
      console.error('Failed to create SMS chat:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Transform Retell chats to SMS messages
   */
  async transformChatsToSMS(chats: RetellChat[]): Promise<SMSMessage[]> {
    const smsMessages: SMSMessage[] = []

    console.log(`Transforming ${chats.length} chats to SMS messages`)

    for (const chat of chats) {
      // Process ALL chats, not just those with phone_number metadata
      const messageCount = chat.message_with_tool_calls?.length || 0
      console.log(`Processing chat ${chat.chat_id} with ${messageCount} messages`, {
        agent_id: chat.agent_id,
        chat_status: chat.chat_status,
        has_phone: !!chat.metadata?.phone_number,
        metadata_keys: chat.metadata ? Object.keys(chat.metadata) : 'none'
      })

      // Process each message in the chat
      for (const message of chat.message_with_tool_calls || []) {
        const smsMessage: SMSMessage = {
          message_id: message.message_id,
          patient_id: chat.metadata?.patient_id || `patient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          phone_number: chat.metadata?.phone_number || '+1234567890', // Default phone number
          message_content: message.content,
          direction: message.role === 'user' ? 'inbound' : 'outbound',
          status: this.determineSMSStatus(chat.chat_status),
          timestamp: new Date(message.created_timestamp * 1000).toISOString(),
          cost: this.calculateMessageCost(message.content),
          metadata: {
            patient_name: chat.metadata?.patient_name || `Patient ${chat.metadata?.patient_id || 'Unknown'}`,
            message_type: chat.metadata?.message_type || 'Chat Message',
            chat_id: chat.chat_id,
            agent_id: chat.agent_id,
            campaign_id: chat.metadata?.campaign_id,
            ...chat.metadata
          },
          sentiment_analysis: chat.chat_analysis?.user_sentiment ? {
            overall_sentiment: chat.chat_analysis.user_sentiment as 'positive' | 'negative' | 'neutral',
            confidence_score: 0.85 // Default confidence score
          } : undefined
        }

        smsMessages.push(smsMessage)
      }
    }

    // Sort by timestamp descending
    smsMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    console.log(`Transformed to ${smsMessages.length} SMS messages`)

    // Count today's messages
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const todayEnd = todayStart + 86400000 // 24 hours later

    const todayMessages = smsMessages.filter(msg => {
      const msgTime = new Date(msg.timestamp).getTime()
      return msgTime >= todayStart && msgTime < todayEnd
    })

    console.log(`Today's SMS messages: ${todayMessages.length}`)

    return smsMessages
  }

  /**
   * Get SMS messages from Retell AI with optional filtering
   */
  async getSMSMessages(options: {
    dateRange?: { start: Date; end: Date }
    phone_number?: string
    patient_id?: string
    direction?: 'inbound' | 'outbound'
    status?: string
  } = {}): Promise<SMSMessage[]> {
    try {
      // Fetch chat history from Retell
      const chatsResponse = await retellService.getChatHistory()

      // Transform to SMS messages
      const smsMessages = await this.transformChatsToSMS(chatsResponse.chats)

      // Apply filters
      let filteredMessages = smsMessages

      if (options.dateRange) {
        filteredMessages = filteredMessages.filter(msg => {
          const msgDate = new Date(msg.timestamp)
          return msgDate >= options.dateRange!.start && msgDate <= options.dateRange!.end
        })
      }

      if (options.phone_number) {
        filteredMessages = filteredMessages.filter(msg =>
          msg.phone_number.includes(options.phone_number!)
        )
      }

      if (options.patient_id) {
        filteredMessages = filteredMessages.filter(msg =>
          msg.patient_id === options.patient_id
        )
      }

      if (options.direction) {
        filteredMessages = filteredMessages.filter(msg =>
          msg.direction === options.direction
        )
      }

      if (options.status) {
        filteredMessages = filteredMessages.filter(msg =>
          msg.status === options.status
        )
      }

      return filteredMessages

    } catch (error) {
      console.error('Failed to get SMS messages:', error)
      throw error
    }
  }

  /**
   * Calculate SMS analytics from messages
   */
  calculateSMSAnalytics(messages: SMSMessage[]): SMSAnalytics {
    if (messages.length === 0) {
      return {
        totalMessages: 0,
        deliveryRate: 0,
        responseRate: 0,
        avgResponseTime: '0m',
        totalCost: 0,
        positiveSentiment: 0,
        highestEngagement: 0,
        failedMessages: 0,
        avgCostPerSMS: 0
      }
    }

    const totalMessages = messages.length
    const deliveredMessages = messages.filter(m => m.status === 'delivered').length
    const failedMessages = messages.filter(m => m.status === 'failed').length
    const inboundMessages = messages.filter(m => m.direction === 'inbound').length
    const outboundMessages = messages.filter(m => m.direction === 'outbound').length

    const deliveryRate = totalMessages > 0 ? (deliveredMessages / totalMessages) * 100 : 0
    const responseRate = outboundMessages > 0 ? (inboundMessages / outboundMessages) * 100 : 0

    const totalCost = messages.reduce((sum, msg) => sum + (msg.cost || 0), 0)
    const avgCostPerSMS = totalMessages > 0 ? totalCost / totalMessages : 0

    const positiveMessages = messages.filter(m =>
      m.sentiment_analysis?.overall_sentiment === 'positive'
    ).length
    const positiveSentiment = totalMessages > 0 ? (positiveMessages / totalMessages) * 100 : 0

    // Calculate average response time (simplified)
    const avgResponseTime = this.calculateAverageResponseTime(messages)

    return {
      totalMessages,
      deliveryRate,
      responseRate,
      avgResponseTime,
      totalCost,
      positiveSentiment,
      highestEngagement: responseRate, // Using response rate as engagement metric
      failedMessages,
      avgCostPerSMS
    }
  }

  /**
   * Group messages into conversations
   */
  async getSMSConversations(messages: SMSMessage[]): Promise<SMSConversation[]> {
    const conversationMap = new Map<string, SMSMessage[]>()

    // Group messages by phone number (simplified conversation grouping)
    for (const message of messages) {
      const key = message.phone_number
      if (!conversationMap.has(key)) {
        conversationMap.set(key, [])
      }
      conversationMap.get(key)!.push(message)
    }

    const conversations: SMSConversation[] = []

    for (const [phoneNumber, msgs] of conversationMap.entries()) {
      msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      const firstMessage = msgs[0]
      const lastMessage = msgs[msgs.length - 1]

      const conversation: SMSConversation = {
        conversation_id: `conv_${phoneNumber.replace(/\D/g, '')}_${Date.now()}`,
        patient_id: firstMessage.patient_id || '',
        phone_number: phoneNumber,
        patient_name: firstMessage.metadata?.patient_name,
        start_time: firstMessage.timestamp,
        end_time: lastMessage.timestamp,
        total_messages: msgs.length,
        total_cost: msgs.reduce((sum, msg) => sum + (msg.cost || 0), 0),
        status: msgs.some(m => m.status === 'failed') ? 'failed' :
                msgs.some(m => m.status === 'pending') ? 'active' : 'completed',
        messages: msgs,
        summary: {
          purpose: 'Patient communication',
          outcome: msgs.length > 2 ? 'Multi-turn conversation' : 'Single exchange'
        }
      }

      conversations.push(conversation)
    }

    return conversations.sort((a, b) =>
      new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    )
  }

  private determineSMSStatus(chatStatus: string): SMSMessage['status'] {
    switch (chatStatus) {
      case 'ended': return 'delivered'
      case 'error': return 'failed'
      case 'ongoing': return 'pending'
      default: return 'sent'
    }
  }

  private calculateMessageCost(content: string): number {
    // SMS pricing: $0.0075 per segment (160 chars)
    const segments = Math.ceil(content.length / 160)
    return segments * 0.0075
  }

  private calculateAverageResponseTime(messages: SMSMessage[]): string {
    // Simplified response time calculation
    const responseTimes: number[] = []

    for (let i = 1; i < messages.length; i++) {
      const current = messages[i]
      const previous = messages[i - 1]

      if (current.direction !== previous.direction) {
        const timeDiff = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime()
        responseTimes.push(timeDiff)
      }
    }

    if (responseTimes.length === 0) return '0m'

    const avgMs = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    const avgMinutes = Math.round(avgMs / (1000 * 60))

    return `${avgMinutes}m`
  }
}

export const retellSMSService = RetellSMSService.getInstance()