-- Add calculation settings to integration_settings table
ALTER TABLE integration_settings ADD COLUMN IF NOT EXISTS calculations_enabled BOOLEAN DEFAULT true;
ALTER TABLE integration_settings ADD COLUMN IF NOT EXISTS calculations_per_ticket BOOLEAN DEFAULT false;
ALTER TABLE integration_settings ADD COLUMN IF NOT EXISTS calculations_client_types JSONB DEFAULT '["PF", "PJ", "EMPRESA_PARCEIRA"]';

-- Add calculations_enabled to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS calculations_enabled BOOLEAN DEFAULT true;





