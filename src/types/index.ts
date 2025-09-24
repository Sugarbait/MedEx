export interface User {
  id: string
  azure_ad_id: string
  email: string
  name: string
  role: 'admin' | 'super_user' | 'healthcare_provider' | 'staff'
  permissions: Permission[]
  lastLogin?: Date
  mfaEnabled: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, any>
}

export interface Permission {
  resource: string
  actions: ('read' | 'write' | 'delete' | 'admin')[]
}

export interface Call {
  id: string
  patientId?: string
  startTime: Date
  endTime?: Date
  duration?: number
  status: 'active' | 'completed' | 'failed'
  transcription?: string
  sentiment?: {
    score: number
    label: 'positive' | 'negative' | 'neutral'
    confidence: number
  }
  summary?: string
  tags: string[]
  retellAiCallId?: string
  recordingUrl?: string
  metadata: Record<string, any>
}

export interface CallAnalytics {
  totalCalls: number
  averageDuration: number
  sentimentDistribution: {
    positive: number
    negative: number
    neutral: number
  }
  peakHours: Array<{
    hour: number
    callCount: number
  }>
  trends: Array<{
    date: string
    callCount: number
    averageDuration: number
  }>
}

export interface SMS {
  id: string
  patientId?: string
  direction: 'inbound' | 'outbound'
  content: string
  timestamp: Date
  status: 'sent' | 'delivered' | 'read' | 'failed'
  threadId: string
  templateId?: string
  containsPHI: boolean
  metadata: Record<string, any>
}

export interface SMSTemplate {
  id: string
  name: string
  content: string
  category: string
  isApproved: boolean
  createdBy: string
  createdAt: Date
  variables: string[]
}

export interface SMSAnalytics {
  totalMessages: number
  responseRate: number
  averageResponseTime: number
  templatePerformance: Array<{
    templateId: string
    name: string
    usageCount: number
    responseRate: number
  }>
  trends: Array<{
    date: string
    messageCount: number
    responseRate: number
  }>
}

export interface Patient {
  id: string
  firstName: string
  lastName: string
  phone?: string
  email?: string
  lastContact?: Date
  preferences: {
    communicationMethod: 'phone' | 'sms' | 'email'
    timeZone: string
  }
  tags: string[]
}

export interface SecurityEvent {
  id: string
  userId: string
  action: string
  resource: string
  timestamp: Date
  ipAddress: string
  userAgent: string
  success: boolean
  details?: Record<string, any>
}

export interface AuditLog {
  id: string
  userId: string
  action: string
  resource: string
  resourceId?: string
  timestamp: Date
  changes?: {
    before: Record<string, any>
    after: Record<string, any>
  }
  metadata: Record<string, any>
}

export interface ComplianceMetrics {
  dataRetentionCompliance: number
  mfaAdoption: number
  encryptionCoverage: number
  auditLogCompleteness: number
  lastAssessment: Date
  findings: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical'
    description: string
    remediation: string
  }>
}

export interface RetellAIConfig {
  apiKey: string
  endpoint: string
  webhook: string
  isConnected: boolean
  lastSync: Date
  features: {
    realTimeTranscription: boolean
    sentimentAnalysis: boolean
    callSummary: boolean
    voiceCloning: boolean
  }
}

export interface DashboardMetrics {
  activeCalls: number
  todayCallVolume: number
  todaySMSVolume: number
  averageResponseTime: number
  systemHealth: 'healthy' | 'warning' | 'critical'
  retellAIStatus: 'connected' | 'disconnected' | 'error'
  recentActivity: Array<{
    id: string
    type: 'call' | 'sms' | 'user_action'
    description: string
    timestamp: Date
    severity?: 'info' | 'warning' | 'error'
  }>
}

export interface MFAChallenge {
  method: 'totp' | 'sms' | 'biometric'
  challenge: string
  expiresAt: Date
}

export interface SessionInfo {
  sessionId: string
  userId: string
  createdAt: Date
  expiresAt: Date
  refreshToken?: string
  refreshExpiresAt?: Date
  ipAddress: string
  userAgent: string
  isActive: boolean
}

export interface AuthenticationState {
  isAuthenticated: boolean
  isLoading: boolean
  user: (User & { mfaVerified?: boolean }) | null
  sessionInfo: SessionInfo | null
  mfaRequired: boolean
  error: string | null
}

export interface MFASession {
  userId: string
  verified: boolean
  expiresAt: Date
  createdAt?: Date
}

// ============================================================================
// Chat-related Types (integrated from chatService.ts)
// ============================================================================

export interface Chat {
  chat_id: string
  agent_id: string
  chat_status: 'ongoing' | 'ended' | 'error'
  start_timestamp: number
  end_timestamp?: number
  transcript: string
  message_with_tool_calls: ChatMessage[]
  collected_dynamic_variables: Record<string, any>
  retell_llm_dynamic_variables: Record<string, any>
  chat_analysis: {
    chat_summary: string
    user_sentiment: string
    chat_successful: boolean
    custom_analysis_data: Record<string, any>
  }
  chat_cost: {
    product_costs: Record<string, number>
    total_cost: number
  }
  metadata?: Record<string, any>
}

export interface ChatMessage {
  message_id: string
  role: 'agent' | 'user'
  content: string
  created_timestamp: number
  tool_calls?: ToolCall[]
  metadata?: Record<string, any>
}

export interface ToolCall {
  id: string
  type: string
  function?: {
    name: string
    arguments: string
  }
}

export interface ChatFilters {
  agent_id?: string
  chat_status?: 'ongoing' | 'ended' | 'error'
  user_sentiment?: string
  chat_successful?: boolean
  start_timestamp?: {
    gte?: number
    lte?: number
  }
  end_timestamp?: {
    gte?: number
    lte?: number
  }
  phone_number?: string
  patient_id?: string
}

export interface ChatListOptions {
  filter_criteria?: ChatFilters
  sort_order?: 'ascending' | 'descending'
  limit?: number
  pagination_key?: string
  skipFilters?: boolean
}

export interface ChatListResponse {
  chats: Chat[]
  pagination_key?: string
  has_more: boolean
}

export interface CreateChatData {
  agent_id: string
  phone_number?: string
  customer_phone_number?: string
  customer_name?: string
  initial_message?: string
  metadata?: Record<string, any>
  retell_llm_dynamic_variables?: Record<string, any>
}

export interface CreateChatResponse {
  success: boolean
  chat_id?: string
  error?: string
  access_token?: string
}

export interface ChatStats {
  totalChats: number
  activeChats: number
  completedChats: number
  errorChats: number
  avgDuration: string
  totalCost: number
  avgCostPerChat: number
  successRate: number
  positiveSentimentCount: number
  totalMessages: number
  avgMessagesPerChat: number
}

export interface ChatAnalytics {
  today: ChatStats
  thisWeek: ChatStats
  thisMonth: ChatStats
  trends: Array<{
    date: string
    chatCount: number
    avgDuration: number
    totalCost: number
    successRate: number
  }>
  sentimentDistribution: {
    positive: number
    negative: number
    neutral: number
  }
  peakHours: Array<{
    hour: number
    chatCount: number
  }>
}