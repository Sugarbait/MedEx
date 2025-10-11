# PostgREST Schema Cache Fix

## Problem
The MedEx database tables were successfully created in PostgreSQL, but PostgREST is returning PGRST205 errors saying it cannot find the tables in its schema cache.

**Error:** `Could not find the table 'public.audit_logs' in the schema cache`

## Root Cause
When tables are created directly via SQL (outside of Supabase migrations), PostgREST doesn't automatically detect them because it caches the database schema. The schema cache needs to be manually reloaded.

## Solution Steps

### **IMMEDIATE FIX (Required):**

1. **Go to Supabase Dashboard:**
   - URL: https://supabase.com/dashboard
   - Login with your credentials

2. **Select Your Project:**
   - Project ID: `onwgbfetzrctshdwwimm`
   - Project Name: MedEx CRM

3. **Navigate to API Settings:**
   - Click: **Settings** (left sidebar)
   - Click: **API** tab

4. **Reload Schema Cache:**
   - Scroll down to find: **"PostgREST Schema Cache"** section
   - Click: **"Reload Schema"** button
   - Wait: 10-15 seconds

5. **Verify in Table Editor:**
   - Go to: **Table Editor** (left sidebar)
   - Verify you can see all 6 tables:
     - ✅ users
     - ✅ user_settings
     - ✅ audit_logs
     - ✅ user_credentials
     - ✅ notes
     - ✅ failed_login_attempts

6. **Test API Access:**
   ```bash
   # Run this to verify tables are now accessible
   node verify-supabase-database.js
   ```

### Alternative Method (If button not available):

1. **Table Editor Force Reload:**
   - Go to: **Table Editor**
   - Click on each table name
   - This forces PostgREST to recognize the tables

2. **SQL Editor NOTIFY:**
   - Go to: **SQL Editor**
   - Run this command:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

### Why Automatic Reload Failed:

1. **Database Password vs API Key:**
   - The `SERVICE_ROLE_KEY` is a JWT token for REST API
   - Direct PostgreSQL connection requires the actual database password
   - These are different credentials

2. **Supavisor Pooler Authentication:**
   - Connection string: `postgres.{project}:{password}@aws-0-us-east-1.pooler.supabase.com`
   - Password must be the database password (not service role key)

3. **RPC Function Not Available:**
   - `pg_notify()` is not exposed via REST API by default
   - Manual dashboard action is required

## After Fix is Applied

Once the schema cache is reloaded:

1. ✅ All REST API endpoints will work
2. ✅ User registration will function correctly
3. ✅ First user can be created with super_user role
4. ✅ Application will load without errors

## Prevention for Future

To avoid this issue when creating new tables:

1. **Use Supabase Migrations:**
   ```bash
   supabase migration new table_name
   # Edit the migration file
   supabase db push
   ```

2. **Use Table Editor in Dashboard:**
   - Creates tables through the UI
   - Automatically triggers schema reload

3. **Always Reload Schema After Direct SQL:**
   - Settings > API > Reload Schema
   - Required after any direct SQL table creation

## Verification Checklist

After reloading schema, verify:

- [ ] Supabase Dashboard shows all 6 tables in Table Editor
- [ ] No PGRST205 errors when accessing tables via REST API
- [ ] User registration page loads without errors
- [ ] Can create first user successfully
- [ ] First user gets super_user role and is auto-activated

## Next Steps

1. ✅ Go to Supabase Dashboard and reload schema (REQUIRED)
2. ✅ Verify tables are accessible
3. ✅ Test user registration
4. ✅ Create your first super user account

---

**Status:** Waiting for manual schema reload in Supabase Dashboard

**ETA:** 2-3 minutes once you access the dashboard
