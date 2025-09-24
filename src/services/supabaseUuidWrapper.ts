// Supabase UUID Wrapper Service
// Automatically converts between string IDs and UUIDs for database operations
// Maintains HIPAA compliance with audit logging and encryption

import { supabase } from '@/config/supabase'
import { UUIDMappingService } from '@/utils/uuidMapping'
import { auditLogger } from './auditLogger'
import { encryptPHI, decryptPHI } from './encryption'

// HIPAA-compliant logging with PHI redaction
function logSecureOperation(operation: string, userId: string, details?: any) {
  auditLogger.logUserAction(userId, operation, {
    ...details,
    // Redact sensitive information for HIPAA compliance
    email: details?.email ? '[REDACTED]' : undefined,
    name: details?.name ? '[REDACTED]' : undefined,
    encrypted_retell_api_key: details?.encrypted_retell_api_key ? '[REDACTED]' : undefined
  })
}

export class SupabaseUUIDWrapper {
  /**
   * Users table operations with UUID mapping
   */
  static users = {
    async findByStringId(stringId: string) {
      const uuid = UUIDMappingService.toUUID(stringId)

      // HIPAA-compliant audit logging
      logSecureOperation('USER_LOOKUP', stringId, { operation: 'findByStringId' })

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', uuid)
        .single()

      if (error) {
        console.error('User lookup failed:', error.message)
        logSecureOperation('USER_LOOKUP_FAILED', stringId, { error: error.message })
        return { data: null, error }
      }

      if (data) {
        // Convert UUID back to string ID for app compatibility
        data.id = UUIDMappingService.toStringID(data.id)

        // Decrypt any encrypted fields if present
        if (data.encrypted_retell_api_key) {
          try {
            data.decrypted_retell_api_key = decryptPHI(data.encrypted_retell_api_key)
          } catch (decryptError) {
            console.warn('Failed to decrypt API key for user:', stringId)
          }
        }

        logSecureOperation('USER_LOOKUP_SUCCESS', stringId, { hasApiKey: !!data.encrypted_retell_api_key })
      }

      return { data, error }
    },

    async findByEmail(email: string) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (data) {
        // Convert UUID back to string ID for app compatibility
        data.id = UUIDMappingService.toStringID(data.id)
      }

      return { data, error }
    },

    async upsert(userData: { id: string; email: string; name?: string; retell_api_key?: string; [key: string]: any }) {
      const uuid = UUIDMappingService.toUUID(userData.id)

      // HIPAA-compliant audit logging
      logSecureOperation('USER_UPSERT', userData.id, {
        operation: 'upsert',
        hasApiKey: !!userData.retell_api_key,
        hasEmail: !!userData.email
      })

      // Encrypt sensitive data before storing
      const encryptedUserData = { ...userData }
      if (userData.retell_api_key) {
        try {
          encryptedUserData.encrypted_retell_api_key = encryptPHI(userData.retell_api_key)
          delete encryptedUserData.retell_api_key // Remove plaintext version
        } catch (encryptError) {
          console.error('Failed to encrypt API key for user:', userData.id)
          logSecureOperation('ENCRYPTION_FAILED', userData.id, { error: 'API key encryption failed' })
          return { data: null, error: { message: 'Encryption failed' } }
        }
      }

      const { data, error } = await supabase
        .from('users')
        .upsert({
          ...encryptedUserData,
          id: uuid,
          updated_at: new Date().toISOString()
        })
        .select()

      if (error) {
        console.error('User upsert failed:', error.message)
        logSecureOperation('USER_UPSERT_FAILED', userData.id, { error: error.message })
        return { data: null, error }
      }

      if (data && data.length > 0) {
        // Convert UUID back to string ID
        data[0].id = UUIDMappingService.toStringID(data[0].id)

        // Decrypt API key for app use (but don't log it)
        if (data[0].encrypted_retell_api_key) {
          try {
            data[0].decrypted_retell_api_key = decryptPHI(data[0].encrypted_retell_api_key)
          } catch (decryptError) {
            console.warn('Failed to decrypt API key after upsert for user:', userData.id)
          }
        }

        logSecureOperation('USER_UPSERT_SUCCESS', userData.id, {
          hasApiKey: !!data[0].encrypted_retell_api_key
        })
      }

      return { data, error }
    },

    async update(stringId: string, updates: any) {
      const uuid = UUIDMappingService.toUUID(stringId)
      const { data, error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', uuid)
        .select()

      if (data && data.length > 0) {
        data[0].id = UUIDMappingService.toStringID(data[0].id)
      }

      return { data, error }
    }
  }

  /**
   * User profiles operations with UUID mapping
   */
  static userProfiles = {
    async findByStringId(stringId: string) {
      const uuid = UUIDMappingService.toUUID(stringId)
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', uuid)
        .single()

      if (data) {
        data.user_id = UUIDMappingService.toStringID(data.user_id)
      }

      return { data, error }
    },

    async upsert(profileData: { user_id: string; [key: string]: any }) {
      const uuid = UUIDMappingService.toUUID(profileData.user_id)
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          ...profileData,
          user_id: uuid,
          updated_at: new Date().toISOString()
        })
        .select()

      if (data && data.length > 0) {
        data[0].user_id = UUIDMappingService.toStringID(data[0].user_id)
      }

      return { data, error }
    }
  }

  /**
   * User settings operations with UUID mapping
   */
  static userSettings = {
    async findByStringId(stringId: string) {
      const uuid = UUIDMappingService.toUUID(stringId)
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', uuid)

      if (data) {
        data.forEach(setting => {
          setting.user_id = UUIDMappingService.toStringID(setting.user_id)
        })
      }

      return { data, error }
    },

    async upsert(settingData: { user_id: string; setting_key: string; setting_value: any }) {
      const uuid = UUIDMappingService.toUUID(settingData.user_id)
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({
          ...settingData,
          user_id: uuid,
          updated_at: new Date().toISOString()
        })
        .select()

      if (data && data.length > 0) {
        data.forEach(setting => {
          setting.user_id = UUIDMappingService.toStringID(setting.user_id)
        })
      }

      return { data, error }
    }
  }

  /**
   * Company settings operations
   */
  static companySettings = {
    async findById(id: string) {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', id)
        .single()

      return { data, error }
    },

    async upsert(settingData: { id: string; data: any }) {
      const { data, error } = await supabase
        .from('company_settings')
        .upsert({
          ...settingData,
          updated_at: new Date().toISOString()
        })
        .select()

      return { data, error }
    }
  }

  /**
   * Initialize required users in database with proper UUIDs
   * HIPAA-compliant with audit logging and secure defaults
   */
  static async initializeUsers() {
    const users = [
      {
        id: 'super-user-456',
        email: 'elmfarrell@yahoo.com',
        name: 'Super User',
        role: 'admin'
      },
      {
        id: 'pierre-user-789',
        email: 'pierre@phaetonai.com',
        name: 'Pierre',
        role: 'admin'
      },
      {
        id: 'guest-user-456',
        email: 'guest@email.com',
        name: 'Guest User',
        role: 'user'
      }
    ]

    console.log('🔧 Initializing users with HIPAA-compliant UUID mapping...')

    for (const user of users) {
      try {
        // Create user with audit logging
        const userResult = await this.users.upsert(user)
        if (userResult.error) {
          console.error(`Failed to initialize user ${user.id}:`, userResult.error.message)
          continue
        }

        // Create user profile with audit logging
        const profileResult = await this.userProfiles.upsert({
          user_id: user.id,
          theme: 'light',
          session_timeout: 15,
          mfa_enabled: true // Enable MFA by default for security
        })

        if (profileResult.error) {
          console.error(`Failed to initialize profile for ${user.id}:`, profileResult.error.message)
        }

        // Log successful initialization
        logSecureOperation('USER_INITIALIZATION', user.id, {
          role: user.role,
          mfa_enabled: true
        })

      } catch (error) {
        console.error(`Error initializing user ${user.id}:`, error)
        logSecureOperation('USER_INITIALIZATION_FAILED', user.id, {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log('✅ Users initialized with UUID mapping and HIPAA compliance')
  }

  /**
   * Get SQL commands to manually create users with proper UUIDs
   * For database initialization
   */
  static generateInitializationSQL(): string {
    const mappings = UUIDMappingService.getAllMappings()

    const sqlCommands = [
      '-- Initialize CareXPS users with proper UUID mapping',
      '-- HIPAA-compliant user creation with audit trail',
      '',
      `INSERT INTO users (id, email, name, role, created_at, updated_at) VALUES`,
      `('${mappings['super-user-456']}', 'elmfarrell@yahoo.com', 'Super User', 'admin', NOW(), NOW()),`,
      `('${mappings['pierre-user-789']}', 'pierre@phaetonai.com', 'Pierre', 'admin', NOW(), NOW()),`,
      `('${mappings['guest-user-456']}', 'guest@email.com', 'Guest User', 'user', NOW(), NOW())`,
      'ON CONFLICT (id) DO UPDATE SET updated_at = NOW();',
      '',
      '-- Create corresponding user profiles',
      'INSERT INTO user_profiles (user_id, created_at, updated_at) VALUES',
      `('${mappings['super-user-456']}', NOW(), NOW()),`,
      `('${mappings['pierre-user-789']}', NOW(), NOW()),`,
      `('${mappings['guest-user-456']}', NOW(), NOW())`,
      'ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW();',
      '',
      '-- Create default user settings (HIPAA-compliant)',
      'INSERT INTO user_settings (user_id, setting_key, setting_value, created_at, updated_at) VALUES',
      ...Object.entries(mappings).flatMap(([stringId, uuid]) => [
        `('${uuid}', 'theme', '"light"', NOW(), NOW()),`,
        `('${uuid}', 'session_timeout', '15', NOW(), NOW()),`,
        `('${uuid}', 'mfa_enabled', 'true', NOW(), NOW()),`
      ]).slice(0, -1).concat([
        Object.entries(mappings).slice(-1)[0] ? `('${Object.entries(mappings).slice(-1)[0][1]}', 'mfa_enabled', 'true', NOW(), NOW())` : ''
      ]),
      'ON CONFLICT (user_id, setting_key) DO UPDATE SET updated_at = NOW();'
    ]

    return sqlCommands.filter(cmd => cmd).join('\n')
  }
}

// Export convenience methods
export const {
  users: uuidUsers,
  userProfiles: uuidUserProfiles,
  userSettings: uuidUserSettings,
  companySettings: uuidCompanySettings
} = SupabaseUUIDWrapper