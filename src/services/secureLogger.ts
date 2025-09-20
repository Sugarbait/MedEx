/**
 * HIPAA-Compliant Secure Logging Service
 *
 * Replaces console.log with secure logging that:
 * - Filters out PHI data
 * - Controls log levels based on environment
 * - Provides audit-friendly logging
 * - Prevents information leakage in production
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  component?: string
  userId?: string
  sessionId?: string
  metadata?: Record<string, any>
}

class SecureLogger {
  private readonly isDevelopment = import.meta.env.DEV
  private readonly isProduction = import.meta.env.PROD
  private readonly logLevel: LogLevel

  // PHI patterns to filter out (case-insensitive)
  private readonly PHI_PATTERNS = [
    /\b\d{3}-\d{2}-\d{4}\b/g,        // SSN
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g, // Phone numbers
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,  // Dates
    /password/gi,                     // Password fields
    /secret/gi,                       // Secret fields
    /token/gi,                        // Token fields
    /key/gi                           // Key fields
  ]

  constructor() {
    // Set log level based on environment
    if (this.isDevelopment) {
      this.logLevel = LogLevel.DEBUG
    } else if (this.isProduction) {
      this.logLevel = LogLevel.WARN // Only warnings and errors in production
    } else {
      this.logLevel = LogLevel.INFO
    }
  }

  /**
   * Sanitize message to remove potential PHI
   */
  private sanitizeMessage(message: string): string {
    let sanitized = message

    // Replace PHI patterns with placeholder
    this.PHI_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[FILTERED_PHI]')
    })

    return sanitized
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    const level = LogLevel[entry.level]
    const components = []

    if (entry.component) components.push(`[${entry.component}]`)
    if (entry.userId) components.push(`[User:${entry.userId.substring(0, 8)}...]`)
    if (entry.sessionId) components.push(`[Session:${entry.sessionId.substring(0, 8)}...]`)

    const prefix = components.length > 0 ? `${components.join('')} ` : ''

    return `[${entry.timestamp}] [${level}] ${prefix}${entry.message}`
  }

  /**
   * Create log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    component?: string,
    userId?: string,
    sessionId?: string,
    metadata?: Record<string, any>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message: this.sanitizeMessage(message),
      component,
      userId,
      sessionId,
      metadata: metadata ? this.sanitizeMetadata(metadata) : undefined
    }
  }

  /**
   * Sanitize metadata object
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {}

    for (const [key, value] of Object.entries(metadata)) {
      // Filter out sensitive keys
      if (key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('key')) {
        sanitized[key] = '[FILTERED]'
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeMessage(value)
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value)
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  /**
   * Log message with specified level
   */
  private log(
    level: LogLevel,
    message: string,
    component?: string,
    userId?: string,
    sessionId?: string,
    metadata?: Record<string, any>
  ): void {
    // Check if we should log this level
    if (level > this.logLevel) {
      return
    }

    const entry = this.createLogEntry(level, message, component, userId, sessionId, metadata)
    const formattedMessage = this.formatLogEntry(entry)

    // In production, only use console.error and console.warn to avoid information leakage
    if (this.isProduction) {
      if (level === LogLevel.ERROR) {
        console.error(formattedMessage)
      } else if (level === LogLevel.WARN) {
        console.warn(formattedMessage)
      }
      // No console output for INFO/DEBUG in production
    } else {
      // Development environment - use appropriate console method
      switch (level) {
        case LogLevel.ERROR:
          console.error(formattedMessage, metadata)
          break
        case LogLevel.WARN:
          console.warn(formattedMessage, metadata)
          break
        case LogLevel.INFO:
          console.info(formattedMessage, metadata)
          break
        case LogLevel.DEBUG:
          console.log(formattedMessage, metadata)
          break
      }
    }
  }

  /**
   * Log error message
   */
  error(message: string, component?: string, userId?: string, sessionId?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, component, userId, sessionId, metadata)
  }

  /**
   * Log warning message
   */
  warn(message: string, component?: string, userId?: string, sessionId?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, component, userId, sessionId, metadata)
  }

  /**
   * Log info message
   */
  info(message: string, component?: string, userId?: string, sessionId?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, component, userId, sessionId, metadata)
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, component?: string, userId?: string, sessionId?: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, component, userId, sessionId, metadata)
  }

  /**
   * Create a component-specific logger
   */
  component(componentName: string) {
    return {
      error: (message: string, userId?: string, sessionId?: string, metadata?: Record<string, any>) =>
        this.error(message, componentName, userId, sessionId, metadata),
      warn: (message: string, userId?: string, sessionId?: string, metadata?: Record<string, any>) =>
        this.warn(message, componentName, userId, sessionId, metadata),
      info: (message: string, userId?: string, sessionId?: string, metadata?: Record<string, any>) =>
        this.info(message, componentName, userId, sessionId, metadata),
      debug: (message: string, userId?: string, sessionId?: string, metadata?: Record<string, any>) =>
        this.debug(message, componentName, userId, sessionId, metadata)
    }
  }

  /**
   * Development-only logging - completely disabled in production
   */
  devOnly(message: string, metadata?: Record<string, any>): void {
    if (this.isDevelopment) {
      console.log(`[DEV] ${message}`, metadata)
    }
  }
}

// Export singleton instance
export const secureLogger = new SecureLogger()

// Export convenience methods for component-specific logging
export const createComponentLogger = (componentName: string) =>
  secureLogger.component(componentName)