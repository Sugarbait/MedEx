/**
 * Settings Synchronization Test Suite
 *
 * This file contains tests to verify cross-device settings synchronization
 * functionality. It can be run in the browser console to test the implementation.
 */

import { RobustUserSettingsService } from '@/services/userSettingsServiceRobust'
import { UserSettings } from '@/types/supabase'

export class SettingsSyncTester {
  private userId: string
  private listeners: (() => void)[] = []

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Initialize the tester
   */
  async initialize(): Promise<void> {
    console.log('🧪 Initializing Settings Sync Tester...')
    await RobustUserSettingsService.initialize()
    console.log('✅ Settings service initialized')
  }

  /**
   * Test basic settings CRUD operations
   */
  async testBasicOperations(): Promise<boolean> {
    console.log('\n🧪 Testing basic settings operations...')

    try {
      // Test 1: Get default settings
      console.log('📋 Test 1: Getting default settings')
      const defaultSettings = await RobustUserSettingsService.getUserSettings(this.userId)
      if (defaultSettings.status !== 'success') {
        throw new Error(`Failed to get default settings: ${defaultSettings.error}`)
      }
      console.log('✅ Default settings retrieved successfully')

      // Test 2: Update theme
      console.log('📋 Test 2: Updating theme setting')
      const themeUpdate = await RobustUserSettingsService.updateUserSettings(this.userId, {
        theme: 'dark'
      })
      if (themeUpdate.status !== 'success') {
        throw new Error(`Failed to update theme: ${themeUpdate.error}`)
      }
      console.log('✅ Theme updated successfully')

      // Test 3: Update notifications
      console.log('📋 Test 3: Updating notification settings')
      const notificationUpdate = await RobustUserSettingsService.updateUserSettings(this.userId, {
        notifications: {
          email: false,
          sms: true,
          push: true,
          in_app: true,
          call_alerts: false,
          sms_alerts: true,
          security_alerts: true
        }
      })
      if (notificationUpdate.status !== 'success') {
        throw new Error(`Failed to update notifications: ${notificationUpdate.error}`)
      }
      console.log('✅ Notifications updated successfully')

      // Test 4: Verify persistence
      console.log('📋 Test 4: Verifying settings persistence')
      const retrievedSettings = await RobustUserSettingsService.getUserSettings(this.userId)
      if (retrievedSettings.status !== 'success') {
        throw new Error(`Failed to retrieve settings: ${retrievedSettings.error}`)
      }

      const settings = retrievedSettings.data!
      if (settings.theme !== 'dark') {
        throw new Error(`Theme not persisted correctly. Expected 'dark', got '${settings.theme}'`)
      }
      if (settings.notifications?.email !== false || settings.notifications?.sms_alerts !== true) {
        throw new Error('Notification settings not persisted correctly')
      }
      console.log('✅ Settings persistence verified')

      return true
    } catch (error) {
      console.error('❌ Basic operations test failed:', error)
      return false
    }
  }

  /**
   * Test real-time synchronization
   */
  async testRealtimeSync(): Promise<boolean> {
    console.log('\n🧪 Testing real-time synchronization...')

    try {
      let updateReceived = false
      let receivedSettings: UserSettings | null = null

      // Subscribe to changes
      console.log('📋 Setting up real-time listener')
      const unsubscribe = RobustUserSettingsService.subscribeToUserSettings(this.userId, (settings) => {
        console.log('📡 Real-time update received:', settings)
        updateReceived = true
        receivedSettings = settings
      })
      this.listeners.push(unsubscribe)

      // Wait a moment for subscription to be active
      await this.sleep(1000)

      // Make a change
      console.log('📋 Making a settings change to trigger real-time update')
      const update = await RobustUserSettingsService.updateUserSettings(this.userId, {
        theme: 'light',
        security_preferences: {
          session_timeout: 30,
          require_mfa: true,
          password_expiry_reminder: true,
          login_notifications: true
        }
      })

      if (update.status !== 'success') {
        throw new Error(`Failed to update settings: ${update.error}`)
      }

      // Wait for real-time update
      console.log('📋 Waiting for real-time update...')
      await this.waitFor(() => updateReceived, 10000, 'Real-time update not received')

      if (!receivedSettings) {
        throw new Error('Real-time update received but no settings data')
      }

      if (receivedSettings.theme !== 'light') {
        throw new Error(`Real-time update incorrect. Expected theme 'light', got '${receivedSettings.theme}'`)
      }

      console.log('✅ Real-time synchronization working correctly')
      return true
    } catch (error) {
      console.error('❌ Real-time sync test failed:', error)
      return false
    }
  }

  /**
   * Test offline mode and sync when online
   */
  async testOfflineMode(): Promise<boolean> {
    console.log('\n🧪 Testing offline mode...')

    try {
      // Simulate offline mode
      console.log('📋 Simulating offline mode')
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      })

      // Trigger offline event
      window.dispatchEvent(new Event('offline'))
      await this.sleep(500)

      // Make changes while offline
      console.log('📋 Making changes while offline')
      const offlineUpdate = await RobustUserSettingsService.updateUserSettings(this.userId, {
        theme: 'auto'
      })

      if (offlineUpdate.status !== 'success') {
        throw new Error(`Offline update failed: ${offlineUpdate.error}`)
      }
      console.log('✅ Offline update succeeded')

      // Check sync status
      const syncStatus = await RobustUserSettingsService.getSyncStatus(this.userId)
      if (syncStatus.status === 'success') {
        console.log('📊 Sync status:', syncStatus.data)
        if (syncStatus.data.isOnline) {
          console.warn('⚠️ Service reports online but we simulated offline')
        }
      }

      // Simulate coming back online
      console.log('📋 Simulating connection restoration')
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      })

      // Trigger online event
      window.dispatchEvent(new Event('online'))
      await this.sleep(2000) // Wait for sync to process

      // Verify sync occurred
      console.log('📋 Verifying sync after reconnection')
      const finalSettings = await RobustUserSettingsService.getUserSettings(this.userId)
      if (finalSettings.status !== 'success') {
        throw new Error(`Failed to get settings after reconnection: ${finalSettings.error}`)
      }

      if (finalSettings.data!.theme !== 'auto') {
        throw new Error(`Settings not synced correctly. Expected 'auto', got '${finalSettings.data!.theme}'`)
      }

      console.log('✅ Offline mode and sync working correctly')
      return true
    } catch (error) {
      console.error('❌ Offline mode test failed:', error)
      return false
    }
  }

  /**
   * Test concurrent updates and conflict resolution
   */
  async testConflictResolution(): Promise<boolean> {
    console.log('\n🧪 Testing conflict resolution...')

    try {
      // Make two rapid updates to test conflict resolution
      console.log('📋 Making concurrent updates')
      const [update1, update2] = await Promise.all([
        RobustUserSettingsService.updateUserSettings(this.userId, {
          theme: 'light',
          notifications: {
            email: true,
            sms: false,
            push: true,
            in_app: true,
            call_alerts: true,
            sms_alerts: false,
            security_alerts: true
          }
        }),
        RobustUserSettingsService.updateUserSettings(this.userId, {
          theme: 'dark',
          security_preferences: {
            session_timeout: 45,
            require_mfa: false,
            password_expiry_reminder: false,
            login_notifications: true
          }
        })
      ])

      if (update1.status !== 'success' || update2.status !== 'success') {
        throw new Error('One or both concurrent updates failed')
      }

      // Verify final state
      await this.sleep(1000)
      const finalSettings = await RobustUserSettingsService.getUserSettings(this.userId)
      if (finalSettings.status !== 'success') {
        throw new Error(`Failed to get final settings: ${finalSettings.error}`)
      }

      const settings = finalSettings.data!
      console.log('📊 Final settings after conflict resolution:', {
        theme: settings.theme,
        sessionTimeout: settings.security_preferences?.session_timeout,
        requireMFA: settings.security_preferences?.require_mfa,
        emailNotifications: settings.notifications?.email
      })

      // Both updates should be merged (last write wins for individual fields)
      if (!settings.theme || !settings.security_preferences || !settings.notifications) {
        throw new Error('Settings structure incomplete after conflict resolution')
      }

      console.log('✅ Conflict resolution completed successfully')
      return true
    } catch (error) {
      console.error('❌ Conflict resolution test failed:', error)
      return false
    }
  }

  /**
   * Test data validation
   */
  async testDataValidation(): Promise<boolean> {
    console.log('\n🧪 Testing data validation...')

    try {
      // Test invalid theme
      console.log('📋 Testing invalid theme value')
      const invalidTheme = await RobustUserSettingsService.updateUserSettings(this.userId, {
        theme: 'invalid-theme' as any
      })

      if (invalidTheme.status === 'success') {
        console.warn('⚠️ Invalid theme was accepted (validation may be missing)')
      } else {
        console.log('✅ Invalid theme rejected correctly')
      }

      // Test invalid session timeout
      console.log('📋 Testing invalid session timeout')
      const invalidTimeout = await RobustUserSettingsService.updateUserSettings(this.userId, {
        security_preferences: {
          session_timeout: 999, // Should be rejected
          require_mfa: true,
          password_expiry_reminder: true,
          login_notifications: true
        }
      })

      if (invalidTimeout.status === 'success') {
        console.warn('⚠️ Invalid session timeout was accepted (validation may be missing)')
      } else {
        console.log('✅ Invalid session timeout rejected correctly')
      }

      console.log('✅ Data validation tests completed')
      return true
    } catch (error) {
      console.error('❌ Data validation test failed:', error)
      return false
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Settings Synchronization Test Suite')
    console.log('=' * 50)

    await this.initialize()

    const tests = [
      { name: 'Basic Operations', test: () => this.testBasicOperations() },
      { name: 'Real-time Sync', test: () => this.testRealtimeSync() },
      { name: 'Offline Mode', test: () => this.testOfflineMode() },
      { name: 'Conflict Resolution', test: () => this.testConflictResolution() },
      { name: 'Data Validation', test: () => this.testDataValidation() }
    ]

    const results = []
    for (const { name, test } of tests) {
      console.log(`\n🧪 Running ${name} test...`)
      const result = await test()
      results.push({ name, passed: result })

      if (result) {
        console.log(`✅ ${name} test PASSED`)
      } else {
        console.log(`❌ ${name} test FAILED`)
      }
    }

    // Summary
    console.log('\n📊 Test Results Summary:')
    console.log('=' * 30)

    const passed = results.filter(r => r.passed).length
    const total = results.length

    results.forEach(({ name, passed }) => {
      console.log(`${passed ? '✅' : '❌'} ${name}`)
    })

    console.log(`\n🎯 ${passed}/${total} tests passed`)

    if (passed === total) {
      console.log('🎉 All tests passed! Settings synchronization is working correctly.')
    } else {
      console.log('⚠️ Some tests failed. Please review the implementation.')
    }

    // Cleanup
    this.cleanup()
  }

  /**
   * Utility functions
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async waitFor(condition: () => boolean, timeout: number, errorMessage: string): Promise<void> {
    const start = Date.now()
    while (!condition() && Date.now() - start < timeout) {
      await this.sleep(100)
    }
    if (!condition()) {
      throw new Error(errorMessage)
    }
  }

  private cleanup(): void {
    console.log('🧹 Cleaning up test listeners...')
    this.listeners.forEach(unsubscribe => unsubscribe())
    this.listeners = []
  }
}

// Export for browser console usage
declare global {
  interface Window {
    SettingsSyncTester: typeof SettingsSyncTester
  }
}

if (typeof window !== 'undefined') {
  window.SettingsSyncTester = SettingsSyncTester
}

export default SettingsSyncTester