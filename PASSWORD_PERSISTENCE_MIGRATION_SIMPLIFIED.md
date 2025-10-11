# Password Persistence Migration - Simplified Fix

## Date: 2025-10-11

## Problem Identified

The original migration script failed with this error:

```
ERROR: column "display_name" does not exist
DETAIL: There is a column named "display_name" in table "user_profiles",
        but it cannot be referenced from this part of the query.
```

**Root Cause**: The migration was trying to migrate data from `user_settings` table, but was looking for a `display_name` column that doesn't exist in that table.

## Current Database State

After investigation, we discovered:

### Existing Tables (Already Present)
- ✅ `user_credentials` - Already exists (empty, but table is created)
- ✅ `failed_login_attempts` - Already exists
- ✅ `user_settings` - Exists with these columns:
  - id, user_id, theme, notifications, security_preferences
  - communication_preferences, accessibility_settings, retell_config
  - tenant_id, created_at, updated_at, last_synced
  - fresh_mfa_secret, fresh_mfa_enabled, fresh_mfa_setup_completed, fresh_mfa_backup_codes

### Missing Table
- ❌ `user_profiles` - Does NOT exist (this is what we need to create)

## Simplified Solution

Instead of attempting complex data migration, we created a **simplified migration** that:

1. **ONLY creates the `user_profiles` table** (since the other tables already exist)
2. **Does NOT attempt data migration** (avoids column mismatch errors)
3. **Uses idempotent SQL** (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`)
4. **Focuses on the core requirement**: Storing encrypted Retell AI API keys

## New `user_profiles` Table Schema

```sql
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,              -- Matches users.id type (TEXT)
  encrypted_retell_api_key TEXT,             -- Encrypted API key storage
  retell_sms_agent_id TEXT,                  -- SMS agent ID
  retell_voice_agent_id TEXT,                -- Voice agent ID
  tenant_id TEXT NOT NULL DEFAULT 'medex',   -- Tenant isolation
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Key Features

### 1. Correct Data Types
- `user_id` is **TEXT** (not UUID) to match `users.id` column
- All credential fields use **TEXT** for flexibility

### 2. Security
- **Row Level Security (RLS)** enabled
- **Tenant isolation** enforced (`tenant_id = 'medex'`)
- **User-specific access policies**:
  - Users can view/update their own profile
  - Service role has full access for admin operations

### 3. Performance
- Indexed on `user_id` for fast lookups
- Indexed on `tenant_id` for tenant filtering

### 4. Automation
- `updated_at` trigger automatically updates timestamp on changes

## How to Execute

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard/project/onwgbfetzrctshdwwimm
2. Click "SQL Editor" in left sidebar

### Step 2: Execute Migration
1. Open the file: `EXECUTE_THIS_IN_SUPABASE_SQL_EDITOR.sql`
2. Copy the **ENTIRE contents** of the file
3. Paste into Supabase SQL Editor
4. Click "Run" button

### Step 3: Verify Success
The script includes verification queries that will show:
- Table structure (columns and data types)
- RLS status (should be enabled)
- All RLS policies (should show 4 policies)

You should see this success message at the end:
```
✅ Password Persistence Migration Complete!

📋 Created Tables:
   - user_profiles (with encrypted_retell_api_key column)

🔒 Security:
   - RLS enabled on user_profiles
   - Tenant isolation enforced
   - User-specific access policies created

✅ System is ready for password persistence testing
```

## What Changed from Original Migration

### Removed
- ❌ Data migration logic (caused the display_name error)
- ❌ Complex SELECT/INSERT from user_settings
- ❌ DROP TABLE CASCADE commands (risky)
- ❌ Recreation of existing tables (user_credentials, failed_login_attempts)

### Kept
- ✅ Core table structure (user_profiles)
- ✅ RLS policies for security
- ✅ Proper TEXT types for user_id
- ✅ Tenant isolation
- ✅ Verification queries

### Added
- ✅ Idempotent SQL (`IF NOT EXISTS`, `IF EXISTS`)
- ✅ Detailed documentation comments
- ✅ Clear success messages
- ✅ Simplified approach (no data migration)

## Expected Outcome

After running this migration:

1. **user_profiles table will exist** with proper schema
2. **Password persistence will work** (credentials stored in Supabase)
3. **No data loss** (existing tables untouched)
4. **RLS security enabled** (tenant isolation enforced)
5. **Ready for testing** (can create users and store passwords)

## Testing After Migration

To verify password persistence is working:

1. **Create a new user** via User Registration form
2. **Set a password** (e.g., "Test1234!")
3. **Logout and login** with the same credentials
4. **Check Supabase** - Should see:
   - New row in `user_credentials` (password hash)
   - New row in `user_profiles` (if API key saved)

## Files Modified

- `EXECUTE_THIS_IN_SUPABASE_SQL_EDITOR.sql` - Simplified migration script (overwritten)
- `PASSWORD_PERSISTENCE_MIGRATION_SIMPLIFIED.md` - This documentation (new)

## Next Steps

1. Execute the simplified migration in Supabase SQL Editor
2. Verify tables are created successfully
3. Test user registration with password persistence
4. Confirm login works with stored passwords

## Rollback Plan

If anything goes wrong:

```sql
-- Drop only the new table (safe rollback)
DROP TABLE IF EXISTS public.user_profiles CASCADE;
```

This will only remove the newly created table without affecting existing data.

---

**Status**: Ready for execution
**Risk Level**: Low (only creates one new table, no data modification)
**Estimated Time**: < 1 minute to execute
