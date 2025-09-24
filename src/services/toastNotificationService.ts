/**
 * Toast Notification Service
 *
 * Provides real-time toast notifications for new Call and SMS records
 * with cross-device synchronization and user preference integration
 */

import { supabase } from '@/config/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import { ToastNotificationData } from '@/components/common/ToastNotification'

export interface ToastNotificationPreferences {
  enabled: boolean
  soundEnabled: boolean
  doNotDisturb: {
    enabled: boolean
    startTime: string // Format: "22:00"
    endTime: string   // Format: "08:00"
  }
}

export type ToastNotificationCallback = (notification: ToastNotificationData) => void

class ToastNotificationService {
  private isInitialized = false
  private callsChannel: RealtimeChannel | null = null
  private smsChannel: RealtimeChannel | null = null
  private callbacks: Set<ToastNotificationCallback> = new Set()
  private preferences: ToastNotificationPreferences = {
    enabled: true,
    soundEnabled: true,
    doNotDisturb: {
      enabled: false,
      startTime: "22:00",
      endTime: "08:00"
    }
  }

  // Deduplication tracking
  private recentNotifications = new Map<string, number>()
  private readonly DEDUP_WINDOW = 5000 // 5 seconds

  // Tab visibility tracking
  private isTabVisible = true
  private pendingNotifications: ToastNotificationData[] = []

  /**
   * Initialize the toast notification service
   */
  async initialize(userId: string): Promise<void> {
    if (this.isInitialized) return

    console.log('🔔 Initializing Toast Notification Service...')

    // Load user preferences
    await this.loadUserPreferences(userId)

    // Set up tab visibility tracking
    this.setupVisibilityTracking()

    // Set up real-time monitoring if notifications are enabled
    if (this.preferences.enabled) {
      await this.setupRealtimeMonitoring()
    }

    this.isInitialized = true
    console.log('✅ Toast Notification Service initialized')
  }

  /**
   * Subscribe to toast notifications
   */
  subscribe(callback: ToastNotificationCallback): () => void {
    this.callbacks.add(callback)

    return () => {
      this.callbacks.delete(callback)
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(userId: string, preferences: Partial<ToastNotificationPreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...preferences }

    // Save to localStorage for quick access
    localStorage.setItem('toast_notification_preferences', JSON.stringify(this.preferences))

    // Restart monitoring if enabled status changed
    if (preferences.enabled !== undefined) {
      if (preferences.enabled && !this.callsChannel && !this.smsChannel) {
        await this.setupRealtimeMonitoring()
      } else if (!preferences.enabled && (this.callsChannel || this.smsChannel)) {
        this.stopRealtimeMonitoring()
      }
    }

    console.log('🔔 Toast notification preferences updated:', this.preferences)
  }

  /**
   * Check if notifications should be shown (Do Not Disturb mode)
   */
  private shouldShowNotification(): boolean {
    if (!this.preferences.enabled) return false
    if (!this.preferences.doNotDisturb.enabled) return true

    const now = new Date()
    const currentTime = now.getHours() * 100 + now.getMinutes()

    const startTime = this.parseTime(this.preferences.doNotDisturb.startTime)
    const endTime = this.parseTime(this.preferences.doNotDisturb.endTime)

    // Handle overnight DND (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return !(currentTime >= startTime || currentTime <= endTime)
    } else {
      return !(currentTime >= startTime && currentTime <= endTime)
    }
  }

  /**
   * Parse time string to minutes since midnight
   */
  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 100 + minutes
  }

  /**
   * Load user notification preferences
   */
  private async loadUserPreferences(userId: string): Promise<void> {
    try {
      // Try to load from localStorage first (fast)
      const stored = localStorage.getItem('toast_notification_preferences')
      if (stored) {
        this.preferences = { ...this.preferences, ...JSON.parse(stored) }
      }

      // TODO: In future, sync with Supabase user_settings table
      // For now, we'll use localStorage only to keep it simple

    } catch (error) {
      console.warn('Failed to load toast notification preferences:', error)
    }
  }

  /**
   * Set up tab visibility tracking
   */
  private setupVisibilityTracking(): void {
    document.addEventListener('visibilitychange', () => {
      const wasVisible = this.isTabVisible
      this.isTabVisible = !document.hidden

      // If tab becomes visible and we have pending notifications, show them
      if (!wasVisible && this.isTabVisible && this.pendingNotifications.length > 0) {
        console.log(`🔔 Tab visible again, showing ${this.pendingNotifications.length} pending notifications`)

        // Show notifications with a small delay to avoid overwhelming
        this.pendingNotifications.forEach((notification, index) => {
          setTimeout(() => {
            this.showNotification(notification)
          }, index * 500) // Stagger by 500ms
        })

        this.pendingNotifications = []
      }
    })
  }

  /**
   * Set up real-time monitoring for new records
   */
  private async setupRealtimeMonitoring(): Promise<void> {
    try {
      console.log('🔔 Setting up real-time monitoring for new records...')

      // Monitor calls table for new records
      this.callsChannel = supabase
        .channel('toast_calls_monitor')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'calls'
          },
          (payload) => {
            this.handleNewCall(payload.new as any)
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Toast notifications active for calls')
          }
        })

      // Monitor SMS table for new records
      this.smsChannel = supabase
        .channel('toast_sms_monitor')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chats'
          },
          (payload) => {
            this.handleNewSMS(payload.new as any)
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Toast notifications active for SMS')
          }
        })

    } catch (error) {
      console.error('Failed to set up real-time monitoring:', error)
    }
  }

  /**
   * Stop real-time monitoring
   */
  private stopRealtimeMonitoring(): void {
    if (this.callsChannel) {
      supabase.removeChannel(this.callsChannel)
      this.callsChannel = null
    }

    if (this.smsChannel) {
      supabase.removeChannel(this.smsChannel)
      this.smsChannel = null
    }

    console.log('🔔 Real-time monitoring stopped')
  }

  /**
   * Handle new call record
   */
  private handleNewCall(callRecord: any): void {
    if (!this.shouldShowNotification()) return

    // Only show notifications for records created in the last 5 minutes
    const recordTime = new Date(callRecord.start_timestamp || callRecord.created_at || Date.now())
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)

    if (recordTime.getTime() < fiveMinutesAgo) {
      console.log(`🔔 Skipping notification for old call record: ${callRecord.call_id} (created ${recordTime.toISOString()})`)
      return
    }

    const notificationId = `call_${callRecord.call_id}_${Date.now()}`

    // Check for recent duplicates
    if (this.isDuplicate(notificationId, callRecord.call_id)) return

    const notification: ToastNotificationData = {
      id: notificationId,
      type: 'call',
      title: 'New Call Record Received',
      timestamp: recordTime,
      recordId: callRecord.call_id
    }

    this.processNotification(notification)
  }

  /**
   * Handle new SMS record
   */
  private handleNewSMS(smsRecord: any): void {
    if (!this.shouldShowNotification()) return

    // Only show notifications for records created in the last 5 minutes
    const recordTime = new Date(smsRecord.created_at || Date.now())
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)

    if (recordTime.getTime() < fiveMinutesAgo) {
      console.log(`🔔 Skipping notification for old SMS record: ${smsRecord.chat_id} (created ${recordTime.toISOString()})`)
      return
    }

    const notificationId = `sms_${smsRecord.chat_id}_${Date.now()}`

    // Check for recent duplicates
    if (this.isDuplicate(notificationId, smsRecord.chat_id)) return

    const notification: ToastNotificationData = {
      id: notificationId,
      type: 'sms',
      title: 'New SMS Record Received',
      timestamp: recordTime,
      recordId: smsRecord.chat_id
    }

    this.processNotification(notification)
  }

  /**
   * Check if notification is a duplicate
   */
  private isDuplicate(notificationId: string, recordId: string): boolean {
    const now = Date.now()
    const recentKey = `${recordId}`

    // Clean old entries
    for (const [key, timestamp] of this.recentNotifications.entries()) {
      if (now - timestamp > this.DEDUP_WINDOW) {
        this.recentNotifications.delete(key)
      }
    }

    // Check if we've seen this record recently
    if (this.recentNotifications.has(recentKey)) {
      console.log(`🔔 Duplicate notification filtered: ${recordId}`)
      return true
    }

    // Track this notification
    this.recentNotifications.set(recentKey, now)
    return false
  }

  /**
   * Process notification (show immediately or queue for later)
   */
  private processNotification(notification: ToastNotificationData): void {
    if (this.isTabVisible) {
      this.showNotification(notification)
    } else {
      // Queue for when tab becomes visible
      this.pendingNotifications.push(notification)
      console.log(`🔔 Notification queued (tab not visible): ${notification.title}`)
    }
  }

  /**
   * Show notification to all subscribers
   */
  private showNotification(notification: ToastNotificationData): void {
    console.log(`🔔 Showing notification: ${notification.title}`)

    this.callbacks.forEach(callback => {
      try {
        callback(notification)
      } catch (error) {
        console.error('Error in toast notification callback:', error)
      }
    })
  }

  /**
   * Get current preferences
   */
  getPreferences(): ToastNotificationPreferences {
    return { ...this.preferences }
  }

  /**
   * Test method to trigger a demo notification (for testing purposes)
   */
  triggerTestNotification(type: 'call' | 'sms'): void {
    const testNotification: ToastNotificationData = {
      id: `test_${type}_${Date.now()}`,
      type,
      title: type === 'call' ? 'New Call Record Received' : 'New SMS Record Received',
      timestamp: new Date(),
      recordId: `test_${type}_${Math.random().toString(36).substr(2, 9)}`
    }

    console.log('🧪 Toast service triggering test notification:', testNotification)
    this.showNotification(testNotification)
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopRealtimeMonitoring()
    this.callbacks.clear()
    this.recentNotifications.clear()
    this.pendingNotifications = []
    this.isInitialized = false
    console.log('🔔 Toast Notification Service cleaned up')
  }
}

// Export singleton instance
export const toastNotificationService = new ToastNotificationService()
export default toastNotificationService