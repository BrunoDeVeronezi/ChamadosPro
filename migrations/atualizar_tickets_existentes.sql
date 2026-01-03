-- Script para atualizar tickets existentes com dados padrão
-- Este script atualiza tickets CONCLUÍDO que não têm due_date, payment_date, etc.
-- Data: 2025-01-XX

-- ============================================================
-- 1. ATUALIZAR payment_date com stopped_at para tickets CONCLUÍDO
-- ============================================================

UPDATE tickets
SET payment_date = stopped_at
WHERE status = 'CONCLUÍDO'
  AND payment_date IS NULL
  AND stopped_at IS NOT NULL;

-- Mostrar quantos foram atualizados
SELECT 
    COUNT(*) AS tickets_atualizados_payment_date
FROM tickets
WHERE status = 'CONCLUÍDO'
  AND payment_date IS NOT NULL
  AND payment_date = stopped_at;

-- ============================================================
-- 2. ATUALIZAR due_date baseado no scheduled_date + 30 dias
-- (ou usar a lógica do ciclo de pagamento do cliente se disponível)
-- ============================================================

-- Para tickets CONCLUÍDO sem due_date, calcular como scheduled_date + 30 dias
UPDATE tickets
SET due_date = scheduled_date + INTERVAL '30 days'
WHERE status = 'CONCLUÍDO'
  AND due_date IS NULL
  AND scheduled_date IS NOT NULL;

-- Mostrar quantos foram atualizados
SELECT 
    COUNT(*) AS tickets_atualizados_due_date
FROM tickets
WHERE status = 'CONCLUÍDO'
  AND due_date IS NOT NULL;

-- ============================================================
-- 3. VERIFICAR RESULTADO FINAL
-- ============================================================

SELECT 
    status,
    COUNT(*) AS total,
    COUNT(CASE WHEN due_date IS NOT NULL THEN 1 END) AS com_due_date,
    COUNT(CASE WHEN payment_date IS NOT NULL THEN 1 END) AS com_payment_date,
    COUNT(CASE WHEN final_client IS NOT NULL AND final_client != '' THEN 1 END) AS com_final_client,
    COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) AS com_description
FROM tickets
WHERE status = 'CONCLUÍDO'
GROUP BY status;

-- ============================================================
-- 4. MOSTRAR TICKETS ATUALIZADOS
-- ============================================================

SELECT 
    id,
    ticket_number,
    status,
    scheduled_date,
    stopped_at,
    due_date,
    payment_date,
    final_client,
    LEFT(description, 50) AS description_preview
FROM tickets
WHERE status = 'CONCLUÍDO'
  AND (due_date IS NOT NULL OR payment_date IS NOT NULL)
ORDER BY stopped_at DESC
LIMIT 10;





