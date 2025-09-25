-- ============================================================================
-- FIX API KEY STORAGE - Add missing encrypted_api_keys column
-- ============================================================================
-- This migration adds the encrypted_api_keys column that's preventing
-- API keys from being saved to Supabase
-- ============================================================================

-- Add encrypted_api_keys column to user_settings table
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS encrypted_api_keys JSONB DEFAULT '{}'::jsonb;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_settings_encrypted_api_keys
ON user_settings USING gin (encrypted_api_keys);

-- Grant proper permissions
GRANT ALL ON user_settings TO authenticated;
GRANT ALL ON user_settings TO anon;
GRANT ALL ON user_settings TO service_role;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_settings'
AND column_name = 'encrypted_api_keys';

-- Success message
SELECT 'encrypted_api_keys column added successfully!' AS result;