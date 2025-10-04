# Testing Pending Users Display

## Changes Made

1. **Added `isActive` field to `UserProfileData` interface** (userProfileService.ts, line 26)
   - Added `isActive?: boolean` field
   - Added 'user' to the allowed role types

2. **Updated `createUser` function** (userProfileService.ts, line 1016)
   - Changed from hardcoded `is_active: true` to `is_active: userData.isActive !== undefined ? userData.isActive : true`
   - Now respects the `isActive` field passed from UserRegistration component

3. **Updated user mapping in `createUser`** (userProfileService.ts, line 1042)
   - Added `isActive: newUser.is_active` to map the database field to the application field

4. **Updated user mapping in `loadSystemUsers`** (userProfileService.ts, line 721)
   - Already had `isActive: user.is_active !== undefined ? user.is_active : true`
   - This was correct and is now working properly

5. **Added comprehensive console logging**
   - `userProfileService.ts` line 1026: Logs when creating users
   - `userProfileService.ts` line 1049: Logs successful user creation
   - `userProfileService.ts` line 729: Logs when loading users from database
   - `userProfileService.ts` lines 748-751: Logs filtered users list
   - `SimpleUserManager.tsx` lines 55-81: Logs user loading process
   - `SimpleUserManager.tsx` lines 225-227: Logs pending/active user counts

## Test Data Created

A test pending user was created with:
- Email: `pending.user@test.com`
- Name: Test Pending User
- Role: user
- is_active: **false** (pending approval)

## How to Test

1. Start the dev server: `npm run dev`
2. Login to the application
3. Navigate to **Settings > User Management**
4. Open browser console (F12)
5. Look for debug logs showing:
   - User loading from database
   - isActive field values
   - Pending/active user counts
6. The "Pending Approvals" section (amber background) should appear at the top
7. The test user `pending.user@test.com` should be listed there

## Expected Console Output

```
🔍 DEBUG: Loading users from userManagementService...
UserProfileService: Loading system users with cross-device sync support
🔍 DEBUG loadSystemUsers: User admin@phaetonai.com - is_active (DB): true, isActive (mapped): true
🔍 DEBUG loadSystemUsers: User pending.user@test.com - is_active (DB): false, isActive (mapped): false
📊 DEBUG: After filtering, 2 users remain
   - admin@phaetonai.com: isActive=true, role=admin
   - pending.user@test.com: isActive=false, role=user
📊 DEBUG: userManagementService response: {status: 'success', data: Array(2)}
✅ DEBUG: Loaded 2 users from service
👤 DEBUG: User admin@phaetonai.com - isActive: true (original: true)
👤 DEBUG: User pending.user@test.com - isActive: false (original: false)
✅ DEBUG: Set users state with 2 users
📊 DEBUG: Total users: 2
📊 DEBUG: Pending users: 1 ['pending.user@test.com']
📊 DEBUG: Active users: 1 ['admin@phaetonai.com']
```

## Cleanup

To delete the test user:
```bash
node debug-pending-users.js
```

Or manually in Supabase dashboard:
```sql
DELETE FROM users WHERE email = 'pending.user@test.com' AND tenant_id = 'medex';
```

## Files Modified

- `src/services/userProfileService.ts`
- `src/components/settings/SimpleUserManager.tsx`
- `src/components/auth/UserRegistration.tsx` (already correct)

## Root Cause

The issue was in `userProfileService.ts` line 1015 (now 1016):
- **Before**: `is_active: true` (hardcoded)
- **After**: `is_active: userData.isActive !== undefined ? userData.isActive : true`

The `createUser` function was ignoring the `isActive` field from `userData` and always setting new users to active.
