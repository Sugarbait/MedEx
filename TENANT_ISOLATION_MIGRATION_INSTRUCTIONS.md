# Tenant Isolation Migration Instructions

## 🎯 Purpose
This migration enforces complete database-level isolation between MedEx and CareXPS tenants using Row Level Security (RLS) policies.

## ⚠️ Critical: Manual Migration Required

The RLS policies migration **MUST be run manually** in the Supabase SQL Editor because it requires superuser privileges.

## 📋 Step-by-Step Instructions

### Step 1: Access Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project: `cpkslvmydfdevdftieck`
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Migration
1. Open the file: `supabase/migrations/20251008000001_add_tenant_rls_policies.sql`
2. Copy the ENTIRE contents of the file
3. Paste into the Supabase SQL Editor
4. Click **Run** button
5. Verify no errors appear

### Step 3: Verify the Migration

Run this verification query in the SQL Editor:

```sql
-- Check that RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'user_settings', 'audit_logs', 'notes');

-- Expected output: All tables should show rowsecurity = true

-- Check existing policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('users', 'user_settings', 'audit_logs', 'notes')
ORDER BY tablename, policyname;

-- Expected: Should see policies with "tenant_" prefix
```

### Step 4: Test Tenant Isolation

Run the verification script:

```bash
node verify-tenant-isolation.js
```

This will:
- ✅ Check that all tables have tenant_id column
- ✅ Verify RLS policies are active
- ✅ Confirm existing data marked as 'carexps'
- ✅ Test that MedEx users will be isolated

## 🔒 What This Migration Does

### Database-Level Protections:
1. **Users Table**
   - Super users can ONLY see users in their own tenant
   - Users CANNOT change their own tenant_id
   - New users MUST have same tenant_id as creator

2. **User Settings Table**
   - Settings isolated by tenant_id
   - Cross-tenant access blocked at database level

3. **Audit Logs Table**
   - Audit logs separated by tenant
   - MedEx logs never visible to CareXPS users

4. **Notes Table**
   - Notes isolated by tenant
   - Cross-device sync respects tenant boundaries

### Security Model:
```
┌─────────────────────────────────────────┐
│         Shared Supabase Database        │
├─────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐   │
│  │   CareXPS   │    │    MedEx    │   │
│  │ tenant_id=  │    │ tenant_id=  │   │
│  │  'carexps'  │    │   'medex'   │   │
│  └─────────────┘    └─────────────┘   │
│         ↑                  ↑           │
│         │                  │           │
│    RLS BLOCKS       RLS BLOCKS         │
│   cross-tenant     cross-tenant        │
│      access           access           │
└─────────────────────────────────────────┘
```

## ✅ Post-Migration Checklist

- [ ] Migration executed in Supabase SQL Editor without errors
- [ ] RLS enabled on all tables (users, user_settings, audit_logs, notes)
- [ ] Tenant-prefixed policies visible in pg_policies
- [ ] Verification script passes all checks
- [ ] Test user creation with tenant_id='medex'
- [ ] Confirm CareXPS cannot see MedEx users

## 🚨 Rollback (Emergency Only)

If you need to rollback this migration:

```sql
-- Re-enable the old policies (without tenant filtering)
-- WARNING: This removes tenant isolation!

-- Drop tenant-aware policies
DROP POLICY IF EXISTS "tenant_super_users_can_see_all_users" ON users;
DROP POLICY IF EXISTS "tenant_super_users_can_insert_users" ON users;
-- ... (drop all tenant_ policies)

-- Re-create old policies (refer to user_management_rls_policies.sql)
```

## 📞 Support

If migration fails:
1. Check Supabase logs for specific errors
2. Verify you're using the service role key
3. Ensure no active connections to affected tables
4. Contact support with error messages

## 🔐 Security Notice

**This migration is CRITICAL for HIPAA compliance and data privacy.**

- Do NOT skip this migration
- Do NOT disable RLS policies
- Do NOT remove tenant_id filtering
- Always use service role key for migrations

---

**Migration Status**: Ready to execute
**Estimated Time**: < 2 minutes
**Impact**: Zero downtime (existing data unaffected)
