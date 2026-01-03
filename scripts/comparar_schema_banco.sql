-- ============================================
-- SCRIPT DE COMPARAÇÃO: BANCO DE DADOS vs SCHEMA DO SISTEMA
-- Compara a estrutura real do banco com o schema esperado (shared/schema.ts)
-- ============================================

-- ============================================
-- 1. TABELAS QUE EXISTEM NO BANCO MAS NÃO ESTÃO NO SCHEMA
-- ============================================
SELECT 
    'TABELAS NO BANCO QUE NÃO ESTÃO NO SCHEMA' as tipo,
    tablename as item
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename NOT IN (
        'sessions',
        'users',
        'clients',
        'services',
        'ticket_statuses',
        'tickets',
        'financial_records',
        'vehicle_settings',
        'integration_settings',
        'reminder_logs',
        'local_events',
        'user_credentials',
        'company_technicians',
        'company_partners',
        'company_users',
        'service_order_templates',
        'technician_bank_accounts',
        'payment_schedules',
        'plan_types',
        'subscriptions'
    )
ORDER BY tablename;

-- ============================================
-- 2. TABELAS QUE ESTÃO NO SCHEMA MAS NÃO EXISTEM NO BANCO
-- ============================================
WITH tabelas_esperadas AS (
    SELECT unnest(ARRAY[
        'sessions',
        'users',
        'clients',
        'services',
        'ticket_statuses',
        'tickets',
        'financial_records',
        'vehicle_settings',
        'integration_settings',
        'reminder_logs',
        'local_events',
        'user_credentials',
        'company_technicians',
        'company_partners',
        'company_users',
        'service_order_templates',
        'technician_bank_accounts',
        'payment_schedules',
        'plan_types',
        'subscriptions'
    ]) as tabela
)
SELECT 
    'TABELAS NO SCHEMA QUE NÃO EXISTEM NO BANCO' as tipo,
    t.tabela as item
FROM tabelas_esperadas t
LEFT JOIN pg_tables pt ON pt.tablename = t.tabela AND pt.schemaname = 'public'
WHERE pt.tablename IS NULL
ORDER BY t.tabela;

-- ============================================
-- 3. COLUNAS QUE FALTAM NO BANCO (por tabela)
-- ============================================

-- Exemplo para tabela 'users'
SELECT 
    'COLUNAS FALTANDO EM: users' as tipo,
    'users' as tabela,
    expected_col as coluna_esperada,
    'FALTANDO' as status
FROM (
    SELECT unnest(ARRAY[
        'id', 'email', 'first_name', 'last_name', 'profile_image_url',
        'role', 'public_slug', 'gov_br_cpf', 'gov_br_senha', 'gov_br_status',
        'company_name', 'created_at', 'updated_at'
    ]) as expected_col
) e
LEFT JOIN information_schema.columns c 
    ON c.table_name = 'users' 
    AND c.column_name = e.expected_col
    AND c.table_schema = 'public'
WHERE c.column_name IS NULL
ORDER BY e.expected_col;

-- Exemplo para tabela 'tickets'
SELECT 
    'COLUNAS FALTANDO EM: tickets' as tipo,
    'tickets' as tabela,
    expected_col as coluna_esperada,
    'FALTANDO' as status
FROM (
    SELECT unnest(ARRAY[
        'id', 'user_id', 'technician_id', 'client_id', 'service_id',
        'status', 'scheduled_date', 'scheduled_time', 'duration',
        'address', 'city', 'state', 'ticket_number', 'invoice_number',
        'final_client', 'ticket_value', 'charge_type', 'approved_by',
        'km_rate', 'service_address', 'scheduled_end_date', 'scheduled_end_time',
        'travel_time_minutes', 'buffer_time_minutes', 'description',
        'extra_hours', 'total_amount', 'google_calendar_event_id',
        'cancellation_reason', 'no_show', 'started_at', 'stopped_at',
        'elapsed_seconds', 'km_total', 'extra_expenses', 'expense_details',
        'completed_at', 'created_at'
    ]) as expected_col
) e
LEFT JOIN information_schema.columns c 
    ON c.table_name = 'tickets' 
    AND c.column_name = e.expected_col
    AND c.table_schema = 'public'
WHERE c.column_name IS NULL
ORDER BY e.expected_col;

-- ============================================
-- 4. COLUNAS QUE EXISTEM NO BANCO MAS NÃO ESTÃO NO SCHEMA
-- ============================================

-- Exemplo para tabela 'users'
SELECT 
    'COLUNAS NO BANCO QUE NÃO ESTÃO NO SCHEMA: users' as tipo,
    'users' as tabela,
    c.column_name as coluna_banco,
    'EXTRA' as status
FROM information_schema.columns c
WHERE c.table_schema = 'public'
    AND c.table_name = 'users'
    AND c.column_name NOT IN (
        'id', 'email', 'first_name', 'last_name', 'profile_image_url',
        'role', 'public_slug', 'gov_br_cpf', 'gov_br_senha', 'gov_br_status',
        'company_name', 'created_at', 'updated_at'
    )
ORDER BY c.column_name;

-- ============================================
-- 5. VERIFICAR TIPOS DE DADOS (comparação básica)
-- ============================================

-- Verificar tipos esperados vs tipos reais para colunas específicas
SELECT 
    'COMPARAÇÃO DE TIPOS: tickets.status' as tipo,
    'tickets' as tabela,
    'status' as coluna,
    c.data_type as tipo_atual,
    'text' as tipo_esperado,
    CASE 
        WHEN c.data_type IN ('text', 'character varying', 'varchar') THEN '✅ OK'
        ELSE '⚠️ DIFERENTE'
    END as status
FROM information_schema.columns c
WHERE c.table_schema = 'public'
    AND c.table_name = 'tickets'
    AND c.column_name = 'status';

-- ============================================
-- 6. VERIFICAR CONSTRAINTS IMPORTANTES
-- ============================================

-- Verificar se há chave primária
SELECT 
    'VERIFICAÇÃO DE CHAVES PRIMÁRIAS' as tipo,
    tc.table_name as tabela,
    kcu.column_name as coluna_pk,
    CASE 
        WHEN tc.constraint_name IS NOT NULL THEN '✅ Tem PK'
        ELSE '❌ Sem PK'
    END as status
FROM information_schema.tables t
LEFT JOIN information_schema.table_constraints tc 
    ON t.table_name = tc.table_name 
    AND tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

-- ============================================
-- 7. VERIFICAR FOREIGN KEYS ESPERADAS
-- ============================================

-- Exemplo: tickets.user_id deve referenciar users.id
SELECT 
    'VERIFICAÇÃO DE FOREIGN KEYS' as tipo,
    tc.table_name as tabela_origem,
    kcu.column_name as coluna_origem,
    ccu.table_name as tabela_destino,
    ccu.column_name as coluna_destino,
    CASE 
        WHEN tc.constraint_name IS NOT NULL THEN '✅ OK'
        ELSE '❌ FALTANDO'
    END as status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'tickets'
    AND kcu.column_name = 'user_id'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================
-- 8. RELATÓRIO COMPLETO DE COMPARAÇÃO
-- ============================================

WITH 
tabelas_esperadas AS (
    SELECT unnest(ARRAY[
        'sessions', 'users', 'clients', 'services', 'ticket_statuses',
        'tickets', 'financial_records', 'vehicle_settings', 'integration_settings',
        'reminder_logs', 'local_events', 'user_credentials', 'company_technicians',
        'company_partners', 'company_users', 'service_order_templates',
        'technician_bank_accounts', 'payment_schedules', 'plan_types', 'subscriptions'
    ]) as tabela
),
tabelas_banco AS (
    SELECT tablename as tabela
    FROM pg_tables
    WHERE schemaname = 'public'
)
SELECT 
    'RESUMO DA COMPARAÇÃO' as secao,
    (SELECT COUNT(*) FROM tabelas_esperadas) as total_tabelas_esperadas,
    (SELECT COUNT(*) FROM tabelas_banco) as total_tabelas_banco,
    (SELECT COUNT(*) FROM tabelas_esperadas e 
     INNER JOIN tabelas_banco b ON e.tabela = b.tabela) as tabelas_iguais,
    (SELECT COUNT(*) FROM tabelas_banco b 
     LEFT JOIN tabelas_esperadas e ON e.tabela = b.tabela 
     WHERE e.tabela IS NULL) as tabelas_extras_banco,
    (SELECT COUNT(*) FROM tabelas_esperadas e 
     LEFT JOIN tabelas_banco b ON e.tabela = b.tabela 
     WHERE b.tabela IS NULL) as tabelas_faltando_banco;

-- ============================================
-- 9. VERIFICAÇÃO ESPECÍFICA DE COLUNAS IMPORTANTES
-- ============================================

SELECT 
    'VERIFICAÇÃO DE COLUNAS IMPORTANTES' as tipo,
    c.table_name as tabela,
    c.column_name as coluna,
    c.data_type as tipo_dado,
    c.is_nullable as permite_nulo,
    c.column_default as valor_padrao
FROM information_schema.columns c
WHERE c.table_schema = 'public'
    AND (
        (c.table_name = 'tickets' AND c.column_name IN ('status', 'scheduled_date', 'client_id', 'user_id'))
        OR (c.table_name = 'users' AND c.column_name IN ('id', 'email', 'role'))
        OR (c.table_name = 'clients' AND c.column_name IN ('id', 'user_id', 'type', 'name'))
        OR (c.table_name = 'financial_records' AND c.column_name IN ('ticket_id', 'status', 'amount'))
    )
ORDER BY c.table_name, c.column_name;

-- ============================================
-- 10. SUGESTÕES DE CORREÇÃO (SQL ALTER TABLE)
-- ============================================

-- Esta seção gera sugestões de ALTER TABLE para adicionar colunas faltantes
-- ATENÇÃO: Execute apenas após revisar cuidadosamente!

SELECT 
    'SUGESTÕES DE SQL PARA ADICIONAR COLUNAS FALTANTES' as tipo,
    '-- Execute apenas após revisar!' as aviso,
    'ALTER TABLE ' || tabela || ' ADD COLUMN IF NOT EXISTS ' || coluna || ' ' || tipo || ';' as sql_sugerido
FROM (
    -- Adicione aqui as colunas que você identificou como faltantes
    -- Exemplo:
    SELECT 'tickets' as tabela, 'updated_at' as coluna, 'timestamp' as tipo
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tickets' 
        AND column_name = 'updated_at'
    )
) sugestoes
ORDER BY tabela, coluna;

-- ============================================
-- FIM DO SCRIPT DE COMPARAÇÃO
-- ============================================













