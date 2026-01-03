-- Campos de assinatura digital (cliente e tecnico) para RAT/OS
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS technician_signature_data TEXT,
  ADD COLUMN IF NOT EXISTS technician_signed_by TEXT,
  ADD COLUMN IF NOT EXISTS technician_signed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS client_signature_data TEXT,
  ADD COLUMN IF NOT EXISTS client_signed_by TEXT,
  ADD COLUMN IF NOT EXISTS client_signed_at TIMESTAMP;
