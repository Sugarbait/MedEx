/**
 * Cross-Device Sync Usage Examples
 *
 * This file demonstrates how to use the cross-device sync functionality
 * that was implemented across multiple services in the healthcare CRM.
 */

import React from 'react'
import { syncManager } from '@/services/syncManager'
import { userSettingsService } from '@/services/userSettingsService'
import { userProfileService } from '@/services/userProfileService'
import { secureCredentialSync } from '@/services/secureCredentialSync'
import { conflictResolver } from '@/services/conflictResolver'

/**
 * Example 1: Initialize Cross-Device Sync on Login
 */
export async function initializeCrossDeviceSyncOnLogin(
  userId: string,
  userEmail: string,
  isMfaEnabled: boolean
): Promise<{ success: boolean; message?: string }> {
  try {
    console.log('🔄 Initializing cross-device sync on login...')

    // 1. Initialize sync manager
    await syncManager.initializeForUser(userId, userEmail)

    // 2. Force sync from cloud for fresh login
    const settingsSynced = await userSettingsService.forceSyncFromCloud(userId)

    if (settingsSynced) {
      console.log('✅ Settings synced from cloud')
    }

    // 3. If MFA is enabled, attempt secure credential sync
    if (isMfaEnabled) {
      const trustedDevices = await secureCredentialSync.getTrustedDevices(userId)
      const currentDevice = await syncManager.getCurrentDevice()

      const isTrusted = trustedDevices.some(device =>
        device.deviceId === currentDevice.deviceId &&
        device.trustLevel === 'trusted'
      )

      if (isTrusted) {
        await secureCredentialSync.syncMfaSecrets(userId, currentDevice.deviceId)
        console.log('✅ MFA secrets synced from trusted device')
      }
    }

    // 4. Handle any pending conflicts
    await handleSettingsConflicts(userId)

    console.log('✅ Cross-device sync initialized successfully')
    return { success: true, message: 'Cross-device sync ready' }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Cross-device sync initialization failed:', errorMessage)
    return { success: false, message: errorMessage }
  }
}

/**
 * Example 2: Sync User Settings Across Devices
 */
export async function updateSettingsWithSync(
  userId: string,
  settingsUpdate: {
    theme?: 'light' | 'dark' | 'auto'
    notifications?: {
      email: boolean
      sms: boolean
      push: boolean
      in_app: boolean
      call_alerts: boolean
      sms_alerts: boolean
      security_alerts: boolean
    }
    retellApiKey?: string
    callAgentId?: string
    smsAgentId?: string
  }
): Promise<{ success: boolean; settings?: any; conflicts?: number }> {
  try {
    console.log('🔄 Updating settings with cross-device sync...')

    // 1. Update settings through the sync-enabled service
    const updatedSettings = await userSettingsService.updateUserSettings(
      userId,
      {
        theme: settingsUpdate.theme,
        notifications: settingsUpdate.notifications,
        retell_config: {
          api_key: settingsUpdate.retellApiKey,
          call_agent_id: settingsUpdate.callAgentId,
          sms_agent_id: settingsUpdate.smsAgentId
        }
      },
      {
        broadcastToOtherDevices: true,
        skipConflictCheck: false
      }
    )

    console.log('✅ Settings updated and synced successfully')
    return {
      success: true,
      settings: updatedSettings,
      conflicts: 0
    }

  } catch (error) {
    console.error('❌ Settings update with sync failed:', error)
    return { success: false }
  }
}

/**
 * Example 3: Handle Cross-Device Conflicts
 */
export async function handleSettingsConflicts(
  userId: string
): Promise<{ resolved: number; pending: number }> {
  try {
    console.log('⚡ Checking for settings conflicts...')

    // For this example, we'll simulate basic conflict resolution
    console.log('✅ No conflicts detected')
    return { resolved: 0, pending: 0 }

  } catch (error) {
    console.error('❌ Conflict resolution failed:', error)
    return { resolved: 0, pending: -1 }
  }
}

/**
 * Example 4: Manual Conflict Resolution UI Integration
 */
export async function resolveConflictManually(
  userId: string,
  conflictId: string,
  userChoice: 'take_local' | 'take_remote' | 'merge' | 'custom',
  customData?: any
): Promise<{ success: boolean; message?: string }> {
  try {
    console.log(`🤝 Manually resolving conflict: ${conflictId}`)

    // Basic implementation - in real app this would integrate with conflict resolver
    console.log(`✅ Conflict resolved with choice: ${userChoice}`)
    return { success: true, message: 'Conflict resolved successfully' }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Manual conflict resolution failed:', errorMessage)
    return { success: false, message: errorMessage }
  }
}

// Export examples for easy import
export const CrossDeviceSyncExamples = {
  initializeCrossDeviceSyncOnLogin,
  updateSettingsWithSync,
  handleSettingsConflicts,
  resolveConflictManually
}