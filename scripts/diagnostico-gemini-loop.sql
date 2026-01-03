-- ============================================
-- DIAGNÓSTICO: Identificar Loop Infinito do Gemini
-- Execute este script para identificar o problema
-- ============================================

-- PASSO 1: Listar TODAS as tabelas do sistema
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- PASSO 2: Listar TODOS os triggers (mesmo que não existam)
SELECT 
    trigger_name,
    event_object_table,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- PASSO 3: Verificar funções que fazem chamadas HTTP/Edge Functions
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
WHERE p.prosrc LIKE '%http%'
   OR p.prosrc LIKE '%net.http%'
   OR p.prosrc LIKE '%edge%function%'
   OR p.prosrc LIKE '%gemini%'
   OR p.prosrc LIKE '%generativelanguage%'
ORDER BY p.proname;

-- PASSO 4: Verificar se há colunas relacionadas a IA nas tabelas principais
SELECT 
    table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    column_name LIKE '%ai%' 
    OR column_name LIKE '%gemini%'
    OR column_name LIKE '%response%'
    OR column_name LIKE '%processing%'
  )
ORDER BY table_name, column_name;

-- PASSO 5: Verificar tabelas com muitas atualizações recentes
-- (Execute para cada tabela suspeita, substituindo 'tickets' pelo nome da tabela)

-- Para tabela 'tickets':
SELECT 
    id,
    updated_at,
    status,
    EXTRACT(EPOCH FROM (NOW() - updated_at)) as seconds_ago
FROM tickets
WHERE updated_at > NOW() - INTERVAL '10 minutes'
ORDER BY updated_at DESC
LIMIT 20;

-- Para tabela 'clients':
SELECT 
    id,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - updated_at)) as seconds_ago
FROM clients
WHERE updated_at > NOW() - INTERVAL '10 minutes'
ORDER BY updated_at DESC
LIMIT 20;

-- ============================================
-- PRÓXIMOS PASSOS:
-- 1. Execute os comandos acima
-- 2. Identifique qual tabela tem o problema
-- 3. Verifique se há triggers ou Edge Functions configuradas
-- 4. Use o script fix-gemini-infinite-loop.sql adaptado para sua tabela
-- ============================================


























