/**
 * Transmission Security Audit Service
 * Enhanced audit logging integration for transmission security events
 *
 * Features:
 * - HIPAA-compliant security event logging
 * - Enhanced audit trail for certificate monitoring
 * - Security incident correlation
 * - Compliance reporting integration
 * - Real-time security alerting
 */

import { auditService } from './auditService'
import { incidentResponseService } from './incidentResponseService'
import {
  TransmissionSecurityEvent,
  SecurityAssessment,
  CertificateInfo,
  SecurityHeaderCheck,
  CTLogEntry
} from '@/types/transmissionSecurityTypes'

export interface TransmissionSecurityAuditEntry {
  eventType: 'certificate_monitoring' | 'header_validation' | 'ct_log_check' | 'security_assessment' | 'configuration_change' | 'incident_response'
  subType?: string
  domain: string
  result: 'success' | 'failure' | 'warning' | 'info'
  details: any
  severity: 'low' | 'medium' | 'high' | 'critical'
  complianceFlags?: string[]
  recommendations?: string[]
  automatedResponse?: boolean
}

export interface SecurityComplianceReport {
  reportId: string
  generatedAt: Date
  timeRange: { start: Date; end: Date }
  summary: {
    totalEvents: number
    criticalEvents: number
    highEvents: number
    complianceScore: number
    certificateStatus: 'compliant' | 'warning' | 'critical'
    headerCompliance: 'compliant' | 'warning' | 'critical'
    overallStatus: 'compliant' | 'warning' | 'critical'
  }
  events: TransmissionSecurityAuditEntry[]
  recommendations: string[]
  actionItems: {
    priority: 'high' | 'medium' | 'low'
    description: string
    dueDate?: Date
    assigned?: string
  }[]
}

class TransmissionSecurityAuditService {
  private complianceThresholds = {
    criticalEventLimit: 5,
    highEventLimit: 20,
    minComplianceScore: 85,
    certificateExpiryWarningDays: 30
  }

  /**
   * Log certificate monitoring event
   */
  async logCertificateEvent(
    eventType: 'discovered' | 'validated' | 'expired' | 'expiring' | 'revoked' | 'suspicious',
    certificate: CertificateInfo,
    domain: string,
    additionalDetails?: any
  ): Promise<void> {
    const severity = this.determineCertificateSeverity(eventType, certificate)

    const auditEntry: TransmissionSecurityAuditEntry = {
      eventType: 'certificate_monitoring',
      subType: eventType,
      domain,
      result: eventType === 'expired' || eventType === 'revoked' ? 'failure' :
              eventType === 'expiring' || eventType === 'suspicious' ? 'warning' : 'success',
      details: {
        certificate: {
          subject: certificate.subject,
          issuer: certificate.issuer,
          serialNumber: certificate.serialNumber,
          fingerprint: certificate.fingerprint,
          notBefore: certificate.notBefore,
          notAfter: certificate.notAfter,
          daysUntilExpiry: certificate.daysUntilExpiry,
          isValid: certificate.isValid
        },
        ...additionalDetails
      },
      severity,
      complianceFlags: this.getCertificateComplianceFlags(eventType, certificate),
      recommendations: this.getCertificateRecommendations(eventType, certificate)
    }

    await this.logSecurityEvent(auditEntry)

    // Create incident for critical certificate issues
    if (severity === 'critical') {
      await this.createSecurityIncident(auditEntry)
    }
  }

  /**
   * Log Certificate Transparency monitoring event
   */
  async logCTEvent(
    eventType: 'new_certificate' | 'suspicious_certificate' | 'log_query' | 'validation_failure',
    ctEntry: CTLogEntry,
    additionalDetails?: any
  ): Promise<void> {
    const severity = eventType === 'suspicious_certificate' ? 'high' :
                    eventType === 'validation_failure' ? 'medium' : 'low'

    const auditEntry: TransmissionSecurityAuditEntry = {
      eventType: 'ct_log_check',
      subType: eventType,
      domain: this.extractDomainFromCertificate(ctEntry.leafCertificate),
      result: eventType === 'validation_failure' ? 'failure' :
              eventType === 'suspicious_certificate' ? 'warning' : 'success',
      details: {
        ctEntry: {
          logId: ctEntry.logId,
          timestamp: ctEntry.timestamp,
          source: ctEntry.source,
          verified: ctEntry.verified,
          suspicious: ctEntry.suspicious
        },
        certificate: {
          subject: ctEntry.leafCertificate.subject,
          issuer: ctEntry.leafCertificate.issuer,
          fingerprint: ctEntry.leafCertificate.fingerprint
        },
        ...additionalDetails
      },
      severity,
      complianceFlags: this.getCTComplianceFlags(eventType, ctEntry),
      recommendations: this.getCTRecommendations(eventType, ctEntry)
    }

    await this.logSecurityEvent(auditEntry)

    // Alert on suspicious certificates
    if (eventType === 'suspicious_certificate') {
      await this.createSecurityIncident(auditEntry)
    }
  }

  /**
   * Log security header validation event
   */
  async logHeaderValidationEvent(
    domain: string,
    headers: SecurityHeaderCheck[],
    overallScore: number,
    additionalDetails?: any
  ): Promise<void> {
    const nonCompliantHeaders = headers.filter(h => !h.compliant)
    const criticalHeaders = nonCompliantHeaders.filter(h => h.severity === 'critical' || h.severity === 'high')

    const severity = criticalHeaders.length > 0 ? 'high' :
                    nonCompliantHeaders.length > 2 ? 'medium' : 'low'

    const auditEntry: TransmissionSecurityAuditEntry = {
      eventType: 'header_validation',
      subType: 'compliance_check',
      domain,
      result: nonCompliantHeaders.length === 0 ? 'success' :
              criticalHeaders.length > 0 ? 'failure' : 'warning',
      details: {
        overallScore,
        totalHeaders: headers.length,
        compliantHeaders: headers.filter(h => h.compliant).length,
        nonCompliantHeaders: nonCompliantHeaders.length,
        criticalIssues: criticalHeaders.length,
        headers: headers.map(h => ({
          header: h.header,
          present: h.present,
          compliant: h.compliant,
          severity: h.severity,
          recommendation: h.recommendation
        })),
        ...additionalDetails
      },
      severity,
      complianceFlags: this.getHeaderComplianceFlags(headers, overallScore),
      recommendations: this.getHeaderRecommendations(nonCompliantHeaders)
    }

    await this.logSecurityEvent(auditEntry)
  }

  /**
   * Log security assessment event
   */
  async logSecurityAssessment(assessment: SecurityAssessment): Promise<void> {
    const severity = assessment.overallGrade === 'F' ? 'critical' :
                    assessment.overallGrade === 'D' ? 'high' :
                    assessment.overallGrade === 'C' ? 'medium' : 'low'

    const auditEntry: TransmissionSecurityAuditEntry = {
      eventType: 'security_assessment',
      subType: 'comprehensive_scan',
      domain: assessment.domain,
      result: assessment.overallGrade >= 'B' ? 'success' :
              assessment.overallGrade >= 'D' ? 'warning' : 'failure',
      details: {
        overallGrade: assessment.overallGrade,
        timestamp: assessment.timestamp,
        certificateCount: assessment.certificates.length,
        headerComplianceScore: assessment.headers.filter(h => h.compliant).length / assessment.headers.length,
        tlsGrade: assessment.tls.grade,
        ctCompliance: assessment.ctCompliance,
        risksCount: assessment.risks.length,
        recommendationsCount: assessment.recommendations.length,
        criticalRisks: assessment.risks.filter(r => r.severity === 'critical').length,
        highRisks: assessment.risks.filter(r => r.severity === 'high').length
      },
      severity,
      complianceFlags: this.getAssessmentComplianceFlags(assessment),
      recommendations: assessment.recommendations.map(r => `${r.category}: ${r.description}`)
    }

    await this.logSecurityEvent(auditEntry)

    // Create incident for poor security grades
    if (assessment.overallGrade <= 'D') {
      await this.createSecurityIncident(auditEntry)
    }
  }

  /**
   * Log configuration change event
   */
  async logConfigurationChange(
    changeType: 'monitoring_config' | 'security_headers' | 'certificate_pinning' | 'alert_thresholds',
    changes: any,
    userId?: string
  ): Promise<void> {
    const auditEntry: TransmissionSecurityAuditEntry = {
      eventType: 'configuration_change',
      subType: changeType,
      domain: 'system',
      result: 'success',
      details: {
        changeType,
        changes,
        userId,
        timestamp: new Date().toISOString()
      },
      severity: 'low',
      complianceFlags: ['configuration_audit'],
      automatedResponse: false
    }

    await this.logSecurityEvent(auditEntry)
  }

  /**
   * Log incident response event
   */
  async logIncidentResponse(
    incidentId: string,
    action: 'created' | 'acknowledged' | 'resolved' | 'escalated',
    details: any
  ): Promise<void> {
    const auditEntry: TransmissionSecurityAuditEntry = {
      eventType: 'incident_response',
      subType: action,
      domain: details.domain || 'system',
      result: 'success',
      details: {
        incidentId,
        action,
        ...details
      },
      severity: action === 'created' ? 'medium' : 'low',
      complianceFlags: ['incident_management'],
      automatedResponse: action === 'created'
    }

    await this.logSecurityEvent(auditEntry)
  }

  /**
   * Core security event logging
   */
  private async logSecurityEvent(entry: TransmissionSecurityAuditEntry): Promise<void> {
    try {
      // Log to audit service
      await auditService.logSecurityEvent({
        action: `transmission_security_${entry.eventType}_${entry.subType || 'general'}`,
        resource: `domain_${entry.domain}`,
        success: entry.result === 'success',
        details: {
          ...entry.details,
          eventType: entry.eventType,
          subType: entry.subType,
          complianceFlags: entry.complianceFlags,
          recommendations: entry.recommendations,
          automatedResponse: entry.automatedResponse
        },
        severity: entry.severity
      })

      // Store in local transmission security audit log
      await this.storeLocalAuditEntry(entry)

      // Send real-time notifications for high/critical events
      if (entry.severity === 'high' || entry.severity === 'critical') {
        await this.sendSecurityAlert(entry)
      }

    } catch (error) {
      console.error('Failed to log transmission security event:', error)

      // Fallback logging
      try {
        localStorage.setItem(
          `ts_audit_fallback_${Date.now()}`,
          JSON.stringify({ entry, error: error instanceof Error ? error.message : 'Unknown error' })
        )
      } catch (fallbackError) {
        console.error('Fallback audit logging failed:', fallbackError)
      }
    }
  }

  /**
   * Store audit entry in local storage for offline capability
   */
  private async storeLocalAuditEntry(entry: TransmissionSecurityAuditEntry): Promise<void> {
    try {
      const existing = localStorage.getItem('transmission_security_audit_log')
      const auditLog = existing ? JSON.parse(existing) : []

      const timestampedEntry = {
        ...entry,
        timestamp: new Date().toISOString(),
        id: crypto.randomUUID()
      }

      auditLog.push(timestampedEntry)

      // Keep only last 1000 entries
      if (auditLog.length > 1000) {
        auditLog.splice(0, auditLog.length - 1000)
      }

      localStorage.setItem('transmission_security_audit_log', JSON.stringify(auditLog))
    } catch (error) {
      console.error('Failed to store local audit entry:', error)
    }
  }

  /**
   * Create security incident for critical events
   */
  private async createSecurityIncident(entry: TransmissionSecurityAuditEntry): Promise<void> {
    try {
      const incidentTitle = this.generateIncidentTitle(entry)
      const incidentDescription = this.generateIncidentDescription(entry)

      const incidentId = await incidentResponseService.createIncident({
        title: incidentTitle,
        description: incidentDescription,
        severity: entry.severity === 'critical' ? 'critical' : 'high',
        category: 'security',
        source: 'transmission_security',
        metadata: {
          eventType: entry.eventType,
          subType: entry.subType,
          domain: entry.domain,
          complianceFlags: entry.complianceFlags,
          automatedDetection: true
        }
      })

      // Log incident creation
      await this.logIncidentResponse(incidentId, 'created', {
        domain: entry.domain,
        eventType: entry.eventType,
        severity: entry.severity,
        automatedCreation: true
      })

    } catch (error) {
      console.error('Failed to create security incident:', error)
    }
  }

  /**
   * Send real-time security alert
   */
  private async sendSecurityAlert(entry: TransmissionSecurityAuditEntry): Promise<void> {
    // This would integrate with notification service
    console.warn('SECURITY ALERT:', {
      type: entry.eventType,
      domain: entry.domain,
      severity: entry.severity,
      message: this.generateAlertMessage(entry)
    })

    // Store alert for dashboard display
    try {
      const alerts = JSON.parse(localStorage.getItem('security_alerts') || '[]')
      alerts.unshift({
        ...entry,
        timestamp: new Date().toISOString(),
        id: crypto.randomUUID(),
        acknowledged: false
      })

      // Keep only last 50 alerts
      if (alerts.length > 50) {
        alerts.splice(50)
      }

      localStorage.setItem('security_alerts', JSON.stringify(alerts))
    } catch (error) {
      console.error('Failed to store security alert:', error)
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(timeRange: { start: Date; end: Date }): Promise<SecurityComplianceReport> {
    try {
      const auditLog = JSON.parse(localStorage.getItem('transmission_security_audit_log') || '[]')

      // Filter events by time range
      const filteredEvents = auditLog.filter((entry: any) => {
        const eventTime = new Date(entry.timestamp)
        return eventTime >= timeRange.start && eventTime <= timeRange.end
      })

      const criticalEvents = filteredEvents.filter((e: any) => e.severity === 'critical')
      const highEvents = filteredEvents.filter((e: any) => e.severity === 'high')

      // Calculate compliance score
      const complianceScore = this.calculateComplianceScore(filteredEvents)

      // Determine overall status
      const overallStatus = criticalEvents.length > this.complianceThresholds.criticalEventLimit ? 'critical' :
                           highEvents.length > this.complianceThresholds.highEventLimit ? 'warning' :
                           complianceScore < this.complianceThresholds.minComplianceScore ? 'warning' : 'compliant'

      const report: SecurityComplianceReport = {
        reportId: crypto.randomUUID(),
        generatedAt: new Date(),
        timeRange,
        summary: {
          totalEvents: filteredEvents.length,
          criticalEvents: criticalEvents.length,
          highEvents: highEvents.length,
          complianceScore,
          certificateStatus: this.getCertificateComplianceStatus(filteredEvents),
          headerCompliance: this.getHeaderComplianceStatus(filteredEvents),
          overallStatus
        },
        events: filteredEvents,
        recommendations: this.generateComplianceRecommendations(filteredEvents),
        actionItems: this.generateActionItems(filteredEvents)
      }

      // Log report generation
      await this.logSecurityEvent({
        eventType: 'security_assessment',
        subType: 'compliance_report',
        domain: 'system',
        result: 'success',
        details: {
          reportId: report.reportId,
          timeRange,
          totalEvents: filteredEvents.length,
          complianceScore,
          overallStatus
        },
        severity: 'low',
        complianceFlags: ['compliance_reporting']
      })

      return report
    } catch (error) {
      throw new Error(`Failed to generate compliance report: ${error}`)
    }
  }

  // Helper methods for determining severity and compliance

  private determineCertificateSeverity(eventType: string, certificate: CertificateInfo): 'low' | 'medium' | 'high' | 'critical' {
    switch (eventType) {
      case 'expired':
      case 'revoked':
        return 'critical'
      case 'expiring':
        return certificate.daysUntilExpiry <= 7 ? 'critical' :
               certificate.daysUntilExpiry <= 30 ? 'high' : 'medium'
      case 'suspicious':
        return 'high'
      default:
        return 'low'
    }
  }

  private getCertificateComplianceFlags(eventType: string, certificate: CertificateInfo): string[] {
    const flags = ['certificate_monitoring']

    if (eventType === 'expired' || eventType === 'revoked') {
      flags.push('hipaa_violation_risk')
    }

    if (certificate.daysUntilExpiry <= 30) {
      flags.push('certificate_renewal_required')
    }

    if (eventType === 'suspicious') {
      flags.push('security_investigation_required')
    }

    return flags
  }

  private getCertificateRecommendations(eventType: string, certificate: CertificateInfo): string[] {
    switch (eventType) {
      case 'expired':
        return ['Immediate certificate renewal required', 'Review certificate management processes']
      case 'expiring':
        return [`Certificate expires in ${certificate.daysUntilExpiry} days - schedule renewal`]
      case 'suspicious':
        return ['Investigate certificate origin', 'Consider certificate pinning', 'Review CT logs']
      default:
        return []
    }
  }

  private getCTComplianceFlags(eventType: string, ctEntry: CTLogEntry): string[] {
    const flags = ['ct_monitoring']

    if (eventType === 'suspicious_certificate') {
      flags.push('security_investigation_required', 'certificate_verification_needed')
    }

    if (!ctEntry.verified) {
      flags.push('ct_verification_failed')
    }

    return flags
  }

  private getCTRecommendations(eventType: string, ctEntry: CTLogEntry): string[] {
    switch (eventType) {
      case 'suspicious_certificate':
        return ['Investigate certificate issuer', 'Verify domain ownership', 'Consider domain monitoring']
      case 'validation_failure':
        return ['Review CT log data', 'Verify certificate chain', 'Check log source reliability']
      default:
        return []
    }
  }

  private getHeaderComplianceFlags(headers: SecurityHeaderCheck[], score: number): string[] {
    const flags = ['header_validation']

    if (score < 0.8) {
      flags.push('header_compliance_warning')
    }

    const criticalHeaders = headers.filter(h => !h.compliant && (h.severity === 'critical' || h.severity === 'high'))
    if (criticalHeaders.length > 0) {
      flags.push('critical_header_missing')
    }

    return flags
  }

  private getHeaderRecommendations(nonCompliantHeaders: SecurityHeaderCheck[]): string[] {
    return nonCompliantHeaders
      .filter(h => h.recommendation)
      .map(h => `${h.header}: ${h.recommendation}`)
  }

  private getAssessmentComplianceFlags(assessment: SecurityAssessment): string[] {
    const flags = ['security_assessment']

    if (assessment.overallGrade <= 'C') {
      flags.push('security_improvement_required')
    }

    if (!assessment.ctCompliance) {
      flags.push('ct_compliance_issue')
    }

    if (assessment.risks.some(r => r.severity === 'critical')) {
      flags.push('critical_security_risk')
    }

    return flags
  }

  private calculateComplianceScore(events: any[]): number {
    if (events.length === 0) return 100

    const successfulEvents = events.filter(e => e.result === 'success').length
    const totalEvents = events.length

    return Math.round((successfulEvents / totalEvents) * 100)
  }

  private getCertificateComplianceStatus(events: any[]): 'compliant' | 'warning' | 'critical' {
    const certEvents = events.filter(e => e.eventType === 'certificate_monitoring')
    const criticalCertEvents = certEvents.filter(e => e.severity === 'critical')

    if (criticalCertEvents.length > 0) return 'critical'

    const highCertEvents = certEvents.filter(e => e.severity === 'high')
    if (highCertEvents.length > 0) return 'warning'

    return 'compliant'
  }

  private getHeaderComplianceStatus(events: any[]): 'compliant' | 'warning' | 'critical' {
    const headerEvents = events.filter(e => e.eventType === 'header_validation')
    if (headerEvents.length === 0) return 'compliant'

    const latestHeaderEvent = headerEvents[headerEvents.length - 1]
    const score = latestHeaderEvent.details?.overallScore || 0

    if (score < 50) return 'critical'
    if (score < 80) return 'warning'
    return 'compliant'
  }

  private generateComplianceRecommendations(events: any[]): string[] {
    const recommendations = new Set<string>()

    events.forEach(event => {
      if (event.recommendations) {
        event.recommendations.forEach((rec: string) => recommendations.add(rec))
      }
    })

    return Array.from(recommendations)
  }

  private generateActionItems(events: any[]): any[] {
    const actionItems = []

    const criticalEvents = events.filter(e => e.severity === 'critical')
    if (criticalEvents.length > 0) {
      actionItems.push({
        priority: 'high',
        description: `Resolve ${criticalEvents.length} critical security events`,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      })
    }

    const highEvents = events.filter(e => e.severity === 'high')
    if (highEvents.length > 5) {
      actionItems.push({
        priority: 'medium',
        description: `Address ${highEvents.length} high-priority security events`,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      })
    }

    return actionItems
  }

  private extractDomainFromCertificate(certificate: CertificateInfo): string {
    const cnMatch = certificate.subject.match(/CN=([^,]+)/)
    return cnMatch ? cnMatch[1].trim() : 'unknown'
  }

  private generateIncidentTitle(entry: TransmissionSecurityAuditEntry): string {
    switch (entry.eventType) {
      case 'certificate_monitoring':
        return `Certificate ${entry.subType} detected for ${entry.domain}`
      case 'ct_log_check':
        return `Certificate Transparency ${entry.subType} for ${entry.domain}`
      case 'header_validation':
        return `Security header compliance issue for ${entry.domain}`
      case 'security_assessment':
        return `Poor security assessment grade for ${entry.domain}`
      default:
        return `Transmission security incident for ${entry.domain}`
    }
  }

  private generateIncidentDescription(entry: TransmissionSecurityAuditEntry): string {
    const baseDescription = `A ${entry.severity} transmission security event has been detected.\n\n`
    const details = `Event Type: ${entry.eventType}\nSub-type: ${entry.subType}\nDomain: ${entry.domain}\nResult: ${entry.result}\n\n`
    const recommendations = entry.recommendations?.length > 0 ?
      `Recommendations:\n${entry.recommendations.map(r => `- ${r}`).join('\n')}\n\n` : ''

    return baseDescription + details + recommendations + 'Please investigate and take appropriate action.'
  }

  private generateAlertMessage(entry: TransmissionSecurityAuditEntry): string {
    return `${entry.severity.toUpperCase()}: ${entry.eventType} ${entry.subType} detected for ${entry.domain}`
  }
}

// Export singleton instance
export const transmissionSecurityAuditService = new TransmissionSecurityAuditService()
export default transmissionSecurityAuditService