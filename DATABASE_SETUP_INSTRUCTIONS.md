# MedEx Database Setup Instructions

## Problem Diagnosis

The error `"Could not find the table 'public.users' in the schema cache"` (PGRST205) indicates that the tables **do not exist** in the Supabase database. The PostgREST API cannot find them because they haven't been created yet.

## Database Information

- **Project Reference**: `onwgbfetzrctshdwwimm`
- **Database URL**: `https://onwgbfetzrctshdwwimm.supabase.co`
- **Dashboard URL**: `https://supabase.com/dashboard/project/onwgbfetzrctshdwwimm`

## Solution: Manual SQL Execution (REQUIRED)

Supabase does not allow direct SQL execution via REST API for security reasons. You must use the Supabase Dashboard SQL Editor:

### Step-by-Step Instructions:

1. **Open the Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/onwgbfetzrctshdwwimm
   - Log in with your Supabase account

2. **Navigate to SQL Editor**
   - Click **"SQL Editor"** in the left sidebar
   - Click **"New Query"** button (top right)

3. **Copy the SQL Schema**
   - Open the file: `I:\Apps Back Up\Main MedEX CRM\medex-setup-new-database.sql`
   - Copy **ALL** contents (Ctrl+A, Ctrl+C)

4. **Paste and Execute**
   - Paste into the SQL Editor (Ctrl+V)
   - Click **"Run"** button or press **Ctrl+Enter**
   - Wait for confirmation message: "Success. No rows returned"

5. **Verify Tables Created**
   - Click **"Table Editor"** in the left sidebar
   - You should see 6 new tables:
     - `users`
     - `user_settings`
     - `audit_logs`
     - `user_credentials`
     - `notes`
     - `failed_login_attempts`

## Tables Being Created

The SQL file will create:

### 1. Users Table
- Primary authentication and profile data
- Tenant isolation with `tenant_id = 'medex'`
- Supports roles: super_user, user, admin, healthcare_provider, staff

### 2. User Settings Table
- User preferences and configuration
- Retell AI credentials storage
- Theme, notifications, security preferences

### 3. Audit Logs Table (HIPAA Compliance)
- Complete audit trail for all actions
- 6-year retention for compliance
- Stores user actions, timestamps, outcomes

### 4. User Credentials Table
- Encrypted password storage
- Separate from users table for security

### 5. Notes Table
- Cross-device synchronized notes
- User-specific note management

### 6. Failed Login Attempts Table
- Security monitoring
- Tracks authentication failures

## Security Features Implemented

✅ **Row Level Security (RLS)** - Enabled on all tables
✅ **Permissive RLS Policies** - Allow authentication flow
✅ **Tenant Isolation** - `tenant_id` columns for multi-tenancy
✅ **Indexes** - Performance optimization for queries
✅ **Foreign Keys** - Data integrity constraints
✅ **Permissions** - Proper grants for anon and authenticated users

## Verification Steps

After running the SQL, verify the setup:

### Option 1: Use Verification Script
```bash
cd "I:\Apps Back Up\Main MedEX CRM"
node verify-supabase-database.js
```

### Option 2: Manual Check via Dashboard
1. Go to **Table Editor** in Supabase Dashboard
2. Verify all 6 tables are listed
3. Click on each table to view schema

### Option 3: Test REST API Access
Run this command to test API access:
```bash
curl "https://onwgbfetzrctshdwwimm.supabase.co/rest/v1/users?select=*&limit=1" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODA5ODYsImV4cCI6MjA3NTU1Njk4Nn0.MgsjiXT2Y0WqQf2puG2p27tHaMRfhiUET2TDWc668lI"
```

Expected response: `[]` (empty array, not an error)

## Update Application Configuration

After tables are created, update your `.env.local` file:

```bash
# Supabase Configuration (NEW DATABASE)
VITE_SUPABASE_URL=https://onwgbfetzrctshdwwimm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODA5ODYsImV4cCI6MjA3NTU1Njk4Nn0.MgsjiXT2Y0WqQf2puG2p27tHaMRfhiUET2TDWc668lI
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk4MDk4NiwiZXhwIjoyMDc1NTU2OTg2fQ.uCxrGkQJQjR3wCmmCo3A6Oi6zBY-QdMX1hLZmD5HvZA
```

## Troubleshooting

### If tables don't appear after running SQL:

1. **Check for SQL errors** in the Supabase SQL Editor output
2. **Refresh the Table Editor** page
3. **Try running each CREATE TABLE statement individually** (split the SQL file)
4. **Check database permissions** in Supabase Dashboard → Settings → Database

### If REST API still returns 404:

1. **Wait 30-60 seconds** for PostgREST cache to refresh
2. **Restart the PostgREST service** (Supabase Dashboard → Settings → Database → Restart)
3. **Clear browser cache** and refresh

### Common Errors:

- **"relation already exists"** - Tables already created, you're good to go
- **"permission denied"** - Check if RLS policies are created
- **"schema cache"** - Wait for cache refresh or restart PostgREST

## Next Steps

After successful database setup:

1. ✅ Verify all tables exist via verification script
2. ✅ Update `.env.local` with new credentials
3. ✅ Test application login/registration
4. ✅ Create first user (will auto-become super_user)
5. ✅ Verify tenant isolation (all data should have `tenant_id = 'medex'`)

## Support

If you encounter issues:
- Check Supabase Dashboard → Logs for detailed error messages
- Review RLS policies in Table Editor → Policies tab
- Verify indexes in Table Editor → Indexes tab
- Contact Supabase support if database-level issues persist

---

**Status**: Tables must be created manually via Supabase Dashboard SQL Editor
**Required Action**: Follow steps 1-5 above to create tables
**Verification**: Run `node verify-supabase-database.js` after completion
