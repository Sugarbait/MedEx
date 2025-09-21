/**
 * Environment Variable Validator
 *
 * Ensures environment variables are properly loaded and provides fallbacks
 * for development and production environments.
 */

interface EnvironmentConfig {
  supabaseUrl: string | null
  supabaseAnonKey: string | null
  supabaseServiceRoleKey: string | null
  isValid: boolean
  errors: string[]
}

export class EnvironmentValidator {
  private static instance: EnvironmentValidator
  private config: EnvironmentConfig | null = null

  private constructor() {}

  static getInstance(): EnvironmentValidator {
    if (!EnvironmentValidator.instance) {
      EnvironmentValidator.instance = new EnvironmentValidator()
    }
    return EnvironmentValidator.instance
  }

  /**
   * Validate and get environment configuration
   */
  getConfig(): EnvironmentConfig {
    if (this.config) {
      return this.config
    }

    const errors: string[] = []
    let supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    let supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

    // Debug current environment
    console.log('🔍 Environment Validator - Raw Values:')
    console.log('- URL:', supabaseUrl)
    console.log('- Anon Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'missing')
    console.log('- Service Key:', supabaseServiceRoleKey ? 'present' : 'missing')

    // Validate URL
    if (!supabaseUrl) {
      errors.push('VITE_SUPABASE_URL is missing')
    } else if (!this.isValidSupabaseUrl(supabaseUrl)) {
      errors.push('VITE_SUPABASE_URL is not a valid Supabase URL')
    }

    // Validate Anon Key
    if (!supabaseAnonKey) {
      errors.push('VITE_SUPABASE_ANON_KEY is missing')
    } else if (!this.isValidSupabaseKey(supabaseAnonKey)) {
      errors.push('VITE_SUPABASE_ANON_KEY is not a valid JWT token')
    }

    const isValid = errors.length === 0

    this.config = {
      supabaseUrl: supabaseUrl || null,
      supabaseAnonKey: supabaseAnonKey || null,
      supabaseServiceRoleKey: supabaseServiceRoleKey || null,
      isValid,
      errors
    }

    if (!isValid) {
      console.warn('❌ Environment validation failed:', errors)
      console.warn('🔄 Application will run in localStorage-only mode')
    } else {
      console.log('✅ Environment validation passed - Supabase integration enabled')
    }

    return this.config
  }

  /**
   * Check if URL is a valid Supabase URL
   */
  private isValidSupabaseUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return (
        parsed.protocol === 'https:' &&
        (
          // Standard Supabase URL format: https://xxx.supabase.co
          parsed.hostname.endsWith('.supabase.co') ||
          // Allow supabase.co domains
          parsed.hostname.includes('supabase.co')
        ) &&
        !parsed.hostname.includes('localhost') &&
        !parsed.hostname.includes('example') &&
        !parsed.hostname.includes('placeholder')
      )
    } catch {
      return false
    }
  }

  /**
   * Check if key is a valid JWT token format
   */
  private isValidSupabaseKey(key: string): boolean {
    // Basic JWT format check: should have 3 parts separated by dots
    const parts = key.split('.')
    if (parts.length !== 3) {
      return false
    }

    // Should start with eyJ (base64 encoded {"typ":"JWT"...})
    if (!key.startsWith('eyJ')) {
      return false
    }

    // Should be reasonably long (Supabase keys are typically 200+ chars)
    if (key.length < 100) {
      return false
    }

    return true
  }

  /**
   * Reset config cache (useful for testing)
   */
  reset(): void {
    this.config = null
  }
}

// Export singleton instance
export const envValidator = EnvironmentValidator.getInstance()