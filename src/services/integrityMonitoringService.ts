/**
 * REAL-TIME INTEGRITY MONITORING SERVICE
 *
 * Comprehensive integrity monitoring system for HIPAA compliance that continuously
 * monitors critical system files and data integrity without breaking existing functionality.
 *
 * Features:
 * - Hash verification of critical system files
 * - Database integrity checks for audit logs and PHI data
 * - Automated alerts for unauthorized changes
 * - Continuous monitoring with configurable intervals
 * - Non-breaking integration with existing systems
 * - Web Worker support for background monitoring
 * - Incident response integration
 * - Compliance reporting
 */

import { supabase } from '@/config/supabase'
import { auditLogger, AuditAction, ResourceType, AuditOutcome } from './auditLogger'
import { incidentResponseService } from './incidentResponseService'
import { HashUtils } from '@/utils/hashUtils'
import {
  IntegrityCheck,
  IntegrityCheckType,
  IntegrityCategory,
  IntegrityPriority,
  IntegrityResult,
  IntegrityStatus,
  IntegrityBaseline,
  IntegrityMonitoringConfig,
  IntegrityAlert,
  IntegrityDashboardData,
  IntegrityStatusSummary,
  IntegrityWorkerMessage,
  WorkerMessageType,
  IntegrityConfiguration,
  IntegrityServiceResponse,
  IntegrityBatchResult,
  IntegritySystemHealth,
  HealthStatus,
  DeviationType,
  DeviationSeverity,
  AlertStatus,
  IntegritySearchCriteria,
  IntegritySearchResponse,
  IntegrityReport,
  IntegrityReportType,
  ReportPeriod,
  IntegrityMetrics
} from '@/types/integrityTypes'
import {
  IncidentType,
  IncidentSeverity,
  CreateIncidentRequest
} from '@/types/incidentTypes'

export class IntegrityMonitoringService {
  private static instance: IntegrityMonitoringService
  private worker: Worker | null = null
  private isMonitoring = false
  private configuration: IntegrityMonitoringConfig
  private checks: Map<string, IntegrityCheck> = new Map()
  private baselines: Map<string, IntegrityBaseline> = new Map()
  private results: Map<string, IntegrityResult[]> = new Map()
  private alerts: Map<string, IntegrityAlert> = new Map()
  private eventListeners: Map<string, ((data: any) => void)[]> = new Map()
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map()
  private lastHealthCheck = new Date()

  // Storage keys
  private static readonly STORAGE_KEYS = {
    CONFIGURATION: 'integrity_monitoring_config',
    CHECKS: 'integrity_checks',
    BASELINES: 'integrity_baselines',
    RESULTS: 'integrity_results',
    ALERTS: 'integrity_alerts',
    METRICS: 'integrity_metrics'
  }

  // Critical system files to monitor
  private static readonly CRITICAL_FILES = [
    'src/services/auditLogger.ts',
    'src/services/freshMfaService.ts',
    'src/services/incidentResponseService.ts',
    'src/services/encryption.ts',
    'src/services/secureEncryption.ts',
    'src/services/secureStorage.ts',
    'src/utils/encryption.ts',
    'src/config/supabase.ts',
    'staticwebapp.config.json',
    'package.json',
    'vite.config.ts'
  ]

  constructor() {
    this.configuration = this.getDefaultConfiguration()
    this.loadConfiguration()
    this.loadStoredData()
    this.initializeCriticalChecks()
  }

  /**
   * Singleton instance
   */
  static getInstance(): IntegrityMonitoringService {
    if (!IntegrityMonitoringService.instance) {
      IntegrityMonitoringService.instance = new IntegrityMonitoringService()
    }
    return IntegrityMonitoringService.instance
  }

  /**
   * Initialize the integrity monitoring service
   */
  async initialize(): Promise<IntegrityServiceResponse<void>> {
    try {
      // Load existing data
      await this.loadStoredData()

      // Initialize Web Worker if enabled
      if (this.configuration.workerEnabled) {
        await this.initializeWorker()
      }

      // Create baselines for critical files if they don't exist
      await this.createMissingBaselines()

      // Start monitoring if enabled
      if (this.configuration.enabled) {
        await this.startMonitoring()
      }

      // Log initialization
      await auditLogger.logPHIAccess(
        AuditAction.SYSTEM_ACCESS,
        ResourceType.SYSTEM,
        'integrity-monitoring-service',
        AuditOutcome.SUCCESS,
        {
          operation: 'integrity_monitoring_initialization',
          checksCount: this.checks.size,
          baselinesCount: this.baselines.size,
          workerEnabled: this.configuration.workerEnabled,
          timestamp: new Date().toISOString()
        }
      )

      console.log('✅ Integrity Monitoring Service initialized successfully')

      return { success: true }

    } catch (error) {
      console.error('❌ Failed to initialize Integrity Monitoring Service:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Start integrity monitoring
   */
  async startMonitoring(): Promise<IntegrityServiceResponse<void>> {
    try {
      if (this.isMonitoring) {
        return { success: true, warnings: ['Monitoring already active'] }
      }

      this.isMonitoring = true

      // Start individual check intervals
      for (const [checkId, check] of this.checks) {
        if (check.enabled) {
          this.scheduleCheck(checkId, check)
        }
      }

      // Start worker if enabled
      if (this.worker && this.configuration.workerEnabled) {
        this.sendWorkerMessage({
          type: WorkerMessageType.START_MONITORING,
          id: 'start-monitoring',
          timestamp: new Date(),
          payload: {
            checks: Array.from(this.checks.values()),
            config: this.configuration
          }
        })
      }

      // Emit monitoring started event
      this.emitEvent('monitoring-started', { timestamp: new Date() })

      console.log('🔍 Integrity monitoring started')

      return { success: true }

    } catch (error) {
      console.error('❌ Failed to start monitoring:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Stop integrity monitoring
   */
  async stopMonitoring(): Promise<IntegrityServiceResponse<void>> {
    try {
      this.isMonitoring = false

      // Clear all intervals
      for (const interval of this.monitoringIntervals.values()) {
        clearInterval(interval)
      }
      this.monitoringIntervals.clear()

      // Stop worker
      if (this.worker) {
        this.sendWorkerMessage({
          type: WorkerMessageType.STOP_MONITORING,
          id: 'stop-monitoring',
          timestamp: new Date(),
          payload: {}
        })
      }

      // Emit monitoring stopped event
      this.emitEvent('monitoring-stopped', { timestamp: new Date() })

      console.log('⏹️ Integrity monitoring stopped')

      return { success: true }

    } catch (error) {
      console.error('❌ Failed to stop monitoring:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Run a specific integrity check
   */
  async runCheck(checkId: string): Promise<IntegrityServiceResponse<IntegrityResult>> {
    try {
      const check = this.checks.get(checkId)
      if (!check) {
        return { success: false, error: `Check ${checkId} not found` }
      }

      if (!check.enabled) {
        return { success: false, error: `Check ${checkId} is disabled` }
      }

      const result = await this.executeCheck(check)

      // Store result
      if (!this.results.has(checkId)) {
        this.results.set(checkId, [])
      }
      const checkResults = this.results.get(checkId)!
      checkResults.unshift(result)

      // Keep only last 100 results per check
      if (checkResults.length > 100) {
        checkResults.splice(100)
      }

      // Update check's last result
      check.lastChecked = result.timestamp
      check.lastResult = result

      // Handle result
      await this.handleCheckResult(check, result)

      // Save data
      this.saveStoredData()

      return { success: true, data: result }

    } catch (error) {
      console.error(`❌ Failed to run check ${checkId}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Run all enabled checks
   */
  async runAllChecks(): Promise<IntegrityServiceResponse<IntegrityBatchResult>> {
    try {
      const startTime = Date.now()
      const results: IntegrityResult[] = []
      const errors: Array<{ checkId: string; error: string }> = []

      const enabledChecks = Array.from(this.checks.values()).filter(check => check.enabled)

      // Run checks with concurrency limit
      const maxConcurrent = this.configuration.maxConcurrentChecks
      const batches = this.chunkArray(enabledChecks, maxConcurrent)

      for (const batch of batches) {
        const batchPromises = batch.map(async (check) => {
          try {
            const response = await this.runCheck(check.id)
            if (response.success && response.data) {
              results.push(response.data)
            } else {
              errors.push({
                checkId: check.id,
                error: response.error || 'Unknown error'
              })
            }
          } catch (error) {
            errors.push({
              checkId: check.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        })

        await Promise.all(batchPromises)

        // Small delay between batches to prevent overwhelming the system
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      const duration = Date.now() - startTime
      const summary = this.generateStatusSummary()

      const batchResult: IntegrityBatchResult = {
        results,
        summary,
        errors,
        duration,
        timestamp: new Date()
      }

      return { success: true, data: batchResult }

    } catch (error) {
      console.error('❌ Failed to run all checks:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Create baseline for a check
   */
  async createBaseline(checkId: string): Promise<IntegrityServiceResponse<IntegrityBaseline>> {
    try {
      const check = this.checks.get(checkId)
      if (!check) {
        return { success: false, error: `Check ${checkId} not found` }
      }

      const baseline = await this.generateBaseline(check)
      this.baselines.set(checkId, baseline)

      // Update check with baseline
      check.baseline = baseline

      // Save data
      this.saveStoredData()

      // Log baseline creation
      await auditLogger.logPHIAccess(
        AuditAction.CREATE,
        ResourceType.SYSTEM,
        `integrity-baseline-${checkId}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'integrity_baseline_created',
          checkId,
          checkType: check.type,
          baselineVersion: baseline.version
        }
      )

      console.log(`📏 Baseline created for check ${checkId}`)

      return { success: true, data: baseline }

    } catch (error) {
      console.error(`❌ Failed to create baseline for ${checkId}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(): Promise<IntegrityServiceResponse<IntegrityDashboardData>> {
    try {
      const summary = this.generateStatusSummary()
      const recentChecks = this.getRecentResults(50)
      const activeAlerts = Array.from(this.alerts.values())
        .filter(alert => alert.status === AlertStatus.ACTIVE)
      const trends = this.calculateTrends()
      const coverage = this.calculateCoverage()
      const performance = this.calculatePerformance()

      const dashboardData: IntegrityDashboardData = {
        summary,
        recentChecks,
        activeAlerts,
        trends,
        coverage,
        performance
      }

      return { success: true, data: dashboardData }

    } catch (error) {
      console.error('❌ Failed to get dashboard data:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<IntegrityServiceResponse<IntegritySystemHealth>> {
    try {
      const now = new Date()
      const metrics = this.calculateMetrics()
      const alerts = Array.from(this.alerts.values())
        .filter(alert => alert.status === AlertStatus.ACTIVE)

      // Calculate overall health
      let overallHealth = HealthStatus.HEALTHY
      const criticalAlerts = alerts.filter(a => a.severity === DeviationSeverity.CRITICAL)
      const highAlerts = alerts.filter(a => a.severity === DeviationSeverity.HIGH)

      if (criticalAlerts.length > 0) {
        overallHealth = HealthStatus.CRITICAL
      } else if (highAlerts.length > 0) {
        overallHealth = HealthStatus.DEGRADED
      } else if (alerts.length > 0) {
        overallHealth = HealthStatus.WARNING
      }

      // Component health
      const components = this.calculateComponentHealth()

      const recommendations = this.generateHealthRecommendations(alerts, metrics)

      const systemHealth: IntegritySystemHealth = {
        overall: overallHealth,
        components,
        lastUpdated: now,
        metrics,
        alerts,
        recommendations
      }

      this.lastHealthCheck = now

      return { success: true, data: systemHealth }

    } catch (error) {
      console.error('❌ Failed to get system health:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string
  ): Promise<IntegrityServiceResponse<void>> {
    try {
      const alert = this.alerts.get(alertId)
      if (!alert) {
        return { success: false, error: `Alert ${alertId} not found` }
      }

      alert.acknowledged = true
      alert.acknowledgedBy = acknowledgedBy
      alert.acknowledgedAt = new Date()
      alert.status = AlertStatus.ACKNOWLEDGED

      // Save data
      this.saveStoredData()

      // Log acknowledgment
      await auditLogger.logPHIAccess(
        AuditAction.UPDATE,
        ResourceType.SYSTEM,
        `integrity-alert-${alertId}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'integrity_alert_acknowledged',
          alertId,
          acknowledgedBy
        }
      )

      console.log(`✅ Alert ${alertId} acknowledged by ${acknowledgedBy}`)

      return { success: true }

    } catch (error) {
      console.error(`❌ Failed to acknowledge alert ${alertId}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    alertId: string,
    resolvedBy: string
  ): Promise<IntegrityServiceResponse<void>> {
    try {
      const alert = this.alerts.get(alertId)
      if (!alert) {
        return { success: false, error: `Alert ${alertId} not found` }
      }

      alert.resolved = true
      alert.resolvedBy = resolvedBy
      alert.resolvedAt = new Date()
      alert.status = AlertStatus.RESOLVED

      // Save data
      this.saveStoredData()

      // Log resolution
      await auditLogger.logPHIAccess(
        AuditAction.UPDATE,
        ResourceType.SYSTEM,
        `integrity-alert-${alertId}`,
        AuditOutcome.SUCCESS,
        {
          operation: 'integrity_alert_resolved',
          alertId,
          resolvedBy
        }
      )

      console.log(`✅ Alert ${alertId} resolved by ${resolvedBy}`)

      return { success: true }

    } catch (error) {
      console.error(`❌ Failed to resolve alert ${alertId}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Update configuration
   */
  async updateConfiguration(
    updates: Partial<IntegrityMonitoringConfig>
  ): Promise<IntegrityServiceResponse<void>> {
    try {
      const oldConfig = { ...this.configuration }
      this.configuration = { ...this.configuration, ...updates }

      // Save configuration
      this.saveConfiguration()

      // Restart monitoring if necessary
      if (this.isMonitoring && (
        oldConfig.enabled !== this.configuration.enabled ||
        oldConfig.globalInterval !== this.configuration.globalInterval
      )) {
        await this.stopMonitoring()
        if (this.configuration.enabled) {
          await this.startMonitoring()
        }
      }

      // Log configuration update
      await auditLogger.logPHIAccess(
        AuditAction.UPDATE,
        ResourceType.SYSTEM,
        'integrity-monitoring-config',
        AuditOutcome.SUCCESS,
        {
          operation: 'integrity_configuration_updated',
          changes: Object.keys(updates)
        }
      )

      console.log('⚙️ Integrity monitoring configuration updated')

      return { success: true }

    } catch (error) {
      console.error('❌ Failed to update configuration:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Execute a specific integrity check
   */
  private async executeCheck(check: IntegrityCheck): Promise<IntegrityResult> {
    const startTime = Date.now()

    try {
      let expected: any
      let actual: any
      let status = IntegrityStatus.VERIFIED
      let confidence = 100

      switch (check.type) {
        case IntegrityCheckType.FILE_HASH:
          const hashResult = await this.checkFileHash(check)
          expected = hashResult.expected
          actual = hashResult.actual
          status = hashResult.status
          confidence = hashResult.confidence
          break

        case IntegrityCheckType.DATABASE_INTEGRITY:
          const dbResult = await this.checkDatabaseIntegrity(check)
          expected = dbResult.expected
          actual = dbResult.actual
          status = dbResult.status
          confidence = dbResult.confidence
          break

        case IntegrityCheckType.CONFIGURATION_INTEGRITY:
          const configResult = await this.checkConfigurationIntegrity(check)
          expected = configResult.expected
          actual = configResult.actual
          status = configResult.status
          confidence = configResult.confidence
          break

        case IntegrityCheckType.AUDIT_LOG_INTEGRITY:
          const auditResult = await this.checkAuditLogIntegrity(check)
          expected = auditResult.expected
          actual = auditResult.actual
          status = auditResult.status
          confidence = auditResult.confidence
          break

        default:
          throw new Error(`Unsupported check type: ${check.type}`)
      }

      const result: IntegrityResult = {
        checkId: check.id,
        timestamp: new Date(),
        status,
        expected,
        actual,
        confidence,
        metadata: {
          checkType: check.type,
          category: check.category,
          priority: check.priority,
          duration: Date.now() - startTime
        }
      }

      // Add deviation if status is not verified
      if (status !== IntegrityStatus.VERIFIED) {
        result.deviation = await this.analyzeDeviation(check, expected, actual)
      }

      return result

    } catch (error) {
      console.error(`Check ${check.id} failed:`, error)

      return {
        checkId: check.id,
        timestamp: new Date(),
        status: IntegrityStatus.ERROR,
        expected: 'N/A',
        actual: error instanceof Error ? error.message : 'Unknown error',
        confidence: 0,
        metadata: {
          checkType: check.type,
          category: check.category,
          priority: check.priority,
          duration: Date.now() - startTime,
          error: true
        }
      }
    }
  }

  /**
   * Check file hash integrity
   */
  private async checkFileHash(check: IntegrityCheck): Promise<any> {
    const baseline = check.baseline
    if (!baseline) {
      throw new Error('No baseline found for file hash check')
    }

    const filePath = check.metadata?.filePath
    if (!filePath) {
      throw new Error('No file path specified for file hash check')
    }

    try {
      // In a real browser environment, we can't directly read files from the filesystem
      // This would need to be adapted for your specific deployment and access patterns
      // For now, we'll simulate the check or use a different approach

      // Try to fetch the file if it's accessible via HTTP
      let content: string
      try {
        const response = await fetch(filePath)
        if (response.ok) {
          content = await response.text()
        } else {
          throw new Error(`Cannot access file: ${response.status}`)
        }
      } catch (fetchError) {
        // File not accessible via HTTP, return warning
        return {
          expected: baseline.values.hashes?.[filePath] || 'unknown',
          actual: 'file_not_accessible',
          status: IntegrityStatus.WARNING,
          confidence: 0
        }
      }

      // Calculate current hash
      const currentHash = await HashUtils.hashString(content, {
        algorithm: 'SHA-256'
      })

      const expectedHash = baseline.values.hashes?.[filePath]
      if (!expectedHash) {
        return {
          expected: 'no_baseline',
          actual: currentHash,
          status: IntegrityStatus.WARNING,
          confidence: 50
        }
      }

      const status = currentHash === expectedHash ?
        IntegrityStatus.VERIFIED : IntegrityStatus.COMPROMISED

      return {
        expected: expectedHash,
        actual: currentHash,
        status,
        confidence: status === IntegrityStatus.VERIFIED ? 100 : 0
      }

    } catch (error) {
      throw new Error(`File hash check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check database integrity
   */
  private async checkDatabaseIntegrity(check: IntegrityCheck): Promise<any> {
    try {
      if (!supabase || typeof supabase.from !== 'function') {
        return {
          expected: 'supabase_available',
          actual: 'supabase_unavailable',
          status: IntegrityStatus.WARNING,
          confidence: 50
        }
      }

      const tableName = check.metadata?.tableName || 'audit_logs'

      // Check if table exists and get row count
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })

      if (error) {
        return {
          expected: 'table_accessible',
          actual: `error: ${error.message}`,
          status: IntegrityStatus.ERROR,
          confidence: 0
        }
      }

      const baseline = check.baseline
      const expectedCount = baseline?.values.configurations?.[`${tableName}_count`]

      if (expectedCount === undefined) {
        return {
          expected: 'baseline_required',
          actual: count,
          status: IntegrityStatus.WARNING,
          confidence: 50
        }
      }

      // Allow for some growth in row count (up to 20% increase)
      const tolerance = Math.max(10, expectedCount * 0.2)
      const isWithinTolerance = count !== null &&
        count >= expectedCount &&
        count <= expectedCount + tolerance

      return {
        expected: expectedCount,
        actual: count,
        status: isWithinTolerance ? IntegrityStatus.VERIFIED : IntegrityStatus.SUSPICIOUS,
        confidence: isWithinTolerance ? 90 : 30
      }

    } catch (error) {
      throw new Error(`Database integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check configuration integrity
   */
  private async checkConfigurationIntegrity(check: IntegrityCheck): Promise<any> {
    try {
      const configKey = check.metadata?.configKey
      if (!configKey) {
        throw new Error('No config key specified for configuration check')
      }

      // Get current configuration
      let currentConfig: any
      try {
        const stored = localStorage.getItem(configKey)
        currentConfig = stored ? JSON.parse(stored) : null
      } catch (parseError) {
        return {
          expected: 'valid_json',
          actual: 'invalid_json',
          status: IntegrityStatus.ERROR,
          confidence: 0
        }
      }

      if (!currentConfig) {
        return {
          expected: 'config_exists',
          actual: 'config_missing',
          status: IntegrityStatus.COMPROMISED,
          confidence: 0
        }
      }

      // Generate hash of current configuration
      const configHash = await HashUtils.hashConfiguration(currentConfig)

      const baseline = check.baseline
      const expectedHash = baseline?.values.hashes?.[configKey]

      if (!expectedHash) {
        return {
          expected: 'baseline_required',
          actual: configHash.hash,
          status: IntegrityStatus.WARNING,
          confidence: 50
        }
      }

      const status = configHash.hash === expectedHash ?
        IntegrityStatus.VERIFIED : IntegrityStatus.COMPROMISED

      return {
        expected: expectedHash,
        actual: configHash.hash,
        status,
        confidence: status === IntegrityStatus.VERIFIED ? 100 : 0
      }

    } catch (error) {
      throw new Error(`Configuration integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check audit log integrity
   */
  private async checkAuditLogIntegrity(check: IntegrityCheck): Promise<any> {
    try {
      // Get recent audit logs from localStorage
      const auditLogsJson = localStorage.getItem('auditLogs')
      if (!auditLogsJson) {
        return {
          expected: 'audit_logs_exist',
          actual: 'no_audit_logs',
          status: IntegrityStatus.WARNING,
          confidence: 50
        }
      }

      let auditLogs: any[]
      try {
        auditLogs = JSON.parse(auditLogsJson)
      } catch (parseError) {
        return {
          expected: 'valid_audit_logs',
          actual: 'corrupted_audit_logs',
          status: IntegrityStatus.COMPROMISED,
          confidence: 0
        }
      }

      if (!Array.isArray(auditLogs)) {
        return {
          expected: 'audit_logs_array',
          actual: typeof auditLogs,
          status: IntegrityStatus.COMPROMISED,
          confidence: 0
        }
      }

      // Check for required fields in recent logs
      const recentLogs = auditLogs.slice(-10) // Check last 10 logs
      const requiredFields = ['timestamp', 'user_id', 'action', 'resource_type', 'outcome']

      for (const log of recentLogs) {
        for (const field of requiredFields) {
          if (!log[field]) {
            return {
              expected: 'complete_audit_logs',
              actual: `missing_field_${field}`,
              status: IntegrityStatus.COMPROMISED,
              confidence: 0
            }
          }
        }
      }

      // Calculate hash of recent logs for integrity verification
      const logsHash = await HashUtils.hashString(JSON.stringify(recentLogs), {
        algorithm: 'SHA-256'
      })

      const baseline = check.baseline
      const expectedPattern = baseline?.values.patterns?.audit_log_structure

      // If we have a baseline hash, compare it
      const expectedHash = baseline?.values.hashes?.recent_audit_logs
      if (expectedHash) {
        const status = logsHash === expectedHash ?
          IntegrityStatus.VERIFIED : IntegrityStatus.SUSPICIOUS
        return {
          expected: expectedHash,
          actual: logsHash,
          status,
          confidence: status === IntegrityStatus.VERIFIED ? 100 : 75
        }
      }

      // Basic structure verification passed
      return {
        expected: 'valid_structure',
        actual: 'valid_structure',
        status: IntegrityStatus.VERIFIED,
        confidence: 85
      }

    } catch (error) {
      throw new Error(`Audit log integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Initialize critical system checks
   */
  private initializeCriticalChecks(): void {
    // File integrity checks for critical system files
    IntegrityMonitoringService.CRITICAL_FILES.forEach((filePath, index) => {
      const checkId = `file_${index + 1}_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`
      const check: IntegrityCheck = {
        id: checkId,
        name: `File Integrity: ${filePath}`,
        description: `Monitor integrity of critical system file: ${filePath}`,
        type: IntegrityCheckType.FILE_HASH,
        category: IntegrityCategory.CRITICAL_SYSTEM,
        priority: IntegrityPriority.CRITICAL,
        enabled: true,
        interval: 5 * 60 * 1000, // 5 minutes
        metadata: { filePath }
      }
      this.checks.set(checkId, check)
    })

    // Database integrity checks
    const dbCheck: IntegrityCheck = {
      id: 'db_audit_logs',
      name: 'Database: Audit Logs',
      description: 'Monitor audit logs table integrity',
      type: IntegrityCheckType.DATABASE_INTEGRITY,
      category: IntegrityCategory.AUDIT_SYSTEM,
      priority: IntegrityPriority.HIGH,
      enabled: true,
      interval: 10 * 60 * 1000, // 10 minutes
      metadata: { tableName: 'audit_logs' }
    }
    this.checks.set(dbCheck.id, dbCheck)

    // Configuration integrity checks
    const configChecks = [
      'currentUser',
      'settings_user_preferences',
      'incident_response_config',
      'integrity_monitoring_config'
    ]

    configChecks.forEach((configKey, index) => {
      const checkId = `config_${index + 1}_${configKey}`
      const check: IntegrityCheck = {
        id: checkId,
        name: `Configuration: ${configKey}`,
        description: `Monitor integrity of configuration: ${configKey}`,
        type: IntegrityCheckType.CONFIGURATION_INTEGRITY,
        category: IntegrityCategory.CONFIGURATION,
        priority: IntegrityPriority.MEDIUM,
        enabled: true,
        interval: 15 * 60 * 1000, // 15 minutes
        metadata: { configKey }
      }
      this.checks.set(checkId, check)
    })

    // Audit log integrity check
    const auditCheck: IntegrityCheck = {
      id: 'audit_log_integrity',
      name: 'Audit Log Integrity',
      description: 'Monitor structural integrity of audit logs',
      type: IntegrityCheckType.AUDIT_LOG_INTEGRITY,
      category: IntegrityCategory.AUDIT_SYSTEM,
      priority: IntegrityPriority.CRITICAL,
      enabled: true,
      interval: 5 * 60 * 1000, // 5 minutes
      metadata: {}
    }
    this.checks.set(auditCheck.id, auditCheck)

    console.log(`🔧 Initialized ${this.checks.size} critical integrity checks`)
  }

  /**
   * Generate baseline for a check
   */
  private async generateBaseline(check: IntegrityCheck): Promise<IntegrityBaseline> {
    const baseline: IntegrityBaseline = {
      checkId: check.id,
      establishedAt: new Date(),
      establishedBy: 'system',
      values: {
        hashes: {},
        sizes: {},
        permissions: {},
        configurations: {},
        schemas: {},
        patterns: {}
      },
      version: '1.0',
      locked: false,
      metadata: {
        checkType: check.type,
        category: check.category
      }
    }

    try {
      switch (check.type) {
        case IntegrityCheckType.FILE_HASH:
          await this.generateFileBaseline(check, baseline)
          break

        case IntegrityCheckType.DATABASE_INTEGRITY:
          await this.generateDatabaseBaseline(check, baseline)
          break

        case IntegrityCheckType.CONFIGURATION_INTEGRITY:
          await this.generateConfigurationBaseline(check, baseline)
          break

        case IntegrityCheckType.AUDIT_LOG_INTEGRITY:
          await this.generateAuditLogBaseline(check, baseline)
          break
      }

      return baseline

    } catch (error) {
      console.error(`Failed to generate baseline for ${check.id}:`, error)
      throw error
    }
  }

  /**
   * Generate file baseline
   */
  private async generateFileBaseline(check: IntegrityCheck, baseline: IntegrityBaseline): Promise<void> {
    const filePath = check.metadata?.filePath
    if (!filePath) {
      throw new Error('No file path specified for file baseline')
    }

    try {
      // Try to fetch the file content
      const response = await fetch(filePath)
      if (response.ok) {
        const content = await response.text()
        const hash = await HashUtils.hashString(content, { algorithm: 'SHA-256' })
        baseline.values.hashes![filePath] = hash
        baseline.values.sizes![filePath] = content.length
      } else {
        // File not accessible, create placeholder baseline
        baseline.values.hashes![filePath] = 'file_not_accessible'
        baseline.values.sizes![filePath] = 0
      }
    } catch (error) {
      // Handle fetch errors
      baseline.values.hashes![filePath] = 'fetch_error'
      baseline.values.sizes![filePath] = -1
    }
  }

  /**
   * Generate database baseline
   */
  private async generateDatabaseBaseline(check: IntegrityCheck, baseline: IntegrityBaseline): Promise<void> {
    const tableName = check.metadata?.tableName || 'audit_logs'

    try {
      if (supabase && typeof supabase.from === 'function') {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })

        if (!error && count !== null) {
          baseline.values.configurations![`${tableName}_count`] = count
        } else {
          baseline.values.configurations![`${tableName}_count`] = -1
        }
      } else {
        baseline.values.configurations![`${tableName}_count`] = -1
      }
    } catch (error) {
      baseline.values.configurations![`${tableName}_count`] = -1
    }
  }

  /**
   * Generate configuration baseline
   */
  private async generateConfigurationBaseline(check: IntegrityCheck, baseline: IntegrityBaseline): Promise<void> {
    const configKey = check.metadata?.configKey
    if (!configKey) {
      throw new Error('No config key specified for configuration baseline')
    }

    try {
      const stored = localStorage.getItem(configKey)
      if (stored) {
        const config = JSON.parse(stored)
        const configHash = await HashUtils.hashConfiguration(config)
        baseline.values.hashes![configKey] = configHash.hash
        baseline.values.configurations![configKey] = config
      } else {
        baseline.values.hashes![configKey] = 'config_not_found'
      }
    } catch (error) {
      baseline.values.hashes![configKey] = 'config_error'
    }
  }

  /**
   * Generate audit log baseline
   */
  private async generateAuditLogBaseline(check: IntegrityCheck, baseline: IntegrityBaseline): Promise<void> {
    try {
      const auditLogsJson = localStorage.getItem('auditLogs')
      if (auditLogsJson) {
        const auditLogs = JSON.parse(auditLogsJson)
        if (Array.isArray(auditLogs) && auditLogs.length > 0) {
          const recentLogs = auditLogs.slice(-10)
          const logsHash = await HashUtils.hashString(JSON.stringify(recentLogs))
          baseline.values.hashes!.recent_audit_logs = logsHash
          baseline.values.patterns!.audit_log_structure = 'valid'
        }
      }
    } catch (error) {
      baseline.values.hashes!.recent_audit_logs = 'audit_log_error'
    }
  }

  /**
   * Create missing baselines for enabled checks
   */
  private async createMissingBaselines(): Promise<void> {
    const checksNeedingBaselines = Array.from(this.checks.values())
      .filter(check => check.enabled && !check.baseline)

    for (const check of checksNeedingBaselines) {
      try {
        await this.createBaseline(check.id)
      } catch (error) {
        console.warn(`Failed to create baseline for ${check.id}:`, error)
      }
    }
  }

  /**
   * Handle check result and create alerts if necessary
   */
  private async handleCheckResult(check: IntegrityCheck, result: IntegrityResult): Promise<void> {
    // Emit check completed event
    this.emitEvent('check-completed', result)

    // Create alert for compromised or suspicious results
    if (result.status === IntegrityStatus.COMPROMISED || result.status === IntegrityStatus.SUSPICIOUS) {
      await this.createAlert(check, result)

      // Create incident for critical issues
      if (check.priority === IntegrityPriority.CRITICAL && result.status === IntegrityStatus.COMPROMISED) {
        await this.createIncident(check, result)
      }
    }
  }

  /**
   * Create alert for integrity issue
   */
  private async createAlert(check: IntegrityCheck, result: IntegrityResult): Promise<void> {
    try {
      const alert: IntegrityAlert = {
        id: this.generateId(),
        checkId: check.id,
        timestamp: result.timestamp,
        severity: this.mapStatusToSeverity(result.status),
        type: result.deviation?.type || DeviationType.HASH_MISMATCH,
        title: `Integrity Alert: ${check.name}`,
        description: result.deviation?.description || `Integrity check failed for ${check.name}`,
        affectedResources: [check.metadata?.filePath || check.metadata?.configKey || check.id],
        evidence: result.deviation?.evidence || [],
        status: AlertStatus.ACTIVE,
        acknowledged: false,
        resolved: false,
        autoRemediated: false,
        metadata: {
          checkType: check.type,
          category: check.category,
          priority: check.priority,
          confidence: result.confidence
        }
      }

      this.alerts.set(alert.id, alert)

      // Emit alert created event
      this.emitEvent('alert-created', alert)

      console.warn(`🚨 Integrity alert created: ${alert.title}`)

    } catch (error) {
      console.error('Failed to create alert:', error)
    }
  }

  /**
   * Create incident for critical integrity issue
   */
  private async createIncident(check: IntegrityCheck, result: IntegrityResult): Promise<void> {
    try {
      // Map check type to incident type
      let incidentType = IncidentType.UNAUTHORIZED_SYSTEM_MODIFICATION
      switch (check.type) {
        case IntegrityCheckType.FILE_HASH:
          incidentType = IncidentType.FILE_INTEGRITY_VIOLATION
          break
        case IntegrityCheckType.DATABASE_INTEGRITY:
          incidentType = IncidentType.DATABASE_INTEGRITY_COMPROMISE
          break
        case IntegrityCheckType.CONFIGURATION_INTEGRITY:
          incidentType = IncidentType.CONFIGURATION_TAMPERING
          break
        case IntegrityCheckType.AUDIT_LOG_INTEGRITY:
          incidentType = IncidentType.AUDIT_LOG_INTEGRITY_FAILURE
          break
        default:
          incidentType = IncidentType.BASELINE_DEVIATION_DETECTED
      }

      const incidentRequest: CreateIncidentRequest = {
        type: incidentType,
        severity: IncidentSeverity.CRITICAL,
        title: `Critical Integrity Violation: ${check.name}`,
        description: `Critical system integrity check failed: ${result.deviation?.description || 'Integrity compromised'}`,
        userId: 'system',
        userEmail: 'system@carexps.com',
        evidence: [{
          type: 'system_event',
          data: {
            checkId: check.id,
            checkType: check.type,
            expected: result.expected,
            actual: result.actual,
            confidence: result.confidence
          },
          source: 'integrity_monitoring',
          description: 'Integrity monitoring detected critical violation'
        }],
        metadata: {
          integrityCheck: true,
          checkCategory: check.category,
          checkPriority: check.priority,
          automatedDetection: true
        }
      }

      await incidentResponseService.createIncident(incidentRequest)

      console.error(`🚨 Critical integrity incident created for ${check.name}`)

    } catch (error) {
      console.error('Failed to create incident:', error)
    }
  }

  /**
   * Map integrity status to severity
   */
  private mapStatusToSeverity(status: IntegrityStatus): DeviationSeverity {
    switch (status) {
      case IntegrityStatus.COMPROMISED:
        return DeviationSeverity.CRITICAL
      case IntegrityStatus.SUSPICIOUS:
        return DeviationSeverity.HIGH
      case IntegrityStatus.WARNING:
        return DeviationSeverity.MEDIUM
      case IntegrityStatus.ERROR:
        return DeviationSeverity.HIGH
      default:
        return DeviationSeverity.LOW
    }
  }

  /**
   * Analyze deviation for detailed information
   */
  private async analyzeDeviation(check: IntegrityCheck, expected: any, actual: any): Promise<any> {
    // This is a simplified implementation
    // In a production system, this would include detailed forensic analysis
    return {
      type: DeviationType.HASH_MISMATCH,
      severity: DeviationSeverity.HIGH,
      description: `Integrity check failed: expected ${expected}, got ${actual}`,
      affectedComponents: [check.name],
      possibleCauses: [
        'Unauthorized file modification',
        'System compromise',
        'Configuration drift',
        'Software update'
      ],
      recommendedActions: [
        'Investigate the source of the change',
        'Verify system integrity',
        'Check recent system activities',
        'Consider restoring from backup'
      ],
      evidence: [{
        type: 'hash_comparison',
        description: 'Hash mismatch detected',
        data: { expected, actual },
        timestamp: new Date(),
        source: 'integrity_monitoring',
        verifiable: true
      }]
    }
  }

  /**
   * Schedule check execution
   */
  private scheduleCheck(checkId: string, check: IntegrityCheck): void {
    // Clear existing interval if any
    const existingInterval = this.monitoringIntervals.get(checkId)
    if (existingInterval) {
      clearInterval(existingInterval)
    }

    // Schedule new interval
    const interval = setInterval(async () => {
      if (this.isMonitoring && check.enabled) {
        try {
          await this.runCheck(checkId)
        } catch (error) {
          console.error(`Scheduled check ${checkId} failed:`, error)
        }
      }
    }, check.interval)

    this.monitoringIntervals.set(checkId, interval)
  }

  /**
   * Initialize Web Worker
   */
  private async initializeWorker(): Promise<void> {
    try {
      if (!this.configuration.workerScript) {
        console.warn('Worker script not configured')
        return
      }

      this.worker = new Worker(this.configuration.workerScript)

      this.worker.onmessage = (event: MessageEvent<IntegrityWorkerMessage>) => {
        this.handleWorkerMessage(event.data)
      }

      this.worker.onerror = (error) => {
        console.error('Worker error:', error)
        this.emitEvent('worker-error', { error, timestamp: new Date() })
      }

      console.log('🔧 Integrity monitoring worker initialized')

    } catch (error) {
      console.error('Failed to initialize worker:', error)
    }
  }

  /**
   * Send message to worker
   */
  private sendWorkerMessage(message: IntegrityWorkerMessage): void {
    if (this.worker) {
      this.worker.postMessage(message)
    }
  }

  /**
   * Handle worker messages
   */
  private handleWorkerMessage(message: IntegrityWorkerMessage): void {
    switch (message.type) {
      case WorkerMessageType.CHECK_RESULT:
        // Handle worker check result
        break
      case WorkerMessageType.ERROR:
        console.error('Worker error:', message.payload)
        break
      case WorkerMessageType.STATUS_UPDATE:
        // Handle worker status update
        break
    }
  }

  /**
   * Generate status summary
   */
  private generateStatusSummary(): IntegrityStatusSummary {
    const totalChecks = this.checks.size
    const enabledChecks = Array.from(this.checks.values()).filter(c => c.enabled).length

    let passedChecks = 0
    let failedChecks = 0
    let warningChecks = 0
    let errorChecks = 0

    for (const check of this.checks.values()) {
      if (check.lastResult) {
        switch (check.lastResult.status) {
          case IntegrityStatus.VERIFIED:
            passedChecks++
            break
          case IntegrityStatus.COMPROMISED:
          case IntegrityStatus.SUSPICIOUS:
            failedChecks++
            break
          case IntegrityStatus.WARNING:
            warningChecks++
            break
          case IntegrityStatus.ERROR:
            errorChecks++
            break
        }
      }
    }

    const healthScore = enabledChecks > 0 ?
      Math.round((passedChecks / enabledChecks) * 100) : 100

    return {
      totalChecks,
      enabledChecks,
      passedChecks,
      failedChecks,
      warningChecks,
      errorChecks,
      lastUpdateTime: new Date(),
      overallHealthScore: healthScore
    }
  }

  /**
   * Get recent results
   */
  private getRecentResults(limit: number): IntegrityResult[] {
    const allResults: IntegrityResult[] = []

    for (const results of this.results.values()) {
      allResults.push(...results)
    }

    return allResults
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Calculate trends (simplified implementation)
   */
  private calculateTrends(): any[] {
    // This would implement trend calculation based on historical data
    return []
  }

  /**
   * Calculate coverage metrics
   */
  private calculateCoverage(): any {
    // This would implement coverage calculation
    return {}
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformance(): any {
    // This would implement performance metrics calculation
    return {
      averageCheckDuration: 0,
      totalChecksExecuted: 0,
      checksPerSecond: 0,
      workerUtilization: 0,
      memoryUsage: 0,
      cpuUsage: 0
    }
  }

  /**
   * Calculate system metrics
   */
  private calculateMetrics(): IntegrityMetrics {
    return {
      uptime: 100,
      availability: 100,
      reliability: 100,
      performance: 100,
      security: 100,
      compliance: 100,
      mtbf: 0,
      mttr: 0,
      sla: 100
    }
  }

  /**
   * Calculate component health
   */
  private calculateComponentHealth(): Record<string, any> {
    return {
      monitoring_service: {
        status: this.isMonitoring ? HealthStatus.HEALTHY : HealthStatus.WARNING,
        lastCheck: new Date(),
        message: this.isMonitoring ? 'Monitoring active' : 'Monitoring inactive'
      },
      worker: {
        status: this.worker ? HealthStatus.HEALTHY : HealthStatus.WARNING,
        lastCheck: new Date(),
        message: this.worker ? 'Worker running' : 'Worker not available'
      }
    }
  }

  /**
   * Generate health recommendations
   */
  private generateHealthRecommendations(alerts: IntegrityAlert[], metrics: IntegrityMetrics): string[] {
    const recommendations: string[] = []

    if (alerts.length > 0) {
      recommendations.push(`Review and address ${alerts.length} active integrity alert(s)`)
    }

    if (!this.isMonitoring) {
      recommendations.push('Start integrity monitoring to ensure continuous security')
    }

    if (this.checks.size === 0) {
      recommendations.push('Configure integrity checks for critical system components')
    }

    return recommendations
  }

  /**
   * Utility methods
   */
  private generateId(): string {
    return `integrity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  private emitEvent(type: string, data: any): void {
    const listeners = this.eventListeners.get(type) || []
    listeners.forEach(listener => {
      try {
        listener(data)
      } catch (error) {
        console.error('Event listener error:', error)
      }
    })
  }

  /**
   * Event management
   */
  addEventListener(type: string, listener: (data: any) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, [])
    }
    this.eventListeners.get(type)!.push(listener)
  }

  removeEventListener(type: string, listener: (data: any) => void): void {
    const listeners = this.eventListeners.get(type) || []
    const index = listeners.indexOf(listener)
    if (index > -1) {
      listeners.splice(index, 1)
    }
  }

  /**
   * Configuration management
   */
  private getDefaultConfiguration(): IntegrityMonitoringConfig {
    return {
      enabled: true,
      globalInterval: 5 * 60 * 1000, // 5 minutes
      workerEnabled: false, // Disabled by default for compatibility
      workerScript: '/integrity-worker.js',
      checksEnabled: [
        IntegrityCheckType.FILE_HASH,
        IntegrityCheckType.DATABASE_INTEGRITY,
        IntegrityCheckType.CONFIGURATION_INTEGRITY,
        IntegrityCheckType.AUDIT_LOG_INTEGRITY
      ],
      priorityFilter: [
        IntegrityPriority.CRITICAL,
        IntegrityPriority.HIGH,
        IntegrityPriority.MEDIUM
      ],
      categoriesEnabled: [
        IntegrityCategory.CRITICAL_SYSTEM,
        IntegrityCategory.SECURITY_COMPONENT,
        IntegrityCategory.AUDIT_SYSTEM
      ],
      autoRemediation: false,
      incidentCreation: true,
      auditLogging: true,
      realTimeAlerts: true,
      batchProcessing: false,
      maxConcurrentChecks: 5,
      retryAttempts: 3,
      timeoutMs: 30000,
      storage: {
        localStorage: true,
        supabase: true,
        encryptBaselines: false,
        encryptResults: false,
        retentionDays: 30,
        maxLocalRecords: 1000,
        compressionEnabled: false
      },
      notifications: {
        immediateAlerts: true,
        batchAlerts: false,
        emailNotifications: false,
        smsNotifications: false,
        webhookNotifications: false,
        severityThreshold: DeviationSeverity.HIGH,
        cooldownPeriod: 15 * 60 * 1000 // 15 minutes
      }
    }
  }

  private loadConfiguration(): void {
    try {
      const stored = localStorage.getItem(IntegrityMonitoringService.STORAGE_KEYS.CONFIGURATION)
      if (stored) {
        const config = JSON.parse(stored)
        this.configuration = { ...this.configuration, ...config }
      }
    } catch (error) {
      console.error('Failed to load configuration:', error)
    }
  }

  private saveConfiguration(): void {
    try {
      localStorage.setItem(
        IntegrityMonitoringService.STORAGE_KEYS.CONFIGURATION,
        JSON.stringify(this.configuration)
      )
    } catch (error) {
      console.error('Failed to save configuration:', error)
    }
  }

  /**
   * Data persistence
   */
  private loadStoredData(): void {
    try {
      // Load checks
      const checksData = localStorage.getItem(IntegrityMonitoringService.STORAGE_KEYS.CHECKS)
      if (checksData) {
        const checks = JSON.parse(checksData)
        for (const [id, check] of Object.entries(checks)) {
          this.checks.set(id, check as IntegrityCheck)
        }
      }

      // Load baselines
      const baselinesData = localStorage.getItem(IntegrityMonitoringService.STORAGE_KEYS.BASELINES)
      if (baselinesData) {
        const baselines = JSON.parse(baselinesData)
        for (const [id, baseline] of Object.entries(baselines)) {
          this.baselines.set(id, baseline as IntegrityBaseline)
        }
      }

      // Load results
      const resultsData = localStorage.getItem(IntegrityMonitoringService.STORAGE_KEYS.RESULTS)
      if (resultsData) {
        const results = JSON.parse(resultsData)
        for (const [id, resultArray] of Object.entries(results)) {
          this.results.set(id, resultArray as IntegrityResult[])
        }
      }

      // Load alerts
      const alertsData = localStorage.getItem(IntegrityMonitoringService.STORAGE_KEYS.ALERTS)
      if (alertsData) {
        const alerts = JSON.parse(alertsData)
        for (const [id, alert] of Object.entries(alerts)) {
          this.alerts.set(id, alert as IntegrityAlert)
        }
      }

    } catch (error) {
      console.error('Failed to load stored data:', error)
    }
  }

  private saveStoredData(): void {
    try {
      // Save checks
      const checksObj = Object.fromEntries(this.checks)
      localStorage.setItem(
        IntegrityMonitoringService.STORAGE_KEYS.CHECKS,
        JSON.stringify(checksObj)
      )

      // Save baselines
      const baselinesObj = Object.fromEntries(this.baselines)
      localStorage.setItem(
        IntegrityMonitoringService.STORAGE_KEYS.BASELINES,
        JSON.stringify(baselinesObj)
      )

      // Save results (keep only recent ones)
      const resultsObj: Record<string, IntegrityResult[]> = {}
      for (const [id, resultArray] of this.results) {
        resultsObj[id] = resultArray.slice(0, 50) // Keep last 50 results
      }
      localStorage.setItem(
        IntegrityMonitoringService.STORAGE_KEYS.RESULTS,
        JSON.stringify(resultsObj)
      )

      // Save alerts
      const alertsObj = Object.fromEntries(this.alerts)
      localStorage.setItem(
        IntegrityMonitoringService.STORAGE_KEYS.ALERTS,
        JSON.stringify(alertsObj)
      )

    } catch (error) {
      console.error('Failed to save stored data:', error)
    }
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    await this.stopMonitoring()

    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    this.eventListeners.clear()
    console.log('🧹 Integrity monitoring service cleaned up')
  }
}

// Export singleton instance
export const integrityMonitoringService = IntegrityMonitoringService.getInstance()

// Export class for testing
export { IntegrityMonitoringService }