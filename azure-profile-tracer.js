/**
 * 🕵️ AZURE PROFILE DATA FLOW TRACER
 *
 * Real-time monitoring and interception tool for profile data operations
 * Tracks every save, load, and modification to identify the exact point of failure
 */

class AzureProfileTracer {
  constructor() {
    this.userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';
    this.traces = [];
    this.interceptors = [];
    this.isTracing = false;
    this.originalMethods = {};
  }

  /**
   * Add trace entry
   */
  trace(operation, source, data, metadata = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      operation, // 'SAVE', 'LOAD', 'UPDATE', 'DELETE'
      source,    // 'localStorage', 'supabase', 'bulletproof-service', etc.
      data: this.sanitizeData(data),
      metadata,
      stackTrace: this.getStackTrace()
    };

    this.traces.push(entry);

    if (this.isTracing) {
      console.log(`🕵️ [${operation}] ${source}:`, entry);
    }

    // Keep only last 100 traces to prevent memory issues
    if (this.traces.length > 100) {
      this.traces = this.traces.slice(-100);
    }
  }

  /**
   * Sanitize data for logging (remove sensitive info)
   */
  sanitizeData(data) {
    if (!data) return data;

    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return this.sanitizeData(parsed);
      } catch {
        return data.length > 200 ? data.substring(0, 200) + '...' : data;
      }
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    if (typeof data === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        // Preserve profile fields but redact sensitive data
        if (['department', 'phone', 'location', 'display_name', 'bio', 'email', 'name', 'id', 'updated_at', 'created_at'].includes(key)) {
          sanitized[key] = value;
        } else if (typeof value === 'string' && value.length > 100) {
          sanitized[key] = value.substring(0, 100) + '...';
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Get simplified stack trace
   */
  getStackTrace() {
    try {
      const stack = new Error().stack;
      return stack
        .split('\n')
        .slice(3, 8) // Skip first few lines and keep relevant ones
        .map(line => line.trim())
        .filter(line => !line.includes('chrome-extension://'))
        .join(' -> ');
    } catch {
      return 'Stack trace unavailable';
    }
  }

  /**
   * Start real-time tracing
   */
  startTracing() {
    console.log('🕵️ Starting Azure Profile Data Tracing...');
    this.isTracing = true;
    this.setupInterceptors();
    console.log('✅ Tracing active - all profile operations will be logged');
  }

  /**
   * Stop tracing
   */
  stopTracing() {
    console.log('🛑 Stopping Azure Profile Data Tracing...');
    this.isTracing = false;
    this.removeInterceptors();
    console.log('✅ Tracing stopped');
  }

  /**
   * Setup method interceptors
   */
  setupInterceptors() {
    // Intercept localStorage.setItem
    if (!this.originalMethods.localStorage_setItem) {
      this.originalMethods.localStorage_setItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (key, value) => {
        if (key.includes(this.userId) || key.includes('currentUser') || key.includes('Profile')) {
          this.trace('SAVE', 'localStorage.setItem', { key, value }, { operation: 'setItem' });
        }
        return this.originalMethods.localStorage_setItem(key, value);
      };
    }

    // Intercept localStorage.getItem
    if (!this.originalMethods.localStorage_getItem) {
      this.originalMethods.localStorage_getItem = localStorage.getItem.bind(localStorage);
      localStorage.getItem = (key) => {
        const result = this.originalMethods.localStorage_getItem(key);
        if (key.includes(this.userId) || key.includes('currentUser') || key.includes('Profile')) {
          this.trace('LOAD', 'localStorage.getItem', { key, result }, { operation: 'getItem' });
        }
        return result;
      };
    }

    // Intercept console methods to catch service logs
    if (!this.originalMethods.console_log) {
      this.originalMethods.console_log = console.log.bind(console);
      console.log = (...args) => {
        const message = args.join(' ');
        if (message.includes('BULLETPROOF PROFILE') || message.includes('PROFILE UPDATE') || message.includes(this.userId)) {
          this.trace('LOG', 'console.log', args, { originalLog: true });
        }
        return this.originalMethods.console_log(...args);
      };
    }

    // Intercept window events related to profile updates
    this.setupEventInterceptors();

    console.log('🔧 Interceptors installed for localStorage, console, and events');
  }

  /**
   * Setup event interceptors
   */
  setupEventInterceptors() {
    // Custom events
    const customEvents = ['profileFieldsUpdated', 'userProfileUpdated', 'userDataUpdated', 'crossDeviceProfileSync'];

    customEvents.forEach(eventType => {
      window.addEventListener(eventType, (event) => {
        this.trace('EVENT', `window.${eventType}`, event.detail, { eventType });
      });
    });

    // Storage events
    window.addEventListener('storage', (event) => {
      if (event.key && (event.key.includes(this.userId) || event.key.includes('Profile') || event.key.includes('currentUser'))) {
        this.trace('EVENT', 'storage', {
          key: event.key,
          oldValue: event.oldValue,
          newValue: event.newValue,
          url: event.url
        }, { eventType: 'storage' });
      }
    });

    // Page lifecycle events
    window.addEventListener('beforeunload', () => {
      this.trace('EVENT', 'window.beforeunload', null, { eventType: 'beforeunload' });
    });

    window.addEventListener('unload', () => {
      this.trace('EVENT', 'window.unload', null, { eventType: 'unload' });
    });

    document.addEventListener('visibilitychange', () => {
      this.trace('EVENT', 'document.visibilitychange', {
        visibilityState: document.visibilityState,
        hidden: document.hidden
      }, { eventType: 'visibilitychange' });
    });
  }

  /**
   * Remove interceptors
   */
  removeInterceptors() {
    // Restore original methods
    if (this.originalMethods.localStorage_setItem) {
      localStorage.setItem = this.originalMethods.localStorage_setItem;
      delete this.originalMethods.localStorage_setItem;
    }

    if (this.originalMethods.localStorage_getItem) {
      localStorage.getItem = this.originalMethods.localStorage_getItem;
      delete this.originalMethods.localStorage_getItem;
    }

    if (this.originalMethods.console_log) {
      console.log = this.originalMethods.console_log;
      delete this.originalMethods.console_log;
    }

    console.log('🔧 Interceptors removed');
  }

  /**
   * Simulate profile save and trace the flow
   */
  async simulateProfileSaveWithTrace() {
    console.log('🧪 Simulating profile save with full tracing...');
    this.startTracing();

    const testData = {
      department: 'Diagnostic Test Department',
      phone: 'Diagnostic Test Phone',
      location: 'Diagnostic Test Location',
      display_name: 'Diagnostic Test Name',
      bio: 'Diagnostic Test Bio'
    };

    try {
      // Step 1: Save directly to localStorage
      this.trace('TEST', 'simulate-start', testData, { step: 1, description: 'Starting simulation' });

      const directKey = `profileFields_${this.userId}`;
      const directData = {
        ...testData,
        updated_at: new Date().toISOString(),
        user_id: this.userId,
        test_marker: 'TRACE_TEST'
      };

      localStorage.setItem(directKey, JSON.stringify(directData));

      // Step 2: Verify immediate storage
      await new Promise(resolve => setTimeout(resolve, 100));
      const immediateCheck = localStorage.getItem(directKey);
      this.trace('TEST', 'immediate-verify', { found: !!immediateCheck }, { step: 2 });

      // Step 3: Try bulletproof service if available
      if (window.bulletproofProfileFieldsService) {
        this.trace('TEST', 'service-call-start', testData, { step: 3, service: 'bulletproof' });
        const result = await window.bulletproofProfileFieldsService.saveProfileFields(this.userId, testData);
        this.trace('TEST', 'service-call-end', result, { step: 3, service: 'bulletproof' });
      }

      // Step 4: Wait and check persistence
      this.trace('TEST', 'persistence-wait-start', null, { step: 4, waitTime: '2000ms' });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const persistenceCheck = localStorage.getItem(directKey);
      this.trace('TEST', 'persistence-verify', {
        found: !!persistenceCheck,
        data: persistenceCheck ? JSON.parse(persistenceCheck) : null
      }, { step: 4 });

      // Step 5: Simulate page refresh scenario
      this.trace('TEST', 'refresh-simulation', null, { step: 5, description: 'Simulating conditions after page refresh' });

      // Clear any potential conflicts
      const allKeys = Object.keys(localStorage).filter(key =>
        key.includes(this.userId) || key.includes('Profile') || key.includes('currentUser')
      );

      this.trace('TEST', 'storage-keys-found', allKeys, { step: 5, count: allKeys.length });

      // Check each key
      allKeys.forEach(key => {
        const value = localStorage.getItem(key);
        try {
          const parsed = JSON.parse(value);
          this.trace('TEST', 'key-analysis', { key, parsed }, { step: 5 });
        } catch {
          this.trace('TEST', 'key-analysis', { key, value }, { step: 5, parseError: true });
        }
      });

    } catch (error) {
      this.trace('TEST', 'simulation-error', error.message, { step: 'error' });
    }

    this.stopTracing();
    return this.getTraceReport();
  }

  /**
   * Monitor profile data for a specific duration
   */
  async monitorProfileData(durationMs = 30000) {
    console.log(`🔍 Monitoring profile data for ${durationMs / 1000} seconds...`);
    this.startTracing();

    const monitorInterval = setInterval(() => {
      const currentState = this.captureProfileState();
      this.trace('MONITOR', 'periodic-check', currentState, { interval: true });
    }, 5000); // Check every 5 seconds

    // Stop monitoring after duration
    setTimeout(() => {
      clearInterval(monitorInterval);
      this.stopTracing();
      console.log('🔍 Profile monitoring completed');
      console.log('📊 Trace report:', this.getTraceReport());
    }, durationMs);
  }

  /**
   * Capture current profile state
   */
  captureProfileState() {
    const state = {};

    const relevantKeys = Object.keys(localStorage).filter(key =>
      key.includes(this.userId) || key.includes('Profile') || key.includes('currentUser')
    );

    relevantKeys.forEach(key => {
      const value = localStorage.getItem(key);
      try {
        state[key] = JSON.parse(value);
      } catch {
        state[key] = value;
      }
    });

    return state;
  }

  /**
   * Get trace report
   */
  getTraceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalTraces: this.traces.length,
      operations: {},
      sources: {},
      timeline: this.traces,
      summary: {
        saveOperations: this.traces.filter(t => t.operation === 'SAVE').length,
        loadOperations: this.traces.filter(t => t.operation === 'LOAD').length,
        events: this.traces.filter(t => t.operation === 'EVENT').length,
        errors: this.traces.filter(t => t.data && t.data.error).length
      }
    };

    // Count operations by type
    this.traces.forEach(trace => {
      report.operations[trace.operation] = (report.operations[trace.operation] || 0) + 1;
      report.sources[trace.source] = (report.sources[trace.source] || 0) + 1;
    });

    return report;
  }

  /**
   * Clear all traces
   */
  clearTraces() {
    this.traces = [];
    console.log('🧹 Traces cleared');
  }

  /**
   * Export traces to JSON
   */
  exportTraces() {
    const report = this.getTraceReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profile-traces-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('📁 Traces exported to file');
  }

  /**
   * Live dashboard in console
   */
  showLiveDashboard() {
    if (this.dashboardInterval) {
      clearInterval(this.dashboardInterval);
    }

    this.dashboardInterval = setInterval(() => {
      console.clear();
      console.log('🕵️ LIVE PROFILE TRACER DASHBOARD');
      console.log('=' .repeat(50));
      console.log(`Tracing: ${this.isTracing ? '✅ ACTIVE' : '❌ INACTIVE'}`);
      console.log(`Total Traces: ${this.traces.length}`);
      console.log('Recent Activity (last 5):');

      this.traces.slice(-5).forEach((trace, index) => {
        const time = new Date(trace.timestamp).toLocaleTimeString();
        console.log(`  ${index + 1}. [${time}] ${trace.operation} - ${trace.source}`);
      });

      console.log('=' .repeat(50));
      console.log('Commands: tracer.stopDashboard() | tracer.exportTraces()');
    }, 2000);
  }

  /**
   * Stop live dashboard
   */
  stopDashboard() {
    if (this.dashboardInterval) {
      clearInterval(this.dashboardInterval);
      this.dashboardInterval = null;
      console.clear();
      console.log('📊 Live dashboard stopped');
    }
  }
}

// Create global instance
window.azureProfileTracer = new AzureProfileTracer();

// Quick access functions
window.startProfileTracing = () => window.azureProfileTracer.startTracing();
window.stopProfileTracing = () => window.azureProfileTracer.stopTracing();
window.simulateProfileSave = () => window.azureProfileTracer.simulateProfileSaveWithTrace();
window.monitorProfileData = (duration) => window.azureProfileTracer.monitorProfileData(duration);

console.log('🕵️ Azure Profile Tracer Loaded');
console.log('Available commands:');
console.log('  • startProfileTracing() - Start real-time tracing');
console.log('  • stopProfileTracing() - Stop tracing');
console.log('  • simulateProfileSave() - Run save simulation with full trace');
console.log('  • monitorProfileData(30000) - Monitor for 30 seconds');
console.log('  • azureProfileTracer.showLiveDashboard() - Live dashboard');
console.log('  • azureProfileTracer.exportTraces() - Export to file');

/**
 * USAGE EXAMPLES:
 *
 * 1. Start basic tracing:
 *    startProfileTracing()
 *
 * 2. Run full simulation:
 *    simulateProfileSave()
 *
 * 3. Monitor during user actions:
 *    monitorProfileData(60000) // 1 minute
 *
 * 4. Live dashboard:
 *    azureProfileTracer.showLiveDashboard()
 *
 * 5. Export results:
 *    azureProfileTracer.exportTraces()
 */