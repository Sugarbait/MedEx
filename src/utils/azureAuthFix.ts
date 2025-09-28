// Azure Static Web Apps Authentication Fix
// Addresses timing and caching issues specific to Azure environment
// Does NOT modify protected authentication systems

interface AzureAuthFixConfig {
  maxFlagDuration: number;
  checkInterval: number;
  isAzureEnvironment: boolean;
}

class AzureAuthFix {
  private config: AzureAuthFixConfig;
  private checkTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      maxFlagDuration: 25000, // 25 seconds (5 seconds longer than protected system)
      checkInterval: 15000,   // Check every 15 seconds
      isAzureEnvironment: this.detectAzureEnvironment()
    };

    this.initialize();
  }

  private detectAzureEnvironment(): boolean {
    const hostname = window.location.hostname;
    const isAzure = hostname.includes('azurestaticapps.net') ||
                   hostname.includes('nexasync.ca') ||
                   hostname === 'carexps.nexasync.ca';

    console.log('🌐 AzureAuthFix: Azure environment detected:', isAzure);
    return isAzure;
  }

  private initialize(): void {
    if (!this.config.isAzureEnvironment) {
      console.log('ℹ️ AzureAuthFix: Not Azure environment, skipping Azure-specific fixes');
      return;
    }

    console.log('🔧 AzureAuthFix: Initializing Azure authentication fixes...');

    // Start immediate check on page load
    this.performAuthCheck();

    // Setup periodic monitoring
    this.startPeriodicMonitoring();

    // Setup event listeners for Azure-specific scenarios
    this.setupAzureEventListeners();

    // Setup service worker compatibility
    this.setupServiceWorkerFix();

    console.log('✅ AzureAuthFix: Azure authentication enhancement active');
  }

  private performAuthCheck(): void {
    const logoutFlag = localStorage.getItem('justLoggedOut');
    const flagTimestamp = localStorage.getItem('justLoggedOutTimestamp');

    if (logoutFlag === 'true') {
      console.log('🔍 AzureAuthFix: Found logout flag, checking duration...');

      if (!flagTimestamp) {
        // Set timestamp if missing
        localStorage.setItem('justLoggedOutTimestamp', Date.now().toString());
        console.log('⏰ AzureAuthFix: Set missing logout timestamp');
        return;
      }

      const elapsed = Date.now() - parseInt(flagTimestamp);
      console.log('📊 AzureAuthFix: Logout flag age:', elapsed, 'ms');

      if (elapsed > this.config.maxFlagDuration) {
        this.cleanupStuckAuth();
      }
    }
  }

  private cleanupStuckAuth(): void {
    console.log('🧹 AzureAuthFix: Cleaning up stuck authentication state...');

    try {
      // Clear the problematic flags
      localStorage.removeItem('justLoggedOut');
      localStorage.removeItem('justLoggedOutTimestamp');

      // Clear Azure-specific session data that might interfere
      sessionStorage.removeItem('appInitialized');
      sessionStorage.removeItem('spa-redirect-path');

      // Clear any Azure Static Web Apps routing issues
      if (sessionStorage.getItem('azureStaticWebAppsRedirect')) {
        sessionStorage.removeItem('azureStaticWebAppsRedirect');
      }

      // Clear potential MSAL cache conflicts (without touching protected logout)
      this.clearMSALCacheConflicts();

      console.log('✅ AzureAuthFix: Authentication state cleanup completed');

      // Notify user
      this.showCleanupNotification();

      // Emit event for other components
      window.dispatchEvent(new CustomEvent('azureAuthFixed', {
        detail: { timestamp: Date.now(), type: 'stuck_flag_cleanup' }
      }));

    } catch (error) {
      console.error('❌ AzureAuthFix: Cleanup error:', error);
    }
  }

  private clearMSALCacheConflicts(): void {
    // Only clear specific MSAL keys that can cause conflicts in Azure
    // Does NOT touch the protected logout system
    const problematicKeys = [
      'msal.interaction.status',
      'msal.request.state',
      'msal.error'
    ];

    problematicKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log('🧹 AzureAuthFix: Cleared MSAL conflict key:', key);
      }
    });
  }

  private startPeriodicMonitoring(): void {
    this.checkTimer = setInterval(() => {
      this.performAuthCheck();
    }, this.config.checkInterval);

    console.log('⏰ AzureAuthFix: Started periodic monitoring every', this.config.checkInterval, 'ms');
  }

  private setupAzureEventListeners(): void {
    // Handle page visibility changes (Azure may suspend timers)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ AzureAuthFix: Page visible, checking auth state...');
        setTimeout(() => this.performAuthCheck(), 1000);
      }
    });

    // Handle focus events (important for Azure Static Web Apps)
    window.addEventListener('focus', () => {
      console.log('🎯 AzureAuthFix: Window focused, checking auth state...');
      setTimeout(() => this.performAuthCheck(), 500);
    });

    // Handle beforeunload to set timestamp
    window.addEventListener('beforeunload', () => {
      if (localStorage.getItem('justLoggedOut') === 'true') {
        localStorage.setItem('justLoggedOutTimestamp', Date.now().toString());
      }
    });
  }

  private setupServiceWorkerFix(): void {
    // Handle service worker issues that can affect Azure Static Web Apps auth
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'AUTH_STATE_CHECK') {
          this.performAuthCheck();
        }
      });

      // Register for service worker updates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 AzureAuthFix: Service worker updated, checking auth state...');
        setTimeout(() => this.performAuthCheck(), 2000);
      });
    }
  }

  private showCleanupNotification(): void {
    // Create user-friendly notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      font-weight: 500;
      max-width: 400px;
      text-align: center;
      opacity: 0;
      transition: all 0.4s ease;
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;

    notification.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <span style="font-size: 16px;">✅</span>
        <span>Login restored! You can now sign in normally.</span>
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
    }, 6000);
  }

  // Public methods for emergency use
  public emergencyReset(): void {
    console.log('🚨 AzureAuthFix: Emergency reset requested');

    // Clear all authentication flags
    localStorage.removeItem('justLoggedOut');
    localStorage.removeItem('justLoggedOutTimestamp');
    sessionStorage.clear();

    // Clear Azure-specific data
    const azureKeys = Object.keys(localStorage).filter(key =>
      key.includes('azure') || key.includes('static-web-apps')
    );
    azureKeys.forEach(key => localStorage.removeItem(key));

    this.showCleanupNotification();
    console.log('✅ AzureAuthFix: Emergency reset completed');
  }

  public getStatus(): object {
    return {
      isAzureEnvironment: this.config.isAzureEnvironment,
      logoutFlag: localStorage.getItem('justLoggedOut'),
      flagTimestamp: localStorage.getItem('justLoggedOutTimestamp'),
      flagAge: localStorage.getItem('justLoggedOutTimestamp')
        ? Date.now() - parseInt(localStorage.getItem('justLoggedOutTimestamp')!)
        : null,
      maxDuration: this.config.maxFlagDuration,
      monitoringActive: this.checkTimer !== null
    };
  }

  public destroy(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    console.log('🔧 AzureAuthFix: Monitoring stopped');
  }
}

// Initialize for Azure environment
const azureAuthFix = new AzureAuthFix();

// Export for external access
export { AzureAuthFix };
export default azureAuthFix;

// Add to window for console access
if (typeof window !== 'undefined') {
  (window as any).azureAuthFix = azureAuthFix;
}