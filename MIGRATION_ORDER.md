# Database Migration Order for Tenant Isolation

## ⚠️ CRITICAL: Run These Migrations in Order

The tenant isolation requires TWO migrations to be run in the Supabase SQL Editor:

### Migration 1: Add tenant_id Columns (FIRST)
**File**: `fix-missing-tenant-columns.sql`

**Purpose**: Adds tenant_id column to user_settings and audit_logs tables

**Steps**:
1. Go to Supabase SQL Editor
2. Copy contents of `fix-missing-tenant-columns.sql`
3. Paste and click **Run**
4. Verify output shows all 4 tables with tenant_id column

**Expected Duration**: < 30 seconds

**Expected Output**:
```
Table Name      | Column Name | Data Type | Is Nullable
----------------|-------------|-----------|-------------
audit_logs      | tenant_id   | text      | NO
notes           | tenant_id   | text      | NO
user_settings   | tenant_id   | text      | NO
users           | tenant_id   | text      | NO
```

---

### Migration 2: Add RLS Policies (SECOND)
**File**: `supabase/migrations/20251008000001_add_tenant_rls_policies.sql`

**Purpose**: Adds Row Level Security policies to enforce tenant isolation

**Steps**:
1. Verify Migration 1 completed successfully
2. Go to Supabase SQL Editor
3. Copy contents of `20251008000001_add_tenant_rls_policies.sql`
4. Paste and click **Run**
5. Verify no errors

**Expected Duration**: < 1 minute

**Expected Output**: No errors, policies created successfully

---

## Verification After Both Migrations

Run this script to verify:

```bash
node verify-tenant-isolation.js
```

**Expected Results**:
- ✅ All 4 tables have tenant_id column
- ✅ All existing data has tenant_id = 'carexps'
- ✅ Application configured for tenant_id = 'medex'
- ✅ RLS enabled on all tables

---

## Why Two Migrations?

1. **Migration 1** (fix-missing-tenant-columns.sql):
   - Original tenant_isolation migration didn't fully apply
   - user_settings and audit_logs tables missing tenant_id

2. **Migration 2** (add_tenant_rls_policies.sql):
   - Depends on ALL tables having tenant_id column
   - Will FAIL if Migration 1 not run first

---

## Post-Migration Checklist

- [ ] Migration 1 executed successfully
- [ ] Verification shows 4 tables with tenant_id
- [ ] Migration 2 executed successfully
- [ ] verify-tenant-isolation.js passes all checks
- [ ] Application-level filtering added to queries
- [ ] Test user creation with tenant_id='medex'

---

## Troubleshooting

### Error: "column tenant_id does not exist"
- You skipped Migration 1
- Run `fix-missing-tenant-columns.sql` first

### Error: "policy already exists"
- Migration 2 was partially run
- Check existing policies with: `SELECT * FROM pg_policies WHERE schemaname = 'public';`
- Drop conflicting policies or start fresh

### Error: "cannot access Supabase"
- Check .env.local has correct VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY
- Verify you're using service role key, not anon key

---

**Ready to begin?** Start with Migration 1!
