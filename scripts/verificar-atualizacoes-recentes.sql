-- ============================================
-- VERIFICAR ATUALIZAÇÕES RECENTES - Identificar Loop
-- Execute este script para ver se há atualizações repetidas
-- ============================================

-- NOTA: As tabelas não têm coluna updated_at, então usamos created_at e outras timestamps
-- Para identificar loops, verificamos registros recentes e mudanças de status

-- Verificar registros recentes na tabela TICKETS
-- Se você ver muitas mudanças de status ou atualizações, pode ser um loop
SELECT 
    id,
    status,
    created_at,
    started_at,
    stopped_at,
    completed_at,
    EXTRACT(EPOCH FROM (NOW() - created_at)) as seconds_since_created,
    description,
    expense_details
FROM tickets
WHERE created_at > NOW() - INTERVAL '10 minutes'
   OR started_at > NOW() - INTERVAL '10 minutes'
   OR stopped_at > NOW() - INTERVAL '10 minutes'
   OR completed_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 50;

-- Verificar registros recentes na tabela CLIENTS
SELECT 
    id,
    name,
    type,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at)) as seconds_since_created,
    email,
    spreadsheet_email
FROM clients
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 50;

-- Verificar tickets com múltiplas mudanças de status recentes
-- (indica possível processamento repetido)
SELECT 
    id,
    status,
    created_at,
    started_at,
    stopped_at,
    completed_at,
    CASE 
        WHEN started_at IS NOT NULL AND stopped_at IS NOT NULL THEN 'CONCLUÍDO'
        WHEN started_at IS NOT NULL THEN 'EM ANDAMENTO'
        ELSE 'ABERTO'
    END as estado_atual
FROM tickets
WHERE (started_at > NOW() - INTERVAL '10 minutes'
   OR stopped_at > NOW() - INTERVAL '10 minutes'
   OR completed_at > NOW() - INTERVAL '10 minutes')
ORDER BY COALESCE(completed_at, stopped_at, started_at, created_at) DESC
LIMIT 50;

-- ============================================
-- INTERPRETAÇÃO DOS RESULTADOS:
-- ============================================
-- Se você ver:
-- - Muitas atualizações da mesma linha (update_count > 10)
-- - Atualizações muito rápidas (duration_seconds < 60)
-- - Muitas linhas sendo atualizadas repetidamente
-- 
-- Isso indica um LOOP INFINITO!
-- 
-- Próximos passos:
-- 1. Verificar Edge Functions no painel do Supabase
-- 2. Verificar Webhooks configurados
-- 3. Verificar logs de Edge Functions
-- ============================================

