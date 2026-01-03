-- ============================================
-- CORREÇÃO: Loop Infinito Gemini - Tabela TICKETS
-- Use este script se o problema estiver na tabela 'tickets'
-- ============================================

-- PASSO 1: Adicionar colunas de controle (se não existirem)
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS ai_response TEXT,
ADD COLUMN IF NOT EXISTS ai_processing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMP;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_tickets_ai_processing
ON tickets(ai_processing)
WHERE ai_processing = true;

-- PASSO 2: Verificar triggers existentes na tabela tickets
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'tickets'
  AND event_object_schema = 'public';

-- PASSO 3: Desabilitar triggers problemáticos (TEMPORÁRIO - EMERGÊNCIA)
-- ⚠️ DESCOMENTE APENAS SE PRECISAR PARAR O LOOP AGORA
-- ALTER TABLE tickets DISABLE TRIGGER ALL;

-- PASSO 4: Resetar flags de processamento travadas
UPDATE tickets
SET ai_processing = false
WHERE ai_processing = true
  AND updated_at < NOW() - INTERVAL '10 minutes';

-- PASSO 5: Verificar registros em loop
SELECT 
    id,
    ai_processing,
    ai_processed_at,
    updated_at,
    status,
    CASE
        WHEN ai_processing = true AND updated_at < NOW() - INTERVAL '5 minutes'
        THEN '⚠️ POSSÍVEL LOOP'
        ELSE '✅ OK'
    END as status_loop
FROM tickets
WHERE ai_processing = true
ORDER BY updated_at DESC
LIMIT 20;

-- ============================================
-- NOTA: Para criar o trigger corrigido, você precisa:
-- 1. Identificar qual Edge Function está sendo chamada
-- 2. Adaptar o código do trigger conforme SOLUCAO_LOOP_INFINITO_GEMINI.md
-- 3. Substituir 'sua_tabela' por 'tickets' no código do trigger
-- ============================================


























