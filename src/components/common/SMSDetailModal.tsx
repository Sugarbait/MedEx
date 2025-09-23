import React, { useState, useEffect } from 'react'
import {
  MessageSquareIcon,
  SendIcon,
  UserIcon,
  ClockIcon,
  CalendarIcon,
  DollarSignIcon,
  CheckCircleIcon,
  XIcon,
  PhoneIcon,
  DownloadIcon,
  TrendingUpIcon,
  AlertCircleIcon,
  IdCardIcon
} from 'lucide-react'
import { EnhancedChatNotes } from '@/components/common/EnhancedChatNotes'
import { twilioCostService } from '@/services/twilioCostService'
import { patientIdService } from '@/services/patientIdService'

interface SMSDetailModalProps {
  message: {
    message_id: string
    patient_id: string
    phone_number: string
    message_content: string
    direction: 'inbound' | 'outbound'
    status: string
    timestamp: string
    cost?: number
    sentiment_analysis?: {
      overall_sentiment: 'positive' | 'negative' | 'neutral'
      confidence_score: number
    }
    metadata?: {
      patient_name?: string
      message_type?: string
      chat_id?: string
      user_id?: string
      [key: string]: any
    }
  }
  isOpen: boolean
  onClose: () => void
}

export const SMSDetailModal: React.FC<SMSDetailModalProps> = ({ message, isOpen, onClose }) => {
  const [generatedPatientId, setGeneratedPatientId] = useState<string>('')
  const [patientRecord, setPatientRecord] = useState<any>(null)

  // Generate Patient ID based on phone number when modal opens
  useEffect(() => {
    console.log('SMS Modal useEffect triggered:', { isOpen, hasPhone: !!message.phone_number })
    if (isOpen && message.phone_number) {
      const patientId = patientIdService.getPatientId(message.phone_number)
      const record = patientIdService.getPatientRecord(message.phone_number)
      setGeneratedPatientId(patientId)
      setPatientRecord(record)
      console.log(`SMS Modal: Generated Patient ID ${patientId} for phone [REDACTED]`)
    } else {
      console.log('SMS Modal: Conditions not met for Patient ID generation:', { isOpen, hasPhone: !!message.phone_number })
    }
  }, [isOpen, message.phone_number])

  if (!isOpen) return null

  const formatDateTime = (timestamp: string) => {
    try {
      let date: Date

      // First, check if it's already an ISO string or a valid date string
      if (isNaN(Number(timestamp)) || timestamp.includes('-') || timestamp.includes('T')) {
        date = new Date(timestamp)
      } else {
        // It's a numeric timestamp - determine if it's seconds or milliseconds
        const numericTimestamp = parseInt(timestamp)

        // Timestamps in milliseconds are typically 13 digits (e.g., 1672531200000)
        // Timestamps in seconds are typically 10 digits (e.g., 1672531200)
        // We'll use a more reliable approach: check if the value represents a reasonable date

        // Try as milliseconds first
        let testDate = new Date(numericTimestamp)

        // If the date is invalid or before year 1980 or after year 2100, try as seconds
        if (isNaN(testDate.getTime()) ||
            testDate.getFullYear() < 1980 ||
            testDate.getFullYear() > 2100) {
          // Try multiplying by 1000 (convert seconds to milliseconds)
          testDate = new Date(numericTimestamp * 1000)
        }

        // Final validation - if still invalid or unreasonable, default to current time
        if (isNaN(testDate.getTime()) ||
            testDate.getFullYear() < 1980 ||
            testDate.getFullYear() > 2100) {
          console.warn('Invalid timestamp detected:', timestamp)
          date = new Date() // Use current time as fallback
        } else {
          date = testDate
        }
      }

      // Final validation
      if (isNaN(date.getTime())) {
        return {
          date: 'Invalid Date',
          time: 'Invalid Time',
          relative: 'Unknown'
        }
      }

      // Format with proper options for better display
      const dateOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }

      const timeOptions: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }

      return {
        date: date.toLocaleDateString('en-US', dateOptions),
        time: date.toLocaleTimeString('en-US', timeOptions),
        relative: getRelativeTime(date)
      }
    } catch (error) {
      console.error('Error formatting timestamp:', timestamp, error)
      return {
        date: 'Invalid Date',
        time: 'Invalid Time',
        relative: 'Unknown'
      }
    }
  }

  const getRelativeTime = (date: Date) => {
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60)
      return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours)
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
    } else {
      const days = Math.floor(diffInHours / 24)
      return `${days} ${days === 1 ? 'day' : 'days'} ago`
    }
  }

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-50 border-green-200'
      case 'negative': return 'text-red-600 bg-red-50 border-red-200'
      case 'neutral': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-700'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-green-600 bg-green-50'
      case 'sent': return 'text-blue-600 bg-blue-50'
      case 'failed': return 'text-red-600 bg-red-50'
      case 'pending': return 'text-yellow-600 bg-yellow-50'
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700'
    }
  }

  const getDirectionIcon = () => {
    return message.direction === 'inbound' ? (
      <UserIcon className="w-6 h-6 text-green-600" />
    ) : (
      <SendIcon className="w-6 h-6 text-blue-600" />
    )
  }

  const getDirectionColor = () => {
    return message.direction === 'inbound' ? 'bg-green-100' : 'bg-blue-100'
  }

  const { date, time, relative } = formatDateTime(message.timestamp)
  const messageLength = message.message_content.length

  // Use the updated Twilio cost service for SMS segment calculation
  // This properly excludes role indicators and uses 160 chars per segment
  // Fixed: Use the new combined calculation method for accurate segments
  const smsDebugInfo = twilioCostService.debugSMSCalculation([{ content: message.message_content }])
  const smsSegments = smsDebugInfo.totalSegmentsCombined || smsDebugInfo.totalSegments
  const cleanContent = smsDebugInfo.combinedCleanContent || smsDebugInfo.originalMessages[0]?.cleanContent || message.message_content
  const cleanLength = smsDebugInfo.combinedCleanLength || smsDebugInfo.totalCleanChars

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getDirectionColor()}`}>
              {getDirectionIcon()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {message.metadata?.patient_name || `Patient ${message.patient_id}`}
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>{message.phone_number}</span>
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4" />
                  {date} at {time}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  message.direction === 'inbound' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {message.direction}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ClockIcon className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Sent</span>
                </div>
                <div className="text-lg font-bold text-blue-600">
                  {relative}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUpIcon className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Status</span>
                </div>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(message.status)}`}>
                  {message.status}
                </span>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquareIcon className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Length</span>
                </div>
                <div className="text-lg font-bold text-purple-600">
                  {cleanLength} chars
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {smsSegments} {smsSegments === 1 ? 'segment' : 'segments'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Original: {messageLength} chars
                </div>
              </div>

              {message.cost && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSignIcon className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Cost</span>
                  </div>
                  <div className="text-lg font-bold text-orange-600">
                    ${message.cost.toFixed(4)}
                  </div>
                </div>
              )}
            </div>

            {/* Contact Information */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Patient Name</label>
                  <p className="text-gray-900 dark:text-gray-100">{message.metadata?.patient_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
                  <p className="text-gray-900 dark:text-gray-100">{message.phone_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Patient ID</label>
                  <div className="flex items-center gap-2">
                    <IdCardIcon className="w-4 h-4 text-blue-600" />
                    <p className="text-gray-900 dark:text-gray-100 font-mono font-semibold">{generatedPatientId}</p>
                    {patientRecord && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        (Phone-based)
                      </span>
                    )}
                  </div>
                  {patientRecord && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Created: {new Date(patientRecord.createdAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Message Type</label>
                  <p className="text-gray-900 dark:text-gray-100">{message.metadata?.message_type || 'N/A'}</p>
                </div>
                {message.metadata?.chat_id && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Chat ID</label>
                    <p className="text-gray-900 dark:text-gray-100 font-mono text-sm">{message.metadata.chat_id}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Call History Matching */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <PhoneIcon className="w-5 h-5 text-blue-600" />
                Phone Number Matching
              </h3>
              <div className="space-y-3">
                <div className="bg-white dark:bg-gray-800 rounded p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Patient ID for this phone number:
                      </p>
                      <p className="text-lg font-bold text-blue-600 font-mono">
                        {generatedPatientId}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Consistent across all platforms
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Phone: {message.phone_number}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p>✓ This Patient ID will be the same for all SMS messages and calls from this phone number</p>
                  <p>✓ Patient records are automatically linked across SMS and Call systems</p>
                  {patientRecord && (
                    <p>✓ Patient record created: {new Date(patientRecord.createdAt).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Sentiment Analysis */}
            {message.sentiment_analysis && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Sentiment Analysis</h3>
                <div className="flex items-center gap-4">
                  <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getSentimentColor(message.sentiment_analysis.overall_sentiment)}`}>
                    {message.sentiment_analysis.overall_sentiment}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Confidence: {Math.round(message.sentiment_analysis.confidence_score * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Message Thread */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Message Thread</h3>
              <div className="bg-white dark:bg-gray-800 rounded border p-4">
                <p className="text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">{message.message_content}</p>
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span>{cleanLength} billable characters (original: {messageLength})</span>
                <span>{smsSegments} SMS {smsSegments === 1 ? 'segment' : 'segments'}</span>
                {message.cost && <span>Cost: ${message.cost.toFixed(4)}</span>}
              </div>
            </div>

            {/* Chat Notes Section */}
            {message.metadata?.chat_id && (
              <EnhancedChatNotes
                chatId={message.metadata.chat_id}
                referenceType="sms"
                isReadonly={false}
                onNotesChanged={() => {
                  console.log('SMS Notes updated for chat:', message.metadata?.chat_id)
                  // Optionally trigger refresh of parent data or show success message
                }}
              />
            )}

            {/* Technical Details */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Technical Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-gray-700 dark:text-gray-300 font-medium">Message ID</label>
                  <p className="text-gray-600 dark:text-gray-400 font-mono">{message.message_id}</p>
                </div>
                <div>
                  <label className="text-gray-700 dark:text-gray-300 font-medium">Direction</label>
                  <p className="text-gray-600 dark:text-gray-400 capitalize">{message.direction}</p>
                </div>
                <div>
                  <label className="text-gray-700 dark:text-gray-300 font-medium">Timestamp</label>
                  <p className="text-gray-600 dark:text-gray-400">{(() => {
                    try {
                      let date: Date

                      // Use the same robust parsing logic as formatDateTime
                      if (isNaN(Number(message.timestamp)) || message.timestamp.includes('-') || message.timestamp.includes('T')) {
                        date = new Date(message.timestamp)
                      } else {
                        const numericTimestamp = parseInt(message.timestamp)
                        let testDate = new Date(numericTimestamp)

                        if (isNaN(testDate.getTime()) ||
                            testDate.getFullYear() < 1980 ||
                            testDate.getFullYear() > 2100) {
                          testDate = new Date(numericTimestamp * 1000)
                        }

                        if (isNaN(testDate.getTime()) ||
                            testDate.getFullYear() < 1980 ||
                            testDate.getFullYear() > 2100) {
                          date = new Date()
                        } else {
                          date = testDate
                        }
                      }

                      return isNaN(date.getTime()) ? 'Invalid timestamp' : date.toISOString()
                    } catch (error) {
                      return 'Invalid timestamp'
                    }
                  })()}</p>
                </div>
                <div>
                  <label className="text-gray-700 dark:text-gray-300 font-medium">Status</label>
                  <p className="text-gray-600 dark:text-gray-400 capitalize">{message.status}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <MessageSquareIcon className="w-4 h-4" />
                Reply
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700 transition-colors">
                <PhoneIcon className="w-4 h-4" />
                Call Patient
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700 transition-colors">
                <DownloadIcon className="w-4 h-4" />
                Export
              </button>
              {message.status === 'failed' && (
                <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                  <AlertCircleIcon className="w-4 h-4" />
                  Retry Send
                </button>
              )}
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