-- Add missing columns to integration_settings
ALTER TABLE integration_settings
  ADD COLUMN IF NOT EXISTS working_days JSONB DEFAULT '[1,2,3,4,5,6]',
  ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{"days":{"0":{"enabled":false,"start":"08:00","end":"18:00","breakEnabled":false,"breakStart":"12:00","breakEnd":"13:00"},"1":{"enabled":true,"start":"08:00","end":"18:00","breakEnabled":false,"breakStart":"12:00","breakEnd":"13:00"},"2":{"enabled":true,"start":"08:00","end":"18:00","breakEnabled":false,"breakStart":"12:00","breakEnd":"13:00"},"3":{"enabled":true,"start":"08:00","end":"18:00","breakEnabled":false,"breakStart":"12:00","breakEnd":"13:00"},"4":{"enabled":true,"start":"08:00","end":"18:00","breakEnabled":false,"breakStart":"12:00","breakEnd":"13:00"},"5":{"enabled":true,"start":"08:00","end":"18:00","breakEnabled":false,"breakStart":"12:00","breakEnd":"13:00"},"6":{"enabled":true,"start":"08:00","end":"18:00","breakEnabled":false,"breakStart":"12:00","breakEnd":"13:00"}}}';

ALTER TABLE integration_settings
  ADD COLUMN IF NOT EXISTS google_sheets_status TEXT DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS whatsapp_reminders_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_hours INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS whatsapp_message_template TEXT,
  ADD COLUMN IF NOT EXISTS email_reminders_config JSONB,
  ADD COLUMN IF NOT EXISTS google_calendar_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS google_calendar_sync_settings JSONB,
  ADD COLUMN IF NOT EXISTS stripe_public_key TEXT,
  ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT,
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS pix_key_type TEXT,
  ADD COLUMN IF NOT EXISTS pix_account_holder TEXT,
  ADD COLUMN IF NOT EXISTS push_notifications_config JSONB,
  ADD COLUMN IF NOT EXISTS calculations_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS calculations_per_ticket BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS calculations_client_types JSONB DEFAULT '["PF", "PJ", "EMPRESA_PARCEIRA"]';
