/**
 * 🔍 AZURE PROFILE DATA PERSISTENCE DIAGNOSTIC SCRIPT
 *
 * Comprehensive investigation tool for Azure deployment profile data issues
 * Run this in the browser console on the Azure deployment to diagnose
 * why profile data saves successfully but immediately reverts after page refresh
 *
 * User ID under investigation: c550502f-c39d-4bb3-bb8c-d193657fdb24
 */

class AzureProfileDiagnostic {
  constructor() {
    this.userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';
    this.results = {
      timestamp: new Date().toISOString(),
      environment: 'azure',
      diagnostics: []
    };
    this.originalConsoleLog = console.log;
    this.originalConsoleWarn = console.warn;
    this.originalConsoleError = console.error;
  }

  /**
   * Log diagnostic result
   */
  log(section, status, message, data = null) {
    const result = {
      section,
      status, // 'PASS', 'FAIL', 'WARN', 'INFO'
      message,
      data,
      timestamp: new Date().toISOString()
    };

    this.results.diagnostics.push(result);

    const emoji = {
      'PASS': '✅',
      'FAIL': '❌',
      'WARN': '⚠️',
      'INFO': 'ℹ️'
    }[status] || '📋';

    console.log(`${emoji} [${section}] ${message}`, data || '');
  }

  /**
   * Phase 1: Environment & Configuration Check
   */
  async checkEnvironment() {
    console.log('\n🔍 PHASE 1: ENVIRONMENT & CONFIGURATION');
    console.log('=' .repeat(50));

    // Check if we're in Azure
    const hostname = window.location.hostname;
    const isAzure = hostname.includes('carexps.nexasync.ca') || hostname.includes('azurestaticapps.net');
    this.log('Environment', isAzure ? 'PASS' : 'WARN', `Running on: ${hostname}`, { isAzure });

    // Check Supabase configuration
    try {
      const supabaseUrl = import.meta?.env?.VITE_SUPABASE_URL || window.VITE_SUPABASE_URL;
      const supabaseKey = import.meta?.env?.VITE_SUPABASE_ANON_KEY || window.VITE_SUPABASE_ANON_KEY;

      this.log('Supabase Config', supabaseUrl && supabaseKey ? 'PASS' : 'FAIL',
               'Supabase credentials check', {
                 hasUrl: !!supabaseUrl,
                 hasKey: !!supabaseKey,
                 urlDomain: supabaseUrl ? new URL(supabaseUrl).hostname : 'MISSING'
               });
    } catch (error) {
      this.log('Supabase Config', 'FAIL', 'Error checking Supabase config', error.message);
    }

    // Check localStorage availability and quota
    try {
      const testKey = 'carexps_diagnostic_test';
      const testData = 'x'.repeat(1000); // 1KB test
      localStorage.setItem(testKey, testData);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      this.log('LocalStorage', retrieved === testData ? 'PASS' : 'FAIL',
               'LocalStorage functionality test');

      // Check localStorage usage
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length;
        }
      }

      this.log('LocalStorage Usage', totalSize < 5000000 ? 'PASS' : 'WARN',
               `LocalStorage usage: ${(totalSize / 1024).toFixed(2)}KB`, { totalSize });

    } catch (error) {
      this.log('LocalStorage', 'FAIL', 'LocalStorage not available', error.message);
    }
  }

  /**
   * Phase 2: Current Data State Analysis
   */
  async analyzeCurrentDataState() {
    console.log('\n🔍 PHASE 2: CURRENT DATA STATE ANALYSIS');
    console.log('=' .repeat(50));

    // Check currentUser in localStorage
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      try {
        const userData = JSON.parse(currentUser);
        this.log('CurrentUser', 'INFO', 'CurrentUser data found', {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          department: userData.department || 'NOT SET',
          phone: userData.phone || 'NOT SET',
          location: userData.location || 'NOT SET',
          bio: userData.bio || 'NOT SET',
          display_name: userData.display_name || 'NOT SET'
        });

        // Check if this matches our target user
        if (userData.id === this.userId) {
          this.log('User Match', 'PASS', 'CurrentUser matches target user ID');
        } else {
          this.log('User Match', 'WARN', `CurrentUser ID mismatch: ${userData.id} vs ${this.userId}`);
        }
      } catch (error) {
        this.log('CurrentUser', 'FAIL', 'Failed to parse currentUser', error.message);
      }
    } else {
      this.log('CurrentUser', 'FAIL', 'No currentUser found in localStorage');
    }

    // Check bulletproof profile storage locations
    const storageKeys = [
      'profileFields_',
      'userProfile_',
      'profileData_',
      'userFields_'
    ];

    for (const keyPrefix of storageKeys) {
      const key = `${keyPrefix}${this.userId}`;
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          this.log('Profile Storage', 'INFO', `Found data in ${key}`, {
            department: parsed.department || 'EMPTY',
            phone: parsed.phone || 'EMPTY',
            location: parsed.location || 'EMPTY',
            bio: parsed.bio || 'EMPTY',
            display_name: parsed.display_name || 'EMPTY',
            updated_at: parsed.updated_at
          });
        } catch (error) {
          this.log('Profile Storage', 'WARN', `Invalid JSON in ${key}`, error.message);
        }
      } else {
        this.log('Profile Storage', 'INFO', `No data in ${key}`);
      }
    }

    // Check global profile storage
    const allProfiles = localStorage.getItem('allUserProfiles');
    if (allProfiles) {
      try {
        const profiles = JSON.parse(allProfiles);
        if (profiles[this.userId]) {
          this.log('Global Profiles', 'INFO', 'Found in allUserProfiles', profiles[this.userId]);
        } else {
          this.log('Global Profiles', 'WARN', 'User not found in allUserProfiles');
        }
      } catch (error) {
        this.log('Global Profiles', 'WARN', 'Failed to parse allUserProfiles', error.message);
      }
    } else {
      this.log('Global Profiles', 'INFO', 'No allUserProfiles found');
    }
  }

  /**
   * Phase 3: Supabase Database Investigation
   */
  async investigateSupabaseData() {
    console.log('\n🔍 PHASE 3: SUPABASE DATABASE INVESTIGATION');
    console.log('=' .repeat(50));

    try {
      // Check if we can access Supabase client
      if (typeof window.supabase === 'undefined') {
        this.log('Supabase Client', 'WARN', 'Supabase client not available on window object');

        // Try to import Supabase dynamically
        try {
          const { supabase } = await import('/src/config/supabase.js');
          window.supabaseTest = supabase;
          this.log('Supabase Import', 'PASS', 'Successfully imported Supabase client');
        } catch (importError) {
          this.log('Supabase Import', 'FAIL', 'Failed to import Supabase client', importError.message);
          return;
        }
      }

      const supabaseClient = window.supabase || window.supabaseTest;

      if (!supabaseClient) {
        this.log('Supabase Client', 'FAIL', 'No Supabase client available');
        return;
      }

      // Test Supabase connection
      try {
        const { data: connectionTest, error: connectionError } = await supabaseClient
          .from('users')
          .select('count')
          .limit(1);

        if (connectionError) {
          this.log('Supabase Connection', 'FAIL', 'Connection test failed', connectionError.message);
        } else {
          this.log('Supabase Connection', 'PASS', 'Successfully connected to Supabase');
        }
      } catch (error) {
        this.log('Supabase Connection', 'FAIL', 'Connection test error', error.message);
      }

      // Check users table for our user
      try {
        const { data: user, error: userError } = await supabaseClient
          .from('users')
          .select('*')
          .eq('id', this.userId)
          .single();

        if (userError) {
          if (userError.code === 'PGRST116') {
            this.log('Users Table', 'WARN', 'User not found in users table');
          } else {
            this.log('Users Table', 'FAIL', 'Error querying users table', userError.message);
          }
        } else {
          this.log('Users Table', 'PASS', 'User found in users table', {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            updated_at: user.updated_at
          });
        }
      } catch (error) {
        this.log('Users Table', 'FAIL', 'Users table query error', error.message);
      }

      // Check user_profiles table for extended profile data
      try {
        const { data: profile, error: profileError } = await supabaseClient
          .from('user_profiles')
          .select('*')
          .eq('user_id', this.userId)
          .single();

        if (profileError) {
          if (profileError.code === 'PGRST116') {
            this.log('User Profiles Table', 'WARN', 'No profile found in user_profiles table');
          } else {
            this.log('User Profiles Table', 'FAIL', 'Error querying user_profiles table', profileError.message);
          }
        } else {
          this.log('User Profiles Table', 'PASS', 'Profile found in user_profiles table', {
            user_id: profile.user_id,
            department: profile.department || 'NULL',
            phone: profile.phone || 'NULL',
            location: profile.location || 'NULL',
            bio: profile.bio || 'NULL',
            display_name: profile.display_name || 'NULL',
            updated_at: profile.updated_at
          });
        }
      } catch (error) {
        this.log('User Profiles Table', 'FAIL', 'User profiles table query error', error.message);
      }

      // Check for email-based lookup
      try {
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
          const userData = JSON.parse(currentUser);
          if (userData.email) {
            const { data: emailUser, error: emailError } = await supabaseClient
              .from('users')
              .select('*')
              .eq('email', userData.email)
              .single();

            if (emailError) {
              this.log('Email Lookup', 'WARN', 'User not found by email', emailError.message);
            } else {
              this.log('Email Lookup', 'PASS', 'User found by email', {
                id: emailUser.id,
                email: emailUser.email,
                matchesUserId: emailUser.id === this.userId
              });
            }
          }
        }
      } catch (error) {
        this.log('Email Lookup', 'FAIL', 'Email lookup error', error.message);
      }

    } catch (error) {
      this.log('Supabase Investigation', 'FAIL', 'Failed to investigate Supabase', error.message);
    }
  }

  /**
   * Phase 4: Service Function Testing
   */
  async testServiceFunctions() {
    console.log('\n🔍 PHASE 4: SERVICE FUNCTION TESTING');
    console.log('=' .repeat(50));

    // Test bulletproof profile service loading
    try {
      if (typeof window.bulletproofProfileFieldsService !== 'undefined' ||
          typeof window.BulletproofProfileFieldsService !== 'undefined') {

        const service = window.bulletproofProfileFieldsService || window.BulletproofProfileFieldsService;

        // Test loading profile fields
        const loadResult = await service.loadProfileFields(this.userId);
        this.log('Service Load Test', loadResult.status === 'success' ? 'PASS' : 'FAIL',
                 'Bulletproof profile service load test', loadResult);

        // Test sync status
        const syncStatus = service.getSyncStatus(this.userId);
        this.log('Service Sync Status', 'INFO', 'Profile service sync status', syncStatus);

      } else {
        this.log('Service Availability', 'WARN', 'Bulletproof profile service not available on window');
      }
    } catch (error) {
      this.log('Service Test', 'FAIL', 'Service function test error', error.message);
    }

    // Test user profile service if available
    try {
      if (typeof window.userProfileService !== 'undefined' ||
          typeof window.UserProfileService !== 'undefined') {

        const service = window.userProfileService || window.UserProfileService;

        // Test loading user profile
        const loadResult = await service.loadUserProfile(this.userId);
        this.log('UserProfile Load Test', loadResult.status === 'success' ? 'PASS' : 'FAIL',
                 'User profile service load test', loadResult);

      } else {
        this.log('UserProfile Service', 'WARN', 'User profile service not available on window');
      }
    } catch (error) {
      this.log('UserProfile Test', 'FAIL', 'User profile service test error', error.message);
    }
  }

  /**
   * Phase 5: Live Save/Load Simulation
   */
  async simulateSaveLoadCycle() {
    console.log('\n🔍 PHASE 5: LIVE SAVE/LOAD SIMULATION');
    console.log('=' .repeat(50));

    const testFields = {
      department: 'TEST DIAGNOSTIC DEPT',
      phone: 'TEST DIAGNOSTIC PHONE',
      location: 'TEST DIAGNOSTIC LOCATION',
      display_name: 'TEST DIAGNOSTIC NAME',
      bio: 'TEST DIAGNOSTIC BIO'
    };

    // Step 1: Capture current state
    const beforeState = this.captureCurrentProfileState();
    this.log('Pre-Save State', 'INFO', 'Captured state before save test', beforeState);

    // Step 2: Test direct localStorage save
    try {
      const testKey = `profileFields_${this.userId}`;
      const testData = {
        ...testFields,
        updated_at: new Date().toISOString(),
        user_id: this.userId,
        test_marker: 'DIAGNOSTIC_TEST'
      };

      localStorage.setItem(testKey, JSON.stringify(testData));

      // Immediate verification
      const immediateCheck = localStorage.getItem(testKey);
      if (immediateCheck) {
        const parsed = JSON.parse(immediateCheck);
        this.log('Direct Save Test', 'PASS', 'Direct localStorage save successful', parsed);
      } else {
        this.log('Direct Save Test', 'FAIL', 'Direct localStorage save failed');
      }
    } catch (error) {
      this.log('Direct Save Test', 'FAIL', 'Direct localStorage save error', error.message);
    }

    // Step 3: Test service-based save if available
    try {
      if (typeof window.bulletproofProfileFieldsService !== 'undefined') {
        const service = window.bulletproofProfileFieldsService;
        const saveResult = await service.saveProfileFields(this.userId, testFields);
        this.log('Service Save Test', saveResult.status === 'success' ? 'PASS' : 'FAIL',
                 'Service-based save test', saveResult);
      }
    } catch (error) {
      this.log('Service Save Test', 'FAIL', 'Service save test error', error.message);
    }

    // Step 4: Wait and check persistence
    await new Promise(resolve => setTimeout(resolve, 1000));

    const afterState = this.captureCurrentProfileState();
    this.log('Post-Save State', 'INFO', 'Captured state after save test', afterState);

    // Step 5: Compare states
    const persistence = this.compareProfileStates(beforeState, afterState);
    this.log('Persistence Check', persistence.persisted ? 'PASS' : 'FAIL',
             'Data persistence verification', persistence);
  }

  /**
   * Phase 6: Network & Timing Analysis
   */
  async analyzeNetworkAndTiming() {
    console.log('\n🔍 PHASE 6: NETWORK & TIMING ANALYSIS');
    console.log('=' .repeat(50));

    // Check network connectivity
    this.log('Network Status', navigator.onLine ? 'PASS' : 'WARN',
             `Network connectivity: ${navigator.onLine ? 'Online' : 'Offline'}`);

    // Monitor page load timing
    if (performance && performance.timing) {
      const timing = performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      this.log('Page Load Time', loadTime < 5000 ? 'PASS' : 'WARN',
               `Page load time: ${loadTime}ms`, { loadTime });
    }

    // Check for page refresh patterns
    const pageRefreshCount = sessionStorage.getItem('carexps_refresh_count') || '0';
    sessionStorage.setItem('carexps_refresh_count', (parseInt(pageRefreshCount) + 1).toString());
    this.log('Page Refresh Count', 'INFO', `Session refresh count: ${pageRefreshCount}`);

    // Monitor localStorage events
    let storageEventCount = 0;
    const storageListener = (event) => {
      if (event.key && event.key.includes(this.userId)) {
        storageEventCount++;
        this.log('Storage Event', 'INFO', `Storage event detected for user: ${event.key}`, {
          key: event.key,
          oldValue: event.oldValue ? 'HAS_VALUE' : 'NULL',
          newValue: event.newValue ? 'HAS_VALUE' : 'NULL'
        });
      }
    };

    window.addEventListener('storage', storageListener);

    // Clean up after 5 seconds
    setTimeout(() => {
      window.removeEventListener('storage', storageListener);
      this.log('Storage Events', 'INFO', `Total storage events in 5s: ${storageEventCount}`);
    }, 5000);
  }

  /**
   * Phase 7: Memory & Browser Analysis
   */
  analyzeBrowserEnvironment() {
    console.log('\n🔍 PHASE 7: BROWSER ENVIRONMENT ANALYSIS');
    console.log('=' .repeat(50));

    // Browser info
    this.log('Browser Info', 'INFO', 'Browser details', {
      userAgent: navigator.userAgent,
      cookieEnabled: navigator.cookieEnabled,
      language: navigator.language,
      platform: navigator.platform
    });

    // Memory info (if available)
    if (performance.memory) {
      this.log('Memory Info', 'INFO', 'Memory usage', {
        usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
        totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
        jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
      });
    }

    // Check for service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        this.log('Service Worker', registrations.length > 0 ? 'INFO' : 'WARN',
                 `Service workers: ${registrations.length}`,
                 registrations.map(reg => reg.scope));
      });
    }

    // Check for localStorage events listeners
    const eventListeners = getEventListeners ? getEventListeners(window) : null;
    if (eventListeners && eventListeners.storage) {
      this.log('Storage Listeners', 'INFO', `Storage event listeners: ${eventListeners.storage.length}`);
    }
  }

  /**
   * Helper: Capture current profile state
   */
  captureCurrentProfileState() {
    const state = {
      timestamp: new Date().toISOString(),
      localStorage: {},
      currentUser: null
    };

    // Capture all profile-related localStorage
    const storageKeys = [
      'currentUser',
      `profileFields_${this.userId}`,
      `userProfile_${this.userId}`,
      `profileData_${this.userId}`,
      `userFields_${this.userId}`,
      'allUserProfiles'
    ];

    for (const key of storageKeys) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          state.localStorage[key] = JSON.parse(value);
        } catch (error) {
          state.localStorage[key] = value;
        }
      }
    }

    return state;
  }

  /**
   * Helper: Compare profile states
   */
  compareProfileStates(before, after) {
    const result = {
      persisted: false,
      changes: [],
      newKeys: [],
      removedKeys: []
    };

    // Compare localStorage
    const beforeKeys = Object.keys(before.localStorage);
    const afterKeys = Object.keys(after.localStorage);

    result.newKeys = afterKeys.filter(key => !beforeKeys.includes(key));
    result.removedKeys = beforeKeys.filter(key => !afterKeys.includes(key));

    // Check for changes in existing keys
    for (const key of beforeKeys) {
      if (afterKeys.includes(key)) {
        const beforeValue = JSON.stringify(before.localStorage[key]);
        const afterValue = JSON.stringify(after.localStorage[key]);
        if (beforeValue !== afterValue) {
          result.changes.push({
            key,
            changed: true,
            before: before.localStorage[key],
            after: after.localStorage[key]
          });
        }
      }
    }

    result.persisted = result.newKeys.length > 0 || result.changes.length > 0;
    return result;
  }

  /**
   * Generate final report
   */
  generateReport() {
    console.log('\n📊 DIAGNOSTIC REPORT SUMMARY');
    console.log('=' .repeat(50));

    const summary = {
      totalTests: this.results.diagnostics.length,
      passed: this.results.diagnostics.filter(d => d.status === 'PASS').length,
      failed: this.results.diagnostics.filter(d => d.status === 'FAIL').length,
      warnings: this.results.diagnostics.filter(d => d.status === 'WARN').length,
      timestamp: this.results.timestamp
    };

    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`⚠️ Warnings: ${summary.warnings}`);
    console.log(`📋 Total: ${summary.totalTests}`);

    // Critical issues
    const criticalIssues = this.results.diagnostics.filter(d => d.status === 'FAIL');
    if (criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES FOUND:');
      criticalIssues.forEach(issue => {
        console.log(`   ❌ [${issue.section}] ${issue.message}`);
      });
    }

    // Key findings
    const keyFindings = [];

    // Check localStorage functionality
    const localStorageTest = this.results.diagnostics.find(d => d.section === 'LocalStorage');
    if (localStorageTest && localStorageTest.status === 'FAIL') {
      keyFindings.push('LocalStorage is not functioning properly');
    }

    // Check Supabase connectivity
    const supabaseTest = this.results.diagnostics.find(d => d.section === 'Supabase Connection');
    if (supabaseTest && supabaseTest.status === 'FAIL') {
      keyFindings.push('Supabase connection issues detected');
    }

    // Check data persistence
    const persistenceTest = this.results.diagnostics.find(d => d.section === 'Persistence Check');
    if (persistenceTest && persistenceTest.status === 'FAIL') {
      keyFindings.push('Data persistence failure confirmed');
    }

    if (keyFindings.length > 0) {
      console.log('\n🔍 KEY FINDINGS:');
      keyFindings.forEach(finding => {
        console.log(`   • ${finding}`);
      });
    }

    // Save full report to localStorage for later analysis
    localStorage.setItem('carexps_diagnostic_report', JSON.stringify(this.results));
    console.log('\n💾 Full diagnostic report saved to localStorage as "carexps_diagnostic_report"');

    return this.results;
  }

  /**
   * Main diagnostic runner
   */
  async runFullDiagnostic() {
    console.clear();
    console.log('🚀 STARTING AZURE PROFILE DATA PERSISTENCE DIAGNOSTIC');
    console.log('=' .repeat(60));
    console.log(`Target User ID: ${this.userId}`);
    console.log(`Environment: ${window.location.hostname}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('=' .repeat(60));

    try {
      await this.checkEnvironment();
      await this.analyzeCurrentDataState();
      await this.investigateSupabaseData();
      await this.testServiceFunctions();
      await this.simulateSaveLoadCycle();
      await this.analyzeNetworkAndTiming();
      this.analyzeBrowserEnvironment();

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      return this.generateReport();
    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
      this.log('Diagnostic', 'FAIL', 'Diagnostic runner error', error.message);
      return this.generateReport();
    }
  }
}

// Create global instance for easy access
window.azureProfileDiagnostic = new AzureProfileDiagnostic();

// Auto-run if called directly
if (typeof document !== 'undefined') {
  console.log('🔍 Azure Profile Diagnostic Tool Loaded');
  console.log('Run: azureProfileDiagnostic.runFullDiagnostic()');
  console.log('Or: window.azureProfileDiagnostic.runFullDiagnostic()');
}

// Export for manual execution
window.runAzureProfileDiagnostic = () => window.azureProfileDiagnostic.runFullDiagnostic();

/**
 * QUICK EXECUTION COMMANDS:
 *
 * 1. Basic diagnostic:
 *    azureProfileDiagnostic.runFullDiagnostic()
 *
 * 2. Just check current data:
 *    azureProfileDiagnostic.analyzeCurrentDataState()
 *
 * 3. Just test Supabase:
 *    azureProfileDiagnostic.investigateSupabaseData()
 *
 * 4. Just simulate save/load:
 *    azureProfileDiagnostic.simulateSaveLoadCycle()
 *
 * 5. Get last report:
 *    JSON.parse(localStorage.getItem('carexps_diagnostic_report'))
 */