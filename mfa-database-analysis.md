# MFA Database Issues Analysis and Fix

## Problem Summary
The healthcare CRM has MFA (Multi-Factor Authentication) database issues after migrating user IDs from TEXT to UUID format. Users are experiencing "Invalid TOTP code" errors because MFA secrets were stored under old TEXT user IDs but the system now expects UUID format.

## Root Cause Analysis

### 1. **User ID Migration Issue**
- **Before**: User IDs were TEXT format (e.g., "dynamic-pierre-user")
- **After**: User IDs are UUID format (e.g., "c550502f-c39d-4bb3-bb8c-d193657fdb24")
- **Problem**: MFA secrets stored under old TEXT user IDs, but retrieval attempts use new UUID format

### 2. **MFA Service Architecture**
The `FreshMfaService` uses the `userIdTranslationService` to convert between string IDs and UUIDs:
- **Storage**: Always converts string ID → UUID before database operations
- **Retrieval**: Always converts string ID → UUID before database lookups
- **Translation Mappings**: Static mappings defined in `UserIdTranslationService.DEMO_USER_MAPPINGS`

### 3. **Current Translation Mappings**
```typescript
private static readonly DEMO_USER_MAPPINGS: { [key: string]: string } = {
  'pierre-user-789': 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
  'super-user-456': 'ee77ed8f-525f-43c9-a70a-b81cb8dc8d5d',
  'guest-user-456': 'demo-user-uuid-placeholder',
  'dynamic-pierre-user': 'a1b2c3d4-e5f6-7890-abcd-123456789012'
}
```

### 4. **Database Schema (user_settings table)**
From migration files, the `user_settings` table has these MFA columns:
- `fresh_mfa_secret TEXT`
- `fresh_mfa_enabled BOOLEAN DEFAULT false`
- `fresh_mfa_setup_completed BOOLEAN DEFAULT false`
- `fresh_mfa_backup_codes TEXT`

## Issues Identified

### 1. **UUID Mismatch**
- User was previously "dynamic-pierre-user" (TEXT)
- Now appears as "c550502f-c39d-4bb3-bb8c-d193657fdb24" (UUID)
- Translation service maps "dynamic-pierre-user" → "a1b2c3d4-e5f6-7890-abcd-123456789012"
- But actual current UUID is "c550502f-c39d-4bb3-bb8c-d193657fdb24"
- **Result**: MFA lookup fails because it searches wrong UUID

### 2. **Orphaned MFA Data**
- MFA secrets may exist under UUIDs that no longer match current user mappings
- Database may contain MFA records for deprecated UUID mappings

### 3. **Translation Service Gap**
- Static mappings may not reflect actual current user state
- User ID changed from "dynamic-pierre-user" to UUID, but mapping still points to wrong UUID

## Fix Strategy

### Phase 1: Database Investigation
1. **Check existing MFA data in user_settings table**
2. **Identify orphaned MFA records with old UUID mappings**
3. **Verify current user ID to UUID relationships**

### Phase 2: Data Migration
1. **Update MFA records to correct UUID mappings**
2. **Clear corrupted/orphaned MFA data**
3. **Update userIdTranslationService mappings**

### Phase 3: Validation
1. **Test MFA setup and verification flows**
2. **Verify TOTP codes work correctly**
3. **Ensure proper user isolation**

## Specific Fix Steps

### Step 1: Update User ID Translation Mappings
The translation service needs to be updated to reflect the actual current user UUID:

```typescript
// BEFORE (incorrect):
'dynamic-pierre-user': 'a1b2c3d4-e5f6-7890-abcd-123456789012'

// AFTER (correct):
'dynamic-pierre-user': 'c550502f-c39d-4bb3-bb8c-d193657fdb24'
```

### Step 2: Database MFA Data Cleanup SQL
```sql
-- Check current MFA data
SELECT user_id, fresh_mfa_enabled, fresh_mfa_setup_completed,
       CASE WHEN fresh_mfa_secret IS NOT NULL THEN 'HAS_SECRET' ELSE 'NO_SECRET' END as secret_status
FROM user_settings
WHERE fresh_mfa_secret IS NOT NULL OR fresh_mfa_enabled = true;

-- Clear MFA data for wrong UUID mappings
UPDATE user_settings
SET fresh_mfa_secret = NULL,
    fresh_mfa_enabled = false,
    fresh_mfa_setup_completed = false,
    fresh_mfa_backup_codes = NULL
WHERE user_id = 'a1b2c3d4-e5f6-7890-abcd-123456789012'; -- Old wrong mapping

-- Ensure clean state for correct UUID
UPDATE user_settings
SET fresh_mfa_secret = NULL,
    fresh_mfa_enabled = false,
    fresh_mfa_setup_completed = false,
    fresh_mfa_backup_codes = NULL
WHERE user_id = 'c550502f-c39d-4bb3-bb8c-d193657fdb24'; -- Correct current UUID
```

### Step 3: Update Translation Service
Fix the mapping in `userIdTranslationService.ts`:

```typescript
private static readonly DEMO_USER_MAPPINGS: { [key: string]: string } = {
  'pierre-user-789': 'c550502f-c39d-4bb3-bb8c-d193657fdb24',
  'super-user-456': 'ee77ed8f-525f-43c9-a70a-b81cb8dc8d5d',
  'guest-user-456': 'demo-user-uuid-placeholder',
  'dynamic-pierre-user': 'c550502f-c39d-4bb3-bb8c-d193657fdb24' // FIXED: Use actual current UUID
}
```

## Prevention Measures

### 1. **Consistent User ID Management**
- Always use the translation service for database operations
- Validate UUID mappings during user authentication
- Log user ID translations for debugging

### 2. **MFA Data Integrity**
- Add database constraints to ensure MFA data consistency
- Implement migration scripts for future user ID changes
- Regular validation of user mappings

### 3. **Improved Error Handling**
- Better error messages when TOTP verification fails
- Include user ID translation debugging info
- Graceful fallback for missing mappings

## Testing Checklist

After implementing fixes:

1. ✅ **User Authentication**: Verify user can login with correct UUID
2. ✅ **MFA Setup**: User can generate new MFA secret and QR code
3. ✅ **TOTP Verification**: Generated TOTP codes verify successfully
4. ✅ **Database Storage**: MFA data stored under correct UUID
5. ✅ **Cross-Session**: MFA works across browser sessions/devices
6. ✅ **User Isolation**: Different users have separate MFA data

## Immediate Action Required

1. **Update userIdTranslationService mappings** (highest priority)
2. **Clear corrupted MFA data** from database
3. **Force users to re-setup MFA** with corrected UUID mappings
4. **Test TOTP verification** end-to-end

This will resolve the "Invalid TOTP code" errors and restore proper MFA functionality.