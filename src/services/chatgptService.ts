/**
 * ChatGPT API Service for Site Help Chatbot
 *
 * SECURITY NOTICE: This service is designed for general site help only.
 * NO PHI (Protected Health Information) data should ever be sent to this service.
 * This service is isolated from all patient data and healthcare information.
 *
 * ANALYTICS CAPABILITY: Can access aggregated, anonymized statistics only.
 */

import { analyticsService } from './analyticsService'

export interface ChatGPTMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatGPTResponse {
  success: boolean
  message?: string
  error?: string
}

class ChatGPTService {
  private readonly apiKey: string
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions'
  private readonly model = 'gpt-3.5-turbo' // Best suited for this application - fast and cost-effective

  constructor() {
    // Get API key from environment variables for security
    let apiKey = import.meta.env.VITE_OPENAI_API_KEY || ''

    // Environment variable debugging - ensure .env.local is loaded
    if (!apiKey) {
      console.warn('🚨 VITE_OPENAI_API_KEY not found in environment variables')
      console.warn('🚨 Make sure .env.local exists and contains: VITE_OPENAI_API_KEY=your_key_here')
      console.warn('🚨 Restart the development server after adding the key')
    }

    this.apiKey = apiKey

    // Debug: Check if API key is loaded
    console.log('🔍 ChatGPT Service initialized')
    console.log('🔍 Environment check:', {
      hasViteEnv: !!import.meta.env,
      envKeys: Object.keys(import.meta.env || {}),
      apiKeyExists: !!this.apiKey,
      apiKeyLength: this.apiKey.length,
      apiKeyPreview: this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'NONE'
    })

    if (!this.apiKey) {
      console.error('❌ ChatGPT API key not configured. Please add VITE_OPENAI_API_KEY to .env.local file')
      console.error('❌ Available env vars:', Object.keys(import.meta.env || {}))
    } else {
      console.log('✅ ChatGPT API key loaded successfully')
    }
  }

  /**
   * System prompt that defines the chatbot's role and restrictions
   */
  private getSystemPrompt(): string {
    return `You are a helpful assistant for the CareXPS healthcare platform. You help users navigate and use the platform features, and can provide insights based on aggregated analytics data.

CRITICAL SECURITY RESTRICTIONS:
- You have NO access to any patient data, PHI (Protected Health Information), or healthcare records
- You cannot and must not discuss specific patients, medical records, or any healthcare data
- You can only access aggregated, anonymized statistics and platform usage data
- If asked about patient data, medical information, or PHI, politely decline and redirect to general platform help

Your role is to help users with:
- Platform navigation and features
- How to use SMS/chat functionality
- How to use call management features
- How to add and manage notes
- Settings and profile management
- Search and filtering capabilities
- General platform troubleshooting
- Security and compliance information (general only)

ANALYTICS CAPABILITIES:
- You can provide insights about call and SMS usage patterns (aggregated data only)
- You can answer questions about peak hours, daily patterns, costs, and duration statistics
- You can help interpret platform usage trends and provide operational insights
- All analytics data is anonymized and aggregated - NO individual records or patient information

RESPONSE FORMATTING:
- Use natural language and well-formatted responses
- Structure information with headers, bullet points, and clear paragraphs
- Use markdown formatting for better readability
- Provide actionable insights and recommendations when possible
- Keep responses professional, helpful, and easy to understand

When users ask about statistics, patterns, or historical data, provide comprehensive analysis using the available aggregated data while maintaining strict PHI protection.`
  }

  /**
   * Send a message to ChatGPT and get a response
   * This method ensures no PHI data is sent by design
   */
  async sendMessage(userMessage: string, conversationHistory: ChatGPTMessage[] = []): Promise<ChatGPTResponse> {
    try {
      console.log('🚀 ChatGPT sendMessage called with:', {
        message: userMessage,
        historyLength: conversationHistory.length,
        hasApiKey: !!this.apiKey,
        apiKeyLength: this.apiKey.length
      })

      // Check if API key is configured
      if (!this.apiKey) {
        console.error('❌ No API key found in sendMessage')
        return {
          success: false,
          error: 'ChatGPT service not configured. Using fallback responses.'
        }
      }

      // Validate that the message doesn't contain potential PHI indicators
      if (this.containsPotentialPHI(userMessage)) {
        return {
          success: false,
          error: 'I cannot discuss specific patient information or healthcare data. I can help you with platform navigation and general features instead.'
        }
      }

      // Check if this is an analytics question and provide enhanced context
      let enhancedUserMessage = userMessage
      if (this.isAnalyticsQuestion(userMessage)) {
        try {
          console.log('🔍 Analytics question detected, fetching aggregated data...')
          const analyticsResponse = await analyticsService.getNaturalLanguageSummary(userMessage)

          // If analytics service provides a direct answer, use it
          if (analyticsResponse && !analyticsResponse.includes('No activity data')) {
            return {
              success: true,
              message: analyticsResponse
            }
          }

          // Otherwise, enhance the user message with available analytics context
          const analytics = await analyticsService.getAnalytics('last7days')
          const contextData = this.buildAnalyticsContext(analytics, userMessage)

          if (contextData) {
            enhancedUserMessage = `${userMessage}\n\nRelevant aggregated data context (anonymized): ${contextData}`
          }
        } catch (error) {
          console.log('Analytics service unavailable, proceeding with standard response')
        }
      }

      // Build the conversation with system prompt
      const messages: ChatGPTMessage[] = [
        { role: 'system', content: this.getSystemPrompt() },
        ...conversationHistory.slice(-10), // Keep last 10 messages for context
        { role: 'user', content: enhancedUserMessage }
      ]

      console.log('Sending request to ChatGPT (NO PHI data):', {
        messageCount: messages.length,
        apiUrl: this.apiUrl,
        model: this.model,
        hasApiKey: !!this.apiKey
      })

      const requestBody = {
        model: this.model,
        messages: messages,
        max_tokens: 1000, // Increased for longer analytics responses
        temperature: 0.7, // Balanced creativity
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      }

      console.log('Request body:', JSON.stringify(requestBody, null, 2))

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      })

      console.log('ChatGPT API Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('ChatGPT API error:', response.status, errorData)

        if (response.status === 401) {
          return { success: false, error: 'Authentication failed. Please check API configuration.' }
        } else if (response.status === 429) {
          return { success: false, error: 'Rate limit exceeded. Please try again in a moment.' }
        } else {
          return { success: false, error: 'Service temporarily unavailable. Please try again later.' }
        }
      }

      const data = await response.json()

      if (data.choices && data.choices.length > 0) {
        const assistantMessage = data.choices[0].message?.content?.trim()

        if (assistantMessage) {
          console.log('ChatGPT response received successfully')
          return {
            success: true,
            message: assistantMessage
          }
        }
      }

      return {
        success: false,
        error: 'No response generated. Please try rephrasing your question.'
      }

    } catch (error) {
      console.error('ChatGPT service error:', error)
      return {
        success: false,
        error: 'Unable to connect to help service. Please try again later.'
      }
    }
  }

  /**
   * Basic check to prevent potential PHI data from being sent
   * This is a safety measure to catch obvious PHI patterns
   */
  private containsPotentialPHI(message: string): boolean {
    const lowerMessage = message.toLowerCase()

    // Check for potential PHI indicators
    const phiPatterns = [
      // Patient identifiers
      /patient.*(?:id|number|ssn|social)/,
      /medical.*(?:record|number|id)/,
      /insurance.*(?:number|id|policy)/,

      // Medical information patterns
      /diagnosis.*of/,
      /prescription.*for/,
      /treatment.*plan/,
      /medical.*history/,
      /symptoms.*include/,
      /condition.*is/,

      // Phone number patterns (could be patient phones)
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,

      // Email patterns (could be patient emails)
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,

      // Date of birth patterns
      /born.*(?:19|20)\d{2}/,
      /date.*birth/,
      /dob/,

      // Address patterns
      /address.*(?:street|st|avenue|ave|road|rd|drive|dr)/,

      // Specific patient mentions
      /this.*patient/,
      /the.*patient/,
      /patient.*named/
    ]

    return phiPatterns.some(pattern => pattern.test(lowerMessage))
  }

  /**
   * Check if user message is asking about analytics or historical data
   */
  private isAnalyticsQuestion(message: string): boolean {
    const lowerMessage = message.toLowerCase()

    const analyticsKeywords = [
      // Time-based questions
      'peak hour', 'busy time', 'most call', 'best time', 'worst time',
      'when do', 'what time', 'peak time', 'busiest', 'slowest',

      // Cost questions
      'cost', 'spend', 'expense', 'money', 'budget', 'price', 'fee',
      'how much', 'total cost', 'average cost',

      // Volume/count questions
      'how many', 'total', 'count', 'number of', 'volume',
      'most calls', 'most messages', 'most sms',

      // Pattern questions
      'pattern', 'trend', 'daily', 'weekly', 'monthly',
      'distribution', 'breakdown', 'analysis',

      // Duration questions
      'duration', 'length', 'long', 'short', 'average call',
      'talk time', 'conversation time',

      // Day/time questions
      'day of week', 'weekend', 'weekday', 'monday', 'tuesday',
      'wednesday', 'thursday', 'friday', 'saturday', 'sunday',

      // Statistics questions
      'statistics', 'stats', 'data', 'metrics', 'analytics',
      'report', 'summary', 'overview', 'insights',

      // SMS specific
      'sms cost', 'message cost', 'text cost', 'segments',
      'conversations', 'chats'
    ]

    return analyticsKeywords.some(keyword => lowerMessage.includes(keyword))
  }

  /**
   * Build analytics context for ChatGPT based on user question
   */
  private buildAnalyticsContext(analytics: any, userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase()
    let context = ''

    try {
      // Add relevant context based on question type
      if (lowerMessage.includes('call') || lowerMessage.includes('phone')) {
        context += `Call data: ${analytics.calls.totalCalls} calls, avg duration ${analytics.calls.avgDuration}, total cost CAD $${analytics.calls.totalCostCAD.toFixed(2)}. `

        if (analytics.calls.peakHours.length > 0) {
          const topHour = analytics.calls.peakHours[0]
          context += `Peak call hour: ${this.formatHour(topHour.hour)} with ${topHour.count} calls. `
        }
      }

      if (lowerMessage.includes('sms') || lowerMessage.includes('message') || lowerMessage.includes('text')) {
        context += `SMS data: ${analytics.sms.totalConversations} conversations, ${analytics.sms.totalSegments} segments, total cost CAD $${analytics.sms.totalCostCAD.toFixed(2)}. `

        if (analytics.sms.peakHours.length > 0) {
          const topHour = analytics.sms.peakHours[0]
          context += `Peak SMS hour: ${this.formatHour(topHour.hour)} with ${topHour.count} messages. `
        }
      }

      if (lowerMessage.includes('cost') || lowerMessage.includes('spend')) {
        const totalCost = analytics.calls.totalCostCAD + analytics.sms.totalCostCAD
        context += `Total costs: CAD $${totalCost.toFixed(2)} (Calls: $${analytics.calls.totalCostCAD.toFixed(2)}, SMS: $${analytics.sms.totalCostCAD.toFixed(2)}). `
      }

      if (lowerMessage.includes('day') || lowerMessage.includes('daily')) {
        if (analytics.calls.dailyDistribution.length > 0) {
          const busiestDay = analytics.calls.dailyDistribution.sort((a: any, b: any) => b.count - a.count)[0]
          context += `Busiest day for calls: ${busiestDay.day} with ${busiestDay.count} calls. `
        }
      }

      return context.trim()

    } catch (error) {
      console.error('Error building analytics context:', error)
      return ''
    }
  }

  /**
   * Format hour for display (12-hour format)
   */
  private formatHour(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:00 ${period}`
  }

  /**
   * Get a safe fallback response when ChatGPT is unavailable
   */
  getFallbackResponse(userMessage: string): string {
    const message = userMessage.toLowerCase()

    // Try to handle analytics questions even in fallback mode
    if (this.isAnalyticsQuestion(userMessage)) {
      return "I can help you analyze your CareXPS usage patterns and statistics! I can provide insights about call volumes, peak hours, costs, SMS usage, and more. However, I need the platform's analytics service to be available. Please try asking about specific metrics like 'What time do I get the most calls?' or 'What are my total costs?'"
    }

    if (message.includes('help') || message.includes('how')) {
      return "I'm here to help you navigate the CareXPS platform! I can assist with features like SMS management, call handling, notes, settings, usage analytics, and general platform usage. What would you like to know about?"
    }

    if (message.includes('sms') || message.includes('chat')) {
      return "For SMS/Chat features: Use the SMS page to view conversations, click any chat to see details, and add notes for reference. You can also search and filter chats by date or status. I can also analyze your SMS usage patterns and costs!"
    }

    if (message.includes('call')) {
      return "For Call features: Visit the Calls page to see all calls, listen to recordings, and add notes. Use the filters to find specific calls by date or outcome. I can also provide insights about your call patterns and peak hours!"
    }

    if (message.includes('stats') || message.includes('data') || message.includes('analytics')) {
      return "I can help you understand your CareXPS usage analytics! Ask me questions like:\n\n• What time do I get the most calls?\n• What are my total communication costs?\n• Which day is busiest for calls?\n• How long are my average calls?\n• What are my SMS usage patterns?\n\nAll analytics are based on aggregated, anonymized data with full PHI protection."
    }

    return "I can help you with platform navigation, SMS/chat features, call management, notes, settings, usage analytics, and general platform usage. What specific area would you like help with?"
  }
}

// Export singleton instance
export const chatgptService = new ChatGPTService()
export default chatgptService