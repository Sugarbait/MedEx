-- Add missing columns to existing audit_logs table for login history functionality
-- This migration safely adds columns that may be missing from the current schema

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add user_name column (encrypted user name for cross-device access)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
    AND column_name = 'user_name'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN user_name TEXT;
    COMMENT ON COLUMN public.audit_logs.user_name IS 'Encrypted user name for login history cross-device access';
  END IF;

  -- Add user_role column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
    AND column_name = 'user_role'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN user_role TEXT;
  END IF;

  -- Add resource_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
    AND column_name = 'resource_id'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN resource_id TEXT;
  END IF;

  -- Add phi_accessed column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
    AND column_name = 'phi_accessed'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN phi_accessed BOOLEAN DEFAULT false;
  END IF;

  -- Add source_ip column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
    AND column_name = 'source_ip'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN source_ip TEXT;
  END IF;

  -- Add user_agent column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
    AND column_name = 'user_agent'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN user_agent TEXT;
  END IF;

  -- Add session_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
    AND column_name = 'session_id'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN session_id TEXT;
  END IF;

  -- Add failure_reason column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
    AND column_name = 'failure_reason'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN failure_reason TEXT;
  END IF;

  -- Add additional_info column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
    AND column_name = 'additional_info'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN additional_info JSONB;
  END IF;

  -- Add created_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

END $$;

-- Ensure RLS is enabled
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create missing indexes for performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_outcome ON public.audit_logs(outcome);

-- Update table comment
COMMENT ON TABLE public.audit_logs IS 'HIPAA-compliant audit trail for all user actions and system events with cross-device login history support';