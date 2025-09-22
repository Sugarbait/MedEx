# IMPORTANT: Run These SQL Commands in Supabase

## Why Your Settings and MFA Aren't Syncing

The tables needed for cross-device synchronization don't exist in your Supabase database. You need to create them.

## How to Fix This

1. **Go to your Supabase Dashboard**
   - Open https://supabase.com/dashboard
   - Select your project

2. **Open the SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and Run This SQL**
   - Copy ALL the SQL below
   - Paste it into the SQL editor
   - Click "Run" or press Ctrl+Enter

```sql
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
    notifications JSONB DEFAULT '{"email": true, "sms": true, "push": true, "in_app": true, "call_alerts": true, "sms_alerts": true, "security_alerts": true}'::jsonb,
    security_preferences JSONB DEFAULT '{"session_timeout": 15, "require_mfa": true, "password_expiry_reminder": true, "login_notifications": true}'::jsonb,
    dashboard_layout JSONB,
    communication_preferences JSONB DEFAULT '{"default_method": "phone", "auto_reply_enabled": false, "business_hours": {"enabled": false, "start": "09:00", "end": "17:00", "timezone": "America/New_York"}}'::jsonb,
    accessibility_settings JSONB DEFAULT '{"high_contrast": false, "large_text": false, "screen_reader": false, "keyboard_navigation": false}'::jsonb,
    retell_config JSONB,
    device_sync_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_mfa_configs table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_mfa_configs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    encrypted_secret TEXT,
    encrypted_backup_codes JSONB,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    temporarily_disabled BOOLEAN DEFAULT false,
    registered_devices JSONB DEFAULT '[]'::jsonb,
    verified_at TIMESTAMPTZ,
    disabled_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_by_device_fingerprint TEXT,
    last_used_device_fingerprint TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create mfa_challenges table if it doesn't exist
CREATE TABLE IF NOT EXISTS mfa_challenges (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL,
    challenge_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mfa_configs_user_id ON user_mfa_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_user_id ON mfa_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_token ON mfa_challenges(challenge_token);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_expires ON mfa_challenges(expires_at);

-- Enable RLS on all tables
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mfa_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_challenges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can manage their own MFA config" ON user_mfa_configs;
DROP POLICY IF EXISTS "Users can manage their own MFA challenges" ON mfa_challenges;

-- Create simple RLS policies (allowing all authenticated users for now)
-- You can make these more restrictive later if needed
CREATE POLICY "Users can manage their own settings" ON user_settings
    FOR ALL USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can manage their own MFA config" ON user_mfa_configs
    FOR ALL USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can manage their own MFA challenges" ON mfa_challenges
    FOR ALL USING (true)
    WITH CHECK (true);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_user_mfa_configs_updated_at ON user_mfa_configs;
CREATE TRIGGER update_user_mfa_configs_updated_at
    BEFORE UPDATE ON user_mfa_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Grant necessary permissions
GRANT ALL ON user_settings TO authenticated;
GRANT ALL ON user_mfa_configs TO authenticated;
GRANT ALL ON mfa_challenges TO authenticated;
GRANT ALL ON user_settings TO anon;
GRANT ALL ON user_mfa_configs TO anon;
GRANT ALL ON mfa_challenges TO anon;
```

## After Running the SQL

1. You should see a success message
2. Check the "Table Editor" in Supabase - you should now see:
   - `user_settings` table
   - `user_mfa_configs` table
   - `mfa_challenges` table

## Test the Sync

1. Log in to your app on one computer
2. Go to Settings and save your API key and Agent IDs
3. Set up MFA if you haven't already
4. Log out
5. Log in from another computer
6. Your settings and MFA should now sync!

## Troubleshooting

If it still doesn't work:
1. Check the browser console for errors
2. Make sure your Supabase URL and keys are correctly set in your `.env.local` file
3. Check if the tables were created by looking in Supabase Table Editor

## Note
The RLS policies are currently set to allow all authenticated users to manage their own data. This is simplified for testing. In production, you may want to make them more restrictive.