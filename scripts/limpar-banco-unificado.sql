-- ============================================
-- SCRIPT DE LIMPEZA E ADEQUAÇÃO DO BANCO
-- Modelo Unificado: Tenant único com 2 perfis fixos
-- ============================================

-- ============================================
-- PARTE 1: REMOVER TABELAS OBSOLETAS
-- ============================================

-- Remover tabelas de colaboradores múltiplos (substituídas por company_profiles)
DROP TABLE IF EXISTS company_users CASCADE;

-- Remover tabela de parceiros (redundante com clients tipo EMPRESA_PARCEIRA)
DROP TABLE IF EXISTS company_partners CASCADE;

-- Remover tabela de técnicos parceiros (será integrado ao modelo unificado)
DROP TABLE IF EXISTS company_technicians CASCADE;

-- Remover contas bancárias de técnicos (se não for mais necessário)
DROP TABLE IF EXISTS technician_bank_accounts CASCADE;

-- Remover templates de ordem de serviço (se não for mais necessário)
DROP TABLE IF EXISTS service_order_templates CASCADE;

-- ============================================
-- PARTE 2: VERIFICAR E AJUSTAR company_profiles
-- ============================================

-- Garantir que company_profiles existe e está correta
CREATE TABLE IF NOT EXISTS company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('operational', 'financial')),
  email text NOT NULL,
  password_hash text,
  active boolean NOT NULL DEFAULT true,
  permissions jsonb,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS ux_company_profiles_company_role
  ON company_profiles (company_id, role);

CREATE UNIQUE INDEX IF NOT EXISTS ux_company_profiles_email
  ON company_profiles (lower(email));

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION company_profiles_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_profiles_set_updated_at ON company_profiles;
CREATE TRIGGER trg_company_profiles_set_updated_at
BEFORE UPDATE ON company_profiles
FOR EACH ROW EXECUTE FUNCTION company_profiles_set_updated_at();

-- ============================================
-- PARTE 3: LIMPAR DADOS DE TESTE (OPCIONAL)
-- ============================================

-- Limpar dados de teste (descomente se quiser limpar tudo)
-- TRUNCATE TABLE clients CASCADE;
-- TRUNCATE TABLE tickets CASCADE;
-- TRUNCATE TABLE services CASCADE;
-- TRUNCATE TABLE financial_records CASCADE;
-- TRUNCATE TABLE local_events CASCADE;
-- TRUNCATE TABLE reminder_logs CASCADE;
-- TRUNCATE TABLE payment_schedules CASCADE;
-- TRUNCATE TABLE integration_settings CASCADE;
-- TRUNCATE TABLE vehicle_settings CASCADE;
-- TRUNCATE TABLE company_data CASCADE;
-- TRUNCATE TABLE company_profiles CASCADE;
-- TRUNCATE TABLE subscriptions CASCADE;
-- TRUNCATE TABLE user_credentials CASCADE;
-- TRUNCATE TABLE users CASCADE;

-- ============================================
-- PARTE 4: VERIFICAR ESTRUTURA FINAL
-- ============================================

-- Listar tabelas restantes
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = t.table_name 
     AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

