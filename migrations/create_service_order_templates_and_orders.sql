-- Create service order templates and service order instances (RAT/OS)
CREATE TABLE IF NOT EXISTS service_order_templates (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id VARCHAR REFERENCES clients(id),
  name TEXT NOT NULL,
  template JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_order_templates_company
  ON service_order_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_service_order_templates_client
  ON service_order_templates(client_id);

CREATE TABLE IF NOT EXISTS service_orders (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ticket_id VARCHAR NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  template_id VARCHAR REFERENCES service_order_templates(id),
  template_snapshot JSONB NOT NULL,
  field_values JSONB,
  status TEXT DEFAULT 'draft',
  signature_data TEXT,
  signed_by TEXT,
  signed_at TIMESTAMP,
  technician_signature_data TEXT,
  technician_signed_by TEXT,
  technician_signed_at TIMESTAMP,
  client_signature_data TEXT,
  client_signed_by TEXT,
  client_signed_at TIMESTAMP,
  public_token VARCHAR UNIQUE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_orders_ticket
  ON service_orders(ticket_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_company
  ON service_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_public_token
  ON service_orders(public_token);

-- Link RAT template to partner clients and tickets
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS rat_template_id VARCHAR;

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS service_order_template_id VARCHAR;
