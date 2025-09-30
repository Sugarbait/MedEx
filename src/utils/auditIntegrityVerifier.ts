/**
 * Audit Log Integrity Verifier
 * Implements tamper detection for HIPAA audit logs
 *
 * Features:
 * - HMAC-SHA256 signatures for each log entry
 * - Hash chain linking entries together
 * - Tamper detection and verification
 * - HIPAA-compliant integrity guarantees
 */

import { secureLogger } from '@/services/secureLogger'

const logger = secureLogger.component('AuditIntegrity')

/**
 * Audit log entry with integrity data
 */
export interface AuditLogEntry {
  id: string
  timestamp: string
  user_id: string
  action: string
  resource: string
  details?: any
  ip_address?: string
}

/**
 * Audit log with integrity signature
 */
export interface SignedAuditLog extends AuditLogEntry {
  signature: string
  previous_hash?: string
  sequence_number: number
}

/**
 * Verification result
 */
export interface VerificationResult {
  valid: boolean
  totalLogs: number
  verifiedLogs: number
  tamperedLogs: number
  brokenChainAt?: number
  errors: string[]
}

class AuditIntegrityVerifier {
  private signingKey: string | null = null

  /**
   * Initialize verifier with signing key
   */
  async initialize(key: string): Promise<void> {
    this.signingKey = key
    logger.info('Audit integrity verifier initialized')
  }

  /**
   * Generate HMAC-SHA256 signature for audit log entry
   */
  private async generateSignature(
    entry: AuditLogEntry,
    previousHash?: string
  ): Promise<string> {
    if (!this.signingKey) {
      throw new Error('Verifier not initialized with signing key')
    }

    // Create canonical representation of log entry
    const canonical = this.canonicalize(entry, previousHash)

    // Convert signing key to CryptoKey
    const encoder = new TextEncoder()
    const keyData = encoder.encode(this.signingKey)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    // Generate HMAC signature
    const dataBuffer = encoder.encode(canonical)
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer)

    // Convert to hex string
    return this.bufferToHex(signatureBuffer)
  }

  /**
   * Create canonical representation of log entry for signing
   */
  private canonicalize(entry: AuditLogEntry, previousHash?: string): string {
    return JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp,
      user_id: entry.user_id,
      action: entry.action,
      resource: entry.resource,
      details: entry.details || null,
      ip_address: entry.ip_address || null,
      previous_hash: previousHash || null
    })
  }

  /**
   * Convert ArrayBuffer to hex string
   */
  private bufferToHex(buffer: ArrayBuffer): string {
    const byteArray = new Uint8Array(buffer)
    return Array.from(byteArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Sign audit log entry
   */
  async signAuditLog(
    entry: AuditLogEntry,
    previousHash?: string,
    sequenceNumber: number = 0
  ): Promise<SignedAuditLog> {
    const signature = await this.generateSignature(entry, previousHash)

    return {
      ...entry,
      signature,
      previous_hash: previousHash,
      sequence_number: sequenceNumber
    }
  }

  /**
   * Verify single audit log signature
   */
  async verifySignature(log: SignedAuditLog): Promise<boolean> {
    try {
      const expectedSignature = await this.generateSignature(
        {
          id: log.id,
          timestamp: log.timestamp,
          user_id: log.user_id,
          action: log.action,
          resource: log.resource,
          details: log.details,
          ip_address: log.ip_address
        },
        log.previous_hash
      )

      return expectedSignature === log.signature
    } catch (error) {
      logger.error('Failed to verify audit log signature', undefined, undefined, {
        logId: log.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  /**
   * Verify chain of audit logs
   */
  async verifyChain(logs: SignedAuditLog[]): Promise<VerificationResult> {
    const result: VerificationResult = {
      valid: true,
      totalLogs: logs.length,
      verifiedLogs: 0,
      tamperedLogs: 0,
      errors: []
    }

    if (logs.length === 0) {
      return result
    }

    // Sort logs by sequence number
    const sortedLogs = [...logs].sort((a, b) => a.sequence_number - b.sequence_number)

    let previousHash: string | undefined = undefined

    for (let i = 0; i < sortedLogs.length; i++) {
      const log = sortedLogs[i]

      // Verify signature
      const signatureValid = await this.verifySignature(log)
      if (!signatureValid) {
        result.valid = false
        result.tamperedLogs++
        result.errors.push(`Log ${log.id} has invalid signature`)
        logger.warn('Audit log signature invalid', undefined, undefined, {
          logId: log.id,
          sequenceNumber: log.sequence_number
        })
        continue
      }

      // Verify chain link
      if (i > 0 && log.previous_hash !== previousHash) {
        result.valid = false
        result.brokenChainAt = log.sequence_number
        result.errors.push(
          `Chain broken at log ${log.id} (sequence ${log.sequence_number})`
        )
        logger.warn('Audit log chain broken', undefined, undefined, {
          logId: log.id,
          sequenceNumber: log.sequence_number,
          expectedHash: previousHash,
          actualHash: log.previous_hash
        })
      }

      result.verifiedLogs++
      previousHash = log.signature
    }

    if (result.valid) {
      logger.info('Audit log chain verified successfully', undefined, undefined, {
        totalLogs: result.totalLogs,
        verifiedLogs: result.verifiedLogs
      })
    } else {
      logger.error('Audit log chain verification failed', undefined, undefined, {
        totalLogs: result.totalLogs,
        verifiedLogs: result.verifiedLogs,
        tamperedLogs: result.tamperedLogs,
        errors: result.errors.length
      })
    }

    return result
  }

  /**
   * Generate hash of current log for chaining
   */
  async generateHash(log: SignedAuditLog): Promise<string> {
    return log.signature
  }

  /**
   * Verify integrity of recent logs (last N entries)
   */
  async verifyRecentLogs(
    logs: SignedAuditLog[],
    limit: number = 100
  ): Promise<VerificationResult> {
    const sortedLogs = [...logs].sort((a, b) => b.sequence_number - a.sequence_number)
    const recentLogs = sortedLogs.slice(0, limit)
    return this.verifyChain(recentLogs)
  }

  /**
   * Generate integrity report
   */
  async generateIntegrityReport(logs: SignedAuditLog[]): Promise<string> {
    const verification = await this.verifyChain(logs)

    const report = `
# Audit Log Integrity Report
Generated: ${new Date().toISOString()}

## Summary
- Total Logs: ${verification.totalLogs}
- Verified Logs: ${verification.verifiedLogs}
- Tampered Logs: ${verification.tamperedLogs}
- Chain Valid: ${verification.valid ? '✅ YES' : '❌ NO'}
${verification.brokenChainAt ? `- Chain Broken At: Sequence ${verification.brokenChainAt}` : ''}

## Integrity Status
${verification.valid
  ? '✅ All audit logs verified successfully. No tampering detected.'
  : '❌ TAMPERING DETECTED. Audit logs have been modified or chain is broken.'}

## Errors
${verification.errors.length > 0
  ? verification.errors.map(e => `- ${e}`).join('\n')
  : 'No errors detected'}

## HIPAA Compliance
${verification.valid
  ? '✅ Audit trail integrity meets HIPAA § 164.312(c)(2) requirements'
  : '❌ SECURITY INCIDENT: Audit trail integrity compromised - investigate immediately'}

## Recommendations
${!verification.valid
  ? `
- Immediately investigate tampered logs
- Review access logs for unauthorized modifications
- Report to security team and compliance officer
- Document incident per breach notification requirements
  `
  : '- Continue regular integrity verification\n- Maintain signing keys securely'}

---
For questions about audit log integrity, contact your security team.
    `.trim()

    return report
  }
}

// Export singleton instance
export const auditIntegrityVerifier = new AuditIntegrityVerifier()

export default auditIntegrityVerifier
