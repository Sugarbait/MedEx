import React from 'react'
import {
  MessageCircleIcon,
  DownloadIcon,
  UserIcon,
  ClockIcon,
  CalendarIcon,
  DollarSignIcon,
  CheckCircleIcon,
  XIcon,
  BotIcon,
  TrendingUpIcon,
  PhoneIcon,
  AlertCircleIcon,
  StopCircleIcon,
  PlayCircleIcon,
  MessageSquareIcon
} from 'lucide-react'
import { Chat } from '@/services/chatService'

interface ChatDetailModalProps {
  chat: Chat
  isOpen: boolean
  onClose: () => void
  onEndChat?: (chatId: string) => void
}

export const ChatDetailModal: React.FC<ChatDetailModalProps> = ({ chat, isOpen, onClose, onEndChat }) => {
  if (!isOpen) return null

  const formatDuration = (startTimestamp: number, endTimestamp?: number) => {
    if (!endTimestamp) return 'Ongoing'

    const durationSeconds = endTimestamp - startTimestamp
    if (durationSeconds < 60) {
      return `${durationSeconds}s`
    } else if (durationSeconds < 3600) {
      const minutes = Math.floor(durationSeconds / 60)
      const seconds = durationSeconds % 60
      return `${minutes}m ${seconds}s`
    } else {
      const hours = Math.floor(durationSeconds / 3600)
      const minutes = Math.floor((durationSeconds % 3600) / 60)
      return `${hours}h ${minutes}m`
    }
  }

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000) // Convert from seconds to milliseconds
    return {
      date: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    }
  }

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-50 border-green-200'
      case 'negative': return 'text-red-600 bg-red-50 border-red-200'
      case 'neutral': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getChatStatusColor = (status: string) => {
    switch (status) {
      case 'ended': return 'text-green-600 bg-green-50'
      case 'ongoing': return 'text-blue-600 bg-blue-50'
      case 'error': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getChatStatusIcon = (status: string) => {
    switch (status) {
      case 'ended': return <CheckCircleIcon className="w-4 h-4" />
      case 'ongoing': return <PlayCircleIcon className="w-4 h-4" />
      case 'error': return <AlertCircleIcon className="w-4 h-4" />
      default: return <ClockIcon className="w-4 h-4" />
    }
  }

  const { date, time } = formatDateTime(chat.start_timestamp)

  // Extract phone number - prioritize analysis data
  const phoneNumber = chat.chat_analysis?.custom_analysis_data?.phone_number ||
                     chat.chat_analysis?.custom_analysis_data?.customer_phone_number ||
                     chat.chat_analysis?.custom_analysis_data?.phone ||
                     chat.chat_analysis?.custom_analysis_data?.contact_number ||
                     chat.metadata?.phone_number ||
                     chat.metadata?.customer_phone_number ||
                     chat.metadata?.from_phone_number ||
                     chat.metadata?.to_phone_number ||
                     chat.collected_dynamic_variables?.phone_number ||
                     chat.collected_dynamic_variables?.customer_phone_number ||
                     'Unknown Number'

  // Extract caller name - prioritize analysis data
  const extractedName = chat.chat_analysis?.custom_analysis_data?.patient_name ||
                       chat.chat_analysis?.custom_analysis_data?.customer_name ||
                       chat.chat_analysis?.custom_analysis_data?.caller_name ||
                       chat.chat_analysis?.custom_analysis_data?.name ||
                       chat.metadata?.patient_name ||
                       chat.metadata?.customer_name ||
                       chat.metadata?.caller_name ||
                       chat.metadata?.name ||
                       chat.collected_dynamic_variables?.patient_name ||
                       chat.collected_dynamic_variables?.customer_name ||
                       chat.collected_dynamic_variables?.name ||
                       null

  const callerName = extractedName || 'Caller'
  const displayName = extractedName ? callerName : `Caller`

  // FIXED: Better transcript validation logic
  const hasTranscript = chat.transcript &&
                       typeof chat.transcript === 'string' &&
                       chat.transcript.trim().length > 0

  // FIXED: Fallback content sources if transcript is empty
  const getTranscriptContent = () => {
    // First try the main transcript field
    if (hasTranscript) {
      return chat.transcript.trim()
    }

    // FALLBACK 1: Try to build transcript from message_with_tool_calls
    if (chat.message_with_tool_calls && chat.message_with_tool_calls.length > 0) {
      const messages = chat.message_with_tool_calls
        .sort((a, b) => a.created_timestamp - b.created_timestamp)
        .map(msg => {
          const role = msg.role === 'agent' ? 'Agent' : 'User'
          return `${role}: ${msg.content}`
        })

      if (messages.length > 0) {
        return messages.join('\n\n')
      }
    }

    // FALLBACK 2: Try chat summary if available
    if (chat.chat_analysis?.chat_summary) {
      return `Conversation Summary:\n\n${chat.chat_analysis.chat_summary}`
    }

    return null
  }

  const transcriptContent = getTranscriptContent()
  const shouldShowTranscriptSection = Boolean(transcriptContent)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              chat.chat_status === 'ongoing' ? 'bg-blue-100' :
              chat.chat_status === 'ended' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {chat.chat_status === 'ongoing' ?
                <BotIcon className="w-6 h-6 text-blue-600" /> :
                chat.chat_status === 'ended' ?
                <MessageCircleIcon className="w-6 h-6 text-green-600" /> :
                <AlertCircleIcon className="w-6 h-6 text-red-600" />
              }
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {callerName}
              </h2>
              <div className="text-sm text-gray-600 mb-2">
                <PhoneIcon className="w-4 h-4 inline mr-1" />
                {phoneNumber}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Chat ID: {chat.chat_id}</span>
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4" />
                  {date} at {time}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {chat.chat_status === 'ongoing' && onEndChat && (
              <button
                onClick={() => {
                  onEndChat(chat.chat_id)
                  onClose()
                }}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <StopCircleIcon className="w-4 h-4" />
                End Chat
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ClockIcon className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">Duration</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatDuration(chat.start_timestamp, chat.end_timestamp)}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUpIcon className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">Status</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getChatStatusColor(chat.chat_status)}`}>
                    {getChatStatusIcon(chat.chat_status)}
                    {chat.chat_status}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquareIcon className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-900">Messages</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {chat.message_with_tool_calls?.length || 0}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSignIcon className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-900">Cost</span>
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  ${(chat.chat_cost?.total_cost || 0).toFixed(3)}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Chat Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Caller Name</label>
                  <p className="text-gray-900">{callerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Phone Number</label>
                  <p className="text-gray-900">{phoneNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Agent ID</label>
                  <p className="text-gray-900">{chat.agent_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Success Status</label>
                  <p className={`font-medium ${
                    chat.chat_analysis?.chat_successful ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {chat.chat_analysis?.chat_successful ? 'Successful' : 'Unsuccessful'}
                  </p>
                </div>
              </div>
            </div>

            {/* FIXED: Chat Transcript - Enhanced with fallbacks */}
            {shouldShowTranscriptSection ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Chat Transcript
                  {!hasTranscript && (
                    <span className="text-sm font-normal text-blue-600 ml-2">
                      (Reconstructed from messages)
                    </span>
                  )}
                </h3>
                <div className="bg-white rounded border p-4 max-h-96 overflow-y-auto">
                  {(() => {
                    const transcript = transcriptContent!

                    // Check if transcript has User:/Agent: format
                    const hasUserAgentFormat = /^(User:|Agent:)/m.test(transcript)

                    if (hasUserAgentFormat) {
                      // Split by lines and format each message
                      const lines = transcript.split('\n').filter(line => line.trim())
                      const messages: Array<{role: string, content: string, time?: string}> = []
                      let currentMessage: {role: string, content: string, time?: string} | null = null

                      lines.forEach(line => {
                        const trimmedLine = line.trim()

                        // Check if line starts with User: or Agent:
                        if (trimmedLine.startsWith('User:')) {
                          if (currentMessage) messages.push(currentMessage)
                          currentMessage = { role: 'User', content: trimmedLine.substring(5).trim() }
                        } else if (trimmedLine.startsWith('Agent:')) {
                          if (currentMessage) messages.push(currentMessage)
                          currentMessage = { role: 'Agent', content: trimmedLine.substring(6).trim() }
                        } else if (currentMessage) {
                          // Check if this is a timestamp line (format: HH:MM:SS, MM/DD)
                          const timestampMatch = trimmedLine.match(/^(\d{2}:\d{2}:\d{2}),\s*(\d{2}\/\d{2})$/)
                          if (timestampMatch) {
                            currentMessage.time = trimmedLine
                          } else {
                            // Continue the previous message
                            currentMessage.content += ' ' + trimmedLine
                          }
                        }
                      })

                      if (currentMessage) messages.push(currentMessage)

                      return (
                        <div className="space-y-4">
                          {messages.map((msg, index) => (
                            <div key={index} className="border-l-4 border-blue-400 pl-4">
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className={`font-semibold ${
                                  msg.role === 'Agent' ? 'text-blue-600' : 'text-green-600'
                                }`}>
                                  {msg.role}:
                                </span>
                                {msg.time && (
                                  <span className="text-xs text-gray-500">{msg.time}</span>
                                )}
                              </div>
                              <p className="text-gray-800 leading-relaxed">{msg.content}</p>
                            </div>
                          ))}
                        </div>
                      )
                    } else {
                      // Default display for other formats
                      return (
                        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{transcript}</p>
                      )
                    }
                  })()}
                </div>
              </div>
            ) : (
              // FIXED: Show a clear message when no transcript is available
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Chat Transcript</h3>
                <div className="bg-white rounded border p-4 text-center py-8">
                  <MessageCircleIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No conversation transcript available</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {chat.chat_status === 'ongoing'
                      ? 'This chat is still ongoing. Transcript will be available after completion.'
                      : 'No transcript was generated for this conversation.'
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Post Chat Analysis */}
            {chat.chat_analysis && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Post Chat Analysis</h3>
                <div className="space-y-4">

                  {/* Analysis Summary Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Chat Success Status */}
                    <div className="bg-white rounded-lg p-4 border">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircleIcon className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium text-gray-900">Chat Success</span>
                      </div>
                      <div className={`text-lg font-semibold ${
                        chat.chat_analysis.chat_successful ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {chat.chat_analysis.chat_successful ? 'Successful' : 'Unsuccessful'}
                      </div>
                    </div>

                    {/* User Sentiment */}
                    {chat.chat_analysis.user_sentiment && (
                      <div className="bg-white rounded-lg p-4 border">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUpIcon className="w-5 h-5 text-purple-600" />
                          <span className="text-sm font-medium text-gray-900">User Sentiment</span>
                        </div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getSentimentColor(chat.chat_analysis.user_sentiment)}`}>
                          {chat.chat_analysis.user_sentiment}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Chat Summary */}
                  {chat.chat_analysis.chat_summary && (
                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="text-md font-semibold text-gray-900 mb-2">Conversation Summary</h4>
                      <p className="text-gray-700 leading-relaxed">{chat.chat_analysis.chat_summary}</p>
                    </div>
                  )}

                  {/* Custom Analysis Data */}
                  {chat.chat_analysis.custom_analysis_data && Object.keys(chat.chat_analysis.custom_analysis_data).length > 0 && (
                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="text-md font-semibold text-gray-900 mb-3">Detailed Analysis</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(chat.chat_analysis.custom_analysis_data).map(([key, value]) => (
                          <div key={key} className="border-l-4 border-blue-500 pl-3">
                            <label className="text-sm font-medium text-gray-700 capitalize">
                              {key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
                            </label>
                            <p className="text-gray-900 text-sm mt-1">
                              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dynamic Variables */}
            {(chat.collected_dynamic_variables && Object.keys(chat.collected_dynamic_variables).length > 0) && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Collected Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(chat.collected_dynamic_variables).map(([key, value]) => (
                    <div key={key}>
                      <label className="text-sm font-medium text-gray-700 capitalize">
                        {key.replace(/_/g, ' ')}
                      </label>
                      <p className="text-gray-900">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Message Thread */}
            {chat.message_with_tool_calls && chat.message_with_tool_calls.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Message Thread</h3>
                <div className="bg-white rounded border p-4 max-h-64 overflow-y-auto">
                  <div className="space-y-3">
                    {chat.message_with_tool_calls.map((message, index) => (
                      <div key={message.message_id || index} className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          message.role === 'agent' ? 'bg-blue-100' : 'bg-green-100'
                        }`}>
                          {message.role === 'agent' ?
                            <BotIcon className="w-4 h-4 text-blue-600" /> :
                            <UserIcon className="w-4 h-4 text-green-600" />
                          }
                        </div>
                        <div className="flex-1">
                          <div className={`text-xs font-medium mb-1 ${
                            message.role === 'agent' ? 'text-blue-700' : 'text-green-700'
                          }`}>
                            {message.role === 'agent' ? 'AI Assistant' : 'Patient'}
                          </div>
                          <p className="text-gray-800 leading-relaxed">{message.content}</p>
                          {message.tool_calls && message.tool_calls.length > 0 && (
                            <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                              <span className="font-medium">Tool calls:</span>
                              {message.tool_calls.map((tool, toolIndex) => (
                                <div key={toolIndex} className="ml-2">
                                  {tool.function?.name || tool.type}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Cost Breakdown */}
            {chat.chat_cost && chat.chat_cost.product_costs && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Cost Breakdown</h3>
                <div className="space-y-2">
                  {Object.entries(chat.chat_cost.product_costs).map(([product, cost]) => (
                    <div key={product} className="flex justify-between items-center">
                      <span className="text-sm text-gray-700 capitalize">
                        {product.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        ${(typeof cost === 'number' ? cost : 0).toFixed(3)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between items-center font-medium">
                    <span className="text-gray-900">Total</span>
                    <span className="text-gray-900">${(chat.chat_cost?.total_cost || 0).toFixed(3)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                <DownloadIcon className="w-4 h-4" />
                Export Chat
              </button>
              <div className="ml-auto flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600 font-medium">HIPAA Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}