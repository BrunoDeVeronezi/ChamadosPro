-- ============================================
-- RESUMO FORMATADO DA ESTRUTURA DO BANCO
-- Gera um resumo estruturado para comparação e documentação
-- ============================================

-- ============================================
-- ESTRUTURA COMPLETA EM FORMATO ESTRUTURADO
-- ============================================

-- Para cada tabela, listar todas as informações de forma organizada
SELECT 
    '=== ' || UPPER(t.table_name) || ' ===' as secao,
    '' as coluna,
    '' as tipo,
    '' as constraints,
    '' as relacionamentos
FROM information_schema.tables t
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

-- ============================================
-- LISTAGEM DETALHADA POR TABELA
-- ============================================

-- Esta query gera uma lista formatada de cada tabela com suas colunas
SELECT 
    t.table_name as "Tabela",
    c.column_name as "Coluna",
    c.ordinal_position as "#",
    c.data_type || 
    CASE 
        WHEN c.character_maximum_length IS NOT NULL 
            THEN '(' || c.character_maximum_length || ')'
        WHEN c.numeric_precision IS NOT NULL 
            THEN '(' || c.numeric_precision || 
            CASE WHEN c.numeric_scale IS NOT NULL 
                THEN ',' || c.numeric_scale 
                ELSE '' 
            END || ')'
        ELSE ''
    END as "Tipo",
    CASE 
        WHEN c.is_nullable = 'YES' THEN 'NULL'
        ELSE 'NOT NULL'
    END as "Nulo",
    COALESCE(c.column_default, '-') as "Padrão",
    CASE 
        WHEN pk.column_name IS NOT NULL THEN 'PK'
        WHEN fk.column_name IS NOT NULL THEN 'FK → ' || fk.referenced_table || '.' || fk.referenced_column
        WHEN uq.column_name IS NOT NULL THEN 'UNIQUE'
        ELSE ''
    END as "Constraints"
FROM information_schema.tables t
JOIN information_schema.columns c 
    ON t.table_name = c.table_name
LEFT JOIN (
    SELECT 
        kcu.table_name,
        kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
LEFT JOIN (
    SELECT 
        kcu.table_name,
        kcu.column_name,
        ccu.table_name as referenced_table,
        ccu.column_name as referenced_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
LEFT JOIN (
    SELECT 
        kcu.table_name,
        kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'
) uq ON c.table_name = uq.table_name AND c.column_name = uq.column_name
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- ============================================
-- MAPA DE RELACIONAMENTOS (DIAGRAMA TEXTO)
-- ============================================

SELECT 
    '========================================' as separador,
    'MAPA DE RELACIONAMENTOS' as titulo,
    '========================================' as separador2;

SELECT
    tc.table_name || '.' || kcu.column_name || 
    ' → ' || 
    ccu.table_name || '.' || ccu.column_name as relacionamento
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================
-- CHECKLIST DE TABELAS ESPERADAS
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
    CASE 
        WHEN pt.tablename IS NOT NULL THEN '✅'
        ELSE '❌'
    END as status,
    e.tabela as "Tabela",
    CASE 
        WHEN pt.tablename IS NOT NULL THEN 'Existe'
        ELSE 'FALTANDO'
    END as observacao,
    COALESCE(
        (SELECT COUNT(*) 
         FROM information_schema.columns 
         WHERE table_schema = 'public' 
         AND table_name = e.tabela),
        0
    ) as total_colunas
FROM tabelas_esperadas e
LEFT JOIN pg_tables pt 
    ON pt.tablename = e.tabela 
    AND pt.schemaname = 'public'
ORDER BY 
    CASE WHEN pt.tablename IS NULL THEN 0 ELSE 1 END,
    e.tabela;

-- ============================================
-- RESUMO EXECUTIVO
-- ============================================

SELECT 
    '========================================' as separador,
    'RESUMO EXECUTIVO' as titulo,
    '========================================' as separador2;

SELECT 
    'Total de Tabelas' as metrica,
    COUNT(*)::text as valor
FROM pg_tables
WHERE schemaname = 'public'
UNION ALL
SELECT 
    'Total de Colunas' as metrica,
    COUNT(*)::text as valor
FROM information_schema.columns
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'Total de Chaves Primárias' as metrica,
    COUNT(*)::text as valor
FROM information_schema.table_constraints
WHERE table_schema = 'public'
    AND constraint_type = 'PRIMARY KEY'
UNION ALL
SELECT 
    'Total de Chaves Estrangeiras' as metrica,
    COUNT(*)::text as valor
FROM information_schema.table_constraints
WHERE table_schema = 'public'
    AND constraint_type = 'FOREIGN KEY'
UNION ALL
SELECT 
    'Total de Constraints Unique' as metrica,
    COUNT(*)::text as valor
FROM information_schema.table_constraints
WHERE table_schema = 'public'
    AND constraint_type = 'UNIQUE'
UNION ALL
SELECT 
    'Total de Índices' as metrica,
    COUNT(*)::text as valor
FROM pg_indexes
WHERE schemaname = 'public'
UNION ALL
SELECT 
    'Total de Registros' as metrica,
    SUM(n_live_tup)::text as valor
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY metrica;

-- ============================================
-- TABELAS POR ORDEM DE IMPORTÂNCIA/RELAÇÃO
-- ============================================

SELECT 
    '========================================' as separador,
    'TABELAS POR DEPENDÊNCIA' as titulo,
    '========================================' as separador2;

-- Tabelas base (sem dependências de outras tabelas)
SELECT 
    'Nível 1 - Tabelas Base' as nivel,
    tablename as tabela,
    'Sem dependências' as observacao
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('sessions', 'users', 'plan_types')
ORDER BY tablename

UNION ALL

-- Tabelas que dependem apenas de tabelas base
SELECT 
    'Nível 2 - Tabelas Dependentes' as nivel,
    tablename as tabela,
    'Depende de tabelas base' as observacao
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('clients', 'services', 'user_credentials', 'vehicle_settings', 'integration_settings', 'subscriptions')
ORDER BY tablename

UNION ALL

-- Tabelas que dependem de múltiplas outras
SELECT 
    'Nível 3 - Tabelas Complexas' as nivel,
    tablename as tabela,
    'Múltiplas dependências' as observacao
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('tickets', 'financial_records', 'company_technicians', 'company_partners', 'company_users', 'payment_schedules')
ORDER BY tablename

UNION ALL

-- Tabelas auxiliares/log
SELECT 
    'Nível 4 - Tabelas Auxiliares' as nivel,
    tablename as tabela,
    'Tabelas de log/auxiliares' as observacao
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('ticket_statuses', 'reminder_logs', 'local_events', 'service_order_templates', 'technician_bank_accounts')
ORDER BY tablename;

-- ============================================
-- VERIFICAÇÃO DE INTEGRIDADE BÁSICA
-- ============================================

SELECT 
    '========================================' as separador,
    'VERIFICAÇÃO DE INTEGRIDADE' as titulo,
    '========================================' as separador2;

-- Verificar se todas as tabelas têm chave primária
SELECT 
    t.table_name as "Tabela",
    CASE 
        WHEN pk.constraint_name IS NOT NULL THEN '✅ Tem PK'
        ELSE '⚠️ SEM CHAVE PRIMÁRIA'
    END as status_pk,
    pk.column_name as "Coluna PK"
FROM information_schema.tables t
LEFT JOIN (
    SELECT 
        tc.table_name,
        tc.constraint_name,
        kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
) pk ON t.table_name = pk.table_name
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY 
    CASE WHEN pk.constraint_name IS NULL THEN 0 ELSE 1 END,
    t.table_name;

-- ============================================
-- FIM DO RESUMO
-- ============================================













