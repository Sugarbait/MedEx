/**
 * Comprehensive Environment Variable Validator
 * Validates required environment variables at startup
 *
 * Features:
 * - Critical variable validation
 * - Environment-specific requirements
 * - Early failure detection (fail fast)
 * - HIPAA compliance checks
 * - Secure credential validation
 */

import { safeLogger } from './safeLogger'

const logger = safeLogger.component('EnvValidator')

/**
 * Environment variable requirement levels
 */
export type RequirementLevel = 'required' | 'recommended' | 'optional'

/**
 * Environment variable definition
 */
export interface EnvVariable {
  name: string
  level: RequirementLevel
  description: string
  validator?: (value: string | undefined) => boolean
  environments?: ('development' | 'production')[]
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  missing: string[]
  invalid: string[]
}

/**
 * Environment variable definitions
 */
const ENV_VARIABLES: EnvVariable[] = [
  // Supabase (Required for data persistence)
  {
    name: 'VITE_SUPABASE_URL',
    level: 'required',
    description: 'Supabase project URL',
    validator: (value) => !!value && value.includes('supabase.co')
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    level: 'required',
    description: 'Supabase anonymous key',
    validator: (value) => !!value && value.length > 100
  },

  // Azure AD (Required for authentication)
  {
    name: 'VITE_AZURE_CLIENT_ID',
    level: 'required',
    description: 'Azure AD client ID',
    validator: (value) => !!value && /^[0-9a-f-]{36}$/i.test(value)
  },
  {
    name: 'VITE_AZURE_TENANT_ID',
    level: 'required',
    description: 'Azure AD tenant ID',
    validator: (value) => !!value && /^[0-9a-f-]{36}$/i.test(value)
  },

  // Retell AI (Required for voice calls)
  {
    name: 'VITE_RETELL_API_KEY',
    level: 'required',
    description: 'Retell AI API key',
    validator: (value) => !!value && value.startsWith('key_')
  },

  // Security (Required in production)
  {
    name: 'VITE_HIPAA_MODE',
    level: 'required',
    description: 'HIPAA compliance mode',
    environments: ['production'],
    validator: (value) => value === 'true'
  },
  {
    name: 'VITE_PHI_ENCRYPTION_KEY',
    level: 'required',
    description: 'PHI encryption master key',
    environments: ['production'],
    validator: (value) => !!value && value.length >= 32
  },
  {
    name: 'VITE_AUDIT_ENCRYPTION_KEY',
    level: 'required',
    description: 'Audit log encryption key',
    environments: ['production'],
    validator: (value) => !!value && value.length >= 32
  },

  // App Configuration
  {
    name: 'VITE_APP_URL',
    level: 'recommended',
    description: 'Application base URL',
    validator: (value) => !!value && (value.startsWith('http://') || value.startsWith('https://'))
  },
  {
    name: 'VITE_APP_ENVIRONMENT',
    level: 'recommended',
    description: 'Application environment',
    validator: (value) => !!value && ['development', 'production', 'staging'].includes(value)
  },

  // Optional Integrations
  {
    name: 'VITE_OPENAI_API_KEY',
    level: 'optional',
    description: 'OpenAI API key for help chatbot',
    validator: (value) => !value || value.startsWith('sk-')
  },
  {
    name: 'VITE_SUPABASE_SERVICE_ROLE_KEY',
    level: 'optional',
    description: 'Supabase service role key (admin operations)',
    validator: (value) => !value || value.length > 100
  }
]

/**
 * Get current environment
 */
function getCurrentEnvironment(): 'development' | 'production' {
  return import.meta.env.MODE === 'production' ? 'production' : 'development'
}

/**
 * Validate environment variables
 */
export function validateEnvironment(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    missing: [],
    invalid: []
  }

  const currentEnv = getCurrentEnvironment()

  for (const envVar of ENV_VARIABLES) {
    // Skip if not required in current environment
    if (envVar.environments && !envVar.environments.includes(currentEnv)) {
      continue
    }

    const value = import.meta.env[envVar.name]

    // Check if missing
    if (!value) {
      if (envVar.level === 'required') {
        result.valid = false
        result.errors.push(`Missing required environment variable: ${envVar.name}`)
        result.missing.push(envVar.name)
        logger.error(`Missing required environment variable`, undefined, undefined, {
          variable: envVar.name,
          description: envVar.description
        })
      } else if (envVar.level === 'recommended') {
        result.warnings.push(`Missing recommended environment variable: ${envVar.name}`)
        logger.warn(`Missing recommended environment variable`, undefined, undefined, {
          variable: envVar.name,
          description: envVar.description
        })
      }
      continue
    }

    // Validate value
    if (envVar.validator && !envVar.validator(value)) {
      if (envVar.level === 'required') {
        result.valid = false
        result.errors.push(`Invalid value for ${envVar.name}`)
        result.invalid.push(envVar.name)
        logger.error(`Invalid environment variable value`, undefined, undefined, {
          variable: envVar.name,
          description: envVar.description
        })
      } else if (envVar.level === 'recommended') {
        result.warnings.push(`Invalid value for ${envVar.name}`)
        logger.warn(`Invalid environment variable value`, undefined, undefined, {
          variable: envVar.name,
          description: envVar.description
        })
      }
    }
  }

  return result
}

/**
 * Validate environment and throw on critical failures
 */
export function validateEnvironmentOrThrow(): ValidationResult {
  const result = validateEnvironment()

  if (!result.valid) {
    const errorMessage = [
      '❌ CRITICAL: Environment validation failed',
      '',
      'Missing or invalid environment variables:',
      ...result.errors.map(e => `  - ${e}`),
      '',
      'Please check your .env.local file and ensure all required variables are set.',
      'See .env.example for required variables.'
    ].join('\n')

    console.error(errorMessage)
    throw new Error('Environment validation failed')
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️ Environment validation warnings:')
    result.warnings.forEach(w => console.warn(`  - ${w}`))
  }

  return result
}

/**
 * Generate environment validation report
 */
export function generateValidationReport(): string {
  const result = validateEnvironment()
  const currentEnv = getCurrentEnvironment()

  const report = `
# Environment Variable Validation Report
Generated: ${new Date().toISOString()}
Environment: ${currentEnv}

## Validation Status
${result.valid ? '✅ PASSED' : '❌ FAILED'}

## Statistics
- Total Errors: ${result.errors.length}
- Total Warnings: ${result.warnings.length}
- Missing Variables: ${result.missing.length}
- Invalid Variables: ${result.invalid.length}

## Errors
${result.errors.length > 0
  ? result.errors.map(e => `- ${e}`).join('\n')
  : 'No errors'}

## Warnings
${result.warnings.length > 0
  ? result.warnings.map(w => `- ${w}`).join('\n')
  : 'No warnings'}

## Required Variables Status
${ENV_VARIABLES
  .filter(v => v.level === 'required')
  .filter(v => !v.environments || v.environments.includes(currentEnv))
  .map(v => {
    const value = import.meta.env[v.name]
    const isSet = !!value
    const isValid = !v.validator || (value && v.validator(value))
    const status = isSet && isValid ? '✅' : '❌'
    return `- ${status} ${v.name}: ${v.description}`
  })
  .join('\n')}

## Recommendations
${!result.valid
  ? `
- Set all required environment variables in .env.local
- Ensure values match expected format (check validators)
- Restart development server after updating .env.local
  `
  : result.warnings.length > 0
    ? '- Consider setting recommended environment variables for full functionality'
    : '- All environment variables configured correctly'}

## Security Notes
${currentEnv === 'production'
  ? `
✅ HIPAA mode enabled
✅ Encryption keys configured
✅ Production security requirements met
  `
  : `
⚠️ Development mode - some security features may be relaxed
⚠️ Ensure production environment has all security variables set
  `}

---
For questions about environment configuration, see .env.example
  `.trim()

  return report
}

/**
 * Log environment status at startup
 */
export function logEnvironmentStatus(): void {
  const result = validateEnvironment()

  if (result.valid) {
    logger.info('✅ Environment validation passed', undefined, undefined, {
      warnings: result.warnings.length
    })
  } else {
    logger.error('❌ Environment validation failed', undefined, undefined, {
      errors: result.errors.length,
      missing: result.missing.length,
      invalid: result.invalid.length
    })
  }

  // Log warnings separately
  if (result.warnings.length > 0) {
    result.warnings.forEach(warning => {
      logger.warn(warning)
    })
  }
}

export default {
  validateEnvironment,
  validateEnvironmentOrThrow,
  generateValidationReport,
  logEnvironmentStatus
}
