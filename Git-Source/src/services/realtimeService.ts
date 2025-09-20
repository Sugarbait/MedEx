import { supabase } from '@/config/supabase'
import { RealtimeChannel, RealtimePayload, Database } from '@/types/supabase'
import { SupabaseService } from './supabaseService'

type Tables = Database['public']['Tables']

interface SubscriptionCallback<T = any> {
  (payload: RealtimePayload<T>): void
}

interface ChannelSubscription {
  channel: string
  table: string
  filter?: string
  callback: SubscriptionCallback
  unsubscribe: () => void
}

/**
 * Real-time subscription service for live data updates
 */
export class RealtimeService extends SupabaseService {
  private static subscriptions = new Map<string, ChannelSubscription[]>()
  private static channels = new Map<string, any>()
  private static connectionStatus: 'connected' | 'disconnected' | 'error' = 'disconnected'
  private static statusListeners: ((status: string) => void)[] = []

  /**
   * Initialize real-time connection
   */
  static initialize(): void {
    // Listen for connection status changes
    supabase.realtime.onOpen(() => {
      this.connectionStatus = 'connected'
      this.notifyStatusListeners('connected')
      console.log('Real-time connection established')
    })

    supabase.realtime.onClose(() => {
      this.connectionStatus = 'disconnected'
      this.notifyStatusListeners('disconnected')
      console.log('Real-time connection closed')
    })

    supabase.realtime.onError((error) => {
      this.connectionStatus = 'error'
      this.notifyStatusListeners('error')
      console.error('Real-time connection error:', error)
    })
  }

  /**
   * Get current connection status
   */
  static getConnectionStatus(): string {
    return this.connectionStatus
  }

  /**
   * Subscribe to connection status changes
   */
  static onStatusChange(callback: (status: string) => void): () => void {
    this.statusListeners.push(callback)
    return () => {
      const index = this.statusListeners.indexOf(callback)
      if (index > -1) {
        this.statusListeners.splice(index, 1)
      }
    }
  }

  private static notifyStatusListeners(status: string): void {
    this.statusListeners.forEach(callback => callback(status))
  }

  /**
   * Subscribe to user settings changes
   */
  static subscribeToUserSettings(
    userId: string,
    callback: SubscriptionCallback<Tables['user_settings']['Row']>
  ): () => void {
    const channelName = `user_settings_${userId}`

    return this.createSubscription(
      channelName,
      'user_settings',
      `user_id=eq.${userId}`,
      callback
    )
  }

  /**
   * Subscribe to active calls
   */
  static subscribeToActiveCalls(
    callback: SubscriptionCallback<Tables['calls']['Row']>
  ): () => void {
    return this.createSubscription(
      'active_calls',
      'calls',
      'status=eq.active',
      callback
    )
  }

  /**
   * Subscribe to user's calls
   */
  static subscribeToUserCalls(
    userId: string,
    callback: SubscriptionCallback<Tables['calls']['Row']>
  ): () => void {
    const channelName = `user_calls_${userId}`

    return this.createSubscription(
      channelName,
      'calls',
      `user_id=eq.${userId}`,
      callback
    )
  }

  /**
   * Subscribe to SMS messages for a specific thread
   */
  static subscribeToSMSThread(
    threadId: string,
    callback: SubscriptionCallback<Tables['sms_messages']['Row']>
  ): () => void {
    const channelName = `sms_thread_${threadId}`

    return this.createSubscription(
      channelName,
      'sms_messages',
      `thread_id=eq.${threadId}`,
      callback
    )
  }

  /**
   * Subscribe to security events for a user
   */
  static subscribeToSecurityEvents(
    userId: string,
    callback: SubscriptionCallback<Tables['security_events']['Row']>
  ): () => void {
    const channelName = `security_events_${userId}`

    return this.createSubscription(
      channelName,
      'security_events',
      `user_id=eq.${userId}`,
      callback
    )
  }

  /**
   * Subscribe to system-wide security events (admin only)
   */
  static subscribeToSystemSecurityEvents(
    callback: SubscriptionCallback<Tables['security_events']['Row']>
  ): () => void {
    return this.createSubscription(
      'system_security_events',
      'security_events',
      'severity=in.(high,critical)',
      callback
    )
  }

  /**
   * Subscribe to patient updates
   */
  static subscribeToPatientUpdates(
    patientId?: string,
    callback?: SubscriptionCallback<Tables['patients']['Row']>
  ): () => void {
    const channelName = patientId ? `patient_${patientId}` : 'all_patients'
    const filter = patientId ? `id=eq.${patientId}` : undefined

    return this.createSubscription(
      channelName,
      'patients',
      filter,
      callback!
    )
  }

  /**
   * Subscribe to audit logs (admin only)
   */
  static subscribeToAuditLogs(
    callback: SubscriptionCallback<Tables['audit_logs']['Row']>
  ): () => void {
    return this.createSubscription(
      'audit_logs',
      'audit_logs',
      undefined,
      callback
    )
  }

  /**
   * Create a generic subscription
   */
  private static createSubscription<T>(
    channelName: string,
    tableName: string,
    filter?: string,
    callback?: SubscriptionCallback<T>
  ): () => void {
    try {
      // Create or get existing channel
      let channel = this.channels.get(channelName)

      if (!channel) {
        channel = supabase.channel(channelName)
        this.channels.set(channelName, channel)
      }

      // Configure the subscription
      const config: any = {
        event: '*',
        schema: 'public',
        table: tableName
      }

      if (filter) {
        config.filter = filter
      }

      // Add the subscription to the channel
      channel.on('postgres_changes', config, (payload: RealtimePayload<T>) => {
        try {
          if (callback) {
            callback(payload)
          }
          this.logRealtimeEvent(tableName, payload.eventType, payload.new?.id || payload.old?.id)
        } catch (error) {
          console.error('Error in realtime callback:', error)
        }
      })

      // Subscribe to the channel
      channel.subscribe((status: string) => {
        console.log(`Subscription status for ${channelName}:`, status)
        if (status === 'SUBSCRIBED') {
          this.logSecurityEvent('REALTIME_SUBSCRIBED', 'realtime', true, {
            channel: channelName,
            table: tableName
          })
        }
      })

      // Track the subscription
      const subscription: ChannelSubscription = {
        channel: channelName,
        table: tableName,
        filter,
        callback: callback!,
        unsubscribe: () => this.unsubscribe(channelName, subscription)
      }

      if (!this.subscriptions.has(channelName)) {
        this.subscriptions.set(channelName, [])
      }
      this.subscriptions.get(channelName)!.push(subscription)

      // Return unsubscribe function
      return subscription.unsubscribe
    } catch (error) {
      console.error('Failed to create subscription:', error)
      return () => {} // Return empty function if subscription fails
    }
  }

  /**
   * Unsubscribe from a specific subscription
   */
  private static unsubscribe(channelName: string, subscription: ChannelSubscription): void {
    try {
      const subscriptions = this.subscriptions.get(channelName)
      if (subscriptions) {
        const index = subscriptions.indexOf(subscription)
        if (index > -1) {
          subscriptions.splice(index, 1)
        }

        // If no more subscriptions for this channel, remove the channel
        if (subscriptions.length === 0) {
          const channel = this.channels.get(channelName)
          if (channel) {
            supabase.removeChannel(channel)
            this.channels.delete(channelName)
          }
          this.subscriptions.delete(channelName)
        }
      }

      this.logSecurityEvent('REALTIME_UNSUBSCRIBED', 'realtime', true, {
        channel: channelName,
        table: subscription.table
      })
    } catch (error) {
      console.error('Failed to unsubscribe:', error)
    }
  }

  /**
   * Unsubscribe from all subscriptions
   */
  static unsubscribeAll(): void {
    try {
      // Remove all channels
      for (const [channelName, channel] of this.channels) {
        supabase.removeChannel(channel)
      }

      // Clear all tracking
      this.channels.clear()
      this.subscriptions.clear()

      this.logSecurityEvent('REALTIME_UNSUBSCRIBED_ALL', 'realtime', true)

      console.log('All real-time subscriptions removed')
    } catch (error) {
      console.error('Failed to unsubscribe from all:', error)
    }
  }

  /**
   * Get active subscriptions info
   */
  static getActiveSubscriptions(): Array<{
    channel: string
    table: string
    filter?: string
    subscriberCount: number
  }> {
    const info: Array<any> = []

    for (const [channelName, subscriptions] of this.subscriptions) {
      const firstSub = subscriptions[0]
      if (firstSub) {
        info.push({
          channel: channelName,
          table: firstSub.table,
          filter: firstSub.filter,
          subscriberCount: subscriptions.length
        })
      }
    }

    return info
  }

  /**
   * Create a multiplexed subscription for multiple users/resources
   */
  static createMultiplexedSubscription<T>(
    tableName: string,
    userIds: string[],
    callback: SubscriptionCallback<T & { user_id: string }>
  ): () => void {
    const channelName = `multiplexed_${tableName}_${userIds.sort().join('_')}`
    const filter = `user_id=in.(${userIds.join(',')})`

    return this.createSubscription(channelName, tableName, filter, callback)
  }

  /**
   * Subscribe with retry logic for unreliable connections
   */
  static subscribeWithRetry<T>(
    channelName: string,
    tableName: string,
    callback: SubscriptionCallback<T>,
    maxRetries: number = 3,
    retryDelay: number = 5000
  ): () => void {
    let retryCount = 0
    let unsubscribe: (() => void) | null = null

    const attemptSubscription = () => {
      try {
        unsubscribe = this.createSubscription(channelName, tableName, undefined, callback)
      } catch (error) {
        console.error(`Subscription attempt ${retryCount + 1} failed:`, error)

        if (retryCount < maxRetries) {
          retryCount++
          setTimeout(attemptSubscription, retryDelay)
        } else {
          console.error('Max subscription retries reached')
        }
      }
    }

    attemptSubscription()

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }

  /**
   * Batch subscribe to multiple resources
   */
  static batchSubscribe(subscriptions: Array<{
    channelName: string
    tableName: string
    filter?: string
    callback: SubscriptionCallback
  }>): () => void {
    const unsubscribeFunctions = subscriptions.map(sub =>
      this.createSubscription(sub.channelName, sub.tableName, sub.filter, sub.callback)
    )

    return () => {
      unsubscribeFunctions.forEach(unsub => unsub())
    }
  }

  /**
   * Log real-time events for monitoring
   */
  private static async logRealtimeEvent(
    tableName: string,
    eventType: string,
    recordId?: string
  ): Promise<void> {
    try {
      // Only log if in development mode or for critical events
      if (process.env.NODE_ENV === 'development') {
        console.log(`Realtime event: ${eventType} on ${tableName}`, recordId)
      }

      // Log security-sensitive events
      if (['security_events', 'audit_logs', 'users'].includes(tableName)) {
        await this.logSecurityEvent('REALTIME_EVENT', 'realtime', true, {
          table: tableName,
          event: eventType,
          recordId: recordId || '[UNKNOWN]'
        })
      }
    } catch (error) {
      console.error('Failed to log realtime event:', error)
    }
  }

  /**
   * Health check for real-time connection
   */
  static async healthCheck(): Promise<{
    status: string
    channelCount: number
    subscriptionCount: number
    lastHeartbeat?: Date
  }> {
    const channelCount = this.channels.size
    const subscriptionCount = Array.from(this.subscriptions.values())
      .reduce((total, subs) => total + subs.length, 0)

    return {
      status: this.connectionStatus,
      channelCount,
      subscriptionCount,
      lastHeartbeat: new Date() // In a real implementation, track actual heartbeat
    }
  }

  /**
   * Force reconnection
   */
  static async reconnect(): Promise<void> {
    try {
      // Disconnect and reconnect
      await supabase.realtime.disconnect()
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
      await supabase.realtime.connect()

      this.logSecurityEvent('REALTIME_RECONNECTED', 'realtime', true)
    } catch (error) {
      console.error('Failed to reconnect realtime:', error)
      this.logSecurityEvent('REALTIME_RECONNECT_FAILED', 'realtime', false, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
}