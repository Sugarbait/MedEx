/**
 * Login Attempt Tracker
 * Manages failed login attempts and user blocking for security
 */

interface FailedAttempt {
  email: string
  timestamp: number
  attempts: number
  blockedUntil?: number
  lastAttempt: number
}

const STORAGE_KEY = 'failed_login_attempts'
const MAX_ATTEMPTS = 3
const BLOCK_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds for maximum security
const ATTEMPT_WINDOW = 30 * 60 * 1000 // 30 minutes window for attempts - User requested 30min reset

export class LoginAttemptTracker {
  /**
   * Record a failed login attempt
   */
  static recordFailedAttempt(email: string): {
    attemptsRemaining: number
    isBlocked: boolean
    blockedUntil?: number
    warning?: string
  } {
    const attempts = this.getFailedAttempts()
    const normalizedEmail = email.toLowerCase().trim()
    const now = Date.now()

    // Find existing record or create new one
    let userAttempt = attempts.find(a => a.email === normalizedEmail)

    if (!userAttempt) {
      userAttempt = {
        email: normalizedEmail,
        timestamp: now,
        attempts: 0,
        lastAttempt: now
      }
      attempts.push(userAttempt)
    }

    // Reset attempts if enough time has passed
    if (now - userAttempt.lastAttempt > ATTEMPT_WINDOW) {
      userAttempt.attempts = 0
      userAttempt.timestamp = now
    }

    // Increment attempts
    userAttempt.attempts++
    userAttempt.lastAttempt = now

    // Check if user should be blocked
    if (userAttempt.attempts >= MAX_ATTEMPTS) {
      userAttempt.blockedUntil = now + BLOCK_DURATION
    }

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts))

    const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - userAttempt.attempts)
    const isBlocked = userAttempt.blockedUntil ? now < userAttempt.blockedUntil : false

    // Generate warning message
    let warning = undefined
    if (isBlocked) {
      const blockedMinutes = Math.ceil((userAttempt.blockedUntil! - now) / (60 * 1000))
      const blockedHours = Math.floor(blockedMinutes / 60)
      const remainingMinutes = blockedMinutes % 60

      if (blockedHours > 0) {
        warning = `Account blocked for security. Try again in ${blockedHours}h ${remainingMinutes}m due to failed login attempts.`
      } else {
        warning = `Account blocked for security. Try again in ${blockedMinutes} minutes due to failed login attempts.`
      }
    } else if (attemptsRemaining <= 1) {
      warning = `Warning: ${attemptsRemaining} login attempt(s) remaining before account is temporarily blocked.`
    } else if (attemptsRemaining === 2) {
      warning = `Warning: Only 2 login attempts remaining before temporary account block.`
    }

    return {
      attemptsRemaining,
      isBlocked,
      blockedUntil: userAttempt.blockedUntil,
      warning
    }
  }

  /**
   * Check if a user is currently blocked
   */
  static isUserBlocked(email: string): {
    isBlocked: boolean
    blockedUntil?: number
    remainingTime?: number
  } {
    const attempts = this.getFailedAttempts()
    const normalizedEmail = email.toLowerCase().trim()
    const now = Date.now()

    const userAttempt = attempts.find(a => a.email === normalizedEmail)

    if (!userAttempt || !userAttempt.blockedUntil) {
      return { isBlocked: false }
    }

    // Check if block has expired
    if (now >= userAttempt.blockedUntil) {
      // Clear the block
      userAttempt.blockedUntil = undefined
      userAttempt.attempts = 0
      localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts))
      return { isBlocked: false }
    }

    return {
      isBlocked: true,
      blockedUntil: userAttempt.blockedUntil,
      remainingTime: userAttempt.blockedUntil - now
    }
  }

  /**
   * Clear failed attempts for a user (on successful login)
   */
  static clearFailedAttempts(email: string): void {
    const attempts = this.getFailedAttempts()
    const normalizedEmail = email.toLowerCase().trim()

    const filteredAttempts = attempts.filter(a => a.email !== normalizedEmail)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredAttempts))
  }

  /**
   * Get remaining attempts for a user
   */
  static getRemainingAttempts(email: string): number {
    const attempts = this.getFailedAttempts()
    const normalizedEmail = email.toLowerCase().trim()
    const now = Date.now()

    const userAttempt = attempts.find(a => a.email === normalizedEmail)

    if (!userAttempt) {
      return MAX_ATTEMPTS
    }

    // Reset if attempt window has passed
    if (now - userAttempt.lastAttempt > ATTEMPT_WINDOW) {
      return MAX_ATTEMPTS
    }

    return Math.max(0, MAX_ATTEMPTS - userAttempt.attempts)
  }

  /**
   * Emergency clear all failed attempts (admin function)
   */
  static emergencyClearAll(): void {
    localStorage.removeItem(STORAGE_KEY)
    console.log('All failed login attempts cleared')
  }

  /**
   * Emergency unblock a specific user (admin function)
   */
  static emergencyUnblock(email: string): void {
    this.clearFailedAttempts(email)
    console.log(`Unblocked user: ${email}`)
  }

  /**
   * Get all failed attempts (for debugging)
   */
  private static getFailedAttempts(): FailedAttempt[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return []

      const attempts = JSON.parse(stored) as FailedAttempt[]
      const now = Date.now()

      // Clean up expired blocks
      const cleaned = attempts.map(attempt => {
        if (attempt.blockedUntil && now >= attempt.blockedUntil) {
          const { blockedUntil, ...rest } = attempt
          return { ...rest, attempts: 0 }
        }
        return attempt
      })

      // Remove old attempts (older than 24 hours)
      const filtered = cleaned.filter(attempt =>
        now - attempt.timestamp < 24 * 60 * 60 * 1000
      )

      return filtered
    } catch (error) {
      console.error('Error reading failed login attempts:', error)
      return []
    }
  }

  /**
   * Get status for display purposes
   */
  static getAttemptStatus(email: string): {
    attempts: number
    maxAttempts: number
    isBlocked: boolean
    timeRemaining?: string
  } {
    const blockStatus = this.isUserBlocked(email)
    const remaining = this.getRemainingAttempts(email)

    let timeRemaining = undefined
    if (blockStatus.isBlocked && blockStatus.remainingTime) {
      const minutes = Math.ceil(blockStatus.remainingTime / (60 * 1000))
      timeRemaining = `${minutes} minute${minutes !== 1 ? 's' : ''}`
    }

    return {
      attempts: MAX_ATTEMPTS - remaining,
      maxAttempts: MAX_ATTEMPTS,
      isBlocked: blockStatus.isBlocked,
      timeRemaining
    }
  }
}

// Export to window for emergency admin use
if (typeof window !== 'undefined') {
  (window as any).LoginAttemptTracker = LoginAttemptTracker
  console.log('🔒 Login Attempt Tracker loaded. Emergency commands:')
  console.log('  - LoginAttemptTracker.emergencyClearAll() - Clear all failed attempts')
  console.log('  - LoginAttemptTracker.emergencyUnblock("email") - Unblock specific user')
  console.log('  - LoginAttemptTracker.getAttemptStatus("email") - Check user status')
}