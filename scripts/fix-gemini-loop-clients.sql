-- ============================================
-- CORREÇÃO: Loop Infinito Gemini - Tabela CLIENTS
-- Use este script se o problema estiver na tabela 'clients'
-- ============================================

-- PASSO 1: Adicionar colunas de controle (se não existirem)
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS ai_response TEXT,
ADD COLUMN IF NOT EXISTS ai_processing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMP;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_clients_ai_processing
ON clients(ai_processing)
WHERE ai_processing = true;

-- PASSO 2: Verificar triggers existentes na tabela clients
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'clients'
  AND event_object_schema = 'public';

-- PASSO 3: Desabilitar triggers problemáticos (TEMPORÁRIO - EMERGÊNCIA)
-- ⚠️ DESCOMENTE APENAS SE PRECISAR PARAR O LOOP AGORA
-- ALTER TABLE clients DISABLE TRIGGER ALL;

-- PASSO 4: Resetar flags de processamento travadas
UPDATE clients
SET ai_processing = false
WHERE ai_processing = true
  AND updated_at < NOW() - INTERVAL '10 minutes';

-- PASSO 5: Verificar registros em loop
SELECT 
    id,
    ai_processing,
    ai_processed_at,
    CASE
        WHEN ai_processing = true AND updated_at < NOW() - INTERVAL '5 minutes'
        THEN '⚠️ POSSÍVEL LOOP'
        ELSE '✅ OK'
    END as status_loop
FROM clients
WHERE ai_processing = true
ORDER BY updated_at DESC
LIMIT 20;

-- ============================================
-- NOTA: Para criar o trigger corrigido, você precisa:
-- 1. Identificar qual Edge Function está sendo chamada
-- 2. Adaptar o código do trigger conforme SOLUCAO_LOOP_INFINITO_GEMINI.md
-- 3. Substituir 'sua_tabela' por 'clients' no código do trigger
-- ============================================


























