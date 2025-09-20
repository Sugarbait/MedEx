import { supabase, supabaseAdmin, hipaaConfig } from '@/config/supabase'
import { Database, ServiceResponse, PaginatedResponse } from '@/types/supabase'
import { encryptPHI, decryptPHI, encryptObjectFields, decryptObjectFields, createAuditEntry } from '@/utils/encryption'
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
      console.error('Failed to log security event:', error)
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
          console.warn('Audit logging failed (operation succeeded):', auditError)
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
    role?: 'admin' | 'healthcare_provider' | 'staff'
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
          return await supabase
            .from('user_settings')
            .update({
              ...settings,
              updated_at: new Date().toISOString(),
              last_synced: new Date().toISOString()
            })
            .eq('user_id', userId)
            .select()
            .single()
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
      const { data, error } = await supabase
        .from('user_settings')
        .insert({
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
          }
        })
        .select()
        .single()

      if (error) throw error

      return { status: 'success', data }
    } catch (error: any) {
      return this.handleError(error, 'createDefaultSettings')
    }
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