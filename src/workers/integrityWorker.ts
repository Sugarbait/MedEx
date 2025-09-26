/**
 * INTEGRITY MONITORING WEB WORKER
 *
 * Background Web Worker for continuous integrity monitoring that runs
 * independently from the main thread to avoid UI blocking and provide
 * real-time security monitoring capabilities.
 *
 * Features:
 * - Background integrity checking without UI impact
 * - Scheduled monitoring with configurable intervals
 * - Batch processing for multiple checks
 * - Real-time anomaly detection
 * - Performance optimized execution
 * - Communication with main thread via messages
 * - Isolated execution environment for security
 */

import {
  IntegrityCheck,
  IntegrityCheckType,
  IntegrityResult,
  IntegrityStatus,
  IntegrityWorkerMessage,
  IntegrityWorkerConfig,
  WorkerMessageType,
  IntegrityMonitoringConfig,
  DeviationType,
  DeviationSeverity
} from '../types/integrityTypes'

interface WorkerState {
  isMonitoring: boolean
  checks: Map<string, IntegrityCheck>
  config: IntegrityMonitoringConfig | null
  intervals: Map<string, NodeJS.Timeout>
  lastBatchTime: number
  performance: {
    checksExecuted: number
    totalDuration: number
    averageDuration: number
    errorCount: number
  }
}

class IntegrityWorker {
  private state: WorkerState = {
    isMonitoring: false,
    checks: new Map(),
    config: null,
    intervals: new Map(),
    lastBatchTime: 0,
    performance: {
      checksExecuted: 0,
      totalDuration: 0,
      averageDuration: 0,
      errorCount: 0
    }
  }

  constructor() {
    this.setupMessageHandler()
    this.setupPerformanceMonitoring()
    console.log('🔧 Integrity Worker initialized')
  }

  /**
   * Set up message handler for communication with main thread
   */
  private setupMessageHandler(): void {
    self.addEventListener('message', (event: MessageEvent<IntegrityWorkerMessage>) => {
      this.handleMessage(event.data)
    })
  }

  /**
   * Handle messages from main thread
   */
  private async handleMessage(message: IntegrityWorkerMessage): Promise<void> {
    try {
      switch (message.type) {
        case WorkerMessageType.START_MONITORING:
          await this.startMonitoring(message.payload)
          break

        case WorkerMessageType.STOP_MONITORING:
          await this.stopMonitoring()
          break

        case WorkerMessageType.RUN_CHECK:
          await this.runCheck(message.payload.checkId)
          break

        default:
          this.sendError(`Unknown message type: ${message.type}`)
      }
    } catch (error) {
      this.sendError(`Message handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Start monitoring with provided configuration
   */
  private async startMonitoring(payload: { checks: IntegrityCheck[]; config: IntegrityMonitoringConfig }): Promise<void> {
    try {
      if (this.state.isMonitoring) {
        this.sendStatusUpdate('Monitoring already active')
        return
      }

      // Load checks and configuration
      this.state.config = payload.config
      this.state.checks.clear()

      for (const check of payload.checks) {
        if (check.enabled) {
          this.state.checks.set(check.id, check)
        }
      }

      // Start individual check schedules
      this.scheduleChecks()

      // Start batch processing if enabled
      if (this.state.config.batchProcessing) {
        this.scheduleBatchProcessing()
      }

      this.state.isMonitoring = true
      this.sendStatusUpdate(`Monitoring started with ${this.state.checks.size} checks`)

    } catch (error) {
      this.sendError(`Failed to start monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Stop monitoring
   */
  private async stopMonitoring(): Promise<void> {
    try {
      this.state.isMonitoring = false

      // Clear all intervals
      for (const interval of this.state.intervals.values()) {
        clearInterval(interval)
      }
      this.state.intervals.clear()

      this.sendStatusUpdate('Monitoring stopped')

    } catch (error) {
      this.sendError(`Failed to stop monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Run a specific check
   */
  private async runCheck(checkId: string): Promise<void> {
    try {
      const check = this.state.checks.get(checkId)
      if (!check) {
        this.sendError(`Check ${checkId} not found`)
        return
      }

      const startTime = performance.now()
      const result = await this.executeCheck(check)
      const duration = performance.now() - startTime

      // Update performance metrics
      this.updatePerformanceMetrics(duration, result.status === IntegrityStatus.ERROR)

      // Send result to main thread
      this.sendMessage({
        type: WorkerMessageType.CHECK_RESULT,
        id: `result_${Date.now()}`,
        timestamp: new Date(),
        payload: {
          checkId,
          result,
          duration
        }
      })

    } catch (error) {
      this.state.performance.errorCount++
      this.sendError(`Check ${checkId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Execute a specific integrity check
   */
  private async executeCheck(check: IntegrityCheck): Promise<IntegrityResult> {
    const timestamp = new Date()

    try {
      let result: IntegrityResult

      switch (check.type) {
        case IntegrityCheckType.FILE_HASH:
          result = await this.checkFileHash(check)
          break

        case IntegrityCheckType.DATABASE_INTEGRITY:
          result = await this.checkDatabaseIntegrity(check)
          break

        case IntegrityCheckType.CONFIGURATION_INTEGRITY:
          result = await this.checkConfigurationIntegrity(check)
          break

        case IntegrityCheckType.AUDIT_LOG_INTEGRITY:
          result = await this.checkAuditLogIntegrity(check)
          break

        case IntegrityCheckType.RUNTIME_INTEGRITY:
          result = await this.checkRuntimeIntegrity(check)
          break

        case IntegrityCheckType.MEMORY_INTEGRITY:
          result = await this.checkMemoryIntegrity(check)
          break

        default:
          throw new Error(`Unsupported check type: ${check.type}`)
      }

      // Ensure timestamp is set
      result.timestamp = timestamp
      result.checkId = check.id

      return result

    } catch (error) {
      return {
        checkId: check.id,
        timestamp,
        status: IntegrityStatus.ERROR,
        expected: 'check_execution',
        actual: error instanceof Error ? error.message : 'Unknown error',
        confidence: 0,
        metadata: {
          checkType: check.type,
          error: true,
          workerExecution: true
        }
      }
    }
  }

  /**
   * Check file hash integrity
   */
  private async checkFileHash(check: IntegrityCheck): Promise<IntegrityResult> {
    const filePath = check.metadata?.filePath
    if (!filePath) {
      throw new Error('No file path specified for file hash check')
    }

    const baseline = check.baseline
    if (!baseline || !baseline.values.hashes) {
      return {
        checkId: check.id,
        timestamp: new Date(),
        status: IntegrityStatus.WARNING,
        expected: 'baseline_required',
        actual: 'no_baseline',
        confidence: 0
      }
    }

    try {
      // In a Web Worker, we have limited access to files
      // This would need to be adapted based on your deployment strategy
      // For now, we'll simulate or use alternative approaches

      // Try to fetch the file if it's accessible via HTTP
      const response = await fetch(filePath)
      if (!response.ok) {
        return {
          checkId: check.id,
          timestamp: new Date(),
          status: IntegrityStatus.WARNING,
          expected: baseline.values.hashes[filePath] || 'unknown',
          actual: `fetch_failed_${response.status}`,
          confidence: 0
        }
      }

      const content = await response.text()
      const currentHash = await this.calculateHash(content)
      const expectedHash = baseline.values.hashes[filePath]

      const status = currentHash === expectedHash ?
        IntegrityStatus.VERIFIED : IntegrityStatus.COMPROMISED

      return {
        checkId: check.id,
        timestamp: new Date(),
        status,
        expected: expectedHash,
        actual: currentHash,
        confidence: status === IntegrityStatus.VERIFIED ? 100 : 0,
        deviation: status !== IntegrityStatus.VERIFIED ? {
          type: DeviationType.HASH_MISMATCH,
          severity: DeviationSeverity.CRITICAL,
          description: `File hash mismatch for ${filePath}`,
          affectedComponents: [filePath],
          possibleCauses: [
            'Unauthorized file modification',
            'System compromise',
            'Software update without baseline update'
          ],
          recommendedActions: [
            'Investigate file changes',
            'Verify system integrity',
            'Update baseline if changes are legitimate'
          ]
        } : undefined
      }

    } catch (error) {
      throw new Error(`File hash check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check database integrity (limited in worker environment)
   */
  private async checkDatabaseIntegrity(check: IntegrityCheck): Promise<IntegrityResult> {
    // Database checks are limited in Web Worker environment
    // This would typically be handled by the main thread
    return {
      checkId: check.id,
      timestamp: new Date(),
      status: IntegrityStatus.WARNING,
      expected: 'main_thread_check',
      actual: 'worker_limitation',
      confidence: 50,
      metadata: {
        note: 'Database checks should be performed on main thread'
      }
    }
  }

  /**
   * Check configuration integrity
   */
  private async checkConfigurationIntegrity(check: IntegrityCheck): Promise<IntegrityResult> {
    // Configuration checks are limited in Web Worker environment
    // Workers don't have direct access to localStorage
    return {
      checkId: check.id,
      timestamp: new Date(),
      status: IntegrityStatus.WARNING,
      expected: 'main_thread_check',
      actual: 'worker_limitation',
      confidence: 50,
      metadata: {
        note: 'Configuration checks should be performed on main thread'
      }
    }
  }

  /**
   * Check audit log integrity
   */
  private async checkAuditLogIntegrity(check: IntegrityCheck): Promise<IntegrityResult> {
    // Audit log checks are limited in Web Worker environment
    return {
      checkId: check.id,
      timestamp: new Date(),
      status: IntegrityStatus.WARNING,
      expected: 'main_thread_check',
      actual: 'worker_limitation',
      confidence: 50,
      metadata: {
        note: 'Audit log checks should be performed on main thread'
      }
    }
  }

  /**
   * Check runtime integrity
   */
  private async checkRuntimeIntegrity(check: IntegrityCheck): Promise<IntegrityResult> {
    try {
      // Check for basic runtime anomalies that can be detected in worker
      const checks: Record<string, boolean> = {}

      // Check if global objects are as expected
      checks.globalObjectsIntact = typeof self !== 'undefined' &&
        typeof postMessage !== 'undefined' &&
        typeof addEventListener !== 'undefined'

      // Check if critical APIs are available
      checks.cryptoApiAvailable = typeof crypto !== 'undefined' &&
        typeof crypto.subtle !== 'undefined'

      checks.performanceApiAvailable = typeof performance !== 'undefined' &&
        typeof performance.now === 'function'

      // Check worker execution environment
      checks.workerEnvironment = typeof WorkerGlobalScope !== 'undefined' &&
        self instanceof WorkerGlobalScope

      // Calculate overall integrity
      const passedChecks = Object.values(checks).filter(Boolean).length
      const totalChecks = Object.keys(checks).length
      const integrityScore = (passedChecks / totalChecks) * 100

      const status = integrityScore === 100 ?
        IntegrityStatus.VERIFIED :
        integrityScore >= 80 ?
          IntegrityStatus.WARNING :
          IntegrityStatus.COMPROMISED

      return {
        checkId: check.id,
        timestamp: new Date(),
        status,
        expected: totalChecks,
        actual: passedChecks,
        confidence: integrityScore,
        metadata: {
          runtimeChecks: checks,
          integrityScore,
          workerEnvironment: true
        }
      }

    } catch (error) {
      throw new Error(`Runtime integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check memory integrity
   */
  private async checkMemoryIntegrity(check: IntegrityCheck): Promise<IntegrityResult> {
    try {
      // Basic memory integrity checks that can be performed in worker
      const memoryInfo: Record<string, any> = {}

      // Check if memory measurement is available
      if ('memory' in performance) {
        const memory = (performance as any).memory
        memoryInfo.usedJSHeapSize = memory.usedJSHeapSize
        memoryInfo.totalJSHeapSize = memory.totalJSHeapSize
        memoryInfo.jsHeapSizeLimit = memory.jsHeapSizeLimit
        memoryInfo.memoryPressure = memory.usedJSHeapSize / memory.jsHeapSizeLimit
      }

      // Check for memory leaks by monitoring object creation
      const objectCount = this.estimateObjectCount()
      memoryInfo.estimatedObjectCount = objectCount

      // Basic memory integrity assessment
      let status = IntegrityStatus.VERIFIED
      let confidence = 90

      if (memoryInfo.memoryPressure && memoryInfo.memoryPressure > 0.9) {
        status = IntegrityStatus.WARNING
        confidence = 60
      }

      if (memoryInfo.memoryPressure && memoryInfo.memoryPressure > 0.95) {
        status = IntegrityStatus.SUSPICIOUS
        confidence = 30
      }

      return {
        checkId: check.id,
        timestamp: new Date(),
        status,
        expected: 'normal_memory_usage',
        actual: memoryInfo,
        confidence,
        metadata: {
          memoryInfo,
          workerEnvironment: true
        }
      }

    } catch (error) {
      throw new Error(`Memory integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Calculate hash using Web Crypto API
   */
  private async calculateHash(content: string): Promise<string> {
    try {
      const encoder = new TextEncoder()
      const data = encoder.encode(content)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)

      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    } catch (error) {
      throw new Error(`Hash calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Schedule individual checks
   */
  private scheduleChecks(): void {
    if (!this.state.config) return

    for (const [checkId, check] of this.state.checks) {
      // Skip checks that are better suited for main thread
      if (this.shouldRunOnMainThread(check)) {
        continue
      }

      const interval = setInterval(async () => {
        if (this.state.isMonitoring && check.enabled) {
          await this.runCheck(checkId)
        }
      }, check.interval)

      this.state.intervals.set(checkId, interval)
    }
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatchProcessing(): void {
    if (!this.state.config) return

    const batchInterval = setInterval(async () => {
      if (this.state.isMonitoring) {
        await this.runBatchChecks()
      }
    }, this.state.config.globalInterval)

    this.state.intervals.set('batch_processing', batchInterval)
  }

  /**
   * Run batch checks
   */
  private async runBatchChecks(): Promise<void> {
    const startTime = performance.now()
    const results: IntegrityResult[] = []
    const errors: Array<{ checkId: string; error: string }> = []

    // Get checks suitable for worker execution
    const workerChecks = Array.from(this.state.checks.values())
      .filter(check => check.enabled && !this.shouldRunOnMainThread(check))

    // Process checks in batches to prevent overwhelming
    const maxConcurrent = this.state.config?.maxConcurrentChecks || 3
    const batches = this.chunkArray(workerChecks, maxConcurrent)

    for (const batch of batches) {
      const batchPromises = batch.map(async (check) => {
        try {
          const result = await this.executeCheck(check)
          results.push(result)
        } catch (error) {
          errors.push({
            checkId: check.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      })

      await Promise.all(batchPromises)

      // Small delay between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await this.sleep(100)
      }
    }

    const duration = performance.now() - startTime
    this.state.lastBatchTime = duration

    // Send batch results
    this.sendMessage({
      type: WorkerMessageType.BATCH_RESULTS,
      id: `batch_${Date.now()}`,
      timestamp: new Date(),
      payload: {
        results,
        errors,
        duration,
        checksExecuted: results.length
      }
    })
  }

  /**
   * Determine if check should run on main thread
   */
  private shouldRunOnMainThread(check: IntegrityCheck): boolean {
    // These check types require main thread access
    const mainThreadTypes = [
      IntegrityCheckType.DATABASE_INTEGRITY,
      IntegrityCheckType.CONFIGURATION_INTEGRITY,
      IntegrityCheckType.AUDIT_LOG_INTEGRITY
    ]

    return mainThreadTypes.includes(check.type)
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(duration: number, hasError: boolean): void {
    this.state.performance.checksExecuted++
    this.state.performance.totalDuration += duration
    this.state.performance.averageDuration =
      this.state.performance.totalDuration / this.state.performance.checksExecuted

    if (hasError) {
      this.state.performance.errorCount++
    }
  }

  /**
   * Set up performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // Send performance updates every 30 seconds
    setInterval(() => {
      if (this.state.isMonitoring) {
        this.sendStatusUpdate('Performance update', {
          performance: this.state.performance,
          checksActive: this.state.checks.size,
          intervalsActive: this.state.intervals.size
        })
      }
    }, 30000)
  }

  /**
   * Estimate object count for memory leak detection
   */
  private estimateObjectCount(): number {
    // This is a rough estimation method
    // In practice, you might use more sophisticated techniques
    let count = 0

    try {
      // Count objects in worker scope
      for (const key in self) {
        if (typeof (self as any)[key] === 'object' && (self as any)[key] !== null) {
          count++
        }
      }

      // Add internal state objects
      count += this.state.checks.size
      count += this.state.intervals.size

    } catch (error) {
      // Ignore errors in object counting
    }

    return count
  }

  /**
   * Utility methods
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Communication methods
   */
  private sendMessage(message: IntegrityWorkerMessage): void {
    try {
      self.postMessage(message)
    } catch (error) {
      console.error('Failed to send worker message:', error)
    }
  }

  private sendError(error: string): void {
    this.sendMessage({
      type: WorkerMessageType.ERROR,
      id: `error_${Date.now()}`,
      timestamp: new Date(),
      payload: { error }
    })
  }

  private sendStatusUpdate(status: string, data?: any): void {
    this.sendMessage({
      type: WorkerMessageType.STATUS_UPDATE,
      id: `status_${Date.now()}`,
      timestamp: new Date(),
      payload: {
        status,
        isMonitoring: this.state.isMonitoring,
        checksCount: this.state.checks.size,
        performance: this.state.performance,
        ...data
      }
    })
  }
}

// Initialize worker
const worker = new IntegrityWorker()

// Export for TypeScript compatibility
export default worker