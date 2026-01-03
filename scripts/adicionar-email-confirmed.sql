-- Script para adicionar coluna email_confirmed na tabela users
-- Execute este script no Supabase SQL Editor

-- Adicionar coluna se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'email_confirmed'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN email_confirmed BOOLEAN DEFAULT false;
        
        -- Atualizar usuários existentes: se já têm senha local, considerar email confirmado
        UPDATE users 
        SET email_confirmed = true
        WHERE id IN (
            SELECT DISTINCT user_id 
            FROM user_credentials 
            WHERE provider = 'email'
        );
        
        RAISE NOTICE 'Coluna email_confirmed adicionada com sucesso!';
    ELSE
        RAISE NOTICE 'Coluna email_confirmed já existe.';
    END IF;
END $$;

-- Verificar resultado
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns
WHERE table_name = 'users' 
AND column_name = 'email_confirmed';

