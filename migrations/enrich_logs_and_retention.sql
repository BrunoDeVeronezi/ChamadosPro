-- Migration: Enriquecer logs de exclusão e política de retenção
-- Descrição: Adiciona campos para controle de lotes e cria função de limpeza

-- 1. Adicionar colunas na tabela de logs
ALTER TABLE ticket_deletion_logs 
ADD COLUMN IF NOT EXISTS bulk_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS bulk_count INTEGER DEFAULT 1;

-- 2. Criar função para autolimpeza de logs (3 meses)
CREATE OR REPLACE FUNCTION cleanup_old_ticket_deletion_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM ticket_deletion_logs
    WHERE deleted_at < NOW() - INTERVAL '3 months';
END;
$$ LANGUAGE plpgsql;

-- 3. Comentários para documentação
COMMENT ON COLUMN ticket_deletion_logs.bulk_id IS 'ID único para agrupar exclusões feitas em lote';
COMMENT ON COLUMN ticket_deletion_logs.bulk_count IS 'Quantidade total de chamados excluídos naquela operação';





