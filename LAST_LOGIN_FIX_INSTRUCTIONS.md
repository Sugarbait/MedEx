# Last Login Fix Instructions

## The Issue
The User Management page shows "Never" for Last Login because the database is missing the `last_login` column.

## Solution Steps

### Step 1: Add the Column to Your Database

**Option A: Using Supabase Dashboard (Recommended)**
1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **Table Editor** in the left sidebar
4. Find and click on the **users** table
5. Click the **Add Column** button
6. Configure the new column:
   - **Name:** `last_login`
   - **Type:** `timestamptz` (timestamp with time zone)
   - **Default Value:** (leave empty)
   - **Is Nullable:** ✅ Yes (checked)
   - **Is Unique:** ❌ No (unchecked)
7. Click **Save**

**Option B: Using SQL Editor in Supabase**
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Run this SQL command:
```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login timestamptz;
```
4. Click **Run**

### Step 2: Initialize Existing Users
After adding the column, run this SQL in the SQL Editor to set initial values:
```sql
-- Set last_login to created_at for users who haven't logged in yet
UPDATE users
SET last_login = created_at
WHERE last_login IS NULL AND created_at IS NOT NULL;
```

### Step 3: Verify the Fix
1. Go back to your CareXPS application
2. Navigate to User Management
3. You should now see "Created" dates instead of "Never" for users who haven't logged in
4. When users log in, their actual last login time will be recorded

## What This Fix Does

1. **For Existing Users**: Shows their account creation date as initial last login
2. **For New Users**: Automatically tracks last login when they first sign in
3. **For Future Logins**: Updates the timestamp every time a user logs in

## Code Changes Already Made

The application code has been updated to:
- ✅ Update `last_login` when users log in via Azure AD
- ✅ Display the `last_login` field in User Management
- ✅ Handle both new and existing user profiles
- ✅ Map database fields correctly to the UI

## Automatic Tracking

Once the column is added, the system will automatically:
- Track login times for all users
- Update the timestamp on each successful login
- Display accurate last login information in User Management
- Work for both Azure AD and local authentication

## Troubleshooting

If you still see "Never" after adding the column:
1. Clear your browser cache
2. Refresh the User Management page
3. Check the browser console for errors
4. Verify the column was added correctly in Supabase

## For Developers

The following files handle last login tracking:
- `src/services/authService.ts` - Updates last_login on authentication
- `src/services/userProfileService.ts` - Maps last_login field from database
- `src/services/userManagementService.ts` - Retrieves last_login for display
- `src/pages/UserManagementPage.tsx` - Displays last login in the UI

The system is designed to work gracefully even if the column doesn't exist, falling back to localStorage for backwards compatibility.