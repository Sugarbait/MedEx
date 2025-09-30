# 🔍 Azure Profile Data Persistence Diagnostic Suite

**Investigation Tools for Profile Field Persistence Issues in Azure Environment**

## Problem Overview

Profile data (Department, Phone, Location, Bio) saves successfully to Supabase but immediately reverts to empty values after page refresh in the Azure deployment. This diagnostic suite provides comprehensive tools to identify and fix the root cause.

## 📁 Diagnostic Tools

### 1. `azure-profile-diagnostic.js` - Comprehensive Diagnostic Scanner
**Primary diagnostic tool for environment analysis**

```javascript
// Load and run comprehensive diagnostic
azureProfileDiagnostic.runFullDiagnostic()
```

**Features:**
- ✅ Environment & configuration check
- ✅ Current data state analysis
- ✅ Supabase database investigation
- ✅ Service function testing
- ✅ Live save/load simulation
- ✅ Network & timing analysis
- ✅ Browser environment analysis

**Key Functions:**
- `azureProfileDiagnostic.runFullDiagnostic()` - Run all tests
- `azureProfileDiagnostic.analyzeCurrentDataState()` - Check current data
- `azureProfileDiagnostic.investigateSupabaseData()` - Test database
- `azureProfileDiagnostic.simulateSaveLoadCycle()` - Test persistence

### 2. `azure-profile-tracer.js` - Real-Time Data Flow Tracer
**Real-time monitoring for live debugging**

```javascript
// Start real-time tracing
startProfileTracing()

// Run simulation with full trace
simulateProfileSave()

// Monitor during user actions
monitorProfileData(60000) // Monitor for 1 minute
```

**Features:**
- 🕵️ Real-time localStorage interception
- 🕵️ Service method call tracing
- 🕵️ Event monitoring (storage, page lifecycle)
- 🕵️ Live dashboard display
- 🕵️ Export trace data to file

**Key Functions:**
- `startProfileTracing()` / `stopProfileTracing()` - Control tracing
- `simulateProfileSave()` - Test with full trace
- `azureProfileTracer.showLiveDashboard()` - Live monitoring
- `azureProfileTracer.exportTraces()` - Export results

### 3. `azure-profile-debugger.js` - Focused Field Testing
**Specific tests for profile field persistence**

```javascript
// Run all focused tests
runAzureProfileDebug()
```

**Features:**
- 🔧 Direct localStorage operations testing
- 🔧 Service-based operations testing
- 🔧 Supabase direct operations testing
- 🔧 Page refresh simulation
- 🔧 Race condition detection

**Key Functions:**
- `runAzureProfileDebug()` - Run all tests
- Individual test methods for specific scenarios

### 4. `azure-profile-fix-generator.js` - Automated Fix Generator
**Analyzes issues and provides automated fixes**

```javascript
// Analyze and generate fixes
analyzeAzureProfileIssue()

// Apply specific fix
applyProfileFix(1)

// Apply all recommended fixes
applyAllProfileFixes()
```

**Features:**
- 🔨 Automatic issue analysis
- 🔨 Targeted fix generation based on findings
- 🔨 Automated fix application
- 🔨 Comprehensive bulletproof persistence implementation
- 🔨 Verification and testing

## 🚀 Quick Start Guide

### Step 1: Load Tools in Azure Environment

1. **Navigate to your Azure deployment**: `https://carexps.nexasync.ca`
2. **Open browser console** (F12)
3. **Copy and paste each diagnostic script** into the console

### Step 2: Run Initial Diagnostic

```javascript
// Run comprehensive diagnostic
azureProfileDiagnostic.runFullDiagnostic()
```

**This will:**
- Test all environment components
- Check data state across storage locations
- Verify Supabase connectivity
- Test service availability
- Simulate save/load cycles

### Step 3: Analyze Results

```javascript
// Get detailed report
JSON.parse(localStorage.getItem('carexps_diagnostic_report'))
```

**Look for:**
- ❌ **Critical failures** - Core functionality broken
- ⚠️ **Warnings** - Configuration or connectivity issues
- ✅ **Passes** - Working components

### Step 4: Generate and Apply Fixes

```javascript
// Analyze issue and generate targeted fixes
analyzeAzureProfileIssue()

// Review available fixes
fixGenerator.fixes

// Apply the comprehensive fix (recommended)
applyProfileFix(8) // Usually the comprehensive fix

// Or apply all fixes
applyAllProfileFixes()
```

### Step 5: Verify Fix

1. **Refresh the page**
2. **Fill out profile fields** (Department, Phone, Location, Bio)
3. **Save the profile**
4. **Refresh the page again**
5. **Check if fields persist**

## 🔧 Common Issues & Solutions

### Issue 1: LocalStorage Not Functional
**Symptoms:** Direct localStorage tests fail
**Solution:** Comprehensive fix implements fallback storage

### Issue 2: Services Not Available
**Symptoms:** `bulletproofProfileFieldsService` undefined
**Solution:** Service fix restores global access

### Issue 3: Supabase Connection Failed
**Symptoms:** Cannot connect to database
**Solution:** Supabase fix restores connectivity

### Issue 4: Data Inconsistency
**Symptoms:** Different data in different storage locations
**Solution:** Data sync fix harmonizes all storage

### Issue 5: User ID Mismatch
**Symptoms:** CurrentUser ID doesn't match target user
**Solution:** User ID fix corrects localStorage data

## 📊 Understanding Diagnostic Results

### Environment Check Results
```javascript
{
  "cloudAvailable": true,     // Supabase accessible
  "localStorageCount": 4,     // Number of storage locations with data
  "hasProfileData": true,     // Profile data found somewhere
  "lastSync": "2024-01-15T..."// Last synchronization timestamp
}
```

### Critical Status Indicators
- ✅ **PASS** - Component working correctly
- ❌ **FAIL** - Critical issue requiring immediate attention
- ⚠️ **WARN** - Issue that may cause problems
- ℹ️ **INFO** - Informational, no action needed

## 🛠️ Advanced Usage

### Live Monitoring During User Actions
```javascript
// Start tracing
startProfileTracing()

// User performs actions (fill fields, save, etc.)
// All operations are automatically traced

// View live dashboard
azureProfileTracer.showLiveDashboard()

// Stop tracing
stopProfileTracing()

// Export results
azureProfileTracer.exportTraces()
```

### Testing Specific Scenarios
```javascript
// Test just localStorage
azureProfileDebugger.testDirectLocalStorage()

// Test just services
azureProfileDebugger.testServiceOperations()

// Test just Supabase
azureProfileDebugger.testSupabaseOperations()

// Test race conditions
azureProfileDebugger.testRaceConditions()
```

### Custom Fix Development
```javascript
// Access diagnostic results for custom analysis
const results = azureProfileDiagnostic.diagnosticResults
const issues = fixGenerator.analyzeResults()

// Create custom fix
const customFix = {
  id: 'custom_fix',
  name: 'My Custom Fix',
  implementation: {
    code: `
      // Your custom fix implementation
      console.log('Applying custom fix...');
    `
  }
}

// Apply custom logic
eval(customFix.implementation.code)
```

## 📋 Troubleshooting Checklist

### Before Running Diagnostics
- [ ] Confirm you're on the Azure deployment (`carexps.nexasync.ca`)
- [ ] Open browser console (F12)
- [ ] Clear console for clean output

### If Diagnostics Fail
- [ ] Check console for JavaScript errors
- [ ] Verify scripts loaded completely
- [ ] Try refreshing page and reloading scripts
- [ ] Check network connectivity

### If Fixes Don't Work
- [ ] Run diagnostic again after applying fixes
- [ ] Check for new error messages
- [ ] Try applying fixes one at a time
- [ ] Clear localStorage and try again: `localStorage.clear()`

## 📞 Support Information

### Target User Details
- **User ID:** `c550502f-c39d-4bb3-bb8c-d193657fdb24`
- **Email:** `pierre@phaetonai.com`
- **Name:** `Pierre Morenzie`
- **Environment:** Azure Static Web Apps

### Expected Behavior
1. User fills profile fields (Department, Phone, Location, Bio)
2. Clicks save - console shows successful operations
3. Page refreshes
4. Profile fields should retain their values
5. Currently: fields revert to "Not set"

### Result Storage Locations
All diagnostic results are automatically saved to localStorage:
- `carexps_diagnostic_report` - Main diagnostic results
- `azure_profile_debug_results` - Focused test results
- `profile-traces-YYYY-MM-DD.json` - Exported trace data

## 🎯 Success Criteria

**Fix is successful when:**
1. ✅ Profile fields save and persist after page refresh
2. ✅ Data consistency across all storage locations
3. ✅ No console errors related to profile operations
4. ✅ Supabase and localStorage sync properly
5. ✅ All diagnostic tests pass

---

**Generated for CareXPS Healthcare CRM - Azure Profile Persistence Investigation**
*Last Updated: January 2025*