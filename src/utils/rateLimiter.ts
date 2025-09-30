/**
 * Universal Rate Limiter
 * Prevents API abuse and DoS attacks across all services
 *
 * Features:
 * - Token bucket algorithm for smooth rate limiting
 * - Per-user rate limiting with unique identifiers
 * - Configurable limits and time windows
 * - Automatic token refill over time
 * - Memory-efficient with automatic cleanup
 * - HIPAA-compliant logging (no PHI in logs)
 */

import { safeLogger } from './safeLogger'

const logger = safeLogger.component('RateLimiter')

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  maxRequests: number

  /** Time window in milliseconds */
  windowMs: number

  /** Optional identifier for this rate limiter */
  identifier?: string

  /** Callback when rate limit is exceeded */
  onLimitExceeded?: (userId: string, remainingTime: number) => void
}

/**
 * Token bucket for a single user
 */
interface TokenBucket {
  /** Number of tokens remaining */
  tokens: number

  /** Last time tokens were refilled */
  lastRefill: number

  /** Rate limit exceeded count for monitoring */
  violations: number
}

/**
 * Rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map()
  private config: Required<RateLimitConfig>
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(config: RateLimitConfig) {
    this.config = {
      identifier: 'default',
      onLimitExceeded: () => {},
      ...config
    }

    // Start automatic cleanup of old buckets (every 5 minutes)
    this.startCleanup()

    logger.debug(`Rate limiter initialized: ${this.config.identifier}`, {
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs
    })
  }

  /**
   * Check if request is allowed for user
   */
  checkLimit(userId: string): { allowed: boolean; remainingTime?: number; remaining?: number } {
    const now = Date.now()
    let bucket = this.buckets.get(userId)

    // Create new bucket if doesn't exist
    if (!bucket) {
      bucket = {
        tokens: this.config.maxRequests,
        lastRefill: now,
        violations: 0
      }
      this.buckets.set(userId, bucket)
    }

    // Refill tokens based on time elapsed
    this.refillTokens(bucket, now)

    // Check if tokens available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1

      logger.debug(`Rate limit check passed for user`, {
        limiter: this.config.identifier,
        remaining: Math.floor(bucket.tokens)
      })

      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens)
      }
    }

    // Rate limit exceeded
    bucket.violations++
    const remainingTime = this.getRemainingTime(bucket)

    logger.warn(`Rate limit exceeded for user`, {
      limiter: this.config.identifier,
      violations: bucket.violations,
      remainingTime: Math.ceil(remainingTime / 1000)
    })

    this.config.onLimitExceeded(userId, remainingTime)

    return {
      allowed: false,
      remainingTime,
      remaining: 0
    }
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refillTokens(bucket: TokenBucket, now: number): void {
    const timePassed = now - bucket.lastRefill
    const refillRate = this.config.maxRequests / this.config.windowMs
    const tokensToAdd = timePassed * refillRate

    if (tokensToAdd >= 1) {
      bucket.tokens = Math.min(
        bucket.tokens + Math.floor(tokensToAdd),
        this.config.maxRequests
      )
      bucket.lastRefill = now
    }
  }

  /**
   * Get remaining time until tokens are available
   */
  private getRemainingTime(bucket: TokenBucket): number {
    const now = Date.now()
    const timeSinceRefill = now - bucket.lastRefill
    const timeUntilNextToken = this.config.windowMs / this.config.maxRequests
    return Math.max(0, timeUntilNextToken - timeSinceRefill)
  }

  /**
   * Get current rate limit status for user
   */
  getStatus(userId: string): { tokens: number; violations: number } {
    const bucket = this.buckets.get(userId)
    if (!bucket) {
      return { tokens: this.config.maxRequests, violations: 0 }
    }

    // Refill tokens first
    this.refillTokens(bucket, Date.now())

    return {
      tokens: Math.floor(bucket.tokens),
      violations: bucket.violations
    }
  }

  /**
   * Reset rate limit for user
   */
  reset(userId: string): void {
    this.buckets.delete(userId)
    logger.info(`Rate limit reset for user`, {
      limiter: this.config.identifier
    })
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    const count = this.buckets.size
    this.buckets.clear()
    logger.info(`All rate limits reset`, {
      limiter: this.config.identifier,
      count
    })
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): {
    totalUsers: number
    violationsTotal: number
    highViolationUsers: number
  } {
    let violationsTotal = 0
    let highViolationUsers = 0

    for (const bucket of this.buckets.values()) {
      violationsTotal += bucket.violations
      if (bucket.violations > 10) {
        highViolationUsers++
      }
    }

    return {
      totalUsers: this.buckets.size,
      violationsTotal,
      highViolationUsers
    }
  }

  /**
   * Start automatic cleanup of old buckets
   */
  private startCleanup(): void {
    // Clean up buckets older than 2x the window (inactive users)
    const cleanupInterval = Math.max(this.config.windowMs * 2, 5 * 60 * 1000) // Min 5 minutes

    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      const maxAge = this.config.windowMs * 2
      let cleaned = 0

      for (const [userId, bucket] of this.buckets.entries()) {
        if (now - bucket.lastRefill > maxAge) {
          this.buckets.delete(userId)
          cleaned++
        }
      }

      if (cleaned > 0) {
        logger.debug(`Cleaned up inactive rate limit buckets`, {
          limiter: this.config.identifier,
          cleaned,
          remaining: this.buckets.size
        })
      }
    }, cleanupInterval)
  }

  /**
   * Stop cleanup and destroy rate limiter
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.buckets.clear()
    logger.info(`Rate limiter destroyed`, {
      limiter: this.config.identifier
    })
  }
}

/**
 * Create preconfigured rate limiters for common use cases
 */
export const RateLimitPresets = {
  /**
   * Strict rate limit for sensitive operations (MFA, password reset)
   * 5 requests per 15 minutes
   */
  strict: (identifier: string): RateLimiter => new RateLimiter({
    identifier,
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    onLimitExceeded: (userId, remainingTime) => {
      logger.warn(`Strict rate limit exceeded`, {
        identifier,
        remainingTime: Math.ceil(remainingTime / 1000)
      })
    }
  }),

  /**
   * Moderate rate limit for API operations
   * 100 requests per minute
   */
  moderate: (identifier: string): RateLimiter => new RateLimiter({
    identifier,
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    onLimitExceeded: (userId, remainingTime) => {
      logger.warn(`Moderate rate limit exceeded`, {
        identifier,
        remainingTime: Math.ceil(remainingTime / 1000)
      })
    }
  }),

  /**
   * Generous rate limit for frequent operations
   * 300 requests per minute
   */
  generous: (identifier: string): RateLimiter => new RateLimiter({
    identifier,
    maxRequests: 300,
    windowMs: 60 * 1000, // 1 minute
    onLimitExceeded: (userId, remainingTime) => {
      logger.warn(`Generous rate limit exceeded`, {
        identifier,
        remainingTime: Math.ceil(remainingTime / 1000)
      })
    }
  }),

  /**
   * Hourly rate limit for expensive operations
   * 60 requests per hour
   */
  hourly: (identifier: string): RateLimiter => new RateLimiter({
    identifier,
    maxRequests: 60,
    windowMs: 60 * 60 * 1000, // 1 hour
    onLimitExceeded: (userId, remainingTime) => {
      logger.warn(`Hourly rate limit exceeded`, {
        identifier,
        remainingTime: Math.ceil(remainingTime / 60000)
      })
    }
  })
}

/**
 * Decorator for rate-limited async functions
 */
export function rateLimit(limiter: RateLimiter) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (this: any, ...args: any[]) {
      // Get user ID from context (first arg should be userId or object with userId)
      const userId = typeof args[0] === 'string' ? args[0] : args[0]?.userId

      if (!userId) {
        logger.error(`Rate limiter requires userId`, {
          method: propertyKey
        })
        throw new Error('User ID required for rate limiting')
      }

      const check = limiter.checkLimit(userId)
      if (!check.allowed) {
        const error = new Error(
          `Rate limit exceeded. Please try again in ${Math.ceil((check.remainingTime || 0) / 1000)} seconds.`
        )
        logger.warn(`Rate limit blocked method call`, {
          method: propertyKey
        })
        throw error
      }

      return originalMethod.apply(this, args)
    }

    return descriptor
  }
}

export default RateLimiter