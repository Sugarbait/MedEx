/**
 * Hardcoded Retell AI API Credentials
 *
 * These credentials are permanently embedded in the system for bulletproof persistence.
 * They serve as the ultimate fallback when all other storage methods fail.
 *
 * CRITICAL: These credentials are configured to work across all devices, users, and environments.
 */

export interface RetellCredentials {
  apiKey: string
  callAgentId: string
  smsAgentId: string
}

/**
 * Production Retell AI Credentials - HARDCODED FOR BULLETPROOF PERSISTENCE
 *
 * These values are permanently embedded and will ALWAYS be available regardless of:
 * - localStorage clearing
 * - User account changes
 * - Cross-device sync issues
 * - Cloud service outages
 * - Browser session resets
 */
export const HARDCODED_RETELL_CREDENTIALS: RetellCredentials = {
  // Retell AI API Key - Production Ready
  apiKey: 'key_c3f084f5ca67781070e188b47d7f',

  // Call Agent ID for voice interactions
  callAgentId: 'agent_447a1b9da540237693b0440df6',

  // SMS/Chat Agent ID for text-based interactions
  smsAgentId: 'agent_643486efd4b5a0e9d7e094ab99'
}

/**
 * Credential validation utility
 */
export function validateCredentials(credentials: Partial<RetellCredentials>): boolean {
  return !!(
    credentials.apiKey &&
    credentials.apiKey.startsWith('key_') &&
    credentials.callAgentId &&
    credentials.callAgentId.startsWith('agent_') &&
    credentials.smsAgentId &&
    credentials.smsAgentId.startsWith('agent_')
  )
}

/**
 * Get bulletproof credentials with validation
 */
export function getBulletproofCredentials(): RetellCredentials {
  // Always return the hardcoded credentials as they are guaranteed to be valid
  const credentials = { ...HARDCODED_RETELL_CREDENTIALS }

  // Validate before returning
  if (!validateCredentials(credentials)) {
    console.error('CRITICAL: Hardcoded credentials failed validation!')
    throw new Error('Hardcoded credentials are invalid - this should never happen')
  }

  console.log('🔐 Bulletproof credentials loaded successfully:', {
    apiKeyPrefix: credentials.apiKey.substring(0, 15) + '...',
    callAgentId: credentials.callAgentId,
    smsAgentId: credentials.smsAgentId
  })

  return credentials
}

/**
 * Backup credential storage keys for multi-layer persistence
 */
export const CREDENTIAL_STORAGE_KEYS = {
  // Primary storage locations
  LOCALSTORAGE_PREFIX: 'settings_',
  SESSION_BACKUP_KEY: 'retell_credentials_backup',
  MEMORY_BACKUP_KEY: '__retellCredentialsBackup',

  // Cloud storage keys
  SUPABASE_SYSTEM_DEFAULTS: 'system_retell_defaults',
  SUPABASE_USER_SETTINGS: 'user_settings',

  // Emergency recovery keys
  EMERGENCY_RECOVERY_KEY: '__emergencyRetellCredentials',
  FALLBACK_CONFIG_KEY: '__fallbackRetellConfig'
} as const

/**
 * Store credentials in multiple locations for maximum persistence
 */
export function storeCredentialsEverywhere(credentials: RetellCredentials): void {
  try {
    // Store in sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(CREDENTIAL_STORAGE_KEYS.SESSION_BACKUP_KEY, JSON.stringify({
        ...credentials,
        timestamp: Date.now(),
        source: 'hardcoded_persistence'
      }))
    }

    // Store in memory backup
    if (typeof window !== 'undefined') {
      (window as any)[CREDENTIAL_STORAGE_KEYS.MEMORY_BACKUP_KEY] = {
        ...credentials,
        timestamp: Date.now(),
        source: 'hardcoded_persistence'
      }
    }

    // Store in emergency recovery
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CREDENTIAL_STORAGE_KEYS.EMERGENCY_RECOVERY_KEY, JSON.stringify({
        ...credentials,
        timestamp: Date.now(),
        source: 'hardcoded_persistence'
      }))
    }

    console.log('✅ Credentials stored in all persistence layers')
  } catch (error) {
    console.warn('⚠️ Error storing credentials in some locations:', error)
  }
}

/**
 * Initialize hardcoded credential persistence on module load
 */
export function initializeCredentialPersistence(): void {
  const credentials = getBulletproofCredentials()
  storeCredentialsEverywhere(credentials)

  console.log('🚀 Hardcoded credential persistence initialized')
}

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  // Initialize after a short delay to ensure all systems are ready
  setTimeout(() => {
    try {
      initializeCredentialPersistence()
    } catch (error) {
      console.error('❌ Failed to auto-initialize credential persistence:', error)
    }
  }, 100)
}