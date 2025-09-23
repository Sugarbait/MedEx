/**
 * HIPAA-Compliant Conflict Resolution Service
 *
 * Handles data conflicts that arise during cross-device synchronization
 * with intelligent resolution strategies and audit compliance.
 *
 * Features:
 * - Multiple conflict resolution strategies
 * - Field-level conflict detection and resolution
 * - Manual resolution queue for complex conflicts
 * - Audit logging for all conflict resolutions
 * - PHI-safe conflict handling
 */

import { supabase } from '@/config/supabase'
import { secureLogger } from '@/services/secureLogger'
import { secureStorage } from '@/services/secureStorage'
import { auditLogger } from '@/services/auditLogger'
import { encryptionService } from '@/services/encryption'

const logger = secureLogger.component('ConflictResolutionService')

export interface DataConflict {
  id: string
  tableName: string
  recordId: string
  fieldName: string
  conflictType: 'concurrent_update' | 'delete_update' | 'create_create' | 'field_type_mismatch'
  localValue: any
  remoteValue: any
  localTimestamp: string
  remoteTimestamp: string
  localDeviceId: string
  remoteDeviceId: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  autoResolvable: boolean
  resolutionStrategy?: string
  metadata?: Record<string, any>
}

export interface ConflictResolution {
  conflictId: string
  strategy: ConflictResolutionStrategy
  resolvedValue: any
  resolvedBy: 'system' | 'user'
  resolvedAt: string
  reasoning?: string
}

export interface ConflictResolutionStrategy {
  name: string
  description: string
  applicableTypes: string[]
  priority: number
  autoResolve: boolean
  requiresUserInput: boolean
}

export interface ConflictResolutionResult {
  success: boolean
  resolvedValue?: any
  requiresManualResolution?: boolean
  error?: string
  metadata?: Record<string, any>
}

export interface ConflictStats {
  totalConflicts: number
  autoResolved: number
  manualResolution: number
  pending: number
  byType: Record<string, number>
  byTable: Record<string, number>
}

class ConflictResolutionService {
  private resolutionStrategies: Map<string, ConflictResolutionStrategy> = new Map()
  private pendingConflicts: Map<string, DataConflict> = new Map()
  private conflictHistory: Map<string, ConflictResolution[]> = new Map()
  private userId: string | null = null

  constructor() {
    this.initializeDefaultStrategies()
  }

  /**
   * Initialize the conflict resolution service
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      logger.debug('Initializing conflict resolution service', userId)

      this.userId = userId

      // Load pending conflicts from storage
      await this.loadPendingConflicts()

      // Load conflict resolution history
      await this.loadConflictHistory()

      logger.info('Conflict resolution service initialized successfully', userId)
      return true

    } catch (error) {
      logger.error('Failed to initialize conflict resolution service', userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  /**
   * Detect conflicts between local and remote data
   */
  async detectConflict(
    tableName: string,
    recordId: string,
    localData: any,
    remoteData: any,
    localTimestamp: string,
    remoteTimestamp: string,
    localDeviceId: string,
    remoteDeviceId: string
  ): Promise<DataConflict[]> {
    try {
      logger.debug('Detecting conflicts', this.userId, undefined, {
        tableName,
        recordId,
        localDevice: localDeviceId,
        remoteDevice: remoteDeviceId
      })

      const conflicts: DataConflict[] = []

      // Handle deletion conflicts
      if (!localData && remoteData) {
        conflicts.push(this.createConflict(
          tableName,
          recordId,
          '__record__',
          'delete_update',
          null,
          remoteData,
          localTimestamp,
          remoteTimestamp,
          localDeviceId,
          remoteDeviceId,
          'high'
        ))
      } else if (localData && !remoteData) {
        conflicts.push(this.createConflict(
          tableName,
          recordId,
          '__record__',
          'delete_update',
          localData,
          null,
          localTimestamp,
          remoteTimestamp,
          localDeviceId,
          remoteDeviceId,
          'high'
        ))
      } else if (localData && remoteData) {
        // Field-level conflict detection
        const fieldConflicts = this.detectFieldConflicts(
          tableName,
          recordId,
          localData,
          remoteData,
          localTimestamp,
          remoteTimestamp,
          localDeviceId,
          remoteDeviceId
        )
        conflicts.push(...fieldConflicts)
      }

      if (conflicts.length > 0) {
        logger.info('Conflicts detected', this.userId, undefined, {
          tableName,
          recordId,
          conflictCount: conflicts.length
        })

        // Store conflicts for resolution
        for (const conflict of conflicts) {
          this.pendingConflicts.set(conflict.id, conflict)
        }

        await this.persistPendingConflicts()
      }

      return conflicts

    } catch (error) {
      logger.error('Failed to detect conflicts', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        tableName,
        recordId
      })
      return []
    }
  }

  /**
   * Resolve a conflict using available strategies
   */
  async resolveConflict(conflictId: string, userInput?: any): Promise<ConflictResolutionResult> {
    try {
      const conflict = this.pendingConflicts.get(conflictId)
      if (!conflict) {
        return { success: false, error: 'Conflict not found' }
      }

      logger.debug('Resolving conflict', this.userId, undefined, {
        conflictId,
        conflictType: conflict.conflictType,
        tableName: conflict.tableName
      })

      // Find applicable resolution strategy
      const strategy = this.findBestStrategy(conflict, userInput !== undefined)

      if (!strategy) {
        return {
          success: false,
          requiresManualResolution: true,
          error: 'No applicable resolution strategy found'
        }
      }

      // Apply resolution strategy
      const resolvedValue = await this.applyResolutionStrategy(conflict, strategy, userInput)

      if (resolvedValue === undefined && strategy.requiresUserInput && !userInput) {
        return {
          success: false,
          requiresManualResolution: true,
          error: 'User input required for resolution'
        }
      }

      // Create resolution record
      const resolution: ConflictResolution = {
        conflictId,
        strategy,
        resolvedValue,
        resolvedBy: userInput !== undefined ? 'user' : 'system',
        resolvedAt: new Date().toISOString(),
        reasoning: this.generateResolutionReasoning(conflict, strategy, resolvedValue)
      }

      // Store resolution
      await this.storeResolution(conflict, resolution)

      // Remove from pending conflicts
      this.pendingConflicts.delete(conflictId)
      await this.persistPendingConflicts()

      // Log audit event
      await auditLogger.logSecurityEvent({
        action: 'conflict_resolved',
        resource: conflict.tableName,
        resourceId: conflict.recordId,
        userId: this.userId!,
        details: {
          conflictType: conflict.conflictType,
          fieldName: conflict.fieldName,
          strategy: strategy.name,
          resolvedBy: resolution.resolvedBy,
          localDevice: conflict.localDeviceId,
          remoteDevice: conflict.remoteDeviceId
        },
        severity: conflict.priority === 'critical' ? 'high' : 'medium'
      })

      logger.info('Conflict resolved successfully', this.userId, undefined, {
        conflictId,
        strategy: strategy.name,
        resolvedBy: resolution.resolvedBy
      })

      return {
        success: true,
        resolvedValue,
        metadata: {
          strategy: strategy.name,
          resolvedBy: resolution.resolvedBy,
          reasoning: resolution.reasoning
        }
      }

    } catch (error) {
      logger.error('Failed to resolve conflict', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        conflictId
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get all pending conflicts
   */
  getPendingConflicts(): DataConflict[] {
    return Array.from(this.pendingConflicts.values())
  }

  /**
   * Get conflict resolution statistics
   */
  async getConflictStats(): Promise<ConflictStats> {
    try {
      const pending = Array.from(this.pendingConflicts.values())
      const allResolutions = Array.from(this.conflictHistory.values()).flat()

      const stats: ConflictStats = {
        totalConflicts: pending.length + allResolutions.length,
        autoResolved: allResolutions.filter(r => r.resolvedBy === 'system').length,
        manualResolution: allResolutions.filter(r => r.resolvedBy === 'user').length,
        pending: pending.length,
        byType: {},
        byTable: {}
      }

      // Count by type
      const allConflicts = pending.concat(allResolutions.map(r => this.getConflictFromResolution(r)))
      allConflicts.forEach(conflict => {
        if (conflict) {
          stats.byType[conflict.conflictType] = (stats.byType[conflict.conflictType] || 0) + 1
          stats.byTable[conflict.tableName] = (stats.byTable[conflict.tableName] || 0) + 1
        }
      })

      return stats

    } catch (error) {
      logger.error('Failed to get conflict stats', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return {
        totalConflicts: 0,
        autoResolved: 0,
        manualResolution: 0,
        pending: 0,
        byType: {},
        byTable: {}
      }
    }
  }

  /**
   * Register a custom resolution strategy
   */
  registerStrategy(strategy: ConflictResolutionStrategy): void {
    this.resolutionStrategies.set(strategy.name, strategy)
    logger.info('Custom resolution strategy registered', this.userId, undefined, {
      strategyName: strategy.name
    })
  }

  /**
   * Auto-resolve all pending conflicts where possible
   */
  async autoResolveConflicts(): Promise<{ resolved: number; failed: number; requiresManual: number }> {
    const results = { resolved: 0, failed: 0, requiresManual: 0 }

    for (const conflict of this.pendingConflicts.values()) {
      if (conflict.autoResolvable) {
        const result = await this.resolveConflict(conflict.id)
        if (result.success) {
          results.resolved++
        } else if (result.requiresManualResolution) {
          results.requiresManual++
        } else {
          results.failed++
        }
      } else {
        results.requiresManual++
      }
    }

    logger.info('Auto-resolution completed', this.userId, undefined, results)
    return results
  }

  // Private helper methods

  private initializeDefaultStrategies(): void {
    // Last Write Wins strategy
    this.resolutionStrategies.set('last_write_wins', {
      name: 'last_write_wins',
      description: 'Use the value with the most recent timestamp',
      applicableTypes: ['concurrent_update', 'field_type_mismatch'],
      priority: 1,
      autoResolve: true,
      requiresUserInput: false
    })

    // First Write Wins strategy
    this.resolutionStrategies.set('first_write_wins', {
      name: 'first_write_wins',
      description: 'Use the value with the earliest timestamp',
      applicableTypes: ['concurrent_update'],
      priority: 2,
      autoResolve: true,
      requiresUserInput: false
    })

    // Local Wins strategy
    this.resolutionStrategies.set('local_wins', {
      name: 'local_wins',
      description: 'Always prefer the local value',
      applicableTypes: ['concurrent_update', 'delete_update'],
      priority: 3,
      autoResolve: true,
      requiresUserInput: false
    })

    // Remote Wins strategy
    this.resolutionStrategies.set('remote_wins', {
      name: 'remote_wins',
      description: 'Always prefer the remote value',
      applicableTypes: ['concurrent_update', 'delete_update'],
      priority: 4,
      autoResolve: true,
      requiresUserInput: false
    })

    // String Merge strategy
    this.resolutionStrategies.set('string_merge', {
      name: 'string_merge',
      description: 'Merge string values by concatenation',
      applicableTypes: ['concurrent_update'],
      priority: 5,
      autoResolve: true,
      requiresUserInput: false
    })

    // Manual Resolution strategy
    this.resolutionStrategies.set('manual', {
      name: 'manual',
      description: 'Require manual user resolution',
      applicableTypes: ['concurrent_update', 'delete_update', 'create_create', 'field_type_mismatch'],
      priority: 999,
      autoResolve: false,
      requiresUserInput: true
    })
  }

  private detectFieldConflicts(
    tableName: string,
    recordId: string,
    localData: any,
    remoteData: any,
    localTimestamp: string,
    remoteTimestamp: string,
    localDeviceId: string,
    remoteDeviceId: string
  ): DataConflict[] {
    const conflicts: DataConflict[] = []

    // Get all fields from both objects
    const allFields = new Set([...Object.keys(localData), ...Object.keys(remoteData)])

    for (const fieldName of allFields) {
      const localValue = localData[fieldName]
      const remoteValue = remoteData[fieldName]

      // Skip fields that are identical
      if (JSON.stringify(localValue) === JSON.stringify(remoteValue)) {
        continue
      }

      // Skip system fields that shouldn't be synchronized
      if (this.isSystemField(fieldName)) {
        continue
      }

      // Determine conflict type and priority
      let conflictType: DataConflict['conflictType'] = 'concurrent_update'
      let priority: DataConflict['priority'] = 'medium'

      if (typeof localValue !== typeof remoteValue) {
        conflictType = 'field_type_mismatch'
        priority = 'high'
      }

      // Determine if auto-resolvable
      const autoResolvable = this.isFieldAutoResolvable(fieldName, localValue, remoteValue, tableName)

      conflicts.push(this.createConflict(
        tableName,
        recordId,
        fieldName,
        conflictType,
        localValue,
        remoteValue,
        localTimestamp,
        remoteTimestamp,
        localDeviceId,
        remoteDeviceId,
        priority,
        autoResolvable
      ))
    }

    return conflicts
  }

  private createConflict(
    tableName: string,
    recordId: string,
    fieldName: string,
    conflictType: DataConflict['conflictType'],
    localValue: any,
    remoteValue: any,
    localTimestamp: string,
    remoteTimestamp: string,
    localDeviceId: string,
    remoteDeviceId: string,
    priority: DataConflict['priority'],
    autoResolvable: boolean = true
  ): DataConflict {
    return {
      id: crypto.randomUUID(),
      tableName,
      recordId,
      fieldName,
      conflictType,
      localValue,
      remoteValue,
      localTimestamp,
      remoteTimestamp,
      localDeviceId,
      remoteDeviceId,
      priority,
      autoResolvable,
      metadata: {
        detectedAt: new Date().toISOString(),
        userId: this.userId
      }
    }
  }

  private findBestStrategy(conflict: DataConflict, hasUserInput: boolean): ConflictResolutionStrategy | null {
    const applicableStrategies = Array.from(this.resolutionStrategies.values())
      .filter(strategy =>
        strategy.applicableTypes.includes(conflict.conflictType) &&
        (!strategy.requiresUserInput || hasUserInput)
      )
      .sort((a, b) => a.priority - b.priority)

    return applicableStrategies[0] || null
  }

  private async applyResolutionStrategy(
    conflict: DataConflict,
    strategy: ConflictResolutionStrategy,
    userInput?: any
  ): Promise<any> {
    switch (strategy.name) {
      case 'last_write_wins':
        return new Date(conflict.localTimestamp) > new Date(conflict.remoteTimestamp)
          ? conflict.localValue
          : conflict.remoteValue

      case 'first_write_wins':
        return new Date(conflict.localTimestamp) < new Date(conflict.remoteTimestamp)
          ? conflict.localValue
          : conflict.remoteValue

      case 'local_wins':
        return conflict.localValue

      case 'remote_wins':
        return conflict.remoteValue

      case 'string_merge':
        if (typeof conflict.localValue === 'string' && typeof conflict.remoteValue === 'string') {
          return `${conflict.localValue}\n---\n${conflict.remoteValue}`
        }
        return conflict.localValue

      case 'manual':
        return userInput

      default:
        logger.warn('Unknown resolution strategy', this.userId, undefined, { strategy: strategy.name })
        return undefined
    }
  }

  private generateResolutionReasoning(
    conflict: DataConflict,
    strategy: ConflictResolutionStrategy,
    resolvedValue: any
  ): string {
    switch (strategy.name) {
      case 'last_write_wins':
        return `Resolved using last write wins: ${new Date(conflict.localTimestamp) > new Date(conflict.remoteTimestamp) ? 'local' : 'remote'} value was more recent`
      case 'first_write_wins':
        return `Resolved using first write wins: ${new Date(conflict.localTimestamp) < new Date(conflict.remoteTimestamp) ? 'local' : 'remote'} value was earlier`
      case 'local_wins':
        return 'Resolved by preferring local value'
      case 'remote_wins':
        return 'Resolved by preferring remote value'
      case 'string_merge':
        return 'Resolved by merging string values'
      case 'manual':
        return 'Resolved manually by user'
      default:
        return `Resolved using ${strategy.name} strategy`
    }
  }

  private async storeResolution(conflict: DataConflict, resolution: ConflictResolution): Promise<void> {
    try {
      // Store in local history
      if (!this.conflictHistory.has(conflict.id)) {
        this.conflictHistory.set(conflict.id, [])
      }
      this.conflictHistory.get(conflict.id)!.push(resolution)

      // Persist to storage
      await this.persistConflictHistory()

      // Store in database for audit purposes
      const { error } = await supabase
        .from('audit_logs')
        .insert({
          user_id: this.userId!,
          action: 'conflict_resolved',
          resource: conflict.tableName,
          resource_id: conflict.recordId,
          details: await encryptionService.encryptData(JSON.stringify({
            conflict,
            resolution
          })),
          ip_address: null,
          user_agent: navigator.userAgent
        })

      if (error) {
        logger.warn('Failed to store conflict resolution in audit logs', this.userId, undefined, {
          error: error.message
        })
      }

    } catch (error) {
      logger.error('Failed to store conflict resolution', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        conflictId: conflict.id
      })
    }
  }

  private isSystemField(fieldName: string): boolean {
    const systemFields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'version']
    return systemFields.includes(fieldName)
  }

  private isFieldAutoResolvable(fieldName: string, localValue: any, remoteValue: any, tableName: string): boolean {
    // PHI fields should require manual resolution
    const phiFields = ['patient_name', 'ssn', 'medical_record', 'diagnosis', 'treatment']
    if (phiFields.some(field => fieldName.toLowerCase().includes(field))) {
      return false
    }

    // Critical fields for specific tables
    if (tableName === 'patients' && ['name', 'dob', 'medical_record_number'].includes(fieldName)) {
      return false
    }

    // Simple value types are usually auto-resolvable
    if (typeof localValue === 'string' || typeof localValue === 'number' || typeof localValue === 'boolean') {
      return true
    }

    return false
  }

  private async loadPendingConflicts(): Promise<void> {
    try {
      if (this.userId) {
        const conflictsData = await secureStorage.getItem(`pending_conflicts_${this.userId}`)
        if (conflictsData) {
          const conflicts = JSON.parse(conflictsData) as DataConflict[]
          this.pendingConflicts.clear()
          conflicts.forEach(conflict => this.pendingConflicts.set(conflict.id, conflict))
        }
      }
    } catch (error) {
      logger.warn('Failed to load pending conflicts', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async persistPendingConflicts(): Promise<void> {
    try {
      if (this.userId) {
        const conflicts = Array.from(this.pendingConflicts.values())
        await secureStorage.setItem(`pending_conflicts_${this.userId}`, JSON.stringify(conflicts))
      }
    } catch (error) {
      logger.warn('Failed to persist pending conflicts', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async loadConflictHistory(): Promise<void> {
    try {
      if (this.userId) {
        const historyData = await secureStorage.getItem(`conflict_history_${this.userId}`)
        if (historyData) {
          const history = JSON.parse(historyData)
          this.conflictHistory.clear()
          Object.entries(history).forEach(([conflictId, resolutions]) => {
            this.conflictHistory.set(conflictId, resolutions as ConflictResolution[])
          })
        }
      }
    } catch (error) {
      logger.warn('Failed to load conflict history', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async persistConflictHistory(): Promise<void> {
    try {
      if (this.userId) {
        const history = Object.fromEntries(this.conflictHistory)
        await secureStorage.setItem(`conflict_history_${this.userId}`, JSON.stringify(history))
      }
    } catch (error) {
      logger.warn('Failed to persist conflict history', this.userId, undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private getConflictFromResolution(resolution: ConflictResolution): DataConflict | null {
    // This would need to be implemented based on how you store conflict data with resolutions
    // For now, return null as it's not critical for basic functionality
    return null
  }
}

// Export singleton instance
export const conflictResolutionService = new ConflictResolutionService()