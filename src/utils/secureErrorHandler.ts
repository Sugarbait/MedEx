/**
 * Secure Error Handler
 * Prevents information disclosure through error messages
 *
 * Security Features:
 * - Generic error messages for users
 * - Detailed logging for developers
 * - Stack trace sanitization
 * - PHI redaction in errors
 * - Production/development mode awareness
 */

import { safeLogger } from './safeLogger'

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Error categories
 */
export type ErrorCategory =
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'network'
  | 'database'
  | 'encryption'
  | 'configuration'
  | 'unknown'

/**
 * Structured error information
 */
export interface SecureError {
  /** User-friendly message (safe for display) */
  userMessage: string

  /** Internal error message (for logging only) */
  internalMessage: string

  /** Error category */
  category: ErrorCategory

  /** Severity level */
  severity: ErrorSeverity

  /** Error code for tracking */
  code: string

  /** Original error (sanitized) */
  originalError?: Error

  /** Additional context (PHI-free) */
  context?: Record<string, any>

  /** Timestamp */
  timestamp: Date
}

/**
 * Generic user-friendly error messages
 */
const GENERIC_MESSAGES: Record<ErrorCategory, string> = {
  authentication: 'Authentication failed. Please try logging in again.',
  authorization: 'You do not have permission to perform this action.',
  validation: 'The information provided is invalid. Please check your input.',
  network: 'Network error. Please check your connection and try again.',
  database: 'An error occurred while processing your request. Please try again.',
  encryption: 'A security error occurred. Please contact support.',
  configuration: 'A configuration error occurred. Please contact support.',
  unknown: 'An unexpected error occurred. Please try again or contact support.'
}

/**
 * Create a secure error object
 */
export function createSecureError(
  error: Error | string,
  category: ErrorCategory = 'unknown',
  severity: ErrorSeverity = 'medium',
  context?: Record<string, any>
): SecureError {
  const internalMessage = typeof error === 'string' ? error : error.message
  const originalError = typeof error === 'string' ? undefined : error

  // Generate error code based on category and timestamp
  const code = `${category.toUpperCase()}_${Date.now().toString(36)}`

  return {
    userMessage: GENERIC_MESSAGES[category],
    internalMessage: sanitizeErrorMessage(internalMessage),
    category,
    severity,
    code,
    originalError,
    context: context ? safeLogger.redact(context) : undefined,
    timestamp: new Date()
  }
}

/**
 * Sanitize error messages to remove sensitive information
 */
function sanitizeErrorMessage(message: string): string {
  if (!message) return 'Unknown error'

  // Remove potential paths
  let sanitized = message.replace(/([A-Z]:)?[\\/][^\s]+/g, '[PATH]')

  // Remove potential IP addresses
  sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]')

  // Remove potential emails
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')

  // Remove potential API keys/tokens
  sanitized = sanitized.replace(/(key|token|secret|password)[=:]\s*[^\s,}]+/gi, '$1=[REDACTED]')

  // Limit length
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500) + '...'
  }

  return sanitized
}

/**
 * Sanitize stack trace to remove sensitive paths
 */
function sanitizeStackTrace(stack?: string): string | undefined {
  if (!stack) return undefined

  // Remove full paths, keep relative paths
  let sanitized = stack.replace(/([A-Z]:)?[\\/][^\s]+/g, (match) => {
    const parts = match.split(/[\\/]/)
    // Keep only last 2 parts of path
    return parts.slice(-2).join('/')
  })

  return sanitized
}

/**
 * Log error securely
 */
export function logSecureError(secureError: SecureError): void {
  const logData = {
    code: secureError.code,
    category: secureError.category,
    severity: secureError.severity,
    message: secureError.internalMessage,
    context: secureError.context,
    timestamp: secureError.timestamp.toISOString()
  }

  // Add stack trace in development only
  if (import.meta.env.MODE === 'development' && secureError.originalError) {
    const sanitizedStack = sanitizeStackTrace(secureError.originalError.stack)
    if (sanitizedStack) {
      console.debug('Error stack trace:', sanitizedStack)
    }
  }

  // Log based on severity
  switch (secureError.severity) {
    case 'critical':
      safeLogger.error(`[${secureError.code}] ${secureError.category.toUpperCase()}:`, logData)
      break
    case 'high':
      safeLogger.error(`[${secureError.code}] ${secureError.category.toUpperCase()}:`, logData)
      break
    case 'medium':
      safeLogger.warn(`[${secureError.code}] ${secureError.category.toUpperCase()}:`, logData)
      break
    case 'low':
      safeLogger.info(`[${secureError.code}] ${secureError.category.toUpperCase()}:`, logData)
      break
  }
}

/**
 * Handle error with secure logging and user messaging
 */
export function handleSecureError(
  error: Error | string,
  category: ErrorCategory = 'unknown',
  severity: ErrorSeverity = 'medium',
  context?: Record<string, any>
): SecureError {
  const secureError = createSecureError(error, category, severity, context)
  logSecureError(secureError)
  return secureError
}

/**
 * Common error handlers
 */
export const secureErrorHandlers = {
  /**
   * Handle authentication errors
   */
  authentication(error: Error | string, context?: Record<string, any>): SecureError {
    return handleSecureError(error, 'authentication', 'high', context)
  },

  /**
   * Handle authorization errors
   */
  authorization(error: Error | string, context?: Record<string, any>): SecureError {
    return handleSecureError(error, 'authorization', 'medium', context)
  },

  /**
   * Handle validation errors
   */
  validation(error: Error | string, context?: Record<string, any>): SecureError {
    return handleSecureError(error, 'validation', 'low', context)
  },

  /**
   * Handle network errors
   */
  network(error: Error | string, context?: Record<string, any>): SecureError {
    return handleSecureError(error, 'network', 'medium', context)
  },

  /**
   * Handle database errors
   */
  database(error: Error | string, context?: Record<string, any>): SecureError {
    return handleSecureError(error, 'database', 'high', context)
  },

  /**
   * Handle encryption errors
   */
  encryption(error: Error | string, context?: Record<string, any>): SecureError {
    return handleSecureError(error, 'encryption', 'critical', context)
  },

  /**
   * Handle unknown errors
   */
  unknown(error: Error | string, context?: Record<string, any>): SecureError {
    return handleSecureError(error, 'unknown', 'medium', context)
  }
}

/**
 * Create user-safe error response for API
 */
export interface ErrorResponse {
  error: {
    message: string
    code: string
    category: string
  }
}

export function createErrorResponse(secureError: SecureError): ErrorResponse {
  return {
    error: {
      message: secureError.userMessage,
      code: secureError.code,
      category: secureError.category
    }
  }
}

/**
 * Global error boundary handler
 */
export function setupGlobalErrorHandler(): void {
  if (typeof window === 'undefined') return

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
    const secureError = handleSecureError(error, 'unknown', 'high', {
      type: 'unhandledrejection'
    })

    console.error('Unhandled Promise Rejection:', secureError.userMessage)
    event.preventDefault()
  })

  // Handle global errors
  window.addEventListener('error', (event) => {
    const secureError = handleSecureError(
      event.error || event.message,
      'unknown',
      'high',
      {
        type: 'global_error',
        filename: event.filename ? '[FILE]' : undefined,
        lineno: event.lineno,
        colno: event.colno
      }
    )

    console.error('Global Error:', secureError.userMessage)
    event.preventDefault()
  })

  console.log('✅ Global error handler initialized')
}

/**
 * Error wrapper for async functions
 */
export function withSecureErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  category: ErrorCategory = 'unknown',
  severity: ErrorSeverity = 'medium'
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      const secureError = handleSecureError(
        error instanceof Error ? error : String(error),
        category,
        severity,
        { function: fn.name }
      )
      throw new Error(secureError.userMessage)
    }
  }) as T
}

export default {
  createSecureError,
  handleSecureError,
  logSecureError,
  secureErrorHandlers,
  createErrorResponse,
  setupGlobalErrorHandler,
  withSecureErrorHandling
}