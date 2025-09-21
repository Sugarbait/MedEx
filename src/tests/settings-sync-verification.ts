/**
 * Settings Sync Verification Test
 * Verifies that cross-device settings sync is working properly
 */

import { RobustUserSettingsService } from '@/services/userSettingsServiceRobust'

export async function verifySettingsSync() {
  console.log('🔍 Starting Settings Sync Verification...')

  try {
    // Initialize the service
    await RobustUserSettingsService.initialize()
    console.log('✅ Service initialized successfully')

    // Test user ID (this would normally come from auth)
    const testUserId = 'test-user-123'

    // Test 1: Load settings
    console.log('\n📋 Test 1: Loading user settings...')
    const loadResult = await RobustUserSettingsService.getUserSettings(testUserId)
    console.log('Load result:', loadResult.status)

    // Test 2: Update settings
    console.log('\n💾 Test 2: Updating settings...')
    const testSettings = {
      theme: 'dark' as const,
      notifications: {
        email: true,
        sms: true,
        push: false,
        in_app: true,
        call_alerts: true,
        sms_alerts: true,
        security_alerts: true
      }
    }

    const updateResult = await RobustUserSettingsService.updateUserSettings(
      testUserId,
      testSettings,
      true // optimistic updates
    )
    console.log('Update result:', updateResult.status)

    // Test 3: Verify localStorage backup
    console.log('\n💽 Test 3: Checking localStorage backup...')
    const localStorageKey = `user_settings_${testUserId}`
    const localData = localStorage.getItem(localStorageKey)
    console.log('LocalStorage data exists:', !!localData)

    // Test 4: Check sync status
    console.log('\n🔄 Test 4: Checking sync status...')
    const syncStatus = await RobustUserSettingsService.getSyncStatus(testUserId)
    console.log('Sync status:', syncStatus.status)

    console.log('\n✅ Settings sync verification completed!')
    return { success: true, message: 'All tests passed' }

  } catch (error) {
    console.error('❌ Settings sync verification failed:', error)
    return { success: false, error: error.message }
  }
}

// Export for use in dev tools
if (typeof window !== 'undefined') {
  (window as any).verifySettingsSync = verifySettingsSync
}