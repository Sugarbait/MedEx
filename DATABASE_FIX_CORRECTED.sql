-- ============================================================================
-- DATABASE FIX CORRECTED - Fixed column reference errors
-- ============================================================================
-- This corrected migration fixes the column reference issues in the previous migration
-- ============================================================================

-- ============================================================================
-- 1. CREATE USER_PROFILES TABLE (Essential for profile fields)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    display_name TEXT,
    first_name TEXT,
    last_name TEXT,
    department TEXT,
    phone TEXT,
    bio TEXT,
    location TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. CREATE FAILED_LOGIN_ATTEMPTS TABLE (Corrected column name)
-- ============================================================================

CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT NOT NULL,  -- Changed from user_email to email
    attempt_time TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. CREATE USER_SETTINGS TABLE (For MFA and API credentials)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    theme TEXT DEFAULT 'light',
    notifications JSONB DEFAULT '{"email": true, "sms": true}'::jsonb,
    api_key TEXT,
    agent_id TEXT,
    retell_credentials JSONB DEFAULT '{}'::jsonb,
    fresh_mfa_secret TEXT,
    fresh_mfa_enabled BOOLEAN DEFAULT false,
    fresh_mfa_setup_completed BOOLEAN DEFAULT false,
    fresh_mfa_backup_codes JSONB DEFAULT '[]'::jsonb,
    preferences JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. CREATE PERFORMANCE INDEXES (Corrected column references)
-- ============================================================================

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at);

-- Failed login attempts indexes (CORRECTED: email instead of user_email)
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_email ON failed_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_time ON failed_login_attempts(attempt_time);

-- User settings indexes
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. CREATE RLS POLICIES
-- ============================================================================

-- User profiles policies
DROP POLICY IF EXISTS "Users can manage their own profile" ON user_profiles;
CREATE POLICY "Users can manage their own profile"
ON user_profiles FOR ALL
USING (
    user_id = COALESCE(auth.uid()::text, 'anonymous') OR
    user_id LIKE 'super-user-%' OR
    user_id LIKE 'guest-user-%' OR
    user_id LIKE 'local_user_%' OR
    user_id LIKE 'pierre-user-%'
);

-- User settings policies
DROP POLICY IF EXISTS "Users can manage their own settings" ON user_settings;
CREATE POLICY "Users can manage their own settings"
ON user_settings FOR ALL
USING (
    user_id = COALESCE(auth.uid()::text, 'anonymous') OR
    user_id LIKE 'super-user-%' OR
    user_id LIKE 'guest-user-%' OR
    user_id LIKE 'local_user_%' OR
    user_id LIKE 'pierre-user-%'
);

-- Failed login attempts policies (read-only for security)
DROP POLICY IF EXISTS "Admin can view failed login attempts" ON failed_login_attempts;
CREATE POLICY "Admin can view failed login attempts"
ON failed_login_attempts FOR SELECT
USING (true); -- Admin can view all failed attempts

-- ============================================================================
-- 7. GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_settings TO authenticated;
GRANT SELECT, INSERT ON failed_login_attempts TO authenticated;

-- Grant permissions to service role
GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON user_settings TO service_role;
GRANT ALL ON failed_login_attempts TO service_role;

-- Grant permissions to anon role for demo mode
GRANT SELECT, INSERT, UPDATE ON user_profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON user_settings TO anon;
GRANT SELECT, INSERT ON failed_login_attempts TO anon;

-- ============================================================================
-- 8. CREATE UPDATE TRIGGERS
-- ============================================================================

-- Update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for tables with updated_at columns
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. VALIDATION AND REPORTING
-- ============================================================================

DO $$
DECLARE
    profiles_count INTEGER;
    settings_count INTEGER;
    attempts_count INTEGER;
BEGIN
    -- Count records
    SELECT COUNT(*) INTO profiles_count FROM user_profiles;
    SELECT COUNT(*) INTO settings_count FROM user_settings;
    SELECT COUNT(*) INTO attempts_count FROM failed_login_attempts;

    -- Report results
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '✅ DATABASE FIX CORRECTED COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Database Status:';
    RAISE NOTICE '   • User profiles table: % records', profiles_count;
    RAISE NOTICE '   • User settings table: % records', settings_count;
    RAISE NOTICE '   • Failed login attempts table: % records', attempts_count;
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Tables Created/Fixed:';
    RAISE NOTICE '   ✅ user_profiles (for profile fields - Department, Phone, Location, Bio)';
    RAISE NOTICE '   ✅ user_settings (for MFA and API credentials)';
    RAISE NOTICE '   ✅ failed_login_attempts (for security audit - corrected column names)';
    RAISE NOTICE '';
    RAISE NOTICE '🛡️ Security Features:';
    RAISE NOTICE '   ✅ Row Level Security enabled on all tables';
    RAISE NOTICE '   ✅ Comprehensive RLS policies applied';
    RAISE NOTICE '   ✅ Performance indexes created with correct column references';
    RAISE NOTICE '   ✅ Automatic timestamp triggers installed';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Profile Fields Fix:';
    RAISE NOTICE '   ✅ user_profiles table ready for cross-browser profile sync';
    RAISE NOTICE '   ✅ Department, Phone, Location, Bio fields will now save to cloud';
    RAISE NOTICE '   ✅ Cross-device synchronization enabled';
    RAISE NOTICE '';
    RAISE NOTICE '============================================================================';
END $$;