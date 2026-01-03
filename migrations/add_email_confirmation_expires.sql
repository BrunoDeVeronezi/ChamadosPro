-- Adicionar coluna email_confirmation_expires_at na tabela users
-- Execute este script no Supabase SQL Editor

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_confirmation_expires_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para melhorar performance das consultas de limpeza
CREATE INDEX IF NOT EXISTS idx_users_email_confirmation_expires 
ON users(email_confirmation_expires_at) 
WHERE email_confirmed = false AND email_confirmation_expires_at IS NOT NULL;

-- Comentário na coluna
COMMENT ON COLUMN users.email_confirmation_expires_at IS 'Data de expiração da confirmação de email (2 horas após cadastro). Contas não confirmadas após este prazo serão deletadas automaticamente.';

