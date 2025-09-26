/**
 * Security Header Validation Utilities
 * HIPAA-compliant security header analysis and validation
 *
 * Features:
 * - Comprehensive header validation
 * - CSP directive parsing and analysis
 * - HSTS configuration validation
 * - Security recommendation generation
 * - Compliance scoring
 */

import {
  SecurityHeaderCheck,
  HSTSConfig,
  CSPDirective,
  SecurityHeadersConfig,
  SecurityRecommendation,
  SECURITY_STANDARDS
} from '@/types/transmissionSecurityTypes'

/**
 * Security header constants and validation rules
 */
export const SECURITY_HEADERS = {
  STRICT_TRANSPORT_SECURITY: 'strict-transport-security',
  CONTENT_SECURITY_POLICY: 'content-security-policy',
  X_FRAME_OPTIONS: 'x-frame-options',
  X_CONTENT_TYPE_OPTIONS: 'x-content-type-options',
  X_XSS_PROTECTION: 'x-xss-protection',
  REFERRER_POLICY: 'referrer-policy',
  PERMISSIONS_POLICY: 'permissions-policy',
  CROSS_ORIGIN_EMBEDDER_POLICY: 'cross-origin-embedder-policy',
  CROSS_ORIGIN_OPENER_POLICY: 'cross-origin-opener-policy',
  CROSS_ORIGIN_RESOURCE_POLICY: 'cross-origin-resource-policy'
} as const

/**
 * CSP directive definitions and security requirements
 */
export const CSP_DIRECTIVES = {
  DEFAULT_SRC: 'default-src',
  SCRIPT_SRC: 'script-src',
  STYLE_SRC: 'style-src',
  IMG_SRC: 'img-src',
  CONNECT_SRC: 'connect-src',
  FONT_SRC: 'font-src',
  OBJECT_SRC: 'object-src',
  MEDIA_SRC: 'media-src',
  FRAME_SRC: 'frame-src',
  CHILD_SRC: 'child-src',
  WORKER_SRC: 'worker-src',
  MANIFEST_SRC: 'manifest-src',
  BASE_URI: 'base-uri',
  FORM_ACTION: 'form-action',
  FRAME_ANCESTORS: 'frame-ancestors',
  PLUGIN_TYPES: 'plugin-types',
  SANDBOX: 'sandbox',
  UPGRADE_INSECURE_REQUESTS: 'upgrade-insecure-requests',
  BLOCK_ALL_MIXED_CONTENT: 'block-all-mixed-content',
  REQUIRE_SRI_FOR: 'require-sri-for',
  TRUSTED_TYPES: 'trusted-types',
  REQUIRE_TRUSTED_TYPES_FOR: 'require-trusted-types-for'
} as const

/**
 * Security scoring weights for different headers
 */
const HEADER_WEIGHTS = {
  [SECURITY_HEADERS.STRICT_TRANSPORT_SECURITY]: 25,
  [SECURITY_HEADERS.CONTENT_SECURITY_POLICY]: 30,
  [SECURITY_HEADERS.X_FRAME_OPTIONS]: 15,
  [SECURITY_HEADERS.X_CONTENT_TYPE_OPTIONS]: 10,
  [SECURITY_HEADERS.X_XSS_PROTECTION]: 10,
  [SECURITY_HEADERS.REFERRER_POLICY]: 5,
  [SECURITY_HEADERS.PERMISSIONS_POLICY]: 5
}

/**
 * Validate all security headers for a given response
 */
export function validateAllSecurityHeaders(headers: Headers): SecurityHeaderCheck[] {
  return [
    validateHSTSHeader(headers),
    validateCSPHeader(headers),
    validateXFrameOptionsHeader(headers),
    validateXContentTypeOptionsHeader(headers),
    validateXXSSProtectionHeader(headers),
    validateReferrerPolicyHeader(headers),
    validatePermissionsPolicyHeader(headers),
    validateCrossOriginHeaders(headers)
  ].flat()
}

/**
 * Validate HSTS (HTTP Strict Transport Security) header
 */
export function validateHSTSHeader(headers: Headers): SecurityHeaderCheck {
  const hsts = headers.get(SECURITY_HEADERS.STRICT_TRANSPORT_SECURITY)
  const present = !!hsts

  let compliant = false
  let recommendation: string | undefined

  if (present && hsts) {
    const config = parseHSTSHeader(hsts)
    compliant = config.valid

    if (!compliant) {
      if (config.maxAge < SECURITY_STANDARDS.HSTS_MIN_AGE) {
        recommendation = `Increase max-age to at least ${SECURITY_STANDARDS.HSTS_MIN_AGE} seconds (1 year)`
      } else if (!config.includeSubDomains) {
        recommendation = 'Add includeSubDomains directive for comprehensive protection'
      } else {
        recommendation = 'Review HSTS configuration for compliance'
      }
    }
  } else {
    recommendation = 'Add HSTS header with proper max-age, includeSubDomains, and preload directives'
  }

  return {
    header: 'Strict-Transport-Security',
    expected: `max-age=${SECURITY_STANDARDS.HSTS_MIN_AGE}; includeSubDomains; preload`,
    actual: hsts || undefined,
    present,
    compliant,
    severity: compliant ? 'low' : 'high',
    recommendation
  }
}

/**
 * Parse HSTS header and extract configuration
 */
export function parseHSTSHeader(hstsHeader: string): HSTSConfig {
  const maxAgeMatch = hstsHeader.match(/max-age=(\d+)/)
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 0
  const includeSubDomains = hstsHeader.includes('includeSubDomains')
  const preload = hstsHeader.includes('preload')

  const valid = maxAge >= SECURITY_STANDARDS.HSTS_MIN_AGE && includeSubDomains

  return { maxAge, includeSubDomains, preload, valid }
}

/**
 * Validate Content Security Policy header
 */
export function validateCSPHeader(headers: Headers): SecurityHeaderCheck {
  const csp = headers.get(SECURITY_HEADERS.CONTENT_SECURITY_POLICY)
  const present = !!csp

  let compliant = false
  let recommendation: string | undefined

  if (present && csp) {
    const analysis = analyzeCSPPolicy(csp)
    compliant = analysis.isSecure

    if (!compliant) {
      const issues = analysis.securityIssues
      if (issues.length > 0) {
        recommendation = `CSP security issues: ${issues.join(', ')}`
      } else {
        recommendation = 'Review CSP directives for security best practices'
      }
    }
  } else {
    recommendation = 'Implement comprehensive CSP with default-src, script-src, and object-src directives'
  }

  return {
    header: 'Content-Security-Policy',
    expected: 'Comprehensive CSP with secure directives',
    actual: csp || undefined,
    present,
    compliant,
    severity: compliant ? 'low' : 'high',
    recommendation
  }
}

/**
 * Analyze CSP policy for security issues
 */
export function analyzeCSPPolicy(policy: string): {
  directives: CSPDirective[]
  isSecure: boolean
  securityIssues: string[]
  recommendations: string[]
} {
  const directives = parseCSPDirectives(policy)
  const securityIssues: string[] = []
  const recommendations: string[] = []

  // Check for critical security issues
  const defaultSrc = directives.find(d => d.directive === CSP_DIRECTIVES.DEFAULT_SRC)
  const scriptSrc = directives.find(d => d.directive === CSP_DIRECTIVES.SCRIPT_SRC)
  const objectSrc = directives.find(d => d.directive === CSP_DIRECTIVES.OBJECT_SRC)

  // Check default-src
  if (!defaultSrc) {
    securityIssues.push('Missing default-src directive')
    recommendations.push('Add default-src directive to set fallback policy')
  } else if (defaultSrc.sources.includes('*')) {
    securityIssues.push('default-src allows all sources (*)')
    recommendations.push('Restrict default-src to specific trusted sources')
  }

  // Check script-src
  if (!scriptSrc) {
    securityIssues.push('Missing script-src directive')
    recommendations.push('Add script-src directive to control script execution')
  } else {
    if (scriptSrc.sources.includes("'unsafe-eval'")) {
      securityIssues.push("script-src allows 'unsafe-eval'")
      recommendations.push('Remove unsafe-eval or use strict-dynamic with nonces/hashes')
    }
    if (scriptSrc.sources.includes("'unsafe-inline'")) {
      securityIssues.push("script-src allows 'unsafe-inline'")
      recommendations.push('Use nonces or hashes instead of unsafe-inline')
    }
    if (scriptSrc.sources.includes('*')) {
      securityIssues.push('script-src allows all sources (*)')
      recommendations.push('Restrict script-src to specific trusted domains')
    }
  }

  // Check object-src
  if (!objectSrc) {
    recommendations.push("Add object-src 'none' to disable plugins")
  } else if (!objectSrc.sources.includes("'none'")) {
    securityIssues.push('object-src should be set to none for security')
    recommendations.push("Set object-src to 'none' to disable plugin execution")
  }

  // Check for missing security directives
  const baseUri = directives.find(d => d.directive === CSP_DIRECTIVES.BASE_URI)
  if (!baseUri) {
    recommendations.push("Add base-uri 'self' to prevent base tag injection")
  }

  const formAction = directives.find(d => d.directive === CSP_DIRECTIVES.FORM_ACTION)
  if (!formAction) {
    recommendations.push("Add form-action 'self' to control form submissions")
  }

  const frameAncestors = directives.find(d => d.directive === CSP_DIRECTIVES.FRAME_ANCESTORS)
  if (!frameAncestors) {
    recommendations.push("Add frame-ancestors 'none' to prevent framing")
  }

  // Check for modern security features
  const upgradeInsecure = directives.find(d => d.directive === CSP_DIRECTIVES.UPGRADE_INSECURE_REQUESTS)
  if (!upgradeInsecure) {
    recommendations.push('Consider adding upgrade-insecure-requests directive')
  }

  const isSecure = securityIssues.length === 0

  return { directives, isSecure, securityIssues, recommendations }
}

/**
 * Parse CSP policy into structured directives
 */
export function parseCSPDirectives(policy: string): CSPDirective[] {
  const directives: CSPDirective[] = []

  // Split policy by semicolons and process each directive
  const directiveStrings = policy.split(';').map(d => d.trim()).filter(d => d.length > 0)

  for (const directiveString of directiveStrings) {
    const parts = directiveString.split(/\s+/)
    const directive = parts[0].toLowerCase()
    const sources = parts.slice(1)

    directives.push({
      directive,
      sources,
      violations: [], // Would be populated from violation reports
      secure: isSecureDirective(directive, sources)
    })
  }

  return directives
}

/**
 * Check if a CSP directive is considered secure
 */
function isSecureDirective(directive: string, sources: string[]): boolean {
  switch (directive) {
    case CSP_DIRECTIVES.DEFAULT_SRC:
      return !sources.includes('*') && !sources.includes("'unsafe-inline'")
    case CSP_DIRECTIVES.SCRIPT_SRC:
      return !sources.includes("'unsafe-eval'") &&
             (!sources.includes("'unsafe-inline'") || sources.includes("'strict-dynamic'"))
    case CSP_DIRECTIVES.STYLE_SRC:
      return !sources.includes('*')
    case CSP_DIRECTIVES.OBJECT_SRC:
      return sources.includes("'none'")
    case CSP_DIRECTIVES.BASE_URI:
      return sources.includes("'self'") || sources.includes("'none'")
    case CSP_DIRECTIVES.FORM_ACTION:
      return !sources.includes('*')
    case CSP_DIRECTIVES.FRAME_ANCESTORS:
      return sources.includes("'none'") || sources.includes("'self'")
    default:
      return true
  }
}

/**
 * Validate X-Frame-Options header
 */
export function validateXFrameOptionsHeader(headers: Headers): SecurityHeaderCheck {
  const xFrame = headers.get(SECURITY_HEADERS.X_FRAME_OPTIONS)
  const present = !!xFrame
  const validValues = ['DENY', 'SAMEORIGIN']
  const compliant = present && validValues.includes(xFrame!.toUpperCase())

  return {
    header: 'X-Frame-Options',
    expected: 'DENY or SAMEORIGIN',
    actual: xFrame || undefined,
    present,
    compliant,
    severity: compliant ? 'low' : 'medium',
    recommendation: compliant ? undefined : 'Set X-Frame-Options to DENY or SAMEORIGIN to prevent clickjacking'
  }
}

/**
 * Validate X-Content-Type-Options header
 */
export function validateXContentTypeOptionsHeader(headers: Headers): SecurityHeaderCheck {
  const xContent = headers.get(SECURITY_HEADERS.X_CONTENT_TYPE_OPTIONS)
  const present = !!xContent
  const compliant = present && xContent.toLowerCase() === 'nosniff'

  return {
    header: 'X-Content-Type-Options',
    expected: 'nosniff',
    actual: xContent || undefined,
    present,
    compliant,
    severity: compliant ? 'low' : 'medium',
    recommendation: compliant ? undefined : 'Set X-Content-Type-Options to nosniff to prevent MIME sniffing'
  }
}

/**
 * Validate X-XSS-Protection header
 */
export function validateXXSSProtectionHeader(headers: Headers): SecurityHeaderCheck {
  const xss = headers.get(SECURITY_HEADERS.X_XSS_PROTECTION)
  const present = !!xss
  const validValues = ['1', '1; mode=block']
  const compliant = present && validValues.includes(xss!)

  return {
    header: 'X-XSS-Protection',
    expected: '1; mode=block',
    actual: xss || undefined,
    present,
    compliant,
    severity: compliant ? 'low' : 'medium',
    recommendation: compliant ? undefined : 'Set X-XSS-Protection to "1; mode=block" for legacy browser protection'
  }
}

/**
 * Validate Referrer-Policy header
 */
export function validateReferrerPolicyHeader(headers: Headers): SecurityHeaderCheck {
  const referrer = headers.get(SECURITY_HEADERS.REFERRER_POLICY)
  const present = !!referrer
  const secureValues = [
    'strict-origin-when-cross-origin',
    'strict-origin',
    'same-origin',
    'no-referrer'
  ]
  const compliant = present && secureValues.includes(referrer!)

  return {
    header: 'Referrer-Policy',
    expected: 'strict-origin-when-cross-origin',
    actual: referrer || undefined,
    present,
    compliant,
    severity: 'low',
    recommendation: compliant ? undefined : 'Set Referrer-Policy to strict-origin-when-cross-origin for privacy'
  }
}

/**
 * Validate Permissions-Policy header
 */
export function validatePermissionsPolicyHeader(headers: Headers): SecurityHeaderCheck {
  const permissions = headers.get(SECURITY_HEADERS.PERMISSIONS_POLICY)
  const present = !!permissions

  // Basic validation - check if dangerous features are restricted
  let compliant = false
  if (present && permissions) {
    const hasCamera = permissions.includes('camera=()') || permissions.includes('camera=()')
    const hasMicrophone = permissions.includes('microphone=()') || permissions.includes('microphone=()')
    const hasGeolocation = permissions.includes('geolocation=()') || permissions.includes('geolocation=()')

    compliant = hasCamera || hasMicrophone || hasGeolocation // At least some restrictions
  }

  return {
    header: 'Permissions-Policy',
    expected: 'Restrictive policy for sensitive features',
    actual: permissions || undefined,
    present,
    compliant,
    severity: 'low',
    recommendation: compliant ? undefined : 'Add Permissions-Policy to control browser features'
  }
}

/**
 * Validate Cross-Origin headers
 */
export function validateCrossOriginHeaders(headers: Headers): SecurityHeaderCheck[] {
  const checks: SecurityHeaderCheck[] = []

  // Cross-Origin-Embedder-Policy
  const coep = headers.get(SECURITY_HEADERS.CROSS_ORIGIN_EMBEDDER_POLICY)
  checks.push({
    header: 'Cross-Origin-Embedder-Policy',
    expected: 'require-corp',
    actual: coep || undefined,
    present: !!coep,
    compliant: coep === 'require-corp',
    severity: 'low',
    recommendation: !coep ? 'Consider adding COEP for enhanced isolation' : undefined
  })

  // Cross-Origin-Opener-Policy
  const coop = headers.get(SECURITY_HEADERS.CROSS_ORIGIN_OPENER_POLICY)
  checks.push({
    header: 'Cross-Origin-Opener-Policy',
    expected: 'same-origin',
    actual: coop || undefined,
    present: !!coop,
    compliant: coop === 'same-origin',
    severity: 'low',
    recommendation: !coop ? 'Consider adding COOP for enhanced isolation' : undefined
  })

  // Cross-Origin-Resource-Policy
  const corp = headers.get(SECURITY_HEADERS.CROSS_ORIGIN_RESOURCE_POLICY)
  checks.push({
    header: 'Cross-Origin-Resource-Policy',
    expected: 'cross-origin',
    actual: corp || undefined,
    present: !!corp,
    compliant: !!corp,
    severity: 'low',
    recommendation: !corp ? 'Consider adding CORP for resource protection' : undefined
  })

  return checks
}

/**
 * Calculate overall security score based on header compliance
 */
export function calculateSecurityScore(checks: SecurityHeaderCheck[]): {
  score: number
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  breakdown: Record<string, number>
} {
  let totalScore = 0
  let maxScore = 0
  const breakdown: Record<string, number> = {}

  for (const check of checks) {
    const weight = HEADER_WEIGHTS[check.header.toLowerCase() as keyof typeof HEADER_WEIGHTS] || 5
    maxScore += weight

    if (check.compliant) {
      totalScore += weight
      breakdown[check.header] = weight
    } else if (check.present) {
      // Partial credit for presence but non-compliance
      const partialScore = Math.floor(weight * 0.3)
      totalScore += partialScore
      breakdown[check.header] = partialScore
    } else {
      breakdown[check.header] = 0
    }
  }

  const score = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  if (score >= 95) grade = 'A+'
  else if (score >= 85) grade = 'A'
  else if (score >= 75) grade = 'B'
  else if (score >= 65) grade = 'C'
  else if (score >= 55) grade = 'D'
  else grade = 'F'

  return { score, grade, breakdown }
}

/**
 * Generate security recommendations based on header analysis
 */
export function generateSecurityRecommendations(
  checks: SecurityHeaderCheck[]
): SecurityRecommendation[] {
  const recommendations: SecurityRecommendation[] = []

  for (const check of checks) {
    if (!check.compliant && check.recommendation) {
      const priority = check.severity === 'critical' ? 'critical' :
                      check.severity === 'high' ? 'high' :
                      check.severity === 'medium' ? 'medium' : 'low'

      recommendations.push({
        category: 'headers',
        priority: priority as any,
        title: `Fix ${check.header}`,
        description: check.recommendation,
        action: `Configure ${check.header} header properly`,
        impact: getSecurityImpact(check.header)
      })
    }
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

/**
 * Get security impact description for a header
 */
function getSecurityImpact(header: string): string {
  switch (header.toLowerCase()) {
    case 'strict-transport-security':
      return 'Prevents downgrade attacks and cookie hijacking'
    case 'content-security-policy':
      return 'Prevents XSS attacks and code injection'
    case 'x-frame-options':
      return 'Prevents clickjacking attacks'
    case 'x-content-type-options':
      return 'Prevents MIME sniffing attacks'
    case 'x-xss-protection':
      return 'Provides legacy XSS protection'
    case 'referrer-policy':
      return 'Improves privacy by controlling referrer information'
    case 'permissions-policy':
      return 'Controls access to browser features'
    default:
      return 'Enhances overall security posture'
  }
}

/**
 * Validate security headers configuration object
 */
export function validateSecurityHeadersConfig(config: SecurityHeadersConfig): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate HSTS
  if (config.strictTransportSecurity.maxAge < SECURITY_STANDARDS.HSTS_MIN_AGE) {
    errors.push(`HSTS max-age should be at least ${SECURITY_STANDARDS.HSTS_MIN_AGE} seconds`)
  }

  if (!config.strictTransportSecurity.includeSubDomains) {
    warnings.push('HSTS should include subdomains for comprehensive protection')
  }

  // Validate CSP
  if (!config.contentSecurityPolicy.directives['default-src']) {
    errors.push('CSP must include default-src directive')
  }

  if (!config.contentSecurityPolicy.directives['script-src']) {
    errors.push('CSP must include script-src directive')
  }

  if (config.contentSecurityPolicy.directives['script-src']?.includes("'unsafe-eval'")) {
    warnings.push("CSP script-src should avoid 'unsafe-eval'")
  }

  // Validate X-Frame-Options
  if (!['DENY', 'SAMEORIGIN'].includes(config.xFrameOptions)) {
    errors.push('X-Frame-Options must be DENY or SAMEORIGIN')
  }

  const isValid = errors.length === 0

  return { isValid, errors, warnings }
}

/**
 * Generate optimal security headers configuration
 */
export function generateOptimalSecurityHeadersConfig(): SecurityHeadersConfig {
  return {
    strictTransportSecurity: {
      maxAge: SECURITY_STANDARDS.HSTS_MIN_AGE,
      includeSubDomains: true,
      preload: true
    },
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "https://login.microsoftonline.com"],
        'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        'img-src': ["'self'", "data:", "https:"],
        'font-src': ["'self'", "data:", "https://fonts.gstatic.com"],
        'connect-src': ["'self'", "https://login.microsoftonline.com", "https://*.supabase.co"],
        'frame-src': ["'self'", "https://login.microsoftonline.com"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': []
      },
      reportUri: '/api/security/csp-report',
      reportOnly: false
    },
    xFrameOptions: 'DENY',
    xContentTypeOptions: true,
    xXSSProtection: {
      enabled: true,
      mode: 'block'
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
      payment: ["'none'"]
    },
    crossOriginEmbedderPolicy: 'require-corp',
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'cross-origin'
  }
}

/**
 * Convert security headers config to HTTP header strings
 */
export function configToHttpHeaders(config: SecurityHeadersConfig): Record<string, string> {
  const headers: Record<string, string> = {}

  // HSTS
  let hsts = `max-age=${config.strictTransportSecurity.maxAge}`
  if (config.strictTransportSecurity.includeSubDomains) {
    hsts += '; includeSubDomains'
  }
  if (config.strictTransportSecurity.preload) {
    hsts += '; preload'
  }
  headers['Strict-Transport-Security'] = hsts

  // CSP
  const cspDirectives = Object.entries(config.contentSecurityPolicy.directives)
    .map(([directive, sources]) => {
      if (sources.length === 0) {
        return directive
      }
      return `${directive} ${sources.join(' ')}`
    })
    .join('; ')
  headers['Content-Security-Policy'] = cspDirectives

  // Other headers
  headers['X-Frame-Options'] = config.xFrameOptions

  if (config.xContentTypeOptions) {
    headers['X-Content-Type-Options'] = 'nosniff'
  }

  if (config.xXSSProtection.enabled) {
    headers['X-XSS-Protection'] = config.xXSSProtection.mode === 'block' ? '1; mode=block' : '1'
  }

  headers['Referrer-Policy'] = config.referrerPolicy

  if (config.permissionsPolicy) {
    const permissionsDirectives = Object.entries(config.permissionsPolicy)
      .map(([feature, allowlist]) => `${feature}=(${allowlist.join(' ')})`)
      .join(', ')
    headers['Permissions-Policy'] = permissionsDirectives
  }

  if (config.crossOriginEmbedderPolicy) {
    headers['Cross-Origin-Embedder-Policy'] = config.crossOriginEmbedderPolicy
  }

  if (config.crossOriginOpenerPolicy) {
    headers['Cross-Origin-Opener-Policy'] = config.crossOriginOpenerPolicy
  }

  if (config.crossOriginResourcePolicy) {
    headers['Cross-Origin-Resource-Policy'] = config.crossOriginResourcePolicy
  }

  return headers
}

/**
 * Check if headers meet HIPAA compliance requirements
 */
export function checkHIPAACompliance(checks: SecurityHeaderCheck[]): {
  compliant: boolean
  requiredHeaders: string[]
  missingHeaders: string[]
  issues: string[]
} {
  const requiredHeaders = [
    'Strict-Transport-Security',
    'Content-Security-Policy',
    'X-Frame-Options',
    'X-Content-Type-Options'
  ]

  const presentHeaders = checks.filter(c => c.present).map(c => c.header)
  const missingHeaders = requiredHeaders.filter(h => !presentHeaders.includes(h))

  const issues: string[] = []

  // Check specific HIPAA requirements
  const hstsCheck = checks.find(c => c.header === 'Strict-Transport-Security')
  if (!hstsCheck?.compliant) {
    issues.push('HSTS not properly configured for PHI protection in transit')
  }

  const cspCheck = checks.find(c => c.header === 'Content-Security-Policy')
  if (!cspCheck?.compliant) {
    issues.push('CSP not properly configured to prevent data injection attacks')
  }

  const frameCheck = checks.find(c => c.header === 'X-Frame-Options')
  if (!frameCheck?.compliant) {
    issues.push('Frame options not configured to prevent UI redressing attacks')
  }

  const compliant = missingHeaders.length === 0 && issues.length === 0

  return {
    compliant,
    requiredHeaders,
    missingHeaders,
    issues
  }
}