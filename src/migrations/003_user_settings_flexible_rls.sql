-- Flexible migration that works with existing user_settings table structure
-- This adds the 'settings' column if it doesn't exist and sets up RLS

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

-- Add 'version' column if it doesn't exist
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
END
$$;

-- Add 'last_synced' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_settings'
        AND column_name = 'last_synced'
    ) THEN
        ALTER TABLE user_settings ADD COLUMN last_synced TIMESTAMPTZ DEFAULT NOW();
    END IF;
END
$$;

-- Add 'created_at' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_settings'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE user_settings ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END
$$;

-- Add 'updated_at' column if it doesn't exist
DO $$
BEGIN
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

-- Migrate existing data to the new structure if needed
-- If your table has different column names for settings data, adjust this:
DO $$
BEGIN
    -- Example: If you have a 'preferences' column, migrate it to 'settings'
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_settings'
        AND column_name = 'preferences'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_settings'
        AND column_name = 'settings'
    ) THEN
        UPDATE user_settings
        SET settings = COALESCE(preferences::jsonb, '{}'::jsonb)
        WHERE settings = '{}'::jsonb OR settings IS NULL;
    END IF;

    -- If you have individual setting columns, merge them into the settings JSONB
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_settings'
        AND column_name = 'theme'
    ) THEN
        UPDATE user_settings
        SET settings = settings || jsonb_build_object('theme', theme)
        WHERE theme IS NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_settings'
        AND column_name = 'notifications_enabled'
    ) THEN
        UPDATE user_settings
        SET settings = settings || jsonb_build_object('notifications_enabled', notifications_enabled)
        WHERE notifications_enabled IS NOT NULL;
    END IF;
END
$$;

-- Enable RLS on user_settings table
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can delete their own settings" ON user_settings;

-- Create RLS policies that work with your authentication
CREATE POLICY "Users can view their own settings" ON user_settings
    FOR SELECT USING (
        -- Direct match with auth.uid()
        user_id = auth.uid()::text
        -- Or match with Azure AD ID from users table
        OR EXISTS (
            SELECT 1 FROM users
            WHERE (users.id = user_settings.user_id OR users.azure_ad_id = user_settings.user_id)
            AND users.azure_ad_id = auth.uid()::text
        )
        -- Or if user_id is stored as UUID, try casting
        OR (
            CASE
                WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN user_id::uuid = auth.uid()
                ELSE false
            END
        )
    );

CREATE POLICY "Users can insert their own settings" ON user_settings
    FOR INSERT WITH CHECK (
        -- Direct match with auth.uid()
        user_id = auth.uid()::text
        -- Or match with Azure AD ID from users table
        OR EXISTS (
            SELECT 1 FROM users
            WHERE (users.id = user_settings.user_id OR users.azure_ad_id = user_settings.user_id)
            AND users.azure_ad_id = auth.uid()::text
        )
        -- Or if user_id is stored as UUID, try casting
        OR (
            CASE
                WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN user_id::uuid = auth.uid()
                ELSE false
            END
        )
    );

CREATE POLICY "Users can update their own settings" ON user_settings
    FOR UPDATE USING (
        -- Direct match with auth.uid()
        user_id = auth.uid()::text
        -- Or match with Azure AD ID from users table
        OR EXISTS (
            SELECT 1 FROM users
            WHERE (users.id = user_settings.user_id OR users.azure_ad_id = user_settings.user_id)
            AND users.azure_ad_id = auth.uid()::text
        )
        -- Or if user_id is stored as UUID, try casting
        OR (
            CASE
                WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN user_id::uuid = auth.uid()
                ELSE false
            END
        )
    );

CREATE POLICY "Users can delete their own settings" ON user_settings
    FOR DELETE USING (
        -- Direct match with auth.uid()
        user_id = auth.uid()::text
        -- Or match with Azure AD ID from users table
        OR EXISTS (
            SELECT 1 FROM users
            WHERE (users.id = user_settings.user_id OR users.azure_ad_id = user_settings.user_id)
            AND users.azure_ad_id = auth.uid()::text
        )
        -- Or if user_id is stored as UUID, try casting
        OR (
            CASE
                WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN user_id::uuid = auth.uid()
                ELSE false
            END
        )
    );

-- Create indexes for better performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_last_synced ON user_settings(last_synced);
CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at ON user_settings(updated_at);

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

-- Add helpful comments
COMMENT ON TABLE user_settings IS 'Stores user settings for cross-device synchronization';
COMMENT ON COLUMN user_settings.settings IS 'JSON object containing all user settings';

-- Output the final structure for verification
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'user_settings'
ORDER BY ordinal_position;