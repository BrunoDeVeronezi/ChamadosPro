-- ============================================
-- Script para adicionar campos de cancelamento faltantes
-- Projeto: ChamadosPro
-- Execute este SQL no SQL Editor do Supabase
-- ============================================

-- Adicionar campos de cancelamento à tabela tickets
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS cancellation_source TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS cancellation_date TIMESTAMP;

-- Comentários para documentação
COMMENT ON COLUMN tickets.cancellation_source IS 'Fonte do cancelamento: CLIENTE ou TECNICO';
COMMENT ON COLUMN tickets.cancelled_at IS 'Data e hora do cancelamento';
COMMENT ON COLUMN tickets.cancellation_date IS 'Data do cancelamento (para compatibilidade)';



























