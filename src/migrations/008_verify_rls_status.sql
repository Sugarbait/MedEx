-- Verify RLS is properly configured

-- Check RLS status on user_settings
SELECT
    'RLS Status:' as info,
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'user_settings';

-- List all policies on user_settings table
SELECT
    'Policies on user_settings:' as info;

SELECT
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'user_settings';

-- Test: Try to query user_settings (should only see your own)
SELECT
    'Your settings (if any):' as info;

SELECT
    user_id,
    settings,
    last_synced,
    updated_at
FROM user_settings
LIMIT 5;

-- Count total settings vs what you can see
SELECT
    'Settings visibility check:' as info;

WITH total_count AS (
    SELECT COUNT(*) as total FROM user_settings
),
visible_count AS (
    SELECT COUNT(*) as visible FROM user_settings
)
SELECT
    total_count.total as total_settings_in_db,
    visible_count.visible as settings_you_can_see
FROM total_count, visible_count;