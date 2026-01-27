-- Add missing column to existing audit_logs table
ALTER TABLE private.audit_logs ADD COLUMN IF NOT EXISTS is_security_log BOOLEAN DEFAULT false;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON private.audit_logs(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_security ON private.audit_logs(is_security_log) WHERE is_security_log = true;