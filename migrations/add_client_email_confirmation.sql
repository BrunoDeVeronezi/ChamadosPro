-- Add email confirmation fields to clients
-- Run this in the Supabase SQL Editor if needed

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_confirmation_token TEXT,
ADD COLUMN IF NOT EXISTS email_confirmation_expires_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_clients_email_confirmation_expires
ON clients(email_confirmation_expires_at)
WHERE email_confirmed = false AND email_confirmation_expires_at IS NOT NULL;

COMMENT ON COLUMN clients.email_confirmation_expires_at IS
  'Email confirmation expiration timestamp (clients).';
