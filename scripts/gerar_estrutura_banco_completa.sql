-- ============================================
-- SCRIPT PARA GERAR ESTRUTURA COMPLETA DO BANCO DE DADOS
-- Execute no SQL Editor do Supabase para documentar toda a estrutura
-- ============================================

-- ============================================
-- 1. LISTAR TODAS AS TABELAS DO BANCO
-- ============================================
SELECT 
    schemaname as schema_name,
    tablename as table_name,
    tableowner as table_owner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================
-- 2. ESTRUTURA COMPLETA DE TODAS AS TABELAS
-- ============================================
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale,
    c.is_nullable,
    c.column_default,
    c.ordinal_position
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- ============================================
-- 3. CONSTRAINTS (CHAVES PRIMÁRIAS, ESTRANGEIRAS, UNIQUE, CHECK)
-- ============================================

-- Chaves Primárias
SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'PRIMARY KEY'
ORDER BY tc.table_name, kcu.ordinal_position;

-- Chaves Estrangeiras (Relacionamentos)
SELECT
    tc.table_name as tabela_origem,
    kcu.column_name as coluna_origem,
    ccu.table_name as tabela_destino,
    ccu.column_name as coluna_destino,
    tc.constraint_name as nome_constraint,
    rc.update_rule as on_update,
    rc.delete_rule as on_delete
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;

-- Constraints UNIQUE
SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.table_name, kcu.column_name;

-- Constraints CHECK
SELECT
    tc.table_name,
    cc.check_clause,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name;

-- ============================================
-- 4. ÍNDICES
-- ============================================
SELECT
    schemaname as schema_name,
    tablename as table_name,
    indexname as index_name,
    indexdef as index_definition
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================
-- 5. SEQUENCES (SEQUÊNCIAS/AUTO-INCREMENT)
-- ============================================
SELECT
    sequence_schema as schema_name,
    sequence_name,
    data_type,
    numeric_precision,
    start_value,
    minimum_value,
    maximum_value,
    increment
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- ============================================
-- 6. VIEWS (VISUALIZAÇÕES)
-- ============================================
SELECT
    table_schema as schema_name,
    table_name as view_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================
-- 7. TRIGGERS
-- ============================================
SELECT
    event_object_table as table_name,
    trigger_name,
    event_manipulation as event_type,
    action_statement as trigger_definition,
    action_timing as timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 8. FUNÇÕES/STORED PROCEDURES
-- ============================================
SELECT
    routine_schema as schema_name,
    routine_name,
    routine_type,
    data_type as return_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- ============================================
-- 9. RESUMO COMPLETO POR TABELA (FORMATADO)
-- ============================================
SELECT 
    '=== TABELA: ' || t.table_name || ' ===' as secao,
    '' as coluna,
    '' as tipo,
    '' as nullable,
    '' as default,
    '' as constraints
FROM information_schema.tables t
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
UNION ALL
SELECT 
    '  COLUNA: ' || c.column_name as secao,
    '' as coluna,
    '' as tipo,
    '' as nullable,
    '' as default,
    '' as constraints
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY secao;

-- ============================================
-- 10. ESTRUTURA DETALHADA FORMATADA (MELHOR PARA DOCUMENTAÇÃO)
-- ============================================
WITH tabelas_info AS (
    SELECT DISTINCT
        t.table_name,
        COUNT(DISTINCT c.column_name) as total_colunas,
        COUNT(DISTINCT pk.column_name) as total_pks,
        COUNT(DISTINCT fk.column_name) as total_fks
    FROM information_schema.tables t
    LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND c.table_schema = 'public'
    LEFT JOIN (
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
    ) pk ON t.table_name = pk.table_name
    LEFT JOIN (
        SELECT kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
    ) fk ON t.table_name = fk.table_name
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    GROUP BY t.table_name
)
SELECT
    table_name as "Tabela",
    total_colunas as "Total Colunas",
    total_pks as "Chaves Primárias",
    total_fks as "Chaves Estrangeiras"
FROM tabelas_info
ORDER BY table_name;

-- ============================================
-- 11. EXPORTAR ESTRUTURA COMPLETA EM FORMATO MARKDOWN/TEXTO
-- ============================================
SELECT 
    '## Estrutura do Banco de Dados' || E'\n\n' ||
    string_agg(
        '### ' || t.table_name || E'\n\n' ||
        '**Colunas:**' || E'\n\n' ||
        string_agg(
            '| ' || c.column_name || ' | ' ||
            COALESCE(c.data_type, '') || 
            CASE 
                WHEN c.character_maximum_length IS NOT NULL THEN '(' || c.character_maximum_length || ')'
                WHEN c.numeric_precision IS NOT NULL THEN '(' || c.numeric_precision || 
                    CASE WHEN c.numeric_scale IS NOT NULL THEN ',' || c.numeric_scale ELSE '' END || ')'
                ELSE ''
            END || ' | ' ||
            CASE WHEN c.is_nullable = 'YES' THEN 'Sim' ELSE 'Não' END || ' | ' ||
            COALESCE(c.column_default, '') || ' |',
            E'\n'
            ORDER BY c.ordinal_position
        ) || E'\n\n',
        E'\n\n'
        ORDER BY t.table_name
    ) as documentacao_markdown
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name;

-- ============================================
-- 12. RELACIONAMENTOS ENTRE TABELAS (DIAGRAMA)
-- ============================================
SELECT
    'Relacionamento: ' || 
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
-- 13. VERIFICAR COLUNAS QUE PODEM ESTAR FALTANDO (COMPARAÇÃO COM SCHEMA)
-- ============================================
-- Esta query lista todas as colunas esperadas do shared/schema.ts
-- Você pode ajustar conforme necessário

SELECT 
    'sessions' as tabela_esperada, 'sid' as coluna_esperada UNION ALL
SELECT 'sessions', 'sess' UNION ALL
SELECT 'sessions', 'expire' UNION ALL
SELECT 'users', 'id' UNION ALL
SELECT 'users', 'email' UNION ALL
SELECT 'users', 'first_name' UNION ALL
SELECT 'users', 'last_name' UNION ALL
SELECT 'users', 'profile_image_url' UNION ALL
SELECT 'users', 'role' UNION ALL
SELECT 'users', 'public_slug' UNION ALL
SELECT 'users', 'gov_br_cpf' UNION ALL
SELECT 'users', 'gov_br_senha' UNION ALL
SELECT 'users', 'gov_br_status' UNION ALL
SELECT 'users', 'company_name' UNION ALL
SELECT 'users', 'created_at' UNION ALL
SELECT 'users', 'updated_at' UNION ALL
SELECT 'clients', 'id' UNION ALL
SELECT 'clients', 'user_id' UNION ALL
SELECT 'clients', 'type' UNION ALL
SELECT 'clients', 'name' UNION ALL
SELECT 'clients', 'document' UNION ALL
SELECT 'clients', 'email' UNION ALL
SELECT 'clients', 'phone' UNION ALL
SELECT 'clients', 'logo_url' UNION ALL
SELECT 'clients', 'address' UNION ALL
SELECT 'clients', 'city' UNION ALL
SELECT 'clients', 'state' UNION ALL
SELECT 'clients', 'legal_name' UNION ALL
SELECT 'clients', 'municipal_registration' UNION ALL
SELECT 'clients', 'state_registration' UNION ALL
SELECT 'clients', 'zip_code' UNION ALL
SELECT 'clients', 'street_address' UNION ALL
SELECT 'clients', 'address_number' UNION ALL
SELECT 'clients', 'address_complement' UNION ALL
SELECT 'clients', 'neighborhood' UNION ALL
SELECT 'clients', 'payment_cycle_start_day' UNION ALL
SELECT 'clients', 'payment_cycle_end_day' UNION ALL
SELECT 'clients', 'payment_due_day' UNION ALL
SELECT 'clients', 'default_ticket_value' UNION ALL
SELECT 'clients', 'default_hours_included' UNION ALL
SELECT 'clients', 'default_km_rate' UNION ALL
SELECT 'clients', 'default_additional_hour_rate' UNION ALL
SELECT 'clients', 'monthly_spreadsheet' UNION ALL
SELECT 'clients', 'spreadsheet_email' UNION ALL
SELECT 'clients', 'spreadsheet_day' UNION ALL
SELECT 'clients', 'no_show_count' UNION ALL
SELECT 'clients', 'created_at' UNION ALL
SELECT 'services', 'id' UNION ALL
SELECT 'services', 'user_id' UNION ALL
SELECT 'services', 'name' UNION ALL
SELECT 'services', 'description' UNION ALL
SELECT 'services', 'price' UNION ALL
SELECT 'services', 'duration' UNION ALL
SELECT 'services', 'active' UNION ALL
SELECT 'services', 'public_booking' UNION ALL
SELECT 'services', 'created_at' UNION ALL
SELECT 'tickets', 'id' UNION ALL
SELECT 'tickets', 'user_id' UNION ALL
SELECT 'tickets', 'technician_id' UNION ALL
SELECT 'tickets', 'client_id' UNION ALL
SELECT 'tickets', 'service_id' UNION ALL
SELECT 'tickets', 'status' UNION ALL
SELECT 'tickets', 'scheduled_date' UNION ALL
SELECT 'tickets', 'scheduled_time' UNION ALL
SELECT 'tickets', 'duration' UNION ALL
SELECT 'tickets', 'address' UNION ALL
SELECT 'tickets', 'city' UNION ALL
SELECT 'tickets', 'state' UNION ALL
SELECT 'tickets', 'ticket_number' UNION ALL
SELECT 'tickets', 'invoice_number' UNION ALL
SELECT 'tickets', 'final_client' UNION ALL
SELECT 'tickets', 'ticket_value' UNION ALL
SELECT 'tickets', 'charge_type' UNION ALL
SELECT 'tickets', 'approved_by' UNION ALL
SELECT 'tickets', 'km_rate' UNION ALL
SELECT 'tickets', 'service_address' UNION ALL
SELECT 'tickets', 'scheduled_end_date' UNION ALL
SELECT 'tickets', 'scheduled_end_time' UNION ALL
SELECT 'tickets', 'travel_time_minutes' UNION ALL
SELECT 'tickets', 'buffer_time_minutes' UNION ALL
SELECT 'tickets', 'description' UNION ALL
SELECT 'tickets', 'extra_hours' UNION ALL
SELECT 'tickets', 'total_amount' UNION ALL
SELECT 'tickets', 'google_calendar_event_id' UNION ALL
SELECT 'tickets', 'cancellation_reason' UNION ALL
SELECT 'tickets', 'no_show' UNION ALL
SELECT 'tickets', 'started_at' UNION ALL
SELECT 'tickets', 'stopped_at' UNION ALL
SELECT 'tickets', 'elapsed_seconds' UNION ALL
SELECT 'tickets', 'km_total' UNION ALL
SELECT 'tickets', 'extra_expenses' UNION ALL
SELECT 'tickets', 'expense_details' UNION ALL
SELECT 'tickets', 'completed_at' UNION ALL
SELECT 'tickets', 'created_at' UNION ALL
SELECT 'financial_records', 'id' UNION ALL
SELECT 'financial_records', 'user_id' UNION ALL
SELECT 'financial_records', 'ticket_id' UNION ALL
SELECT 'financial_records', 'client_id' UNION ALL
SELECT 'financial_records', 'amount' UNION ALL
SELECT 'financial_records', 'type' UNION ALL
SELECT 'financial_records', 'status' UNION ALL
SELECT 'financial_records', 'due_date' UNION ALL
SELECT 'financial_records', 'paid_at' UNION ALL
SELECT 'financial_records', 'description' UNION ALL
SELECT 'financial_records', 'created_at'
ORDER BY tabela_esperada, coluna_esperada;

-- Comparar com o que existe no banco
SELECT 
    e.tabela_esperada,
    e.coluna_esperada,
    CASE 
        WHEN c.column_name IS NOT NULL THEN '✅ Existe'
        ELSE '❌ FALTANDO'
    END as status
FROM (
    -- Lista de colunas esperadas (copiar do SELECT acima)
    SELECT 'sessions' as tabela_esperada, 'sid' as coluna_esperada UNION ALL
    SELECT 'sessions', 'sess' UNION ALL
    SELECT 'sessions', 'expire' UNION ALL
    SELECT 'users', 'id' UNION ALL
    SELECT 'users', 'email' UNION ALL
    SELECT 'users', 'first_name' UNION ALL
    SELECT 'users', 'last_name' UNION ALL
    SELECT 'users', 'profile_image_url' UNION ALL
    SELECT 'users', 'role' UNION ALL
    SELECT 'users', 'public_slug' UNION ALL
    SELECT 'users', 'gov_br_cpf' UNION ALL
    SELECT 'users', 'gov_br_senha' UNION ALL
    SELECT 'users', 'gov_br_status' UNION ALL
    SELECT 'users', 'company_name' UNION ALL
    SELECT 'users', 'created_at' UNION ALL
    SELECT 'users', 'updated_at'
    -- Adicionar todas as outras colunas conforme necessário
) e
LEFT JOIN information_schema.columns c 
    ON c.table_name = e.tabela_esperada 
    AND c.column_name = e.coluna_esperada
    AND c.table_schema = 'public'
ORDER BY e.tabela_esperada, e.coluna_esperada;

-- ============================================
-- 14. CONTAGEM DE REGISTROS POR TABELA
-- ============================================
SELECT 
    schemaname as schema_name,
    tablename as table_name,
    n_live_tup as total_registros
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC, tablename;

-- ============================================
-- 15. TAMANHO DAS TABELAS
-- ============================================
SELECT
    schemaname as schema_name,
    tablename as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as tamanho_total,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as tamanho_dados,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as tamanho_indices
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- 16. POLÍTICAS RLS (Row Level Security) - Se aplicável
-- ============================================
SELECT
    schemaname as schema_name,
    tablename as table_name,
    policyname as policy_name,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- FIM DO SCRIPT
-- ============================================













