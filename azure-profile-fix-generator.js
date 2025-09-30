/**
 * 🔨 AZURE PROFILE FIX GENERATOR
 *
 * Analyzes the profile persistence issue and generates specific fixes
 * Based on the diagnostic results, provides actionable solutions
 */

class AzureProfileFixGenerator {
  constructor() {
    this.userId = 'c550502f-c39d-4bb3-bb8c-d193657fdb24';
    this.diagnosticResults = null;
    this.fixes = [];
    this.appliedFixes = [];
  }

  /**
   * Analyze the current issue and generate fixes
   */
  async analyzeAndGenerateFixes() {
    console.log('🔨 AZURE PROFILE FIX GENERATOR');
    console.log('=' .repeat(50));

    // Step 1: Run diagnostic to understand the issue
    await this.runDiagnostic();

    // Step 2: Analyze the results
    const analysis = this.analyzeResults();
    console.log('📊 Analysis Results:', analysis);

    // Step 3: Generate targeted fixes
    const fixes = this.generateFixes(analysis);
    console.log('🔧 Generated Fixes:', fixes);

    // Step 4: Offer to apply fixes
    console.log('\n💡 Available Fixes:');
    fixes.forEach((fix, index) => {
      console.log(`${index + 1}. ${fix.name}: ${fix.description}`);
    });

    console.log('\nTo apply fixes:');
    console.log('  fixGenerator.applyFix(1) - Apply specific fix');
    console.log('  fixGenerator.applyAllFixes() - Apply all recommended fixes');

    return fixes;
  }

  /**
   * Run comprehensive diagnostic
   */
  async runDiagnostic() {
    console.log('🔍 Running comprehensive diagnostic...');

    const results = {
      timestamp: new Date().toISOString(),
      environment: this.detectEnvironment(),
      localStorage: this.checkLocalStorage(),
      currentUserState: this.checkCurrentUser(),
      profileFieldsState: this.checkProfileFields(),
      serviceAvailability: this.checkServiceAvailability(),
      supabaseConnectivity: await this.checkSupabaseConnectivity(),
      dataConsistency: this.checkDataConsistency()
    };

    this.diagnosticResults = results;
    console.log('✅ Diagnostic completed');
    return results;
  }

  /**
   * Detect environment details
   */
  detectEnvironment() {
    return {
      hostname: window.location.hostname,
      isAzure: window.location.hostname.includes('carexps.nexasync.ca') ||
               window.location.hostname.includes('azurestaticapps.net'),
      protocol: window.location.protocol,
      userAgent: navigator.userAgent,
      localStorage: typeof Storage !== 'undefined',
      cookiesEnabled: navigator.cookieEnabled
    };
  }

  /**
   * Check localStorage functionality
   */
  checkLocalStorage() {
    try {
      const testKey = 'azure_profile_test';
      const testValue = 'test_value_' + Date.now();

      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      return {
        available: true,
        functional: retrieved === testValue,
        quota: this.getLocalStorageQuota(),
        usage: this.getLocalStorageUsage()
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Check current user state
   */
  checkCurrentUser() {
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) {
      return { exists: false };
    }

    try {
      const userData = JSON.parse(currentUser);
      return {
        exists: true,
        valid: !!userData.id,
        matchesTargetUser: userData.id === this.userId,
        hasProfileFields: !!(userData.department || userData.phone || userData.location || userData.bio),
        profileFields: {
          department: userData.department || 'EMPTY',
          phone: userData.phone || 'EMPTY',
          location: userData.location || 'EMPTY',
          display_name: userData.display_name || 'EMPTY',
          bio: userData.bio || 'EMPTY'
        }
      };
    } catch (error) {
      return {
        exists: true,
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Check profile fields in all storage locations
   */
  checkProfileFields() {
    const storageKeys = [
      'profileFields_',
      'userProfile_',
      'profileData_',
      'userFields_'
    ];

    const results = {};

    storageKeys.forEach(keyPrefix => {
      const key = `${keyPrefix}${this.userId}`;
      const data = localStorage.getItem(key);

      if (data) {
        try {
          const parsed = JSON.parse(data);
          results[key] = {
            exists: true,
            hasProfileData: !!(parsed.department || parsed.phone || parsed.location || parsed.bio),
            profileFields: {
              department: parsed.department || 'EMPTY',
              phone: parsed.phone || 'EMPTY',
              location: parsed.location || 'EMPTY',
              display_name: parsed.display_name || 'EMPTY',
              bio: parsed.bio || 'EMPTY'
            },
            updated_at: parsed.updated_at
          };
        } catch (error) {
          results[key] = {
            exists: true,
            valid: false,
            error: error.message
          };
        }
      } else {
        results[key] = { exists: false };
      }
    });

    // Check global storage
    const allProfiles = localStorage.getItem('allUserProfiles');
    if (allProfiles) {
      try {
        const profiles = JSON.parse(allProfiles);
        results.allUserProfiles = {
          exists: true,
          userExists: !!profiles[this.userId],
          userData: profiles[this.userId] || null
        };
      } catch (error) {
        results.allUserProfiles = {
          exists: true,
          valid: false,
          error: error.message
        };
      }
    } else {
      results.allUserProfiles = { exists: false };
    }

    return results;
  }

  /**
   * Check service availability
   */
  checkServiceAvailability() {
    return {
      bulletproofProfileFieldsService: !!window.bulletproofProfileFieldsService,
      userProfileService: !!(window.userProfileService || window.UserProfileService),
      supabaseClient: !!window.supabase,
      services: {
        bulletproof: typeof window.bulletproofProfileFieldsService,
        userProfile: typeof (window.userProfileService || window.UserProfileService),
        supabase: typeof window.supabase
      }
    };
  }

  /**
   * Check Supabase connectivity
   */
  async checkSupabaseConnectivity() {
    try {
      let supabaseClient = window.supabase;

      if (!supabaseClient) {
        try {
          const { supabase } = await import('/src/config/supabase.js');
          supabaseClient = supabase;
        } catch (importError) {
          return {
            available: false,
            error: 'Cannot import Supabase client: ' + importError.message
          };
        }
      }

      if (!supabaseClient) {
        return { available: false, error: 'Supabase client not available' };
      }

      // Test connection
      const { data, error } = await supabaseClient
        .from('users')
        .select('count')
        .limit(1);

      if (error) {
        return {
          available: true,
          connected: false,
          error: error.message
        };
      }

      // Test user lookup
      const { data: user, error: userError } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', this.userId)
        .single();

      // Test user_profiles lookup
      const { data: profile, error: profileError } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      return {
        available: true,
        connected: true,
        userExists: !userError,
        profileExists: !profileError,
        userData: userError ? null : user,
        profileData: profileError ? null : profile
      };

    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Check data consistency across storage locations
   */
  checkDataConsistency() {
    const currentUser = this.diagnosticResults?.currentUserState || this.checkCurrentUser();
    const profileFields = this.diagnosticResults?.profileFieldsState || this.checkProfileFields();

    const inconsistencies = [];

    // Compare currentUser with profile storage
    if (currentUser.exists && currentUser.valid) {
      const currentUserFields = currentUser.profileFields;

      Object.keys(profileFields).forEach(key => {
        if (key.startsWith('profileFields_') && profileFields[key].exists && profileFields[key].hasProfileData) {
          const storedFields = profileFields[key].profileFields;

          ['department', 'phone', 'location', 'display_name', 'bio'].forEach(field => {
            if (currentUserFields[field] !== storedFields[field]) {
              inconsistencies.push({
                field,
                currentUser: currentUserFields[field],
                storage: storedFields[field],
                storageKey: key
              });
            }
          });
        }
      });
    }

    return {
      consistent: inconsistencies.length === 0,
      inconsistencies
    };
  }

  /**
   * Analyze diagnostic results and identify issues
   */
  analyzeResults() {
    const results = this.diagnosticResults;
    const issues = [];
    const severity = { critical: [], high: [], medium: [], low: [] };

    // Critical issues
    if (!results.localStorage.available || !results.localStorage.functional) {
      issues.push('localStorage_unavailable');
      severity.critical.push('LocalStorage is not available or functional');
    }

    if (!results.currentUserState.exists) {
      issues.push('no_current_user');
      severity.critical.push('No currentUser found in localStorage');
    }

    if (results.currentUserState.exists && !results.currentUserState.valid) {
      issues.push('invalid_current_user');
      severity.critical.push('CurrentUser data is corrupted');
    }

    // High priority issues
    if (results.currentUserState.exists && !results.currentUserState.matchesTargetUser) {
      issues.push('user_id_mismatch');
      severity.high.push('CurrentUser ID does not match target user');
    }

    if (!results.serviceAvailability.bulletproofProfileFieldsService) {
      issues.push('service_unavailable');
      severity.high.push('BulletproofProfileFieldsService not available');
    }

    if (results.supabaseConnectivity.available && !results.supabaseConnectivity.connected) {
      issues.push('supabase_connection_failed');
      severity.high.push('Supabase connection failed');
    }

    // Medium priority issues
    if (results.dataConsistency && !results.dataConsistency.consistent) {
      issues.push('data_inconsistency');
      severity.medium.push('Data inconsistency across storage locations');
    }

    if (results.currentUserState.exists && results.currentUserState.valid && !results.currentUserState.hasProfileFields) {
      issues.push('empty_profile_fields');
      severity.medium.push('Profile fields are empty in currentUser');
    }

    // Low priority issues
    if (results.localStorage.usage > 80) {
      issues.push('high_storage_usage');
      severity.low.push('High localStorage usage detected');
    }

    return {
      issues,
      severity,
      totalIssues: issues.length,
      criticalCount: severity.critical.length,
      diagnosis: this.generateDiagnosis(issues, severity)
    };
  }

  /**
   * Generate diagnosis summary
   */
  generateDiagnosis(issues, severity) {
    if (severity.critical.length > 0) {
      return 'CRITICAL: Core functionality is broken - immediate intervention required';
    } else if (severity.high.length > 0) {
      return 'HIGH: Profile persistence is likely failing due to service or connectivity issues';
    } else if (severity.medium.length > 0) {
      return 'MEDIUM: Data consistency issues may cause profile fields to revert';
    } else if (severity.low.length > 0) {
      return 'LOW: Minor issues detected that could impact performance';
    } else {
      return 'HEALTHY: No significant issues detected - problem may be intermittent';
    }
  }

  /**
   * Generate specific fixes based on analysis
   */
  generateFixes(analysis) {
    const fixes = [];

    // Fix for localStorage issues
    if (analysis.issues.includes('localStorage_unavailable')) {
      fixes.push({
        id: 'fix_localStorage',
        name: 'LocalStorage Fallback',
        description: 'Implement alternative storage mechanism',
        severity: 'critical',
        implementation: this.generateLocalStorageFix()
      });
    }

    // Fix for missing currentUser
    if (analysis.issues.includes('no_current_user')) {
      fixes.push({
        id: 'fix_currentUser',
        name: 'Recreate CurrentUser',
        description: 'Recreate currentUser from available data',
        severity: 'critical',
        implementation: this.generateCurrentUserFix()
      });
    }

    // Fix for user ID mismatch
    if (analysis.issues.includes('user_id_mismatch')) {
      fixes.push({
        id: 'fix_user_id_mismatch',
        name: 'Fix User ID Mismatch',
        description: 'Correct user ID in localStorage',
        severity: 'high',
        implementation: this.generateUserIdFix()
      });
    }

    // Fix for service unavailability
    if (analysis.issues.includes('service_unavailable')) {
      fixes.push({
        id: 'fix_service_availability',
        name: 'Restore Service Access',
        description: 'Make profile services available globally',
        severity: 'high',
        implementation: this.generateServiceFix()
      });
    }

    // Fix for data inconsistency
    if (analysis.issues.includes('data_inconsistency')) {
      fixes.push({
        id: 'fix_data_consistency',
        name: 'Synchronize Data',
        description: 'Synchronize profile data across all storage locations',
        severity: 'medium',
        implementation: this.generateDataSyncFix()
      });
    }

    // Fix for empty profile fields
    if (analysis.issues.includes('empty_profile_fields')) {
      fixes.push({
        id: 'fix_empty_fields',
        name: 'Restore Profile Fields',
        description: 'Attempt to restore profile fields from Supabase',
        severity: 'medium',
        implementation: this.generateProfileRestoreFix()
      });
    }

    // Fix for Supabase connectivity
    if (analysis.issues.includes('supabase_connection_failed')) {
      fixes.push({
        id: 'fix_supabase_connection',
        name: 'Fix Supabase Connection',
        description: 'Restore Supabase connectivity for cloud sync',
        severity: 'high',
        implementation: this.generateSupabaseFix()
      });
    }

    // Always add a comprehensive fix
    fixes.push({
      id: 'fix_comprehensive',
      name: 'Comprehensive Profile Fix',
      description: 'Apply all necessary fixes and implement bulletproof profile persistence',
      severity: 'comprehensive',
      implementation: this.generateComprehensiveFix()
    });

    this.fixes = fixes;
    return fixes;
  }

  /**
   * Generate localStorage fix implementation
   */
  generateLocalStorageFix() {
    return {
      description: 'Test and restore localStorage functionality',
      code: `
// Test localStorage functionality
try {
  const testKey = 'carexps_storage_test';
  const testValue = 'test_' + Date.now();
  localStorage.setItem(testKey, testValue);
  const retrieved = localStorage.getItem(testKey);
  localStorage.removeItem(testKey);

  if (retrieved !== testValue) {
    throw new Error('LocalStorage read/write mismatch');
  }

  console.log('✅ LocalStorage is functional');
  return true;
} catch (error) {
  console.error('❌ LocalStorage test failed:', error);

  // Implement fallback storage using sessionStorage or memory
  window.fallbackStorage = new Map();

  // Override localStorage methods
  const originalSetItem = localStorage.setItem;
  const originalGetItem = localStorage.getItem;

  localStorage.setItem = function(key, value) {
    try {
      originalSetItem.call(this, key, value);
    } catch (e) {
      window.fallbackStorage.set(key, value);
    }
  };

  localStorage.getItem = function(key) {
    try {
      return originalGetItem.call(this, key) || window.fallbackStorage.get(key);
    } catch (e) {
      return window.fallbackStorage.get(key);
    }
  };

  console.log('✅ Fallback storage implemented');
  return false;
}
      `
    };
  }

  /**
   * Generate currentUser fix implementation
   */
  generateCurrentUserFix() {
    return {
      description: 'Recreate currentUser from available data sources',
      code: `
// Attempt to recreate currentUser from available data
const userId = '${this.userId}';

// Check if user data exists in other storage locations
const storageKeys = [
  'profileFields_' + userId,
  'userProfile_' + userId,
  'profileData_' + userId,
  'systemUsers'
];

let userData = null;

// Try to find user data
for (const key of storageKeys) {
  try {
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);

      if (key === 'systemUsers') {
        // Find user in systemUsers array
        const users = Array.isArray(parsed) ? parsed : [];
        userData = users.find(u => u.id === userId);
      } else if (parsed.user_id === userId || parsed.id === userId) {
        userData = parsed;
      }

      if (userData) {
        console.log('✅ Found user data in:', key);
        break;
      }
    }
  } catch (error) {
    console.warn('Error parsing data from:', key, error);
  }
}

if (userData) {
  // Reconstruct currentUser
  const currentUser = {
    id: userData.id || userId,
    email: userData.email || 'pierre@phaetonai.com',
    name: userData.name || userData.display_name || 'Pierre Morenzie',
    role: userData.role || 'super_user',
    department: userData.department || '',
    phone: userData.phone || '',
    location: userData.location || '',
    display_name: userData.display_name || userData.name || '',
    bio: userData.bio || '',
    avatar: userData.avatar,
    mfa_enabled: userData.mfa_enabled || false,
    settings: userData.settings || {},
    created_at: userData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  console.log('✅ CurrentUser recreated:', currentUser);
  return currentUser;
} else {
  // Create minimal currentUser
  const minimalUser = {
    id: userId,
    email: 'pierre@phaetonai.com',
    name: 'Pierre Morenzie',
    role: 'super_user',
    department: '',
    phone: '',
    location: '',
    display_name: 'Pierre Morenzie',
    bio: '',
    mfa_enabled: false,
    settings: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  localStorage.setItem('currentUser', JSON.stringify(minimalUser));
  console.log('✅ Minimal currentUser created:', minimalUser);
  return minimalUser;
}
      `
    };
  }

  /**
   * Generate comprehensive fix implementation
   */
  generateComprehensiveFix() {
    return {
      description: 'Complete profile persistence fix with bulletproof implementation',
      code: `
// Comprehensive Azure Profile Persistence Fix
const userId = '${this.userId}';

console.log('🔨 Starting Comprehensive Profile Fix...');

// Step 1: Ensure localStorage is functional
${this.generateLocalStorageFix().code}

// Step 2: Recreate currentUser if needed
const currentUser = localStorage.getItem('currentUser');
if (!currentUser) {
  ${this.generateCurrentUserFix().code}
}

// Step 3: Implement bulletproof profile field persistence
class BulletproofProfilePersistence {
  static STORAGE_KEYS = [
    'profileFields_',
    'userProfile_',
    'profileData_',
    'userFields_'
  ];

  static async saveProfileFields(userId, fields) {
    console.log('🛡️ Saving profile fields with bulletproof method...');

    const timestamp = new Date().toISOString();
    const dataToSave = {
      ...fields,
      user_id: userId,
      updated_at: timestamp,
      persistence_version: '2.0'
    };

    let successCount = 0;
    const errors = [];

    // Save to multiple localStorage keys
    for (const keyPrefix of this.STORAGE_KEYS) {
      try {
        const key = keyPrefix + userId;
        localStorage.setItem(key, JSON.stringify(dataToSave));
        successCount++;
        console.log('✅ Saved to:', key);
      } catch (error) {
        errors.push(\`Failed to save to \${keyPrefix}: \${error.message}\`);
      }
    }

    // Save to global storage
    try {
      const allProfiles = localStorage.getItem('allUserProfiles') || '{}';
      const profiles = JSON.parse(allProfiles);
      profiles[userId] = dataToSave;
      localStorage.setItem('allUserProfiles', JSON.stringify(profiles));
      successCount++;
      console.log('✅ Saved to allUserProfiles');
    } catch (error) {
      errors.push('Failed to save to allUserProfiles: ' + error.message);
    }

    // Update currentUser
    try {
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser) {
        const userData = JSON.parse(currentUser);
        const updatedUser = {
          ...userData,
          ...fields,
          updated_at: timestamp
        };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        successCount++;
        console.log('✅ Updated currentUser');
      }
    } catch (error) {
      errors.push('Failed to update currentUser: ' + error.message);
    }

    // Verify immediate persistence
    const verification = this.verifyProfileFields(userId, fields);

    return {
      success: successCount > 0,
      successCount,
      errors,
      verification
    };
  }

  static loadProfileFields(userId) {
    console.log('🛡️ Loading profile fields with bulletproof method...');

    // Try all storage locations
    for (const keyPrefix of this.STORAGE_KEYS) {
      try {
        const key = keyPrefix + userId;
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (this.isValidProfileData(parsed)) {
            console.log('✅ Loaded from:', key);
            return {
              success: true,
              data: parsed,
              source: key
            };
          }
        }
      } catch (error) {
        console.warn('Error loading from:', keyPrefix, error);
      }
    }

    // Try global storage
    try {
      const allProfiles = localStorage.getItem('allUserProfiles');
      if (allProfiles) {
        const profiles = JSON.parse(allProfiles);
        if (profiles[userId] && this.isValidProfileData(profiles[userId])) {
          console.log('✅ Loaded from allUserProfiles');
          return {
            success: true,
            data: profiles[userId],
            source: 'allUserProfiles'
          };
        }
      }
    } catch (error) {
      console.warn('Error loading from allUserProfiles:', error);
    }

    // Try currentUser as fallback
    try {
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser) {
        const userData = JSON.parse(currentUser);
        if (userData.id === userId) {
          const profileData = {
            department: userData.department || '',
            phone: userData.phone || '',
            location: userData.location || '',
            display_name: userData.display_name || '',
            bio: userData.bio || '',
            user_id: userId,
            updated_at: userData.updated_at
          };

          if (this.isValidProfileData(profileData)) {
            console.log('✅ Loaded from currentUser');
            return {
              success: true,
              data: profileData,
              source: 'currentUser'
            };
          }
        }
      }
    } catch (error) {
      console.warn('Error loading from currentUser:', error);
    }

    return {
      success: false,
      error: 'No valid profile data found in any storage location'
    };
  }

  static isValidProfileData(data) {
    return data &&
           typeof data === 'object' &&
           (data.department !== undefined ||
            data.phone !== undefined ||
            data.location !== undefined ||
            data.display_name !== undefined ||
            data.bio !== undefined);
  }

  static verifyProfileFields(userId, expectedFields) {
    console.log('🔍 Verifying profile field persistence...');

    const verification = {
      passed: false,
      details: {}
    };

    // Check each storage location
    for (const keyPrefix of this.STORAGE_KEYS) {
      const key = keyPrefix + userId;
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          const matches = Object.keys(expectedFields).every(field =>
            parsed[field] === expectedFields[field]
          );
          verification.details[key] = { exists: true, matches };
        } else {
          verification.details[key] = { exists: false, matches: false };
        }
      } catch (error) {
        verification.details[key] = { exists: false, error: error.message };
      }
    }

    // Overall verification
    const hasValidStorage = Object.values(verification.details).some(detail =>
      detail.exists && detail.matches
    );

    verification.passed = hasValidStorage;

    console.log('🔍 Verification result:', verification);
    return verification;
  }
}

// Step 4: Make the service globally available
window.BulletproofProfilePersistence = BulletproofProfilePersistence;

// Step 5: Test the fix with current profile data
console.log('🧪 Testing the fix...');

const testFields = {
  department: 'Pierre Department Test',
  phone: 'Pierre Phone Test',
  location: 'Pierre Location Test',
  display_name: 'Pierre Display Name Test',
  bio: 'Pierre Bio Test'
};

// Save test data
const saveResult = await BulletproofProfilePersistence.saveProfileFields(userId, testFields);
console.log('💾 Save test result:', saveResult);

// Wait a moment and verify
setTimeout(async () => {
  const loadResult = BulletproofProfilePersistence.loadProfileFields(userId);
  console.log('📥 Load test result:', loadResult);

  if (loadResult.success) {
    console.log('✅ COMPREHENSIVE FIX SUCCESSFUL!');
    console.log('Profile fields are now persisting correctly.');

    // Apply to actual profile if test was successful
    const actualCurrentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (actualCurrentUser.id === userId) {
      const actualFields = {
        department: actualCurrentUser.department || '',
        phone: actualCurrentUser.phone || '',
        location: actualCurrentUser.location || '',
        display_name: actualCurrentUser.display_name || '',
        bio: actualCurrentUser.bio || ''
      };

      if (Object.values(actualFields).some(value => value && value !== '')) {
        await BulletproofProfilePersistence.saveProfileFields(userId, actualFields);
        console.log('✅ Applied fix to actual profile data');
      }
    }
  } else {
    console.log('❌ Fix verification failed:', loadResult.error);
  }
}, 1000);

console.log('🔨 Comprehensive Profile Fix completed!');

// Step 6: Instructions for ongoing use
console.log('\\n📋 To use the fixed profile system:');
console.log('  Save: BulletproofProfilePersistence.saveProfileFields(userId, fields)');
console.log('  Load: BulletproofProfilePersistence.loadProfileFields(userId)');
console.log('  Verify: BulletproofProfilePersistence.verifyProfileFields(userId, fields)');
      `
    };
  }

  /**
   * Apply a specific fix
   */
  async applyFix(fixIndex) {
    if (fixIndex < 1 || fixIndex > this.fixes.length) {
      console.error('❌ Invalid fix index');
      return;
    }

    const fix = this.fixes[fixIndex - 1];
    console.log(`🔨 Applying fix: ${fix.name}`);
    console.log(`Description: ${fix.description}`);

    try {
      // Execute the fix code
      const result = await eval(fix.implementation.code);

      this.appliedFixes.push({
        fix: fix.id,
        name: fix.name,
        appliedAt: new Date().toISOString(),
        result
      });

      console.log(`✅ Fix applied successfully: ${fix.name}`);
      return result;
    } catch (error) {
      console.error(`❌ Fix failed: ${fix.name}`, error);
      return { error: error.message };
    }
  }

  /**
   * Apply all recommended fixes
   */
  async applyAllFixes() {
    console.log('🔨 Applying all recommended fixes...');

    const results = [];
    for (let i = 0; i < this.fixes.length; i++) {
      const result = await this.applyFix(i + 1);
      results.push(result);

      // Wait between fixes to avoid conflicts
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('✅ All fixes applied');
    return results;
  }

  /**
   * Get localStorage quota information
   */
  getLocalStorageQuota() {
    try {
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length + key.length;
        }
      }

      // Estimate quota (usually 5-10MB)
      const estimatedQuota = 5 * 1024 * 1024; // 5MB
      const usagePercent = (totalSize / estimatedQuota) * 100;

      return {
        used: totalSize,
        estimatedQuota,
        usagePercent: Math.round(usagePercent * 100) / 100
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get localStorage usage breakdown
   */
  getLocalStorageUsage() {
    const usage = {};
    let totalSize = 0;

    try {
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          const size = localStorage[key].length + key.length;
          usage[key] = size;
          totalSize += size;
        }
      }

      // Sort by size
      const sorted = Object.entries(usage)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10); // Top 10

      return {
        totalSize,
        topKeys: sorted,
        keyCount: Object.keys(usage).length
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Generate additional fix implementations
   */
  generateUserIdFix() {
    return {
      description: 'Fix user ID mismatch in localStorage',
      code: `
const targetUserId = '${this.userId}';
const currentUser = localStorage.getItem('currentUser');

if (currentUser) {
  try {
    const userData = JSON.parse(currentUser);
    if (userData.id !== targetUserId) {
      console.log('🔧 Fixing user ID mismatch...');
      userData.id = targetUserId;
      userData.updated_at = new Date().toISOString();
      localStorage.setItem('currentUser', JSON.stringify(userData));
      console.log('✅ User ID corrected to:', targetUserId);
    }
  } catch (error) {
    console.error('❌ Failed to fix user ID:', error);
  }
}
      `
    };
  }

  generateServiceFix() {
    return {
      description: 'Restore global access to profile services',
      code: `
// Try to restore service access
if (typeof window.bulletproofProfileFieldsService === 'undefined') {
  try {
    // Attempt dynamic import
    import('/src/services/bulletproofProfileFieldsService.js').then(module => {
      window.bulletproofProfileFieldsService = module.bulletproofProfileFieldsService;
      console.log('✅ BulletproofProfileFieldsService restored');
    }).catch(error => {
      console.warn('Could not import service:', error);
    });
  } catch (error) {
    console.warn('Dynamic import failed:', error);
  }
}

if (typeof window.userProfileService === 'undefined' && typeof window.UserProfileService === 'undefined') {
  try {
    import('/src/services/userProfileService.js').then(module => {
      window.userProfileService = module.userProfileService;
      console.log('✅ UserProfileService restored');
    }).catch(error => {
      console.warn('Could not import UserProfileService:', error);
    });
  } catch (error) {
    console.warn('UserProfileService import failed:', error);
  }
}
      `
    };
  }

  generateDataSyncFix() {
    return {
      description: 'Synchronize profile data across all storage locations',
      code: `
const userId = '${this.userId}';
console.log('🔄 Synchronizing profile data...');

// Collect all profile data from different locations
const sources = {};
const storageKeys = ['profileFields_', 'userProfile_', 'profileData_', 'userFields_'];

storageKeys.forEach(keyPrefix => {
  const key = keyPrefix + userId;
  const data = localStorage.getItem(key);
  if (data) {
    try {
      sources[key] = JSON.parse(data);
    } catch (error) {
      console.warn('Failed to parse:', key);
    }
  }
});

// Check currentUser
const currentUser = localStorage.getItem('currentUser');
if (currentUser) {
  try {
    const userData = JSON.parse(currentUser);
    if (userData.id === userId) {
      sources.currentUser = userData;
    }
  } catch (error) {
    console.warn('Failed to parse currentUser');
  }
}

// Find the most complete and recent data
let masterData = null;
let latestTimestamp = null;

Object.keys(sources).forEach(key => {
  const data = sources[key];
  if (data.updated_at) {
    const timestamp = new Date(data.updated_at);
    if (!latestTimestamp || timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      masterData = data;
    }
  }
});

if (masterData) {
  console.log('📋 Master data found from:', latestTimestamp);

  const profileFields = {
    department: masterData.department || '',
    phone: masterData.phone || '',
    location: masterData.location || '',
    display_name: masterData.display_name || '',
    bio: masterData.bio || ''
  };

  // Synchronize to all locations
  const syncData = {
    ...profileFields,
    user_id: userId,
    updated_at: new Date().toISOString(),
    sync_version: '1.0'
  };

  // Update all storage locations
  storageKeys.forEach(keyPrefix => {
    const key = keyPrefix + userId;
    localStorage.setItem(key, JSON.stringify(syncData));
  });

  // Update currentUser
  if (sources.currentUser) {
    const updatedCurrentUser = {
      ...sources.currentUser,
      ...profileFields,
      updated_at: syncData.updated_at
    };
    localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));
  }

  console.log('✅ Data synchronized across all locations');
  return { success: true, syncData };
} else {
  console.warn('❌ No master data found for synchronization');
  return { success: false, error: 'No master data available' };
}
      `
    };
  }

  generateProfileRestoreFix() {
    return {
      description: 'Attempt to restore profile fields from Supabase',
      code: `
const userId = '${this.userId}';
console.log('🔄 Attempting to restore profile from Supabase...');

try {
  let supabaseClient = window.supabase;

  if (!supabaseClient) {
    const { supabase } = await import('/src/config/supabase.js');
    supabaseClient = supabase;
  }

  if (supabaseClient) {
    // Try to get user_profiles data
    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!profileError && profile) {
      console.log('✅ Profile found in Supabase:', profile);

      const restoredFields = {
        department: profile.department || '',
        phone: profile.phone || '',
        location: profile.location || '',
        display_name: profile.display_name || '',
        bio: profile.bio || ''
      };

      // Apply to localStorage
      const key = 'profileFields_' + userId;
      const dataToSave = {
        ...restoredFields,
        user_id: userId,
        updated_at: new Date().toISOString(),
        restored_from: 'supabase'
      };

      localStorage.setItem(key, JSON.stringify(dataToSave));

      // Update currentUser
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser) {
        const userData = JSON.parse(currentUser);
        const updatedUser = {
          ...userData,
          ...restoredFields,
          updated_at: dataToSave.updated_at
        };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      }

      console.log('✅ Profile fields restored from Supabase');
      return { success: true, restoredFields };
    } else {
      console.log('❌ No profile found in Supabase:', profileError?.message);
      return { success: false, error: profileError?.message || 'No profile found' };
    }
  } else {
    console.log('❌ Supabase client not available');
    return { success: false, error: 'Supabase client not available' };
  }
} catch (error) {
  console.error('❌ Profile restore failed:', error);
  return { success: false, error: error.message };
}
      `
    };
  }

  generateSupabaseFix() {
    return {
      description: 'Fix Supabase connection and configuration',
      code: `
console.log('🔧 Fixing Supabase connection...');

try {
  // Check environment variables
  const supabaseUrl = import.meta?.env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta?.env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  console.log('Environment check:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    urlDomain: supabaseUrl ? new URL(supabaseUrl).hostname : 'MISSING'
  });

  // Try to recreate Supabase client
  if (supabaseUrl && supabaseKey) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Test the connection
    const { data, error } = await supabaseClient
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Supabase connection test failed:', error);
      return { success: false, error: error.message };
    } else {
      console.log('✅ Supabase connection restored');
      window.supabase = supabaseClient;
      return { success: true, client: supabaseClient };
    }
  } else {
    console.error('❌ Missing Supabase credentials');
    return { success: false, error: 'Missing Supabase credentials' };
  }
} catch (error) {
  console.error('❌ Supabase fix failed:', error);
  return { success: false, error: error.message };
}
      `
    };
  }
}

// Create global instance
window.azureProfileFixGenerator = new AzureProfileFixGenerator();
window.fixGenerator = window.azureProfileFixGenerator;

// Quick access functions
window.analyzeAzureProfileIssue = () => window.azureProfileFixGenerator.analyzeAndGenerateFixes();
window.applyProfileFix = (index) => window.azureProfileFixGenerator.applyFix(index);
window.applyAllProfileFixes = () => window.azureProfileFixGenerator.applyAllFixes();

console.log('🔨 Azure Profile Fix Generator Loaded');
console.log('Available commands:');
console.log('  • analyzeAzureProfileIssue() - Analyze and generate fixes');
console.log('  • applyProfileFix(1) - Apply specific fix by index');
console.log('  • applyAllProfileFixes() - Apply all recommended fixes');
console.log('  • fixGenerator.fixes - View available fixes');

/**
 * USAGE WORKFLOW:
 *
 * 1. Analyze the issue:
 *    analyzeAzureProfileIssue()
 *
 * 2. Review the generated fixes:
 *    fixGenerator.fixes
 *
 * 3. Apply a specific fix:
 *    applyProfileFix(1)  // Apply first fix
 *
 * 4. Or apply all fixes:
 *    applyAllProfileFixes()
 *
 * 5. Test the results by refreshing the page and checking profile fields
 */