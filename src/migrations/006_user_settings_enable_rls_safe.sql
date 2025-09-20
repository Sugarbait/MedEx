-- Enable RLS with proper policies for user_settings
-- This version handles the type casting correctly

-- First, check the data type of user_id column
SELECT
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name = 'user_settings'
AND column_name = 'user_id';

-- Enable RLS on user_settings table
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can delete their own settings" ON user_settings;

-- Create RLS policies using proper type casting
-- These policies assume user_id is stored as text (Azure AD ID or similar)

-- Policy for SELECT: Users can only view their own settings
CREATE POLICY "Users can view their own settings" ON user_settings
    FOR SELECT
    USING (
        -- Compare as text (most compatible approach)
        user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claims', true)::json->>'sub')
    );

-- Policy for INSERT: Users can only insert their own settings
CREATE POLICY "Users can insert their own settings" ON user_settings
    FOR INSERT
    WITH CHECK (
        -- Compare as text
        user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claims', true)::json->>'sub')
    );

-- Policy for UPDATE: Users can only update their own settings
CREATE POLICY "Users can update their own settings" ON user_settings
    FOR UPDATE
    USING (
        -- Compare as text
        user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claims', true)::json->>'sub')
    )
    WITH CHECK (
        -- Ensure they can't change the user_id
        user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claims', true)::json->>'sub')
    );

-- Policy for DELETE: Users can only delete their own settings
CREATE POLICY "Users can delete their own settings" ON user_settings
    FOR DELETE
    USING (
        -- Compare as text
        user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claims', true)::json->>'sub')
    );

-- Verify RLS is enabled
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'user_settings';

-- Test the policies (optional - will only return your own settings)
SELECT
    'Testing RLS - You should only see your own settings:' as info;

SELECT
    user_id,
    settings,
    last_synced
FROM user_settings
LIMIT 5;