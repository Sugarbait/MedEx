-- Migration: Ensure user_settings table has proper RLS policies (FIXED VERSION)
-- This version properly handles UUID to text casting

-- First, check if the table exists and create it if it doesn't
CREATE TABLE IF NOT EXISTS user_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL,
    settings JSONB DEFAULT '{}',
    version INTEGER DEFAULT 1,
    last_synced TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_settings table
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can delete their own settings" ON user_settings;

-- Create simplified RLS policies for user_settings
-- Using only user_id comparison since your app uses Azure AD IDs as user IDs
CREATE POLICY "Users can view their own settings" ON user_settings
    FOR SELECT USING (
        user_id = auth.uid()::text
    );

CREATE POLICY "Users can insert their own settings" ON user_settings
    FOR INSERT WITH CHECK (
        user_id = auth.uid()::text
    );

CREATE POLICY "Users can update their own settings" ON user_settings
    FOR UPDATE USING (
        user_id = auth.uid()::text
    );

CREATE POLICY "Users can delete their own settings" ON user_settings
    FOR DELETE USING (
        user_id = auth.uid()::text
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_last_synced ON user_settings(last_synced);

-- Add constraint to prevent duplicate user_settings per user
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_settings_user_id_unique'
        AND table_name = 'user_settings'
    ) THEN
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

-- Optional: Insert a test row to verify everything works
-- DELETE FROM user_settings WHERE user_id = 'test-user-delete-me';
-- INSERT INTO user_settings (user_id, settings) VALUES ('test-user-delete-me', '{"test": true}');
-- DELETE FROM user_settings WHERE user_id = 'test-user-delete-me';

COMMENT ON TABLE user_settings IS 'Stores user settings for cross-device synchronization';
COMMENT ON COLUMN user_settings.user_id IS 'Azure AD ID or auth.uid() of the user';
COMMENT ON COLUMN user_settings.settings IS 'JSON object containing all user settings';
COMMENT ON COLUMN user_settings.version IS 'Version number for optimistic concurrency control';
COMMENT ON COLUMN user_settings.last_synced IS 'Last time settings were synced from client';