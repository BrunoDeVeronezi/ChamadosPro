ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trial_device_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_ip TEXT,
  ADD COLUMN IF NOT EXISTS trial_claimed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_trial_device_id
  ON users (trial_device_id);

CREATE INDEX IF NOT EXISTS idx_users_trial_ip
  ON users (trial_ip);
