// Authentication Flow Enhancement Service
// Works alongside locked logout system to fix Azure timing issues
// Does NOT modify protected authentication code

export class AuthFlowEnhancer {
  private static instance: AuthFlowEnhancer | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  public static getInstance(): AuthFlowEnhancer {
    if (!AuthFlowEnhancer.instance) {
      AuthFlowEnhancer.instance = new AuthFlowEnhancer();
    }
    return AuthFlowEnhancer.instance;
  }

  /**
   * Initialize the authentication flow enhancer
   * Monitors for stuck logout flags and provides user guidance
   */
  public initialize(): void {
    console.log('🔧 AuthFlowEnhancer: Initializing authentication flow monitoring...');

    // Start monitoring for stuck logout flags
    this.startLogoutFlagMonitoring();

    // Add page visibility change handler for Azure environment
    this.setupPageVisibilityHandler();

    // Setup automatic cleanup on page load
    this.setupPageLoadCleanup();

    console.log('✅ AuthFlowEnhancer: Authentication flow enhancement active');
  }

  /**
   * Monitor for stuck justLoggedOut flags that prevent login
   * Automatically cleans up after extended period in Azure environment
   */
  private startLogoutFlagMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log('🔍 AuthFlowEnhancer: Starting logout flag monitoring...');

    // Check every 30 seconds for stuck logout flags
    this.monitoringInterval = setInterval(() => {
      const logoutFlag = localStorage.getItem('justLoggedOut');

      if (logoutFlag === 'true') {
        // Check how long the flag has been set
        const flagSetTime = localStorage.getItem('justLoggedOutTimestamp');
        const currentTime = Date.now();

        if (!flagSetTime) {
          // No timestamp, set one now
          localStorage.setItem('justLoggedOutTimestamp', currentTime.toString());
          console.log('⏰ AuthFlowEnhancer: Set logout flag timestamp');
          return;
        }

        const timeElapsed = currentTime - parseInt(flagSetTime);
        const maxDuration = 25000; // 25 seconds (5 seconds longer than original)

        if (timeElapsed > maxDuration) {
          console.log('🧹 AuthFlowEnhancer: Cleaning up stuck logout flag after', timeElapsed, 'ms');
          this.clearStuckLogoutFlag();
          this.showUserGuidance('Login flow restored. Please try logging in again.');
        }
      } else {
        // Clean up timestamp if flag is not set
        localStorage.removeItem('justLoggedOutTimestamp');
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Handle page visibility changes for Azure Static Web Apps
   * Azure environment may suspend timers when page is not visible
   */
  private setupPageVisibilityHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ AuthFlowEnhancer: Page became visible, checking auth state...');

        // Check for stuck logout flag when page becomes visible
        setTimeout(() => {
          this.checkAndCleanupStuckFlag();
        }, 1000);
      }
    });
  }

  /**
   * Setup automatic cleanup when page loads
   * Helps with Azure Static Web Apps routing issues
   */
  private setupPageLoadCleanup(): void {
    // Run cleanup check 10 seconds after page load
    setTimeout(() => {
      this.checkAndCleanupStuckFlag();
    }, 10000);

    // Also check when DOM is fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          this.checkAndCleanupStuckFlag();
        }, 5000);
      });
    }
  }

  /**
   * Check for and cleanup stuck logout flags
   */
  private checkAndCleanupStuckFlag(): void {
    const logoutFlag = localStorage.getItem('justLoggedOut');
    const flagTimestamp = localStorage.getItem('justLoggedOutTimestamp');

    if (logoutFlag === 'true' && flagTimestamp) {
      const timeElapsed = Date.now() - parseInt(flagTimestamp);
      const maxDuration = 25000; // 25 seconds

      if (timeElapsed > maxDuration) {
        console.log('🧹 AuthFlowEnhancer: Found and cleaning stuck logout flag (', timeElapsed, 'ms old)');
        this.clearStuckLogoutFlag();
        this.showUserGuidance('Authentication state restored. You can now log in normally.');
      }
    }
  }

  /**
   * Clear stuck logout flag and related data
   * Does NOT modify the protected logout system
   */
  private clearStuckLogoutFlag(): void {
    try {
      // Clear the stuck flag
      localStorage.removeItem('justLoggedOut');
      localStorage.removeItem('justLoggedOutTimestamp');

      // Clear any related session data that might be stuck
      sessionStorage.removeItem('appInitialized');
      sessionStorage.removeItem('spa-redirect-path');

      console.log('✅ AuthFlowEnhancer: Cleared stuck authentication flags');

      // Emit custom event for other components to react
      window.dispatchEvent(new CustomEvent('authFlowRestored', {
        detail: { reason: 'stuck_flag_cleanup', timestamp: Date.now() }
      }));

    } catch (error) {
      console.error('❌ AuthFlowEnhancer: Error clearing stuck flags:', error);
    }
  }

  /**
   * Show user guidance message
   */
  private showUserGuidance(message: string): void {
    // Create a non-intrusive notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      max-width: 300px;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Fade in
    setTimeout(() => notification.style.opacity = '1', 100);

    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }

  /**
   * Manual cleanup function for emergency use
   */
  public emergencyCleanup(): void {
    console.log('🚨 AuthFlowEnhancer: Emergency cleanup requested');

    try {
      // Clear all authentication-related flags
      localStorage.removeItem('justLoggedOut');
      localStorage.removeItem('justLoggedOutTimestamp');
      sessionStorage.removeItem('appInitialized');
      sessionStorage.removeItem('spa-redirect-path');

      // Clear any MSAL cache issues (doesn't modify protected logout)
      const msalKeys = Object.keys(localStorage).filter(key =>
        key.startsWith('msal.') &&
        (key.includes('authority') || key.includes('environment'))
      );

      msalKeys.forEach(key => {
        console.log('🧹 AuthFlowEnhancer: Clearing potentially stuck MSAL key:', key);
        localStorage.removeItem(key);
      });

      this.showUserGuidance('Emergency cleanup completed. Please refresh the page and try logging in.');

      console.log('✅ AuthFlowEnhancer: Emergency cleanup completed');

    } catch (error) {
      console.error('❌ AuthFlowEnhancer: Emergency cleanup error:', error);
    }
  }

  /**
   * Get current authentication state for debugging
   */
  public getAuthState(): object {
    return {
      justLoggedOut: localStorage.getItem('justLoggedOut'),
      justLoggedOutTimestamp: localStorage.getItem('justLoggedOutTimestamp'),
      appInitialized: sessionStorage.getItem('appInitialized'),
      msalKeys: Object.keys(localStorage).filter(key => key.startsWith('msal.')),
      pageVisibility: document.visibilityState,
      userAgent: navigator.userAgent.includes('Azure') ? 'Azure Environment' : 'Standard Browser'
    };
  }

  /**
   * Stop monitoring (cleanup)
   */
  public destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('🔧 AuthFlowEnhancer: Monitoring stopped');
  }
}

// Auto-initialize in browser environment
if (typeof window !== 'undefined') {
  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        AuthFlowEnhancer.getInstance().initialize();
      }, 2000);
    });
  } else {
    // Page already loaded
    setTimeout(() => {
      AuthFlowEnhancer.getInstance().initialize();
    }, 2000);
  }
}

// Export for external use
export const authFlowEnhancer = AuthFlowEnhancer.getInstance();

// Add to window for emergency console access
if (typeof window !== 'undefined') {
  (window as any).authFlowEnhancer = authFlowEnhancer;
}