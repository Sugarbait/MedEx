/**
 * 🔍 AZURE PROFILE DIAGNOSTIC LOADER
 *
 * Copy and paste this entire script into your Azure console to load all diagnostic tools
 * Then run: azureProfileDiagnostic.runFullDiagnostic()
 */

console.log('🔄 Loading Azure Profile Diagnostic Suite...');

// Azure Profile Diagnostic Class
class AzureProfileDiagnostic {
  constructor() {
    this.userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';
    this.results = {
      timestamp: new Date().toISOString(),
      environment: 'azure',
      diagnostics: []
    };
  }

  log(section, status, message, data = null) {
    const result = {
      section,
      status,
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

  async checkEnvironment() {
    this.log('ENVIRONMENT', 'INFO', 'Starting environment check...');

    // Check if we're in Azure
    const isAzure = window.location.hostname.includes('azurestaticapps.net') ||
                   window.location.hostname.includes('nexasync.ca');
    this.log('ENVIRONMENT', isAzure ? 'PASS' : 'WARN', `Environment: ${isAzure ? 'Azure' : 'Local'}`, {
      hostname: window.location.hostname,
      url: window.location.href
    });

    // Check localStorage availability
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      this.log('ENVIRONMENT', 'PASS', 'localStorage available');
    } catch (e) {
      this.log('ENVIRONMENT', 'FAIL', 'localStorage not available', e.message);
    }

    // Check Supabase availability
    const supabaseAvailable = typeof window.supabase !== 'undefined';
    this.log('ENVIRONMENT', supabaseAvailable ? 'PASS' : 'FAIL',
             `Supabase client: ${supabaseAvailable ? 'Available' : 'Not found'}`);

    return { isAzure, supabaseAvailable };
  }

  async checkCurrentData() {
    this.log('DATA', 'INFO', 'Checking current data state...');

    // Check all localStorage keys for this user
    const profileKeys = [
      `profileFields_${this.userId}`,
      `userProfile_${this.userId}`,
      `profileData_${this.userId}`,
      'currentUser',
      'systemUsers'
    ];

    const dataState = {};
    profileKeys.forEach(key => {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          dataState[key] = JSON.parse(data);
          this.log('DATA', 'PASS', `Found data: ${key}`, JSON.parse(data));
        } catch (e) {
          this.log('DATA', 'WARN', `Invalid JSON in: ${key}`, data);
        }
      } else {
        this.log('DATA', 'WARN', `Missing: ${key}`);
      }
    });

    return dataState;
  }

  async checkServices() {
    this.log('SERVICES', 'INFO', 'Checking service availability...');

    // Check bulletproofProfileFieldsService
    const bulletproofAvailable = typeof window.bulletproofProfileFieldsService !== 'undefined';
    this.log('SERVICES', bulletproofAvailable ? 'PASS' : 'FAIL',
             `bulletproofProfileFieldsService: ${bulletproofAvailable ? 'Available' : 'Not found'}`);

    // Check userProfileService
    const userProfileAvailable = typeof window.userProfileService !== 'undefined';
    this.log('SERVICES', userProfileAvailable ? 'PASS' : 'FAIL',
             `userProfileService: ${userProfileAvailable ? 'Available' : 'Not found'}`);

    // Check if services are in window scope or need to be accessed differently
    if (!bulletproofAvailable) {
      // Try to find the service in React DevTools or other scopes
      this.log('SERVICES', 'INFO', 'Attempting to locate services in React components...');
    }

    return { bulletproofAvailable, userProfileAvailable };
  }

  async testSupabaseConnection() {
    this.log('SUPABASE', 'INFO', 'Testing Supabase connection...');

    if (typeof window.supabase === 'undefined') {
      this.log('SUPABASE', 'FAIL', 'Supabase client not available');
      return false;
    }

    try {
      // Test basic connection
      const { data, error } = await window.supabase
        .from('users')
        .select('id, name, username')
        .eq('id', this.userId)
        .single();

      if (error) {
        this.log('SUPABASE', 'FAIL', 'Failed to query users table', error);
        return false;
      }

      this.log('SUPABASE', 'PASS', 'Users table query successful', data);

      // Test user_profiles table
      const { data: profileData, error: profileError } = await window.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = no rows
        this.log('SUPABASE', 'FAIL', 'Failed to query user_profiles table', profileError);
      } else {
        this.log('SUPABASE', 'PASS', 'User profiles table accessible', profileData || 'No profile data');
      }

      return true;
    } catch (e) {
      this.log('SUPABASE', 'FAIL', 'Supabase connection test failed', e.message);
      return false;
    }
  }

  async simulateSaveLoad() {
    this.log('SIMULATION', 'INFO', 'Simulating save/load cycle...');

    const testData = {
      display_name: 'Test Name',
      department: 'Test Department',
      phone: '+1234567890',
      location: 'Test Location',
      bio: 'Test Bio'
    };

    try {
      // Test localStorage save
      const testKey = `test_profileFields_${this.userId}`;
      localStorage.setItem(testKey, JSON.stringify(testData));

      // Test localStorage load
      const retrieved = localStorage.getItem(testKey);
      const parsed = JSON.parse(retrieved);

      if (JSON.stringify(parsed) === JSON.stringify(testData)) {
        this.log('SIMULATION', 'PASS', 'localStorage save/load test successful');
      } else {
        this.log('SIMULATION', 'FAIL', 'localStorage data corruption detected', { saved: testData, retrieved: parsed });
      }

      // Clean up
      localStorage.removeItem(testKey);

      // Test Supabase save if available
      if (typeof window.supabase !== 'undefined') {
        const { data, error } = await window.supabase
          .from('user_profiles')
          .upsert({
            user_id: this.userId,
            ...testData,
            updated_at: new Date().toISOString()
          })
          .select();

        if (error) {
          this.log('SIMULATION', 'FAIL', 'Supabase save test failed', error);
        } else {
          this.log('SIMULATION', 'PASS', 'Supabase save test successful', data);
        }
      }

    } catch (e) {
      this.log('SIMULATION', 'FAIL', 'Simulation failed', e.message);
    }
  }

  async runFullDiagnostic() {
    console.log('🔍 STARTING AZURE PROFILE DATA DIAGNOSTIC');
    console.log('==========================================');

    await this.checkEnvironment();
    await this.checkCurrentData();
    await this.checkServices();
    await this.testSupabaseConnection();
    await this.simulateSaveLoad();

    console.log('==========================================');
    console.log('🔍 DIAGNOSTIC COMPLETE');
    console.log('Results stored in: azureProfileDiagnostic.results');

    // Analyze results and provide recommendations
    this.analyzeResults();

    return this.results;
  }

  analyzeResults() {
    console.log('\n📊 ANALYSIS & RECOMMENDATIONS:');

    const failures = this.results.diagnostics.filter(d => d.status === 'FAIL');
    const warnings = this.results.diagnostics.filter(d => d.status === 'WARN');

    if (failures.length > 0) {
      console.log('❌ Critical Issues Found:');
      failures.forEach(f => console.log(`   • ${f.section}: ${f.message}`));
    }

    if (warnings.length > 0) {
      console.log('⚠️ Warnings:');
      warnings.forEach(w => console.log(`   • ${w.section}: ${w.message}`));
    }

    // Specific recommendations based on common issues
    const hasSupabase = this.results.diagnostics.some(d =>
      d.section === 'SUPABASE' && d.status === 'PASS' && d.message.includes('query successful'));

    const hasServices = this.results.diagnostics.some(d =>
      d.section === 'SERVICES' && d.status === 'PASS');

    if (!hasSupabase) {
      console.log('\n🔧 RECOMMENDATION: Supabase connection issues detected');
      console.log('   Try: Check network connectivity and API keys');
    }

    if (!hasServices) {
      console.log('\n🔧 RECOMMENDATION: Service availability issues detected');
      console.log('   Try: Ensure you are on the Settings page where services are loaded');
    }

    console.log('\n💡 Next steps:');
    console.log('   1. Review diagnostic results above');
    console.log('   2. Address any FAIL or WARN issues');
    console.log('   3. Run: azureProfileDiagnostic.testProfileFields() for field-specific testing');
  }

  async testProfileFields() {
    console.log('\n🧪 TESTING PROFILE FIELDS SPECIFICALLY...');

    // Test current profile field loading
    const currentFields = localStorage.getItem(`profileFields_${this.userId}`);
    console.log('Current profile fields in localStorage:', currentFields ? JSON.parse(currentFields) : 'None');

    // Test if bulletproof service can load fields
    if (typeof window.bulletproofProfileFieldsService !== 'undefined') {
      try {
        const result = await window.bulletproofProfileFieldsService.loadProfileFields(this.userId);
        console.log('✅ Bulletproof service loaded fields:', result);
      } catch (e) {
        console.log('❌ Bulletproof service failed:', e.message);
      }
    }

    console.log('\n📝 To test saving:');
    console.log('   1. Fill in the profile form fields');
    console.log('   2. Click Save');
    console.log('   3. Run: azureProfileDiagnostic.checkAfterSave()');
  }

  checkAfterSave() {
    console.log('\n🔍 CHECKING DATA AFTER SAVE...');

    const fields = localStorage.getItem(`profileFields_${this.userId}`);
    const profile = localStorage.getItem(`userProfile_${this.userId}`);

    console.log('Profile fields after save:', fields ? JSON.parse(fields) : 'None');
    console.log('User profile after save:', profile ? JSON.parse(profile) : 'None');

    // Check if data is actually empty or just appears empty
    if (fields) {
      const parsed = JSON.parse(fields);
      const isEmpty = Object.values(parsed).every(val => !val || val === '' || val === 'EMPTY');
      console.log(isEmpty ? '⚠️ Fields appear to be empty!' : '✅ Fields contain data');
    }
  }
}

// Fix Generator
window.generateProfileFix = function() {
  console.log('\n🔧 GENERATING PROFILE PERSISTENCE FIX...');

  const fixCode = `
// BULLETPROOF PROFILE FIELD PERSISTENCE FIX
window.bulletproofProfileFix = {
  async saveProfileData(userId, profileData) {
    console.log('🛡️ Bulletproof save starting...', profileData);

    // Save to multiple localStorage keys for redundancy
    const keys = [
      \`profileFields_\${userId}\`,
      \`userProfile_\${userId}\`,
      \`backup_profileFields_\${userId}\`
    ];

    keys.forEach(key => {
      try {
        localStorage.setItem(key, JSON.stringify(profileData));
        console.log(\`✅ Saved to \${key}\`);
      } catch (e) {
        console.error(\`❌ Failed to save to \${key}:\`, e);
      }
    });

    // Save to Supabase if available
    if (typeof window.supabase !== 'undefined') {
      try {
        const { data, error } = await window.supabase
          .from('user_profiles')
          .upsert({
            user_id: userId,
            ...profileData,
            updated_at: new Date().toISOString()
          })
          .select();

        if (error) {
          console.error('❌ Supabase save failed:', error);
        } else {
          console.log('✅ Supabase save successful:', data);
        }
      } catch (e) {
        console.error('❌ Supabase save error:', e);
      }
    }

    console.log('🛡️ Bulletproof save complete');
  },

  async loadProfileData(userId) {
    console.log('🛡️ Bulletproof load starting...');

    const keys = [
      \`profileFields_\${userId}\`,
      \`userProfile_\${userId}\`,
      \`backup_profileFields_\${userId}\`
    ];

    // Try loading from each key
    for (const key of keys) {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed && Object.keys(parsed).length > 0) {
            console.log(\`✅ Loaded from \${key}:\`, parsed);
            return parsed;
          }
        }
      } catch (e) {
        console.error(\`❌ Failed to load from \${key}:\`, e);
      }
    }

    // Try loading from Supabase
    if (typeof window.supabase !== 'undefined') {
      try {
        const { data, error } = await window.supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (data && !error) {
          console.log('✅ Loaded from Supabase:', data);
          return data;
        }
      } catch (e) {
        console.error('❌ Supabase load error:', e);
      }
    }

    console.log('❌ No profile data found anywhere');
    return {};
  }
};

console.log('✅ Bulletproof profile fix loaded!');
console.log('Usage:');
console.log('  window.bulletproofProfileFix.saveProfileData(userId, data)');
console.log('  window.bulletproofProfileFix.loadProfileData(userId)');
`;

  eval(fixCode);
  console.log('🔧 Fix applied! Use window.bulletproofProfileFix to save/load data.');
};

// Initialize diagnostic tool
window.azureProfileDiagnostic = new AzureProfileDiagnostic();

console.log('✅ Azure Profile Diagnostic Suite Loaded!');
console.log('');
console.log('🔍 Available Commands:');
console.log('  azureProfileDiagnostic.runFullDiagnostic()     - Run complete diagnostic');
console.log('  azureProfileDiagnostic.testProfileFields()    - Test profile field operations');
console.log('  azureProfileDiagnostic.checkAfterSave()       - Check data after saving');
console.log('  generateProfileFix()                          - Generate persistence fix');
console.log('');
console.log('🚀 START HERE: azureProfileDiagnostic.runFullDiagnostic()');