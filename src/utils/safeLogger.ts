/**
 * Production-Safe Logging Utility
 * Automatically redacts PHI and sensitive data in production
 *
 * Features:
 * - Automatic PHI detection and redaction
 * - Production mode silent logging
 * - Sensitive field filtering
 * - HIPAA-compliant log sanitization
 */

// Detect production environment
const isProduction = (): boolean => {
  // Check multiple sources for production environment
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.MODE === 'production' ||
           import.meta.env.VITE_APP_ENVIRONMENT === 'production'
  }
  return false
}

// Sensitive field patterns that should always be redacted
const SENSITIVE_PATTERNS = [
  // Personal identifiers
  /email/i,
  /phone/i,
  /ssn/i,
  /social.?security/i,
  /address/i,
  /birth.?date/i,
  /dob/i,

  // Authentication
  /password/i,
  /secret/i,
  /token/i,
  /apikey/i,
  /api.?key/i,
  /auth/i,
  /credential/i,

  // Medical information
  /diagnosis/i,
  /prescription/i,
  /medical/i,
  /health/i,
  /patient/i,
  /treatment/i,

  // Financial
  /credit.?card/i,
  /card.?number/i,
  /cvv/i,
  /bank/i,
  /account.?number/i
]

/**
 * Check if a key contains sensitive information
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(key))
}

/**
 * Redact sensitive data from objects
 */
function redactSensitiveData(data: any): any {
  if (data === null || data === undefined) {
    return data
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item))
  }

  // Handle objects
  if (typeof data === 'object') {
    const redacted: any = {}
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key)) {
        redacted[key] = '[REDACTED]'
      } else if (typeof value === 'object') {
        redacted[key] = redactSensitiveData(value)
      } else {
        redacted[key] = value
      }
    }
    return redacted
  }

  // Return primitives as-is
  return data
}

/**
 * Safe logger that respects production environment
 */
export const safeLogger = {
  /**
   * Log debug information (silent in production)
   */
  debug(...args: any[]): void {
    if (isProduction()) {
      return // Silent in production
    }
    const redacted = args.map(arg => redactSensitiveData(arg))
    console.debug(...redacted)
  },

  /**
   * Log general information (minimal in production)
   */
  log(...args: any[]): void {
    const redacted = args.map(arg => redactSensitiveData(arg))
    if (isProduction()) {
      // Only log first argument (usually a message) in production
      if (typeof redacted[0] === 'string') {
        console.log(redacted[0])
      }
    } else {
      console.log(...redacted)
    }
  },

  /**
   * Log informational messages (always logged)
   */
  info(...args: any[]): void {
    const redacted = args.map(arg => redactSensitiveData(arg))
    console.info(...redacted)
  },

  /**
   * Log warnings (always logged)
   */
  warn(...args: any[]): void {
    const redacted = args.map(arg => redactSensitiveData(arg))
    console.warn(...redacted)
  },

  /**
   * Log errors (always logged)
   */
  error(...args: any[]): void {
    const redacted = args.map(arg => redactSensitiveData(arg))
    console.error(...redacted)
  },

  /**
   * Check if currently in production mode
   */
  isProduction(): boolean {
    return isProduction()
  },

  /**
   * Manually redact sensitive data (useful for custom logging)
   */
  redact(data: any): any {
    return redactSensitiveData(data)
  }
}

/**
 * Legacy console wrapper for gradual migration
 * Drop-in replacement for console.log
 */
export const secureConsole = {
  log: safeLogger.log.bind(safeLogger),
  debug: safeLogger.debug.bind(safeLogger),
  info: safeLogger.info.bind(safeLogger),
  warn: safeLogger.warn.bind(safeLogger),
  error: safeLogger.error.bind(safeLogger)
}

// Export as default for convenience
export default safeLogger