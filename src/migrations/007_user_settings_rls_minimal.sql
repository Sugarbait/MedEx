-- Minimal RLS setup - simplest possible approach
-- This works if your application passes the user_id correctly

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can delete their own settings" ON user_settings;

-- Create a single, simple policy for authenticated users
-- This allows users to manage their own settings based on user_id matching

CREATE POLICY "Enable access to own settings" ON user_settings
    FOR ALL
    USING (auth.role() = 'authenticated' AND user_id::text = auth.uid()::text)
    WITH CHECK (auth.role() = 'authenticated' AND user_id::text = auth.uid()::text);

-- Grant permissions
GRANT ALL ON user_settings TO authenticated;
REVOKE ALL ON user_settings FROM anon;

-- Verify RLS status
SELECT
    'RLS Status After Enabling:' as info,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'user_settings';

-- Count policies
SELECT
    'Active Policies:' as info,
    count(*) as policy_count
FROM pg_policies
WHERE tablename = 'user_settings';