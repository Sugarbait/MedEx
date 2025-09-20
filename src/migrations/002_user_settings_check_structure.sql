-- First, let's check the existing structure of user_settings table
-- Run this query to see what columns exist:
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_settings'
ORDER BY ordinal_position;