-- Marcar cadastros como completos para usuários que já têm os dados necessários
-- Isso evita que usuários que já completaram o cadastro sejam redirecionados novamente

-- Atualizar usuários que têm CPF/CNPJ e endereço completo
UPDATE users
SET profile_completed = true
WHERE 
  profile_completed = false
  AND role != 'super_admin'
  AND (
    (cpf IS NOT NULL AND cpf != '') OR 
    (cnpj IS NOT NULL AND cnpj != '')
  )
  AND zip_code IS NOT NULL 
  AND zip_code != ''
  AND street_address IS NOT NULL 
  AND street_address != '';

-- Verificar quantos usuários foram atualizados
SELECT 
  COUNT(*) as usuarios_atualizados,
  COUNT(CASE WHEN profile_completed = true THEN 1 END) as total_completos,
  COUNT(CASE WHEN profile_completed = false THEN 1 END) as total_incompletos
FROM users
WHERE role != 'super_admin';

-- Listar usuários que ainda precisam completar cadastro
SELECT 
  id,
  email,
  company_name,
  cpf,
  cnpj,
  zip_code,
  street_address,
  profile_completed
FROM users
WHERE 
  role != 'super_admin'
  AND profile_completed = false
ORDER BY email;

