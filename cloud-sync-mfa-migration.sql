-- 🔄 Cloud-Synced MFA Database Migration
-- Adds cloud synchronization capabilities to existing MFA infrastructure
-- Run this in your Supabase SQL Editor

-- Step 1: Add synced_at column to user_totp table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_totp' AND column_name = 'synced_at') THEN
        ALTER TABLE user_totp ADD COLUMN synced_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added synced_at column to user_totp table';
    ELSE
        RAISE NOTICE 'synced_at column already exists in user_totp table';
    END IF;
END $$;

-- Step 2: Convert backup_codes from TEXT[] to JSONB for better cloud sync compatibility
DO $$
BEGIN
    -- Check if backup_codes is still TEXT[]
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_totp'
        AND column_name = 'backup_codes'
        AND data_type = 'ARRAY'
    ) THEN
        -- Create temporary column
        ALTER TABLE user_totp ADD COLUMN backup_codes_temp JSONB;

        -- Convert existing data
        UPDATE user_totp
        SET backup_codes_temp = to_jsonb(backup_codes)
        WHERE backup_codes IS NOT NULL;

        -- Drop old column and rename new one
        ALTER TABLE user_totp DROP COLUMN backup_codes;
        ALTER TABLE user_totp RENAME COLUMN backup_codes_temp TO backup_codes;

        -- Set default value
        ALTER TABLE user_totp ALTER COLUMN backup_codes SET DEFAULT '[]'::jsonb;

        RAISE NOTICE 'Converted backup_codes from TEXT[] to JSONB';
    ELSE
        RAISE NOTICE 'backup_codes column is already JSONB or does not exist';
    END IF;
END $$;

-- Step 3: Ensure user_totp table has all required columns
DO $$
BEGIN
    -- Check and add missing columns one by one
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_totp' AND column_name = 'id') THEN
        ALTER TABLE user_totp ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
        RAISE NOTICE 'Added id column to user_totp table';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_totp' AND column_name = 'user_id') THEN
        ALTER TABLE user_totp ADD COLUMN user_id TEXT NOT NULL;
        RAISE NOTICE 'Added user_id column to user_totp table';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_totp' AND column_name = 'encrypted_secret') THEN
        ALTER TABLE user_totp ADD COLUMN encrypted_secret TEXT NOT NULL;
        RAISE NOTICE 'Added encrypted_secret column to user_totp table';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_totp' AND column_name = 'enabled') THEN
        ALTER TABLE user_totp ADD COLUMN enabled BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added enabled column to user_totp table';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_totp' AND column_name = 'created_at') THEN
        ALTER TABLE user_totp ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added created_at column to user_totp table';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_totp' AND column_name = 'last_used_at') THEN
        ALTER TABLE user_totp ADD COLUMN last_used_at TIMESTAMPTZ;
        RAISE NOTICE 'Added last_used_at column to user_totp table';
    END IF;
END $$;

-- Step 4: Ensure proper constraints and indexes
DO $$
BEGIN
    -- Add unique constraint on user_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'user_totp'
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'user_totp_user_id_key'
    ) THEN
        ALTER TABLE user_totp ADD CONSTRAINT user_totp_user_id_key UNIQUE (user_id);
        RAISE NOTICE 'Added unique constraint on user_id';
    END IF;
END $$;

-- Step 5: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_totp_user_id ON user_totp(user_id);
CREATE INDEX IF NOT EXISTS idx_user_totp_enabled ON user_totp(enabled);
CREATE INDEX IF NOT EXISTS idx_user_totp_synced_at ON user_totp(synced_at);

-- Step 6: Update existing records to have synced_at timestamp
UPDATE user_totp
SET synced_at = COALESCE(synced_at, created_at, NOW())
WHERE synced_at IS NULL;

-- Now run the upsert function creation from the migration file