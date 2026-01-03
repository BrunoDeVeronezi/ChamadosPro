-- ============================================
-- SCRIPT COMPLETO: Criar Empresa e Perfis de Teste
-- Execute no Supabase SQL Editor
-- ============================================

-- PASSO 1: Verificar se já existe empresa de teste
DO $$
DECLARE
    empresa_id text;
    senha_hash text;
    salt text;
BEGIN
    -- Verificar se empresa teste existe
    SELECT id INTO empresa_id
    FROM users
    WHERE email = 'empresa@teste.com'
    LIMIT 1;

    -- Se não existir, criar empresa
    IF empresa_id IS NULL THEN
        empresa_id := gen_random_uuid()::text;
        
        INSERT INTO users (
            id,
            email,
            role,
            first_name,
            last_name,
            company_name,
            created_at,
            updated_at
        ) VALUES (
            empresa_id,
            'empresa@teste.com',
            'company',
            'Empresa',
            'Teste',
            'Empresa Teste LTDA',
            now(),
            now()
        );

        -- Criar credencial para empresa (senha: 123456)
        -- Hash gerado para senha "123456"
        senha_hash := 'f43e0d9eb43c1f7387bd22117eaecf18:f7481cf6569daee7f11e464f71019977a9cc8293aae3af05df273075acd6cfeb6dfe36c3b298db626f1b6838843170f2e9f1756300a4b1c6098b9b0b11528552';
        
        INSERT INTO user_credentials (
            id,
            user_id,
            password_hash,
            provider,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            empresa_id,
            senha_hash,
            'email',
            now(),
            now()
        );

        RAISE NOTICE 'Empresa criada com ID: %', empresa_id;
    ELSE
        RAISE NOTICE 'Empresa já existe com ID: %', empresa_id;
    END IF;

    -- PASSO 2: Criar perfil operacional (senha: operacional123)
    -- Hash gerado para senha "operacional123"
    senha_hash := 'f28609d8b07843c6bea91d268d49c194:e100bd1f89b1691a3214fec073c6a9a03d62bb9d29c7e4c64246ad098f8747885348138dc08fc4b80308b8330f8ada67716d2fb823a3fafa294ab94b12ba52aa';

    INSERT INTO company_profiles (
        id,
        company_id,
        role,
        email,
        password_hash,
        active,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        empresa_id,
        'operational',
        'operacional@teste.com',
        senha_hash,
        true,
        now(),
        now()
    )
    ON CONFLICT (company_id, role) DO UPDATE
    SET
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        active = true,
        updated_at = now();

    RAISE NOTICE 'Perfil operacional criado/atualizado';

    -- PASSO 3: Criar perfil financeiro (senha: financeiro123)
    -- Hash gerado para senha "financeiro123"
    senha_hash := '762e4f8b888fcd85601e0274f939e84c:3e07c79955dd8d1d2936572c12786b887fc3f30a270906ba36198a037a46a4d5bf261973921131332e9f5f9ae1c1dcdea2b7b48ddc0a59e0beb4ba6ab6a06e48';

    INSERT INTO company_profiles (
        id,
        company_id,
        role,
        email,
        password_hash,
        active,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        empresa_id,
        'financial',
        'financeiro@teste.com',
        senha_hash,
        true,
        now(),
        now()
    )
    ON CONFLICT (company_id, role) DO UPDATE
    SET
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        active = true,
        updated_at = now();

    RAISE NOTICE 'Perfil financeiro criado/atualizado';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CREDENCIAIS DE TESTE:';
    RAISE NOTICE 'Empresa: empresa@teste.com / 123456';
    RAISE NOTICE 'Operacional: operacional@teste.com / operacional123';
    RAISE NOTICE 'Financeiro: financeiro@teste.com / financeiro123';
    RAISE NOTICE '========================================';
END $$;

-- PASSO 4: Verificar o que foi criado
SELECT 
    'Empresa' as tipo,
    u.id,
    u.email,
    u.role,
    u.company_name
FROM users u
WHERE u.email = 'empresa@teste.com'

UNION ALL

SELECT 
    'Perfil Operacional' as tipo,
    cp.id,
    cp.email,
    cp.role,
    u.company_name
FROM company_profiles cp
JOIN users u ON cp.company_id = u.id
WHERE cp.email = 'operacional@teste.com'

UNION ALL

SELECT 
    'Perfil Financeiro' as tipo,
    cp.id,
    cp.email,
    cp.role,
    u.company_name
FROM company_profiles cp
JOIN users u ON cp.company_id = u.id
WHERE cp.email = 'financeiro@teste.com';

