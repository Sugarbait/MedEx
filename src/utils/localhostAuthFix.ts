// Localhost-specific authentication fix for login loop issues
// Addresses MSAL and logout flag timing issues specific to localhost development environment

interface LocalhostAuthFixConfig {
  maxFlagDuration: number;
  checkInterval: number;
  aggressiveCleanup: boolean;
  isLocalhost: boolean;
}

class LocalhostAuthFix {
  private config: LocalhostAuthFixConfig;
  private checkTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor() {
    this.config = {
      maxFlagDuration: 15000, // 15 seconds - allow proper logout flow
      checkInterval: 5000,    // Check every 5 seconds - less aggressive
      aggressiveCleanup: true,
      isLocalhost: this.detectLocalhostEnvironment()
    };

    this.initialize();
  }

  private detectLocalhostEnvironment(): boolean {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' ||
                       hostname === '127.0.0.1' ||
                       hostname.startsWith('localhost:') ||
                       hostname === '::1';

    console.log('🏠 LocalhostAuthFix: Localhost environment detected:', isLocalhost);
    return isLocalhost;
  }

  private initialize(): void {
    if (!this.config.isLocalhost) {
      console.log('ℹ️ LocalhostAuthFix: Not localhost environment, skipping localhost-specific fixes');
      return;
    }

    if (this.initialized) return;
    this.initialized = true;

    console.log('🔧 LocalhostAuthFix: Initializing localhost authentication fixes...');

    // Immediate check on page load
    this.performImmediateCheck();

    // Start aggressive monitoring
    this.startAggressiveMonitoring();

    // Setup event listeners for localhost-specific scenarios
    this.setupLocalhostEventListeners();

    console.log('✅ LocalhostAuthFix: Localhost authentication enhancement active');
  }

  private performImmediateCheck(): void {
    const logoutFlag = localStorage.getItem('justLoggedOut');
    const flagTimestamp = localStorage.getItem('justLoggedOutTimestamp');
    const currentUser = localStorage.getItem('currentUser');
    const freshMfaVerified = localStorage.getItem('freshMfaVerified');

    console.log('🔍 LocalhostAuthFix: Immediate check - logout flag:', logoutFlag, 'user:', !!currentUser, 'mfa:', !!freshMfaVerified);

    // CRITICAL: Don't interfere if user is actively logged in or has valid MFA session
    if (currentUser || freshMfaVerified) {
      console.log('🚦 LocalhostAuthFix: Active user session detected - skipping all cleanup');
      return;
    }

    if (logoutFlag === 'true') {
      // Check if this is a fresh logout (within 10 seconds) - if so, don't interfere
      if (flagTimestamp) {
        const timeElapsed = Date.now() - parseInt(flagTimestamp);
        if (timeElapsed < 10000) { // Less than 10 seconds - let normal logout flow complete
          console.log('🚦 LocalhostAuthFix: Recent logout detected, allowing normal flow for', (10000 - timeElapsed), 'ms');
          return;
        }
      }

      console.log('🚨 LocalhostAuthFix: Found stuck logout flag - scheduling cleanup');

      // Only cleanup if the logout has been stuck for a while
      setTimeout(() => {
        this.cleanupLocalhostAuth();
      }, 8000); // Wait 8 seconds to allow normal logout flow
    }

    // Also check for any MSAL-related issues immediately
    this.checkForMSALIssues();
  }

  private startAggressiveMonitoring(): void {
    this.checkTimer = setInterval(() => {
      const logoutFlag = localStorage.getItem('justLoggedOut');

      if (logoutFlag === 'true') {
        const flagTimestamp = localStorage.getItem('justLoggedOutTimestamp');
        const currentTime = Date.now();

        if (!flagTimestamp) {
          // Set timestamp immediately
          localStorage.setItem('justLoggedOutTimestamp', currentTime.toString());
          console.log('⏰ LocalhostAuthFix: Set logout flag timestamp');

          // On localhost, also start cleanup timer immediately
          setTimeout(() => {
            this.cleanupLocalhostAuth();
          }, this.config.maxFlagDuration);
          return;
        }

        const timeElapsed = currentTime - parseInt(flagTimestamp);

        // Only cleanup if logout has been stuck for more than 15 seconds (to allow normal logout flow)
        if (timeElapsed > 15000) {
          console.log('🧹 LocalhostAuthFix: Cleaning up stuck logout flag after', timeElapsed, 'ms');
          this.cleanupLocalhostAuth();
        } else if (timeElapsed > 10000) {
          console.log('🚦 LocalhostAuthFix: Logout flag aged', timeElapsed, 'ms - monitoring...');
        }
      }
    }, this.config.checkInterval);

    console.log('⏰ LocalhostAuthFix: Started aggressive monitoring every', this.config.checkInterval, 'ms');
  }

  private checkForMSALIssues(): void {
    // Check for common MSAL issues on localhost
    const msalKeys = Object.keys(localStorage).filter(key => key.startsWith('msal.'));

    if (msalKeys.length > 0) {
      console.log('🔍 LocalhostAuthFix: Found MSAL keys:', msalKeys.length);

      // Check for specific problematic keys
      const problematicKeys = [
        'msal.interaction.status',
        'msal.request.state',
        'msal.error',
        'msal.token.renewal.error'
      ];

      problematicKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          console.log('🚨 LocalhostAuthFix: Found problematic MSAL key:', key);
          localStorage.removeItem(key);
          console.log('🧹 LocalhostAuthFix: Cleared problematic MSAL key:', key);
        }
      });
    }
  }

  private setupLocalhostEventListeners(): void {
    // Handle page focus - important for localhost development
    window.addEventListener('focus', () => {
      console.log('🎯 LocalhostAuthFix: Window focused, checking auth state...');
      setTimeout(() => this.performImmediateCheck(), 500);
    });

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ LocalhostAuthFix: Page visible, checking auth state...');
        setTimeout(() => this.performImmediateCheck(), 500);
      }
    });

    // Handle storage events from other tabs
    window.addEventListener('storage', (event) => {
      if (event.key === 'justLoggedOut' && event.newValue === 'true') {
        console.log('🔄 LocalhostAuthFix: Logout detected from another tab');
        setTimeout(() => this.cleanupLocalhostAuth(), 2000);
      }
    });

    // Handle beforeunload to clean up
    window.addEventListener('beforeunload', () => {
      if (localStorage.getItem('justLoggedOut') === 'true') {
        console.log('🧹 LocalhostAuthFix: Page unloading, ensuring cleanup');
        this.cleanupLocalhostAuth();
      }
    });
  }

  private cleanupLocalhostAuth(): void {
    console.log('🧹 LocalhostAuthFix: Starting localhost authentication cleanup...');

    try {
      // Check if this is a forced logout to login page - don't cleanup if so
      const forceLoginPage = localStorage.getItem('forceLoginPage');
      if (forceLoginPage === 'true') {
        console.log('🚦 LocalhostAuthFix: Force login page detected - respecting logout flow');
        return; // Don't cleanup when user explicitly logged out
      }

      // CRITICAL: Don't cleanup if user has MFA session or is actively logging in
      const freshMfaVerified = localStorage.getItem('freshMfaVerified');
      const currentUser = localStorage.getItem('currentUser');
      if (freshMfaVerified || currentUser) {
        console.log('🚦 LocalhostAuthFix: Active MFA session or user detected - skipping cleanup to prevent login disruption');
        return; // Don't cleanup during active sessions
      }

      // Clear the logout flags only if it's a stuck login situation
      localStorage.removeItem('justLoggedOut');
      localStorage.removeItem('justLoggedOutTimestamp');

      // Clear any session data that might interfere
      sessionStorage.removeItem('appInitialized');
      sessionStorage.removeItem('spa-redirect-path');
      sessionStorage.removeItem('authRedirect');

      // Clear MSAL cache issues specific to localhost
      this.clearLocalhostMSALCache();

      // Clear any other problematic flags
      localStorage.removeItem('authenticationInProgress');
      localStorage.removeItem('loginAttempt');

      console.log('✅ LocalhostAuthFix: Localhost authentication cleanup completed');

      // Show notification
      this.showLocalhostNotification();

      // Emit event for other components
      window.dispatchEvent(new CustomEvent('localhostAuthFixed', {
        detail: { timestamp: Date.now(), type: 'localhost_cleanup' }
      }));

    } catch (error) {
      console.error('❌ LocalhostAuthFix: Cleanup error:', error);
    }
  }

  private clearLocalhostMSALCache(): void {
    // More aggressive MSAL cleanup for localhost
    const allMsalKeys = Object.keys(localStorage).filter(key => key.startsWith('msal.'));

    allMsalKeys.forEach(key => {
      // On localhost, clear more MSAL keys than in production
      if (key.includes('interaction') ||
          key.includes('request') ||
          key.includes('error') ||
          key.includes('token.renewal') ||
          key.includes('authority') ||
          key.includes('environment')) {
        localStorage.removeItem(key);
        console.log('🧹 LocalhostAuthFix: Cleared MSAL key:', key);
      }
    });

    // Clear session storage MSAL data too
    const sessionMsalKeys = Object.keys(sessionStorage).filter(key => key.startsWith('msal.'));
    sessionMsalKeys.forEach(key => {
      sessionStorage.removeItem(key);
      console.log('🧹 LocalhostAuthFix: Cleared session MSAL key:', key);
    });
  }

  private showLocalhostNotification(): void {
    // Create localhost-specific notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #059669, #10b981);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      max-width: 400px;
      text-align: center;
      opacity: 0;
      transition: all 0.4s ease;
      border-left: 4px solid #fbbf24;
    `;

    notification.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <span style="font-size: 16px;">🏠</span>
        <span>Localhost login fixed! Try logging in again.</span>
      </div>
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(-50%) translateY(0)';
    }, 100);

    // Auto remove
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 400);
    }, 4000);
  }

  // Public methods for emergency use
  public emergencyReset(): void {
    console.log('🚨 LocalhostAuthFix: Emergency reset requested');

    // Clear everything
    localStorage.removeItem('justLoggedOut');
    localStorage.removeItem('justLoggedOutTimestamp');
    sessionStorage.clear();

    // Clear all MSAL data
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('msal.')) {
        localStorage.removeItem(key);
      }
    });

    this.showLocalhostNotification();
    console.log('✅ LocalhostAuthFix: Emergency reset completed');
  }

  public forceReload(): void {
    console.log('🔄 LocalhostAuthFix: Force reload requested');
    this.cleanupLocalhostAuth();
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }

  public getStatus(): object {
    return {
      isLocalhost: this.config.isLocalhost,
      logoutFlag: localStorage.getItem('justLoggedOut'),
      flagTimestamp: localStorage.getItem('justLoggedOutTimestamp'),
      flagAge: localStorage.getItem('justLoggedOutTimestamp')
        ? Date.now() - parseInt(localStorage.getItem('justLoggedOutTimestamp')!)
        : null,
      maxDuration: this.config.maxFlagDuration,
      monitoringActive: this.checkTimer !== null,
      msalKeys: Object.keys(localStorage).filter(key => key.startsWith('msal.')).length
    };
  }

  public destroy(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    this.initialized = false;
    console.log('🔧 LocalhostAuthFix: Monitoring stopped');
  }
}

// Initialize for localhost environment
const localhostAuthFix = new LocalhostAuthFix();

// Export for external access
export { LocalhostAuthFix };
export default localhostAuthFix;

// Add to window for console access
if (typeof window !== 'undefined') {
  (window as any).localhostAuthFix = localhostAuthFix;
}