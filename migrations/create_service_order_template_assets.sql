-- Assets (logos/imagens) para templates de ordem de servico
CREATE TABLE IF NOT EXISTS service_order_template_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id VARCHAR REFERENCES users(id),
  template_id VARCHAR REFERENCES service_order_templates(id),
  component_id VARCHAR NOT NULL,
  asset_type VARCHAR NOT NULL,
  file_name TEXT,
  storage_path TEXT,
  public_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_order_template_assets_company
  ON service_order_template_assets(company_id);

CREATE INDEX IF NOT EXISTS idx_service_order_template_assets_template
  ON service_order_template_assets(template_id);

CREATE INDEX IF NOT EXISTS idx_service_order_template_assets_component
  ON service_order_template_assets(component_id);
