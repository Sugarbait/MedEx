/**
 * Browser Session Tracker with User Agent Authentication
 * Prevents MFA bypass by tracking browser sessions and logout state
 */

interface BrowserSession {
  userAgent: string;
  sessionId: string;
  lastLogout: number | null;
  isLoggedOut: boolean;
  createdAt: number;
}

class BrowserSessionTracker {
  private readonly STORAGE_KEY = 'browser_session_tracker';
  private readonly SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private readonly LOGOUT_PROTECTION_TIME = 30 * 60 * 1000; // 30 minutes

  private currentUserAgent: string;
  private sessionId: string;

  constructor() {
    this.currentUserAgent = navigator.userAgent;
    this.sessionId = this.generateSessionId();
    this.cleanupExpiredSessions();
  }

  /**
   * Generate a unique session ID combining user agent hash and timestamp
   */
  private generateSessionId(): string {
    const userAgentHash = this.hashString(this.currentUserAgent);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${userAgentHash}_${timestamp}_${random}`;
  }

  /**
   * Simple hash function for user agent
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get all stored browser sessions
   */
  private getSessions(): BrowserSession[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to parse browser sessions:', error);
      return [];
    }
  }

  /**
   * Save browser sessions to localStorage
   */
  private saveSessions(sessions: BrowserSession[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.warn('Failed to save browser sessions:', error);
    }
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const sessions = this.getSessions();
    const now = Date.now();
    const validSessions = sessions.filter(session =>
      now - session.createdAt < this.SESSION_EXPIRY
    );

    if (validSessions.length !== sessions.length) {
      this.saveSessions(validSessions);
      console.log(`🧹 Cleaned up ${sessions.length - validSessions.length} expired browser sessions`);
    }
  }

  /**
   * Find current browser session based on user agent
   */
  private getCurrentSession(): BrowserSession | null {
    const sessions = this.getSessions();
    return sessions.find(session =>
      session.userAgent === this.currentUserAgent
    ) || null;
  }

  /**
   * Record logout for current browser/user agent
   */
  recordLogout(): void {
    const sessions = this.getSessions();
    const now = Date.now();

    // Find existing session for this user agent
    const existingIndex = sessions.findIndex(session =>
      session.userAgent === this.currentUserAgent
    );

    const logoutSession: BrowserSession = {
      userAgent: this.currentUserAgent,
      sessionId: this.sessionId,
      lastLogout: now,
      isLoggedOut: true,
      createdAt: existingIndex >= 0 ? sessions[existingIndex].createdAt : now
    };

    if (existingIndex >= 0) {
      sessions[existingIndex] = logoutSession;
    } else {
      sessions.push(logoutSession);
    }

    this.saveSessions(sessions);
    console.log('🚪 Browser session logout recorded for user agent:', this.currentUserAgent.substring(0, 50) + '...');
  }

  /**
   * Clear logout state after successful login
   */
  clearLogoutState(): void {
    const sessions = this.getSessions();
    const sessionIndex = sessions.findIndex(session =>
      session.userAgent === this.currentUserAgent
    );

    if (sessionIndex >= 0) {
      sessions[sessionIndex].isLoggedOut = false;
      sessions[sessionIndex].lastLogout = null;
      this.saveSessions(sessions);
      console.log('✅ Browser session logout state cleared for successful login');
    }
  }

  /**
   * Check if current browser should be forced to login page
   */
  shouldForceLogin(): boolean {
    const session = this.getCurrentSession();

    if (!session) {
      // No session record - this is a fresh browser, allow normal flow
      console.log('🆕 No browser session found - fresh browser detected');
      return false;
    }

    if (!session.isLoggedOut || !session.lastLogout) {
      // Session exists but user hasn't logged out - allow normal flow
      return false;
    }

    const timeSinceLogout = Date.now() - session.lastLogout;
    const shouldForce = timeSinceLogout < this.LOGOUT_PROTECTION_TIME;

    if (shouldForce) {
      console.log(`🚫 Browser logout protection active - ${Math.round(timeSinceLogout / 60000)} minutes since logout`);
      console.log('🔒 Forcing login page to prevent MFA bypass');
      return true;
    } else {
      console.log(`⏰ Logout protection expired - ${Math.round(timeSinceLogout / 60000)} minutes since logout`);
      // Auto-clear the logout state after protection period
      this.clearLogoutState();
      return false;
    }
  }

  /**
   * Get debug information about current browser session
   */
  getDebugInfo(): object {
    const session = this.getCurrentSession();
    const allSessions = this.getSessions();

    return {
      currentUserAgent: this.currentUserAgent.substring(0, 100) + '...',
      sessionId: this.sessionId,
      currentSession: session,
      totalSessions: allSessions.length,
      shouldForceLogin: this.shouldForceLogin(),
      protectionTimeRemaining: session?.lastLogout
        ? Math.max(0, this.LOGOUT_PROTECTION_TIME - (Date.now() - session.lastLogout))
        : 0
    };
  }

  /**
   * Force clear all browser session data (for debugging)
   */
  clearAllSessions(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('🧹 All browser session data cleared');
  }
}

// Export singleton instance
export const browserSessionTracker = new BrowserSessionTracker();

// Make available for debugging
if (typeof window !== 'undefined') {
  (window as any).browserSessionTracker = browserSessionTracker;
}