-- Add working days to integration_settings table
ALTER TABLE integration_settings
  ADD COLUMN IF NOT EXISTS working_days JSONB DEFAULT '[1,2,3,4,5,6]';
