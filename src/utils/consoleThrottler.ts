/**
 * Console Message Throttling Utility
 *
 * Helps reduce console spam by throttling repeated error messages
 * and providing silent modes for background operations.
 */

interface ThrottledMessage {
  lastShown: number;
  count: number;
  suppressUntil: number;
}

class ConsoleThrottler {
  private messageHistory = new Map<string, ThrottledMessage>();
  private readonly DEFAULT_THROTTLE_TIME = 30000; // 30 seconds
  private readonly DEFAULT_MAX_REPEATS = 3;
  private readonly DEFAULT_SUPPRESS_TIME = 300000; // 5 minutes

  /**
   * Log a message with throttling to prevent spam
   */
  throttledWarn(messageKey: string, message: string, details?: any): void {
    const now = Date.now();
    const history = this.messageHistory.get(messageKey) || {
      lastShown: 0,
      count: 0,
      suppressUntil: 0
    };

    // If we're in suppression period, don't show the message
    if (now < history.suppressUntil) {
      return;
    }

    // If enough time has passed, reset the count
    if (now - history.lastShown > this.DEFAULT_THROTTLE_TIME) {
      history.count = 0;
    }

    history.count++;
    history.lastShown = now;

    // Show the message for the first few occurrences
    if (history.count <= this.DEFAULT_MAX_REPEATS) {
      if (history.count === 1) {
        console.warn(message, details);
      } else {
        console.warn(`${message} (${history.count}/${this.DEFAULT_MAX_REPEATS})`, details);
      }
    }

    // If we've hit the max repeats, suppress for a longer period
    if (history.count === this.DEFAULT_MAX_REPEATS) {
      history.suppressUntil = now + this.DEFAULT_SUPPRESS_TIME;
      console.warn(`🔇 Suppressing "${messageKey}" messages for ${this.DEFAULT_SUPPRESS_TIME / 1000} seconds to reduce console spam`);
    }

    this.messageHistory.set(messageKey, history);
  }

  /**
   * Log an error with throttling
   */
  throttledError(messageKey: string, message: string, details?: any): void {
    const now = Date.now();
    const history = this.messageHistory.get(messageKey) || {
      lastShown: 0,
      count: 0,
      suppressUntil: 0
    };

    // If we're in suppression period, don't show the message
    if (now < history.suppressUntil) {
      return;
    }

    // If enough time has passed, reset the count
    if (now - history.lastShown > this.DEFAULT_THROTTLE_TIME) {
      history.count = 0;
    }

    history.count++;
    history.lastShown = now;

    // Show the message for the first few occurrences
    if (history.count <= this.DEFAULT_MAX_REPEATS) {
      if (history.count === 1) {
        console.error(message, details);
      } else {
        console.error(`${message} (${history.count}/${this.DEFAULT_MAX_REPEATS})`, details);
      }
    }

    // If we've hit the max repeats, suppress for a longer period
    if (history.count === this.DEFAULT_MAX_REPEATS) {
      history.suppressUntil = now + this.DEFAULT_SUPPRESS_TIME;
      console.warn(`🔇 Suppressing "${messageKey}" error messages for ${this.DEFAULT_SUPPRESS_TIME / 1000} seconds to reduce console spam`);
    }

    this.messageHistory.set(messageKey, history);
  }

  /**
   * Reset throttling for a specific message key
   */
  resetThrottling(messageKey: string): void {
    this.messageHistory.delete(messageKey);
  }

  /**
   * Reset all throttling
   */
  resetAllThrottling(): void {
    this.messageHistory.clear();
  }

  /**
   * Check if a message is currently being suppressed
   */
  isMessageSuppressed(messageKey: string): boolean {
    const history = this.messageHistory.get(messageKey);
    if (!history) return false;

    const now = Date.now();
    return now < history.suppressUntil;
  }

  /**
   * Get statistics about throttled messages
   */
  getThrottleStats(): Record<string, { count: number; suppressed: boolean; suppressedUntil?: number }> {
    const stats: Record<string, { count: number; suppressed: boolean; suppressedUntil?: number }> = {};
    const now = Date.now();

    for (const [key, history] of this.messageHistory.entries()) {
      stats[key] = {
        count: history.count,
        suppressed: now < history.suppressUntil,
        suppressedUntil: history.suppressUntil > now ? history.suppressUntil : undefined
      };
    }

    return stats;
  }
}

// Export singleton instance
export const consoleThrottler = new ConsoleThrottler();

/**
 * Helper function for throttled warnings
 */
export function throttledWarn(messageKey: string, message: string, details?: any): void {
  consoleThrottler.throttledWarn(messageKey, message, details);
}

/**
 * Helper function for throttled errors
 */
export function throttledError(messageKey: string, message: string, details?: any): void {
  consoleThrottler.throttledError(messageKey, message, details);
}

/**
 * Silent background operation logger
 * Logs success messages normally but throttles error messages heavily
 */
export function backgroundOperationLog(
  operation: string,
  success: boolean,
  message: string,
  details?: any
): void {
  if (success) {
    console.log(`✅ ${operation}: ${message}`, details);
  } else {
    throttledWarn(`background-${operation}`, `⚠️ ${operation}: ${message}`, details);
  }
}