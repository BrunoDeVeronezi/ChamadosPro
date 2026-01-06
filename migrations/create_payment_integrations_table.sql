-- Create payment_integrations table for PSP/OAuth connections
CREATE TABLE IF NOT EXISTS payment_integrations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  scope TEXT,
  provider_user_id TEXT,
  public_key TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_integrations_user_provider
  ON payment_integrations(user_id, provider);

CREATE INDEX IF NOT EXISTS idx_payment_integrations_provider_user
  ON payment_integrations(provider_user_id);

CREATE INDEX IF NOT EXISTS idx_payment_integrations_status
  ON payment_integrations(status);
