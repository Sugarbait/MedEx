-- Migration: Ensure user_settings table has proper RLS policies
-- This ensures settings are secure and users can only access their own data

-- Enable RLS on user_settings table
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can delete their own settings" ON user_settings;

-- Create RLS policies for user_settings
-- Note: auth.uid() returns UUID, user_id is text, so we need proper casting
CREATE POLICY "Users can view their own settings" ON user_settings
    FOR SELECT USING (
        user_id = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = user_settings.user_id
            AND users.azure_ad_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert their own settings" ON user_settings
    FOR INSERT WITH CHECK (
        user_id = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = user_settings.user_id
            AND users.azure_ad_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can update their own settings" ON user_settings
    FOR UPDATE USING (
        user_id = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = user_settings.user_id
            AND users.azure_ad_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can delete their own settings" ON user_settings
    FOR DELETE USING (
        user_id = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = user_settings.user_id
            AND users.azure_ad_id = auth.uid()::text
        )
    );

-- Create index for better performance on user_id lookups
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

-- Create function to clean up old/duplicate settings
CREATE OR REPLACE FUNCTION cleanup_user_settings_duplicates(target_user_id text)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    kept_row_id text;
BEGIN
    -- Get the most recent settings row for the user
    SELECT id INTO kept_row_id
    FROM user_settings
    WHERE user_id = target_user_id
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1;

    -- Delete all other rows for this user
    DELETE FROM user_settings
    WHERE user_id = target_user_id
    AND id != kept_row_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON user_settings TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_user_settings_duplicates(text) TO authenticated;