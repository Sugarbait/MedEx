-- Alternative migration without RLS (for testing purposes)
-- Use this if RLS policies are causing issues, then add RLS later

-- Add 'settings' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_settings'
        AND column_name = 'settings'
    ) THEN
        ALTER TABLE user_settings ADD COLUMN settings JSONB DEFAULT '{}';
    END IF;
END
$$;

-- Add other necessary columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_settings'
        AND column_name = 'version'
    ) THEN
        ALTER TABLE user_settings ADD COLUMN version INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_settings'
        AND column_name = 'last_synced'
    ) THEN
        ALTER TABLE user_settings ADD COLUMN last_synced TIMESTAMPTZ DEFAULT NOW();
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_settings'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE user_settings ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_settings'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE user_settings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END
$$;

-- Temporarily DISABLE RLS to avoid casting issues
ALTER TABLE user_settings DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can delete their own settings" ON user_settings;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_last_synced ON user_settings(last_synced);

-- Add unique constraint on user_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_settings_user_id_unique'
        AND table_name = 'user_settings'
    ) THEN
        -- First remove any duplicates
        DELETE FROM user_settings a
        USING user_settings b
        WHERE a.ctid < b.ctid
        AND a.user_id = b.user_id;

        -- Then add the unique constraint
        ALTER TABLE user_settings ADD CONSTRAINT user_settings_user_id_unique UNIQUE (user_id);
    END IF;
END
$$;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updated_at updates
DROP TRIGGER IF EXISTS user_settings_updated_at_trigger ON user_settings;
CREATE TRIGGER user_settings_updated_at_trigger
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_settings_updated_at();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON user_settings TO authenticated;
GRANT ALL ON user_settings TO anon; -- Allow anonymous access temporarily

-- Verify the final structure
SELECT 'Table structure after migration (RLS DISABLED):' as info;
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'user_settings'
ORDER BY ordinal_position;

-- Show RLS status
SELECT 'RLS Status:' as info;
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'user_settings';