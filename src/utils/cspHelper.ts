/**
 * Content Security Policy Helper
 * Provides utilities for enhanced CSP management
 *
 * Features:
 * - CSP nonce generation (for future implementation)
 * - CSP violation reporting
 * - Dynamic CSP directive management
 * - CSP compliance validation
 */

/**
 * Generate a cryptographically secure nonce for CSP
 * Used for inline scripts and styles
 */
export function generateCSPNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
}

/**
 * CSP Violation Report Handler
 * Logs CSP violations for security monitoring
 */
export interface CSPViolation {
  documentUri: string
  violatedDirective: string
  effectiveDirective: string
  originalPolicy: string
  blockedUri: string
  statusCode: number
  sourceFile?: string
  lineNumber?: number
  columnNumber?: number
}

/**
 * Report CSP violations to audit log
 */
export function reportCSPViolation(violation: CSPViolation): void {
  // Log violation with sanitized URIs
  console.warn('🛡️ CSP Violation Detected:', {
    directive: violation.effectiveDirective,
    blockedUri: sanitizeUri(violation.blockedUri),
    sourceFile: violation.sourceFile ? sanitizeUri(violation.sourceFile) : 'unknown',
    line: violation.lineNumber,
    column: violation.columnNumber
  })

  // In production, send to audit logging service
  if (import.meta.env.MODE === 'production') {
    // Future: Send to audit logger
    // auditLogger.logSecurityEvent('CSP_VIOLATION', { violation })
  }
}

/**
 * Sanitize URI to remove sensitive query parameters
 */
function sanitizeUri(uri: string): string {
  try {
    const url = new URL(uri)
    // Remove sensitive query parameters
    const sensitiveParams = ['token', 'apiKey', 'api_key', 'password', 'secret', 'auth']
    sensitiveParams.forEach(param => {
      if (url.searchParams.has(param)) {
        url.searchParams.set(param, '[REDACTED]')
      }
    })
    return url.toString()
  } catch {
    // If not a valid URL, return sanitized string
    return uri.replace(/([?&])(token|apiKey|api_key|password|secret|auth)=[^&]*/gi, '$1$2=[REDACTED]')
  }
}

/**
 * Register CSP violation listener
 * Call this in main app initialization
 */
export function registerCSPViolationListener(): void {
  if (typeof window !== 'undefined') {
    window.addEventListener('securitypolicyviolation', (event) => {
      reportCSPViolation({
        documentUri: event.documentURI,
        violatedDirective: event.violatedDirective,
        effectiveDirective: event.effectiveDirective,
        originalPolicy: event.originalPolicy,
        blockedUri: event.blockedURI,
        statusCode: event.statusCode,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber
      })
    })

    console.log('✅ CSP violation listener registered')
  }
}

/**
 * Recommended CSP directives for healthcare applications
 */
export const RECOMMENDED_CSP = {
  // Core directives
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    // "'nonce-{GENERATED_NONCE}'", // Future: Replace unsafe-inline with nonces
    "https://login.microsoftonline.com",
    "https://api.retellai.com"
  ],
  'style-src': [
    "'self'",
    // "'nonce-{GENERATED_NONCE}'", // Future: Replace unsafe-inline with nonces
    "https://fonts.googleapis.com"
  ],
  'img-src': [
    "'self'",
    "data:",
    "https:",
    "https://nexasync.ca"
  ],
  'font-src': [
    "'self'",
    "data:",
    "https://fonts.gstatic.com"
  ],
  'connect-src': [
    "'self'",
    "http://localhost:4001",
    "http://localhost:4000",
    "https://login.microsoftonline.com",
    "https://api.retellai.com",
    "https://api.openai.com",
    "https://*.supabase.co",
    "wss://*.supabase.co"
  ],
  'frame-src': [
    "'self'",
    "https://login.microsoftonline.com"
  ],

  // Security directives
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': true,
  'block-all-mixed-content': true
}

/**
 * Build CSP header string from directives object
 */
export function buildCSPHeader(directives: Record<string, string[] | boolean>): string {
  const parts: string[] = []

  for (const [directive, value] of Object.entries(directives)) {
    if (value === true) {
      // Boolean directives (e.g., upgrade-insecure-requests)
      parts.push(directive)
    } else if (Array.isArray(value) && value.length > 0) {
      // Array directives with sources
      parts.push(`${directive} ${value.join(' ')}`)
    }
  }

  return parts.join('; ')
}

/**
 * Validate CSP configuration for security best practices
 */
export interface CSPValidationResult {
  isSecure: boolean
  warnings: string[]
  recommendations: string[]
}

export function validateCSP(cspHeader: string): CSPValidationResult {
  const warnings: string[] = []
  const recommendations: string[] = []

  // Check for unsafe directives
  if (cspHeader.includes("'unsafe-inline'")) {
    warnings.push("CSP contains 'unsafe-inline' - vulnerable to XSS attacks")
    recommendations.push("Replace 'unsafe-inline' with nonce-based CSP or hashes")
  }

  if (cspHeader.includes("'unsafe-eval'")) {
    warnings.push("CSP contains 'unsafe-eval' - allows dynamic code execution")
    recommendations.push("Remove 'unsafe-eval' or use 'wasm-unsafe-eval' for WebAssembly only")
  }

  // Check for wildcard sources
  if (cspHeader.includes(" * ") || cspHeader.includes(" *;")) {
    warnings.push("CSP contains wildcard (*) sources - allows all origins")
    recommendations.push("Restrict sources to specific trusted domains")
  }

  // Check for missing critical directives
  if (!cspHeader.includes('default-src')) {
    warnings.push("Missing default-src directive")
    recommendations.push("Add default-src 'self' as fallback policy")
  }

  if (!cspHeader.includes('script-src')) {
    warnings.push("Missing script-src directive")
    recommendations.push("Add script-src directive to control script execution")
  }

  if (!cspHeader.includes("object-src 'none'")) {
    warnings.push("object-src not set to 'none'")
    recommendations.push("Set object-src 'none' to disable plugins")
  }

  // Check for security features
  if (!cspHeader.includes('upgrade-insecure-requests')) {
    recommendations.push("Add upgrade-insecure-requests to upgrade HTTP to HTTPS")
  }

  if (!cspHeader.includes('frame-ancestors')) {
    recommendations.push("Add frame-ancestors directive to prevent clickjacking")
  }

  const isSecure = warnings.length === 0

  return { isSecure, warnings, recommendations }
}

/**
 * Create a strict CSP for maximum security
 * Note: May require application changes to work
 */
export function createStrictCSP(): string {
  const nonce = generateCSPNonce()

  return buildCSPHeader({
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "https://login.microsoftonline.com"
    ],
    'style-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "https://fonts.googleapis.com"
    ],
    'img-src': ["'self'", "data:", "https:"],
    'font-src': ["'self'", "data:", "https://fonts.gstatic.com"],
    'connect-src': [
      "'self'",
      "https://login.microsoftonline.com",
      "https://*.supabase.co",
      "wss://*.supabase.co"
    ],
    'frame-src': ["'self'", "https://login.microsoftonline.com"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': true,
    'block-all-mixed-content': true
  })
}

/**
 * Get current CSP from meta tag or header
 */
export function getCurrentCSP(): string | null {
  // Check for CSP meta tag
  const metaTag = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
  if (metaTag) {
    return metaTag.getAttribute('content')
  }

  // CSP is typically in HTTP headers, not accessible from JavaScript
  return null
}

/**
 * Log CSP compliance status on app load
 */
export function logCSPStatus(): void {
  const csp = getCurrentCSP()
  if (csp) {
    const validation = validateCSP(csp)
    console.log('🛡️ CSP Status:', {
      secure: validation.isSecure,
      warnings: validation.warnings.length,
      recommendations: validation.recommendations.length
    })

    if (validation.warnings.length > 0) {
      console.warn('⚠️ CSP Warnings:', validation.warnings)
    }
  } else {
    console.warn('⚠️ No CSP detected in meta tags (may be in HTTP headers)')
  }
}