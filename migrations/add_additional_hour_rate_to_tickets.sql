-- Migration: Adicionar coluna additional_hour_rate na tabela tickets
-- Data: 2025-12-24
-- Descrição: Adiciona campo additional_hour_rate para armazenar a taxa de hora adicional por ticket

-- Adicionar campo additional_hour_rate (taxa de hora adicional)
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS additional_hour_rate DECIMAL(10, 2);

-- Comentário para documentação
COMMENT ON COLUMN tickets.additional_hour_rate IS 'Taxa de hora adicional por ticket (R$)';





