# How to Switch Dashboard from Demo Mode to Production Mode

## 🎯 Overview

The MedEx dashboard is currently in **demo mode**, using local fake data. This guide shows you exactly how to switch it to **production mode** to use real Retell AI data.

---

## 📋 Files to Modify

You need to modify **2 files**:

1. `src/pages/DashboardPage.tsx` - Switch from demo data to real API calls
2. `src/App.tsx` - Enable Retell monitoring service

---

## 🔧 Step-by-Step Instructions

### Step 1: Modify Dashboard Data Fetching

**File**: `src/pages/DashboardPage.tsx`

#### What to Change:

**Find this section (lines 791-819):**

```typescript
// DEMO MODE: Use local demo data instead of API calls
let callsResponse, chatsResponse

console.log('📊 Demo Mode: Fetching demo data (NO external API calls)')

// Get demo calls within date range
const demoCalls = await demoDataService.getCallsInRange(start, end)
console.log(`📊 Demo Mode: Loaded ${demoCalls.length} demo calls for date range`)

// Get demo SMS chats within date range
const demoChats = await demoDataService.getSMSChatsInRange(start, end)
console.log(`📊 Demo Mode: Loaded ${demoChats.length} demo SMS chats for date range`)

// Format responses to match expected structure
callsResponse = {
  calls: demoCalls,
  pagination_key: undefined,
  has_more: false
}

chatsResponse = {
  chats: demoChats,
  pagination_key: undefined,
  has_more: false
}

console.log('📊 Demo Mode: Data fetching complete (local demo data only)')
console.log('- Demo calls loaded:', demoCalls.length)
console.log('- Demo chats loaded:', demoChats.length)
```

**Replace it with:**

```typescript
// PRODUCTION MODE: Fetch real data from Retell AI API
let callsResponse, chatsResponse

console.log('🚀 Production Mode: Fetching real data from Retell AI API')

// Reload credentials to ensure we have the latest
try {
  await retellService.loadCredentialsAsync()
  console.log('✅ Credentials loaded successfully')
} catch (error) {
  console.log('⚠️ Supabase credential sync failed, using localStorage fallback:', error)
}

// Check if API key is configured
let apiKey = retellService.getApiKey()
let hasApiKey = !!apiKey

if (!hasApiKey) {
  console.log('🔄 No API key found on first check, forcing credential reload...')
  retellService.loadCredentials()
  apiKey = retellService.getApiKey()
  hasApiKey = !!apiKey
}

if (!hasApiKey) {
  console.log('❌ No API key found, showing not-configured warning')
  setRetellStatus('not-configured')
  setIsLoading(false)
  return
}

setRetellStatus('connected')

// Fetch real calls from Retell AI
console.log('📞 Fetching calls from Retell AI...')
const allCalls = await retellService.getAllCalls()
console.log(`📞 Total calls in system: ${allCalls.length}`)

// Filter calls by date range
const startMs = start.getTime()
const endMs = end.getTime()

const filteredCalls = allCalls.filter(call => {
  let callTimeMs: number
  const timestampStr = call.start_timestamp.toString()

  if (timestampStr.length <= 10) {
    callTimeMs = call.start_timestamp * 1000
  } else {
    callTimeMs = call.start_timestamp
  }

  return callTimeMs >= startMs && callTimeMs <= endMs
})

console.log(`📞 Filtered calls for ${selectedDateRange}: ${filteredCalls.length} out of ${allCalls.length}`)

callsResponse = {
  calls: filteredCalls,
  pagination_key: undefined,
  has_more: false
}

// Fetch real SMS chats from Retell AI
console.log('💬 Fetching chats from Retell AI...')
await chatService.syncWithRetellService()

const allChatsResponse = await chatService.getChatHistory({
  limit: 500
})
console.log(`💬 Total chats fetched: ${allChatsResponse.chats.length}`)

// Filter chats by date range
const filteredChats = allChatsResponse.chats.filter(chat => {
  let chatTimeMs: number
  const timestampStr = chat.start_timestamp.toString()

  if (timestampStr.length <= 10) {
    chatTimeMs = chat.start_timestamp * 1000
  } else {
    chatTimeMs = chat.start_timestamp
  }

  return chatTimeMs >= startMs && chatTimeMs <= endMs
})

console.log(`💬 Filtered chats for ${selectedDateRange}: ${filteredChats.length} out of ${allChatsResponse.chats.length}`)

chatsResponse = {
  chats: filteredChats,
  pagination_key: undefined,
  has_more: false
}

console.log('✅ Production Mode: Data fetching complete (real API data)')
console.log('- Real calls loaded:', filteredCalls.length)
console.log('- Real chats loaded:', filteredChats.length)
```

#### Also Update the Initial Console Log:

**Find line 769:**
```typescript
console.log('🚀 📊 DEMO MODE: fetchDashboardData CALLED - Using local demo data (NO external API calls)')
```

**Replace with:**
```typescript
console.log('🚀 📊 PRODUCTION MODE: fetchDashboardData CALLED - Fetching real data from Retell AI')
```

#### Also Update Line 776:

**Find:**
```typescript
console.log('📊 Demo Mode - Skipping API configuration check')
```

**Replace with:**
```typescript
console.log('📊 Production Mode - Loading API credentials')
```

---

### Step 2: Remove Demo Mode Banner

**File**: `src/pages/DashboardPage.tsx`

**Find this section (lines 1016-1022):**

```typescript
{/* Demo Mode Warning */}
<div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
  <p className="text-yellow-800 dark:text-yellow-300 text-sm">
    <strong>📊 Demo Mode Active:</strong> This dashboard is displaying sample data generated locally. No real calls or SMS are being fetched.
    All data is generated locally with <strong>ZERO connections to external APIs</strong>.
  </p>
</div>
```

**Replace with:**

```typescript
{/* Production Mode Indicator */}
<div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
  <p className="text-green-800 dark:text-green-300 text-sm">
    <strong>✅ Production Mode:</strong> Dashboard is displaying real-time data from Retell AI.
    All metrics are calculated from actual calls and SMS conversations.
  </p>
</div>
```

---

### Step 3: Enable Retell Monitoring Service

**File**: `src/App.tsx`

**Find this section (around line 423-426):**

```typescript
// DEMO MODE: No external API connections
console.log('📊 Demo Mode - Skipping Retell AI initialization (no external API calls)')
// await retellService.ensureCredentialsLoaded()  // DISABLED
// retellMonitoringService.start()                // DISABLED
```

**Replace with:**

```typescript
// PRODUCTION MODE: Enable Retell AI monitoring
console.log('🚀 Production Mode - Initializing Retell AI services')
await retellService.ensureCredentialsLoaded()
retellMonitoringService.start()
```

---

### Step 4: Remove Demo Data Import (Optional)

**File**: `src/pages/DashboardPage.tsx`

**Find line 9:**
```typescript
import { demoDataService } from '@/services/demoDataService'
```

**You can comment it out or remove it:**
```typescript
// import { demoDataService } from '@/services/demoDataService'  // No longer needed in production
```

---

## 🚀 After Making Changes

### 1. Save All Files

Save both modified files:
- `src/pages/DashboardPage.tsx`
- `src/App.tsx`

### 2. Dev Server Will Auto-Reload

The Vite dev server will automatically detect the changes and hot-reload the app.

### 3. Clear Browser Storage (Recommended)

Before testing, clear your browser storage to ensure fresh credentials:

1. Open DevTools (F12)
2. Go to Application tab
3. Click "Clear site data"
4. Refresh the page

### 4. Test the Dashboard

1. **Login** with demo credentials:
   - Email: `admin@medex.com`
   - Password: `admin123`
   - MFA: `123456`

2. **Navigate to Dashboard**

3. **Check Console** for these messages:
   ```
   🚀 📊 PRODUCTION MODE: fetchDashboardData CALLED
   📊 Production Mode - Loading API credentials
   🔐 Bulletproof credentials loaded successfully
   ✅ Credentials loaded successfully
   📞 Fetching calls from Retell AI...
   📞 Total calls in system: X
   💬 Fetching chats from Retell AI...
   💬 Total chats fetched: Y
   ✅ Production Mode: Data fetching complete (real API data)
   ```

4. **Check Network Tab** for API calls:
   - Should see requests to `api.retellai.com`
   - Should see successful API responses (200 status)

---

## 🔍 Verification Checklist

After switching to production mode, verify:

- [ ] Dashboard loads without errors
- [ ] Console shows "PRODUCTION MODE" messages
- [ ] Network tab shows requests to `api.retellai.com`
- [ ] Real call data is displayed (not demo data)
- [ ] Real SMS data is displayed (not demo data)
- [ ] Metrics update based on date range selection
- [ ] No "Demo Mode" banner is shown
- [ ] Green "Production Mode" banner is visible
- [ ] Costs match real Retell AI billing data

---

## 🔄 Switching Back to Demo Mode

If you need to switch back to demo mode:

1. **Undo all changes** in both files
2. **Restore demo mode code** from the original sections
3. **Clear browser storage**
4. **Refresh the page**

Or use git to revert:
```bash
git checkout src/pages/DashboardPage.tsx
git checkout src/App.tsx
```

---

## ⚠️ Troubleshooting

### "API not configured" warning appears

**Cause**: Credentials not loaded properly

**Fix**:
1. Check console for credential loading errors
2. Verify credentials in `src/config/retellCredentials.ts`
3. Clear browser storage and refresh
4. Check that `retellService.loadCredentials()` is called

### No data appears on dashboard

**Cause**: No calls/chats in selected date range

**Fix**:
1. Try selecting "All Time" date range
2. Check console for actual data counts
3. Verify API returns data: check Network tab responses
4. Ensure Retell AI account has call/chat history

### API returns 401 Unauthorized

**Cause**: Invalid API key

**Fix**:
1. Double-check API key in `retellCredentials.ts`
2. Verify key format starts with `key_`
3. Confirm key is active in Retell AI dashboard
4. Check for typos in the key

### API returns empty arrays

**Cause**: No data in the selected time period

**Fix**:
1. Select a broader date range (e.g., "All Time")
2. Verify your Retell AI account has call/chat history
3. Check agent IDs match the agents that made calls/chats
4. Look at API response in Network tab to confirm it's empty

---

## 📊 Expected Behavior After Switch

### Before (Demo Mode):
- ✅ Shows 10 fake calls
- ✅ Shows 15 fake SMS chats
- ✅ Random costs ($0.50-$2.50)
- ✅ Data doesn't change
- ✅ Works offline
- ❌ Not real data

### After (Production Mode):
- ✅ Shows real calls from Retell AI
- ✅ Shows real SMS chats from Retell AI
- ✅ Actual costs from Retell AI API
- ✅ Data updates with API changes
- ✅ Requires internet connection
- ✅ Real production data

---

## 🎯 Summary

**To switch to production mode:**

1. **Edit `DashboardPage.tsx`** - Replace demo data calls with real API calls (lines 791-819)
2. **Edit `DashboardPage.tsx`** - Change demo banner to production banner (lines 1016-1022)
3. **Edit `App.tsx`** - Enable Retell monitoring service (around line 423)
4. **Save files** - Vite will auto-reload
5. **Clear browser storage** - Start fresh
6. **Test dashboard** - Verify real data loads

**Estimated time**: 5-10 minutes

---

**Last Updated**: October 3, 2025
**Status**: Ready to switch to production mode
**Credentials**: Already configured and tested

