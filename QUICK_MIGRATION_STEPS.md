# Quick Migration Steps - MedEx Schema Setup

## Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar

## Step 2: Run the Migration

1. Click **New query** button
2. Copy the ENTIRE contents of this file:
   ```
   supabase/migrations/20251003000001_create_medex_schema.sql
   ```
3. Paste into the SQL Editor
4. Click **Run** (or press Ctrl+Enter)

## Step 3: Verify Success

You should see output like:
```
Success. No rows returned.
```

Run this verification query:
```sql
-- Check medex schema exists
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'medex';

-- Count users in both schemas
SELECT 'public (CareXPS)' as schema, COUNT(*) as user_count FROM public.users
UNION ALL
SELECT 'medex (MedEx)', COUNT(*) FROM medex.users;
```

**Expected Result:**
- `medex` schema exists
- `public` has 4 users (CareXPS)
- `medex` has 0 users (MedEx - clean slate)

## Step 4: Reload MedEx App

1. Go back to your MedEx app
2. Hard refresh (Ctrl+Shift+R)
3. Navigate to User Management
4. You should see **0 users** (empty list)

## Troubleshooting

### Error: "schema medex already exists"
**Solution:** Schema already created - skip to verification step

### Still seeing CareXPS users in MedEx
**Possible causes:**
1. Migration not run yet - Complete steps 1-2 above
2. Browser cache - Hard refresh (Ctrl+Shift+R) and clear localStorage
3. Wrong app - Make sure you're in MedEx (not CareXPS)

### How to clear browser cache
Open browser console (F12) and run:
```javascript
localStorage.clear()
sessionStorage.clear()
location.reload()
```

---

**Total Time:** 2-3 minutes
**Difficulty:** Easy - just copy/paste SQL
