import { supabase, supabaseAdmin, hipaaConfig } from '@/config/supabase'
import { Database, ServiceResponse, PaginatedResponse } from '@/types/supabase'
import { encryptPHI, decryptPHI, encryptObjectFields, decryptObjectFields, createAuditEntry } from '@/utils/encryption'
import { connectionState, recordSupabaseSuccess, recordSupabaseFailure } from '@/utils/connectionState'
import { v4 as uuidv4 } from 'uuid'

type Tables = Database['public']['Tables']

/**
 * Base Supabase service with HIPAA compliance features
 */
export class SupabaseService {
  protected static async logSecurityEvent(
    action: string,
    resource: string,
    success: boolean,
    details: Record<string, any> = {},
    severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
  ): Promise<void> {
    try {
      await supabase.from('security_events').insert({
        action,
        resource,
        success,
        details,
        severity,
        ip_address: await this.getClientIP(),
        user_agent: navigator.userAgent
      })
    } catch (error) {
      recordSupabaseFailure(error)
      // Gracefully handle connection failures - don't spam the console
      if (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED'))) {
        // Silent fail when database is not available
        return
      }
      if (connectionState.shouldTrySupabase()) {
        console.log('Security event logging unavailable:', error instanceof Error ? error.message : 'Unknown error')
      }
    }
  }

  protected static async getClientIP(): Promise<string | null> {
    try {
      // In a real application, you might get this from a service or header
      return null // Placeholder - implement based on your infrastructure
    } catch {
      return null
    }
  }

  protected static async getCurrentUserId(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      // Get user ID from our users table using Azure AD ID
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('azure_ad_id', user.id)
        .single()

      return data?.id || null
    } catch {
      return null
    }
  }

  protected static handleError(error: any, action: string): ServiceResponse {
    console.error(`Supabase ${action} error:`, error)

    // Log security event for failed operations
    this.logSecurityEvent(action, 'database', false, { error: error.message }, 'medium')

    return {
      status: 'error',
      error: error.message || 'An unexpected error occurred'
    }
  }

  protected static async withAuditLog<T>(
    action: string,
    tableName: string,
    operation: () => Promise<T>,
    recordId?: string,
    oldData?: any,
    newData?: any
  ): Promise<T> {
    const userId = await this.getCurrentUserId()
    const startTime = Date.now()

    try {
      const result = await operation()

      // Log successful operation (graceful fallback for Supabase issues)
      if (userId) {
        try {
          await supabase.from('audit_logs').insert({
            user_id: userId,
            action,
            table_name: tableName,
            record_id: recordId,
            old_values: oldData,
            new_values: newData,
            ip_address: await this.getClientIP(),
            user_agent: navigator.userAgent,
            metadata: {
              duration_ms: Date.now() - startTime,
              success: true
            }
          })
        } catch (auditError) {
          // Gracefully handle audit logging failures - don't break the main operation
          if (auditError instanceof Error && (auditError.message.includes('Failed to fetch') || auditError.message.includes('ERR_CONNECTION_REFUSED'))) {
            // Silent fail when database is not available
          } else {
            console.log('Audit logging unavailable (operation succeeded):', auditError instanceof Error ? auditError.message : 'Unknown error')
          }
        }
      }

      return result
    } catch (error) {
      // Log failed operation (graceful fallback for Supabase issues)
      if (userId) {
        try {
          await supabase.from('audit_logs').insert({
            user_id: userId,
            action,
            table_name: tableName,
            record_id: recordId,
            metadata: {
              duration_ms: Date.now() - startTime,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          })
        } catch (auditError) {
          // Gracefully handle audit logging failures - don't break error reporting
          console.warn('Audit logging failed (operation failed):', auditError)
        }
      }

      throw error
    }
  }
}

/**
 * User management service
 */
export class UserService extends SupabaseService {
  static async createUser(azureAdId: string, userData: {
    email: string
    name: string
    role?: 'admin' | 'super_user' | 'healthcare_provider' | 'staff'
  }): Promise<ServiceResponse<Tables['users']['Row']>> {
    try {
      const { data, error } = await this.withAuditLog(
        'CREATE',
        'users',
        async () => {
          return await supabase
            .from('users')
            .insert({
              azure_ad_id: azureAdId,
              email: userData.email,
              name: userData.name,
              role: userData.role || 'staff'
            })
            .select()
            .single()
        }
      )

      if (error) throw error

      // Create default user settings
      await UserSettingsService.createDefaultSettings(data.id)

      await this.logSecurityEvent('USER_CREATED', 'users', true, { userId: data.id })

      return { status: 'success', data }
    } catch (error: any) {
      return this.handleError(error, 'createUser')
    }
  }

  static async getUserByAzureId(azureAdId: string): Promise<ServiceResponse<Tables['users']['Row'] | null>> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          user_permissions (
            resource,
            actions
          )
        `)
        .eq('azure_ad_id', azureAdId)
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      return { status: 'success', data: data || null }
    } catch (error: any) {
      return this.handleError(error, 'getUserByAzureId')
    }
  }

  static async updateLastLogin(userId: string): Promise<ServiceResponse<void>> {
    try {
      const { error } = await this.withAuditLog(
        'UPDATE',
        'users',
        async () => {
          return await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', userId)
        },
        userId
      )

      if (error) throw error

      await this.logSecurityEvent('USER_LOGIN', 'authentication', true, { userId })

      return { status: 'success' }
    } catch (error: any) {
      return this.handleError(error, 'updateLastLogin')
    }
  }
}

/**
 * User settings service with cross-device synchronization
 */
export class UserSettingsService extends SupabaseService {
  static async getUserSettings(userId: string): Promise<ServiceResponse<Tables['user_settings']['Row'] | null>> {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      return { status: 'success', data: data || null }
    } catch (error: any) {
      return this.handleError(error, 'getUserSettings')
    }
  }

  static async updateUserSettings(
    userId: string,
    settings: Partial<Tables['user_settings']['Update']>
  ): Promise<ServiceResponse<Tables['user_settings']['Row']>> {
    try {
      const { data: oldData } = await this.getUserSettings(userId)

      const { data, error } = await this.withAuditLog(
        'UPDATE',
        'user_settings',
        async () => {
          // Use upsert with conflict resolution to handle duplicates atomically
          const settingsToSave = {
            user_id: userId,
            ...settings,
            updated_at: new Date().toISOString(),
            last_synced: new Date().toISOString()
          }

          // First, try to clean up any existing duplicates in a transaction-safe way
          const { data: existingRows, error: checkError } = await supabase
            .from('user_settings')
            .select('id, created_at, updated_at')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })

          if (checkError) throw checkError

          if (existingRows && existingRows.length > 1) {
            console.log(`Found ${existingRows.length} duplicate rows for user ${userId}, cleaning up...`)

            // Keep the most recently updated row, delete the rest in a single operation
            const rowsToKeep = existingRows.slice(0, 1)
            const rowsToDelete = existingRows.slice(1)

            if (rowsToDelete.length > 0) {
              const idsToDelete = rowsToDelete.map(row => row.id)

              // Delete duplicates in a single query
              const { error: deleteError } = await supabase
                .from('user_settings')
                .delete()
                .in('id', idsToDelete)

              if (deleteError) {
                console.warn('Failed to delete some duplicates:', deleteError)
                // Continue with the update anyway
              } else {
                console.log(`Successfully cleaned up ${idsToDelete.length} duplicate user_settings rows for user ${userId}`)
              }
            }
          }

          // Now perform the update/insert with conflict resolution
          // Use upsert to handle the case where row might not exist
          const { data: upsertData, error: upsertError } = await supabase
            .from('user_settings')
            .upsert(settingsToSave, {
              onConflict: 'user_id',
              ignoreDuplicates: false
            })
            .select()

          if (upsertError) throw upsertError

          // If upsert returned multiple rows (shouldn't happen), take the first
          if (upsertData && upsertData.length > 0) {
            return upsertData[0]
          }

          // Fallback: if upsert didn't work as expected, try a regular update
          const { data: updateData, error: updateError } = await supabase
            .from('user_settings')
            .update(settingsToSave)
            .eq('user_id', userId)
            .select()
            .single()

          if (updateError) {
            // If update fails and it's because no rows exist, create default settings
            if (updateError.code === 'PGRST116') {
              console.log(`No existing settings found for user ${userId}, creating defaults...`)
              const defaultResponse = await this.createDefaultSettings(userId)
              if (defaultResponse.status === 'success') {
                // Now update with the requested settings
                const { data: finalData, error: finalError } = await supabase
                  .from('user_settings')
                  .update(settingsToSave)
                  .eq('user_id', userId)
                  .select()
                  .single()

                if (finalError) throw finalError
                return finalData
              } else {
                throw new Error('Failed to create default settings')
              }
            }
            throw updateError
          }

          return updateData
        },
        userId,
        oldData,
        settings
      )

      if (error) throw error

      await this.logSecurityEvent('SETTINGS_UPDATED', 'user_settings', true, { userId })

      return { status: 'success', data }
    } catch (error: any) {
      return this.handleError(error, 'updateUserSettings')
    }
  }

  static async createDefaultSettings(userId: string): Promise<ServiceResponse<Tables['user_settings']['Row']>> {
    try {
      // Use upsert to handle potential conflicts gracefully
      const defaultSettings = {
        user_id: userId,
        theme: 'light',
        notifications: {
          email: true,
          sms: false,
          push: true,
          in_app: true,
          call_alerts: true,
          sms_alerts: true,
          security_alerts: true
        },
        security_preferences: {
          session_timeout: hipaaConfig.sessionTimeoutMinutes,
          require_mfa: hipaaConfig.requireMFA,
          password_expiry_reminder: true,
          login_notifications: true
        },
        communication_preferences: {
          default_method: 'phone',
          auto_reply_enabled: false,
          business_hours: {
            enabled: true,
            start: '09:00',
            end: '17:00',
            timezone: 'UTC'
          }
        },
        accessibility_settings: {
          high_contrast: false,
          large_text: false,
          screen_reader: false,
          keyboard_navigation: false
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_synced: new Date().toISOString()
      }

      // First, try to clean up any existing rows for this user (safety measure)
      await this.cleanupDuplicateSettings(userId)

      // Use upsert to handle conflicts
      const { data, error } = await supabase
        .from('user_settings')
        .upsert(defaultSettings, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select()

      if (error) throw error

      // Return the first (and should be only) result
      const result = Array.isArray(data) ? data[0] : data
      if (!result) {
        throw new Error('Failed to create or retrieve default settings')
      }

      return { status: 'success', data: result }
    } catch (error: any) {
      return this.handleError(error, 'createDefaultSettings')
    }
  }

  /**
   * Clean up duplicate user settings entries for a user
   * This is a utility method to ensure data integrity
   */
  static async cleanupDuplicateSettings(userId: string): Promise<ServiceResponse<{ cleanedCount: number }>> {
    try {
      console.log(`Starting cleanup for duplicate user_settings entries for user: ${userId}`)

      // Get all rows for this user, ordered by updated_at desc
      const { data: existingRows, error: selectError } = await supabase
        .from('user_settings')
        .select('id, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (selectError) throw selectError

      if (!existingRows || existingRows.length <= 1) {
        console.log(`No duplicates found for user ${userId}`)
        return { status: 'success', data: { cleanedCount: 0 } }
      }

      console.log(`Found ${existingRows.length} user_settings rows for user ${userId}`)

      // Keep the most recent row, delete the rest
      const rowsToDelete = existingRows.slice(1)
      const idsToDelete = rowsToDelete.map(row => row.id)

      console.log(`Deleting ${idsToDelete.length} duplicate rows...`)

      // Delete duplicates in a single operation
      const { error: deleteError } = await supabase
        .from('user_settings')
        .delete()
        .in('id', idsToDelete)

      if (deleteError) {
        console.error('Error deleting duplicates:', deleteError)
        throw deleteError
      }

      console.log(`Successfully cleaned up ${idsToDelete.length} duplicate user_settings rows for user ${userId}`)

      return { status: 'success', data: { cleanedCount: idsToDelete.length } }
    } catch (error: any) {
      console.error('Error in cleanupDuplicateSettings:', error)
      return this.handleError(error, 'cleanupDuplicateSettings')
    }
  }

  /**
   * Update user settings with cross-device sync support
   * This method handles synchronization across multiple devices
   */
  static async updateUserSettingsSync(
    userId: string,
    settings: Partial<Tables['user_settings']['Update']>,
    skipLocalUpdate: boolean = false
  ): Promise<ServiceResponse<Tables['user_settings']['Row']>> {
    try {
      console.log(`Starting updateUserSettingsSync for user: ${userId}`)

      // First clean up any duplicates
      await this.cleanupDuplicateSettings(userId)

      // Get current settings
      const currentResponse = await this.getUserSettings(userId)
      if (currentResponse.status === 'error') {
        return currentResponse
      }

      const currentSettings = currentResponse.data

      // Merge settings intelligently
      const mergedSettings = this.mergeSettings(currentSettings || {}, settings)

      // Update settings using the enhanced updateUserSettings method
      const updateResponse = await this.updateUserSettings(userId, mergedSettings)

      if (updateResponse.status === 'success') {
        console.log(`Settings updated successfully for user: ${userId}`)

        // Update localStorage cache if not skipping local update
        if (!skipLocalUpdate) {
          const cacheKey = `user_settings_${userId}`
          localStorage.setItem(cacheKey, JSON.stringify({
            data: updateResponse.data,
            timestamp: Date.now()
          }))
        }

        await this.logSecurityEvent('SETTINGS_SYNCED', 'user_settings', true, { userId })
      }

      return updateResponse
    } catch (error: any) {
      console.error('Error in updateUserSettingsSync with duplicate protection:', error)
      return this.handleError(error, 'updateUserSettingsSync')
    }
  }

  /**
   * Merge settings objects with deep merge for nested objects
   */
  private static mergeSettings(currentSettings: any, newSettings: any): any {
    const merged = { ...currentSettings, ...newSettings }

    // Deep merge for nested objects
    if (currentSettings.notifications && newSettings.notifications) {
      merged.notifications = { ...currentSettings.notifications, ...newSettings.notifications }
    }

    if (currentSettings.security_preferences && newSettings.security_preferences) {
      merged.security_preferences = { ...currentSettings.security_preferences, ...newSettings.security_preferences }
    }

    if (currentSettings.communication_preferences && newSettings.communication_preferences) {
      merged.communication_preferences = { ...currentSettings.communication_preferences, ...newSettings.communication_preferences }
    }

    if (currentSettings.accessibility_settings && newSettings.accessibility_settings) {
      merged.accessibility_settings = { ...currentSettings.accessibility_settings, ...newSettings.accessibility_settings }
    }

    if (currentSettings.retell_config && newSettings.retell_config) {
      merged.retell_config = { ...currentSettings.retell_config, ...newSettings.retell_config }
    }

    return merged
  }
}

/**
 * Patient management service with PHI encryption
 */
export class PatientService extends SupabaseService {
  static async createPatient(patientData: {
    firstName: string
    lastName: string
    phone?: string
    email?: string
    preferences?: any
    tags?: string[]
  }): Promise<ServiceResponse<string>> {
    try {
      const userId = await this.getCurrentUserId()
      if (!userId) throw new Error('User not authenticated')

      // Encrypt PHI fields
      const encryptedData = {
        encrypted_first_name: encryptPHI(patientData.firstName),
        encrypted_last_name: encryptPHI(patientData.lastName),
        encrypted_phone: patientData.phone ? encryptPHI(patientData.phone) : null,
        encrypted_email: patientData.email ? encryptPHI(patientData.email) : null,
        preferences: patientData.preferences || {
          communication_method: 'phone',
          timezone: 'UTC'
        },
        tags: patientData.tags || [],
        created_by: userId
      }

      const { data, error } = await this.withAuditLog(
        'CREATE',
        'patients',
        async () => {
          return await supabase
            .from('patients')
            .insert(encryptedData)
            .select('id')
            .single()
        }
      )

      if (error) throw error

      await this.logSecurityEvent('PATIENT_CREATED', 'patients', true, { patientId: data.id })

      return { status: 'success', data: data.id }
    } catch (error: any) {
      return this.handleError(error, 'createPatient')
    }
  }

  static async getPatient(patientId: string): Promise<ServiceResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()

      if (error) throw error

      // Decrypt PHI fields
      const decryptedPatient = decryptObjectFields(
        data,
        {
          encrypted_first_name: 'firstName',
          encrypted_last_name: 'lastName',
          encrypted_phone: 'phone',
          encrypted_email: 'email'
        }
      )

      await this.logSecurityEvent('PATIENT_ACCESSED', 'patients', true, { patientId })

      return { status: 'success', data: decryptedPatient }
    } catch (error: any) {
      return this.handleError(error, 'getPatient')
    }
  }

  static async searchPatients(query: string, limit: number = 20): Promise<ServiceResponse<any[]>> {
    try {
      // Note: In a real implementation, you might want to implement
      // searchable encrypted fields using techniques like deterministic encryption
      // or secure search indexes for better performance

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('is_active', true)
        .limit(limit)

      if (error) throw error

      // Decrypt and filter on client side (not ideal for large datasets)
      const decryptedPatients = data
        .map(patient => {
          try {
            return decryptObjectFields(
              patient,
              {
                encrypted_first_name: 'firstName',
                encrypted_last_name: 'lastName',
                encrypted_phone: 'phone',
                encrypted_email: 'email'
              }
            )
          } catch {
            return null
          }
        })
        .filter(patient => {
          if (!patient) return false
          const searchText = query.toLowerCase()
          return (
            patient.firstName?.toLowerCase().includes(searchText) ||
            patient.lastName?.toLowerCase().includes(searchText) ||
            patient.phone?.includes(searchText) ||
            patient.email?.toLowerCase().includes(searchText)
          )
        })

      await this.logSecurityEvent('PATIENTS_SEARCHED', 'patients', true, {
        query: query.length > 0 ? '[REDACTED]' : '',
        resultCount: decryptedPatients.length
      })

      return { status: 'success', data: decryptedPatients }
    } catch (error: any) {
      return this.handleError(error, 'searchPatients')
    }
  }
}

/**
 * Session management service
 */
// Export call notes service
export { CallNotesService } from './callNotesService'

export class SessionService extends SupabaseService {
  static async createSession(
    userId: string,
    azureSessionId?: string,
    deviceInfo?: any
  ): Promise<ServiceResponse<string>> {
    try {
      const sessionToken = uuidv4()
      const expiresAt = new Date()
      expiresAt.setMinutes(expiresAt.getMinutes() + hipaaConfig.sessionTimeoutMinutes)

      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          session_token: sessionToken,
          azure_session_id: azureSessionId,
          expires_at: expiresAt.toISOString(),
          ip_address: await this.getClientIP(),
          user_agent: navigator.userAgent,
          device_info: deviceInfo || {}
        })
        .select('session_token')
        .single()

      if (error) throw error

      await this.logSecurityEvent('SESSION_CREATED', 'user_sessions', true, { userId })

      return { status: 'success', data: data.session_token }
    } catch (error: any) {
      return this.handleError(error, 'createSession')
    }
  }

  static async validateSession(sessionToken: string): Promise<ServiceResponse<boolean>> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .eq('is_active', true)
        .single()

      if (error || !data) {
        return { status: 'success', data: false }
      }

      // Check if session is expired
      const now = new Date()
      const expiresAt = new Date(data.expires_at)

      if (now > expiresAt) {
        // Mark session as inactive
        await supabase
          .from('user_sessions')
          .update({ is_active: false })
          .eq('session_token', sessionToken)

        return { status: 'success', data: false }
      }

      // Update last activity
      await supabase
        .from('user_sessions')
        .update({ last_activity: now.toISOString() })
        .eq('session_token', sessionToken)

      return { status: 'success', data: true }
    } catch (error: any) {
      return this.handleError(error, 'validateSession')
    }
  }

  static async invalidateSession(sessionToken: string): Promise<ServiceResponse<void>> {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('session_token', sessionToken)

      if (error) throw error

      await this.logSecurityEvent('SESSION_INVALIDATED', 'user_sessions', true)

      return { status: 'success' }
    } catch (error: any) {
      return this.handleError(error, 'invalidateSession')
    }
  }
}