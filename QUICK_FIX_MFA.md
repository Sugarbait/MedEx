# 🚀 Quick Fix: MFA Schema Error

## Error
```
Could not find the 'fresh_mfa_backup_codes' column of 'user_settings' in the schema cache
```

## Fastest Fix (2 minutes)

### Method 1: Supabase Dashboard (Recommended) ⭐

1. **Go to:** https://app.supabase.com
2. **Click:** SQL Editor → New query
3. **Copy this SQL:**

```sql
-- Add Fresh MFA columns to user_settings table
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS fresh_mfa_secret TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS fresh_mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS fresh_mfa_setup_completed BOOLEAN DEFAULT false;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS fresh_mfa_backup_codes TEXT;
```

4. **Click:** Run (or press Ctrl+Enter)
5. **Done!** ✅

### Method 2: HTML Tool (Easiest for non-developers)

1. **Open:** `run-mfa-migration.html` in your browser
2. **Enter:**
   - Supabase URL: `https://your-project.supabase.co`
   - Service Role Key: `eyJhbGci...` (from Supabase Dashboard → Settings → API)
3. **Click:** Run Migration
4. **Done!** ✅

### Method 3: Command Line

```bash
node run-mfa-migration.js
```

## Verify It Worked

Run this SQL in Supabase Dashboard:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_settings' AND column_name LIKE 'fresh_mfa%';
```

Should return 4 rows:
- fresh_mfa_backup_codes
- fresh_mfa_enabled
- fresh_mfa_secret
- fresh_mfa_setup_completed

## Test MFA

1. Go to Settings → Security
2. Click "Enable MFA"
3. Should work without errors now ✅

## Need Help?

See full documentation in: `MFA_MIGRATION_GUIDE.md`

---

**Files Created:**
- ✅ Migration SQL: `supabase/migrations/20241225000001_add_fresh_mfa_columns.sql`
- ✅ HTML Tool: `run-mfa-migration.html`
- ✅ Node Script: `run-mfa-migration.js`
- ✅ Full Guide: `MFA_MIGRATION_GUIDE.md`
- ✅ Summary: `MFA_SCHEMA_FIX_SUMMARY.md`
