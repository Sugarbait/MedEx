# Quick Fix Instructions: User Profiles Table

## Problem
Password storage failing with 404 errors because `user_profiles` table is missing from Supabase database.

## Solution (5 Minutes)

### Step 1: Execute Migration SQL (2 minutes)

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/onwgbfetzrctshdwwimm)
2. Click **"SQL Editor"** in left sidebar
3. Click **"New query"**
4. Open `EXECUTE_THIS_IN_SUPABASE_SQL_EDITOR.sql` from this directory
5. Copy **entire file** contents
6. Paste into Supabase SQL Editor
7. Click **"Run"** button
8. Wait for "Success. No rows returned" message

### Step 2: Verify Migration (2 minutes)

Run this in terminal:
```bash
node test-user-profiles-table.js
```

**Expected Output:**
```
✅ ALL TESTS PASSED - Password storage is ready!
```

### Step 3: Test in Application (1 minute)

1. Open MedEx application in browser
2. Go to User Management page
3. Create a new user
4. Set a password
5. Check browser console - should see **NO 404 errors**
6. Try logging in with new user - should work immediately

## Files Reference

- **`EXECUTE_THIS_IN_SUPABASE_SQL_EDITOR.sql`** - Migration SQL to execute
- **`test-user-profiles-table.js`** - Automated test script
- **`USER_PROFILES_TABLE_FIX_REPORT.md`** - Complete documentation

## Troubleshooting

**If tests fail:**
1. Re-execute migration SQL in Supabase SQL Editor
2. Check for error messages in SQL Editor output
3. Review `USER_PROFILES_TABLE_FIX_REPORT.md` for detailed troubleshooting

**If 404 errors persist:**
1. Clear browser cache and reload page
2. Check browser console for actual error message
3. Verify Supabase credentials in `src/config/environmentLoader.ts`

## What Gets Created

The migration creates 4 tables:
- ✅ `user_profiles` - Stores encrypted credentials
- ✅ `user_credentials` - Stores password hashes
- ✅ `user_settings` - Stores user preferences
- ✅ `failed_login_attempts` - Security logging

All tables include:
- Row Level Security (RLS) policies
- Tenant isolation via `tenant_id = 'medex'`
- Automatic `updated_at` timestamps
- Proper indexes for performance

## Success Confirmation

✅ No 404 errors in browser console when creating users
✅ Password storage completes without errors
✅ New users can log in immediately
✅ `test-user-profiles-table.js` shows all tests passed

---

**Time to complete:** ~5 minutes
**Difficulty:** Easy (just copy/paste SQL)
**Risk:** Low (migration uses `IF NOT EXISTS` - won't break existing data)
