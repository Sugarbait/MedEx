-- Migration: Create core tables for CareXPS CRM
-- This creates the necessary tables for user settings and MFA configuration

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

-- Create RLS policies for user_settings
CREATE POLICY "Users can manage their own settings" ON user_settings
    FOR ALL USING (user_id = auth.uid()::text OR user_id IN (
        SELECT id FROM users WHERE azure_ad_id = auth.uid()::text
    ));

-- Create RLS policies for user_mfa_configs
CREATE POLICY "Users can manage their own MFA config" ON user_mfa_configs
    FOR ALL USING (user_id = auth.uid()::text OR user_id IN (
        SELECT id FROM users WHERE azure_ad_id = auth.uid()::text
    ));

-- Create RLS policies for mfa_challenges
CREATE POLICY "Users can manage their own MFA challenges" ON mfa_challenges
    FOR ALL USING (user_id = auth.uid()::text OR user_id IN (
        SELECT id FROM users WHERE azure_ad_id = auth.uid()::text
    ));

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

-- Add helpful comments
COMMENT ON TABLE user_settings IS 'Stores user preferences and settings for cross-device synchronization';
COMMENT ON TABLE user_mfa_configs IS 'Stores encrypted MFA configuration for users';
COMMENT ON TABLE mfa_challenges IS 'Stores temporary MFA challenge tokens';
COMMENT ON COLUMN user_settings.retell_config IS 'Encrypted Retell AI API configuration (api_key, call_agent_id, sms_agent_id)';
COMMENT ON COLUMN user_mfa_configs.encrypted_secret IS 'Encrypted TOTP secret for MFA';
COMMENT ON COLUMN user_mfa_configs.encrypted_backup_codes IS 'Encrypted backup codes for MFA recovery';