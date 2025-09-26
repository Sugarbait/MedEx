-- Create audit_logs table for HIPAA-compliant audit logging
-- This table stores all user actions and system events for compliance and login history

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  user_name TEXT, -- Encrypted user name for cross-device access
  user_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  phi_accessed BOOLEAN DEFAULT false,
  source_ip TEXT,
  user_agent TEXT,
  session_id TEXT,
  outcome TEXT NOT NULL,
  failure_reason TEXT,
  additional_info JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security for HIPAA compliance
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (only if they don't exist)
DO $$
BEGIN
  -- Policy for users to access their own audit logs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs'
    AND policyname = 'Users can view their own audit logs'
  ) THEN
    CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
      FOR SELECT USING (user_id = auth.uid()::text);
  END IF;

  -- Policy for admin users to view all audit logs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs'
    AND policyname = 'Admins can view all audit logs'
  ) THEN
    CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id::text = auth.uid()::text
          AND users.role IN ('super_user', 'admin')
        )
      );
  END IF;

  -- Policy for inserting audit logs (system can insert)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs'
    AND policyname = 'System can insert audit logs'
  ) THEN
    CREATE POLICY "System can insert audit logs" ON public.audit_logs
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_outcome ON public.audit_logs(outcome);

-- Add comments for documentation
COMMENT ON TABLE public.audit_logs IS 'HIPAA-compliant audit trail for all user actions and system events';
COMMENT ON COLUMN public.audit_logs.user_name IS 'Encrypted user name for login history cross-device access';
COMMENT ON COLUMN public.audit_logs.phi_accessed IS 'Boolean flag indicating if PHI was accessed during this action';
COMMENT ON COLUMN public.audit_logs.additional_info IS 'JSON field for storing additional audit context and metadata';