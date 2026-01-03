-- Script SQL para corrigir os roles dos usuários padrão
-- Execute este SQL no SQL Editor do Supabase

-- Corrigir role do usuário empresa para 'company'
UPDATE public.users
SET role = 'company', updated_at = NOW()
WHERE email = 'empresa@empresa.com' AND role != 'company';

-- Corrigir role do usuário técnico para 'technician'
UPDATE public.users
SET role = 'technician', updated_at = NOW()
WHERE email = 'tecnico@tecnico.com' AND role != 'technician';

-- Verificar os roles após a correção
SELECT email, role, first_name, last_name
FROM public.users
WHERE email IN ('empresa@empresa.com', 'tecnico@tecnico.com')
ORDER BY email;



















