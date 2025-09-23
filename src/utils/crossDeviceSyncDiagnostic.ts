/**
 * Cross-Device Sync Diagnostic Utility
 *
 * This utility helps diagnose why API keys and Agent IDs are not syncing across devices.
 * Run this in the browser console when experiencing sync issues.
 */

import { userSettingsService } from '@/services/userSettingsService'
import { supabaseConfig } from '@/config/supabase'
import { userProfileService } from '@/services/userProfileService'
import { secureStorage } from '@/services/secureStorage'

interface DiagnosticResult {
  timestamp: string
  userId: string | null
  issues: string[]
  recommendations: string[]
  dataFound: {
    supabaseConfigured: boolean
    userSettingsCache: boolean
    userProfileData: boolean
    secureStorageData: boolean
    localStorageData: boolean
  }
  apiKeys: {
    found: boolean
    sources: string[]
    retellApiKey: boolean
    callAgentId: boolean
    smsAgentId: boolean
  }
}

export class CrossDeviceSyncDiagnostic {

  /**
   * Run comprehensive diagnostic for cross-device sync issues
   */
  static async runDiagnostic(userId?: string): Promise<DiagnosticResult> {
    console.log('🔍 DIAGNOSTIC: Starting cross-device sync diagnostic...')

    const result: DiagnosticResult = {
      timestamp: new Date().toISOString(),
      userId: userId || null,
      issues: [],
      recommendations: [],
      dataFound: {
        supabaseConfigured: false,
        userSettingsCache: false,
        userProfileData: false,
        secureStorageData: false,
        localStorageData: false
      },
      apiKeys: {
        found: false,
        sources: [],
        retellApiKey: false,
        callAgentId: false,
        smsAgentId: false
      }
    }

    // Try to get current user if not provided
    if (!userId) {
      try {
        const currentUser = await secureStorage.getSessionData('current_user')
        if (currentUser?.id) {
          userId = currentUser.id
          result.userId = userId
          console.log('🔍 DIAGNOSTIC: Found user ID in secure storage:', userId)
        } else {
          result.issues.push('No user ID provided and none found in secure storage')
          result.recommendations.push('Ensure user is logged in before running diagnostic')
        }
      } catch (error) {
        result.issues.push('Failed to retrieve current user from secure storage')
      }
    }

    if (!userId) {
      console.log('❌ DIAGNOSTIC: Cannot proceed without user ID')
      return result
    }

    console.log(`🔍 DIAGNOSTIC: Running diagnostic for user: ${userId}`)

    // 1. Check Supabase configuration
    result.dataFound.supabaseConfigured = supabaseConfig.isConfigured()
    console.log(`🔍 DIAGNOSTIC: Supabase configured: ${result.dataFound.supabaseConfigured}`)

    if (!result.dataFound.supabaseConfigured) {
      result.issues.push('Supabase is not configured - this is the PRIMARY cause of cross-device sync failure')
      result.recommendations.push('Configure Supabase environment variables in .env.local with actual project credentials')
    }

    // 2. Check user settings cache
    try {
      const cachedSettings = await userSettingsService.getUserSettings(userId)
      if (cachedSettings) {
        result.dataFound.userSettingsCache = true
        console.log('🔍 DIAGNOSTIC: User settings cache exists')

        if (cachedSettings.retell_config) {
          result.apiKeys.found = true
          result.apiKeys.sources.push('userSettingsService')
          result.apiKeys.retellApiKey = !!cachedSettings.retell_config.api_key
          result.apiKeys.callAgentId = !!cachedSettings.retell_config.call_agent_id
          result.apiKeys.smsAgentId = !!cachedSettings.retell_config.sms_agent_id
          console.log('✅ DIAGNOSTIC: API keys found in user settings cache')
        }
      }
    } catch (error) {
      result.issues.push(`Failed to check user settings cache: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // 3. Check user profile service
    try {
      const profileResponse = await userProfileService.loadUserProfile(userId)
      if (profileResponse.status === 'success' && profileResponse.data) {
        result.dataFound.userProfileData = true
        console.log('🔍 DIAGNOSTIC: User profile data exists')

        if (profileResponse.data.settings) {
          const profileSettings = profileResponse.data.settings
          if (profileSettings.retellApiKey || profileSettings.callAgentId) {
            result.apiKeys.found = true
            result.apiKeys.sources.push('userProfileService')
            result.apiKeys.retellApiKey = result.apiKeys.retellApiKey || !!profileSettings.retellApiKey
            result.apiKeys.callAgentId = result.apiKeys.callAgentId || !!profileSettings.callAgentId
            result.apiKeys.smsAgentId = result.apiKeys.smsAgentId || !!profileSettings.smsAgentId
            console.log('✅ DIAGNOSTIC: API keys found in user profile service')
          }
        }
      }
    } catch (error) {
      result.issues.push(`Failed to check user profile service: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // 4. Check secure storage
    try {
      const secureSettings = await secureStorage.getUserPreference('user_settings', null)
      if (secureSettings) {
        result.dataFound.secureStorageData = true
        console.log('🔍 DIAGNOSTIC: Secure storage data exists')

        if (secureSettings.retell_config) {
          result.apiKeys.found = true
          result.apiKeys.sources.push('secureStorage')
          result.apiKeys.retellApiKey = result.apiKeys.retellApiKey || !!secureSettings.retell_config.api_key
          result.apiKeys.callAgentId = result.apiKeys.callAgentId || !!secureSettings.retell_config.call_agent_id
          result.apiKeys.smsAgentId = result.apiKeys.smsAgentId || !!secureSettings.retell_config.sms_agent_id
          console.log('✅ DIAGNOSTIC: API keys found in secure storage')
        }
      }
    } catch (error) {
      result.issues.push(`Failed to check secure storage: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // 5. Check local storage
    try {
      const localSettings = localStorage.getItem(`user_settings_${userId}`)
      if (localSettings) {
        result.dataFound.localStorageData = true
        console.log('🔍 DIAGNOSTIC: Local storage data exists')

        const parsed = JSON.parse(localSettings)
        if (parsed.retell_config) {
          result.apiKeys.found = true
          result.apiKeys.sources.push('localStorage')
          result.apiKeys.retellApiKey = result.apiKeys.retellApiKey || !!parsed.retell_config.api_key
          result.apiKeys.callAgentId = result.apiKeys.callAgentId || !!parsed.retell_config.call_agent_id
          result.apiKeys.smsAgentId = result.apiKeys.smsAgentId || !!parsed.retell_config.sms_agent_id
          console.log('✅ DIAGNOSTIC: API keys found in local storage')
        }
      }
    } catch (error) {
      result.issues.push(`Failed to check local storage: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Generate recommendations based on findings
    if (!result.apiKeys.found) {
      result.issues.push('No API keys found in any storage location')
      result.recommendations.push('Configure API keys in the Settings page and ensure they are saved')
    } else {
      console.log(`✅ DIAGNOSTIC: API keys found in sources: ${result.apiKeys.sources.join(', ')}`)
    }

    if (result.dataFound.supabaseConfigured && !result.dataFound.userSettingsCache) {
      result.issues.push('Supabase is configured but no settings data found')
      result.recommendations.push('Check Supabase connection and ensure user_settings table exists')
    }

    if (!result.dataFound.supabaseConfigured && result.apiKeys.sources.length > 0) {
      result.recommendations.push('API keys exist locally but cannot sync across devices without Supabase configuration')
    }

    // Log summary
    console.log('📊 DIAGNOSTIC SUMMARY:')
    console.log('  Issues found:', result.issues.length)
    console.log('  API keys found:', result.apiKeys.found)
    console.log('  Data sources available:', Object.entries(result.dataFound).filter(([_, exists]) => exists).map(([key, _]) => key))
    console.log('  Recommendations:', result.recommendations.length)

    return result
  }

  /**
   * Attempt to recover API keys from available sources
   */
  static async attemptRecovery(userId: string): Promise<{ success: boolean; message: string; apiKeys?: any }> {
    console.log('🔧 RECOVERY: Attempting to recover API keys for user:', userId)

    try {
      const diagnostic = await this.runDiagnostic(userId)

      if (!diagnostic.apiKeys.found) {
        return {
          success: false,
          message: 'No API keys found in any storage location. Please configure them in Settings.'
        }
      }

      // Try to consolidate API keys from all sources
      let recoveredApiKeys: any = {}

      // Check each source and merge data
      for (const source of diagnostic.apiKeys.sources) {
        try {
          switch (source) {
            case 'userProfileService':
              const profileResponse = await userProfileService.loadUserProfile(userId)
              if (profileResponse.status === 'success' && profileResponse.data?.settings) {
                const settings = profileResponse.data.settings
                recoveredApiKeys = {
                  retellApiKey: recoveredApiKeys.retellApiKey || settings.retellApiKey,
                  callAgentId: recoveredApiKeys.callAgentId || settings.callAgentId,
                  smsAgentId: recoveredApiKeys.smsAgentId || settings.smsAgentId
                }
              }
              break

            case 'secureStorage':
              const secureSettings = await secureStorage.getUserPreference('user_settings', null)
              if (secureSettings?.retell_config) {
                recoveredApiKeys = {
                  retellApiKey: recoveredApiKeys.retellApiKey || secureSettings.retell_config.api_key,
                  callAgentId: recoveredApiKeys.callAgentId || secureSettings.retell_config.call_agent_id,
                  smsAgentId: recoveredApiKeys.smsAgentId || secureSettings.retell_config.sms_agent_id
                }
              }
              break

            case 'localStorage':
              const localSettings = localStorage.getItem(`user_settings_${userId}`)
              if (localSettings) {
                const parsed = JSON.parse(localSettings)
                if (parsed.retell_config) {
                  recoveredApiKeys = {
                    retellApiKey: recoveredApiKeys.retellApiKey || parsed.retell_config.api_key,
                    callAgentId: recoveredApiKeys.callAgentId || parsed.retell_config.call_agent_id,
                    smsAgentId: recoveredApiKeys.smsAgentId || parsed.retell_config.sms_agent_id
                  }
                }
              }
              break
          }
        } catch (sourceError) {
          console.warn(`⚠️ RECOVERY: Failed to recover from ${source}:`, sourceError)
        }
      }

      // Update user settings with recovered keys
      if (recoveredApiKeys.retellApiKey || recoveredApiKeys.callAgentId) {
        try {
          const updatedSettings = await userSettingsService.updateUserSettings(userId, {
            retell_config: {
              api_key: recoveredApiKeys.retellApiKey,
              call_agent_id: recoveredApiKeys.callAgentId,
              sms_agent_id: recoveredApiKeys.smsAgentId
            }
          })

          console.log('✅ RECOVERY: API keys successfully recovered and saved')
          return {
            success: true,
            message: 'API keys recovered and saved for future cross-device access',
            apiKeys: recoveredApiKeys
          }
        } catch (saveError) {
          return {
            success: false,
            message: `API keys found but could not be saved: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`,
            apiKeys: recoveredApiKeys
          }
        }
      }

      return {
        success: false,
        message: 'No valid API keys could be recovered from available sources'
      }

    } catch (error) {
      return {
        success: false,
        message: `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Provide configuration guidance
   */
  static getConfigurationGuidance(): { supabase: string[]; environment: string[]; troubleshooting: string[] } {
    return {
      supabase: [
        '1. Create a Supabase project at https://supabase.com',
        '2. Go to Settings > API in your Supabase dashboard',
        '3. Copy the Project URL and anon/public key',
        '4. Update .env.local with actual values:',
        '   VITE_SUPABASE_URL=https://your-project-id.supabase.co',
        '   VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here',
        '5. Restart the development server'
      ],
      environment: [
        '1. Ensure .env.local exists in the project root',
        '2. Replace all placeholder values with actual credentials',
        '3. Never commit .env.local to version control',
        '4. In production, set environment variables in your hosting platform',
        '5. Verify environment variables are loaded with: console.log(import.meta.env)'
      ],
      troubleshooting: [
        '1. Check browser console for "Supabase offline mode active" messages',
        '2. Verify network connectivity to Supabase',
        '3. Ensure user_settings table exists in Supabase',
        '4. Check if user has proper permissions in Supabase RLS policies',
        '5. Try clearing localStorage and logging in again',
        '6. Use this diagnostic tool to identify specific issues'
      ]
    }
  }
}

// Make it available globally for browser console debugging
if (typeof window !== 'undefined') {
  (window as any).crossDeviceSyncDiagnostic = CrossDeviceSyncDiagnostic
  console.log('🔍 Cross-device sync diagnostic available at: window.crossDeviceSyncDiagnostic')
  console.log('📖 Usage: await window.crossDeviceSyncDiagnostic.runDiagnostic()')
  console.log('🔧 Recovery: await window.crossDeviceSyncDiagnostic.attemptRecovery("user-id")')
}