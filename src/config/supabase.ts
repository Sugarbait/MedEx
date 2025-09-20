import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase configuration missing or invalid. Application will operate in localStorage-only mode.')
  console.warn('To enable Supabase integration, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file')
}

// Client for authenticated user operations
// Create a fallback client if configuration is invalid
const createSupabaseClient = () => {
  try {
    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('example.') || supabaseUrl === 'your_url_here') {
      console.warn('Using fallback Supabase configuration for localStorage-only mode')
      // Create a minimal client that will fail gracefully
      return createClient<Database>('http://localhost:54321', 'dummy-key', {
        auth: {
          detectSessionInUrl: false,
          persistSession: false,
          autoRefreshToken: false,
          storageKey: 'carexps-auth-fallback'
        }
      })
    }

    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Use Azure AD integration - disable built-in auth since we use Azure AD
        detectSessionInUrl: false,
        persistSession: false,
        autoRefreshToken: false,
        storageKey: 'carexps-auth'
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        },
        // Enhanced WebSocket configuration with better error handling
        logger: (level, message, details) => {
          if (level === 'error') {
            // Don't spam the console with connection errors when Supabase is down
            if (message.includes('WebSocket') || message.includes('connection') || message.includes('ECONNREFUSED')) {
              console.log('Supabase realtime connection unavailable (working in offline mode)')
            } else {
              console.error('Supabase Realtime error:', message, details)
            }
          }
        },
        // Add reconnection settings for better resilience
        reconnectAfterMs: (tries) => {
          // Exponential backoff with max delay of 30 seconds
          return Math.min(1000 * Math.pow(2, tries), 30000)
        },
        maxReconnectAttempts: 5,
        timeout: 10000
      },
      global: {
        headers: {
          'X-Client-Info': 'carexps-healthcare-crm/1.0.0',
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      }
    })
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    // Return a minimal fallback client
    return createClient<Database>('http://localhost:54321', 'dummy-key', {
      auth: {
        detectSessionInUrl: false,
        persistSession: false,
        autoRefreshToken: false,
        storageKey: 'carexps-auth-fallback'
      }
    })
  }
}

export const supabase = createSupabaseClient()

// Service role client for admin operations (use server-side only)
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

// HIPAA Compliance Configuration
export const hipaaConfig = {
  encryptionEnabled: import.meta.env.VITE_HIPAA_MODE === 'true',
  auditLoggingEnabled: true,
  dataRetentionDays: 2555, // 7 years for HIPAA compliance
  sessionTimeoutMinutes: 15,
  maxFailedLoginAttempts: 3,
  passwordExpirationDays: 90,
  requireMFA: true
}

// Encryption configuration for PHI data
export const encryptionConfig = {
  phiKey: import.meta.env.VITE_PHI_ENCRYPTION_KEY,
  auditKey: import.meta.env.VITE_AUDIT_ENCRYPTION_KEY,
  algorithm: 'AES-256-GCM'
}

// Validate encryption keys are present when HIPAA mode is enabled
if (hipaaConfig.encryptionEnabled && (!encryptionConfig.phiKey || !encryptionConfig.auditKey)) {
  throw new Error('SECURITY ERROR: PHI encryption keys are required when HIPAA mode is enabled. Please configure VITE_PHI_ENCRYPTION_KEY and VITE_AUDIT_ENCRYPTION_KEY in your environment.')
}