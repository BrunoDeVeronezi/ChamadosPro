-- ============================================
-- Script COMPLETO para corrigir RLS
-- Remove políticas e desativa RLS em TODAS as tabelas
-- Projeto: ChamadosPro (oyrfnydwjpafubxvrucu)
-- ============================================

-- Primeiro, vamos verificar se há tabelas duplicadas ou em schemas diferentes
SELECT 
  schemaname,
  tablename,
  CASE
    WHEN c.relrowsecurity THEN 'RLS ATIVO'
    ELSE 'RLS DESATIVADO'
  END as rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE tablename IN ('sessions', 'users', 'clients', 'services', 'tickets', 'financial_records', 'integration_settings', 'reminder_logs', 'local_events')
ORDER BY schemaname, tablename;

-- Remover TODAS as políticas RLS de TODOS os schemas
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE tablename IN ('sessions', 'users', 'clients', 'services', 'tickets', 'financial_records', 'integration_settings', 'reminder_logs', 'local_events')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
        RAISE NOTICE 'Política removida: %.% - %', r.schemaname, r.tablename, r.policyname;
    END LOOP;
END $$;

-- Desativar RLS em TODAS as tabelas (incluindo possíveis duplicatas)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE tablename IN ('sessions', 'users', 'clients', 'services', 'tickets', 'financial_records', 'integration_settings', 'reminder_logs', 'local_events')
    ) LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY', r.schemaname, r.tablename);
            RAISE NOTICE 'RLS desativado: %.%', r.schemaname, r.tablename;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao desativar RLS em %.%: %', r.schemaname, r.tablename, SQLERRM;
        END;
    END LOOP;
END $$;

-- Verificar status final (apenas schema public, sem duplicatas)
SELECT DISTINCT
  t.tablename,
  CASE
    WHEN c.relrowsecurity THEN 'RLS ATIVO'
    ELSE 'RLS DESATIVADO'
  END as rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = t.schemaname)
WHERE t.schemaname = 'public'
AND t.tablename IN ('sessions', 'users', 'clients', 'services', 'tickets', 'financial_records', 'integration_settings', 'reminder_logs', 'local_events')
ORDER BY t.tablename;


























