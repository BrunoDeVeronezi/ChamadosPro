-- Migração: Adicionar campos tenantSlug, cpf, phone e endereço em users
-- Data: 2025-01-XX
-- Execute este script no Supabase SQL Editor

-- Adicionar tenant_slug
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS tenant_slug VARCHAR(255) UNIQUE;

-- Adicionar cpf
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);

-- Adicionar phone
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Adicionar campos de endereço
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS street_address TEXT,
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS address_complement TEXT,
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT;

-- Adicionar profile_completed se não existir
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false;

-- Criar índice para tenant_slug (já é UNIQUE, mas garantindo)
CREATE INDEX IF NOT EXISTS idx_users_tenant_slug ON users(tenant_slug) WHERE tenant_slug IS NOT NULL;

-- Atualizar company_data também (se necessário)
ALTER TABLE company_data 
ADD COLUMN IF NOT EXISTS cpf VARCHAR(14),
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS street_address TEXT,
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS address_complement TEXT,
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT;

-- Verificar se as colunas foram criadas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name IN ('tenant_slug', 'cpf', 'phone', 'zip_code', 'street_address', 'address_number', 'address_complement', 'neighborhood', 'city', 'state', 'profile_completed')
ORDER BY column_name;

