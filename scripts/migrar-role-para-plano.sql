-- Script de migração: Converter role (technician/company) para planType (tech/empresa)
-- O campo 'role' agora armazena o plano do usuário

-- 1. Atualizar technician -> tech
UPDATE users 
SET role = 'tech' 
WHERE role = 'technician';

-- 2. Atualizar company -> empresa
UPDATE users 
SET role = 'empresa' 
WHERE role = 'company';

-- 3. Manter super_admin como está
-- super_admin permanece como 'super_admin'

-- 4. Verificar resultados
SELECT 
  role,
  COUNT(*) as total
FROM users
GROUP BY role
ORDER BY role;

-- Nota: Perfis (operational/financial) não estão na tabela users,
-- estão em company_profiles. Eles não precisam ser migrados.


