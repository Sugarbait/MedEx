/**
 * 🔧 AZURE PROFILE FIELD DEBUGGER
 *
 * Focused debugging tool for the specific profile field persistence issue
 * Tests the exact scenario: Save fields → Page refresh → Check if fields persist
 */

class AzureProfileDebugger {
  constructor() {
    this.userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';
    this.testData = {
      department: 'Test Department - ' + Date.now(),
      phone: 'Test Phone - ' + Date.now(),
      location: 'Test Location - ' + Date.now(),
      display_name: 'Test Display Name - ' + Date.now(),
      bio: 'Test Bio - ' + Date.now()
    };
    this.results = [];
  }

  /**
   * Log with timestamp
   */
  log(message, data = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      message,
      data
    };
    this.results.push(entry);
    console.log(`🔧 [${new Date().toLocaleTimeString()}] ${message}`, data || '');
  }

  /**
   * Test 1: Direct localStorage operations
   */
  async testDirectLocalStorage() {
    this.log('=== TEST 1: DIRECT LOCALSTORAGE OPERATIONS ===');

    // Clear existing data first
    const keysToTest = [
      `profileFields_${this.userId}`,
      `userProfile_${this.userId}`,
      `profileData_${this.userId}`,
      `userFields_${this.userId}`
    ];

    keysToTest.forEach(key => {
      localStorage.removeItem(key);
      this.log(`Cleared key: ${key}`);
    });

    // Test each storage key individually
    for (const key of keysToTest) {
      this.log(`\nTesting key: ${key}`);

      const testData = {
        ...this.testData,
        updated_at: new Date().toISOString(),
        user_id: this.userId,
        storage_key: key
      };

      // Save
      localStorage.setItem(key, JSON.stringify(testData));
      this.log(`✅ Saved to ${key}`);

      // Immediate read
      const immediate = localStorage.getItem(key);
      const immediateSuccess = immediate && JSON.parse(immediate).department === testData.department;
      this.log(`Immediate read: ${immediateSuccess ? 'SUCCESS' : 'FAILED'}`, { found: !!immediate });

      // Wait 1 second and read again
      await new Promise(resolve => setTimeout(resolve, 1000));
      const delayed = localStorage.getItem(key);
      const delayedSuccess = delayed && JSON.parse(delayed).department === testData.department;
      this.log(`Delayed read (1s): ${delayedSuccess ? 'SUCCESS' : 'FAILED'}`, { found: !!delayed });

      // Check if data was modified
      if (immediate && delayed) {
        const immediateData = JSON.parse(immediate);
        const delayedData = JSON.parse(delayed);
        const wasModified = JSON.stringify(immediateData) !== JSON.stringify(delayedData);
        this.log(`Data modified during wait: ${wasModified ? 'YES' : 'NO'}`);
      }
    }
  }

  /**
   * Test 2: Service-based operations
   */
  async testServiceOperations() {
    this.log('\n=== TEST 2: SERVICE-BASED OPERATIONS ===');

    // Test bulletproof service if available
    if (window.bulletproofProfileFieldsService) {
      this.log('Testing bulletproofProfileFieldsService...');

      try {
        // Load current state
        const loadResult = await window.bulletproofProfileFieldsService.loadProfileFields(this.userId);
        this.log('Current state loaded:', loadResult);

        // Save test data
        const saveResult = await window.bulletproofProfileFieldsService.saveProfileFields(this.userId, this.testData);
        this.log('Save result:', saveResult);

        // Immediately load again
        const immediateLoad = await window.bulletproofProfileFieldsService.loadProfileFields(this.userId);
        this.log('Immediate load after save:', immediateLoad);

        // Wait and load again
        await new Promise(resolve => setTimeout(resolve, 2000));
        const delayedLoad = await window.bulletproofProfileFieldsService.loadProfileFields(this.userId);
        this.log('Delayed load after save:', delayedLoad);

        // Check sync status
        const syncStatus = window.bulletproofProfileFieldsService.getSyncStatus(this.userId);
        this.log('Sync status:', syncStatus);

      } catch (error) {
        this.log('Service test error:', error.message);
      }
    } else {
      this.log('❌ bulletproofProfileFieldsService not available');
    }

    // Test user profile service if available
    if (window.userProfileService || window.UserProfileService) {
      this.log('\nTesting UserProfileService...');
      const service = window.userProfileService || window.UserProfileService;

      try {
        // Update profile with test data
        const updateResult = await service.updateUserProfile(this.userId, this.testData);
        this.log('Update result:', updateResult);

        // Load profile
        const loadResult = await service.loadUserProfile(this.userId);
        this.log('Load result:', loadResult);

      } catch (error) {
        this.log('UserProfileService test error:', error.message);
      }
    } else {
      this.log('❌ UserProfileService not available');
    }
  }

  /**
   * Test 3: Supabase direct operations
   */
  async testSupabaseOperations() {
    this.log('\n=== TEST 3: SUPABASE DIRECT OPERATIONS ===');

    try {
      // Try to get Supabase client
      let supabaseClient = window.supabase;
      if (!supabaseClient) {
        try {
          const { supabase } = await import('/src/config/supabase.js');
          supabaseClient = supabase;
        } catch (error) {
          this.log('❌ Cannot import Supabase client:', error.message);
          return;
        }
      }

      if (!supabaseClient) {
        this.log('❌ Supabase client not available');
        return;
      }

      this.log('✅ Supabase client available');

      // Test connection
      try {
        const { data, error } = await supabaseClient
          .from('users')
          .select('count')
          .limit(1);

        if (error) {
          this.log('❌ Supabase connection test failed:', error.message);
          return;
        } else {
          this.log('✅ Supabase connection successful');
        }
      } catch (error) {
        this.log('❌ Supabase connection error:', error.message);
        return;
      }

      // Check if user exists in users table
      try {
        const { data: user, error: userError } = await supabaseClient
          .from('users')
          .select('*')
          .eq('id', this.userId)
          .single();

        if (userError) {
          this.log('User not found in users table:', userError.message);
        } else {
          this.log('✅ User found in users table:', {
            id: user.id,
            email: user.email,
            name: user.name,
            updated_at: user.updated_at
          });
        }
      } catch (error) {
        this.log('Error checking users table:', error.message);
      }

      // Test user_profiles table operations
      try {
        this.log('Testing user_profiles table...');

        // Check current profile
        const { data: currentProfile, error: currentError } = await supabaseClient
          .from('user_profiles')
          .select('*')
          .eq('user_id', this.userId)
          .single();

        if (currentError && currentError.code !== 'PGRST116') {
          this.log('Error reading current profile:', currentError.message);
        } else {
          this.log('Current profile in DB:', currentProfile || 'NOT FOUND');
        }

        // Save test profile data
        const profileData = {
          user_id: this.userId,
          department: this.testData.department,
          phone: this.testData.phone,
          location: this.testData.location,
          display_name: this.testData.display_name,
          bio: this.testData.bio,
          updated_at: new Date().toISOString()
        };

        const { data: saveData, error: saveError } = await supabaseClient
          .from('user_profiles')
          .upsert(profileData, { onConflict: 'user_id' })
          .select()
          .single();

        if (saveError) {
          this.log('❌ Profile save to Supabase failed:', saveError.message);
        } else {
          this.log('✅ Profile saved to Supabase:', saveData);

          // Immediately read back
          const { data: readBack, error: readError } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('user_id', this.userId)
            .single();

          if (readError) {
            this.log('❌ Failed to read back from Supabase:', readError.message);
          } else {
            this.log('✅ Read back from Supabase:', readBack);

            // Compare data
            const fieldsMatch =
              readBack.department === profileData.department &&
              readBack.phone === profileData.phone &&
              readBack.location === profileData.location &&
              readBack.display_name === profileData.display_name &&
              readBack.bio === profileData.bio;

            this.log(`Data integrity check: ${fieldsMatch ? 'PASSED' : 'FAILED'}`);
          }
        }

      } catch (error) {
        this.log('Error in user_profiles table test:', error.message);
      }

    } catch (error) {
      this.log('Supabase test error:', error.message);
    }
  }

  /**
   * Test 4: Page refresh simulation
   */
  async testPageRefreshSimulation() {
    this.log('\n=== TEST 4: PAGE REFRESH SIMULATION ===');

    // First, save data using all methods
    this.log('Saving data using all available methods...');

    // Method 1: Direct localStorage
    const directKey = `profileFields_${this.userId}`;
    localStorage.setItem(directKey, JSON.stringify({
      ...this.testData,
      updated_at: new Date().toISOString(),
      user_id: this.userId,
      method: 'direct'
    }));

    // Method 2: CurrentUser update
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      try {
        const userData = JSON.parse(currentUser);
        const updatedUser = {
          ...userData,
          ...this.testData,
          updated_at: new Date().toISOString()
        };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        this.log('✅ Updated currentUser');
      } catch (error) {
        this.log('❌ Failed to update currentUser:', error.message);
      }
    }

    // Method 3: Service if available
    if (window.bulletproofProfileFieldsService) {
      try {
        await window.bulletproofProfileFieldsService.saveProfileFields(this.userId, this.testData);
        this.log('✅ Saved via bulletproof service');
      } catch (error) {
        this.log('❌ Service save failed:', error.message);
      }
    }

    this.log('All save methods completed. Checking immediate state...');

    // Check immediate state
    const immediateState = this.captureFullState();
    this.log('Immediate state after save:', immediateState);

    // Simulate the conditions after page refresh
    this.log('\nSimulating post-refresh conditions...');

    // Wait a bit to simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check what data loading would find
    const postRefreshState = this.captureFullState();
    this.log('State after 1 second:', postRefreshState);

    // Compare states
    const comparison = this.compareStates(immediateState, postRefreshState);
    this.log('State comparison:', comparison);

    // Try loading through services as if page just refreshed
    if (window.bulletproofProfileFieldsService) {
      try {
        const serviceLoad = await window.bulletproofProfileFieldsService.loadProfileFields(this.userId);
        this.log('Service load result (simulating fresh page):', serviceLoad);
      } catch (error) {
        this.log('Service load error:', error.message);
      }
    }
  }

  /**
   * Test 5: Race condition detection
   */
  async testRaceConditions() {
    this.log('\n=== TEST 5: RACE CONDITION DETECTION ===');

    // Rapid save/load cycles
    this.log('Testing rapid save/load cycles...');

    const promises = [];
    const results = [];

    // Start multiple save operations simultaneously
    for (let i = 0; i < 5; i++) {
      const testData = {
        ...this.testData,
        iteration: i,
        timestamp: new Date().toISOString()
      };

      const promise = this.performSaveLoadCycle(testData, i);
      promises.push(promise);
    }

    // Wait for all operations to complete
    const allResults = await Promise.allSettled(promises);
    this.log('Race condition test results:', allResults);

    // Test overlapping operations
    this.log('\nTesting overlapping save operations...');

    const overlappingPromises = [
      this.saveViaLocalStorage(this.testData),
      this.saveViaService(this.testData),
      this.saveViaCurrentUser(this.testData)
    ];

    const overlappingResults = await Promise.allSettled(overlappingPromises);
    this.log('Overlapping operations results:', overlappingResults);

    // Check final state
    await new Promise(resolve => setTimeout(resolve, 1000));
    const finalState = this.captureFullState();
    this.log('Final state after race condition tests:', finalState);
  }

  /**
   * Perform save/load cycle
   */
  async performSaveLoadCycle(testData, iteration) {
    try {
      const key = `profileFields_${this.userId}`;

      // Save
      localStorage.setItem(key, JSON.stringify({
        ...testData,
        cycle: iteration
      }));

      // Immediate load
      const immediate = localStorage.getItem(key);

      // Wait
      await new Promise(resolve => setTimeout(resolve, 100 + (iteration * 50)));

      // Load again
      const delayed = localStorage.getItem(key);

      return {
        iteration,
        immediate: !!immediate,
        delayed: !!delayed,
        dataMatches: immediate === delayed
      };
    } catch (error) {
      return {
        iteration,
        error: error.message
      };
    }
  }

  /**
   * Save via localStorage
   */
  async saveViaLocalStorage(data) {
    const key = `profileFields_${this.userId}`;
    localStorage.setItem(key, JSON.stringify({
      ...data,
      method: 'localStorage',
      timestamp: new Date().toISOString()
    }));
    return 'localStorage';
  }

  /**
   * Save via service
   */
  async saveViaService(data) {
    if (window.bulletproofProfileFieldsService) {
      await window.bulletproofProfileFieldsService.saveProfileFields(this.userId, data);
      return 'service';
    }
    throw new Error('Service not available');
  }

  /**
   * Save via currentUser
   */
  async saveViaCurrentUser(data) {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      const userData = JSON.parse(currentUser);
      const updated = {
        ...userData,
        ...data,
        method: 'currentUser',
        updated_at: new Date().toISOString()
      };
      localStorage.setItem('currentUser', JSON.stringify(updated));
      return 'currentUser';
    }
    throw new Error('No currentUser found');
  }

  /**
   * Capture full state
   */
  captureFullState() {
    const state = {};

    // All localStorage keys related to the user
    const allKeys = Object.keys(localStorage).filter(key =>
      key.includes(this.userId) || key.includes('currentUser') || key.includes('Profile')
    );

    allKeys.forEach(key => {
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
   * Compare states
   */
  compareStates(state1, state2) {
    const keys1 = Object.keys(state1);
    const keys2 = Object.keys(state2);

    const addedKeys = keys2.filter(k => !keys1.includes(k));
    const removedKeys = keys1.filter(k => !keys2.includes(k));
    const changedKeys = [];

    keys1.forEach(key => {
      if (keys2.includes(key)) {
        const val1 = JSON.stringify(state1[key]);
        const val2 = JSON.stringify(state2[key]);
        if (val1 !== val2) {
          changedKeys.push({
            key,
            before: state1[key],
            after: state2[key]
          });
        }
      }
    });

    return {
      addedKeys,
      removedKeys,
      changedKeys,
      identical: addedKeys.length === 0 && removedKeys.length === 0 && changedKeys.length === 0
    };
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.clear();
    this.log('🔧 STARTING COMPREHENSIVE AZURE PROFILE FIELD DEBUG TESTS');
    this.log('=' .repeat(60));
    this.log(`Target User ID: ${this.userId}`);
    this.log(`Test Data: ${JSON.stringify(this.testData)}`);
    this.log('=' .repeat(60));

    try {
      await this.testDirectLocalStorage();
      await this.testServiceOperations();
      await this.testSupabaseOperations();
      await this.testPageRefreshSimulation();
      await this.testRaceConditions();

      this.log('\n🎯 ALL TESTS COMPLETED');
      this.log('=' .repeat(60));

      // Generate summary
      const summary = this.generateSummary();
      this.log('📊 TEST SUMMARY:', summary);

      // Save results
      localStorage.setItem('azure_profile_debug_results', JSON.stringify({
        timestamp: new Date().toISOString(),
        results: this.results,
        summary
      }));

      this.log('💾 Results saved to localStorage as "azure_profile_debug_results"');

      return {
        results: this.results,
        summary
      };

    } catch (error) {
      this.log('❌ Test suite error:', error.message);
      return {
        error: error.message,
        results: this.results
      };
    }
  }

  /**
   * Generate summary
   */
  generateSummary() {
    const totalTests = this.results.length;
    const errors = this.results.filter(r => r.message.includes('❌') || r.message.includes('FAILED')).length;
    const successes = this.results.filter(r => r.message.includes('✅') || r.message.includes('SUCCESS')).length;

    return {
      totalEntries: totalTests,
      errors,
      successes,
      testSections: 5,
      timestamp: new Date().toISOString(),
      keyFindings: this.extractKeyFindings()
    };
  }

  /**
   * Extract key findings
   */
  extractKeyFindings() {
    const findings = [];

    // Check localStorage functionality
    const localStorageTests = this.results.filter(r => r.message.includes('Immediate read') || r.message.includes('Delayed read'));
    const localStorageFailures = localStorageTests.filter(r => r.message.includes('FAILED'));
    if (localStorageFailures.length > 0) {
      findings.push('LocalStorage operations are failing');
    }

    // Check service availability
    const serviceUnavailable = this.results.some(r => r.message.includes('not available'));
    if (serviceUnavailable) {
      findings.push('Profile services are not available on window object');
    }

    // Check Supabase connectivity
    const supabaseIssues = this.results.filter(r => r.message.includes('Supabase') && r.message.includes('❌'));
    if (supabaseIssues.length > 0) {
      findings.push('Supabase connectivity or operation issues detected');
    }

    return findings;
  }
}

// Create global instance
window.azureProfileDebugger = new AzureProfileDebugger();

// Quick access function
window.runAzureProfileDebug = () => window.azureProfileDebugger.runAllTests();

console.log('🔧 Azure Profile Field Debugger Loaded');
console.log('Run: runAzureProfileDebug()');
console.log('Or: azureProfileDebugger.runAllTests()');

/**
 * USAGE:
 *
 * 1. Run all tests:
 *    runAzureProfileDebug()
 *
 * 2. Run individual tests:
 *    azureProfileDebugger.testDirectLocalStorage()
 *    azureProfileDebugger.testServiceOperations()
 *    azureProfileDebugger.testSupabaseOperations()
 *    azureProfileDebugger.testPageRefreshSimulation()
 *    azureProfileDebugger.testRaceConditions()
 *
 * 3. Get results:
 *    JSON.parse(localStorage.getItem('azure_profile_debug_results'))
 */