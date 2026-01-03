-- Script para corrigir master admins duplicados
-- Execute este script no Supabase SQL Editor

-- 1. Encontrar todos os master admins
SELECT id, email, first_name, last_name, role, created_at
FROM users
WHERE role = 'super_admin'
ORDER BY created_at;

-- 2. Manter apenas o primeiro master admin criado (mais antigo)
-- Deletar os demais (se houver duplicados)
WITH master_admins AS (
  SELECT id, email, created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM users
  WHERE role = 'super_admin'
)
DELETE FROM user_credentials
WHERE user_id IN (
  SELECT id FROM master_admins WHERE rn > 1
);

-- Deletar usuários duplicados (manter apenas o primeiro)
WITH master_admins AS (
  SELECT id, email, created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM users
  WHERE role = 'super_admin'
)
DELETE FROM users
WHERE id IN (
  SELECT id FROM master_admins WHERE rn > 1
);

-- 3. Garantir que o master admin restante tenha o email correto
UPDATE users
SET email = 'master+super_admin@master.com'
WHERE role = 'super_admin'
  AND email != 'master+super_admin@master.com';

-- 4. Verificar resultado final
SELECT id, email, first_name, last_name, role, created_at
FROM users
WHERE role = 'super_admin';

