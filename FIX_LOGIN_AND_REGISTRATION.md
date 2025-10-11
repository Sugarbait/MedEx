# Fix Guide: Login & User Registration Issues
## Instructions for Claude Code to Fix Similar CRM Systems

**Context:** This document describes the exact issues found in MedEx CRM on October 10, 2025, and how to fix them. Use this to troubleshoot similar login/registration problems in other CRM systems based on this codebase.

---

## 🔴 Problem 1: User Registration Fails with "Registration Failed" Error

### Symptoms:
- User fills registration form
- Clicks "Create Account"
- Gets generic "Registration failed" message
- No specific error in UI
- Database shows 0 users (clean state)

### Diagnostic Steps:

**Step 1: Check browser console for this error:**
```
null value in column "id" of relation "users" violates not-null constraint
Code: 23502
```

**Step 2: Check database schema:**
```sql
SELECT column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name = 'id';
```

If result is `NULL` or empty → **This is the problem**

### Root Cause:
The `users` table `id` column is **not configured to auto-generate UUIDs**.

### Fix:
Run this SQL in Supabase SQL Editor:
```sql
ALTER TABLE users
ALTER COLUMN id
SET DEFAULT gen_random_uuid();
```

### Verification:
Try creating a test user:
```sql
INSERT INTO users (email, name, role, is_active, tenant_id, last_login)
VALUES ('test@test.com', 'Test User', 'super_user', true, 'medex', null)
RETURNING *;
```

If this works → **Fixed!** ✅

---

## 🔴 Problem 2: Invalid API Key Errors in Diagnostic Tools

### Symptoms:
- HTML diagnostic tools fail with "Invalid API key"
- Network requests show 401/403 errors
- Console shows authentication errors

### Root Cause:
Diagnostic tools (`.html` files) contain outdated Supabase API keys.

### Fix:
Update all `.html` files with current keys:

**Files to update:**
- `check-existing-users.html`
- `cleanup-carexps-data.html`
- `clear-all-medex-users.html`
- `clear-localstorage.html`

**Find and replace:**

OLD (expired):
```javascript
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA1MTk3MzcsImV4cCI6MjA0NjA5NTczN30.Qz2uP4xSxkaxMvPxeL-CfGu93i2TcCb2d6Kp8aE5L3g'
```

NEW (current):
```javascript
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODA5ODYsImV4cCI6MjA3NTU1Njk4Nn0.MgsjiXT2Y0WqQf2puG2p27tHaMRfhiUET2TDWc668lI'
```

**Current credentials (as of Oct 2025):**
```javascript
SUPABASE_URL = 'https://onwgbfetzrctshdwwimm.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODA5ODYsImV4cCI6MjA3NTU1Njk4Nn0.MgsjiXT2Y0WqQf2puG2p27tHaMRfhiUET2TDWc668lI'
```

---

## 🔴 Problem 3: "User Already Exists" But Database is Empty

### Symptoms:
- Registration says user exists
- Database query shows 0 users
- Check existing users tool shows empty
- Network requests succeed but no user created

### Diagnostic Steps:

**Step 1: Check actual database:**
```sql
SELECT * FROM users
WHERE email = 'test@test.com'
AND tenant_id = 'medex';
```

**Step 2: Check Supabase Auth:**
- Go to Supabase Dashboard → Authentication → Users
- Search for the email
- Check if user exists in Auth but not database

**Step 3: Check browser localStorage:**
```javascript
// In browser console
Object.keys(localStorage)
```

### Root Cause:
Usually one of:
1. User exists in Supabase Auth but not in database table
2. Stale localStorage data
3. Wrong tenant filter in query

### Fix:

**If user in Auth but not database:**
```sql
-- Delete from Auth (use Supabase Dashboard)
-- Then try registration again
```

**If stale localStorage:**
```javascript
// Browser console
localStorage.clear()
sessionStorage.clear()
// Then refresh page
```

**If wrong tenant:**
Check `src/config/tenantConfig.ts`:
```typescript
export const TENANT_CONFIG = {
  CURRENT_TENANT: 'medex'  // Should match your CRM
}
```

---

## 🔴 Problem 4: First User Not Getting Super User Role

### Symptoms:
- First user created successfully
- User has role 'user' instead of 'super_user'
- User requires approval instead of auto-activation

### Diagnostic Query:
```sql
SELECT id, email, role, is_active, created_at
FROM users
WHERE tenant_id = 'medex'
ORDER BY created_at ASC
LIMIT 1;
```

### Root Cause:
First user detection logic not working correctly.

### Check Code:
File: `src/components/auth/UserRegistration.tsx` - Lines 72-94

```typescript
// Should look like this:
const { data: existingUsers } = await supabase
  .from('users')
  .select('id')
  .eq('tenant_id', 'medex')  // ← Check tenant matches
  .limit(1)

const isFirstUser = !existingUsers || existingUsers.length === 0

const userData = {
  role: isFirstUser ? 'super_user' : 'user',
  isActive: isFirstUser ? true : false,
  tenant_id: 'medex'  // ← Must be set
}
```

### Fix:
If first user already created with wrong role:
```sql
UPDATE users
SET role = 'super_user',
    is_active = true
WHERE tenant_id = 'medex'
ORDER BY created_at ASC
LIMIT 1;
```

---

## 🔴 Problem 5: Login Not Working After Registration

### Symptoms:
- User successfully registers
- Gets success message
- Cannot log in with credentials
- "Invalid credentials" error

### Diagnostic Steps:

**Check if user in database:**
```sql
SELECT id, email, role, is_active
FROM users
WHERE email = 'test@test.com'
AND tenant_id = 'medex';
```

**Check if user in Supabase Auth:**
```sql
-- Use Supabase Dashboard
-- Authentication → Users
-- Search for email
```

### Root Cause:
User created in database but not in Supabase Auth (or vice versa).

### Fix:

**Option 1: Delete and re-register**
```sql
-- Delete from database
DELETE FROM users
WHERE email = 'test@test.com'
AND tenant_id = 'medex';

-- Delete from Auth (Supabase Dashboard)
-- Then register again
```

**Option 2: Create Auth user manually**
```javascript
// Use this if user exists in DB but not Auth
const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email: 'test@test.com',
  password: 'YourPassword123!',
  email_confirm: true,
  user_metadata: {
    name: 'Test User',
    role: 'super_user'
  }
})
```

---

## 🛠️ Diagnostic Tools to Use

### 1. Check Database State
```bash
node check-test-user.js
```
Shows:
- User in database (Y/N)
- User in Auth (Y/N)
- Total user count per tenant

### 2. Test Direct User Creation
```bash
node test-direct-create.js
```
Attempts to create user and shows exact error.

### 3. Browser Tools
**File:** `check-existing-users.html`
- Visual interface to see all users
- Delete users directly
- Check roles and status

---

## 🔍 Quick Diagnostic Checklist

When user registration/login fails, check in this order:

- [ ] **Step 1:** Browser console - look for red errors
- [ ] **Step 2:** Network tab - check for failed requests (400/500 status)
- [ ] **Step 3:** Run diagnostic SQL to check users table
- [ ] **Step 4:** Check Supabase Auth users list
- [ ] **Step 5:** Verify `id` column has UUID default
- [ ] **Step 6:** Check tenant_id matches in all queries
- [ ] **Step 7:** Verify API keys are current
- [ ] **Step 8:** Clear localStorage and try again

---

## 📋 Complete Fix Process (Step by Step)

### When User Says: "Registration fails" or "Can't create user"

**1. Get the exact error:**
```
Ask user to open browser console (F12) and look for red errors.
Look for error code 23502 or "not-null constraint"
```

**2. Run this diagnostic:**
```bash
cd "I:\Apps Back Up\Main MedEX CRM"
node test-direct-create.js
```

**3. If error is "null value in column id":**
```sql
-- Run this in Supabase SQL Editor
ALTER TABLE users
ALTER COLUMN id
SET DEFAULT gen_random_uuid();
```

**4. If error is "user already exists":**
```sql
-- Check actual database
SELECT * FROM users WHERE email = 'user@email.com' AND tenant_id = 'medex';

-- If user found, delete
DELETE FROM users WHERE email = 'user@email.com' AND tenant_id = 'medex';

-- Also check and delete from Supabase Auth Dashboard
```

**5. If error is "invalid API key":**
```javascript
// Update all .html diagnostic tools with current keys
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2diZmV0enJjdHNoZHd3aW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODA5ODYsImV4cCI6MjA3NTU1Njk4Nn0.MgsjiXT2Y0WqQf2puG2p27tHaMRfhiUET2TDWc668lI'
```

**6. Verify fix:**
```
Open http://localhost:3000
Try registering with test@test.com
Should succeed and show "first user = super user" message
```

---

## 🎯 Expected Working Flow

After fixes applied, this should happen:

1. ✅ User opens registration page
2. ✅ Fills form with email, password, name
3. ✅ Clicks "Create Account"
4. ✅ System checks: 0 users found
5. ✅ Creates user with:
   - `role = 'super_user'`
   - `is_active = true`
   - `tenant_id = 'medex'`
   - `id = auto-generated UUID`
6. ✅ Shows success message: "Congratulations! First user, you are Super User"
7. ✅ User can log in immediately
8. ✅ Dashboard loads successfully

---

## 📊 Key SQL Queries for Diagnosis

```sql
-- 1. Check if UUID default is set
SELECT column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'id';
-- Should return: gen_random_uuid()

-- 2. Count users per tenant
SELECT tenant_id, COUNT(*) as count
FROM users
GROUP BY tenant_id;

-- 3. Find first user per tenant
SELECT tenant_id, email, role, is_active, created_at
FROM users
ORDER BY created_at ASC;

-- 4. Check for orphaned users (no Auth record)
-- Compare with Supabase Auth Dashboard

-- 5. Delete specific user completely
DELETE FROM users WHERE email = 'test@test.com' AND tenant_id = 'medex';
-- Also delete from Supabase Auth Dashboard
```

---

## 🔧 Files to Check/Modify

### If registration broken:
1. `src/components/auth/UserRegistration.tsx` - Registration form logic
2. `src/services/userManagementService.ts` - User creation (lines 112-171)
3. `src/services/userProfileService.ts` - Database operations
4. Database schema - `users` table `id` column

### If login broken:
1. `src/services/userManagementService.ts` - Authentication (lines 209-239)
2. `src/services/authService.ts` - Login flow
3. Supabase Auth users list

### Configuration:
1. `src/config/tenantConfig.ts` - Tenant settings
2. `src/config/environmentLoader.ts` - API keys (lines 95-97)
3. `.env.local` - Environment variables

---

## 💡 Common Mistakes to Avoid

❌ **Don't forget tenant_id filter:**
```typescript
// WRONG - returns all users
.from('users').select('*')

// CORRECT - returns only medex users
.from('users').select('*').eq('tenant_id', 'medex')
```

❌ **Don't assume localStorage is empty:**
```typescript
// Always clear before testing
localStorage.clear()
```

❌ **Don't skip UUID default:**
```sql
-- Must have this for user creation to work
ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();
```

---

**Document Purpose:** Feed this back to Claude Code when fixing login/registration issues in similar CRM systems.

**Usage:** Copy this entire document into Claude Code chat and say: "The login and registration aren't working. Follow this guide to diagnose and fix."

**Last Updated:** October 10, 2025
**Database:** onwgbfetzrctshdwwimm.supabase.co
**Tenant:** medex
