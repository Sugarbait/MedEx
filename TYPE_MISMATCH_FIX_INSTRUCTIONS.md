# TYPE MISMATCH FIX - CORRECTED MIGRATION

## Problem Identified

The original migration failed with this error:
```
foreign key constraint "fk_user" cannot be implemented
Key columns "user_id" and "id" are of incompatible types: uuid and text.
```

## Root Cause

The `users` table has `id` column defined as **TEXT** type (storing UUID strings), not PostgreSQL's native UUID type. Our migration incorrectly used `UUID` for the `user_id` foreign keys.

## Schema Verification

Confirmed actual schema:
```
users.id column type: TEXT (stores UUID strings like 'aeabc626-f253-4327-b8a5-a76fa23db3dd')
user_settings.user_id: TEXT
audit_logs.user_id: TEXT
```

## Solution

Updated migration script with **TEXT** type for all `user_id` columns:

### Changed From (INCORRECT):
```sql
CREATE TABLE user_profiles (
  user_id UUID NOT NULL UNIQUE,  -- ❌ WRONG TYPE
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Changed To (CORRECT):
```sql
CREATE TABLE user_profiles (
  user_id TEXT NOT NULL UNIQUE,  -- ✅ MATCHES users.id
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Tables Fixed

1. **user_profiles**: `user_id UUID` → `user_id TEXT`
2. **user_credentials**: `user_id UUID` → `user_id TEXT`
3. **failed_login_attempts**: No FK, no changes needed

## Next Steps

### Execute the Corrected Migration

1. **Open Supabase SQL Editor**:
   - Go to: https://supabase.com/dashboard/project/onwgbfetzrctshdwwimm
   - Click "SQL Editor" in left sidebar
   - Click "New query"

2. **Copy the Corrected SQL**:
   - Open file: `EXECUTE_THIS_IN_SUPABASE_SQL_EDITOR.sql`
   - Copy the ENTIRE contents (all 228 lines)

3. **Execute in Supabase**:
   - Paste into SQL Editor
   - Click "Run" button
   - Wait for completion

4. **Expected Results**:
   ```
   ✓ All 3 tables dropped (if they existed)
   ✓ user_profiles created with TEXT user_id
   ✓ user_credentials created with TEXT user_id
   ✓ failed_login_attempts created
   ✓ All indexes created
   ✓ RLS policies enabled
   ✓ Foreign keys working (TEXT → TEXT)
   ```

5. **Verify Success**:
   - Check verification queries at end of script
   - Should see:
     - 3 tables created
     - Foreign keys listed showing user_id → users.id
     - Success messages in NOTICE output

## What This Fixes

Once this migration runs successfully:

✅ **Password persistence** - Passwords will save to `user_credentials` table
✅ **User profiles** - Extended user data in `user_profiles` table
✅ **Login tracking** - Failed attempts logged in `failed_login_attempts`
✅ **Type compatibility** - All foreign keys use matching TEXT type
✅ **Tenant isolation** - All tables include `tenant_id = 'medex'`

## If Migration Fails Again

If you encounter any errors:

1. **Copy the exact error message**
2. **Check which step failed** (error will reference table/constraint name)
3. **Report back** with:
   - Full error message
   - Step number that failed
   - Any NOTICE messages shown

## After Successful Migration

Once migration completes:

1. **Test user registration**:
   - Create new user via User Management
   - Set password during registration
   - Verify user can login with that password

2. **Test password persistence**:
   - Logout
   - Login again with same credentials
   - Should work across browser sessions

3. **Check database**:
   ```sql
   -- Should show 1 credential record per user
   SELECT COUNT(*) FROM user_credentials;

   -- Verify foreign keys work
   SELECT up.user_id, u.email
   FROM user_profiles up
   JOIN users u ON u.id = up.user_id;
   ```

## Technical Details

### Why TEXT Instead of UUID?

PostgreSQL has two ways to store UUIDs:
1. **Native UUID type**: Efficient binary storage, requires UUID functions
2. **TEXT type**: Stores as string, more flexible, JSON-compatible

MedEx uses **TEXT** for `users.id` because:
- Compatible with Supabase Auth (which returns UUID strings)
- Works with localStorage and JSON serialization
- Existing tables already use TEXT
- No performance impact for small user tables

### Foreign Key Compatibility

PostgreSQL requires exact type matching for foreign keys:
- `TEXT → TEXT` ✅ Works
- `UUID → UUID` ✅ Works
- `UUID → TEXT` ❌ Type mismatch error
- `TEXT → UUID` ❌ Type mismatch error

Our migration now correctly uses `TEXT → TEXT`.

---

**Execute `EXECUTE_THIS_IN_SUPABASE_SQL_EDITOR.sql` now to fix the type mismatch and enable password persistence.**
