/**
 * Cross-Device Conflict Resolution Service
 *
 * Handles conflicts when multiple devices update the same data simultaneously.
 * Provides automatic and manual resolution strategies for user settings, profiles,
 * and other synchronized data.
 */

import { supabase, supabaseConfig } from '@/config/supabase'
import { Database } from '@/types/supabase'
import { auditLogger } from './auditLogger'
import { encryptionService } from './encryption'

export interface ConflictData<T = any> {
  conflictId: string
  userId: string
  table: string
  recordId?: string
  localData: T
  remoteData: T
  localTimestamp: string
  remoteTimestamp: string
  conflictingFields: string[]
  conflictType: 'field_conflict' | 'timestamp_conflict' | 'version_conflict' | 'encryption_conflict'
  severity: 'low' | 'medium' | 'high' | 'critical'
  autoResolvable: boolean
  deviceId: string
  createdAt: string
}

export interface ConflictResolutionStrategy {
  strategy: 'take_local' | 'take_remote' | 'merge_fields' | 'last_write_wins' | 'first_write_wins' | 'manual_review'
  confidence: number // 0-1 scale
  description: string
  riskLevel: 'low' | 'medium' | 'high'
  preservesData: boolean
}

export interface ConflictResolutionResult<T = any> {
  success: boolean
  resolvedData?: T
  strategy: string
  conflictsResolved: number
  message?: string
  error?: string
  requiresUserIntervention?: boolean
}

class CrossDeviceConflictResolver {
  private conflicts = new Map<string, ConflictData[]>()
  private resolutionHistory = new Map<string, ConflictResolutionResult[]>()
  private autoResolutionStrategies = new Map<string, ConflictResolutionStrategy>()

  constructor() {
    this.initializeDefaultStrategies()
  }

  /**
   * Initialize default resolution strategies
   */
  private initializeDefaultStrategies(): void {
    // User Settings strategies
    this.autoResolutionStrategies.set('user_settings.theme', {
      strategy: 'last_write_wins',
      confidence: 0.9,
      description: 'Theme preferences can safely use last write wins',
      riskLevel: 'low',
      preservesData: false
    })

    this.autoResolutionStrategies.set('user_settings.notifications', {
      strategy: 'merge_fields',
      confidence: 0.8,
      description: 'Notification settings can be merged at field level',
      riskLevel: 'low',
      preservesData: true
    })

    this.autoResolutionStrategies.set('user_settings.retell_config', {
      strategy: 'manual_review',
      confidence: 0.3,
      description: 'API credentials require manual review for security',
      riskLevel: 'high',
      preservesData: true
    })

    // User Profile strategies
    this.autoResolutionStrategies.set('user_profiles.name', {
      strategy: 'last_write_wins',
      confidence: 0.7,
      description: 'Name changes should use most recent update',
      riskLevel: 'medium',
      preservesData: false
    })

    this.autoResolutionStrategies.set('user_profiles.avatar', {
      strategy: 'last_write_wins',
      confidence: 0.9,
      description: 'Avatar changes can safely use last write wins',
      riskLevel: 'low',
      preservesData: false
    })

    this.autoResolutionStrategies.set('user_profiles.mfa_enabled', {
      strategy: 'manual_review',
      confidence: 0.2,
      description: 'MFA changes require manual verification for security',
      riskLevel: 'critical',
      preservesData: true
    })
  }

  /**
   * Detect conflicts between local and remote data
   */
  async detectConflict<T>(
    userId: string,
    table: string,
    recordId: string,
    localData: T,
    remoteData: T,
    deviceId: string
  ): Promise<ConflictData<T> | null> {
    try {
      const conflictingFields = this.identifyConflictingFields(localData, remoteData)

      if (conflictingFields.length === 0) {
        return null // No conflict detected
      }

      const conflictId = this.generateConflictId(userId, table, recordId)
      const localTimestamp = this.extractTimestamp(localData) || new Date().toISOString()
      const remoteTimestamp = this.extractTimestamp(remoteData) || new Date().toISOString()

      const conflict: ConflictData<T> = {
        conflictId,
        userId,
        table,
        recordId,
        localData,
        remoteData,
        localTimestamp,
        remoteTimestamp,
        conflictingFields,
        conflictType: this.determineConflictType(localData, remoteData, conflictingFields),
        severity: this.assessConflictSeverity(table, conflictingFields),
        autoResolvable: this.isAutoResolvable(table, conflictingFields),
        deviceId,
        createdAt: new Date().toISOString()
      }

      // Store conflict
      const userConflicts = this.conflicts.get(userId) || []
      userConflicts.push(conflict)
      this.conflicts.set(userId, userConflicts)

      // Log conflict detection
      await auditLogger.logSecurityEvent('CONFLICT_DETECTED', table, true, {
        conflictId,
        conflictingFields,
        severity: conflict.severity,
        autoResolvable: conflict.autoResolvable
      })

      console.warn(`⚠️ CONFLICT DETECTED: ${conflictId}`, {
        table,
        fields: conflictingFields,
        severity: conflict.severity
      })

      return conflict

    } catch (error) {
      console.error('Error detecting conflict:', error)
      return null
    }
  }

  /**
   * Resolve conflict automatically if possible
   */
  async resolveConflictAutomatically<T>(conflict: ConflictData<T>): Promise<ConflictResolutionResult<T>> {
    try {
      if (!conflict.autoResolvable) {
        return {
          success: false,
          strategy: 'none',
          conflictsResolved: 0,
          requiresUserIntervention: true,
          message: 'Conflict requires manual resolution'
        }
      }

      const strategy = this.selectBestStrategy(conflict.table, conflict.conflictingFields)
      let resolvedData: T

      switch (strategy.strategy) {
        case 'last_write_wins':
          resolvedData = this.resolveLastWriteWins(conflict)
          break

        case 'first_write_wins':
          resolvedData = this.resolveFirstWriteWins(conflict)
          break

        case 'merge_fields':
          resolvedData = this.resolveMergeFields(conflict)
          break

        case 'take_local':
          resolvedData = conflict.localData
          break

        case 'take_remote':
          resolvedData = conflict.remoteData
          break

        default:
          throw new Error(`Unsupported strategy: ${strategy.strategy}`)
      }

      // Remove from conflict queue
      await this.removeConflict(conflict.userId, conflict.conflictId)

      // Log resolution
      await auditLogger.logSecurityEvent('CONFLICT_RESOLVED', conflict.table, true, {
        conflictId: conflict.conflictId,
        strategy: strategy.strategy,
        confidence: strategy.confidence,
        automatic: true
      })

      const result: ConflictResolutionResult<T> = {
        success: true,
        resolvedData,
        strategy: strategy.strategy,
        conflictsResolved: 1,
        message: `Conflict resolved using ${strategy.strategy} strategy`
      }

      // Store in history
      this.addToResolutionHistory(conflict.userId, result)

      console.log(`✅ CONFLICT RESOLVED: ${conflict.conflictId} using ${strategy.strategy}`)
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      await auditLogger.logSecurityEvent('CONFLICT_RESOLUTION_FAILED', conflict.table, false, {
        conflictId: conflict.conflictId,
        error: errorMessage
      })

      return {
        success: false,
        strategy: 'failed',
        conflictsResolved: 0,
        error: errorMessage
      }
    }
  }

  /**
   * Resolve conflict manually with user input
   */
  async resolveConflictManually<T>(
    conflictId: string,
    userId: string,
    resolution: 'take_local' | 'take_remote' | 'merge' | 'custom',
    customData?: T
  ): Promise<ConflictResolutionResult<T>> {
    try {
      const userConflicts = this.conflicts.get(userId) || []
      const conflict = userConflicts.find(c => c.conflictId === conflictId)

      if (!conflict) {
        return {
          success: false,
          strategy: 'not_found',
          conflictsResolved: 0,
          error: 'Conflict not found'
        }
      }

      let resolvedData: T

      switch (resolution) {
        case 'take_local':
          resolvedData = conflict.localData
          break
        case 'take_remote':
          resolvedData = conflict.remoteData
          break
        case 'merge':
          resolvedData = this.resolveMergeFields(conflict)
          break
        case 'custom':
          if (!customData) {
            throw new Error('Custom data required for custom resolution')
          }
          resolvedData = customData
          break
        default:
          throw new Error(`Invalid resolution type: ${resolution}`)
      }

      // Remove from conflict queue
      await this.removeConflict(userId, conflictId)

      // Log manual resolution
      await auditLogger.logSecurityEvent('CONFLICT_RESOLVED', conflict.table, true, {
        conflictId,
        strategy: resolution,
        automatic: false,
        userId
      })

      const result: ConflictResolutionResult<T> = {
        success: true,
        resolvedData,
        strategy: resolution,
        conflictsResolved: 1,
        message: `Conflict manually resolved using ${resolution} strategy`
      }

      this.addToResolutionHistory(userId, result)

      console.log(`✅ MANUAL CONFLICT RESOLVED: ${conflictId} using ${resolution}`)
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return {
        success: false,
        strategy: 'failed',
        conflictsResolved: 0,
        error: errorMessage
      }
    }
  }

  /**
   * Get pending conflicts for a user
   */
  getPendingConflicts(userId: string): ConflictData[] {
    return this.conflicts.get(userId) || []
  }

  /**
   * Get conflict resolution history for a user
   */
  getResolutionHistory(userId: string): ConflictResolutionResult[] {
    return this.resolutionHistory.get(userId) || []
  }

  /**
   * Clear resolved conflicts
   */
  clearResolvedConflicts(userId: string): void {
    this.conflicts.delete(userId)
    console.log(`🗑️ Cleared resolved conflicts for user: ${userId}`)
  }

  /**
   * Identify conflicting fields between two objects
   */
  private identifyConflictingFields(localData: any, remoteData: any): string[] {
    const conflicts: string[] = []

    const localKeys = new Set(Object.keys(localData || {}))
    const remoteKeys = new Set(Object.keys(remoteData || {}))
    const allKeys = new Set([...localKeys, ...remoteKeys])

    for (const key of allKeys) {
      // Skip metadata fields
      if (key.startsWith('_') || key === 'updated_at' || key === 'last_synced') {
        continue
      }

      const localValue = localData?.[key]
      const remoteValue = remoteData?.[key]

      // Deep comparison for objects
      if (typeof localValue === 'object' && typeof remoteValue === 'object') {
        if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
          conflicts.push(key)
        }
      } else if (localValue !== remoteValue) {
        conflicts.push(key)
      }
    }

    return conflicts
  }

  /**
   * Determine the type of conflict
   */
  private determineConflictType(localData: any, remoteData: any, conflictingFields: string[]): ConflictData['conflictType'] {
    // Check for encryption conflicts
    if (conflictingFields.some(field => field.includes('encrypted') || field.includes('secret'))) {
      return 'encryption_conflict'
    }

    // Check for timestamp conflicts
    const localTimestamp = this.extractTimestamp(localData)
    const remoteTimestamp = this.extractTimestamp(remoteData)

    if (localTimestamp && remoteTimestamp) {
      const timeDiff = Math.abs(new Date(localTimestamp).getTime() - new Date(remoteTimestamp).getTime())
      if (timeDiff < 5000) { // Within 5 seconds
        return 'timestamp_conflict'
      }
    }

    // Check for version conflicts
    if (localData?.version !== remoteData?.version) {
      return 'version_conflict'
    }

    return 'field_conflict'
  }

  /**
   * Assess conflict severity
   */
  private assessConflictSeverity(table: string, conflictingFields: string[]): ConflictData['severity'] {
    // Critical severity for security-related fields
    const criticalFields = ['mfa_enabled', 'encrypted_secret', 'retell_config', 'password', 'api_key']
    if (conflictingFields.some(field => criticalFields.some(cf => field.includes(cf)))) {
      return 'critical'
    }

    // High severity for profile changes
    const highFields = ['role', 'permissions', 'email']
    if (conflictingFields.some(field => highFields.includes(field))) {
      return 'high'
    }

    // Medium severity for settings
    const mediumFields = ['notifications', 'preferences', 'name']
    if (conflictingFields.some(field => mediumFields.includes(field))) {
      return 'medium'
    }

    return 'low'
  }

  /**
   * Check if conflict can be auto-resolved
   */
  private isAutoResolvable(table: string, conflictingFields: string[]): boolean {
    // Never auto-resolve critical security fields
    const criticalFields = ['mfa_enabled', 'encrypted_secret', 'retell_config', 'role', 'permissions']
    if (conflictingFields.some(field => criticalFields.some(cf => field.includes(cf)))) {
      return false
    }

    // Auto-resolve simple preference fields
    const safeFields = ['theme', 'avatar', 'language', 'timezone']
    return conflictingFields.every(field => safeFields.some(sf => field.includes(sf)))
  }

  /**
   * Select best resolution strategy
   */
  private selectBestStrategy(table: string, conflictingFields: string[]): ConflictResolutionStrategy {
    // Find the best strategy for the most critical field
    let bestStrategy: ConflictResolutionStrategy = {
      strategy: 'manual_review',
      confidence: 0.1,
      description: 'Default manual review',
      riskLevel: 'high',
      preservesData: true
    }

    for (const field of conflictingFields) {
      const key = `${table}.${field}`
      const strategy = this.autoResolutionStrategies.get(key)

      if (strategy && strategy.confidence > bestStrategy.confidence) {
        bestStrategy = strategy
      }
    }

    return bestStrategy
  }

  /**
   * Resolve using last write wins strategy
   */
  private resolveLastWriteWins<T>(conflict: ConflictData<T>): T {
    const localTime = new Date(conflict.localTimestamp).getTime()
    const remoteTime = new Date(conflict.remoteTimestamp).getTime()

    return remoteTime > localTime ? conflict.remoteData : conflict.localData
  }

  /**
   * Resolve using first write wins strategy
   */
  private resolveFirstWriteWins<T>(conflict: ConflictData<T>): T {
    const localTime = new Date(conflict.localTimestamp).getTime()
    const remoteTime = new Date(conflict.remoteTimestamp).getTime()

    return localTime < remoteTime ? conflict.localData : conflict.remoteData
  }

  /**
   * Resolve using field-level merge strategy
   */
  private resolveMergeFields<T>(conflict: ConflictData<T>): T {
    const resolved = { ...conflict.localData } as any
    const remote = conflict.remoteData as any

    // Merge non-conflicting fields from remote
    for (const [key, value] of Object.entries(remote)) {
      if (!conflict.conflictingFields.includes(key)) {
        resolved[key] = value
      } else {
        // For conflicting fields, use newer timestamp
        const localTime = this.extractTimestamp(conflict.localData)
        const remoteTime = this.extractTimestamp(conflict.remoteData)

        if (remoteTime && localTime && new Date(remoteTime) > new Date(localTime)) {
          resolved[key] = value
        }
      }
    }

    return resolved as T
  }

  /**
   * Extract timestamp from data object
   */
  private extractTimestamp(data: any): string | null {
    if (data?.updated_at) return data.updated_at
    if (data?.last_synced) return data.last_synced
    if (data?.timestamp) return data.timestamp
    return null
  }

  /**
   * Generate unique conflict ID
   */
  private generateConflictId(userId: string, table: string, recordId?: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `conflict_${table}_${userId}_${recordId || 'default'}_${timestamp}_${random}`
  }

  /**
   * Remove conflict from queue
   */
  private async removeConflict(userId: string, conflictId: string): Promise<void> {
    const userConflicts = this.conflicts.get(userId) || []
    const filteredConflicts = userConflicts.filter(c => c.conflictId !== conflictId)
    this.conflicts.set(userId, filteredConflicts)
  }

  /**
   * Add to resolution history
   */
  private addToResolutionHistory(userId: string, result: ConflictResolutionResult): void {
    const history = this.resolutionHistory.get(userId) || []
    history.push({
      ...result,
      timestamp: new Date().toISOString()
    } as any)

    // Keep only last 50 resolutions
    if (history.length > 50) {
      history.splice(0, history.length - 50)
    }

    this.resolutionHistory.set(userId, history)
  }

  /**
   * Clean up resolved conflicts and old history
   */
  cleanup(userId?: string): void {
    if (userId) {
      this.conflicts.delete(userId)

      // Keep only recent history (last 24 hours)
      const history = this.resolutionHistory.get(userId) || []
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
      const recentHistory = history.filter(h => {
        const timestamp = (h as any).timestamp
        return timestamp ? new Date(timestamp).getTime() > oneDayAgo : false
      })

      this.resolutionHistory.set(userId, recentHistory)
    } else {
      this.conflicts.clear()
      this.resolutionHistory.clear()
    }

    console.log(`🧹 Cleaned up conflict resolver for ${userId || 'all users'}`)
  }
}

// Export singleton instance
export const conflictResolver = new CrossDeviceConflictResolver()

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    conflictResolver.cleanup()
  })
}