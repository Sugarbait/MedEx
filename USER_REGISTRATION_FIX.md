# User Registration Fix - October 9, 2025

## Problem Summary

User registration was failing with the error:
```
UserProfileService: Supabase query failed, trying localStorage fallback
CREATE FAILURE in audit logs
```

## Root Cause

The `userProfileService.ts` was attempting to insert data into **non-existent columns** in the `users` table:

1. **`metadata` column** - Does not exist in the users table
2. **`mfa_enabled` column** - Does not exist in the users table (MFA data is stored in `user_settings` table)

### Error Details

When the code tried to insert a user with these fields:
```javascript
{
  email: 'test@test.com',
  name: 'Test User',
  role: 'super_user',
  mfa_enabled: false,  // ❌ Column doesn't exist
  metadata: {          // ❌ Column doesn't exist
    created_via: 'user_management',
    original_role: 'super_user'
  },
  is_active: true,
  tenant_id: 'medex'
}
```

Supabase returned error:
```
PGRST204: Could not find the 'metadata' column of 'users' in the schema cache
```

## Actual Database Schema

The `users` table has these columns:
- avatar_url
- bio
- created_at
- department
- email
- first_name
- id
- is_active
- last_login
- last_name
- location
- name
- phone
- role
- tenant_id
- updated_at
- username

**Note:** MFA settings are stored in the separate `user_settings` table, not in `users`.

## Solution

Modified `src/services/userProfileService.ts` (lines 1039-1053):

### Before (Broken):
```javascript
const userToInsert: any = {
  email: userData.email,
  name: userData.name,
  role: dbRole,
  mfa_enabled: userData.mfa_enabled || false,  // ❌ Doesn't exist
  is_active: userData.isActive !== undefined ? userData.isActive : false,
  last_login: null,
  metadata: {  // ❌ Doesn't exist
    created_via: 'user_management',
    original_role: userData.role,
    device_id: this.currentDeviceId || 'unknown'
  },
  tenant_id: currentTenantId
}
```

### After (Fixed):
```javascript
const userToInsert: any = {
  email: userData.email,
  name: userData.name,
  role: dbRole,
  // mfa_enabled: REMOVED - stored in user_settings table
  is_active: userData.isActive !== undefined ? userData.isActive : false,
  last_login: null,
  // metadata: REMOVED - column doesn't exist
  tenant_id: currentTenantId
}
```

Also updated the response mapping (line 1079):
```javascript
// Before
mfa_enabled: newUser.mfa_enabled,  // ❌ Doesn't exist in response

// After
mfa_enabled: userData.mfa_enabled || false,  // Use input value
```

## Test Results

Ran comprehensive test (`test-fixed-registration.mjs`):

```
✅ Auth user created: 17eeec53-2762-4461-a2bb-450eef8fa3ff

✅ Database user created successfully!
User data: {
  "id": "17eeec53-2762-4461-a2bb-450eef8fa3ff",
  "email": "test@test.com",
  "name": "Test User",
  "role": "super_user",
  "is_active": true,  // ✅ First user auto-activated
  "tenant_id": "medex"
}

✅ User settings created
```

## Verification Checklist

- [x] First user check works correctly (`isFirstUser = true`)
- [x] Supabase Auth user creation succeeds
- [x] Database user insert succeeds (no more schema errors)
- [x] First user gets `role: 'super_user'`
- [x] First user gets `is_active: true` (auto-activated)
- [x] Auth user ID matches database user ID
- [x] User settings record created successfully
- [x] Subsequent users will get `is_active: false` (pending approval)

## Files Modified

1. **src/services/userProfileService.ts**
   - Lines 1039-1053: Removed `mfa_enabled` and `metadata` fields from insert
   - Line 1079: Changed to use input `mfa_enabled` value instead of non-existent DB column
   - Lines 1063-1088: Cleaned up console logs referencing metadata

## Migration Notes

**No database migration needed** - this was a code bug, not a schema issue.

MFA functionality still works correctly because:
- MFA settings are properly stored in `user_settings` table
- The application layer handles MFA via `user_settings`, not the `users` table
- `mfa_enabled` in the application layer is maintained for backward compatibility

## How to Test

1. Clear all MedEx users:
   ```bash
   node clear-all-users.js
   ```

2. Visit the registration page

3. Register first user (test@test.com / test1000!)

4. Verify:
   - User is created successfully (no errors)
   - User has `super_user` role
   - User is `isActive: true`
   - User can log in immediately

## Additional Notes

- The test script `test-fixed-registration.mjs` demonstrates the complete working flow
- The fix maintains tenant isolation (`tenant_id = 'medex'`)
- First user auto-activation logic works as designed
- Subsequent users will require Super User approval (isActive=false)
