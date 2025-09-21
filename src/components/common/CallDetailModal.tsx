import React, { useState, useEffect } from 'react'
import {
  PhoneIcon,
  DownloadIcon,
  UserIcon,
  ClockIcon,
  CalendarIcon,
  DollarSignIcon,
  CheckCircleIcon,
  XIcon,
  PhoneCallIcon,
  TrendingUpIcon,
  IdCardIcon
} from 'lucide-react'
import { CallNotes } from './CallNotes'
import { patientIdService } from '@/services/patientIdService'

interface CallDetailModalProps {
  call: {
    call_id: string
    patient_id?: string
    phone_number?: string
    from_number?: string
    to_number?: string
    call_status: string
    start_timestamp: number
    end_timestamp?: number
    call_length_seconds?: number
    call_summary?: string
    transcript?: string
    call_type?: string
    sentiment_analysis?: {
      overall_sentiment: 'positive' | 'negative' | 'neutral'
      confidence_score: number
    }
    metadata?: {
      patient_name?: string
      call_type?: string
      [key: string]: any
    }
    cost?: number
  }
  isOpen: boolean
  onClose: () => void
  onNotesChanged?: () => void
}

export const CallDetailModal: React.FC<CallDetailModalProps> = ({ call, isOpen, onClose, onNotesChanged }) => {
  const [generatedPatientId, setGeneratedPatientId] = useState<string>('')
  const [patientRecord, setPatientRecord] = useState<any>(null)

  // Generate Patient ID based on phone number when modal opens
  useEffect(() => {
    if (isOpen && call) {
      // Extract phone number from various possible fields
      const phoneNumber = call.phone_number || call.from_number || call.to_number

      if (phoneNumber) {
        const patientId = patientIdService.getPatientId(phoneNumber)
        const record = patientIdService.getPatientRecord(phoneNumber)
        setGeneratedPatientId(patientId)
        setPatientRecord(record)
      } else {
        setGeneratedPatientId('PT00000000')
        setPatientRecord(null)
      }
    }
  }, [isOpen, call])

  if (!isOpen) return null

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0:00'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString()
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
      case 'completed': return 'text-green-600 bg-green-50'
      case 'failed': return 'text-red-600 bg-red-50'
      case 'active': return 'text-blue-600 bg-blue-50'
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700'
    }
  }

  const { date, time } = formatDateTime(call.start_timestamp)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <PhoneCallIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {call.metadata?.patient_name || 'Caller'}
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>ID: {generatedPatientId || 'PT00000000'}</span>
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4" />
                  {date} at {time}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ClockIcon className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Duration</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatDuration(call.call_length_seconds)}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUpIcon className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Status</span>
                </div>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(call.call_status)}`}>
                  {call.call_status}
                </span>
              </div>

              {call.cost && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSignIcon className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Cost</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    ${call.cost.toFixed(3)}
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
                  <p className="text-gray-900 dark:text-gray-100">{call.metadata?.patient_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
                  <p className="text-gray-900 dark:text-gray-100">{call.from_number || call.to_number || call.phone_number || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Call Type</label>
                  <p className="text-gray-900 dark:text-gray-100">{call.metadata?.call_type || call.call_type || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Patient ID</label>
                  <div className="flex items-center gap-2">
                    <IdCardIcon className="w-4 h-4 text-blue-600" />
                    <p className="text-gray-900 dark:text-gray-100 font-mono font-semibold">
                      {generatedPatientId || 'PT00000000'}
                    </p>
                    {patientRecord && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">(Phone-based)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sentiment Analysis */}
            {call.sentiment_analysis && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Sentiment Analysis</h3>
                <div className="flex items-center gap-4">
                  <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getSentimentColor(call.sentiment_analysis.overall_sentiment)}`}>
                    {call.sentiment_analysis.overall_sentiment}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Confidence: {Math.round(call.sentiment_analysis.confidence_score * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Call Summary */}
            {call.call_summary && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Call Summary</h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{call.call_summary}</p>
              </div>
            )}

            {/* Full Transcript */}
            {call.transcript && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Full Transcript</h3>
                <div className="bg-white dark:bg-gray-800 rounded border p-4 max-h-64 overflow-y-auto">
                  {(() => {
                    // Enhanced transcript parsing to capture both sides of conversation
                    const transcript = call.transcript.trim()
                    // Check if transcript is truncated and handle accordingly
                    if (transcript.includes('…')) {
                      console.log('⚠️ Transcript appears truncated, displaying available content')
                    }

                    // Check for multiple types of speaker patterns that Retell AI might use
                    const hasStructuredFormat = /\b(AI|Agent|Assistant|Patient|User|Human|Caller|Customer|Client|Bot|System):\s/i.test(transcript) ||
                                              /^(AI|Agent|Assistant|Patient|User|Human|Caller|Customer|Client|Bot|System)\s*:/im.test(transcript) ||
                                              /\[(AI|Agent|Assistant|Patient|User|Human|Caller|Customer|Client|Bot|System)\]/i.test(transcript)

                    if (hasStructuredFormat) {
                      // Split by lines and process each line
                      const lines = transcript.split('\n').filter(line => line.trim())

                      return (
                        <div className="space-y-3">
                          {lines.map((line, index) => {
                            const trimmedLine = line.trim()

                            // Enhanced speaker pattern matching - check for AI/Assistant/Bot patterns
                            const aiMatch = trimmedLine.match(/^(\[?)?(AI|Agent|Assistant|Bot|System)(\]?)?:?\s*(.*)/i) ||
                                           trimmedLine.match(/^\[(AI|Agent|Assistant|Bot|System)\]\s*(.*)/i)

                            // Enhanced pattern matching for caller/patient/human patterns
                            const callerMatch = trimmedLine.match(/^(\[?)?(Patient|User|Human|Caller|Customer|Client)(\]?)?:?\s*(.*)/i) ||
                                               trimmedLine.match(/^\[(Patient|User|Human|Caller|Customer|Client)\]\s*(.*)/i)

                            // Check for keypad input patterns and instructions
                            const keypadMatch = trimmedLine.match(/User pressed keypad:\s*([0-9#*]+)\s*digit:\s*([0-9#*]+)/i) ||
                                              trimmedLine.match(/^(User pressed keypad|digit):\s*(.*)/i) ||
                                              trimmedLine.match(/keypad:\s*([0-9#*]+)/i) ||
                                              trimmedLine.match(/pressed\s+([0-9#*]+)/i) ||
                                              trimmedLine.match(/press\s+([0-9#*]+)/i) ||
                                              trimmedLine.match(/pound\s+sign/i)

                            if (aiMatch) {
                              const content = aiMatch[4] || aiMatch[2] || trimmedLine.replace(/^.*?:\s*/, '')
                              return (
                                <div key={index} className="flex items-start gap-3">
                                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-xs font-medium text-blue-700 mb-1">AI Assistant</div>
                                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{content.trim()}</p>
                                  </div>
                                </div>
                              )
                            } else if (keypadMatch) {
                              // Extract the keypad input - handle Retell AI specific format
                              let keypadInput = 'unknown input'
                              if (keypadMatch[1] && keypadMatch[2]) {
                                // "User pressed keypad: 1# digit: 1#" format
                                keypadInput = keypadMatch[1]
                              } else if (keypadMatch[2]) {
                                // Other formats with captured groups
                                keypadInput = keypadMatch[2]
                              } else if (keypadMatch[1]) {
                                keypadInput = keypadMatch[1]
                              } else {
                                // Fallback to extract any digits/symbols
                                const fallback = trimmedLine.match(/([0-9#*]+)/)?.[1]
                                if (fallback) keypadInput = fallback
                              }
                              return (
                                <div key={index} className="flex items-start gap-3">
                                  <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-xs font-medium text-orange-700 mb-1">📞 Keypad Input</div>
                                    <div className="bg-orange-50 border border-orange-200 rounded px-3 py-1 inline-block">
                                      <span className="text-orange-800 font-mono text-sm font-bold">{keypadInput.trim()}</span>
                                    </div>
                                  </div>
                                </div>
                              )
                            } else if (callerMatch) {
                              const content = callerMatch[4] || callerMatch[2] || trimmedLine.replace(/^.*?:\s*/, '')
                              return (
                                <div key={index} className="flex items-start gap-3">
                                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-xs font-medium text-green-700 mb-1">Caller</div>
                                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{content.trim()}</p>
                                  </div>
                                </div>
                              )
                            } else if (trimmedLine.includes(':') && trimmedLine.length > 5) {
                              // Generic speaker pattern - split on first colon
                              const colonIndex = trimmedLine.indexOf(':')
                              const speaker = trimmedLine.substring(0, colonIndex).trim()
                              const content = trimmedLine.substring(colonIndex + 1).trim()

                              // Check if this is a keypad input in generic format
                              const isKeypad = /keypad|digit|pressed/i.test(speaker) || /^[0-9#*]+$/.test(content.trim()) ||
                                             /User pressed keypad/i.test(trimmedLine)

                              // Determine display based on content type
                              let bgColor, dotColor, textColor, label
                              if (isKeypad) {
                                bgColor = 'bg-orange-100'
                                dotColor = 'bg-orange-500'
                                textColor = 'text-orange-700'
                                label = '📞 Keypad Input'
                              } else {
                                const isAI = /^(ai|agent|assistant|bot|system)/i.test(speaker)
                                bgColor = isAI ? 'bg-blue-100' : 'bg-green-100'
                                dotColor = isAI ? 'bg-blue-500' : 'bg-green-500'
                                textColor = isAI ? 'text-blue-700' : 'text-green-700'
                                label = isAI ? 'AI Assistant' : 'Caller'
                              }

                              return (
                                <div key={index} className="flex items-start gap-3">
                                  <div className={`flex-shrink-0 w-8 h-8 ${bgColor} rounded-full flex items-center justify-center`}>
                                    <div className={`w-3 h-3 ${dotColor} rounded-full`}></div>
                                  </div>
                                  <div className="flex-1">
                                    <div className={`text-xs font-medium ${textColor} mb-1`}>{label}</div>
                                    {isKeypad ? (
                                      <div className="bg-orange-50 border border-orange-200 rounded px-3 py-1 inline-block">
                                        <span className="text-orange-800 font-mono text-sm font-bold">{content}</span>
                                      </div>
                                    ) : (
                                      <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{content}</p>
                                    )}
                                  </div>
                                </div>
                              )
                            } else {
                              // Check if this is a keypad input without speaker label
                              const standaloneKeypad = trimmedLine.match(/^([0-9#*]+)$/) ||
                                                      trimmedLine.match(/keypad.*?([0-9#*]+)/i) ||
                                                      trimmedLine.match(/pressed.*?([0-9#*]+)/i) ||
                                                      trimmedLine.match(/User pressed keypad:\s*([0-9#*]+)/i)

                              if (standaloneKeypad) {
                                const keypadInput = standaloneKeypad[1] || trimmedLine.trim()
                                return (
                                  <div key={index} className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                    </div>
                                    <div className="flex-1">
                                      <div className="text-xs font-medium text-orange-700 mb-1">📞 Keypad Input</div>
                                      <div className="bg-orange-50 border border-orange-200 rounded px-3 py-1 inline-block">
                                        <span className="text-orange-800 font-mono text-sm font-bold">{keypadInput}</span>
                                      </div>
                                    </div>
                                  </div>
                                )
                              }

                              // Line without clear speaker - display as narrative
                              return (
                                <div key={index} className="pl-11">
                                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{trimmedLine}</p>
                                </div>
                              )
                            }
                          })}
                        </div>
                      )
                    } else {
                      // No structured format - display as single continuous conversation
                      // Look for clear speaker changes only with very obvious patterns
                      const lines = transcript.split('\n').filter(line => line.trim().length > 0)

                      // If multiple lines exist and they look like natural conversation turns
                      if (lines.length > 1 && lines.some(line => line.length > 100)) {
                        // Only split if we find very clear conversation markers
                        const conversationParts = []
                        let currentPart = ''

                        for (const line of lines) {
                          // Look for clear conversation breaks (greeting, thanks, questions)
                          const isConversationBreak = /^(Hello|Hi|Thank you|Thanks|Yes|No|Okay|Sure)\b/i.test(line.trim()) ||
                                                    /^(How|What|When|Where|Why|Can|Could|Would|Are|Do|Did)\b/i.test(line.trim())

                          if (isConversationBreak && currentPart.length > 50) {
                            conversationParts.push(currentPart.trim())
                            currentPart = line
                          } else {
                            currentPart += (currentPart ? ' ' : '') + line
                          }
                        }

                        if (currentPart) {
                          conversationParts.push(currentPart.trim())
                        }

                        // Only use conversation parts if we have 2-4 clear segments
                        if (conversationParts.length >= 2 && conversationParts.length <= 4) {
                          return (
                            <div className="space-y-3">
                              {conversationParts.map((part, index) => {
                                const isAI = index % 2 === 0
                                const bgColor = isAI ? 'bg-blue-100' : 'bg-green-100'
                                const dotColor = isAI ? 'bg-blue-500' : 'bg-green-500'
                                const textColor = isAI ? 'text-blue-700' : 'text-green-700'
                                const label = isAI ? 'AI Assistant' : 'Caller'

                                return (
                                  <div key={index} className="flex items-start gap-3">
                                    <div className={`flex-shrink-0 w-8 h-8 ${bgColor} rounded-full flex items-center justify-center`}>
                                      <div className={`w-3 h-3 ${dotColor} rounded-full`}></div>
                                    </div>
                                    <div className="flex-1">
                                      <div className={`text-xs font-medium ${textColor} mb-1`}>{label}</div>
                                      <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{part}</p>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        }
                      }

                      // Default: display as single continuous conversation
                      return (
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-medium text-blue-700 mb-1">AI Assistant</div>
                              <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{transcript}</p>
                            </div>
                          </div>
                        </div>
                      )
                    }
                  })()}
                </div>
              </div>
            )}

            {/* Call Notes */}
            <CallNotes
              callId={call.call_id}
              onNotesChanged={() => {
                console.log('CallDetailModal: onNotesChanged called for callId:', call.call_id)
                onNotesChanged?.()
              }}
            />

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700 transition-colors">
                <DownloadIcon className="w-4 h-4" />
                Download
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