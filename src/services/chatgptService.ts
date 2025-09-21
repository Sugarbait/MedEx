/**
 * ChatGPT API Service for Site Help Chatbot
 *
 * SECURITY NOTICE: This service is designed for general site help only.
 * NO PHI (Protected Health Information) data should ever be sent to this service.
 * This service is isolated from all patient data and healthcare information.
 */

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
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || ''

    // Debug: Check if API key is loaded
    console.log('ChatGPT Service initialized')
    console.log('API Key loaded:', this.apiKey ? `Yes (${this.apiKey.substring(0, 10)}...)` : 'No')

    if (!this.apiKey) {
      console.error('❌ ChatGPT API key not configured. Please add VITE_OPENAI_API_KEY to .env.local file')
    } else {
      console.log('✅ ChatGPT API key loaded successfully')
    }
  }

  /**
   * System prompt that defines the chatbot's role and restrictions
   */
  private getSystemPrompt(): string {
    return `You are a helpful assistant for the CareXPS healthcare platform. You help users navigate and use the platform features.

CRITICAL SECURITY RESTRICTIONS:
- You have NO access to any patient data, PHI (Protected Health Information), or healthcare records
- You cannot and must not discuss specific patients, medical records, or any healthcare data
- You can only help with platform navigation, features, and general usage questions
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

Keep responses helpful, concise, and focused on platform usage. Always maintain a professional, supportive tone.`
  }

  /**
   * Send a message to ChatGPT and get a response
   * This method ensures no PHI data is sent by design
   */
  async sendMessage(userMessage: string, conversationHistory: ChatGPTMessage[] = []): Promise<ChatGPTResponse> {
    try {
      // Check if API key is configured
      if (!this.apiKey) {
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

      // Build the conversation with system prompt
      const messages: ChatGPTMessage[] = [
        { role: 'system', content: this.getSystemPrompt() },
        ...conversationHistory.slice(-10), // Keep last 10 messages for context
        { role: 'user', content: userMessage }
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
        max_tokens: 500, // Limit response length
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
   * Get a safe fallback response when ChatGPT is unavailable
   */
  getFallbackResponse(userMessage: string): string {
    const message = userMessage.toLowerCase()

    if (message.includes('help') || message.includes('how')) {
      return "I'm here to help you navigate the CareXPS platform! I can assist with features like SMS management, call handling, notes, settings, and general platform usage. What would you like to know about?"
    }

    if (message.includes('sms') || message.includes('chat')) {
      return "For SMS/Chat features: Use the SMS page to view conversations, click any chat to see details, and add notes for reference. You can also search and filter chats by date or status."
    }

    if (message.includes('call')) {
      return "For Call features: Visit the Calls page to see all calls, listen to recordings, and add notes. Use the filters to find specific calls by date or outcome."
    }

    return "I can help you with platform navigation, SMS/chat features, call management, notes, settings, and general platform usage. What specific area would you like help with?"
  }
}

// Export singleton instance
export const chatgptService = new ChatGPTService()
export default chatgptService