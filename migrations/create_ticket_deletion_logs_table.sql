-- Migration: Criar tabela de logs de exclusão de tickets
-- Data: 2025-01-XX
-- Descrição: Tabela para registrar exclusões de tickets com motivo, senha validada e dados de backup

CREATE TABLE IF NOT EXISTS ticket_deletion_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  deleted_by VARCHAR NOT NULL REFERENCES users(id),
  deleted_by_email TEXT NOT NULL,
  reason TEXT NOT NULL,
  deleted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ticket_data JSONB
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_ticket_deletion_logs_ticket_id ON ticket_deletion_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_deletion_logs_deleted_by ON ticket_deletion_logs(deleted_by);
CREATE INDEX IF NOT EXISTS idx_ticket_deletion_logs_deleted_at ON ticket_deletion_logs(deleted_at);

-- Comentários para documentação
COMMENT ON TABLE ticket_deletion_logs IS 'Logs de exclusão de tickets com motivo e validação de senha';
COMMENT ON COLUMN ticket_deletion_logs.ticket_id IS 'ID do ticket excluído';
COMMENT ON COLUMN ticket_deletion_logs.deleted_by IS 'ID do usuário que excluiu';
COMMENT ON COLUMN ticket_deletion_logs.deleted_by_email IS 'Email do usuário que excluiu';
COMMENT ON COLUMN ticket_deletion_logs.reason IS 'Motivo da exclusão informado pelo usuário';
COMMENT ON COLUMN ticket_deletion_logs.deleted_at IS 'Data e hora da exclusão';
COMMENT ON COLUMN ticket_deletion_logs.ticket_data IS 'Dados do ticket antes da exclusão (backup)';





