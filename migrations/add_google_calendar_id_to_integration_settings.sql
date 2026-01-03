-- Add default Google Calendar ID for agenda selection
ALTER TABLE integration_settings
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;
