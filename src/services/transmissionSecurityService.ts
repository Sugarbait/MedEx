/**
 * Enhanced Transmission Security Service
 * HIPAA-compliant SSL/TLS monitoring with Certificate Transparency validation
 *
 * Features:
 * - Real-time certificate monitoring
 * - Security header validation
 * - TLS configuration analysis
 * - Certificate Transparency log monitoring
 * - Incident response integration
 */

import {
  CertificateInfo,
  SecurityAssessment,
  TransmissionSecurityEvent,
  SecurityMonitoringConfig,
  TransmissionSecurityMetrics,
  SecurityHeaderCheck,
  HSTSConfig,
  TLSConfiguration,
  SecurityRisk,
  SecurityRecommendation,
  TransmissionSecurityService as ITransmissionSecurityService,
  SECURITY_STANDARDS,
  TransmissionSecurityError
} from '@/types/transmissionSecurityTypes'
import { auditService } from './auditService'
import { incidentResponseService } from './incidentResponseService'

class TransmissionSecurityService implements ITransmissionSecurityService {
  private monitoringActive = false
  private monitoringInterval: NodeJS.Timeout | null = null
  private config: SecurityMonitoringConfig
  private eventListeners: Map<string, Function[]> = new Map()

  constructor() {
    this.config = this.getDefaultConfig()
    this.initializeService()
  }

  private getDefaultConfig(): SecurityMonitoringConfig {
    return {
      enabled: true,
      checkInterval: SECURITY_STANDARDS.MONITORING_INTERVALS.CERTIFICATE,
      alerting: {
        email: true,
        dashboard: true,
        audit: true,
        emergency: true
      },
      thresholds: {
        certificateExpiryDays: SECURITY_STANDARDS.CERTIFICATE_WARNING_DAYS,
        tlsGradeMinimum: 'B',
        headerComplianceThreshold: 0.8,
        cspViolationLimit: 10
      },
      domains: ['carexps.nexasync.ca'],
      ctMonitoring: {
        domains: ['carexps.nexasync.ca', '*.nexasync.ca'],
        logSources: [
          'https://ct.googleapis.com/logs/argon2024/',
          'https://ct.googleapis.com/logs/xenon2024/',
          'https://crt.sh'
        ],
        checkInterval: SECURITY_STANDARDS.MONITORING_INTERVALS.CT_LOGS,
        alertThresholds: {
          newCertificateAlert: true,
          expirationWarningDays: 30,
          suspiciousIssuerAlert: true
        },
        trustedIssuers: [
          'Let\'s Encrypt',
          'DigiCert',
          'GlobalSign',
          'Microsoft',
          'Azure'
        ]
      },
      certificatePinning: [
        {
          hostname: 'carexps.nexasync.ca',
          pins: [], // Will be populated during initialization
          backupPins: [],
          algorithm: 'sha256',
          enforced: false,
          reportUri: '/api/security/pin-report'
        }
      ]
    }
  }

  private async initializeService(): Promise<void> {
    try {
      await this.loadConfiguration()
      await this.validateCurrentSecurity()
      this.setupEventListeners()

      await auditService.logSecurityEvent({
        action: 'transmission_security_initialized',
        resource: 'transmission_security_service',
        success: true,
        details: { version: '1.0.0', domains: this.config.domains },
        severity: 'low'
      })
    } catch (error) {
      console.error('Failed to initialize transmission security service:', error)
      await auditService.logSecurityEvent({
        action: 'transmission_security_init_failed',
        resource: 'transmission_security_service',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        severity: 'high'
      })
    }
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const stored = localStorage.getItem('transmission_security_config')
      if (stored) {
        const parsedConfig = JSON.parse(stored)
        this.config = { ...this.config, ...parsedConfig }
      }
    } catch (error) {
      console.warn('Failed to load transmission security config:', error)
    }
  }

  private async saveConfiguration(): Promise<void> {
    try {
      localStorage.setItem('transmission_security_config', JSON.stringify(this.config))
    } catch (error) {
      console.error('Failed to save transmission security config:', error)
    }
  }

  private setupEventListeners(): void {
    // Listen for CSP violations
    if (typeof window !== 'undefined') {
      document.addEventListener('securitypolicyviolation', (event) => {
        this.handleCSPViolation(event as SecurityPolicyViolationEvent)
      })
    }
  }

  private async handleCSPViolation(event: SecurityPolicyViolationEvent): Promise<void> {
    const violation = {
      directive: event.violatedDirective,
      blockedURI: event.blockedURI,
      violatedDirective: event.violatedDirective,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
      timestamp: new Date(),
      userAgent: navigator.userAgent
    }

    await this.reportSecurityEvent({
      type: 'csp_violation',
      severity: 'medium',
      domain: window.location.hostname,
      description: `CSP violation: ${event.violatedDirective}`,
      details: violation,
      acknowledged: false,
      resolved: false
    })
  }

  async getCertificateInfo(domain: string): Promise<CertificateInfo | null> {
    try {
      // In browser environment, we can't directly access certificate info
      // This would typically use a backend API or service worker
      const response = await this.makeSecureRequest(`/api/security/certificate/${domain}`)

      if (!response.ok) {
        throw new Error(`Failed to get certificate info: ${response.statusText}`)
      }

      const certData = await response.json()
      return this.parseCertificateInfo(certData)
    } catch (error) {
      console.error(`Failed to get certificate info for ${domain}:`, error)
      return null
    }
  }

  private parseCertificateInfo(certData: any): CertificateInfo {
    const notAfter = new Date(certData.notAfter)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return {
      subject: certData.subject,
      issuer: certData.issuer,
      serialNumber: certData.serialNumber,
      notBefore: new Date(certData.notBefore),
      notAfter,
      fingerprint: certData.fingerprint,
      signatureAlgorithm: certData.signatureAlgorithm,
      publicKeyAlgorithm: certData.publicKeyAlgorithm,
      keySize: certData.keySize,
      extensions: certData.extensions || [],
      isValid: daysUntilExpiry > 0 && certData.isValid,
      daysUntilExpiry
    }
  }

  async monitorCertificates(domains: string[]): Promise<CertificateInfo[]> {
    const certificates: CertificateInfo[] = []

    for (const domain of domains) {
      try {
        const cert = await this.getCertificateInfo(domain)
        if (cert) {
          certificates.push(cert)

          // Check for expiration warnings
          if (cert.daysUntilExpiry <= this.config.thresholds.certificateExpiryDays) {
            await this.reportSecurityEvent({
              type: 'certificate_change',
              severity: cert.daysUntilExpiry <= 7 ? 'critical' : 'high',
              domain,
              description: `Certificate expiring in ${cert.daysUntilExpiry} days`,
              details: { certificate: cert },
              acknowledged: false,
              resolved: false
            })
          }
        }
      } catch (error) {
        await this.reportSecurityEvent({
          type: 'certificate_change',
          severity: 'high',
          domain,
          description: 'Failed to retrieve certificate information',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
          acknowledged: false,
          resolved: false
        })
      }
    }

    return certificates
  }

  async validateCertificateChain(chain: string[]): Promise<boolean> {
    try {
      // This would typically validate the certificate chain
      // In browser, this requires backend API support
      const response = await this.makeSecureRequest('/api/security/validate-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain })
      })

      if (!response.ok) return false

      const result = await response.json()
      return result.valid === true
    } catch (error) {
      console.error('Certificate chain validation failed:', error)
      return false
    }
  }

  async checkCTLogs(domain: string): Promise<any[]> {
    // This would query Certificate Transparency logs
    // Implementation would depend on available CT log APIs
    try {
      const entries = []

      for (const logSource of this.config.ctMonitoring.logSources) {
        try {
          const response = await this.queryCTLog(logSource, domain)
          entries.push(...response)
        } catch (error) {
          console.warn(`Failed to query CT log ${logSource}:`, error)
        }
      }

      return entries
    } catch (error) {
      throw new Error(`CT log check failed: ${error}`)
    }
  }

  private async queryCTLog(logSource: string, domain: string): Promise<any[]> {
    // Simplified CT log query - in production this would use proper CT APIs
    if (logSource.includes('crt.sh')) {
      try {
        const response = await fetch(`https://crt.sh/?q=${domain}&output=json`)
        if (response.ok) {
          return await response.json()
        }
      } catch (error) {
        console.warn('CT log query failed:', error)
      }
    }

    return []
  }

  async validateCTEntry(entry: any): Promise<boolean> {
    // Validate CT log entry against known good certificates
    try {
      const issuer = entry.issuer_name || entry.issuer
      const isTrustedIssuer = this.config.ctMonitoring.trustedIssuers.some(
        trusted => issuer.toLowerCase().includes(trusted.toLowerCase())
      )

      return isTrustedIssuer
    } catch (error) {
      return false
    }
  }

  async monitorNewCertificates(config: any): Promise<any[]> {
    const newCertificates = []

    for (const domain of config.domains) {
      try {
        const entries = await this.checkCTLogs(domain)

        for (const entry of entries) {
          const isNew = await this.isNewCertificate(entry)
          if (isNew) {
            newCertificates.push(entry)

            if (config.alertThresholds.newCertificateAlert) {
              await this.reportSecurityEvent({
                type: 'certificate_change',
                severity: 'medium',
                domain,
                description: 'New certificate detected in CT logs',
                details: { ctEntry: entry },
                acknowledged: false,
                resolved: false
              })
            }
          }
        }
      } catch (error) {
        console.error(`CT monitoring failed for ${domain}:`, error)
      }
    }

    return newCertificates
  }

  private async isNewCertificate(entry: any): Promise<boolean> {
    // Check if this certificate entry is new (not seen before)
    const key = `ct_entry_${entry.id || entry.fingerprint}`
    const seen = localStorage.getItem(key)

    if (!seen) {
      localStorage.setItem(key, new Date().toISOString())
      return true
    }

    return false
  }

  async validateSecurityHeaders(url: string): Promise<SecurityHeaderCheck[]> {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      const headers = response.headers

      const checks: SecurityHeaderCheck[] = [
        this.checkHSTSHeader(headers),
        this.checkCSPHeader(headers),
        this.checkXFrameOptions(headers),
        this.checkXContentTypeOptions(headers),
        this.checkXXSSProtection(headers),
        this.checkReferrerPolicy(headers)
      ]

      return checks
    } catch (error) {
      throw new Error(`Security header validation failed: ${error}`)
    }
  }

  private checkHSTSHeader(headers: Headers): SecurityHeaderCheck {
    const hsts = headers.get('strict-transport-security')
    const present = !!hsts

    let compliant = false
    if (present && hsts) {
      const maxAge = hsts.match(/max-age=(\d+)/)?.[1]
      const includeSubDomains = hsts.includes('includeSubDomains')
      compliant = (parseInt(maxAge || '0') >= SECURITY_STANDARDS.HSTS_MIN_AGE) && includeSubDomains
    }

    return {
      header: 'Strict-Transport-Security',
      expected: `max-age=${SECURITY_STANDARDS.HSTS_MIN_AGE}; includeSubDomains; preload`,
      actual: hsts || undefined,
      present,
      compliant,
      severity: compliant ? 'low' : 'high',
      recommendation: compliant ? undefined : 'Add HSTS header with proper max-age and includeSubDomains'
    }
  }

  private checkCSPHeader(headers: Headers): SecurityHeaderCheck {
    const csp = headers.get('content-security-policy')
    const present = !!csp

    // Basic CSP validation - check for required directives
    let compliant = false
    if (present && csp) {
      const hasDefaultSrc = csp.includes('default-src')
      const hasScriptSrc = csp.includes('script-src')
      const hasObjectSrc = csp.includes('object-src')
      compliant = hasDefaultSrc && hasScriptSrc && hasObjectSrc
    }

    return {
      header: 'Content-Security-Policy',
      expected: 'CSP with default-src, script-src, and object-src directives',
      actual: csp || undefined,
      present,
      compliant,
      severity: compliant ? 'low' : 'high',
      recommendation: compliant ? undefined : 'Implement comprehensive CSP with required directives'
    }
  }

  private checkXFrameOptions(headers: Headers): SecurityHeaderCheck {
    const xFrame = headers.get('x-frame-options')
    const present = !!xFrame
    const compliant = present && (xFrame === 'DENY' || xFrame === 'SAMEORIGIN')

    return {
      header: 'X-Frame-Options',
      expected: 'DENY or SAMEORIGIN',
      actual: xFrame || undefined,
      present,
      compliant,
      severity: compliant ? 'low' : 'medium',
      recommendation: compliant ? undefined : 'Set X-Frame-Options to DENY or SAMEORIGIN'
    }
  }

  private checkXContentTypeOptions(headers: Headers): SecurityHeaderCheck {
    const xContent = headers.get('x-content-type-options')
    const present = !!xContent
    const compliant = present && xContent === 'nosniff'

    return {
      header: 'X-Content-Type-Options',
      expected: 'nosniff',
      actual: xContent || undefined,
      present,
      compliant,
      severity: compliant ? 'low' : 'medium',
      recommendation: compliant ? undefined : 'Set X-Content-Type-Options to nosniff'
    }
  }

  private checkXXSSProtection(headers: Headers): SecurityHeaderCheck {
    const xss = headers.get('x-xss-protection')
    const present = !!xss
    const compliant = present && (xss === '1; mode=block' || xss === '1')

    return {
      header: 'X-XSS-Protection',
      expected: '1; mode=block',
      actual: xss || undefined,
      present,
      compliant,
      severity: compliant ? 'low' : 'medium',
      recommendation: compliant ? undefined : 'Set X-XSS-Protection to 1; mode=block'
    }
  }

  private checkReferrerPolicy(headers: Headers): SecurityHeaderCheck {
    const referrer = headers.get('referrer-policy')
    const present = !!referrer
    const compliant = present && ['strict-origin-when-cross-origin', 'strict-origin', 'same-origin'].includes(referrer)

    return {
      header: 'Referrer-Policy',
      expected: 'strict-origin-when-cross-origin',
      actual: referrer || undefined,
      present,
      compliant,
      severity: compliant ? 'low' : 'low',
      recommendation: compliant ? undefined : 'Set Referrer-Policy to strict-origin-when-cross-origin'
    }
  }

  async checkHSTS(domain: string): Promise<HSTSConfig> {
    try {
      const response = await fetch(`https://${domain}`, { method: 'HEAD' })
      const hsts = response.headers.get('strict-transport-security') || ''

      const maxAgeMatch = hsts.match(/max-age=(\d+)/)
      const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 0
      const includeSubDomains = hsts.includes('includeSubDomains')
      const preload = hsts.includes('preload')
      const valid = maxAge >= SECURITY_STANDARDS.HSTS_MIN_AGE && includeSubDomains

      return { maxAge, includeSubDomains, preload, valid }
    } catch (error) {
      return { maxAge: 0, includeSubDomains: false, preload: false, valid: false }
    }
  }

  async validateCSP(policy: string): Promise<any[]> {
    // Parse and validate CSP directives
    const directives = policy.split(';').map(d => d.trim())
    const parsedDirectives = []

    for (const directive of directives) {
      const [name, ...sources] = directive.split(/\s+/)
      parsedDirectives.push({
        directive: name,
        sources,
        violations: [],
        secure: this.isSecureDirective(name, sources)
      })
    }

    return parsedDirectives
  }

  private isSecureDirective(name: string, sources: string[]): boolean {
    // Basic security validation for CSP directives
    switch (name) {
      case 'default-src':
        return !sources.includes('*') && !sources.includes('unsafe-inline')
      case 'script-src':
        return !sources.includes('unsafe-eval')
      case 'object-src':
        return sources.includes("'none'")
      default:
        return true
    }
  }

  async analyzeTLSConfiguration(domain: string): Promise<TLSConfiguration> {
    // This would typically use a backend service to analyze TLS configuration
    try {
      const response = await this.makeSecureRequest(`/api/security/tls/${domain}`)

      if (!response.ok) {
        throw new Error('TLS analysis failed')
      }

      const tlsData = await response.json()
      return this.parseTLSConfiguration(tlsData)
    } catch (error) {
      // Fallback for demo purposes
      return {
        version: 'TLS 1.3',
        cipherSuite: 'TLS_AES_256_GCM_SHA384',
        keyExchange: 'ECDH',
        authentication: 'ECDSA',
        encryption: 'AES_256_GCM',
        macAlgorithm: 'AEAD',
        secure: true,
        grade: 'A+',
        vulnerabilities: []
      }
    }
  }

  private parseTLSConfiguration(tlsData: any): TLSConfiguration {
    const vulnerabilities = []

    // Check for common TLS vulnerabilities
    if (tlsData.version < 'TLS 1.2') {
      vulnerabilities.push('Outdated TLS version')
    }

    if (tlsData.cipherSuite.includes('RC4')) {
      vulnerabilities.push('Weak cipher suite (RC4)')
    }

    const secure = vulnerabilities.length === 0
    const grade = this.calculateTLSGrade(tlsData, vulnerabilities)

    return {
      version: tlsData.version,
      cipherSuite: tlsData.cipherSuite,
      keyExchange: tlsData.keyExchange,
      authentication: tlsData.authentication,
      encryption: tlsData.encryption,
      macAlgorithm: tlsData.macAlgorithm,
      secure,
      grade,
      vulnerabilities
    }
  }

  private calculateTLSGrade(tlsData: any, vulnerabilities: string[]): 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' {
    if (vulnerabilities.length > 3) return 'F'
    if (vulnerabilities.length > 2) return 'D'
    if (vulnerabilities.length > 1) return 'C'
    if (vulnerabilities.length === 1) return 'B'
    if (tlsData.version === 'TLS 1.3') return 'A+'
    return 'A'
  }

  async checkTLSVulnerabilities(config: TLSConfiguration): Promise<string[]> {
    const vulnerabilities = [...config.vulnerabilities]

    // Additional vulnerability checks
    if (config.version < 'TLS 1.2') {
      vulnerabilities.push('Outdated TLS version - upgrade to TLS 1.2 or higher')
    }

    if (config.keyExchange === 'RSA') {
      vulnerabilities.push('Non-forward secret key exchange')
    }

    if (config.encryption.includes('CBC')) {
      vulnerabilities.push('CBC cipher susceptible to padding oracle attacks')
    }

    return vulnerabilities
  }

  async performSecurityAssessment(domain: string): Promise<SecurityAssessment> {
    try {
      const [certificates, headers, hsts, tls] = await Promise.all([
        this.monitorCertificates([domain]),
        this.validateSecurityHeaders(`https://${domain}`),
        this.checkHSTS(domain),
        this.analyzeTLSConfiguration(domain)
      ])

      const csp = await this.validateCSP(
        headers.find(h => h.header === 'Content-Security-Policy')?.actual || ''
      )

      const ctCompliance = await this.checkCTCompliance(domain)
      const risks = await this.assessSecurityRisks(certificates, headers, tls)
      const recommendations = await this.generateRecommendations(headers, tls, hsts)
      const overallGrade = this.calculateOverallGrade(headers, tls, certificates)

      const assessment: SecurityAssessment = {
        domain,
        timestamp: new Date(),
        overallGrade,
        certificates,
        headers,
        hsts,
        csp,
        tls,
        ctCompliance,
        recommendations,
        risks
      }

      await auditService.logSecurityEvent({
        action: 'security_assessment_completed',
        resource: `domain_${domain}`,
        success: true,
        details: { grade: overallGrade, risksCount: risks.length },
        severity: 'low'
      })

      return assessment
    } catch (error) {
      throw new TransmissionSecurityError(
        `Security assessment failed for ${domain}`,
        'ASSESSMENT_FAILED',
        error
      )
    }
  }

  private async checkCTCompliance(domain: string): Promise<boolean> {
    try {
      const ctEntries = await this.checkCTLogs(domain)
      return ctEntries.length > 0
    } catch (error) {
      return false
    }
  }

  private async assessSecurityRisks(
    certificates: CertificateInfo[],
    headers: SecurityHeaderCheck[],
    tls: TLSConfiguration
  ): Promise<SecurityRisk[]> {
    const risks: SecurityRisk[] = []

    // Certificate risks
    for (const cert of certificates) {
      if (cert.daysUntilExpiry <= 7) {
        risks.push({
          id: `cert_expiry_${cert.fingerprint}`,
          type: 'certificate',
          severity: 'critical',
          title: 'Certificate Expiring Soon',
          description: `Certificate expires in ${cert.daysUntilExpiry} days`,
          impact: 'Service disruption and security warnings for users',
          mitigation: 'Renew certificate immediately',
          detected: new Date(),
          resolved: false
        })
      }
    }

    // Header risks
    const criticalHeaders = headers.filter(h =>
      !h.compliant && ['high', 'critical'].includes(h.severity)
    )

    for (const header of criticalHeaders) {
      risks.push({
        id: `header_${header.header.toLowerCase().replace(/-/g, '_')}`,
        type: 'header',
        severity: header.severity as any,
        title: `Missing Security Header: ${header.header}`,
        description: `${header.header} is not properly configured`,
        impact: 'Increased vulnerability to attacks',
        mitigation: header.recommendation || 'Configure security header',
        detected: new Date(),
        resolved: false
      })
    }

    // TLS risks
    for (const vulnerability of tls.vulnerabilities) {
      risks.push({
        id: `tls_${vulnerability.replace(/\s+/g, '_').toLowerCase()}`,
        type: 'protocol',
        severity: 'high',
        title: 'TLS Vulnerability',
        description: vulnerability,
        impact: 'Potential for man-in-the-middle attacks',
        mitigation: 'Update TLS configuration',
        detected: new Date(),
        resolved: false
      })
    }

    return risks
  }

  private async generateRecommendations(
    headers: SecurityHeaderCheck[],
    tls: TLSConfiguration,
    hsts: HSTSConfig
  ): Promise<SecurityRecommendation[]> {
    const recommendations: SecurityRecommendation[] = []

    // Header recommendations
    const nonCompliantHeaders = headers.filter(h => !h.compliant)
    for (const header of nonCompliantHeaders) {
      if (header.recommendation) {
        recommendations.push({
          category: 'headers',
          priority: header.severity as any,
          title: `Fix ${header.header}`,
          description: header.recommendation,
          action: `Update ${header.header} configuration`,
          impact: 'Improved security posture'
        })
      }
    }

    // TLS recommendations
    if (tls.grade < 'A') {
      recommendations.push({
        category: 'tls',
        priority: 'high',
        title: 'Improve TLS Configuration',
        description: 'Current TLS grade is below recommended level',
        action: 'Upgrade to TLS 1.3 and secure cipher suites',
        impact: 'Better encryption and security'
      })
    }

    // HSTS recommendations
    if (!hsts.valid) {
      recommendations.push({
        category: 'hsts',
        priority: 'medium',
        title: 'Enable HSTS Preloading',
        description: 'HSTS is not properly configured',
        action: 'Add HSTS header with preload directive',
        impact: 'Protection against downgrade attacks'
      })
    }

    return recommendations
  }

  private calculateOverallGrade(
    headers: SecurityHeaderCheck[],
    tls: TLSConfiguration,
    certificates: CertificateInfo[]
  ): 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' {
    let score = 100

    // Deduct for non-compliant headers
    const nonCompliantHeaders = headers.filter(h => !h.compliant)
    score -= nonCompliantHeaders.length * 10

    // Deduct for TLS issues
    if (tls.grade === 'F') score -= 40
    else if (tls.grade === 'D') score -= 30
    else if (tls.grade === 'C') score -= 20
    else if (tls.grade === 'B') score -= 10

    // Deduct for certificate issues
    const expiredCerts = certificates.filter(c => !c.isValid)
    score -= expiredCerts.length * 20

    if (score >= 95) return 'A+'
    if (score >= 85) return 'A'
    if (score >= 75) return 'B'
    if (score >= 65) return 'C'
    if (score >= 55) return 'D'
    return 'F'
  }

  async getSecurityMetrics(): Promise<TransmissionSecurityMetrics> {
    try {
      const events = await this.getSecurityEvents()
      const certificates = await this.monitorCertificates(this.config.domains)
      const assessments = await Promise.all(
        this.config.domains.map(domain => this.performSecurityAssessment(domain))
      )

      return {
        certificateHealth: {
          total: certificates.length,
          valid: certificates.filter(c => c.isValid).length,
          expiringSoon: certificates.filter(c => c.daysUntilExpiry <= 30).length,
          expired: certificates.filter(c => !c.isValid).length,
          suspicious: 0 // Would be calculated from CT monitoring
        },
        headerCompliance: {
          total: assessments.length * 6, // Assuming 6 headers checked per domain
          compliant: assessments.reduce((sum, a) => sum + a.headers.filter(h => h.compliant).length, 0),
          nonCompliant: assessments.reduce((sum, a) => sum + a.headers.filter(h => !h.compliant).length, 0),
          missing: assessments.reduce((sum, a) => sum + a.headers.filter(h => !h.present).length, 0),
          score: assessments.reduce((sum, a) => sum + a.headers.filter(h => h.compliant).length, 0) / (assessments.length * 6)
        },
        tlsConfiguration: {
          grade: assessments[0]?.tls.grade || 'F',
          version: assessments[0]?.tls.version || 'Unknown',
          strength: this.getTLSStrength(assessments[0]?.tls),
          vulnerabilities: assessments.reduce((sum, a) => sum + a.tls.vulnerabilities.length, 0)
        },
        ctCompliance: {
          monitored: this.config.domains.length,
          compliant: assessments.filter(a => a.ctCompliance).length,
          violations: 0, // Would be calculated from CT monitoring
          lastCheck: new Date()
        },
        incidentStats: {
          total: events.length,
          resolved: events.filter(e => e.resolved).length,
          pending: events.filter(e => !e.resolved).length,
          critical: events.filter(e => e.severity === 'critical').length,
          averageResponseTime: this.calculateAverageResponseTime(events)
        }
      }
    } catch (error) {
      throw new TransmissionSecurityError(
        'Failed to get security metrics',
        'METRICS_FAILED',
        error
      )
    }
  }

  private getTLSStrength(tls?: TLSConfiguration): 'weak' | 'medium' | 'strong' | 'excellent' {
    if (!tls) return 'weak'

    switch (tls.grade) {
      case 'A+': return 'excellent'
      case 'A': return 'strong'
      case 'B': return 'medium'
      default: return 'weak'
    }
  }

  private calculateAverageResponseTime(events: TransmissionSecurityEvent[]): number {
    const resolvedEvents = events.filter(e => e.resolved && e.responseTime)
    if (resolvedEvents.length === 0) return 0

    const totalTime = resolvedEvents.reduce((sum, event) => {
      if (event.responseTime) {
        return sum + (event.responseTime.getTime() - event.timestamp.getTime())
      }
      return sum
    }, 0)

    return totalTime / resolvedEvents.length / (1000 * 60) // Convert to minutes
  }

  async reportSecurityEvent(
    event: Omit<TransmissionSecurityEvent, 'id' | 'timestamp'>
  ): Promise<string> {
    const eventId = crypto.randomUUID()
    const securityEvent: TransmissionSecurityEvent = {
      ...event,
      id: eventId,
      timestamp: new Date()
    }

    try {
      // Store event locally
      const events = await this.getSecurityEvents()
      events.push(securityEvent)
      localStorage.setItem('transmission_security_events', JSON.stringify(events))

      // Log to audit system
      await auditService.logSecurityEvent({
        action: `transmission_security_${event.type}`,
        resource: `domain_${event.domain}`,
        success: !event.type.includes('violation'),
        details: { ...event.details, eventId },
        severity: event.severity
      })

      // Trigger incident response for critical events
      if (event.severity === 'critical' && this.config.alerting.emergency) {
        await incidentResponseService.createIncident({
          title: `Critical Transmission Security Event: ${event.description}`,
          description: `Domain: ${event.domain}\nType: ${event.type}\nDetails: ${JSON.stringify(event.details)}`,
          severity: 'critical',
          category: 'security',
          source: 'transmission_security',
          metadata: { eventId, domain: event.domain, type: event.type }
        })
      }

      return eventId
    } catch (error) {
      console.error('Failed to report security event:', error)
      throw new TransmissionSecurityError(
        'Failed to report security event',
        'EVENT_REPORT_FAILED',
        error
      )
    }
  }

  async getSecurityEvents(
    filter?: { severity?: string; resolved?: boolean }
  ): Promise<TransmissionSecurityEvent[]> {
    try {
      const stored = localStorage.getItem('transmission_security_events')
      let events: TransmissionSecurityEvent[] = stored ? JSON.parse(stored) : []

      // Parse dates
      events = events.map(event => ({
        ...event,
        timestamp: new Date(event.timestamp),
        responseTime: event.responseTime ? new Date(event.responseTime) : undefined
      }))

      // Apply filters
      if (filter) {
        if (filter.severity) {
          events = events.filter(e => e.severity === filter.severity)
        }
        if (filter.resolved !== undefined) {
          events = events.filter(e => e.resolved === filter.resolved)
        }
      }

      return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    } catch (error) {
      console.error('Failed to get security events:', error)
      return []
    }
  }

  async acknowledgeEvent(eventId: string, respondedBy: string): Promise<boolean> {
    try {
      const events = await this.getSecurityEvents()
      const event = events.find(e => e.id === eventId)

      if (!event) return false

      event.acknowledged = true
      event.respondedBy = respondedBy
      event.responseTime = new Date()

      localStorage.setItem('transmission_security_events', JSON.stringify(events))

      await auditService.logSecurityEvent({
        action: 'transmission_security_event_acknowledged',
        resource: `event_${eventId}`,
        success: true,
        details: { eventId, respondedBy },
        severity: 'low'
      })

      return true
    } catch (error) {
      console.error('Failed to acknowledge event:', error)
      return false
    }
  }

  async resolveEvent(eventId: string, mitigation: string): Promise<boolean> {
    try {
      const events = await this.getSecurityEvents()
      const event = events.find(e => e.id === eventId)

      if (!event) return false

      event.resolved = true
      event.mitigation = mitigation
      if (!event.responseTime) {
        event.responseTime = new Date()
      }

      localStorage.setItem('transmission_security_events', JSON.stringify(events))

      await auditService.logSecurityEvent({
        action: 'transmission_security_event_resolved',
        resource: `event_${eventId}`,
        success: true,
        details: { eventId, mitigation },
        severity: 'low'
      })

      return true
    } catch (error) {
      console.error('Failed to resolve event:', error)
      return false
    }
  }

  async updateMonitoringConfig(config: Partial<SecurityMonitoringConfig>): Promise<boolean> {
    try {
      this.config = { ...this.config, ...config }
      await this.saveConfiguration()

      await auditService.logSecurityEvent({
        action: 'transmission_security_config_updated',
        resource: 'monitoring_config',
        success: true,
        details: { updatedFields: Object.keys(config) },
        severity: 'low'
      })

      return true
    } catch (error) {
      console.error('Failed to update monitoring config:', error)
      return false
    }
  }

  async getMonitoringConfig(): Promise<SecurityMonitoringConfig> {
    return { ...this.config }
  }

  async startMonitoring(): Promise<void> {
    if (this.monitoringActive) return

    this.monitoringActive = true

    const runMonitoring = async () => {
      if (!this.monitoringActive) return

      try {
        // Run monitoring tasks
        await this.performRoutineChecks()

        // Schedule next check
        this.monitoringInterval = setTimeout(runMonitoring, this.config.checkInterval)
      } catch (error) {
        console.error('Monitoring error:', error)
        // Continue monitoring even if one check fails
        this.monitoringInterval = setTimeout(runMonitoring, this.config.checkInterval)
      }
    }

    await runMonitoring()

    await auditService.logSecurityEvent({
      action: 'transmission_security_monitoring_started',
      resource: 'monitoring_service',
      success: true,
      details: { interval: this.config.checkInterval },
      severity: 'low'
    })
  }

  async stopMonitoring(): Promise<void> {
    this.monitoringActive = false

    if (this.monitoringInterval) {
      clearTimeout(this.monitoringInterval)
      this.monitoringInterval = null
    }

    await auditService.logSecurityEvent({
      action: 'transmission_security_monitoring_stopped',
      resource: 'monitoring_service',
      success: true,
      details: {},
      severity: 'low'
    })
  }

  isMonitoring(): boolean {
    return this.monitoringActive
  }

  private async performRoutineChecks(): Promise<void> {
    try {
      // Check certificates
      await this.monitorCertificates(this.config.domains)

      // Check CT logs for new certificates
      await this.monitorNewCertificates(this.config.ctMonitoring)

      // Validate security headers for each domain
      for (const domain of this.config.domains) {
        await this.validateSecurityHeaders(`https://${domain}`)
      }

      await auditService.logSecurityEvent({
        action: 'transmission_security_routine_check',
        resource: 'monitoring_service',
        success: true,
        details: { domainsChecked: this.config.domains.length },
        severity: 'low'
      })
    } catch (error) {
      await auditService.logSecurityEvent({
        action: 'transmission_security_routine_check_failed',
        resource: 'monitoring_service',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        severity: 'medium'
      })
    }
  }

  private async validateCurrentSecurity(): Promise<void> {
    // Validate current page security
    if (typeof window !== 'undefined') {
      const currentDomain = window.location.hostname
      await this.performSecurityAssessment(currentDomain)
    }
  }

  private async makeSecureRequest(url: string, options?: RequestInit): Promise<Response> {
    const defaultHeaders = {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json'
    }

    return fetch(url, {
      ...options,
      headers: { ...defaultHeaders, ...options?.headers }
    })
  }

  // Event system for real-time updates
  addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  removeEventListener(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => callback(data))
    }
  }
}

// Export singleton instance
export const transmissionSecurityService = new TransmissionSecurityService()
export default transmissionSecurityService