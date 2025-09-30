/**
 * Enhanced Input Validation and Sanitization
 * Prevents XSS, SQL injection, and other injection attacks
 *
 * Features:
 * - Email validation (RFC 5322 compliant)
 * - Phone number validation
 * - URL validation and sanitization
 * - HTML sanitization (XSS prevention)
 * - SQL injection prevention
 * - Path traversal prevention
 * - Command injection prevention
 */

/**
 * Email validation (RFC 5322 compliant)
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false

  // RFC 5322 compliant regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

  // Additional checks
  if (email.length > 254) return false // Max email length
  if (email.includes('..')) return false // No consecutive dots
  if (email.startsWith('.') || email.endsWith('.')) return false

  return emailRegex.test(email)
}

/**
 * Phone number validation (US/Canada/International)
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false

  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\+\.]/g, '')

  // Check if it's all digits (with optional leading +)
  if (!/^\+?\d{10,15}$/.test(cleaned)) return false

  return true
}

/**
 * Sanitize phone number to E.164 format
 */
export function sanitizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '')

  // Add + if not present
  if (!cleaned.startsWith('+')) {
    // Assume North American if 10 digits
    if (cleaned.length === 10) {
      return `+1${cleaned}`
    }
    return `+${cleaned}`
  }

  return cleaned
}

/**
 * URL validation and sanitization
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false

  try {
    const parsed = new URL(url)

    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Sanitize URL by removing dangerous protocols
 */
export function sanitizeUrl(url: string): string {
  if (!url) return ''

  // Remove javascript: and data: protocols
  const dangerous = /^(javascript|data|vbscript|file|about):/i
  if (dangerous.test(url)) {
    return ''
  }

  try {
    const parsed = new URL(url)
    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return ''
    }
    return parsed.toString()
  } catch {
    // If not a valid URL, return empty string
    return ''
  }
}

/**
 * HTML sanitization (XSS prevention)
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return ''

  // Replace HTML special characters
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  }

  return input.replace(/[&<>"'/]/g, char => map[char])
}

/**
 * SQL injection prevention
 * Escape single quotes and detect SQL keywords
 */
export function hasSqlInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false

  // Detect common SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/i,
    /(--|;|\/\*|\*\/|xp_|sp_)/i,
    /('|"|;|\||&|\$|#)/i
  ]

  return sqlPatterns.some(pattern => pattern.test(input))
}

/**
 * Sanitize SQL input by escaping single quotes
 */
export function sanitizeSql(input: string): string {
  if (!input || typeof input !== 'string') return ''

  // Escape single quotes
  return input.replace(/'/g, "''")
}

/**
 * Path traversal prevention
 */
export function hasPathTraversal(path: string): boolean {
  if (!path || typeof path !== 'string') return false

  // Detect path traversal patterns
  const traversalPatterns = [
    /\.\./,           // Parent directory
    /\.\/|\/\./,      // Current directory reference
    /~\//,            // Home directory
    /\/\//,           // Double slashes
    /\\/,             // Backslashes
    /\0/              // Null bytes
  ]

  return traversalPatterns.some(pattern => pattern.test(path))
}

/**
 * Sanitize file path
 */
export function sanitizePath(path: string): string {
  if (!path || typeof path !== 'string') return ''

  // Remove dangerous characters and patterns
  let sanitized = path
    .replace(/\.\./g, '')    // Remove ..
    .replace(/~\//g, '')     // Remove ~/
    .replace(/\/\//g, '/')   // Remove double slashes
    .replace(/\\/g, '/')     // Replace backslashes with forward slashes
    .replace(/\0/g, '')      // Remove null bytes

  // Remove leading slashes
  sanitized = sanitized.replace(/^\/+/, '')

  return sanitized
}

/**
 * Command injection prevention
 */
export function hasCommandInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false

  // Detect command injection patterns
  const cmdPatterns = [
    /[;&|`$()]/,              // Shell metacharacters
    /\n|\r/,                  // Newlines
    /\b(sh|bash|cmd|powershell|eval|exec)\b/i
  ]

  return cmdPatterns.some(pattern => pattern.test(input))
}

/**
 * Username validation (alphanumeric + underscore/hyphen)
 */
export function isValidUsername(username: string): boolean {
  if (!username || typeof username !== 'string') return false

  // 3-32 characters, alphanumeric + underscore/hyphen
  const usernameRegex = /^[a-zA-Z0-9_-]{3,32}$/

  return usernameRegex.test(username)
}

/**
 * Password strength validation
 */
export interface PasswordStrength {
  isValid: boolean
  strength: 'weak' | 'medium' | 'strong'
  issues: string[]
}

/**
 * Common weak passwords to block
 */
const COMMON_WEAK_PASSWORDS = [
  'password', 'password123', '12345678', 'qwerty', 'abc123',
  'letmein', 'welcome', 'monkey', '1234567890', 'admin',
  'password1', 'Password1', 'P@ssw0rd', 'Welcome1'
]

export function validatePasswordStrength(password: string): PasswordStrength {
  const issues: string[] = []

  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      strength: 'weak',
      issues: ['Password is required']
    }
  }

  // SECURITY FIX: Minimum 12 characters for healthcare compliance (was 8)
  if (password.length < 12) {
    issues.push('Password must be at least 12 characters long')
  }

  // Maximum 128 characters (prevent DOS)
  if (password.length > 128) {
    issues.push('Password must be less than 128 characters')
  }

  // Check for uppercase
  if (!/[A-Z]/.test(password)) {
    issues.push('Password must contain at least one uppercase letter')
  }

  // Check for lowercase
  if (!/[a-z]/.test(password)) {
    issues.push('Password must contain at least one lowercase letter')
  }

  // Check for numbers
  if (!/[0-9]/.test(password)) {
    issues.push('Password must contain at least one number')
  }

  // Check for special characters
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    issues.push('Password must contain at least one special character')
  }

  // SECURITY FIX: Check for common weak passwords
  if (COMMON_WEAK_PASSWORDS.includes(password.toLowerCase())) {
    issues.push('This password is too common. Please choose a more unique password')
  }

  // SECURITY FIX: Check for sequential characters (123, abc)
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
    issues.push('Password should not contain sequential characters')
  }

  // SECURITY FIX: Check for repeated characters (aaa, 111)
  if (/(.)\1{2,}/.test(password)) {
    issues.push('Password should not contain repeated characters')
  }

  // Calculate strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak'
  if (issues.length === 0) {
    if (password.length >= 16) {
      strength = 'strong'
    } else if (password.length >= 14) {
      strength = 'medium'
    }
  } else if (issues.length <= 2 && password.length >= 12) {
    strength = 'medium'
  }

  return {
    isValid: issues.length === 0,
    strength,
    issues
  }
}

/**
 * Sanitize user input for safe display
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') return ''

  // Remove any HTML/script tags
  let sanitized = sanitizeHtml(input)

  // Limit length to prevent DOS
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000)
  }

  return sanitized.trim()
}

/**
 * Validate and sanitize JSON input
 */
export function sanitizeJson(input: string): { valid: boolean; data?: any; error?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Invalid input' }
  }

  try {
    const data = JSON.parse(input)
    return { valid: true, data }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid JSON'
    }
  }
}

/**
 * Comprehensive input validation for common fields
 */
export const validators = {
  email: isValidEmail,
  phone: isValidPhone,
  url: isValidUrl,
  username: isValidUsername,
  password: validatePasswordStrength
}

/**
 * Comprehensive input sanitization
 */
export const sanitizers = {
  html: sanitizeHtml,
  url: sanitizeUrl,
  sql: sanitizeSql,
  path: sanitizePath,
  phone: sanitizePhone,
  userInput: sanitizeUserInput
}

/**
 * Security checks
 */
export const securityChecks = {
  hasSqlInjection,
  hasPathTraversal,
  hasCommandInjection
}

export default {
  validators,
  sanitizers,
  securityChecks
}