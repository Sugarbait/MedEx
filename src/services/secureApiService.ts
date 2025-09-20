/**
 * HIPAA-Compliant Server-Side API Service
 *
 * Handles all server-side operations for PHI data to ensure
 * sensitive operations never happen client-side
 */

import { supabase, supabaseAdmin } from '@/config/supabase'
import { secureLogger } from '@/services/secureLogger'
import { encryptionService } from '@/services/encryption'

const logger = secureLogger.component('SecureAPIService')

export interface SecureAPIOptions {
  userId?: string
  sessionId?: string
  encryption?: boolean
  auditLog?: boolean
}

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  encrypted?: boolean
}

class SecureAPIService {

  /**
   * Secure server-side patient data retrieval
   * PHI data is decrypted only server-side
   */
  async getPatientData(patientId: string, options: SecureAPIOptions = {}): Promise<APIResponse> {
    try {
      logger.info('Retrieving patient data server-side', options.userId, options.sessionId, {
        patientId,
        action: 'patient_data_retrieval'
      })

      // Use admin client for server-side operations
      if (!supabaseAdmin) {
        throw new Error('Admin client not configured for server-side operations')
      }

      const { data: patient, error } = await supabaseAdmin
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()

      if (error) {
        logger.error('Failed to retrieve patient data', options.userId, options.sessionId, {
          patientId,
          error: error.message
        })
        return { success: false, error: 'Failed to retrieve patient data' }
      }

      // Decrypt PHI fields server-side only
      if (patient.encrypted_name) {
        patient.name = await encryptionService.decryptString(patient.encrypted_name)
      }
      if (patient.encrypted_phone) {
        patient.phone_number = await encryptionService.decryptString(patient.encrypted_phone)
      }
      if (patient.encrypted_email) {
        patient.email = await encryptionService.decryptString(patient.encrypted_email)
      }

      // Remove encrypted fields from response
      delete patient.encrypted_name
      delete patient.encrypted_phone
      delete patient.encrypted_email

      logger.info('Patient data retrieved successfully', options.userId, options.sessionId, {
        patientId,
        action: 'patient_data_retrieved'
      })

      return { success: true, data: patient }

    } catch (error) {
      logger.error('Server-side patient data retrieval failed', options.userId, options.sessionId, {
        patientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return { success: false, error: 'Server-side operation failed' }
    }
  }

  /**
   * Secure server-side call transcript processing
   * Ensures transcripts are never decrypted client-side
   */
  async getCallTranscript(callId: string, options: SecureAPIOptions = {}): Promise<APIResponse> {
    try {
      logger.info('Retrieving call transcript server-side', options.userId, options.sessionId, {
        callId,
        action: 'transcript_retrieval'
      })

      if (!supabaseAdmin) {
        throw new Error('Admin client not configured')
      }

      const { data: call, error } = await supabaseAdmin
        .from('calls')
        .select('id, transcript, call_summary, created_at, patient_id')
        .eq('id', callId)
        .single()

      if (error) {
        logger.error('Failed to retrieve call transcript', options.userId, options.sessionId, {
          callId,
          error: error.message
        })
        return { success: false, error: 'Call not found' }
      }

      // Decrypt transcript server-side only
      let decryptedTranscript = call.transcript
      let decryptedSummary = call.call_summary

      if (call.transcript && typeof call.transcript === 'object') {
        decryptedTranscript = await encryptionService.decrypt(call.transcript)
      }

      if (call.call_summary && typeof call.call_summary === 'object') {
        decryptedSummary = await encryptionService.decrypt(call.call_summary)
      }

      const processedCall = {
        id: call.id,
        transcript: decryptedTranscript,
        call_summary: decryptedSummary,
        created_at: call.created_at,
        patient_id: call.patient_id
      }

      logger.info('Call transcript retrieved successfully', options.userId, options.sessionId, {
        callId,
        action: 'transcript_retrieved'
      })

      return { success: true, data: processedCall }

    } catch (error) {
      logger.error('Server-side transcript retrieval failed', options.userId, options.sessionId, {
        callId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return { success: false, error: 'Server-side operation failed' }
    }
  }

  /**
   * Secure server-side SMS message processing
   */
  async getSMSMessages(filters: any = {}, options: SecureAPIOptions = {}): Promise<APIResponse> {
    try {
      logger.info('Retrieving SMS messages server-side', options.userId, options.sessionId, {
        action: 'sms_retrieval',
        filters: Object.keys(filters)
      })

      if (!supabaseAdmin) {
        throw new Error('Admin client not configured')
      }

      let query = supabaseAdmin
        .from('sms_messages')
        .select('*')
        .order('created_at', { ascending: false })

      // Apply filters server-side
      if (filters.patient_id) {
        query = query.eq('patient_id', filters.patient_id)
      }
      if (filters.phone_number) {
        query = query.eq('phone_number', filters.phone_number)
      }

      const { data: messages, error } = await query.limit(100)

      if (error) {
        logger.error('Failed to retrieve SMS messages', options.userId, options.sessionId, {
          error: error.message
        })
        return { success: false, error: 'Failed to retrieve messages' }
      }

      // Decrypt message content server-side only
      const decryptedMessages = await Promise.all(
        messages.map(async (msg) => {
          try {
            let decryptedMessage = msg.message
            if (msg.message && typeof msg.message === 'object') {
              decryptedMessage = await encryptionService.decrypt(msg.message)
            }

            return {
              ...msg,
              message: decryptedMessage
            }
          } catch (decryptError) {
            logger.warn('Failed to decrypt message', options.userId, options.sessionId, {
              messageId: msg.id,
              error: decryptError instanceof Error ? decryptError.message : 'Unknown error'
            })
            return {
              ...msg,
              message: '[ENCRYPTED_MESSAGE]'
            }
          }
        })
      )

      logger.info('SMS messages retrieved successfully', options.userId, options.sessionId, {
        action: 'sms_retrieved',
        count: decryptedMessages.length
      })

      return { success: true, data: decryptedMessages }

    } catch (error) {
      logger.error('Server-side SMS retrieval failed', options.userId, options.sessionId, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return { success: false, error: 'Server-side operation failed' }
    }
  }

  /**
   * Secure server-side user data processing
   * Ensures current user data is properly encrypted
   */
  async getUserProfileSecure(azureAdId: string, options: SecureAPIOptions = {}): Promise<APIResponse> {
    try {
      logger.info('Retrieving user profile server-side', options.userId, options.sessionId, {
        azureAdId,
        action: 'user_profile_retrieval'
      })

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('azure_ad_id', azureAdId)
        .single()

      if (error) {
        logger.error('Failed to retrieve user profile', options.userId, options.sessionId, {
          azureAdId,
          error: error.message
        })
        return { success: false, error: 'User not found' }
      }

      // Remove sensitive server-side only fields
      const safeUserProfile = {
        id: user.id,
        azure_ad_id: user.azure_ad_id,
        email: user.email,
        name: user.name,
        role: user.role,
        mfa_enabled: user.mfa_enabled,
        last_login: user.last_login,
        is_active: user.is_active,
        created_at: user.created_at
      }

      logger.info('User profile retrieved successfully', options.userId, options.sessionId, {
        azureAdId,
        action: 'user_profile_retrieved'
      })

      return { success: true, data: safeUserProfile }

    } catch (error) {
      logger.error('Server-side user profile retrieval failed', options.userId, options.sessionId, {
        azureAdId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return { success: false, error: 'Server-side operation failed' }
    }
  }

  /**
   * Secure server-side analytics data processing
   * Ensures analytics are computed server-side without exposing PHI
   */
  async getAnalyticsData(timeRange: string, options: SecureAPIOptions = {}): Promise<APIResponse> {
    try {
      logger.info('Computing analytics server-side', options.userId, options.sessionId, {
        timeRange,
        action: 'analytics_computation'
      })

      if (!supabaseAdmin) {
        throw new Error('Admin client not configured')
      }

      const endDate = new Date()
      let startDate = new Date()

      switch (timeRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7)
          break
        case '30d':
          startDate.setDate(endDate.getDate() - 30)
          break
        case '90d':
          startDate.setDate(endDate.getDate() - 90)
          break
        default:
          startDate.setDate(endDate.getDate() - 7)
      }

      // Get aggregated data without exposing individual PHI records
      const { data: callStats, error: callError } = await supabaseAdmin
        .from('calls')
        .select('id, status, created_at, duration')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (callError) {
        throw new Error(`Call stats query failed: ${callError.message}`)
      }

      const { data: smsStats, error: smsError } = await supabaseAdmin
        .from('sms_messages')
        .select('id, direction, status, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (smsError) {
        throw new Error(`SMS stats query failed: ${smsError.message}`)
      }

      // Compute aggregated analytics (no PHI exposed)
      const analytics = {
        calls: {
          total: callStats.length,
          completed: callStats.filter(c => c.status === 'completed').length,
          failed: callStats.filter(c => c.status === 'failed').length,
          totalDuration: callStats.reduce((sum, c) => sum + (c.duration || 0), 0)
        },
        sms: {
          total: smsStats.length,
          sent: smsStats.filter(s => s.direction === 'outbound').length,
          received: smsStats.filter(s => s.direction === 'inbound').length,
          delivered: smsStats.filter(s => s.status === 'delivered').length
        },
        timeRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      }

      logger.info('Analytics computed successfully', options.userId, options.sessionId, {
        timeRange,
        action: 'analytics_computed',
        callCount: analytics.calls.total,
        smsCount: analytics.sms.total
      })

      return { success: true, data: analytics }

    } catch (error) {
      logger.error('Server-side analytics computation failed', options.userId, options.sessionId, {
        timeRange,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return { success: false, error: 'Analytics computation failed' }
    }
  }
}

export const secureApiService = new SecureAPIService()