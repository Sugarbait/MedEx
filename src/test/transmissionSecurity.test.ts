/**
 * Enhanced Transmission Security System Tests
 * Comprehensive testing for HIPAA-compliant SSL/TLS monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  transmissionSecurityService,
  TransmissionSecurityService
} from '@/services/transmissionSecurityService'
import { certificateMonitoringService } from '@/services/certificateMonitoringService'
import { transmissionSecurityAuditService } from '@/services/transmissionSecurityAuditService'
import {
  validateAllSecurityHeaders,
  parseHSTSHeader,
  analyzeCSPPolicy,
  calculateSecurityScore,
  checkHIPAACompliance
} from '@/utils/securityHeaderUtils'
import {
  CertificateInfo,
  SecurityHeaderCheck,
  TransmissionSecurityEvent,
  SecurityAssessment
} from '@/types/transmissionSecurityTypes'

// Mock localStorage for Node.js environment
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => store[key] = value,
    removeItem: (key: string) => delete store[key],
    clear: () => store = {},
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length }
  }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })

// Mock window and document for browser APIs
Object.defineProperty(global, 'window', {
  value: {
    location: { hostname: 'test.example.com', href: 'https://test.example.com' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
})

Object.defineProperty(global, 'document', {
  value: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
})

Object.defineProperty(global, 'navigator', {
  value: {
    userAgent: 'Test User Agent'
  }
})

// Mock crypto for UUID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 15)
  }
})

// Mock external dependencies
vi.mock('@/services/auditService', () => ({
  auditService: {
    logSecurityEvent: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('@/services/incidentResponseService', () => ({
  incidentResponseService: {
    createIncident: vi.fn().mockResolvedValue('incident-123')
  }
}))

// Mock fetch for HTTP requests
global.fetch = vi.fn()

describe('Enhanced Transmission Security System', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear()

    // Reset fetch mock
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any running intervals or timeouts
    transmissionSecurityService.stopMonitoring()
    certificateMonitoringService.stopMonitoring()
  })

  describe('TransmissionSecurityService', () => {
    it('should initialize with default configuration', async () => {
      const config = await transmissionSecurityService.getMonitoringConfig()

      expect(config).toBeDefined()
      expect(config.enabled).toBe(true)
      expect(config.domains).toContain('carexps.nexasync.ca')
      expect(config.alerting.audit).toBe(true)
    })

    it('should start and stop monitoring', async () => {
      expect(transmissionSecurityService.isMonitoring()).toBe(false)

      await transmissionSecurityService.startMonitoring()
      expect(transmissionSecurityService.isMonitoring()).toBe(true)

      await transmissionSecurityService.stopMonitoring()
      expect(transmissionSecurityService.isMonitoring()).toBe(false)
    })

    it('should update monitoring configuration', async () => {
      const newConfig = {
        checkInterval: 60000,
        domains: ['test.example.com'],
        alerting: {
          email: false,
          dashboard: true,
          audit: true,
          emergency: false
        }
      }

      const result = await transmissionSecurityService.updateMonitoringConfig(newConfig)
      expect(result).toBe(true)

      const updatedConfig = await transmissionSecurityService.getMonitoringConfig()
      expect(updatedConfig.checkInterval).toBe(60000)
      expect(updatedConfig.domains).toContain('test.example.com')
      expect(updatedConfig.alerting.email).toBe(false)
    })

    it('should report and manage security events', async () => {
      const eventData = {
        type: 'certificate_change' as const,
        severity: 'high' as const,
        domain: 'test.example.com',
        description: 'Test certificate issue',
        details: { test: 'data' },
        acknowledged: false,
        resolved: false
      }

      const eventId = await transmissionSecurityService.reportSecurityEvent(eventData)
      expect(eventId).toBeDefined()

      const events = await transmissionSecurityService.getSecurityEvents()
      expect(events).toHaveLength(1)
      expect(events[0].id).toBe(eventId)
      expect(events[0].description).toBe('Test certificate issue')

      // Test event acknowledgment
      const acknowledged = await transmissionSecurityService.acknowledgeEvent(eventId, 'test-user')
      expect(acknowledged).toBe(true)

      // Test event resolution
      const resolved = await transmissionSecurityService.resolveEvent(eventId, 'Test mitigation')
      expect(resolved).toBe(true)

      const updatedEvents = await transmissionSecurityService.getSecurityEvents()
      expect(updatedEvents[0].acknowledged).toBe(true)
      expect(updatedEvents[0].resolved).toBe(true)
      expect(updatedEvents[0].mitigation).toBe('Test mitigation')
    })

    it('should validate security headers', async () => {
      // Mock fetch response with headers
      const mockResponse = {
        ok: true,
        headers: new Headers({
          'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
          'content-security-policy': "default-src 'self'; script-src 'self'",
          'x-frame-options': 'DENY',
          'x-content-type-options': 'nosniff',
          'x-xss-protection': '1; mode=block',
          'referrer-policy': 'strict-origin-when-cross-origin'
        })
      }

      global.fetch = vi.fn().mockResolvedValue(mockResponse)

      const headerChecks = await transmissionSecurityService.validateSecurityHeaders('https://test.example.com')

      expect(headerChecks).toBeDefined()
      expect(headerChecks.length).toBeGreaterThan(0)

      const hstsCheck = headerChecks.find(h => h.header === 'Strict-Transport-Security')
      expect(hstsCheck?.compliant).toBe(true)
    })

    it('should generate security metrics', async () => {
      // Add some test events
      await transmissionSecurityService.reportSecurityEvent({
        type: 'certificate_change',
        severity: 'critical',
        domain: 'test1.example.com',
        description: 'Critical cert issue',
        details: {},
        acknowledged: false,
        resolved: false
      })

      await transmissionSecurityService.reportSecurityEvent({
        type: 'header_missing',
        severity: 'medium',
        domain: 'test2.example.com',
        description: 'Missing header',
        details: {},
        acknowledged: true,
        resolved: true
      })

      const metrics = await transmissionSecurityService.getSecurityMetrics()

      expect(metrics).toBeDefined()
      expect(metrics.incidentStats.total).toBe(2)
      expect(metrics.incidentStats.critical).toBe(1)
      expect(metrics.incidentStats.resolved).toBe(1)
      expect(metrics.incidentStats.pending).toBe(1)
    })
  })

  describe('CertificateMonitoringService', () => {
    it('should start and stop certificate monitoring', async () => {
      expect(certificateMonitoringService.isMonitoring()).toBe(false)

      await certificateMonitoringService.startMonitoring()
      expect(certificateMonitoringService.isMonitoring()).toBe(true)

      await certificateMonitoringService.stopMonitoring()
      expect(certificateMonitoringService.isMonitoring()).toBe(false)
    })

    it('should validate certificates', async () => {
      const validCertificate: CertificateInfo = {
        subject: 'CN=test.example.com',
        issuer: "Let's Encrypt",
        serialNumber: '123456789',
        notBefore: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        notAfter: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        fingerprint: 'abcdef123456',
        signatureAlgorithm: 'SHA256withRSA',
        publicKeyAlgorithm: 'RSA',
        keySize: 2048,
        extensions: [],
        isValid: true,
        daysUntilExpiry: 60
      }

      const isValid = await certificateMonitoringService.validateCertificate(validCertificate)
      expect(isValid).toBe(true)

      // Test expired certificate
      const expiredCertificate: CertificateInfo = {
        ...validCertificate,
        notAfter: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        isValid: false,
        daysUntilExpiry: -1
      }

      const isExpiredValid = await certificateMonitoringService.validateCertificate(expiredCertificate)
      expect(isExpiredValid).toBe(false)
    })

    it('should get monitoring statistics', async () => {
      const stats = await certificateMonitoringService.getMonitoringStatistics()

      expect(stats).toBeDefined()
      expect(typeof stats.totalCertificates).toBe('number')
      expect(typeof stats.expiringCertificates).toBe('number')
      expect(typeof stats.suspiciousCertificates).toBe('number')
      expect(stats.lastCheckTime).toBeInstanceOf(Date)
      expect(typeof stats.domainsMonitored).toBe('number')
    })

    it('should update configuration', async () => {
      const newConfig = {
        domains: ['new.example.com'],
        checkInterval: 3600000,
        alertThresholds: {
          newCertificateAlert: false,
          expirationWarningDays: 14,
          suspiciousIssuerAlert: true
        }
      }

      await certificateMonitoringService.updateConfiguration(newConfig)

      const config = certificateMonitoringService.getConfiguration()
      expect(config.domains).toContain('new.example.com')
      expect(config.alertThresholds.expirationWarningDays).toBe(14)
    })
  })

  describe('Security Header Utilities', () => {
    it('should validate all security headers', () => {
      const headers = new Headers({
        'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
        'content-security-policy': "default-src 'self'; object-src 'none'",
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'x-xss-protection': '1; mode=block',
        'referrer-policy': 'strict-origin-when-cross-origin'
      })

      const checks = validateAllSecurityHeaders(headers)

      expect(checks).toBeDefined()
      expect(checks.length).toBeGreaterThan(0)

      const hstsCheck = checks.find(h => h.header === 'Strict-Transport-Security')
      expect(hstsCheck?.compliant).toBe(true)
      expect(hstsCheck?.present).toBe(true)
    })

    it('should parse HSTS header correctly', () => {
      const hstsHeader = 'max-age=31536000; includeSubDomains; preload'
      const config = parseHSTSHeader(hstsHeader)

      expect(config.maxAge).toBe(31536000)
      expect(config.includeSubDomains).toBe(true)
      expect(config.preload).toBe(true)
      expect(config.valid).toBe(true)

      // Test invalid HSTS
      const invalidHsts = 'max-age=86400'
      const invalidConfig = parseHSTSHeader(invalidHsts)
      expect(invalidConfig.valid).toBe(false)
    })

    it('should analyze CSP policy', () => {
      const cspPolicy = "default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'"
      const analysis = analyzeCSPPolicy(cspPolicy)

      expect(analysis.directives).toBeDefined()
      expect(analysis.directives.length).toBeGreaterThan(0)
      expect(analysis.securityIssues).toBeDefined()
      expect(analysis.recommendations).toBeDefined()

      // Check for unsafe-inline detection
      const scriptSrcDirective = analysis.directives.find(d => d.directive === 'script-src')
      expect(scriptSrcDirective?.sources).toContain("'unsafe-inline'")
      expect(analysis.securityIssues).toContain("script-src allows 'unsafe-inline'")
    })

    it('should calculate security score', () => {
      const compliantChecks: SecurityHeaderCheck[] = [
        {
          header: 'Strict-Transport-Security',
          expected: 'max-age=31536000; includeSubDomains',
          actual: 'max-age=31536000; includeSubDomains; preload',
          present: true,
          compliant: true,
          severity: 'low'
        },
        {
          header: 'Content-Security-Policy',
          expected: 'Comprehensive CSP',
          actual: "default-src 'self'",
          present: true,
          compliant: true,
          severity: 'low'
        }
      ]

      const { score, grade } = calculateSecurityScore(compliantChecks)
      expect(score).toBeGreaterThan(80)
      expect(['A+', 'A', 'B']).toContain(grade)

      // Test non-compliant headers
      const nonCompliantChecks: SecurityHeaderCheck[] = [
        {
          header: 'Strict-Transport-Security',
          expected: 'max-age=31536000; includeSubDomains',
          present: false,
          compliant: false,
          severity: 'high'
        }
      ]

      const { score: lowScore, grade: lowGrade } = calculateSecurityScore(nonCompliantChecks)
      expect(lowScore).toBeLessThan(50)
      expect(['D', 'F']).toContain(lowGrade)
    })

    it('should check HIPAA compliance', () => {
      const compliantHeaders: SecurityHeaderCheck[] = [
        {
          header: 'Strict-Transport-Security',
          expected: 'max-age=31536000; includeSubDomains',
          present: true,
          compliant: true,
          severity: 'low'
        },
        {
          header: 'Content-Security-Policy',
          expected: 'Comprehensive CSP',
          present: true,
          compliant: true,
          severity: 'low'
        },
        {
          header: 'X-Frame-Options',
          expected: 'DENY',
          present: true,
          compliant: true,
          severity: 'low'
        },
        {
          header: 'X-Content-Type-Options',
          expected: 'nosniff',
          present: true,
          compliant: true,
          severity: 'low'
        }
      ]

      const compliance = checkHIPAACompliance(compliantHeaders)
      expect(compliance.compliant).toBe(true)
      expect(compliance.missingHeaders).toHaveLength(0)
      expect(compliance.issues).toHaveLength(0)

      // Test non-compliant case
      const nonCompliantHeaders = compliantHeaders.map(h => ({ ...h, compliant: false }))
      const nonCompliance = checkHIPAACompliance(nonCompliantHeaders)
      expect(nonCompliance.compliant).toBe(false)
      expect(nonCompliance.issues.length).toBeGreaterThan(0)
    })
  })

  describe('Transmission Security Audit Service', () => {
    it('should log certificate events', async () => {
      const certificate: CertificateInfo = {
        subject: 'CN=test.example.com',
        issuer: "Let's Encrypt",
        serialNumber: '123456789',
        notBefore: new Date(),
        notAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        fingerprint: 'abcdef123456',
        signatureAlgorithm: 'SHA256withRSA',
        publicKeyAlgorithm: 'RSA',
        keySize: 2048,
        extensions: [],
        isValid: true,
        daysUntilExpiry: 30
      }

      await transmissionSecurityAuditService.logCertificateEvent(
        'expiring',
        certificate,
        'test.example.com'
      )

      // Verify audit log was created
      const auditLog = JSON.parse(localStorage.getItem('transmission_security_audit_log') || '[]')
      expect(auditLog.length).toBe(1)
      expect(auditLog[0].eventType).toBe('certificate_monitoring')
      expect(auditLog[0].subType).toBe('expiring')
      expect(auditLog[0].domain).toBe('test.example.com')
    })

    it('should log header validation events', async () => {
      const headers: SecurityHeaderCheck[] = [
        {
          header: 'Strict-Transport-Security',
          expected: 'max-age=31536000',
          present: false,
          compliant: false,
          severity: 'high',
          recommendation: 'Add HSTS header'
        }
      ]

      await transmissionSecurityAuditService.logHeaderValidationEvent(
        'test.example.com',
        headers,
        50
      )

      const auditLog = JSON.parse(localStorage.getItem('transmission_security_audit_log') || '[]')
      expect(auditLog.length).toBe(1)
      expect(auditLog[0].eventType).toBe('header_validation')
      expect(auditLog[0].severity).toBe('high')
    })

    it('should generate compliance report', async () => {
      // Add some test audit entries
      await transmissionSecurityAuditService.logCertificateEvent(
        'expired',
        {
          subject: 'CN=test.example.com',
          issuer: 'Test CA',
          serialNumber: '123',
          notBefore: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          notAfter: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          fingerprint: 'abc123',
          signatureAlgorithm: 'SHA256withRSA',
          publicKeyAlgorithm: 'RSA',
          keySize: 2048,
          extensions: [],
          isValid: false,
          daysUntilExpiry: -1
        },
        'test.example.com'
      )

      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      }

      const report = await transmissionSecurityAuditService.generateComplianceReport(timeRange)

      expect(report).toBeDefined()
      expect(report.reportId).toBeDefined()
      expect(report.summary.totalEvents).toBeGreaterThan(0)
      expect(report.summary.criticalEvents).toBeGreaterThan(0)
      expect(report.summary.overallStatus).toBe('critical')
      expect(report.events.length).toBeGreaterThan(0)
      expect(report.actionItems.length).toBeGreaterThan(0)
    })

    it('should log configuration changes', async () => {
      const changes = {
        checkInterval: 60000,
        domains: ['new.example.com']
      }

      await transmissionSecurityAuditService.logConfigurationChange(
        'monitoring_config',
        changes,
        'test-user'
      )

      const auditLog = JSON.parse(localStorage.getItem('transmission_security_audit_log') || '[]')
      expect(auditLog.length).toBe(1)
      expect(auditLog[0].eventType).toBe('configuration_change')
      expect(auditLog[0].details.changes).toEqual(changes)
      expect(auditLog[0].details.userId).toBe('test-user')
    })
  })

  describe('Integration Tests', () => {
    it('should perform complete security assessment', async () => {
      // Mock responses for all assessment components
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({
            'strict-transport-security': 'max-age=31536000; includeSubDomains',
            'content-security-policy': "default-src 'self'",
            'x-frame-options': 'DENY'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            version: 'TLS 1.3',
            cipherSuite: 'TLS_AES_256_GCM_SHA384',
            grade: 'A+'
          })
        })

      const assessment = await transmissionSecurityService.performSecurityAssessment('test.example.com')

      expect(assessment).toBeDefined()
      expect(assessment.domain).toBe('test.example.com')
      expect(assessment.overallGrade).toBeDefined()
      expect(assessment.headers.length).toBeGreaterThan(0)
      expect(assessment.recommendations.length).toBeGreaterThan(0)
    })

    it('should handle monitoring lifecycle', async () => {
      // Start monitoring
      await transmissionSecurityService.startMonitoring()
      expect(transmissionSecurityService.isMonitoring()).toBe(true)

      // Report an event
      const eventId = await transmissionSecurityService.reportSecurityEvent({
        type: 'certificate_change',
        severity: 'high',
        domain: 'test.example.com',
        description: 'Test event',
        details: {},
        acknowledged: false,
        resolved: false
      })

      // Verify event was logged
      const events = await transmissionSecurityService.getSecurityEvents()
      expect(events.length).toBe(1)

      // Get metrics
      const metrics = await transmissionSecurityService.getSecurityMetrics()
      expect(metrics.incidentStats.total).toBe(1)

      // Stop monitoring
      await transmissionSecurityService.stopMonitoring()
      expect(transmissionSecurityService.isMonitoring()).toBe(false)
    })

    it('should handle error conditions gracefully', async () => {
      // Test with network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      // Should not throw, but handle gracefully
      await expect(transmissionSecurityService.validateSecurityHeaders('https://invalid.example.com'))
        .rejects.toThrow()

      // Service should still be functional
      expect(transmissionSecurityService.isMonitoring()).toBe(false)
    })
  })
})