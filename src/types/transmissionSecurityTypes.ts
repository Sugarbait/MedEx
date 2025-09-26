/**
 * TypeScript definitions for Enhanced Transmission Security System
 * HIPAA-compliant SSL/TLS monitoring and Certificate Transparency validation
 */

export interface CertificateInfo {
  subject: string
  issuer: string
  serialNumber: string
  notBefore: Date
  notAfter: Date
  fingerprint: string
  signatureAlgorithm: string
  publicKeyAlgorithm: string
  keySize: number
  extensions: CertificateExtension[]
  isValid: boolean
  daysUntilExpiry: number
}

export interface CertificateExtension {
  oid: string
  critical: boolean
  value: string
}

export interface CTLogEntry {
  logId: string
  timestamp: number
  certificateChain: string[]
  precertificate?: boolean
  leafCertificate: CertificateInfo
  source: string
  verified: boolean
  suspicious: boolean
}

export interface CTMonitoringConfig {
  domains: string[]
  logSources: string[]
  checkInterval: number
  alertThresholds: {
    newCertificateAlert: boolean
    expirationWarningDays: number
    suspiciousIssuerAlert: boolean
  }
  trustedIssuers: string[]
}

export interface SecurityHeaderCheck {
  header: string
  expected: string
  actual?: string
  present: boolean
  compliant: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  recommendation?: string
}

export interface HSTSConfig {
  maxAge: number
  includeSubDomains: boolean
  preload: boolean
  valid: boolean
}

export interface CSPDirective {
  directive: string
  sources: string[]
  violations: CSPViolation[]
  secure: boolean
}

export interface CSPViolation {
  directive: string
  blockedURI: string
  violatedDirective: string
  sourceFile?: string
  lineNumber?: number
  timestamp: Date
  userAgent?: string
}

export interface TLSConfiguration {
  version: string
  cipherSuite: string
  keyExchange: string
  authentication: string
  encryption: string
  macAlgorithm: string
  secure: boolean
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  vulnerabilities: string[]
}

export interface SecurityAssessment {
  domain: string
  timestamp: Date
  overallGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  certificates: CertificateInfo[]
  headers: SecurityHeaderCheck[]
  hsts: HSTSConfig
  csp: CSPDirective[]
  tls: TLSConfiguration
  ctCompliance: boolean
  recommendations: SecurityRecommendation[]
  risks: SecurityRisk[]
}

export interface SecurityRecommendation {
  category: 'certificate' | 'headers' | 'tls' | 'csp' | 'hsts'
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  action: string
  impact: string
}

export interface SecurityRisk {
  id: string
  type: 'certificate' | 'configuration' | 'protocol' | 'header'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  impact: string
  mitigation: string
  detected: Date
  resolved: boolean
}

export interface TransmissionSecurityEvent {
  id: string
  type: 'certificate_change' | 'ct_violation' | 'header_missing' | 'tls_weakness' | 'csp_violation'
  severity: 'low' | 'medium' | 'high' | 'critical'
  domain: string
  description: string
  details: any
  timestamp: Date
  acknowledged: boolean
  resolved: boolean
  respondedBy?: string
  responseTime?: Date
  mitigation?: string
}

export interface CertificatePinConfig {
  hostname: string
  pins: string[]
  backupPins: string[]
  algorithm: 'sha256' | 'sha1'
  enforced: boolean
  reportUri?: string
}

export interface SecurityMonitoringConfig {
  enabled: boolean
  checkInterval: number
  alerting: {
    email: boolean
    dashboard: boolean
    audit: boolean
    emergency: boolean
  }
  thresholds: {
    certificateExpiryDays: number
    tlsGradeMinimum: string
    headerComplianceThreshold: number
    cspViolationLimit: number
  }
  domains: string[]
  ctMonitoring: CTMonitoringConfig
  certificatePinning: CertificatePinConfig[]
}

export interface TransmissionSecurityMetrics {
  certificateHealth: {
    total: number
    valid: number
    expiringSoon: number
    expired: number
    suspicious: number
  }
  headerCompliance: {
    total: number
    compliant: number
    nonCompliant: number
    missing: number
    score: number
  }
  tlsConfiguration: {
    grade: string
    version: string
    strength: 'weak' | 'medium' | 'strong' | 'excellent'
    vulnerabilities: number
  }
  ctCompliance: {
    monitored: number
    compliant: number
    violations: number
    lastCheck: Date
  }
  incidentStats: {
    total: number
    resolved: number
    pending: number
    critical: number
    averageResponseTime: number
  }
}

export interface SecurityHeadersConfig {
  strictTransportSecurity: {
    maxAge: number
    includeSubDomains: boolean
    preload: boolean
  }
  contentSecurityPolicy: {
    directives: Record<string, string[]>
    reportUri?: string
    reportOnly: boolean
  }
  xFrameOptions: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM'
  xContentTypeOptions: boolean
  xXSSProtection: {
    enabled: boolean
    mode: 'block' | 'report'
    reportUri?: string
  }
  referrerPolicy: string
  permissionsPolicy?: Record<string, string[]>
  crossOriginEmbedderPolicy?: string
  crossOriginOpenerPolicy?: string
  crossOriginResourcePolicy?: string
}

export interface TransmissionSecurityService {
  // Certificate monitoring
  getCertificateInfo(domain: string): Promise<CertificateInfo | null>
  monitorCertificates(domains: string[]): Promise<CertificateInfo[]>
  validateCertificateChain(chain: string[]): Promise<boolean>

  // CT monitoring
  checkCTLogs(domain: string): Promise<CTLogEntry[]>
  validateCTEntry(entry: CTLogEntry): Promise<boolean>
  monitorNewCertificates(config: CTMonitoringConfig): Promise<CTLogEntry[]>

  // Security headers
  validateSecurityHeaders(url: string): Promise<SecurityHeaderCheck[]>
  checkHSTS(domain: string): Promise<HSTSConfig>
  validateCSP(policy: string): Promise<CSPDirective[]>

  // TLS configuration
  analyzeTLSConfiguration(domain: string): Promise<TLSConfiguration>
  checkTLSVulnerabilities(config: TLSConfiguration): Promise<string[]>

  // Overall assessment
  performSecurityAssessment(domain: string): Promise<SecurityAssessment>
  getSecurityMetrics(): Promise<TransmissionSecurityMetrics>

  // Incident management
  reportSecurityEvent(event: Omit<TransmissionSecurityEvent, 'id' | 'timestamp'>): Promise<string>
  getSecurityEvents(filter?: { severity?: string; resolved?: boolean }): Promise<TransmissionSecurityEvent[]>
  acknowledgeEvent(eventId: string, respondedBy: string): Promise<boolean>
  resolveEvent(eventId: string, mitigation: string): Promise<boolean>

  // Configuration
  updateMonitoringConfig(config: Partial<SecurityMonitoringConfig>): Promise<boolean>
  getMonitoringConfig(): Promise<SecurityMonitoringConfig>

  // Real-time monitoring
  startMonitoring(): Promise<void>
  stopMonitoring(): Promise<void>
  isMonitoring(): boolean
}

export interface UseTransmissionSecurityReturn {
  // State
  isMonitoring: boolean
  lastAssessment: SecurityAssessment | null
  metrics: TransmissionSecurityMetrics | null
  events: TransmissionSecurityEvent[]
  loading: boolean
  error: string | null

  // Actions
  startMonitoring: () => Promise<void>
  stopMonitoring: () => Promise<void>
  performAssessment: (domain?: string) => Promise<void>
  acknowledgeEvent: (eventId: string) => Promise<void>
  resolveEvent: (eventId: string, mitigation: string) => Promise<void>
  refreshMetrics: () => Promise<void>

  // Configuration
  updateConfig: (config: Partial<SecurityMonitoringConfig>) => Promise<void>
  config: SecurityMonitoringConfig | null
}

// Constants for security standards
export const SECURITY_STANDARDS = {
  TLS_VERSIONS: {
    MINIMUM: 'TLS 1.2',
    RECOMMENDED: 'TLS 1.3'
  },
  HSTS_MIN_AGE: 31536000, // 1 year
  CERTIFICATE_WARNING_DAYS: 30,
  CSP_REPORT_SAMPLE_RATE: 0.1,
  MONITORING_INTERVALS: {
    CERTIFICATE: 3600000, // 1 hour
    HEADERS: 1800000, // 30 minutes
    CT_LOGS: 21600000, // 6 hours
    TLS_CONFIG: 43200000 // 12 hours
  }
} as const

// Error types
export class TransmissionSecurityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'TransmissionSecurityError'
  }
}

export class CertificateValidationError extends TransmissionSecurityError {
  constructor(message: string, details?: any) {
    super(message, 'CERTIFICATE_VALIDATION_ERROR', details)
    this.name = 'CertificateValidationError'
  }
}

export class CTMonitoringError extends TransmissionSecurityError {
  constructor(message: string, details?: any) {
    super(message, 'CT_MONITORING_ERROR', details)
    this.name = 'CTMonitoringError'
  }
}

export class SecurityHeaderError extends TransmissionSecurityError {
  constructor(message: string, details?: any) {
    super(message, 'SECURITY_HEADER_ERROR', details)
    this.name = 'SecurityHeaderError'
  }
}

export class TLSConfigurationError extends TransmissionSecurityError {
  constructor(message: string, details?: any) {
    super(message, 'TLS_CONFIGURATION_ERROR', details)
    this.name = 'TLSConfigurationError'
  }
}