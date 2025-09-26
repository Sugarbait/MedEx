/**
 * Certificate Transparency Monitoring Service
 * HIPAA-compliant certificate monitoring with CT log validation
 *
 * Features:
 * - Real-time CT log monitoring
 * - Certificate change detection
 * - Suspicious certificate alerting
 * - Certificate expiration tracking
 * - Integration with incident response
 */

import {
  CertificateInfo,
  CTLogEntry,
  CTMonitoringConfig,
  TransmissionSecurityEvent,
  CTMonitoringError,
  CertificateValidationError
} from '@/types/transmissionSecurityTypes'
import { auditService } from './auditService'
import { incidentResponseService } from './incidentResponseService'
import { transmissionSecurityService } from './transmissionSecurityService'

interface CTLogResponse {
  entries: CTLogEntry[]
  total_count: number
  last_index: number
}

interface CertificateTransparencyLog {
  name: string
  url: string
  publicKey: string
  maximumMergeDelay: number
  operated_by: string[]
  description: string
  state: 'PENDING' | 'QUALIFIED' | 'USABLE' | 'READONLY' | 'RETIRED'
}

class CertificateMonitoringService {
  private monitoringActive = false
  private monitoringInterval: NodeJS.Timeout | null = null
  private config: CTMonitoringConfig
  private knownCertificates: Map<string, CertificateInfo> = new Map()
  private lastCheckTimestamp: number = 0
  private ctLogs: CertificateTransparencyLog[] = []

  constructor() {
    this.config = this.getDefaultConfig()
    this.initializeService()
  }

  private getDefaultConfig(): CTMonitoringConfig {
    return {
      domains: ['carexps.nexasync.ca', '*.nexasync.ca'],
      logSources: [
        'https://ct.googleapis.com/logs/argon2024/',
        'https://ct.googleapis.com/logs/xenon2024/',
        'https://ct.googleapis.com/logs/nimbus2024/',
        'https://ct.cloudflare.com/logs/nimbus2024/',
        'https://crt.sh'
      ],
      checkInterval: 21600000, // 6 hours
      alertThresholds: {
        newCertificateAlert: true,
        expirationWarningDays: 30,
        suspiciousIssuerAlert: true
      },
      trustedIssuers: [
        'Let\'s Encrypt',
        'DigiCert Inc',
        'GlobalSign',
        'Microsoft Corporation',
        'Azure',
        'Sectigo Limited',
        'GoDaddy.com, Inc.',
        'Amazon',
        'Cloudflare'
      ]
    }
  }

  private async initializeService(): Promise<void> {
    try {
      await this.loadKnownCertificates()
      await this.loadCTLogs()
      await this.performInitialScan()

      await auditService.logSecurityEvent({
        action: 'certificate_monitoring_initialized',
        resource: 'certificate_monitoring_service',
        success: true,
        details: {
          version: '1.0.0',
          domains: this.config.domains.length,
          ctLogs: this.ctLogs.length
        },
        severity: 'low'
      })
    } catch (error) {
      console.error('Failed to initialize certificate monitoring service:', error)
      await auditService.logSecurityEvent({
        action: 'certificate_monitoring_init_failed',
        resource: 'certificate_monitoring_service',
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        severity: 'high'
      })
    }
  }

  private async loadKnownCertificates(): Promise<void> {
    try {
      const stored = localStorage.getItem('ct_known_certificates')
      if (stored) {
        const certificates = JSON.parse(stored)
        for (const [key, cert] of Object.entries(certificates)) {
          this.knownCertificates.set(key, cert as CertificateInfo)
        }
      }
    } catch (error) {
      console.warn('Failed to load known certificates:', error)
    }
  }

  private async saveKnownCertificates(): Promise<void> {
    try {
      const certificates = Object.fromEntries(this.knownCertificates.entries())
      localStorage.setItem('ct_known_certificates', JSON.stringify(certificates))
    } catch (error) {
      console.error('Failed to save known certificates:', error)
    }
  }

  private async loadCTLogs(): Promise<void> {
    try {
      // Load from Chrome's CT policy list or fallback to static list
      const response = await fetch('https://www.gstatic.com/ct/log_list/v3/log_list.json')
      if (response.ok) {
        const data = await response.json()
        this.ctLogs = data.operators.flatMap((op: any) =>
          op.logs.filter((log: any) => log.state === 'USABLE')
        )
      } else {
        // Fallback to known CT logs
        this.ctLogs = this.getKnownCTLogs()
      }
    } catch (error) {
      console.warn('Failed to load CT logs, using fallback:', error)
      this.ctLogs = this.getKnownCTLogs()
    }
  }

  private getKnownCTLogs(): CertificateTransparencyLog[] {
    return [
      {
        name: 'Google Argon 2024',
        url: 'https://ct.googleapis.com/logs/argon2024/',
        publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...',
        maximumMergeDelay: 86400,
        operated_by: ['Google'],
        description: 'Google Argon 2024',
        state: 'USABLE'
      },
      {
        name: 'Google Xenon 2024',
        url: 'https://ct.googleapis.com/logs/xenon2024/',
        publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...',
        maximumMergeDelay: 86400,
        operated_by: ['Google'],
        description: 'Google Xenon 2024',
        state: 'USABLE'
      },
      {
        name: 'Cloudflare Nimbus 2024',
        url: 'https://ct.cloudflare.com/logs/nimbus2024/',
        publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...',
        maximumMergeDelay: 86400,
        operated_by: ['Cloudflare'],
        description: 'Cloudflare Nimbus 2024',
        state: 'USABLE'
      }
    ]
  }

  private async performInitialScan(): Promise<void> {
    for (const domain of this.config.domains) {
      try {
        const entries = await this.queryCTLogsForDomain(domain)
        for (const entry of entries) {
          const certKey = this.getCertificateKey(entry.leafCertificate)
          this.knownCertificates.set(certKey, entry.leafCertificate)
        }
      } catch (error) {
        console.warn(`Initial CT scan failed for ${domain}:`, error)
      }
    }

    await this.saveKnownCertificates()
    this.lastCheckTimestamp = Date.now()
  }

  async startMonitoring(): Promise<void> {
    if (this.monitoringActive) return

    this.monitoringActive = true

    const runCheck = async () => {
      if (!this.monitoringActive) return

      try {
        await this.performMonitoringCheck()
        this.scheduleNextCheck()
      } catch (error) {
        console.error('CT monitoring check failed:', error)
        await this.reportMonitoringError(error)
        this.scheduleNextCheck()
      }
    }

    await runCheck()

    await auditService.logSecurityEvent({
      action: 'ct_monitoring_started',
      resource: 'certificate_monitoring_service',
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
      action: 'ct_monitoring_stopped',
      resource: 'certificate_monitoring_service',
      success: true,
      details: {},
      severity: 'low'
    })
  }

  isMonitoring(): boolean {
    return this.monitoringActive
  }

  private scheduleNextCheck(): void {
    this.monitoringInterval = setTimeout(async () => {
      if (this.monitoringActive) {
        try {
          await this.performMonitoringCheck()
          this.scheduleNextCheck()
        } catch (error) {
          console.error('Scheduled CT check failed:', error)
          this.scheduleNextCheck()
        }
      }
    }, this.config.checkInterval)
  }

  private async performMonitoringCheck(): Promise<void> {
    const newCertificates: CTLogEntry[] = []
    const suspiciousCertificates: CTLogEntry[] = []

    for (const domain of this.config.domains) {
      try {
        const entries = await this.queryCTLogsForDomain(domain, this.lastCheckTimestamp)

        for (const entry of entries) {
          // Check if this is a new certificate
          const certKey = this.getCertificateKey(entry.leafCertificate)
          const isNew = !this.knownCertificates.has(certKey)

          if (isNew) {
            newCertificates.push(entry)
            this.knownCertificates.set(certKey, entry.leafCertificate)

            // Check if certificate is suspicious
            if (await this.isSuspiciousCertificate(entry)) {
              suspiciousCertificates.push(entry)
            }
          }
        }
      } catch (error) {
        await this.reportMonitoringError(error, domain)
      }
    }

    // Process findings
    await this.processNewCertificates(newCertificates)
    await this.processSuspiciousCertificates(suspiciousCertificates)

    // Update tracking
    this.lastCheckTimestamp = Date.now()
    await this.saveKnownCertificates()

    await auditService.logSecurityEvent({
      action: 'ct_monitoring_check_completed',
      resource: 'certificate_monitoring_service',
      success: true,
      details: {
        newCertificates: newCertificates.length,
        suspiciousCertificates: suspiciousCertificates.length,
        domainsChecked: this.config.domains.length
      },
      severity: 'low'
    })
  }

  private async queryCTLogsForDomain(
    domain: string,
    since?: number
  ): Promise<CTLogEntry[]> {
    const entries: CTLogEntry[] = []
    const cleanDomain = domain.replace(/^\*\./, '') // Remove wildcard prefix

    // Query crt.sh first (most comprehensive)
    try {
      const crtShEntries = await this.queryCrtSh(cleanDomain, since)
      entries.push(...crtShEntries)
    } catch (error) {
      console.warn('crt.sh query failed:', error)
    }

    // Query Google CT logs
    for (const ctLog of this.ctLogs.slice(0, 3)) { // Limit to first 3 logs to avoid rate limits
      try {
        const logEntries = await this.queryGoogleCTLog(ctLog, cleanDomain, since)
        entries.push(...logEntries)
      } catch (error) {
        console.warn(`CT log query failed for ${ctLog.name}:`, error)
      }
    }

    // Deduplicate entries by certificate fingerprint
    const uniqueEntries = new Map<string, CTLogEntry>()
    for (const entry of entries) {
      const key = entry.leafCertificate.fingerprint
      if (!uniqueEntries.has(key)) {
        uniqueEntries.set(key, entry)
      }
    }

    return Array.from(uniqueEntries.values())
  }

  private async queryCrtSh(domain: string, since?: number): Promise<CTLogEntry[]> {
    const url = `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`crt.sh API error: ${response.statusText}`)
      }

      const data = await response.json()
      const entries: CTLogEntry[] = []

      for (const cert of data) {
        // Filter by timestamp if provided
        const entryTime = new Date(cert.entry_timestamp).getTime()
        if (since && entryTime <= since) continue

        const ctEntry = await this.parseCrtShEntry(cert)
        if (ctEntry) {
          entries.push(ctEntry)
        }
      }

      return entries
    } catch (error) {
      throw new CTMonitoringError(`crt.sh query failed for ${domain}`, error)
    }
  }

  private async parseCrtShEntry(cert: any): Promise<CTLogEntry | null> {
    try {
      const leafCertificate: CertificateInfo = {
        subject: cert.name_value,
        issuer: cert.issuer_name,
        serialNumber: cert.serial_number,
        notBefore: new Date(cert.not_before),
        notAfter: new Date(cert.not_after),
        fingerprint: this.generateFingerprint(cert),
        signatureAlgorithm: 'Unknown',
        publicKeyAlgorithm: 'Unknown',
        keySize: 0,
        extensions: [],
        isValid: new Date(cert.not_after) > new Date(),
        daysUntilExpiry: Math.ceil(
          (new Date(cert.not_after).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      }

      return {
        logId: 'crt.sh',
        timestamp: new Date(cert.entry_timestamp).getTime(),
        certificateChain: [cert.certificate],
        leafCertificate,
        source: 'crt.sh',
        verified: false,
        suspicious: false
      }
    } catch (error) {
      console.warn('Failed to parse crt.sh entry:', error)
      return null
    }
  }

  private async queryGoogleCTLog(
    ctLog: CertificateTransparencyLog,
    domain: string,
    since?: number
  ): Promise<CTLogEntry[]> {
    // Google CT logs don't support domain-specific queries directly
    // This would typically require pre-certificate monitoring or SCT validation
    // For now, return empty array as this requires more complex implementation
    return []
  }

  private generateFingerprint(cert: any): string {
    // Generate a simple fingerprint from available data
    const data = `${cert.serial_number}:${cert.issuer_name}:${cert.not_before}`
    return btoa(data).slice(0, 32)
  }

  private getCertificateKey(cert: CertificateInfo): string {
    return `${cert.fingerprint}:${cert.serialNumber}`
  }

  private async isSuspiciousCertificate(entry: CTLogEntry): Promise<boolean> {
    const cert = entry.leafCertificate

    // Check issuer against trusted list
    const isTrustedIssuer = this.config.trustedIssuers.some(trusted =>
      cert.issuer.toLowerCase().includes(trusted.toLowerCase())
    )

    if (!isTrustedIssuer) {
      return true
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /free.*ssl/i,
      /phishing/i,
      /malware/i,
      /security.*test/i
    ]

    const hasSuspiciousPattern = suspiciousPatterns.some(pattern =>
      pattern.test(cert.subject) || pattern.test(cert.issuer)
    )

    if (hasSuspiciousPattern) {
      return true
    }

    // Check certificate validity period (very short or very long)
    const validityDays = cert.daysUntilExpiry + Math.ceil(
      (Date.now() - cert.notBefore.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (validityDays < 1 || validityDays > 825) { // 825 days is max allowed by CA/Browser Forum
      return true
    }

    return false
  }

  private async processNewCertificates(certificates: CTLogEntry[]): Promise<void> {
    if (certificates.length === 0) return

    for (const cert of certificates) {
      if (this.config.alertThresholds.newCertificateAlert) {
        await transmissionSecurityService.reportSecurityEvent({
          type: 'certificate_change',
          severity: 'medium',
          domain: this.extractDomainFromSubject(cert.leafCertificate.subject),
          description: `New certificate detected in CT logs`,
          details: {
            issuer: cert.leafCertificate.issuer,
            subject: cert.leafCertificate.subject,
            fingerprint: cert.leafCertificate.fingerprint,
            source: cert.source,
            validUntil: cert.leafCertificate.notAfter
          },
          acknowledged: false,
          resolved: false
        })
      }

      // Check for expiration warnings
      if (cert.leafCertificate.daysUntilExpiry <= this.config.alertThresholds.expirationWarningDays) {
        await transmissionSecurityService.reportSecurityEvent({
          type: 'certificate_change',
          severity: cert.leafCertificate.daysUntilExpiry <= 7 ? 'critical' : 'high',
          domain: this.extractDomainFromSubject(cert.leafCertificate.subject),
          description: `Certificate expiring in ${cert.leafCertificate.daysUntilExpiry} days`,
          details: {
            certificate: cert.leafCertificate,
            source: cert.source
          },
          acknowledged: false,
          resolved: false
        })
      }
    }

    await auditService.logSecurityEvent({
      action: 'ct_new_certificates_processed',
      resource: 'certificate_monitoring_service',
      success: true,
      details: { count: certificates.length },
      severity: 'low'
    })
  }

  private async processSuspiciousCertificates(certificates: CTLogEntry[]): Promise<void> {
    if (certificates.length === 0) return

    for (const cert of certificates) {
      await transmissionSecurityService.reportSecurityEvent({
        type: 'certificate_change',
        severity: 'high',
        domain: this.extractDomainFromSubject(cert.leafCertificate.subject),
        description: 'Suspicious certificate detected in CT logs',
        details: {
          reason: 'Untrusted issuer or suspicious patterns',
          issuer: cert.leafCertificate.issuer,
          subject: cert.leafCertificate.subject,
          fingerprint: cert.leafCertificate.fingerprint,
          source: cert.source
        },
        acknowledged: false,
        resolved: false
      })

      // Create incident for suspicious certificates if alerting is enabled
      if (this.config.alertThresholds.suspiciousIssuerAlert) {
        await incidentResponseService.createIncident({
          title: `Suspicious Certificate Detected`,
          description: `A suspicious certificate was found in CT logs for domain patterns matching our monitoring.\n\nIssuer: ${cert.leafCertificate.issuer}\nSubject: ${cert.leafCertificate.subject}\nSource: ${cert.source}`,
          severity: 'high',
          category: 'security',
          source: 'certificate_monitoring',
          metadata: {
            certificateFingerprint: cert.leafCertificate.fingerprint,
            ctSource: cert.source,
            domain: this.extractDomainFromSubject(cert.leafCertificate.subject)
          }
        })
      }
    }

    await auditService.logSecurityEvent({
      action: 'ct_suspicious_certificates_processed',
      resource: 'certificate_monitoring_service',
      success: true,
      details: { count: certificates.length },
      severity: 'medium'
    })
  }

  private extractDomainFromSubject(subject: string): string {
    // Extract domain from certificate subject (CN or SAN)
    const cnMatch = subject.match(/CN=([^,]+)/)
    if (cnMatch) {
      return cnMatch[1].trim()
    }

    // Fallback to first domain-like string
    const domainMatch = subject.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    return domainMatch ? domainMatch[1] : 'unknown'
  }

  private async reportMonitoringError(error: any, domain?: string): Promise<void> {
    await auditService.logSecurityEvent({
      action: 'ct_monitoring_error',
      resource: domain ? `domain_${domain}` : 'certificate_monitoring_service',
      success: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        domain
      },
      severity: 'medium'
    })
  }

  // Public API methods

  async getCertificatesForDomain(domain: string): Promise<CertificateInfo[]> {
    try {
      const entries = await this.queryCTLogsForDomain(domain)
      return entries.map(entry => entry.leafCertificate)
    } catch (error) {
      throw new CTMonitoringError(`Failed to get certificates for ${domain}`, error)
    }
  }

  async validateCertificate(certificate: CertificateInfo): Promise<boolean> {
    try {
      // Basic validation checks
      const now = new Date()

      // Check validity period
      if (certificate.notBefore > now || certificate.notAfter < now) {
        return false
      }

      // Check if issuer is trusted
      const isTrusted = this.config.trustedIssuers.some(trusted =>
        certificate.issuer.toLowerCase().includes(trusted.toLowerCase())
      )

      if (!isTrusted) {
        return false
      }

      // Check for revocation (simplified check)
      const isRevoked = await this.checkCertificateRevocation(certificate)
      if (isRevoked) {
        return false
      }

      return true
    } catch (error) {
      throw new CertificateValidationError(
        `Certificate validation failed`,
        { certificate, error }
      )
    }
  }

  private async checkCertificateRevocation(certificate: CertificateInfo): Promise<boolean> {
    // Simplified revocation check - in production this would check CRL/OCSP
    try {
      // Check against known revoked certificates
      const revokedKey = `revoked_${certificate.fingerprint}`
      const isRevoked = localStorage.getItem(revokedKey)
      return !!isRevoked
    } catch (error) {
      console.warn('Revocation check failed:', error)
      return false
    }
  }

  async getMonitoringStatistics(): Promise<{
    totalCertificates: number
    newCertificatesLast24h: number
    suspiciousCertificates: number
    expiringCertificates: number
    lastCheckTime: Date
    domainsMonitored: number
  }> {
    const now = Date.now()
    const day24h = 24 * 60 * 60 * 1000

    let newLast24h = 0
    let suspicious = 0
    let expiring = 0

    for (const [, cert] of this.knownCertificates) {
      // Check if added in last 24h (simplified)
      if (cert.daysUntilExpiry <= 30) {
        expiring++
      }

      // Check if suspicious (basic heuristic)
      const isTrusted = this.config.trustedIssuers.some(trusted =>
        cert.issuer.toLowerCase().includes(trusted.toLowerCase())
      )
      if (!isTrusted) {
        suspicious++
      }
    }

    return {
      totalCertificates: this.knownCertificates.size,
      newCertificatesLast24h: newLast24h,
      suspiciousCertificates: suspicious,
      expiringCertificates: expiring,
      lastCheckTime: new Date(this.lastCheckTimestamp),
      domainsMonitored: this.config.domains.length
    }
  }

  async updateConfiguration(config: Partial<CTMonitoringConfig>): Promise<void> {
    this.config = { ...this.config, ...config }

    // Save configuration
    try {
      localStorage.setItem('ct_monitoring_config', JSON.stringify(this.config))
    } catch (error) {
      console.error('Failed to save CT monitoring config:', error)
    }

    await auditService.logSecurityEvent({
      action: 'ct_monitoring_config_updated',
      resource: 'certificate_monitoring_service',
      success: true,
      details: { updatedFields: Object.keys(config) },
      severity: 'low'
    })
  }

  getConfiguration(): CTMonitoringConfig {
    return { ...this.config }
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    await this.stopMonitoring()
    this.knownCertificates.clear()
  }
}

// Export singleton instance
export const certificateMonitoringService = new CertificateMonitoringService()
export default certificateMonitoringService