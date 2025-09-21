/**
 * Site Help Chatbot Component
 *
 * Provides assistance with using the site and answering general questions.
 * IMPORTANT: This chatbot has NO access to PHI data and cannot access any patient information.
 * It only provides help with site navigation, features, and general support.
 */

import React, { useState, useRef, useEffect } from 'react'
import {
  MessageCircleIcon,
  SendIcon,
  MinimizeIcon,
  XIcon,
  BotIcon,
  UserIcon
} from 'lucide-react'
import { chatgptService, type ChatGPTMessage } from '@/services/chatgptService'

interface ChatMessage {
  id: string
  type: 'user' | 'bot'
  content: string
  timestamp: Date
}

interface SiteHelpChatbotProps {
  isVisible?: boolean
  onToggle?: () => void
}

export const SiteHelpChatbot: React.FC<SiteHelpChatbotProps> = ({
  isVisible = false,
  onToggle
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'bot',
      content: 'Hello! I\'m your CareXPS Assistant powered by ChatGPT. I can help you navigate the platform, understand features, and answer questions about using the system. I have NO access to any patient data or PHI - I only know about platform features and functionality. How can I help you today?',
      timestamp: new Date()
    }
  ])
  const [conversationHistory, setConversationHistory] = useState<ChatGPTMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const generateBotResponse = async (userMessage: string): Promise<string> => {
    try {
      console.log('Generating response with ChatGPT (NO PHI data):', userMessage)

      const response = await chatgptService.sendMessage(userMessage, conversationHistory)

      if (response.success && response.message) {
        // Update conversation history for context
        setConversationHistory(prev => [
          ...prev,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: response.message! }
        ].slice(-20)) // Keep last 20 messages for context

        return response.message
      } else {
        console.warn('ChatGPT service error, using fallback:', response.error)
        return chatgptService.getFallbackResponse(userMessage)
      }
    } catch (error) {
      console.error('Error generating response:', error)
      return chatgptService.getFallbackResponse(userMessage)
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    const currentMessage = inputMessage
    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsTyping(true)

    try {
      // Get response from ChatGPT
      const botResponseContent = await generateBotResponse(currentMessage)

      const botResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: botResponseContent,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, botResponse])
    } catch (error) {
      console.error('Error in handleSendMessage:', error)

      const errorResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: 'I apologize, but I\'m having trouble responding right now. Please try again in a moment.',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorResponse])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        type: 'bot',
        content: 'Chat cleared! I\'m your CareXPS Assistant powered by ChatGPT. I can help you navigate the platform, understand features, and answer questions about using the system. I have NO access to any patient data or PHI. How can I help you today?',
        timestamp: new Date()
      }
    ])
    setConversationHistory([]) // Clear ChatGPT conversation history too
  }

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 z-50 group"
        title="Get Help"
      >
        <MessageCircleIcon className="w-5 h-5" />
        <div className="absolute -top-10 right-0 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Need help? Click to chat!
        </div>
      </button>
    )
  }

  return (
    <div className={`fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-xl z-50 transition-all duration-200 ${
      isMinimized ? 'w-80 h-12' : 'w-80 h-[500px]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-blue-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <img
            src="https://nexasync.ca/images/favixps.png"
            alt="CareXPS"
            className="w-6 h-6"
            onError={(e) => {
              // Fallback to a simple colored dot if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = document.createElement('div');
              fallback.className = 'w-6 h-6 bg-blue-600 rounded-full';
              target.parentNode?.insertBefore(fallback, target);
            }}
          />
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">CareXPS Assistant</h3>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            <MinimizeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Close chat"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="h-80 overflow-y-auto p-3 space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-2 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  message.type === 'user' ? 'bg-blue-600' : 'bg-gray-400'
                }`}>
                  {message.type === 'user' ? (
                    <UserIcon className="w-3 h-3 text-white" />
                  ) : (
                    <img
                      src="https://nexasync.ca/images/favixps.png"
                      alt="CareXPS"
                      className="w-3 h-3"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const icon = document.createElement('div');
                        icon.innerHTML = '🤖';
                        icon.className = 'text-xs';
                        target.parentNode?.appendChild(icon);
                      }}
                    />
                  )}
                </div>
                <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white ml-auto'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <div className="whitespace-pre-line">{message.content}</div>
                  <div className={`text-xs mt-1 ${
                    message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-2">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center">
                  <img
                    src="https://nexasync.ca/images/favixps.png"
                    alt="CareXPS"
                    className="w-3 h-3"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const icon = document.createElement('div');
                      icon.innerHTML = '🤖';
                      icon.className = 'text-xs';
                      target.parentNode?.appendChild(icon);
                    }}
                  />
                </div>
                <div className="bg-gray-100 px-3 py-2 rounded-lg text-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200">
            <div className="flex gap-2 mb-2">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about site features..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                disabled={isTyping}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isTyping}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <SendIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-between items-center">
              <button
                onClick={clearChat}
                className="text-xs text-blue-600 hover:text-blue-700 transition-colors font-medium"
              >
                Clear chat
              </button>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-500">No PHI access • Secure</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}