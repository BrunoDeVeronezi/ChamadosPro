-- Vincular templates de OS a clientes parceiros
ALTER TABLE service_order_templates
  ADD COLUMN IF NOT EXISTS client_id VARCHAR REFERENCES clients(id);

CREATE INDEX IF NOT EXISTS idx_service_order_templates_client
  ON service_order_templates(client_id);
