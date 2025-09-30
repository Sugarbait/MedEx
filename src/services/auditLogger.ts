/**
 * HIPAA-Compliant Audit Logging Service
 *
 * Implements HIPAA Security Rule § 164.312(b) - Audit Controls
 * Follows NIST 800-66 guidelines for healthcare audit logging
 *
 * Requirements:
 * - Log all PHI access, creation, modification, deletion
 * - Record user identification, timestamp, action, resource
 * - Maintain audit logs for minimum 6 years
 * - Protect audit logs from unauthorized access/modification
 * - Enable audit log review and reporting
 */

import { supabase } from '@/config/supabase'
import { encryptionService, EncryptedData } from './encryption'

export interface AuditLogEntry {
  id?: string
  timestamp: string
  user_id: string
  user_name: string
  user_role: string
  action: AuditAction
  resource_type: ResourceType
  resource_id: string
  phi_accessed: boolean
  source_ip: string
  user_agent: string
  session_id: string
  outcome: AuditOutcome
  failure_reason?: string
  additional_info?: Record<string, any>
  created_at?: string
}

export enum AuditAction {
  // Data Access Actions
  VIEW = 'VIEW',
  READ = 'READ',
  SEARCH = 'SEARCH',
  EXPORT = 'EXPORT',
  DOWNLOAD = 'DOWNLOAD',

  // Data Modification Actions
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',

  // Authentication Actions
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILURE = 'LOGIN_FAILURE',

  // System Actions
  BACKUP = 'BACKUP',
  RESTORE = 'RESTORE',
  SYSTEM_ACCESS = 'SYSTEM_ACCESS',

  // Encryption Actions
  ENCRYPT = 'ENCRYPT',
  DECRYPT = 'DECRYPT',
  KEY_ACCESS = 'KEY_ACCESS'
}

export enum ResourceType {
  PATIENT = 'PATIENT',
  CALL = 'CALL',
  SMS = 'SMS',
  TRANSCRIPT = 'TRANSCRIPT',
  REPORT = 'REPORT',
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  AUDIT_LOG = 'AUDIT_LOG'
}

export enum AuditOutcome {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  WARNING = 'WARNING'
}

export interface AuditSearchCriteria {
  startDate?: Date
  endDate?: Date
  userId?: string
  action?: AuditAction
  resourceType?: ResourceType
  outcome?: AuditOutcome
  phiAccessed?: boolean
  sourceIp?: string
  limit?: number
  offset?: number
}

export interface AuditReport {
  entries: AuditLogEntry[]
  totalCount: number
  summary: {
    totalAccess: number
    phiAccess: number
    failures: number
    uniqueUsers: number
    timeRange: {
      start: Date
      end: Date
    }
  }
}

class HIPAAAuditLogger {
  private sessionId: string = ''
  private currentUser: any = null

  constructor() {
    this.sessionId = this.generateSessionId()
    this.getCurrentUser()
  }

  /**
   * Initialize audit logger with current user context
   */
  async initialize(user: any): Promise<void> {
    this.currentUser = user
    this.sessionId = this.generateSessionId()

    // Trigger async IP detection on initialization
    this.detectIPAsync().catch(error => {
      console.debug('Background IP detection failed during initialization:', error)
    })

    // Log system access
    await this.logAuditEvent({
      action: AuditAction.SYSTEM_ACCESS,
      resourceType: ResourceType.SYSTEM,
      resourceId: 'carexps-crm',
      phiAccessed: false,
      outcome: AuditOutcome.SUCCESS,
      additionalInfo: {
        systemComponent: 'audit-logger',
        initializationTime: new Date().toISOString(),
        ipDetectionStatus: this.getIPDetectionStatus()
      }
    })
  }

  /**
   * Log PHI data access events
   */
  async logPHIAccess(
    action: AuditAction,
    resourceType: ResourceType,
    resourceId: string,
    outcome: AuditOutcome = AuditOutcome.SUCCESS,
    additionalInfo?: Record<string, any>
  ): Promise<void> {
    await this.logAuditEvent({
      action,
      resourceType,
      resourceId,
      phiAccessed: true,
      outcome,
      additionalInfo: {
        ...additionalInfo,
        phiDataType: resourceType,
        complianceNote: 'HIPAA PHI access logged per § 164.312(b)'
      }
    })
  }

  /**
   * Log encryption/decryption operations
   */
  async logEncryptionOperation(
    action: AuditAction.ENCRYPT | AuditAction.DECRYPT,
    resourceType: ResourceType,
    resourceId: string,
    outcome: AuditOutcome,
    failureReason?: string
  ): Promise<void> {
    await this.logAuditEvent({
      action,
      resourceType,
      resourceId,
      phiAccessed: true,
      outcome,
      failureReason,
      additionalInfo: {
        encryptionStandard: 'AES-256-GCM',
        complianceNote: 'HIPAA encryption operation per § 164.312(a)(2)(iv)'
      }
    })
  }

  /**
   * Log authentication events
   */
  async logAuthenticationEvent(
    action: AuditAction.LOGIN | AuditAction.LOGOUT | AuditAction.LOGIN_FAILURE,
    userId: string,
    outcome: AuditOutcome,
    failureReason?: string
  ): Promise<void> {
    await this.logAuditEvent({
      action,
      resourceType: ResourceType.SYSTEM,
      resourceId: 'authentication-system',
      phiAccessed: false,
      outcome,
      failureReason,
      additionalInfo: {
        authenticationMethod: 'local-storage-demo', // In production: Azure AD, MFA, etc.
        complianceNote: 'HIPAA authentication event per § 164.312(d)'
      }
    })
  }

  /**
   * Log general security events
   */
  async logSecurityEvent(
    eventType: string,
    resourceType: string,
    success: boolean,
    additionalInfo?: Record<string, any>
  ): Promise<void> {
    // Map generic eventType to specific audit actions
    let action: AuditAction
    let mappedResourceType: ResourceType
    let phiAccessed = false

    // Map event types to audit actions
    if (eventType.includes('AUTHENTICATION')) {
      if (eventType.includes('SUCCESS')) {
        action = AuditAction.LOGIN
      } else if (eventType.includes('FAILURE') || eventType.includes('ERROR')) {
        action = AuditAction.LOGIN_FAILURE
      } else {
        action = AuditAction.LOGIN
      }
    } else if (eventType.includes('CREATE')) {
      action = AuditAction.CREATE
    } else if (eventType.includes('UPDATE')) {
      action = AuditAction.UPDATE
    } else if (eventType.includes('DELETE')) {
      action = AuditAction.DELETE
    } else if (eventType.includes('ACCESS')) {
      action = AuditAction.VIEW
      phiAccessed = true
    } else {
      action = AuditAction.SYSTEM_ACCESS
    }

    // Map resource types
    switch (resourceType.toLowerCase()) {
      case 'users':
        mappedResourceType = ResourceType.USER
        break
      case 'calls':
        mappedResourceType = ResourceType.CALL
        phiAccessed = true
        break
      case 'sms':
        mappedResourceType = ResourceType.SMS
        phiAccessed = true
        break
      case 'patients':
        mappedResourceType = ResourceType.PATIENT
        phiAccessed = true
        break
      default:
        mappedResourceType = ResourceType.SYSTEM
        break
    }

    const outcome = success ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE

    await this.logAuditEvent({
      action,
      resourceType: mappedResourceType,
      resourceId: eventType,
      phiAccessed,
      outcome,
      failureReason: success ? undefined : additionalInfo?.error || 'Operation failed',
      additionalInfo: {
        ...additionalInfo,
        originalEventType: eventType,
        complianceNote: 'HIPAA security event logged per § 164.312(b)'
      }
    })
  }

  /**
   * Core audit logging function
   */
  private async logAuditEvent(params: {
    action: AuditAction
    resourceType: ResourceType
    resourceId: string
    phiAccessed: boolean
    outcome: AuditOutcome
    failureReason?: string
    additionalInfo?: Record<string, any>
  }): Promise<void> {
    try {
      const timestamp = new Date().toISOString()
      const sourceInfo = this.getSourceInformation()

      const auditEntry: AuditLogEntry = {
        timestamp,
        user_id: this.currentUser?.id || 'anonymous',
        user_name: this.currentUser?.name || 'Anonymous User',
        user_role: this.currentUser?.role || 'unknown',
        action: params.action,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        phi_accessed: params.phiAccessed,
        source_ip: sourceInfo.ip,
        user_agent: sourceInfo.userAgent,
        session_id: this.sessionId,
        outcome: params.outcome,
        failure_reason: params.failureReason,
        additional_info: {
          ...params.additionalInfo,
          hipaaCompliant: true,
          auditVersion: '1.0',
          retentionPeriod: '6-years'
        }
      }

      // Encrypt sensitive audit data
      const encryptedEntry = await this.encryptAuditEntry(auditEntry)

      // Store in Supabase with retry logic
      await this.storeAuditEntry(encryptedEntry)

      // Log to console without PHI/PII data for debugging
      console.log(`[AUDIT] ${params.action} on ${params.resourceType}:[REDACTED] by [REDACTED] - ${params.outcome}`)

    } catch (error) {
      // Critical: Audit logging failures must be handled
      console.error('CRITICAL: Audit logging failed:', error)

      // Attempt to store failure event in local storage as backup
      try {
        const failureLog = {
          timestamp: new Date().toISOString(),
          error: 'AUDIT_LOG_FAILURE',
          originalAction: params.action,
          failureDetails: error instanceof Error ? error.message : 'Unknown error'
        }
        localStorage.setItem(`audit_failure_${Date.now()}`, JSON.stringify(failureLog))
      } catch (localError) {
        console.error('Failed to store audit failure in local storage:', localError)
      }
    }
  }

  /**
   * Encrypt audit entry for secure storage
   *
   * NOTE: user_name and failure_reason are NOT encrypted because:
   * 1. User names/emails and failure reasons are NOT PHI under HIPAA
   * 2. Audit logs must be readable for compliance reviews
   * 3. HIPAA requires audit logs to show WHO accessed data and WHY actions failed
   * 4. Failure reasons (e.g., "Invalid password", "Account locked") are system messages, not patient data
   */
  private async encryptAuditEntry(entry: AuditLogEntry): Promise<any> {
    // Only encrypt truly sensitive fields that may contain PHI
    // additional_info might contain patient-specific details, so we encrypt it
    const sensitiveFields = ['additional_info']
    const encrypted = { ...entry }

    for (const field of sensitiveFields) {
      if (encrypted[field as keyof AuditLogEntry]) {
        const value = encrypted[field as keyof AuditLogEntry]
        if (typeof value === 'string') {
          encrypted[field as keyof AuditLogEntry] = await encryptionService.encrypt(value) as any
        } else if (typeof value === 'object') {
          encrypted[field as keyof AuditLogEntry] = await encryptionService.encrypt(JSON.stringify(value)) as any
        }
      }
    }

    // Keep user_name and failure_reason in plain text for audit readability
    console.log('✅ Audit entry prepared with readable user_name and failure_reason:', {
      user_name: encrypted.user_name,
      failure_reason: encrypted.failure_reason
    })

    return encrypted
  }

  /**
   * Store audit entry in database
   */
  private async storeAuditEntry(encryptedEntry: any): Promise<void> {
    // HIPAA Compliance: Store audit logs server-side with localStorage backup
    console.log('Audit logging: Storing to Supabase with localStorage backup')

    try {
      // Primary: Store in Supabase database (HIPAA compliant)
      await this.storeAuditEntrySupabase(encryptedEntry)
    } catch (error) {
      console.error('Primary audit storage failed, using backup:', error)
      // Backup: Store locally only if server fails
      try {
        this.storeAuditEntryLocally(encryptedEntry)
      } catch (backupError) {
        console.error('Backup audit storage also failed:', backupError)
        // Continue execution - don't let audit failures break core functionality
      }
    }

  }

  /**
   * Store audit entry in Supabase database (HIPAA compliant)
   */
  private async storeAuditEntrySupabase(encryptedEntry: any): Promise<void> {
    try {
      // Check if Supabase is properly configured
      if (!supabase || typeof supabase.from !== 'function') {
        throw new Error('Supabase not properly configured - using localStorage fallback')
      }

      // Store complete audit data for cross-device login history access
      const auditData = {
        user_id: encryptedEntry.user_id,
        user_name: encryptedEntry.user_name, // Encrypted user name for login history
        user_role: encryptedEntry.user_role,
        action: encryptedEntry.action,
        resource_type: encryptedEntry.resource_type,
        resource_id: encryptedEntry.resource_id,
        phi_accessed: encryptedEntry.phi_accessed || false,
        source_ip: encryptedEntry.source_ip,
        user_agent: encryptedEntry.user_agent,
        session_id: encryptedEntry.session_id,
        outcome: encryptedEntry.outcome,
        failure_reason: encryptedEntry.failure_reason,
        additional_info: encryptedEntry.additional_info,
        timestamp: encryptedEntry.timestamp
      }

      const { error } = await supabase
        .from('audit_logs')
        .insert([auditData])

      if (error) {
        console.error('Supabase audit log error:', error)

        // Check if it's a missing table error
        if (error.message?.includes('relation "public.audit_logs" does not exist') ||
            error.code === 'PGRST116') {
          console.warn('⚠️  audit_logs table does not exist in Supabase. Please create it manually.')
          console.warn('📋 SQL to create the table:')
          console.warn(`
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  user_name TEXT, -- Encrypted user name for cross-device access
  user_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  phi_accessed BOOLEAN DEFAULT false,
  source_ip TEXT,
  user_agent TEXT,
  session_id TEXT,
  outcome TEXT NOT NULL,
  failure_reason TEXT,
  additional_info JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security for HIPAA compliance
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access their own audit logs
CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
  FOR SELECT USING (user_id = auth.uid()::text);

-- Create policy for admin users to view all audit logs
CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()::text
      AND users.role IN ('super_user', 'admin')
    )
  );
          `)
          throw new Error('Audit logs table missing - using localStorage fallback')
        }

        throw new Error(`HIPAA audit storage failed: ${error.message}`)
      }

      console.log('✅ HIPAA audit entry stored successfully in Supabase')
    } catch (error) {
      console.error('❌ Critical: HIPAA audit storage failed:', error)
      throw error
    }
  }

  /**
   * Store audit entry in local storage as fallback
   */
  private storeAuditEntryLocally(entry: any): void {
    try {
      const existingLogs = localStorage.getItem('auditLogs')
      let logs = []

      if (existingLogs) {
        try {
          logs = JSON.parse(existingLogs)
        } catch (error) {
          console.error('Failed to parse existing audit logs:', error)
          logs = []
        }
      }

      // Add new entry
      logs.push({
        ...entry,
        stored_locally: true,
        local_timestamp: new Date().toISOString()
      })

      // Keep only last 1000 entries to prevent storage overflow
      if (logs.length > 1000) {
        logs = logs.slice(-1000)
      }

      localStorage.setItem('auditLogs', JSON.stringify(logs))
    } catch (error) {
      console.error('Failed to store audit entry locally:', error)
    }
  }

  /**
   * Retrieve and decrypt audit logs
   */
  async getAuditLogs(criteria: AuditSearchCriteria = {}): Promise<AuditReport> {
    try {
      // Verify user has audit access permissions
      if (!this.hasAuditAccess()) {
        await this.logAuditEvent({
          action: AuditAction.VIEW,
          resourceType: ResourceType.AUDIT_LOG,
          resourceId: 'audit-access-denied',
          phiAccessed: false,
          outcome: AuditOutcome.FAILURE,
          failureReason: 'Insufficient permissions for audit log access'
        })
        throw new Error('Insufficient permissions to access audit logs')
      }

      // Log audit log access
      await this.logAuditEvent({
        action: AuditAction.VIEW,
        resourceType: ResourceType.AUDIT_LOG,
        resourceId: 'audit-query',
        phiAccessed: true,
        outcome: AuditOutcome.SUCCESS,
        additionalInfo: { searchCriteria: criteria }
      })

      let encryptedEntries = []

      // Try to get from Supabase first for cloud storage and cross-device access
      console.log('Audit retrieval: Attempting Supabase first, fallback to localStorage')

      try {
        // Check if Supabase is properly configured
        if (!supabase || typeof supabase.from !== 'function') {
          throw new Error('Supabase not properly configured - using localStorage fallback')
        }

        let query = supabase
          .from('audit_logs')
          .select('*')
          .order('timestamp', { ascending: false })

        // Apply search criteria
        if (criteria.startDate) {
          query = query.gte('timestamp', criteria.startDate.toISOString())
        }
        if (criteria.endDate) {
          query = query.lte('timestamp', criteria.endDate.toISOString())
        }
        if (criteria.userId) {
          query = query.eq('user_id', criteria.userId)
        }
        if (criteria.action) {
          query = query.eq('action', criteria.action)
        }
        if (criteria.resourceType) {
          query = query.eq('resource_type', criteria.resourceType)
        }
        if (criteria.outcome) {
          query = query.eq('outcome', criteria.outcome)
        }
        if (criteria.phiAccessed !== undefined) {
          query = query.eq('phi_accessed', criteria.phiAccessed)
        }

        const limit = criteria.limit || 100
        const offset = criteria.offset || 0
        query = query.range(offset, offset + limit - 1)

        const { data, error } = await query

        if (error) {
          console.warn('Supabase audit log retrieval failed, using local storage:', error.message)
          encryptedEntries = this.getAuditLogsFromLocalStorage(criteria)
        } else {
          console.log(`✅ Retrieved ${data?.length || 0} audit entries from Supabase`)
          encryptedEntries = data || []
        }
      } catch (error) {
        console.warn('Supabase connection failed, using local storage for audit logs:', error)
        encryptedEntries = this.getAuditLogsFromLocalStorage(criteria)
      }

      // Decrypt audit entries
      const decryptedEntries: AuditLogEntry[] = []
      for (const entry of encryptedEntries || []) {
        try {
          const decrypted = await this.decryptAuditEntry(entry)
          decryptedEntries.push(decrypted)
        } catch (decryptError) {
          console.error('Failed to decrypt audit entry:', decryptError)
          // Include entry with placeholder for failed decryption
          decryptedEntries.push({
            ...entry,
            user_name: '[ENCRYPTED_DATA]',
            additional_info: { decryptionFailed: true },
            failure_reason: '[ENCRYPTED_DATA]'
          })
        }
      }

      // Generate summary
      const summary = this.generateAuditSummary(decryptedEntries, criteria)

      return {
        entries: decryptedEntries,
        totalCount: decryptedEntries.length,
        summary
      }

    } catch (error) {
      console.error('Failed to retrieve audit logs:', error)
      throw error
    }
  }

  /**
   * Get audit logs from local storage
   */
  private getAuditLogsFromLocalStorage(criteria: AuditSearchCriteria): any[] {
    try {
      const storedLogs = localStorage.getItem('auditLogs')
      if (!storedLogs) {
        return []
      }

      let logs = JSON.parse(storedLogs)

      // Apply basic filtering
      if (criteria.startDate) {
        logs = logs.filter((log: any) => new Date(log.timestamp) >= criteria.startDate!)
      }
      if (criteria.endDate) {
        logs = logs.filter((log: any) => new Date(log.timestamp) <= criteria.endDate!)
      }
      if (criteria.userId) {
        logs = logs.filter((log: any) => log.user_id === criteria.userId)
      }
      if (criteria.action) {
        logs = logs.filter((log: any) => log.action === criteria.action)
      }
      if (criteria.resourceType) {
        logs = logs.filter((log: any) => log.resource_type === criteria.resourceType)
      }
      if (criteria.outcome) {
        logs = logs.filter((log: any) => log.outcome === criteria.outcome)
      }
      if (criteria.phiAccessed !== undefined) {
        logs = logs.filter((log: any) => log.phi_accessed === criteria.phiAccessed)
      }

      // Sort by timestamp descending
      logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      // Apply limit and offset
      const offset = criteria.offset || 0
      const limit = criteria.limit || 100

      return logs.slice(offset, offset + limit)
    } catch (error) {
      console.error('Failed to retrieve audit logs from local storage:', error)
      return []
    }
  }

  /**
   * Decrypt audit entry
   */
  private async decryptAuditEntry(encryptedEntry: any): Promise<AuditLogEntry> {
    const decrypted = { ...encryptedEntry }
    const sensitiveFields = ['user_name', 'additional_info', 'failure_reason']

    for (const field of sensitiveFields) {
      if (decrypted[field] && typeof decrypted[field] === 'object' && decrypted[field].data) {
        try {
          const decryptedValue = await encryptionService.decrypt(decrypted[field] as EncryptedData)
          if (field === 'additional_info') {
            decrypted[field] = JSON.parse(decryptedValue)
          } else {
            decrypted[field] = decryptedValue
          }
        } catch (error) {
          console.error(`Failed to decrypt audit field ${field}:`, error)
          decrypted[field] = '[ENCRYPTED_DATA]'
        }
      }
    }

    return decrypted as AuditLogEntry
  }

  /**
   * Generate audit summary statistics
   */
  private generateAuditSummary(entries: AuditLogEntry[], criteria: AuditSearchCriteria): AuditReport['summary'] {
    const phiAccessCount = entries.filter(e => e.phi_accessed).length
    const failureCount = entries.filter(e => e.outcome === AuditOutcome.FAILURE).length
    const uniqueUsers = new Set(entries.map(e => e.user_id)).size

    const timestamps = entries.map(e => new Date(e.timestamp))
    const minTime = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : new Date()
    const maxTime = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : new Date()

    return {
      totalAccess: entries.length,
      phiAccess: phiAccessCount,
      failures: failureCount,
      uniqueUsers,
      timeRange: {
        start: criteria.startDate || minTime,
        end: criteria.endDate || maxTime
      }
    }
  }

  /**
   * Export audit logs for compliance reporting
   */
  async exportAuditLogs(criteria: AuditSearchCriteria, format: 'json' | 'csv' = 'json'): Promise<string> {
    // Log export request
    await this.logAuditEvent({
      action: AuditAction.EXPORT,
      resourceType: ResourceType.AUDIT_LOG,
      resourceId: 'audit-export',
      phiAccessed: true,
      outcome: AuditOutcome.SUCCESS,
      additionalInfo: { exportFormat: format, criteria }
    })

    const auditReport = await this.getAuditLogs(criteria)

    if (format === 'csv') {
      return this.convertToCSV(auditReport.entries)
    }

    return JSON.stringify({
      exportTimestamp: new Date().toISOString(),
      exportedBy: this.currentUser?.name || 'System',
      complianceNote: 'HIPAA audit log export per § 164.312(b)',
      retentionRequirement: '6 years minimum',
      ...auditReport
    }, null, 2)
  }

  /**
   * Convert audit logs to CSV format
   */
  private convertToCSV(entries: AuditLogEntry[]): string {
    const headers = [
      'Timestamp', 'User ID', 'User Name', 'User Role', 'Action',
      'Resource Type', 'Resource ID', 'PHI Accessed', 'Source IP',
      'Session ID', 'Outcome', 'Failure Reason'
    ]

    const csvRows = [headers.join(',')]

    for (const entry of entries) {
      const row = [
        entry.timestamp,
        entry.user_id,
        `"${entry.user_name}"`,
        entry.user_role,
        entry.action,
        entry.resource_type,
        entry.resource_id,
        entry.phi_accessed.toString(),
        entry.source_ip,
        entry.session_id,
        entry.outcome,
        entry.failure_reason ? `"${entry.failure_reason}"` : ''
      ]
      csvRows.push(row.join(','))
    }

    return csvRows.join('\n')
  }

  /**
   * Check if current user has audit access permissions
   */
  private hasAuditAccess(): boolean {
    const allowedRoles = ['super_user', 'compliance_officer', 'system_admin']
    return allowedRoles.includes(this.currentUser?.role || '')
  }

  /**
   * Get source information for audit logging
   */
  private getSourceInformation(): { ip: string; userAgent: string } {
    return {
      ip: this.detectClientIP(),
      userAgent: navigator.userAgent || 'Unknown'
    }
  }

  /**
   * Detect real client IP address from various sources
   * Supports Azure Static Web Apps, Cloudflare, and other hosting environments
   */
  private detectClientIP(): string {
    try {
      // Try to get IP from various header sources that might be available
      // Note: In browser environments, these headers are not directly accessible
      // This method attempts to detect IP through various techniques

      // Check if we're in a server-side context or have access to request headers
      if (typeof window !== 'undefined' && window.location) {
        // Browser environment - limited IP detection options

        // Method 1: Check for IP in URL parameters (if passed by server)
        const urlParams = new URLSearchParams(window.location.search)
        const urlIP = urlParams.get('client_ip')
        if (urlIP && this.isValidIP(urlIP)) {
          this.cacheDetectedIP(urlIP)
          return urlIP
        }

        // Method 2: Check for IP in custom meta tags (if set by server)
        const metaIP = document.querySelector('meta[name="client-ip"]')?.getAttribute('content')
        if (metaIP && this.isValidIP(metaIP)) {
          this.cacheDetectedIP(metaIP)
          return metaIP
        }

        // Method 3: Check localStorage for cached IP (from previous server detection)
        const cachedIP = this.getCachedIP()
        if (cachedIP && this.isValidIP(cachedIP)) {
          return cachedIP
        }

        // Method 4: Attempt to use modern browser API if available
        if ('connection' in navigator && (navigator as any).connection) {
          const connection = (navigator as any).connection
          if (connection.effectiveType && connection.downlink) {
            // This is a proxy for network detection, not actual IP
            // but indicates we have network connectivity
            // Trigger async IP detection for future use
            this.detectIPAsync()
          }
        }
      }

      // Method 5: Check if we're in a Node.js/server context with access to headers
      if (typeof process !== 'undefined' && process.env) {
        // Check common environment variables for IP forwarding
        const serverIP = process.env.HTTP_X_FORWARDED_FOR ||
                        process.env.HTTP_X_REAL_IP ||
                        process.env.HTTP_CLIENT_IP ||
                        process.env.REMOTE_ADDR

        if (serverIP && this.isValidIP(serverIP)) {
          const parsedIP = this.parseForwardedIP(serverIP)
          this.cacheDetectedIP(parsedIP)
          return parsedIP
        }
      }

      // Method 6: Azure Static Web Apps specific detection
      // Azure SWA may provide IP information through specific mechanisms
      if (this.isAzureStaticWebApp()) {
        const azureIP = this.detectAzureStaticWebAppIP()
        if (azureIP && this.isValidIP(azureIP)) {
          this.cacheDetectedIP(azureIP)
          return azureIP
        }
      }

      // Method 7: Check if we have a previously detected IP from async detection
      const asyncDetectedIP = localStorage.getItem('async_detected_ip')
      if (asyncDetectedIP && this.isValidIP(asyncDetectedIP)) {
        return asyncDetectedIP
      }

      // Fallback: Return localhost for development or when IP cannot be detected
      return '127.0.0.1'

    } catch (error) {
      console.warn('IP detection failed, using fallback:', error)
      return '127.0.0.1'
    }
  }

  /**
   * Get cached IP with expiration check
   */
  private getCachedIP(): string | null {
    try {
      const cachedIP = localStorage.getItem('detected_client_ip')
      const expiresStr = localStorage.getItem('detected_client_ip_expires')

      if (!cachedIP || !expiresStr) {
        return null
      }

      const expires = parseInt(expiresStr, 10)
      if (Date.now() > expires) {
        // Cache expired, remove it
        localStorage.removeItem('detected_client_ip')
        localStorage.removeItem('detected_client_ip_expires')
        return null
      }

      return cachedIP
    } catch (error) {
      console.warn('Failed to get cached IP:', error)
      return null
    }
  }

  /**
   * Asynchronously detect IP using external services (non-blocking)
   * This runs in the background and caches the result for future use
   */
  private async detectIPAsync(): Promise<void> {
    try {
      // Don't run if we already have a recent async detection
      const lastAsyncDetection = localStorage.getItem('last_async_ip_detection')
      if (lastAsyncDetection) {
        const lastTime = parseInt(lastAsyncDetection, 10)
        const oneHour = 60 * 60 * 1000
        if (Date.now() - lastTime < oneHour) {
          return // Skip if we detected within the last hour
        }
      }

      // Update detection timestamp
      localStorage.setItem('last_async_ip_detection', Date.now().toString())

      // Try multiple IP detection services with timeout
      const ipServices = [
        'https://api.ipify.org?format=json',
        'https://httpbin.org/ip',
        'https://ipinfo.io/json',
        'https://api.my-ip.io/ip.json'
      ]

      for (const serviceUrl of ipServices) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

          const response = await fetch(serviceUrl, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json'
            }
          })

          clearTimeout(timeoutId)

          if (response.ok) {
            const data = await response.json()
            let detectedIP = null

            // Parse different response formats
            if (data.ip) {
              detectedIP = data.ip
            } else if (data.origin) {
              detectedIP = data.origin
            } else if (typeof data === 'string') {
              detectedIP = data
            }

            if (detectedIP && this.isValidIP(detectedIP) && !this.isPrivateIP(detectedIP)) {
              localStorage.setItem('async_detected_ip', detectedIP)
              localStorage.setItem('async_detected_ip_expires', (Date.now() + 24 * 60 * 60 * 1000).toString())
              console.log('✅ IP detected asynchronously:', detectedIP)
              return // Success, exit loop
            }
          }
        } catch (error) {
          // Continue to next service
          console.debug('IP service failed:', serviceUrl, error)
        }
      }

      console.warn('All IP detection services failed')
    } catch (error) {
      console.warn('Async IP detection failed:', error)
    }
  }

  /**
   * Parse IP from X-Forwarded-For header (handles comma-separated list)
   */
  private parseForwardedIP(forwardedHeader: string): string {
    // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
    // We want the first (leftmost) IP which is the original client
    const ips = forwardedHeader.split(',').map(ip => ip.trim())

    for (const ip of ips) {
      if (this.isValidIP(ip) && !this.isPrivateIP(ip)) {
        return ip
      }
    }

    // If no public IP found, return the first valid IP
    for (const ip of ips) {
      if (this.isValidIP(ip)) {
        return ip
      }
    }

    return '127.0.0.1'
  }

  /**
   * Validate IP address format (IPv4 and IPv6)
   */
  private isValidIP(ip: string): boolean {
    if (!ip || typeof ip !== 'string') return false

    // IPv4 validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    if (ipv4Regex.test(ip)) return true

    // IPv6 validation (basic)
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/
    if (ipv6Regex.test(ip)) return true

    // IPv6 compressed format
    const ipv6CompressedRegex = /^([0-9a-fA-F]{1,4}:)*::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:)*::[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:)*::$/
    if (ipv6CompressedRegex.test(ip)) return true

    return false
  }

  /**
   * Check if IP is a private/internal IP address
   */
  private isPrivateIP(ip: string): boolean {
    // Private IPv4 ranges:
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./, // Link-local
      /^localhost$/i
    ]

    return privateRanges.some(range => range.test(ip))
  }

  /**
   * Detect if running on Azure Static Web Apps
   */
  private isAzureStaticWebApp(): boolean {
    // Check for Azure Static Web Apps specific indicators
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname

      // Azure Static Web Apps hostnames
      if (hostname.includes('.azurestaticapps.net') ||
          hostname.includes('.1.azurestaticapps.net') ||
          hostname.includes('.2.azurestaticapps.net') ||
          hostname.includes('.3.azurestaticapps.net') ||
          hostname.includes('.centralus.azurestaticapps.net')) {
        return true
      }
    }

    // Check for Azure environment variables
    if (typeof process !== 'undefined' && process.env) {
      return !!(process.env.AZURE_STATIC_WEB_APPS_API_TOKEN ||
               process.env.APPSETTING_WEBSITE_SITE_NAME ||
               process.env.WEBSITE_SITE_NAME)
    }

    return false
  }

  /**
   * Attempt to detect IP in Azure Static Web Apps environment
   */
  private detectAzureStaticWebAppIP(): string | null {
    try {
      // Azure Static Web Apps may provide client IP through:
      // 1. Custom headers in Azure Functions API
      // 2. Environment variables
      // 3. Request context (if available)

      if (typeof process !== 'undefined' && process.env) {
        // Check Azure-specific environment variables for IP forwarding
        const azureIP = process.env.HTTP_X_AZURE_CLIENTIP ||
                       process.env.HTTP_X_AZURE_FDID ||
                       process.env.HTTP_X_FORWARDED_FOR ||
                       process.env.HTTP_X_REAL_IP

        if (azureIP) {
          return this.parseForwardedIP(azureIP)
        }
      }

      // If we have access to custom Azure headers through a service worker
      // or API endpoint, we could check those here

      return null
    } catch (error) {
      console.warn('Azure SWA IP detection failed:', error)
      return null
    }
  }

  /**
   * Cache detected IP for subsequent requests
   */
  private cacheDetectedIP(ip: string): void {
    try {
      if (ip && ip !== '127.0.0.1' && this.isValidIP(ip)) {
        localStorage.setItem('detected_client_ip', ip)
        // Set expiration (24 hours)
        localStorage.setItem('detected_client_ip_expires', (Date.now() + 24 * 60 * 60 * 1000).toString())
      }
    } catch (error) {
      console.warn('Failed to cache detected IP:', error)
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get current user from localStorage
   */
  private getCurrentUser(): void {
    try {
      const userData = localStorage.getItem('currentUser')
      if (userData) {
        this.currentUser = JSON.parse(userData)
      }
    } catch (error) {
      console.error('Failed to get current user:', error)
    }
  }

  /**
   * Get IP detection status for debugging and monitoring
   */
  private getIPDetectionStatus(): Record<string, any> {
    return {
      hasUrlParam: new URLSearchParams(window.location?.search || '').has('client_ip'),
      hasMetaTag: !!document.querySelector('meta[name="client-ip"]'),
      hasCachedIP: !!this.getCachedIP(),
      hasAsyncIP: !!localStorage.getItem('async_detected_ip'),
      isAzureEnvironment: this.isAzureStaticWebApp(),
      detectedIP: this.detectClientIP(),
      lastAsyncDetection: localStorage.getItem('last_async_ip_detection')
    }
  }

  /**
   * Manually trigger IP detection (for testing or force refresh)
   */
  async refreshIPDetection(): Promise<string> {
    try {
      // Clear cached IPs
      localStorage.removeItem('detected_client_ip')
      localStorage.removeItem('detected_client_ip_expires')
      localStorage.removeItem('async_detected_ip')
      localStorage.removeItem('async_detected_ip_expires')
      localStorage.removeItem('last_async_ip_detection')

      // Force async detection
      await this.detectIPAsync()

      // Return newly detected IP
      const newIP = this.detectClientIP()

      // Log the refresh event
      await this.logAuditEvent({
        action: AuditAction.SYSTEM_ACCESS,
        resourceType: ResourceType.SYSTEM,
        resourceId: 'ip-detection-refresh',
        phiAccessed: false,
        outcome: AuditOutcome.SUCCESS,
        additionalInfo: {
          refreshedIP: newIP,
          refreshTime: new Date().toISOString(),
          detectionStatus: this.getIPDetectionStatus()
        }
      })

      return newIP
    } catch (error) {
      console.error('Failed to refresh IP detection:', error)
      return '127.0.0.1'
    }
  }

  /**
   * Clean up audit logger
   */
  async cleanup(): Promise<void> {
    await this.logAuditEvent({
      action: AuditAction.LOGOUT,
      resourceType: ResourceType.SYSTEM,
      resourceId: 'audit-logger',
      phiAccessed: false,
      outcome: AuditOutcome.SUCCESS,
      additionalInfo: {
        sessionDuration: Date.now() - parseInt(this.sessionId.split('_')[1]),
        cleanupTime: new Date().toISOString(),
        finalIPStatus: this.getIPDetectionStatus()
      }
    })
  }
}

// Export singleton instance
export const auditLogger = new HIPAAAuditLogger()

// Export utility functions for IP detection
export const auditIPUtils = {
  /**
   * Get current IP detection status
   */
  getIPStatus: () => {
    return (auditLogger as any).getIPDetectionStatus()
  },

  /**
   * Manually refresh IP detection
   */
  refreshIP: async () => {
    return await (auditLogger as any).refreshIPDetection()
  },

  /**
   * Get current detected IP
   */
  getCurrentIP: () => {
    return (auditLogger as any).detectClientIP()
  }
}

// Auto-initialize with current user
const initializeAuditLogger = () => {
  try {
    const userData = localStorage.getItem('currentUser')
    if (userData) {
      const user = JSON.parse(userData)
      auditLogger.initialize(user)
    }
  } catch (error) {
    console.error('Failed to initialize audit logger:', error)
  }
}

// Initialize on module load
initializeAuditLogger()

// Re-initialize when user changes
window.addEventListener('storage', (e) => {
  if (e.key === 'currentUser') {
    initializeAuditLogger()
  }
})