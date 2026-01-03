-- ============================================
-- Script para FORÇAR desativação de RLS
-- Use este script se algumas tabelas ainda estiverem com RLS ATIVO
-- Projeto: ChamadosPro (oyrfnydwjpafubxvrucu)
-- ============================================

-- Remover TODAS as políticas RLS existentes automaticamente
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('sessions', 'users', 'clients', 'services', 'tickets', 'financial_records', 'integration_settings', 'reminder_logs', 'local_events')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Desativar RLS explicitamente em todas as tabelas (sem IF EXISTS para forçar)
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE financial_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE integration_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE local_events DISABLE ROW LEVEL SECURITY;

-- Verificar novamente o status
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


























