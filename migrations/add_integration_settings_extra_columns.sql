-- Add missing integration_settings columns
ALTER TABLE integration_settings
  ADD COLUMN IF NOT EXISTS google_calendar_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS google_calendar_sync_settings JSONB,
  ADD COLUMN IF NOT EXISTS google_sheets_status TEXT DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS whatsapp_reminders_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_hours INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS whatsapp_message_template TEXT,
  ADD COLUMN IF NOT EXISTS email_reminders_config JSONB,
  ADD COLUMN IF NOT EXISTS push_notifications_config JSONB;
