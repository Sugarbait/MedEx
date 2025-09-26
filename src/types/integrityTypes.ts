/**
 * INTEGRITY MONITORING TYPE DEFINITIONS
 *
 * Comprehensive type definitions for real-time integrity monitoring system
 * that provides continuous security monitoring for HIPAA compliance.
 *
 * Features:
 * - File integrity monitoring with hash verification
 * - Database integrity checks for audit logs and PHI data
 * - Real-time change detection and alerting
 * - Automated incident response integration
 * - Compliance reporting for audit requirements
 */

import { SecurityIncident, IncidentType, IncidentSeverity } from './incidentTypes'

export interface IntegrityCheck {
  id: string
  name: string
  description: string
  type: IntegrityCheckType
  category: IntegrityCategory
  priority: IntegrityPriority
  enabled: boolean
  interval: number // milliseconds
  lastChecked?: Date
  lastResult?: IntegrityResult
  baseline?: IntegrityBaseline
  metadata?: Record<string, any>
}

export enum IntegrityCheckType {
  FILE_HASH = 'FILE_HASH',
  FILE_SIZE = 'FILE_SIZE',
  FILE_PERMISSIONS = 'FILE_PERMISSIONS',
  DATABASE_INTEGRITY = 'DATABASE_INTEGRITY',
  AUDIT_LOG_INTEGRITY = 'AUDIT_LOG_INTEGRITY',
  CONFIGURATION_INTEGRITY = 'CONFIGURATION_INTEGRITY',
  MEMORY_INTEGRITY = 'MEMORY_INTEGRITY',
  SYSTEM_STATE = 'SYSTEM_STATE',
  RUNTIME_INTEGRITY = 'RUNTIME_INTEGRITY'
}

export enum IntegrityCategory {
  CRITICAL_SYSTEM = 'CRITICAL_SYSTEM',
  SECURITY_COMPONENT = 'SECURITY_COMPONENT',
  AUDIT_SYSTEM = 'AUDIT_SYSTEM',
  PHI_DATA = 'PHI_DATA',
  CONFIGURATION = 'CONFIGURATION',
  APPLICATION_CODE = 'APPLICATION_CODE',
  INFRASTRUCTURE = 'INFRASTRUCTURE'
}

export enum IntegrityPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export interface IntegrityResult {
  checkId: string
  timestamp: Date
  status: IntegrityStatus
  expected: string | number | object
  actual: string | number | object
  deviation?: IntegrityDeviation
  confidence: number // 0-100
  metadata?: Record<string, any>
}

export enum IntegrityStatus {
  VERIFIED = 'VERIFIED',
  COMPROMISED = 'COMPROMISED',
  SUSPICIOUS = 'SUSPICIOUS',
  ERROR = 'ERROR',
  WARNING = 'WARNING'
}

export interface IntegrityDeviation {
  type: DeviationType
  severity: DeviationSeverity
  description: string
  affectedComponents: string[]
  possibleCauses: string[]
  recommendedActions: string[]
  evidence?: IntegrityEvidence[]
}

export enum DeviationType {
  HASH_MISMATCH = 'HASH_MISMATCH',
  SIZE_CHANGE = 'SIZE_CHANGE',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  CONTENT_MODIFICATION = 'CONTENT_MODIFICATION',
  STRUCTURE_CHANGE = 'STRUCTURE_CHANGE',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  DATA_CORRUPTION = 'DATA_CORRUPTION',
  INJECTION_DETECTED = 'INJECTION_DETECTED'
}

export enum DeviationSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

export interface IntegrityEvidence {
  type: EvidenceType
  description: string
  data: any
  timestamp: Date
  source: string
  verifiable: boolean
}

export enum EvidenceType {
  HASH_COMPARISON = 'HASH_COMPARISON',
  FILE_METADATA = 'FILE_METADATA',
  SYSTEM_LOG = 'SYSTEM_LOG',
  NETWORK_ACTIVITY = 'NETWORK_ACTIVITY',
  PROCESS_INFORMATION = 'PROCESS_INFORMATION',
  MEMORY_DUMP = 'MEMORY_DUMP',
  DATABASE_LOG = 'DATABASE_LOG'
}

export interface IntegrityBaseline {
  checkId: string
  establishedAt: Date
  establishedBy: string
  values: IntegrityBaselineValues
  version: string
  locked: boolean
  metadata?: Record<string, any>
}

export interface IntegrityBaselineValues {
  hashes?: Record<string, string>
  sizes?: Record<string, number>
  permissions?: Record<string, string>
  configurations?: Record<string, any>
  schemas?: Record<string, any>
  patterns?: Record<string, RegExp>
}

export interface IntegrityMonitoringConfig {
  enabled: boolean
  globalInterval: number // milliseconds
  workerEnabled: boolean
  workerScript: string
  checksEnabled: IntegrityCheckType[]
  priorityFilter: IntegrityPriority[]
  categoriesEnabled: IntegrityCategory[]
  autoRemediation: boolean
  incidentCreation: boolean
  auditLogging: boolean
  realTimeAlerts: boolean
  batchProcessing: boolean
  maxConcurrentChecks: number
  retryAttempts: number
  timeoutMs: number
  storage: IntegrityStorageConfig
  notifications: IntegrityNotificationConfig
}

export interface IntegrityStorageConfig {
  localStorage: boolean
  supabase: boolean
  encryptBaselines: boolean
  encryptResults: boolean
  retentionDays: number
  maxLocalRecords: number
  compressionEnabled: boolean
}

export interface IntegrityNotificationConfig {
  immediateAlerts: boolean
  batchAlerts: boolean
  emailNotifications: boolean
  smsNotifications: boolean
  webhookNotifications: boolean
  severityThreshold: DeviationSeverity
  cooldownPeriod: number // milliseconds
}

export interface IntegrityWorkerMessage {
  type: WorkerMessageType
  id: string
  timestamp: Date
  payload: any
}

export enum WorkerMessageType {
  START_MONITORING = 'START_MONITORING',
  STOP_MONITORING = 'STOP_MONITORING',
  RUN_CHECK = 'RUN_CHECK',
  CHECK_RESULT = 'CHECK_RESULT',
  ERROR = 'ERROR',
  STATUS_UPDATE = 'STATUS_UPDATE',
  BATCH_RESULTS = 'BATCH_RESULTS'
}

export interface IntegrityWorkerConfig {
  checks: IntegrityCheck[]
  config: IntegrityMonitoringConfig
  credentials?: Record<string, string>
}

export interface IntegrityAlert {
  id: string
  checkId: string
  timestamp: Date
  severity: DeviationSeverity
  type: DeviationType
  title: string
  description: string
  affectedResources: string[]
  evidence: IntegrityEvidence[]
  status: AlertStatus
  acknowledged: boolean
  acknowledgedBy?: string
  acknowledgedAt?: Date
  resolved: boolean
  resolvedBy?: string
  resolvedAt?: Date
  autoRemediated: boolean
  incidentId?: string
  metadata?: Record<string, any>
}

export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
  FALSE_POSITIVE = 'FALSE_POSITIVE',
  SUPPRESSED = 'SUPPRESSED'
}

export interface IntegrityDashboardData {
  summary: IntegrityStatusSummary
  recentChecks: IntegrityResult[]
  activeAlerts: IntegrityAlert[]
  trends: IntegrityTrend[]
  coverage: IntegrityCoverage
  performance: IntegrityPerformance
}

export interface IntegrityStatusSummary {
  totalChecks: number
  enabledChecks: number
  passedChecks: number
  failedChecks: number
  warningChecks: number
  errorChecks: number
  lastUpdateTime: Date
  overallHealthScore: number // 0-100
}

export interface IntegrityTrend {
  date: string
  passed: number
  failed: number
  warnings: number
  errors: number
  healthScore: number
}

export interface IntegrityCoverage {
  categories: Record<IntegrityCategory, IntegrityCategoryStats>
  types: Record<IntegrityCheckType, IntegrityTypeStats>
  priorities: Record<IntegrityPriority, IntegrityPriorityStats>
}

export interface IntegrityCategoryStats {
  total: number
  enabled: number
  passed: number
  failed: number
  coverage: number // percentage
}

export interface IntegrityTypeStats {
  total: number
  enabled: number
  averageInterval: number
  lastExecuted?: Date
  successRate: number // percentage
}

export interface IntegrityPriorityStats {
  total: number
  enabled: number
  criticalFailures: number
  highFailures: number
  responseTime: number // average milliseconds
}

export interface IntegrityPerformance {
  averageCheckDuration: number
  totalChecksExecuted: number
  checksPerSecond: number
  workerUtilization: number // percentage
  memoryUsage: number // bytes
  cpuUsage: number // percentage
}

export interface IntegrityRemediationAction {
  id: string
  checkId: string
  alertId: string
  type: RemediationActionType
  description: string
  automated: boolean
  executed: boolean
  executedAt?: Date
  executedBy?: string
  result?: RemediationResult
  rollbackPossible: boolean
  rollbackAction?: string
  impact: RemediationImpact
  approvalRequired: boolean
  approvedBy?: string
  approvedAt?: Date
}

export enum RemediationActionType {
  RESTORE_FROM_BACKUP = 'RESTORE_FROM_BACKUP',
  RESET_PERMISSIONS = 'RESET_PERMISSIONS',
  REGENERATE_HASH = 'REGENERATE_HASH',
  QUARANTINE_FILE = 'QUARANTINE_FILE',
  DISABLE_COMPONENT = 'DISABLE_COMPONENT',
  RESTART_SERVICE = 'RESTART_SERVICE',
  CLEAR_CACHE = 'CLEAR_CACHE',
  UPDATE_CONFIGURATION = 'UPDATE_CONFIGURATION',
  FORCE_LOGOUT = 'FORCE_LOGOUT',
  BLOCK_ACCESS = 'BLOCK_ACCESS'
}

export interface RemediationResult {
  success: boolean
  message: string
  startTime: Date
  endTime: Date
  changes: string[]
  errors?: string[]
  metadata?: Record<string, any>
}

export enum RemediationImpact {
  NONE = 'NONE',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface IntegrityAuditRecord {
  id: string
  timestamp: Date
  action: IntegrityAuditAction
  resourceType: string
  resourceId: string
  userId?: string
  changes: IntegrityChange[]
  metadata?: Record<string, any>
}

export enum IntegrityAuditAction {
  BASELINE_CREATED = 'BASELINE_CREATED',
  BASELINE_UPDATED = 'BASELINE_UPDATED',
  CHECK_EXECUTED = 'CHECK_EXECUTED',
  DEVIATION_DETECTED = 'DEVIATION_DETECTED',
  ALERT_CREATED = 'ALERT_CREATED',
  REMEDIATION_EXECUTED = 'REMEDIATION_EXECUTED',
  CONFIGURATION_CHANGED = 'CONFIGURATION_CHANGED',
  MONITORING_STARTED = 'MONITORING_STARTED',
  MONITORING_STOPPED = 'MONITORING_STOPPED'
}

export interface IntegrityChange {
  field: string
  oldValue: any
  newValue: any
  changeType: ChangeType
  impact: ChangeImpact
}

export enum ChangeType {
  ADDED = 'ADDED',
  MODIFIED = 'MODIFIED',
  DELETED = 'DELETED',
  MOVED = 'MOVED',
  RENAMED = 'RENAMED'
}

export enum ChangeImpact {
  BENIGN = 'BENIGN',
  SUSPICIOUS = 'SUSPICIOUS',
  MALICIOUS = 'MALICIOUS',
  UNKNOWN = 'UNKNOWN'
}

export interface IntegritySearchCriteria {
  types?: IntegrityCheckType[]
  categories?: IntegrityCategory[]
  priorities?: IntegrityPriority[]
  statuses?: IntegrityStatus[]
  startDate?: Date
  endDate?: Date
  resourcePattern?: string
  severity?: DeviationSeverity[]
  limit?: number
  offset?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface IntegritySearchResponse {
  results: IntegrityResult[]
  alerts: IntegrityAlert[]
  totalCount: number
  hasMore: boolean
  nextOffset?: number
}

export interface IntegrityReport {
  id: string
  title: string
  description: string
  generatedAt: Date
  generatedBy: string
  reportType: IntegrityReportType
  period: ReportPeriod
  data: IntegrityReportData
  format: ReportFormat
  metadata?: Record<string, any>
}

export enum IntegrityReportType {
  COMPLIANCE = 'COMPLIANCE',
  SECURITY = 'SECURITY',
  PERFORMANCE = 'PERFORMANCE',
  SUMMARY = 'SUMMARY',
  DETAILED = 'DETAILED',
  INCIDENT = 'INCIDENT'
}

export interface ReportPeriod {
  startDate: Date
  endDate: Date
  intervalType: IntervalType
  customLabel?: string
}

export enum IntervalType {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM'
}

export interface IntegrityReportData {
  summary: IntegrityStatusSummary
  trends: IntegrityTrend[]
  alerts: IntegrityAlert[]
  incidents: SecurityIncident[]
  remediations: IntegrityRemediationAction[]
  coverage: IntegrityCoverage
  performance: IntegrityPerformance
  recommendations: string[]
  complianceScore: number
  riskAssessment: RiskAssessment
}

export interface RiskAssessment {
  overallRisk: RiskLevel
  categories: Record<IntegrityCategory, RiskLevel>
  threats: ThreatAssessment[]
  mitigations: MitigationRecommendation[]
  timeline: RiskTimeline[]
}

export enum RiskLevel {
  VERY_LOW = 'VERY_LOW',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ThreatAssessment {
  type: ThreatType
  likelihood: number // 0-100
  impact: number // 0-100
  riskScore: number // 0-100
  description: string
  indicators: string[]
  mitigations: string[]
}

export enum ThreatType {
  MALWARE_INJECTION = 'MALWARE_INJECTION',
  UNAUTHORIZED_MODIFICATION = 'UNAUTHORIZED_MODIFICATION',
  DATA_CORRUPTION = 'DATA_CORRUPTION',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  INSIDER_THREAT = 'INSIDER_THREAT',
  EXTERNAL_ATTACK = 'EXTERNAL_ATTACK',
  SUPPLY_CHAIN = 'SUPPLY_CHAIN',
  CONFIGURATION_DRIFT = 'CONFIGURATION_DRIFT'
}

export interface MitigationRecommendation {
  id: string
  priority: IntegrityPriority
  category: IntegrityCategory
  title: string
  description: string
  effort: EffortLevel
  timeline: string
  cost: CostEstimate
  impact: PositiveImpact
  dependencies: string[]
  alternatives: string[]
}

export enum EffortLevel {
  MINIMAL = 'MINIMAL',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  EXTENSIVE = 'EXTENSIVE'
}

export interface CostEstimate {
  level: CostLevel
  description: string
  factors: string[]
}

export enum CostLevel {
  FREE = 'FREE',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH'
}

export interface PositiveImpact {
  security: number // 0-100
  compliance: number // 0-100
  performance: number // 0-100
  usability: number // 0-100
  description: string
}

export interface RiskTimeline {
  date: Date
  riskLevel: RiskLevel
  riskScore: number
  events: string[]
  trends: string[]
}

export enum ReportFormat {
  JSON = 'JSON',
  PDF = 'PDF',
  CSV = 'CSV',
  HTML = 'HTML',
  EXCEL = 'EXCEL'
}

export interface IntegrityMetrics {
  uptime: number // percentage
  availability: number // percentage
  reliability: number // percentage
  performance: number // percentage
  security: number // percentage
  compliance: number // percentage
  mtbf: number // mean time between failures (hours)
  mttr: number // mean time to repair (hours)
  sla: number // service level agreement compliance percentage
}

export interface IntegrityConfiguration {
  monitoringEnabled: boolean
  checkIntervals: Record<IntegrityCheckType, number>
  alertThresholds: Record<DeviationSeverity, number>
  retentionPolicies: Record<string, number>
  escalationRules: EscalationRule[]
  maintenanceWindows: MaintenanceWindow[]
  excludePatterns: string[]
  includePatterns: string[]
  customChecks: CustomIntegrityCheck[]
}

export interface EscalationRule {
  id: string
  name: string
  enabled: boolean
  conditions: EscalationCondition[]
  actions: EscalationAction[]
  cooldown: number // milliseconds
  maxEscalations: number
}

export interface EscalationCondition {
  type: ConditionType
  operator: ConditionOperator
  value: any
  field: string
}

export enum ConditionType {
  SEVERITY = 'SEVERITY',
  DURATION = 'DURATION',
  COUNT = 'COUNT',
  PATTERN = 'PATTERN',
  CATEGORY = 'CATEGORY'
}

export enum ConditionOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  CONTAINS = 'CONTAINS',
  MATCHES = 'MATCHES'
}

export interface EscalationAction {
  type: EscalationActionType
  target: string
  template: string
  delay: number // milliseconds
}

export enum EscalationActionType {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WEBHOOK = 'WEBHOOK',
  TICKET = 'TICKET',
  PAGER = 'PAGER'
}

export interface MaintenanceWindow {
  id: string
  name: string
  description: string
  startTime: Date
  endTime: Date
  recurring: boolean
  recurrencePattern?: RecurrencePattern
  affectedChecks: string[]
  suppressAlerts: boolean
  reducedMonitoring: boolean
}

export interface RecurrencePattern {
  type: RecurrenceType
  interval: number
  daysOfWeek?: number[]
  daysOfMonth?: number[]
  endDate?: Date
}

export enum RecurrenceType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY'
}

export interface CustomIntegrityCheck {
  id: string
  name: string
  description: string
  script: string
  language: ScriptLanguage
  parameters: Record<string, any>
  timeout: number
  enabled: boolean
  schedule: string // cron expression
}

export enum ScriptLanguage {
  JAVASCRIPT = 'JAVASCRIPT',
  PYTHON = 'PYTHON',
  BASH = 'BASH',
  POWERSHELL = 'POWERSHELL'
}

// Event types for React integration
export interface IntegrityMonitoringEvents {
  'check-completed': IntegrityResult
  'alert-created': IntegrityAlert
  'deviation-detected': IntegrityDeviation
  'baseline-updated': IntegrityBaseline
  'monitoring-started': { timestamp: Date }
  'monitoring-stopped': { timestamp: Date }
  'worker-error': { error: Error; timestamp: Date }
  'performance-warning': { metric: string; value: number; threshold: number }
}

// Hook return types
export interface UseIntegrityMonitoring {
  isMonitoring: boolean
  status: IntegrityStatusSummary
  alerts: IntegrityAlert[]
  recentResults: IntegrityResult[]
  performance: IntegrityPerformance
  startMonitoring: () => Promise<void>
  stopMonitoring: () => Promise<void>
  runCheck: (checkId: string) => Promise<IntegrityResult>
  acknowledgeAlert: (alertId: string) => Promise<void>
  resolveAlert: (alertId: string) => Promise<void>
  createBaseline: (checkId: string) => Promise<IntegrityBaseline>
  updateConfiguration: (config: Partial<IntegrityMonitoringConfig>) => Promise<void>
  generateReport: (type: IntegrityReportType, period: ReportPeriod) => Promise<IntegrityReport>
  error: Error | null
  loading: boolean
}

// Service response types
export interface IntegrityServiceResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  warnings?: string[]
  metadata?: Record<string, any>
}

export interface IntegrityBatchResult {
  results: IntegrityResult[]
  summary: IntegrityStatusSummary
  errors: Array<{ checkId: string; error: string }>
  duration: number
  timestamp: Date
}

export interface IntegritySystemHealth {
  overall: HealthStatus
  components: Record<string, ComponentHealth>
  lastUpdated: Date
  metrics: IntegrityMetrics
  alerts: IntegrityAlert[]
  recommendations: string[]
}

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  DEGRADED = 'DEGRADED',
  CRITICAL = 'CRITICAL',
  UNKNOWN = 'UNKNOWN'
}

export interface ComponentHealth {
  status: HealthStatus
  lastCheck: Date
  message: string
  metrics?: Record<string, number>
}