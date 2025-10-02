# Toast Notification System - "On Refresh" Fix

## Problem Statement

The toast notification system was not showing notifications when the page was refreshed, even if there were new Call or SMS records created recently. Notifications would only appear for records inserted AFTER the page loaded, not for records that existed before.

## Root Cause

The `toastNotificationService` used **strict timing validation** that rejected any records created before the service started monitoring:

1. **Line 291** (old): Rejected records created before `monitoringStartTime`
2. **Line 297** (old): Rejected records created before `serviceStartTime`

This meant:
- When you refresh the page, the service starts monitoring at that moment
- ANY existing records (even if created 10 seconds ago) are rejected
- Only NEW INSERT events from Supabase realtime trigger notifications
- Result: No notifications on page refresh

## Solution Implemented

### 1. Added Initial Record Check (`checkForRecentRecords()`)

**Location**: `src/services/toastNotificationService.ts` lines 209-270

**Functionality**:
- Runs when the service initializes (before starting realtime monitoring)
- Queries Supabase for records created in the last 60 seconds
- Filters to only records within the last 60 seconds
- Shows toast notifications for these recent records
- Staggers notifications with 300ms delay to avoid overwhelming the UI

**Query Details**:
```typescript
// Calls
supabase
  .from('calls')
  .select('call_id, start_timestamp')
  .gte('start_timestamp', cutoffTime) // Last 60 seconds
  .order('start_timestamp', { ascending: false })
  .limit(5) // Maximum 5 notifications

// SMS
supabase
  .from('sms_messages')
  .select('id, created_at, content')
  .gte('created_at', cutoffTime) // Last 60 seconds
  .order('created_at', { ascending: false })
  .limit(5) // Maximum 5 notifications
```

### 2. Modified Validation Logic (`isRecordTrulyNew()`)

**Location**: `src/services/toastNotificationService.ts` lines 349-412

**Added Parameter**: `skipTimingChecks = false`

**Two Validation Modes**:

#### Mode 1: Initial Scan (skipTimingChecks = true)
- **Used for**: Records found during page load
- **Checks**:
  - ✅ Must be within 60-second window
  - ✅ Must not be from the future (clock skew protection)
- **Skips**:
  - ❌ Does NOT check `monitoringStartTime`
  - ❌ Does NOT check `serviceStartTime`

#### Mode 2: Realtime Events (skipTimingChecks = false)
- **Used for**: New INSERT events from Supabase
- **Checks**:
  - ✅ Must be created after monitoring started
  - ✅ Must be created after service initialized
  - ✅ Must be within 60-second window
  - ✅ Must not be from the future
  - ✅ Must not be too far in the past

### 3. Updated Handler Methods

**handleNewCall(callRecord, skipTimingChecks = false)**
- **Location**: Lines 414-451
- Passes `skipTimingChecks` to `isRecordTrulyNew()`
- Skips email notifications for initial scan records

**handleNewSMS(smsRecord, skipTimingChecks = false)**
- **Location**: Lines 453-490
- Passes `skipTimingChecks` to `isRecordTrulyNew()`
- Skips email notifications for initial scan records

## How It Works Now

### Scenario 1: Page Refresh with Recent Records

1. User loads/refreshes page
2. `toastNotificationService.initialize()` is called
3. Service sets `serviceStartTime = Date.now()`
4. `setupRealtimeMonitoring()` is called
5. **NEW**: `checkForRecentRecords()` runs BEFORE realtime monitoring starts
6. Queries Supabase for records in last 60 seconds
7. Shows toast notifications for found records (with `skipTimingChecks = true`)
8. Starts realtime monitoring for future records
9. User sees notifications for recent activity

### Scenario 2: New Record Arrives (Realtime)

1. New Call or SMS record inserted into Supabase
2. Supabase realtime triggers `postgres_changes` event
3. `handleNewCall()` or `handleNewSMS()` called (with `skipTimingChecks = false`)
4. Strict timing validation ensures record is truly new
5. Toast notification shown
6. Email notification sent

## Key Features

### ✅ No Spam
- Maximum 5 notifications per type (calls/SMS)
- 300ms delay between notifications
- Deduplication prevents showing same record twice
- Only records within 60 seconds are shown

### ✅ Smart Email Handling
- Email notifications ONLY sent for realtime events
- Initial scan records do NOT trigger emails (prevents spam on every page refresh)

### ✅ Graceful Degradation
- If Supabase query fails, service continues to work for realtime events
- Error logging for debugging
- No user-facing errors

## Configuration

### Time Window
**Variable**: `NEW_RECORD_WINDOW`
**Location**: Line 54
**Value**: 60000ms (60 seconds)
**Purpose**: Maximum age of records to show notifications for

### Maximum Notifications
**Per Type**: 5 calls + 5 SMS = 10 maximum on page load
**Purpose**: Prevent UI overflow on long absence

### Notification Delay
**Value**: 300ms between each notification
**Purpose**: Stagger notifications for better UX

## Testing

### Manual Test 1: Page Refresh
1. Open app in browser
2. Insert a test call or SMS record (use diagnostic page)
3. Wait 5-10 seconds
4. Refresh the page
5. **Expected**: Toast notification appears for the recent record

### Manual Test 2: Realtime Insert
1. Open app in browser
2. Keep page open (don't refresh)
3. Insert a test call or SMS record
4. **Expected**: Toast notification appears immediately

### Manual Test 3: Old Records
1. Check database for records older than 60 seconds
2. Refresh page
3. **Expected**: No notifications for old records

## Debugging

### Console Logging
Enable detailed logging by checking browser console for:
- `🔔 Checking for recent records created in last 60 seconds...`
- `🔔 Found X recent calls`
- `🔔 Showing notification for recent call (Xs ago)`
- `✅ Accepting initial scan notification: Record X (age: Xs)`

### Diagnostic Page
**Location**: `test-toast-notifications.html`
**Usage**: Open in browser to test Supabase connection and insert test records

### Debug Info
Run in browser console:
```javascript
window.toastNotificationService?.getDebugInfo()
```

## Files Modified

1. **src/services/toastNotificationService.ts**
   - Added `checkForRecentRecords()` method (lines 209-270)
   - Modified `setupRealtimeMonitoring()` to call initial check (line 285)
   - Updated `isRecordTrulyNew()` with `skipTimingChecks` parameter (lines 349-412)
   - Updated `handleNewCall()` signature and email logic (lines 414-451)
   - Updated `handleNewSMS()` signature and email logic (lines 453-490)

## Production Deployment

### Before Deploying
- ✅ Test in development (localhost)
- ✅ Test with real Supabase data
- ✅ Test page refresh with recent records
- ✅ Test realtime insert events
- ✅ Verify email notifications still work for realtime events

### After Deploying
- Monitor console logs for errors
- Check that notifications appear on refresh
- Verify no spam or duplicate notifications
- Confirm email notifications work correctly

## Future Enhancements

### Possible Improvements
1. **Persistent Tracking**: Store last-seen timestamp in localStorage to avoid re-showing same notifications across sessions
2. **Smart Window**: Adjust time window based on user activity patterns
3. **Batch Notifications**: Group multiple records into single notification
4. **Click Actions**: Navigate to relevant page when notification is clicked
5. **Sound Preferences**: Per-notification-type sound settings

## Related Documentation

- **CLAUDE.md**: Main project documentation
- **Email Notification System**: `CLAUDE.md` lines 973-1003
- **Toast Notification Service**: `src/services/toastNotificationService.ts`
- **Email Notification Service**: `src/services/emailNotificationService.ts`

---

**Last Updated**: 2025-10-02
**Status**: ✅ IMPLEMENTED AND TESTED
**Author**: Claude Code
