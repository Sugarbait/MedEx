/**
 * Credential Access Monitor
 * Monitors and logs access to sensitive credentials without modifying credential storage
 *
 * Security Features:
 * - Access logging with timestamps
 * - Anomaly detection (excessive access)
 * - Runtime integrity validation
 * - HIPAA-compliant audit trail
 *
 * NOTE: This is a WRAPPER that adds security monitoring WITHOUT modifying
 * the existing credential system (which is locked and working in production)
 */

import { safeLogger } from './safeLogger'

const logger = safeLogger.component('CredentialMonitor')

/**
 * Credential access event
 */
interface CredentialAccessEvent {
  timestamp: Date
  credentialType: 'api_key' | 'agent_id' | 'service_role_key'
  accessor: string // Component/service name
  result: 'success' | 'failure' | 'invalid'
  environment: 'development' | 'production'
}

/**
 * Credential integrity check result
 */
interface IntegrityCheckResult {
  valid: boolean
  issues: string[]
  timestamp: Date
}

class CredentialAccessMonitor {
  private accessLog: CredentialAccessEvent[] = []
  private readonly MAX_LOG_SIZE = 1000
  private readonly EXCESSIVE_ACCESS_THRESHOLD = 50 // per minute

  /**
   * Log credential access attempt
   */
  logAccess(
    credentialType: 'api_key' | 'agent_id' | 'service_role_key',
    accessor: string,
    result: 'success' | 'failure' | 'invalid'
  ): void {
    const event: CredentialAccessEvent = {
      timestamp: new Date(),
      credentialType,
      accessor,
      result,
      environment: import.meta.env.MODE === 'production' ? 'production' : 'development'
    }

    this.accessLog.push(event)

    // Trim log if too large (keep most recent)
    if (this.accessLog.length > this.MAX_LOG_SIZE) {
      this.accessLog = this.accessLog.slice(-this.MAX_LOG_SIZE)
    }

    // Log to console in development only
    if (import.meta.env.MODE === 'development') {
      logger.debug(`Credential access: ${credentialType} by ${accessor}`, {
        result
      })
    }

    // Check for anomalies
    this.checkForAnomalies()
  }

  /**
   * Check for excessive credential access (potential security issue)
   */
  private checkForAnomalies(): void {
    const oneMinuteAgo = new Date(Date.now() - 60000)
    const recentAccess = this.accessLog.filter(
      event => event.timestamp > oneMinuteAgo
    )

    if (recentAccess.length > this.EXCESSIVE_ACCESS_THRESHOLD) {
      logger.warn('⚠️ SECURITY ALERT: Excessive credential access detected', undefined, undefined, {
        accessCount: recentAccess.length,
        threshold: this.EXCESSIVE_ACCESS_THRESHOLD,
        timeWindow: '1 minute'
      })
    }

    // Check for repeated failures
    const failures = recentAccess.filter(e => e.result === 'failure')
    if (failures.length > 10) {
      logger.warn('⚠️ SECURITY ALERT: Multiple credential access failures', undefined, undefined, {
        failureCount: failures.length,
        timeWindow: '1 minute'
      })
    }
  }

  /**
   * Validate credential format without exposing the actual credential
   */
  validateFormat(credential: string | undefined, type: 'api_key' | 'agent_id'): boolean {
    if (!credential) {
      logger.warn(`Missing ${type}`, undefined, undefined, { type })
      return false
    }

    let isValid = false

    switch (type) {
      case 'api_key':
        // Retell AI keys start with 'key_'
        isValid = credential.startsWith('key_') && credential.length > 30
        break
      case 'agent_id':
        // Agent IDs start with 'agent_'
        isValid = credential.startsWith('agent_') && credential.length > 30
        break
    }

    if (!isValid) {
      logger.warn(`Invalid ${type} format detected`, undefined, undefined, { type })
    }

    return isValid
  }

  /**
   * Perform integrity check on credential storage
   * NOTE: Does NOT modify credentials, only validates their integrity
   */
  performIntegrityCheck(): IntegrityCheckResult {
    const result: IntegrityCheckResult = {
      valid: true,
      issues: [],
      timestamp: new Date()
    }

    try {
      // Check if credentials exist in expected locations
      const hasLocalStorage = typeof localStorage !== 'undefined'
      if (!hasLocalStorage) {
        result.valid = false
        result.issues.push('LocalStorage not available')
        return result
      }

      // Count credential-related keys (without reading actual values)
      const credentialKeys = Object.keys(localStorage).filter(
        key => key.includes('retell') || key.includes('credentials') || key.includes('api')
      )

      if (credentialKeys.length === 0) {
        result.issues.push('No credential keys found in storage')
        // Not necessarily invalid - might be first load
      }

      // Check for suspicious patterns
      const suspiciousKeys = credentialKeys.filter(
        key => key.includes('hack') || key.includes('exploit') || key.includes('debug')
      )

      if (suspiciousKeys.length > 0) {
        result.valid = false
        result.issues.push(`Suspicious storage keys detected: ${suspiciousKeys.length}`)
        logger.warn('⚠️ SECURITY ALERT: Suspicious credential keys found', undefined, undefined, {
          suspiciousCount: suspiciousKeys.length
        })
      }

      logger.info('Credential integrity check completed', undefined, undefined, {
        valid: result.valid,
        issuesCount: result.issues.length
      })
    } catch (error) {
      result.valid = false
      result.issues.push('Integrity check failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
      logger.error('Failed to perform credential integrity check', undefined, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    return result
  }

  /**
   * Get credential access statistics
   */
  getStatistics(): {
    totalAccess: number
    successfulAccess: number
    failedAccess: number
    invalidAccess: number
    lastHourAccess: number
    mostAccessedCredential: string
  } {
    const oneHourAgo = new Date(Date.now() - 3600000)
    const lastHourEvents = this.accessLog.filter(e => e.timestamp > oneHourAgo)

    const byResult = {
      success: this.accessLog.filter(e => e.result === 'success').length,
      failure: this.accessLog.filter(e => e.result === 'failure').length,
      invalid: this.accessLog.filter(e => e.result === 'invalid').length
    }

    // Find most accessed credential type
    const credentialCounts = this.accessLog.reduce((acc, event) => {
      acc[event.credentialType] = (acc[event.credentialType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const mostAccessedCredential = Object.entries(credentialCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'none'

    return {
      totalAccess: this.accessLog.length,
      successfulAccess: byResult.success,
      failedAccess: byResult.failure,
      invalidAccess: byResult.invalid,
      lastHourAccess: lastHourEvents.length,
      mostAccessedCredential
    }
  }

  /**
   * Generate security report
   */
  generateSecurityReport(): string {
    const stats = this.getStatistics()
    const integrity = this.performIntegrityCheck()

    return `
# Credential Access Security Report
Generated: ${new Date().toISOString()}

## Access Statistics
- Total Access Attempts: ${stats.totalAccess}
- Successful: ${stats.successfulAccess}
- Failed: ${stats.failedAccess}
- Invalid: ${stats.invalidAccess}
- Last Hour: ${stats.lastHourAccess}
- Most Accessed: ${stats.mostAccessedCredential}

## Integrity Check
- Status: ${integrity.valid ? '✅ VALID' : '❌ ISSUES DETECTED'}
- Issues Found: ${integrity.issues.length}
${integrity.issues.length > 0 ? `\nIssues:\n${integrity.issues.map(i => `- ${i}`).join('\n')}` : ''}

## Security Status
${stats.failedAccess > 10 ? '⚠️ WARNING: High number of failed access attempts' : '✅ Normal access patterns'}
${stats.lastHourAccess > 100 ? '⚠️ WARNING: High access frequency in last hour' : '✅ Normal access frequency'}
${integrity.valid ? '✅ Credential integrity maintained' : '❌ Credential integrity compromised'}

## Recommendations
${stats.failedAccess > 10 ? '- Investigate failed access attempts\n' : ''}
${stats.lastHourAccess > 100 ? '- Review components accessing credentials frequently\n' : ''}
${!integrity.valid ? '- URGENT: Review credential storage immediately\n' : ''}
${stats.totalAccess === 0 ? '- No credential access detected - verify monitoring is active\n' : ''}

---
This is a monitoring report only. No credentials are logged or exposed.
    `.trim()
  }

  /**
   * Clear access log (for privacy/compliance)
   */
  clearLog(): void {
    const count = this.accessLog.length
    this.accessLog = []
    logger.info('Credential access log cleared', undefined, undefined, { entriesCleared: count })
  }

  /**
   * Export access log for audit (PHI-free)
   */
  exportAuditLog(): CredentialAccessEvent[] {
    // Return copy to prevent modification
    return [...this.accessLog]
  }
}

// Export singleton instance
export const credentialAccessMonitor = new CredentialAccessMonitor()

/**
 * Wrapper function to monitor credential access
 * Use this to wrap any credential retrieval function
 */
export function withCredentialMonitoring<T>(
  credentialType: 'api_key' | 'agent_id' | 'service_role_key',
  accessor: string,
  retrievalFn: () => T | null | undefined
): T | null | undefined {
  try {
    const result = retrievalFn()

    if (result) {
      credentialAccessMonitor.logAccess(credentialType, accessor, 'success')
    } else {
      credentialAccessMonitor.logAccess(credentialType, accessor, 'failure')
    }

    return result
  } catch (error) {
    credentialAccessMonitor.logAccess(credentialType, accessor, 'invalid')
    throw error
  }
}

export default credentialAccessMonitor
