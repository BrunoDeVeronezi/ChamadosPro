-- ============================================
-- Script para desativar RLS em todas as tabelas
-- Projeto: ChamadosPro (oyrfnydwjpafubxvrucu)
-- Execute este SQL no SQL Editor do Supabase
-- ============================================

-- Desativar RLS em todas as tabelas
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
-- Verificar status do RLS após execução
-- ============================================
SELECT
    t.tablename,
    CASE
        WHEN c.relrowsecurity THEN 'RLS ATIVO'
        ELSE 'RLS DESATIVADO'
    END as rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
AND t.tablename IN ('sessions', 'users', 'clients', 'services', 'tickets', 'financial_records', 'integration_settings', 'reminder_logs', 'local_events')
ORDER BY t.tablename;


























