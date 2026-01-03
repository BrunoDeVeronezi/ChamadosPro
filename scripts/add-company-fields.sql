-- Script para adicionar campos de empresa ao schema de users
-- Execute este script no Supabase SQL Editor

ALTER TABLE users
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_logo_url TEXT;

-- Comentários para documentação
COMMENT ON COLUMN users.company_name IS 'Nome da empresa do tenant (para SaaS multi-tenant)';
COMMENT ON COLUMN users.company_logo_url IS 'URL da logo da empresa do tenant';



























