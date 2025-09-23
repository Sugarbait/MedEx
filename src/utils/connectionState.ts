/**
 * Connection State Management Utility
 *
 * Provides centralized management of Supabase connection state
 * and graceful degradation to localStorage-only mode
 */

import { supabaseConfig } from '@/config/supabase'

export interface ConnectionState {
  isOnline: boolean
  isSupabaseAvailable: boolean
  isLocalStorageOnly: boolean
  lastConnectedAt: Date | null
  lastFailureAt: Date | null
  consecutiveFailures: number
}

class ConnectionStateManager {
  private state: ConnectionState = {
    isOnline: navigator.onLine,
    isSupabaseAvailable: supabaseConfig.isConfigured(),
    isLocalStorageOnly: !supabaseConfig.isConfigured(),
    lastConnectedAt: null,
    lastFailureAt: null,
    consecutiveFailures: 0
  }

  private listeners: Array<(state: ConnectionState) => void> = []
  private readonly MAX_CONSECUTIVE_FAILURES = 3
  private readonly RECONNECT_INTERVAL = 60000 // 1 minute

  constructor() {
    // Listen to browser online/offline events
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))

    // Initialize state based on configuration
    this.updateSupabaseAvailability()
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return { ...this.state }
  }

  /**
   * Check if we should attempt Supabase operations
   */
  shouldTrySupabase(): boolean {
    return this.state.isOnline &&
           this.state.isSupabaseAvailable &&
           !this.state.isLocalStorageOnly &&
           this.state.consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES
  }

  /**
   * Check if we're in localStorage-only mode
   */
  isLocalStorageOnlyMode(): boolean {
    return this.state.isLocalStorageOnly || !this.state.isSupabaseAvailable
  }

  /**
   * Record a successful Supabase operation
   */
  recordSuccess(): void {
    const previouslyOffline = this.state.isLocalStorageOnly || this.state.consecutiveFailures > 0

    this.state.consecutiveFailures = 0
    this.state.lastConnectedAt = new Date()
    this.state.isLocalStorageOnly = false

    if (this.state.isSupabaseAvailable && previouslyOffline) {
      console.log('🌐 Supabase connection restored')
      this.notifyListeners()
    }
  }

  /**
   * Record a failed Supabase operation
   */
  recordFailure(error?: any): void {
    this.state.consecutiveFailures++
    this.state.lastFailureAt = new Date()

    const wasOnline = !this.state.isLocalStorageOnly

    // Switch to localStorage-only mode after max failures
    if (this.state.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      this.state.isLocalStorageOnly = true

      if (wasOnline) {
        console.log('📱 Switching to localStorage-only mode due to connection issues')
        supabaseConfig.setLocalStorageOnly(true)
        this.notifyListeners()
      }
    }
  }

  /**
   * Manually set localStorage-only mode
   */
  setLocalStorageOnly(value: boolean): void {
    const changed = this.state.isLocalStorageOnly !== value
    this.state.isLocalStorageOnly = value
    supabaseConfig.setLocalStorageOnly(value)

    if (changed) {
      console.log(value ? '📱 Switched to localStorage-only mode' : '🌐 Re-enabled Supabase mode')
      this.notifyListeners()
    }
  }

  /**
   * Subscribe to connection state changes
   */
  subscribe(listener: (state: ConnectionState) => void): () => void {
    this.listeners.push(listener)

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Attempt to reconnect to Supabase
   */
  async attemptReconnect(): Promise<boolean> {
    if (!this.state.isOnline || !this.state.isSupabaseAvailable) {
      return false
    }

    try {
      // Simple connectivity test - try to get table info without data
      const { error } = await (globalThis as any).supabase
        .from('users')
        .select('id')
        .limit(1)

      if (!error) {
        this.recordSuccess()
        return true
      } else {
        this.recordFailure(error)
        return false
      }
    } catch (error) {
      this.recordFailure(error)
      return false
    }
  }

  /**
   * Get user-friendly status message
   */
  getStatusMessage(): string {
    if (!this.state.isOnline) {
      return 'No internet connection'
    }

    if (!this.state.isSupabaseAvailable) {
      return 'Database not configured - using offline mode'
    }

    if (this.state.isLocalStorageOnly) {
      return 'Working in offline mode'
    }

    return 'Connected'
  }

  private handleOnline(): void {
    this.state.isOnline = true
    console.log('🌐 Browser came online')

    // Attempt to reconnect after a brief delay
    setTimeout(() => {
      if (this.state.isLocalStorageOnly && this.state.isSupabaseAvailable) {
        this.attemptReconnect()
      }
    }, 2000)
  }

  private handleOffline(): void {
    this.state.isOnline = false
    this.state.isLocalStorageOnly = true
    console.log('📱 Browser went offline - switching to localStorage mode')
    this.notifyListeners()
  }

  private updateSupabaseAvailability(): void {
    this.state.isSupabaseAvailable = supabaseConfig.isConfigured()
    this.state.isLocalStorageOnly = !this.state.isSupabaseAvailable || supabaseConfig.isLocalStorageOnly()
  }

  private notifyListeners(): void {
    const currentState = this.getState()
    this.listeners.forEach(listener => {
      try {
        listener(currentState)
      } catch (error) {
        console.warn('Error in connection state listener:', error)
      }
    })
  }
}

// Export singleton instance
export const connectionState = new ConnectionStateManager()

// Export helper functions for easy use
export const isSupabaseAvailable = () => connectionState.shouldTrySupabase()
export const isLocalStorageOnly = () => connectionState.isLocalStorageOnlyMode()
export const recordSupabaseSuccess = () => connectionState.recordSuccess()
export const recordSupabaseFailure = (error?: any) => connectionState.recordFailure(error)