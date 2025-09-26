/**
 * INCIDENT RESPONSE SYSTEM TYPES
 *
 * TypeScript definitions for automated incident response and security monitoring
 * Supports HIPAA compliance and integrates with existing audit logging
 */

export interface SecurityIncident {
  id: string
  type: IncidentType
  severity: IncidentSeverity
  status: IncidentStatus
  title: string
  description: string
  timestamp: Date
  userId?: string
  userEmail?: string
  sourceIP?: string
  userAgent?: string
  metadata: Record<string, any>
  evidence: IncidentEvidence[]
  response: IncidentResponse
  createdAt: Date
  updatedAt: Date
}

export enum IncidentType {
  // Authentication Incidents
  MFA_LOCKOUT = 'MFA_LOCKOUT',
  MULTIPLE_LOGIN_FAILURES = 'MULTIPLE_LOGIN_FAILURES',
  SUSPICIOUS_LOGIN_LOCATION = 'SUSPICIOUS_LOGIN_LOCATION',
  UNUSUAL_LOGIN_TIME = 'UNUSUAL_LOGIN_TIME',
  CONCURRENT_SESSIONS = 'CONCURRENT_SESSIONS',

  // Data Access Incidents
  EXCESSIVE_PHI_ACCESS = 'EXCESSIVE_PHI_ACCESS',
  UNAUTHORIZED_DATA_EXPORT = 'UNAUTHORIZED_DATA_EXPORT',
  BULK_DATA_ACCESS = 'BULK_DATA_ACCESS',
  OFF_HOURS_DATA_ACCESS = 'OFF_HOURS_DATA_ACCESS',

  // System Security Incidents
  EMERGENCY_LOGOUT_TRIGGERED = 'EMERGENCY_LOGOUT_TRIGGERED',
  AUDIT_LOG_TAMPERING = 'AUDIT_LOG_TAMPERING',
  ENCRYPTION_FAILURE = 'ENCRYPTION_FAILURE',
  SESSION_HIJACKING_ATTEMPT = 'SESSION_HIJACKING_ATTEMPT',

  // Application Security
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  API_ABUSE_DETECTED = 'API_ABUSE_DETECTED',
  MALFORMED_REQUEST = 'MALFORMED_REQUEST',
  PRIVILEGE_ESCALATION_ATTEMPT = 'PRIVILEGE_ESCALATION_ATTEMPT',

  // Integrity Monitoring Incidents
  UNAUTHORIZED_SYSTEM_MODIFICATION = 'UNAUTHORIZED_SYSTEM_MODIFICATION',
  FILE_INTEGRITY_VIOLATION = 'FILE_INTEGRITY_VIOLATION',
  CONFIGURATION_TAMPERING = 'CONFIGURATION_TAMPERING',
  DATABASE_INTEGRITY_COMPROMISE = 'DATABASE_INTEGRITY_COMPROMISE',
  AUDIT_LOG_INTEGRITY_FAILURE = 'AUDIT_LOG_INTEGRITY_FAILURE',
  BASELINE_DEVIATION_DETECTED = 'BASELINE_DEVIATION_DETECTED',

  // General Security
  ANOMALOUS_BEHAVIOR = 'ANOMALOUS_BEHAVIOR',
  ACCOUNT_COMPROMISE_SUSPECTED = 'ACCOUNT_COMPROMISE_SUSPECTED',
  POLICY_VIOLATION = 'POLICY_VIOLATION'
}

export enum IncidentSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum IncidentStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  RESPONDED = 'RESPONDED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  FALSE_POSITIVE = 'FALSE_POSITIVE'
}

export interface IncidentEvidence {
  type: 'audit_log' | 'user_action' | 'system_event' | 'network_data'
  timestamp: Date
  data: Record<string, any>
  source: string
  description: string
}

export interface IncidentResponse {
  automated: AutomatedResponse[]
  manual: ManualResponse[]
  notifications: NotificationResponse[]
  containment: ContainmentAction[]
}

export interface AutomatedResponse {
  action: ResponseAction
  timestamp: Date
  success: boolean
  details: string
  parameters?: Record<string, any>
}

export interface ManualResponse {
  action: string
  timestamp: Date
  userId: string
  userEmail: string
  notes: string
  outcome: 'successful' | 'failed' | 'partial'
}

export interface NotificationResponse {
  type: NotificationType
  recipient: string
  timestamp: Date
  delivered: boolean
  channel: 'email' | 'sms' | 'push' | 'webhook'
  message: string
  error?: string
}

export interface ContainmentAction {
  action: 'account_lock' | 'session_terminate' | 'ip_block' | 'permission_revoke' | 'system_alert'
  timestamp: Date
  success: boolean
  details: string
  duration?: number // in milliseconds
  expiresAt?: Date
}

export enum ResponseAction {
  // Account Actions
  LOCK_USER_ACCOUNT = 'LOCK_USER_ACCOUNT',
  TERMINATE_ALL_SESSIONS = 'TERMINATE_ALL_SESSIONS',
  REQUIRE_PASSWORD_RESET = 'REQUIRE_PASSWORD_RESET',
  DISABLE_API_ACCESS = 'DISABLE_API_ACCESS',

  // Notification Actions
  SEND_EMAIL_ALERT = 'SEND_EMAIL_ALERT',
  SEND_SMS_ALERT = 'SEND_SMS_ALERT',
  NOTIFY_ADMINISTRATORS = 'NOTIFY_ADMINISTRATORS',
  ESCALATE_TO_SECURITY_TEAM = 'ESCALATE_TO_SECURITY_TEAM',

  // Monitoring Actions
  INCREASE_MONITORING = 'INCREASE_MONITORING',
  ENABLE_DETAILED_LOGGING = 'ENABLE_DETAILED_LOGGING',
  QUARANTINE_SESSION = 'QUARANTINE_SESSION',

  // System Actions
  BLOCK_IP_ADDRESS = 'BLOCK_IP_ADDRESS',
  RATE_LIMIT_USER = 'RATE_LIMIT_USER',
  BACKUP_AUDIT_LOGS = 'BACKUP_AUDIT_LOGS'
}

export enum NotificationType {
  // Security Alerts
  SECURITY_INCIDENT = 'SECURITY_INCIDENT',
  ACCOUNT_LOCKOUT = 'ACCOUNT_LOCKOUT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  DATA_BREACH_SUSPECTED = 'DATA_BREACH_SUSPECTED',

  // Emergency Notifications
  EMERGENCY_LOGOUT = 'EMERGENCY_LOGOUT',
  SYSTEM_COMPROMISE = 'SYSTEM_COMPROMISE',
  CRITICAL_VULNERABILITY = 'CRITICAL_VULNERABILITY',

  // Administrative
  INCIDENT_RESOLVED = 'INCIDENT_RESOLVED',
  MANUAL_INTERVENTION_REQUIRED = 'MANUAL_INTERVENTION_REQUIRED',
  COMPLIANCE_VIOLATION = 'COMPLIANCE_VIOLATION'
}

export interface IncidentConfiguration {
  // Detection Thresholds
  mfaFailureThreshold: number
  loginFailureThreshold: number
  phiAccessThreshold: number
  sessionConcurrencyLimit: number

  // Time Windows (in milliseconds)
  detectionWindow: number
  cooldownPeriod: number

  // Response Settings
  autoLockoutEnabled: boolean
  autoNotificationEnabled: boolean
  escalationEnabled: boolean

  // Notification Preferences
  emailAlerts: boolean
  smsAlerts: boolean
  webhookAlerts: boolean

  // Recipients
  securityTeamEmails: string[]
  adminPhoneNumbers: string[]
  webhookUrls: string[]

  // Business Hours (for unusual time detection)
  businessHours: {
    start: number // hour (0-23)
    end: number   // hour (0-23)
    timezone: string
    weekdays: number[] // 0=Sunday, 1=Monday, etc.
  }

  // IP Geolocation Settings
  allowedCountries: string[]
  allowedStates: string[]
  geoLocationEnabled: boolean
}

export interface IncidentMetrics {
  // Incident Counts
  totalIncidents: number
  openIncidents: number
  resolvedIncidents: number
  falsePositives: number

  // Response Times
  averageDetectionTime: number
  averageResponseTime: number
  averageResolutionTime: number

  // Severity Distribution
  criticalIncidents: number
  highIncidents: number
  mediumIncidents: number
  lowIncidents: number

  // Type Distribution
  incidentsByType: Record<IncidentType, number>

  // Trends
  incidentTrends: Array<{
    date: string
    count: number
    severity: IncidentSeverity
  }>

  // Performance Metrics
  automatedResponseRate: number
  manualInterventionRate: number
  escalationRate: number

  // HIPAA Compliance Metrics
  hipaaIncidents: number
  phiRelatedIncidents: number
  complianceViolations: number
}

export interface UserSecurityProfile {
  userId: string
  userEmail: string

  // Risk Assessment
  riskScore: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

  // Incident History
  totalIncidents: number
  recentIncidents: SecurityIncident[]

  // Behavioral Patterns
  typicalLoginTimes: number[] // hours of day
  typicalLocations: string[] // countries/states
  averageSessionDuration: number

  // Security Status
  accountLocked: boolean
  lockoutCount: number
  lastLockout?: Date
  mfaEnabled: boolean

  // Monitoring Flags
  enhancedMonitoring: boolean
  monitoringReason?: string
  monitoringExpiresAt?: Date
}

export interface IncidentResponsePlan {
  id: string
  name: string
  description: string
  incidentTypes: IncidentType[]
  severity: IncidentSeverity

  // Automated Responses
  automatedActions: ResponseAction[]
  actionDelay: number // milliseconds to wait before action

  // Escalation Rules
  escalationThreshold: number // minutes before escalation
  escalationRecipients: string[]

  // Notification Templates
  emailTemplate: string
  smsTemplate: string

  // Containment Rules
  requireContainment: boolean
  containmentActions: ContainmentAction[]

  // HIPAA Compliance
  hipaaRequired: boolean
  retentionPeriod: number // days
  encryptionRequired: boolean

  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface IncidentDashboardData {
  // Summary Stats
  metrics: IncidentMetrics

  // Active Incidents
  activeIncidents: SecurityIncident[]
  recentIncidents: SecurityIncident[]

  // System Status
  systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL'
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

  // User Profiles
  highRiskUsers: UserSecurityProfile[]
  lockedAccounts: UserSecurityProfile[]

  // Real-time Alerts
  pendingAlerts: SecurityIncident[]
  unreadNotifications: number

  // Configuration Status
  configuration: IncidentConfiguration
  responsePlans: IncidentResponsePlan[]

  // HIPAA Compliance
  complianceStatus: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT'
  lastComplianceCheck: Date
}

// Event Types for Real-time Updates
export interface IncidentEventData {
  type: 'incident_created' | 'incident_updated' | 'incident_resolved' | 'user_locked' | 'notification_sent'
  incident?: SecurityIncident
  userId?: string
  timestamp: Date
  metadata?: Record<string, any>
}

// API Response Types
export interface CreateIncidentRequest {
  type: IncidentType
  severity: IncidentSeverity
  title: string
  description: string
  userId?: string
  userEmail?: string
  evidence: Omit<IncidentEvidence, 'timestamp'>[]
  metadata?: Record<string, any>
}

export interface UpdateIncidentRequest {
  status?: IncidentStatus
  severity?: IncidentSeverity
  title?: string
  description?: string
  metadata?: Record<string, any>
  manualResponse?: Omit<ManualResponse, 'timestamp'>
}

export interface IncidentSearchCriteria {
  types?: IncidentType[]
  severities?: IncidentSeverity[]
  statuses?: IncidentStatus[]
  userId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
  sortBy?: 'timestamp' | 'severity' | 'status'
  sortOrder?: 'asc' | 'desc'
}

export interface IncidentSearchResponse {
  incidents: SecurityIncident[]
  totalCount: number
  hasMore: boolean
  nextOffset?: number
}