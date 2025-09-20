import React, { useState, useEffect } from 'react'
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
  MessageSquareIcon,
  RefreshCwIcon
} from 'lucide-react'
import { Chat, chatService } from '@/services/chatService'
import jsPDF from 'jspdf'

interface ChatDetailModalProps {
  chat: Chat
  isOpen: boolean
  onClose: () => void
  onEndChat?: (chatId: string) => void
}

export const ChatDetailModal: React.FC<ChatDetailModalProps> = ({ chat, isOpen, onClose, onEndChat }) => {
  const [fullChat, setFullChat] = useState<Chat | null>(null)
  const [loadingFullTranscript, setLoadingFullTranscript] = useState(false)
  const [transcriptError, setTranscriptError] = useState<string | null>(null)

  // Load full chat details when modal opens
  useEffect(() => {
    if (isOpen && chat?.chat_id) {
      loadFullChatDetails()
    }
  }, [isOpen, chat?.chat_id])

  const loadFullChatDetails = async () => {
    if (!chat?.chat_id) return

    setLoadingFullTranscript(true)
    setTranscriptError(null)

    try {
      console.log('Loading full chat details for:', chat.chat_id)
      const fullChatDetails = await chatService.getChatById(chat.chat_id)
      console.log('Full chat details loaded:', fullChatDetails)
      setFullChat(fullChatDetails)
    } catch (error) {
      console.error('Failed to load full chat details:', error)
      setTranscriptError('Failed to load full transcript. Using available data.')
      // Fallback to original chat data
      setFullChat(chat)
    } finally {
      setLoadingFullTranscript(false)
    }
  }

  const exportToPDF = () => {
    const doc = new jsPDF()
    let yPosition = 20
    const pageWidth = doc.internal.pageSize.width
    const margin = 20
    const lineHeight = 6
    const maxWidth = pageWidth - (margin * 2)

    // Helper function to add text with word wrapping
    const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 12) => {
      doc.setFontSize(fontSize)
      const lines = doc.splitTextToSize(text, maxWidth)
      doc.text(lines, x, y)
      return y + (lines.length * lineHeight)
    }

    // Helper function to check if we need a new page
    const checkNewPage = (yPos: number, requiredSpace: number = 20) => {
      if (yPos + requiredSpace > doc.internal.pageSize.height - 20) {
        doc.addPage()
        return 20
      }
      return yPos
    }

    try {
      // Title
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('Chat Analysis Report', margin, yPosition)
      yPosition += 15

      // Chat Information Header
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Chat Information', margin, yPosition)
      yPosition += 10

      // Basic chat info
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      const { date, time } = formatDateTime(displayChat.start_timestamp)

      yPosition = addWrappedText(`Chat ID: ${displayChat.chat_id}`, margin, yPosition, maxWidth, 11)
      yPosition = addWrappedText(`Date: ${date} at ${time}`, margin, yPosition, maxWidth, 11)
      yPosition = addWrappedText(`Caller: ${callerName}`, margin, yPosition, maxWidth, 11)
      yPosition = addWrappedText(`Phone: ${phoneNumber}`, margin, yPosition, maxWidth, 11)
      yPosition = addWrappedText(`Status: ${displayChat.chat_status}`, margin, yPosition, maxWidth, 11)
      yPosition = addWrappedText(`Duration: ${formatDuration(displayChat.start_timestamp, displayChat.end_timestamp)}`, margin, yPosition, maxWidth, 11)
      yPosition = addWrappedText(`Cost: $${(displayChat.chat_cost?.total_cost || 0).toFixed(3)}`, margin, yPosition, maxWidth, 11)
      yPosition += 10

      // Post Chat Analysis
      if (displayChat.chat_analysis) {
        yPosition = checkNewPage(yPosition, 30)

        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Post Chat Analysis', margin, yPosition)
        yPosition += 10

        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')

        // Chat Success
        yPosition = addWrappedText(`Success Status: ${displayChat.chat_analysis.chat_successful ? 'Successful' : 'Unsuccessful'}`, margin, yPosition, maxWidth, 11)

        // User Sentiment
        if (displayChat.chat_analysis.user_sentiment) {
          yPosition = addWrappedText(`User Sentiment: ${displayChat.chat_analysis.user_sentiment}`, margin, yPosition, maxWidth, 11)
        }

        yPosition += 5

        // Chat Summary
        if (displayChat.chat_analysis.chat_summary) {
          yPosition = checkNewPage(yPosition, 30)

          doc.setFontSize(12)
          doc.setFont('helvetica', 'bold')
          doc.text('Conversation Summary:', margin, yPosition)
          yPosition += 8

          doc.setFont('helvetica', 'normal')
          yPosition = addWrappedText(displayChat.chat_analysis.chat_summary, margin, yPosition, maxWidth, 11)
          yPosition += 10
        }

        // Custom Analysis Data
        if (displayChat.chat_analysis.custom_analysis_data && Object.keys(displayChat.chat_analysis.custom_analysis_data).length > 0) {
          yPosition = checkNewPage(yPosition, 30)

          doc.setFontSize(12)
          doc.setFont('helvetica', 'bold')
          doc.text('Detailed Analysis:', margin, yPosition)
          yPosition += 8

          doc.setFont('helvetica', 'normal')
          Object.entries(displayChat.chat_analysis.custom_analysis_data).forEach(([key, value]) => {
            yPosition = checkNewPage(yPosition, 15)
            const formattedKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
            const formattedValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)

            doc.setFont('helvetica', 'bold')
            yPosition = addWrappedText(`${formattedKey}:`, margin, yPosition, maxWidth, 11)
            doc.setFont('helvetica', 'normal')
            yPosition = addWrappedText(formattedValue, margin + 10, yPosition, maxWidth - 10, 11)
            yPosition += 3
          })
          yPosition += 5
        }
      }

      // Message Thread
      if (displayChat.message_with_tool_calls && displayChat.message_with_tool_calls.length > 0) {
        yPosition = checkNewPage(yPosition, 40)

        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Message Thread', margin, yPosition)
        yPosition += 10

        displayChat.message_with_tool_calls.forEach((message, index) => {
          yPosition = checkNewPage(yPosition, 25)

          // Message header
          doc.setFontSize(11)
          doc.setFont('helvetica', 'bold')
          const sender = message.role === 'agent' ? 'AI Assistant' : 'Patient'
          yPosition = addWrappedText(`${sender}:`, margin, yPosition, maxWidth, 11)

          // Message content
          doc.setFont('helvetica', 'normal')
          yPosition = addWrappedText(message.content, margin + 10, yPosition, maxWidth - 10, 11)

          // Tool calls if any
          if (message.tool_calls && message.tool_calls.length > 0) {
            yPosition += 3
            doc.setFont('helvetica', 'italic')
            const toolCallsText = `Tool calls: ${message.tool_calls.map(tool => tool.function?.name || tool.type).join(', ')}`
            yPosition = addWrappedText(toolCallsText, margin + 10, yPosition, maxWidth - 10, 10)
          }

          yPosition += 8
        })
      }

      // Dynamic Variables
      if (displayChat.collected_dynamic_variables && Object.keys(displayChat.collected_dynamic_variables).length > 0) {
        yPosition = checkNewPage(yPosition, 30)

        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Collected Information', margin, yPosition)
        yPosition += 10

        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        Object.entries(displayChat.collected_dynamic_variables).forEach(([key, value]) => {
          yPosition = checkNewPage(yPosition, 15)
          const formattedKey = key.replace(/_/g, ' ')
          yPosition = addWrappedText(`${formattedKey}: ${String(value)}`, margin, yPosition, maxWidth, 11)
        })
        yPosition += 10
      }

      // Cost Breakdown
      if (displayChat.chat_cost && displayChat.chat_cost.product_costs) {
        yPosition = checkNewPage(yPosition, 30)

        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Cost Breakdown', margin, yPosition)
        yPosition += 10

        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        Object.entries(displayChat.chat_cost.product_costs).forEach(([product, cost]) => {
          yPosition = checkNewPage(yPosition, 10)
          const formattedProduct = product.replace(/_/g, ' ')
          const costValue = typeof cost === 'number' ? cost : 0
          yPosition = addWrappedText(`${formattedProduct}: $${costValue.toFixed(3)}`, margin, yPosition, maxWidth, 11)
        })

        yPosition += 5
        doc.setFont('helvetica', 'bold')
        yPosition = addWrappedText(`Total: $${(displayChat.chat_cost?.total_cost || 0).toFixed(3)}`, margin, yPosition, maxWidth, 11)
      }

      // Footer
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text(`Generated by CareXPS CRM - Page ${i} of ${pageCount}`, margin, doc.internal.pageSize.height - 10)
        doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth - margin - 60, doc.internal.pageSize.height - 10)
      }

      // Save the PDF
      const filename = `chat-analysis-${displayChat.chat_id}-${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(filename)

    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  if (!isOpen) return null

  // Use full chat data if available, otherwise fall back to original
  const displayChat = fullChat || chat

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

  const { date, time } = formatDateTime(displayChat.start_timestamp)

  // Extract phone number - prioritize analysis data
  const phoneNumber = displayChat.chat_analysis?.custom_analysis_data?.phone_number ||
                     displayChat.chat_analysis?.custom_analysis_data?.customer_phone_number ||
                     displayChat.chat_analysis?.custom_analysis_data?.phone ||
                     displayChat.chat_analysis?.custom_analysis_data?.contact_number ||
                     displayChat.metadata?.phone_number ||
                     displayChat.metadata?.customer_phone_number ||
                     displayChat.metadata?.from_phone_number ||
                     displayChat.metadata?.to_phone_number ||
                     displayChat.collected_dynamic_variables?.phone_number ||
                     displayChat.collected_dynamic_variables?.customer_phone_number ||
                     'Unknown Number'

  // Extract caller name - prioritize analysis data
  const extractedName = displayChat.chat_analysis?.custom_analysis_data?.patient_name ||
                       displayChat.chat_analysis?.custom_analysis_data?.customer_name ||
                       displayChat.chat_analysis?.custom_analysis_data?.caller_name ||
                       displayChat.chat_analysis?.custom_analysis_data?.name ||
                       displayChat.metadata?.patient_name ||
                       displayChat.metadata?.customer_name ||
                       displayChat.metadata?.caller_name ||
                       displayChat.metadata?.name ||
                       displayChat.collected_dynamic_variables?.patient_name ||
                       displayChat.collected_dynamic_variables?.customer_name ||
                       displayChat.collected_dynamic_variables?.name ||
                       null

  const callerName = extractedName || 'Caller'
  const displayName = extractedName ? callerName : `Caller`

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              displayChat.chat_status === 'ongoing' ? 'bg-blue-100' :
              displayChat.chat_status === 'ended' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {displayChat.chat_status === 'ongoing' ?
                <BotIcon className="w-6 h-6 text-blue-600" /> :
                displayChat.chat_status === 'ended' ?
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
                <span>Chat ID: {displayChat.chat_id}</span>
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4" />
                  {date} at {time}
                </span>
                {loadingFullTranscript && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <RefreshCwIcon className="w-3 h-3 animate-spin" />
                    Loading full transcript...
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadFullChatDetails}
              disabled={loadingFullTranscript}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Refresh full transcript"
            >
              <RefreshCwIcon className={`w-4 h-4 ${loadingFullTranscript ? 'animate-spin' : ''}`} />
              Refresh
            </button>
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
                  {formatDuration(displayChat.start_timestamp, displayChat.end_timestamp)}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUpIcon className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">Status</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getChatStatusColor(displayChat.chat_status)}`}>
                    {getChatStatusIcon(displayChat.chat_status)}
                    {displayChat.chat_status}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquareIcon className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-900">Messages</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {displayChat.message_with_tool_calls?.length || 0}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSignIcon className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-900">Cost</span>
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  ${(displayChat.chat_cost?.total_cost || 0).toFixed(3)}
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
                  <p className="text-gray-900">{displayChat.agent_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Success Status</label>
                  <p className={`font-medium ${
                    displayChat.chat_analysis?.chat_successful ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {displayChat.chat_analysis?.chat_successful ? 'Successful' : 'Unsuccessful'}
                  </p>
                </div>
              </div>
            </div>


            {/* Post Chat Analysis */}
            {displayChat.chat_analysis && (
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
                        displayChat.chat_analysis.chat_successful ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {displayChat.chat_analysis.chat_successful ? 'Successful' : 'Unsuccessful'}
                      </div>
                    </div>

                    {/* User Sentiment */}
                    {displayChat.chat_analysis.user_sentiment && (
                      <div className="bg-white rounded-lg p-4 border">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUpIcon className="w-5 h-5 text-purple-600" />
                          <span className="text-sm font-medium text-gray-900">User Sentiment</span>
                        </div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getSentimentColor(displayChat.chat_analysis.user_sentiment)}`}>
                          {displayChat.chat_analysis.user_sentiment}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Chat Summary */}
                  {displayChat.chat_analysis.chat_summary && (
                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="text-md font-semibold text-gray-900 mb-2">Conversation Summary</h4>
                      <p className="text-gray-700 leading-relaxed">{displayChat.chat_analysis.chat_summary}</p>
                    </div>
                  )}

                  {/* Custom Analysis Data */}
                  {displayChat.chat_analysis.custom_analysis_data && Object.keys(displayChat.chat_analysis.custom_analysis_data).length > 0 && (
                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="text-md font-semibold text-gray-900 mb-3">Detailed Analysis</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(displayChat.chat_analysis.custom_analysis_data).map(([key, value]) => (
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
            {(displayChat.collected_dynamic_variables && Object.keys(displayChat.collected_dynamic_variables).length > 0) && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Collected Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(displayChat.collected_dynamic_variables).map(([key, value]) => (
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
            {displayChat.message_with_tool_calls && displayChat.message_with_tool_calls.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Message Thread</h3>
                <div className="bg-white rounded border p-4 max-h-64 overflow-y-auto">
                  <div className="space-y-3">
                    {displayChat.message_with_tool_calls.map((message, index) => (
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
            {displayChat.chat_cost && displayChat.chat_cost.product_costs && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Cost Breakdown</h3>
                <div className="space-y-2">
                  {Object.entries(displayChat.chat_cost.product_costs).map(([product, cost]) => (
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
                    <span className="text-gray-900">${(displayChat.chat_cost?.total_cost || 0).toFixed(3)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
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