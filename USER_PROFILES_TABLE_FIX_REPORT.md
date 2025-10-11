# User Profiles Table Fix Report

## Problem Summary

The `user_profiles` table in the Supabase database is **missing** or **incomplete**, causing password storage operations to fail with 404 errors.

**Evidence from console logs:**
```
POST https://onwgbfetzrctshdwwimm.supabase.co/rest/v1/user_profiles 404 (Not Found)
GET https://onwgbfetzrctshdwwimm.supabase.co/rest/v1/user_profiles?select=encrypted_retell_api_key... 404 (Not Found)
```

**Impact:**
- User passwords cannot be stored in Supabase
- Credential persistence fails silently
- Users created via User Management cannot log in if relying on Supabase-stored passwords

---

## Root Cause Analysis

The `user_profiles` table requires the following critical columns for password storage:

1. **`encrypted_retell_api_key` (TEXT)** - Stores encrypted credentials/passwords
2. **`tenant_id` (TEXT, default 'medex')** - For tenant isolation
3. **`user_id` (UUID, unique)** - Links to users table

**Current State:**
- Migration file `20251007000001_create_missing_tables.sql` exists in the codebase with correct schema
- Migration may not have been applied to the Supabase database
- PostgREST API lacks `exec_sql` function for programmatic migration execution

---

## Solution

### Option 1: Manual SQL Execution (RECOMMENDED)

**File Created:** `EXECUTE_THIS_IN_SUPABASE_SQL_EDITOR.sql`

**Steps:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/onwgbfetzrctshdwwimm)
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"**
4. Copy and paste the entire contents of `EXECUTE_THIS_IN_SUPABASE_SQL_EDITOR.sql`
5. Click **"Run"** button
6. Verify success (should see "Success. No rows returned")

**What the SQL Does:**
- Creates `user_profiles` table with all required columns
- Creates `user_credentials` table for password storage
- Creates `user_settings` table for user preferences
- Creates `failed_login_attempts` table for security logging
- Adds indexes for performance
- Enables Row Level Security (RLS) with tenant isolation
- Creates RLS policies allowing anonymous access for authentication
- Creates triggers for automatic `updated_at` timestamps
- Grants necessary permissions to `anon` and `authenticated` roles

---

## Table Schema Details

### user_profiles Table

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  encrypted_retell_api_key TEXT,           -- For password storage
  encrypted_sms_agent_id TEXT,             -- For SMS agent credentials
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tenant_id TEXT DEFAULT 'medex',          -- Tenant isolation
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Key Features:**
- Supports upsert operations with `onConflict: 'user_id'`
- Automatically managed `updated_at` via trigger
- Tenant isolation via `tenant_id` column and RLS policies
- Encrypted credential storage for security

---

## RLS (Row Level Security) Configuration

### Authentication-Compatible Policies

The migration includes **permissive RLS policies** that allow anonymous access for authentication:

```sql
CREATE POLICY "Anyone can view credentials for auth"
  ON user_credentials FOR SELECT
  USING (tenant_id = 'medex');

CREATE POLICY "Anyone can update credentials"
  ON user_credentials FOR UPDATE
  USING (tenant_id = 'medex');
```

**Why Permissive Policies?**
- MedEx uses custom authentication (not Supabase Auth)
- Users authenticate before establishing a Supabase session
- RLS acts as secondary protection layer
- Primary protection is application-level tenant filtering (`.eq('tenant_id', 'medex')`)

---

## Verification Steps

After executing the SQL in Supabase SQL Editor, run these queries to verify:

### 1. Check Tables Exist
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_profiles', 'user_credentials', 'user_settings', 'failed_login_attempts')
ORDER BY table_name;
```

**Expected Result:** 4 rows returned

### 2. Check Critical Columns
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name IN ('encrypted_retell_api_key', 'tenant_id', 'user_id')
ORDER BY column_name;
```

**Expected Result:** 3 rows returned

### 3. Check RLS Policies
```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('user_profiles', 'user_credentials', 'user_settings', 'failed_login_attempts')
ORDER BY tablename, policyname;
```

**Expected Result:** Multiple policies listed for each table

### 4. Test Upsert Operation
```sql
-- Test insert
INSERT INTO user_profiles (user_id, encrypted_retell_api_key, tenant_id)
VALUES ('00000000-0000-0000-0000-000000000001'::UUID, 'test_encrypted_key', 'medex')
ON CONFLICT (user_id) DO UPDATE
SET encrypted_retell_api_key = EXCLUDED.encrypted_retell_api_key;

-- Verify insert
SELECT * FROM user_profiles WHERE user_id = '00000000-0000-0000-0000-000000000001'::UUID;

-- Cleanup
DELETE FROM user_profiles WHERE user_id = '00000000-0000-0000-0000-000000000001'::UUID;
```

**Expected Result:** Insert succeeds, row is visible, delete succeeds

---

## Code Integration Points

### Where user_profiles is Used

**File:** `src/services/userManagementService.ts` (Lines 927-977)

```typescript
// Store encrypted credentials in user_profiles table
await supabase.from('user_profiles').upsert({
  user_id: userId,
  encrypted_retell_api_key: encryptedCredentials
}, {
  onConflict: 'user_id'
})
```

**Requirements:**
- Table MUST support upsert with `onConflict: 'user_id'`
- Must be compatible with tenant isolation (all queries filter by `tenant_id = 'medex'`)
- Must preserve existing data if table exists

---

## Success Criteria

✅ **Migration Successfully Applied If:**

1. All 4 tables created (`user_profiles`, `user_credentials`, `user_settings`, `failed_login_attempts`)
2. `user_profiles` has `encrypted_retell_api_key` column (TEXT type)
3. `user_profiles` has `tenant_id` column (TEXT type, default 'medex')
4. `user_profiles` has `user_id` column (UUID type, UNIQUE constraint)
5. RLS enabled on all tables
6. Upsert operations work without errors
7. Console 404 errors disappear when saving passwords

---

## Testing Password Storage After Fix

### Test in Application

1. **Create a new user** via User Management page
2. **Set a password** for the user
3. **Check browser console** - should see NO 404 errors for user_profiles
4. **Verify in Supabase:**
   ```sql
   SELECT user_id, encrypted_retell_api_key, tenant_id
   FROM user_profiles
   WHERE tenant_id = 'medex'
   ORDER BY created_at DESC;
   ```
5. **Confirm:** New row exists with encrypted_retell_api_key populated

### Test Login After Password Storage

1. **Log out** of current session
2. **Attempt login** with newly created user credentials
3. **Expected:** Login succeeds immediately
4. **Verify:** User redirected to dashboard/MFA setup

---

## Troubleshooting

### Issue: "relation user_profiles does not exist"
**Solution:** Migration not applied. Execute `EXECUTE_THIS_IN_SUPABASE_SQL_EDITOR.sql` in Supabase SQL Editor.

### Issue: "column encrypted_retell_api_key does not exist"
**Solution:** Old version of table exists. Drop and recreate:
```sql
DROP TABLE IF EXISTS user_profiles CASCADE;
-- Then re-run the migration SQL
```

### Issue: "permission denied for table user_profiles"
**Solution:** Grants not applied. Run:
```sql
GRANT ALL ON user_profiles TO anon, authenticated;
```

### Issue: "new row violates row-level security policy"
**Solution:** RLS policies too restrictive. Verify permissive policies are applied:
```sql
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';
```

---

## Rollback Plan

If migration causes issues:

```sql
-- Rollback (drops all tables created by migration)
DROP TABLE IF EXISTS user_credentials CASCADE;
DROP TABLE IF EXISTS failed_login_attempts CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
```

**Warning:** This will delete all data in these tables. Export data first if needed.

---

## Files Created for This Fix

1. **`EXECUTE_THIS_IN_SUPABASE_SQL_EDITOR.sql`** - Complete migration SQL for manual execution
2. **`USER_PROFILES_TABLE_FIX_REPORT.md`** - This report with comprehensive documentation
3. **`verify-and-fix-user-profiles.js`** - Automated verification script (requires manual SQL execution first)

---

## Next Steps

1. ✅ **Execute SQL migration** in Supabase SQL Editor (using `EXECUTE_THIS_IN_SUPABASE_SQL_EDITOR.sql`)
2. ✅ **Verify tables created** using verification queries
3. ✅ **Test upsert operation** using test SQL
4. ✅ **Test password storage** in application
5. ✅ **Confirm 404 errors gone** in browser console
6. ✅ **Test user login** with newly stored password

---

## Summary

**Problem:** `user_profiles` table missing or incomplete, causing 404 errors for password storage.

**Solution:** Execute `EXECUTE_THIS_IN_SUPABASE_SQL_EDITOR.sql` in Supabase SQL Editor to create all required tables with proper schema.

**Expected Outcome:** Password storage works correctly, no more 404 errors, users can log in with Supabase-stored credentials.

**Time Estimate:** 5 minutes to execute migration + 5 minutes to verify + 5 minutes to test = **15 minutes total**

---

*Report generated: 2025-10-11*
*Database: onwgbfetzrctshdwwimm.supabase.co*
*Tenant: medex*
