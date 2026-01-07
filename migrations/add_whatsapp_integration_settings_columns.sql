-- Add WhatsApp integration columns to integration_settings
ALTER TABLE integration_settings
  ADD COLUMN IF NOT EXISTS whatsapp_status text DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS whatsapp_access_token text,
  ADD COLUMN IF NOT EXISTS whatsapp_token_expires_at timestamp,
  ADD COLUMN IF NOT EXISTS whatsapp_business_account_id text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number text;
