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
  private readonly apiUrl: string
  private readonly model = 'gpt-3.5-turbo' // Best suited for this application - fast and cost-effective

  constructor() {
    // Use local proxy server for development, Azure Function for production
    const isDevelopment = import.meta.env.DEV
    const baseUrl = isDevelopment
      ? 'http://localhost:3008'  // Local proxy server
      : import.meta.env.VITE_APP_URL || window.location.origin

    this.apiUrl = `${baseUrl}/api/chatgpt`

    console.log('🤖 ChatGPT Service initialized')
    console.log('🔍 Development mode:', isDevelopment)
    console.log('🔍 API URL:', this.apiUrl)
    console.log('✅ Using secure proxy server for API key management')
  }

  /**
   * System prompt that defines the chatbot's role and restrictions
   */
  private getSystemPrompt(): string {
    return `You are a helpful assistant for the MedEx healthcare platform. You help users navigate and use the platform features, and can provide insights based on aggregated analytics data.

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
- Use natural language with elegant, well-structured sentences and paragraphs
- Structure information with proper numbered lists (1., 2., 3.) and clear paragraph breaks
- Do NOT use markdown formatting, headers, or bullet points
- Write in a conversational, professional tone with proper punctuation
- Provide actionable insights and recommendations in easy-to-read numbered format
- Keep responses helpful, clear, and easy to understand

When users ask about statistics, patterns, or historical data, provide comprehensive analysis using the available aggregated data while maintaining strict PHI protection.`
  }

  /**
   * Send a message to ChatGPT and get a response
   * In development: Falls back to mock responses when Azure Functions aren't available
   * In production: Uses Azure Function proxy for secure API key management
   */
  async sendMessage(userMessage: string, conversationHistory: ChatGPTMessage[] = []): Promise<ChatGPTResponse> {
    try {
      console.log('🚀 ChatGPT sendMessage called:', {
        message: userMessage,
        historyLength: conversationHistory.length,
        apiUrl: this.apiUrl
      })

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

      // First try the proxy server for real OpenAI responses
      try {
        const proxyResponse = await this.sendToProxyServer(enhancedUserMessage, conversationHistory)
        if (proxyResponse.success) {
          return proxyResponse
        }
        console.log('Proxy server unavailable, using intelligent fallback response')
      } catch (error) {
        console.log('Proxy server error, using intelligent fallback response:', error)
      }

      // Intelligent fallback response when proxy is unavailable
      return {
        success: true,
        message: this.getIntelligentFallbackResponse(userMessage)
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
   * Send message to local proxy server
   */
  private async sendToProxyServer(userMessage: string, conversationHistory: ChatGPTMessage[]): Promise<ChatGPTResponse> {
    // Build the conversation with system prompt
    const messages: ChatGPTMessage[] = [
      { role: 'system', content: this.getSystemPrompt() },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: userMessage }
    ]

    const requestBody = {
      model: this.model,
      messages: messages,
      max_tokens: 1000
    }

    console.log('Sending request to proxy server:', {
      messageCount: messages.length,
      apiUrl: this.apiUrl
    })

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    console.log('Proxy server API Response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Proxy server API error:', response.status, errorData)

      if (response.status === 401) {
        throw new Error('Authentication failed')
      } else if (response.status === 429) {
        return { success: false, error: 'Rate limit exceeded. Please try again in a moment.' }
      } else {
        throw new Error('Service temporarily unavailable')
      }
    }

    const data = await response.json()

    if (data.success && data.message) {
      console.log('ChatGPT response received successfully via proxy server')
      return {
        success: true,
        message: data.message
      }
    }

    throw new Error(data.error || 'No response generated')
  }

  /**
   * Send message to Azure Function proxy
   */
  private async sendToAzureFunction(userMessage: string, conversationHistory: ChatGPTMessage[]): Promise<ChatGPTResponse> {
    // Build the conversation with system prompt
    const messages: ChatGPTMessage[] = [
      { role: 'system', content: this.getSystemPrompt() },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: userMessage }
    ]

    const requestBody = {
      model: this.model,
      messages: messages,
      max_tokens: 1000
    }

    console.log('Sending request to Azure Function proxy:', {
      messageCount: messages.length,
      apiUrl: this.apiUrl
    })

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    console.log('Azure Function API Response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Azure Function API error:', response.status, errorData)

      if (response.status === 401) {
        throw new Error('Authentication failed')
      } else if (response.status === 429) {
        return { success: false, error: 'Rate limit exceeded. Please try again in a moment.' }
      } else {
        throw new Error('Service temporarily unavailable')
      }
    }

    const data = await response.json()

    if (data.success && data.message) {
      console.log('ChatGPT response received successfully via Azure Function')
      return {
        success: true,
        message: data.message
      }
    }

    throw new Error(data.error || 'No response generated')
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
   * Get an intelligent fallback response based on user input
   * This provides helpful responses even when Azure Functions aren't available
   */
  private getIntelligentFallbackResponse(userMessage: string): string {
    const message = userMessage.toLowerCase()

    // Help and getting started
    if (message.includes('help') || message.includes('start') || message.includes('how to')) {
      return `I'm your MedEx Assistant! I can help you with:

**📱 SMS/Chat Features:**
• View and manage SMS conversations
• Add notes to conversations
• Search and filter chats by date or status
• Track SMS costs and usage patterns

**📞 Call Management:**
• View call history and recordings
• Add notes to calls
• Filter calls by date or outcome
• Analyze call patterns and durations

**📊 Analytics & Reports:**
• View usage statistics and patterns
• Track communication costs
• Peak hour analysis
• Daily/weekly activity reports

**⚙️ Platform Features:**
• User management and settings
• Dashboard overview
• Search and filtering tools
• Data export capabilities

What specific area would you like help with?`
    }

    // SMS-related questions
    if (message.includes('sms') || message.includes('chat') || message.includes('message') || message.includes('text')) {
      return `**SMS/Chat Help:**

• **View Conversations:** Go to the SMS page to see all your chat conversations
• **Chat Details:** Click on any chat to view the full conversation and details
• **Add Notes:** Use the notes feature to add important information to conversations
• **Search & Filter:** Use the search bar and date filters to find specific chats
• **Cost Tracking:** Monitor SMS costs and segment usage
• **Export Data:** Export chat reports for analysis

The SMS page also shows metrics like total conversations, costs, and usage patterns. You can filter by date ranges to analyze specific periods.`
    }

    // Call-related questions
    if (message.includes('call') || message.includes('phone') || message.includes('recording')) {
      return `**Call Management Help:**

• **Call History:** Visit the Calls page to see all your call records
• **Listen to Recordings:** Click on calls to access recordings and transcripts
• **Add Call Notes:** Use the notes feature to document important call details
• **Filter Calls:** Use date filters and status filters to find specific calls
• **Call Analytics:** View call duration, costs, and outcome statistics
• **Peak Hours:** Analyze when you receive the most calls

The Calls page provides comprehensive analytics including total calls, average duration, costs, and success rates.`
    }

    // Analytics and statistics
    if (message.includes('stats') || message.includes('data') || message.includes('analytics') ||
        message.includes('report') || message.includes('cost') || message.includes('usage')) {
      return `**Analytics & Reporting Help:**

• **Dashboard:** Get an overview of all your communication metrics
• **Date Ranges:** Filter data by today, week, month, or custom date ranges
• **Cost Analysis:** Track SMS and call costs with detailed breakdowns
• **Usage Patterns:** See peak hours, daily distributions, and trends
• **Export Reports:** Download data for external analysis

**Key Metrics Available:**
• Total calls and SMS conversations
• Average call duration and conversation length
• Cost breakdowns (CAD pricing)
• Peak activity hours
• Daily/weekly distribution patterns
• Success rates and outcomes

Visit the Dashboard or individual pages (SMS/Calls) to see detailed analytics with visual charts and graphs.`
    }

    // Settings and configuration
    if (message.includes('setting') || message.includes('config') || message.includes('profile') ||
        message.includes('account') || message.includes('user')) {
      return `**Settings & Configuration Help:**

• **User Settings:** Manage your profile and account preferences
• **API Configuration:** Set up integrations with external services
• **Notifications:** Configure alert preferences
• **Data Management:** Export, backup, or manage your data
• **Security:** Review security settings and access controls

You can access settings from the main navigation menu. Make sure to save any changes you make to your configuration.`
    }

    // Navigation and general platform use
    if (message.includes('navigate') || message.includes('menu') || message.includes('page') ||
        message.includes('find') || message.includes('where')) {
      return `**Platform Navigation Help:**

**Main Pages:**
• **Dashboard:** Overview of all activities and metrics
• **Calls:** Call history, recordings, and analytics
• **SMS:** Chat conversations and messaging analytics
• **Users:** User management (if you have admin access)
• **Settings:** Platform configuration and preferences

**Common Actions:**
• Use the search bar to find specific items
• Filter data by date ranges or status
• Click on items to view detailed information
• Use the navigation menu to switch between pages
• Look for action buttons (Add, Edit, Export) on each page

The platform is designed to be intuitive - most features are accessible through the main navigation and contextual menus.`
    }

    // Default helpful response
    return `I'm your MedEx Assistant! I can help you with platform navigation, SMS/chat features, call management, analytics, and general platform usage.

**Quick Help:**
• **SMS/Chat:** View conversations, add notes, track costs
• **Calls:** Listen to recordings, manage call history, analyze patterns
• **Analytics:** View usage statistics, costs, and reporting
• **Settings:** Configure your account and platform preferences

**Note:** I have no access to patient data or PHI - I only help with platform features and usage.

What specific area would you like help with? You can ask about features, navigation, or how to accomplish specific tasks.`
  }

  /**
   * Get a safe fallback response when ChatGPT is unavailable
   */
  getFallbackResponse(userMessage: string): string {
    const message = userMessage.toLowerCase()

    // Try to handle analytics questions even in fallback mode
    if (this.isAnalyticsQuestion(userMessage)) {
      return "I can help you analyze your MedEx usage patterns and statistics! I can provide insights about call volumes, peak hours, costs, SMS usage, and more. However, I need the platform's analytics service to be available. Please try asking about specific metrics like 'What time do I get the most calls?' or 'What are my total costs?'"
    }

    if (message.includes('help') || message.includes('how')) {
      return "I'm here to help you navigate the MedEx platform! I can assist with features like SMS management, call handling, notes, settings, usage analytics, and general platform usage. What would you like to know about?"
    }

    if (message.includes('sms') || message.includes('chat')) {
      return "For SMS/Chat features: Use the SMS page to view conversations, click any chat to see details, and add notes for reference. You can also search and filter chats by date or status. I can also analyze your SMS usage patterns and costs!"
    }

    if (message.includes('call')) {
      return "For Call features: Visit the Calls page to see all calls, listen to recordings, and add notes. Use the filters to find specific calls by date or outcome. I can also provide insights about your call patterns and peak hours!"
    }

    if (message.includes('stats') || message.includes('data') || message.includes('analytics')) {
      return "I can help you understand your MedEx usage analytics! Ask me questions like:\n\n• What time do I get the most calls?\n• What are my total communication costs?\n• Which day is busiest for calls?\n• How long are my average calls?\n• What are my SMS usage patterns?\n\nAll analytics are based on aggregated, anonymized data with full PHI protection."
    }

    return "I can help you with platform navigation, SMS/chat features, call management, notes, settings, usage analytics, and general platform usage. What specific area would you like help with?"
  }
}

// Export singleton instance
export const chatgptService = new ChatGPTService()
export default chatgptService