# 🚨 CRITICAL DATABASE FIX - Failed Login Attempts Table

## Problem Identified

**Error:** `PGRST204: Could not find the 'attempted_at' column of 'failed_login_attempts' in the schema cache`

**Root Cause:** PostgREST schema cache is outdated. The `failed_login_attempts` table exists but PostgREST doesn't know about its columns.

## Solution Steps

### Step 1: Reload PostgREST Schema Cache

**Option A: Via Supabase Dashboard (RECOMMENDED)**
1. Go to https://supabase.com/dashboard/project/onwgbfetzrctshdwwimm
2. Navigate to **Settings** → **API**
3. Click **Reload schema** button

**Option B: Via SQL (if dashboard doesn't work)**
Run this in Supabase SQL Editor:
```sql
NOTIFY pgrst, 'reload schema';
```

**Option C: Via HTTP API**
```bash
curl -X POST "https://onwgbfetzrctshdwwimm.supabase.co/rest/v1/rpc/pgrst_reload_schema" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Step 2: Ensure Table Schema is Correct

Run this SQL in Supabase SQL Editor: `fix-failed-login-table.sql`

This will:
- Create the table if it doesn't exist
- Add any missing columns
- Create proper indexes
- Set up RLS policies

### Step 3: Verify Fix

Run the test script:
```bash
node test-insert-direct.mjs
```

You should see:
```
✅ SERVICE ROLE INSERT SUCCESS
```

## Database Analysis

### Current Issues Found:

1. **failed_login_attempts table**: Schema cache outdated (PGRST204 error)
2. **users table**: No users found with `tenant_id='medex'` - this explains authentication failures

### Required Columns for failed_login_attempts:

The application expects these columns (from `userManagementService.ts` lines 391-396):
```javascript
{
  email: 'text',
  ip_address: 'text',
  user_agent: 'text',
  reason: 'text',
  attempted_at: 'timestamptz'
}
```

## User Table Issue

**Problem:** No users exist with `tenant_id='medex'`

**Impact:** Authentication fails because:
1. User lookup by email fails (line 209 in `userManagementService.ts`)
2. Application falls back to localStorage

**Solution:** Create a test user with proper tenant_id:

```sql
-- Check existing users
SELECT id, email, role, tenant_id FROM public.users LIMIT 10;

-- If users exist but have wrong tenant_id, update them:
UPDATE public.users
SET tenant_id = 'medex'
WHERE email = 'your-email@example.com';

-- OR create a new test user:
INSERT INTO public.users (id, email, name, role, tenant_id, is_active)
VALUES (
  gen_random_uuid(),
  'test@medex.com',
  'Test User',
  'super_user',
  'medex',
  true
);
```

## Immediate Action Required

**To fix authentication NOW:**

1. **Reload schema cache** (Option A above - fastest)
2. **Check/fix user tenant_id** (run SQL query above)
3. **Test login**

## Files Created for This Fix

- `fix-failed-login-table.sql` - Complete table setup SQL
- `test-insert-direct.mjs` - Diagnostic test script
- `diagnose-and-fix-schema.mjs` - Full diagnostic tool
- `CRITICAL_FIX_README.md` - This file

## Expected Results After Fix

✅ `failed_login_attempts` table accepts inserts
✅ Users table returns users for `tenant_id='medex'`
✅ Authentication works via Supabase (not just localStorage)
✅ Login attempts are properly tracked

## Technical Details

**PostgREST Error PGRST204:**
- PostgREST caches the database schema for performance
- When schema changes (ALTER TABLE, CREATE TABLE), cache becomes stale
- Cache must be manually reloaded via NOTIFY or API

**Tenant Isolation:**
- MedEx uses `tenant_id='medex'`
- All queries filter by `.eq('tenant_id', 'medex')`
- Users without proper tenant_id are invisible to the app

## Contact

If issues persist after following these steps:
1. Check Supabase logs for detailed error messages
2. Verify RLS policies are not blocking inserts
3. Confirm service role key has proper permissions
