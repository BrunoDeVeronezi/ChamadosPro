-- ============================================
-- Script para criar todas as tabelas do ChamadosPro
-- Projeto: ChamadosPro (oyrfnydwjpafubxvrucu)
-- Execute este SQL no SQL Editor do Supabase
-- ============================================

-- Tabela: sessions
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire);

-- Tabela: users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY,
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  role TEXT DEFAULT 'technician',
  public_slug VARCHAR UNIQUE,
  gov_br_cpf VARCHAR,
  gov_br_senha TEXT,
  gov_br_status TEXT DEFAULT 'DESCONECTADO',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela: clients
CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  logo_url TEXT,
  address TEXT DEFAULT '',
  city TEXT DEFAULT '' NOT NULL,
  state TEXT DEFAULT '' NOT NULL,
  legal_name TEXT,
  municipal_registration TEXT,
  state_registration TEXT,
  zip_code TEXT,
  street_address TEXT,
  address_number TEXT,
  address_complement TEXT,
  neighborhood TEXT,
  payment_cycle_start_day INTEGER,
  payment_cycle_end_day INTEGER,
  payment_due_day INTEGER,
  default_ticket_value DECIMAL(10, 2),
  default_hours_included INTEGER,
  default_km_rate DECIMAL(6, 2),
  default_additional_hour_rate DECIMAL(10, 2),
  monthly_spreadsheet BOOLEAN DEFAULT false,
  spreadsheet_email TEXT,
  spreadsheet_day INTEGER,
  no_show_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabela: services
CREATE TABLE IF NOT EXISTS services (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  duration INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  public_booking BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabela: tickets
CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  technician_id VARCHAR REFERENCES users(id),
  client_id VARCHAR NOT NULL REFERENCES clients(id),
  service_id VARCHAR REFERENCES services(id),
  status TEXT NOT NULL DEFAULT 'ABERTO',
  scheduled_date TIMESTAMP NOT NULL,
  scheduled_time TEXT NOT NULL,
  duration INTEGER NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  ticket_number VARCHAR,
  invoice_number TEXT,
  final_client TEXT,
  ticket_value DECIMAL(10, 2),
  charge_type TEXT,
  approved_by TEXT,
  km_rate DECIMAL(6, 2),
  service_address TEXT,
  scheduled_end_date TIMESTAMP,
  scheduled_end_time TEXT,
  travel_time_minutes INTEGER DEFAULT 30,
  buffer_time_minutes INTEGER DEFAULT 15,
  description TEXT,
  extra_hours DECIMAL(4, 2) DEFAULT '0',
  total_amount DECIMAL(10, 2),
  google_calendar_event_id TEXT,
  cancellation_reason TEXT,
  no_show BOOLEAN DEFAULT false,
  started_at TIMESTAMP,
  stopped_at TIMESTAMP,
  elapsed_seconds INTEGER,
  km_total DECIMAL(8, 2),
  extra_expenses DECIMAL(10, 2),
  expense_details TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabela: financial_records
CREATE TABLE IF NOT EXISTS financial_records (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  ticket_id VARCHAR REFERENCES tickets(id),
  client_id VARCHAR NOT NULL REFERENCES clients(id),
  amount DECIMAL(10, 2) NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TIMESTAMP NOT NULL,
  paid_at TIMESTAMP,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabela: integration_settings
CREATE TABLE IF NOT EXISTS integration_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) UNIQUE,
  google_calendar_status TEXT NOT NULL DEFAULT 'not_connected',
  google_calendar_tokens JSONB,
  google_calendar_email TEXT,
  lead_time_minutes INTEGER DEFAULT 30,
  buffer_minutes INTEGER DEFAULT 15,
  travel_minutes INTEGER DEFAULT 30,
  default_duration_hours INTEGER DEFAULT 3,
  working_days JSONB DEFAULT '[1,2,3,4,5,6]',
  working_hours JSONB DEFAULT '{"days":{"0":{"enabled":false,"start":"08:00","end":"18:00","breakEnabled":false,"breakStart":"12:00","breakEnd":"13:00"},"1":{"enabled":true,"start":"08:00","end":"18:00","breakEnabled":false,"breakStart":"12:00","breakEnd":"13:00"},"2":{"enabled":true,"start":"08:00","end":"18:00","breakEnabled":false,"breakStart":"12:00","breakEnd":"13:00"},"3":{"enabled":true,"start":"08:00","end":"18:00","breakEnabled":false,"breakStart":"12:00","breakEnd":"13:00"},"4":{"enabled":true,"start":"08:00","end":"18:00","breakEnabled":false,"breakStart":"12:00","breakEnd":"13:00"},"5":{"enabled":true,"start":"08:00","end":"18:00","breakEnabled":false,"breakStart":"12:00","breakEnd":"13:00"},"6":{"enabled":true,"start":"08:00","end":"18:00","breakEnabled":false,"breakStart":"12:00","breakEnd":"13:00"}}}',
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  reminder_24h_enabled BOOLEAN DEFAULT true,
  reminder_1h_enabled BOOLEAN DEFAULT true,
  google_sheets_status TEXT DEFAULT 'not_connected',
  whatsapp_reminders_enabled BOOLEAN DEFAULT true,
  whatsapp_reminder_hours INTEGER DEFAULT 24,
  whatsapp_message_template TEXT,
  email_reminders_config JSONB,
  google_calendar_enabled BOOLEAN DEFAULT true,
  google_calendar_sync_settings JSONB,
  stripe_public_key TEXT,
  stripe_secret_key TEXT,
  pix_key TEXT,
  pix_key_type TEXT,
  pix_account_holder TEXT,
  push_notifications_config JSONB,
  calculations_enabled BOOLEAN DEFAULT true,
  calculations_per_ticket BOOLEAN DEFAULT false,
  calculations_client_types JSONB DEFAULT '["PF", "PJ", "EMPRESA_PARCEIRA"]',
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabela: reminder_logs
CREATE TABLE IF NOT EXISTS reminder_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR NOT NULL REFERENCES tickets(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW() NOT NULL,
  error TEXT
);

-- Tabela: local_events
CREATE TABLE IF NOT EXISTS local_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  location TEXT,
  color TEXT DEFAULT '#3b82f6',
  all_day BOOLEAN DEFAULT false,
  ticket_id VARCHAR REFERENCES tickets(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ============================================
-- Desativar RLS em todas as tabelas
-- ============================================
ALTER TABLE IF EXISTS sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS financial_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS integration_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reminder_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS local_events DISABLE ROW LEVEL SECURITY;

-- ============================================
-- Verificar tabelas criadas
-- ============================================
SELECT 
  tablename,
  CASE
    WHEN c.relrowsecurity THEN 'RLS ATIVO'
    ELSE 'RLS DESATIVADO'
  END as rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
AND tablename IN ('sessions', 'users', 'clients', 'services', 'tickets', 'financial_records', 'integration_settings', 'reminder_logs', 'local_events')
ORDER BY tablename;


























