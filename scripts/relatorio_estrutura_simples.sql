-- ============================================
-- RELATÓRIO SIMPLIFICADO DA ESTRUTURA DO BANCO
-- Executa todas as queries e gera um relatório completo
-- ============================================

-- ============================================
-- PARTE 1: LISTA DE TODAS AS TABELAS
-- ============================================
SELECT 
    '========================================' as separador,
    'LISTA DE TABELAS' as titulo,
    '========================================' as separador2;

SELECT 
    ROW_NUMBER() OVER (ORDER BY tablename) as "#",
    tablename as "Nome da Tabela",
    tableowner as "Proprietário"
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================
-- PARTE 2: ESTRUTURA DETALHADA DE CADA TABELA
-- ============================================

-- Para cada tabela, vamos listar:
DO $$
DECLARE
    rec RECORD;
    query_text TEXT;
BEGIN
    FOR rec IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename
    LOOP
        RAISE NOTICE E'\n========================================\nTABELA: %\n========================================', rec.tablename;
        
        -- Listar colunas
        FOR query_text IN
            SELECT 
                '  - ' || column_name || ' (' || 
                data_type || 
                CASE 
                    WHEN character_maximum_length IS NOT NULL THEN '(' || character_maximum_length || ')'
                    WHEN numeric_precision IS NOT NULL THEN '(' || numeric_precision || 
                        CASE WHEN numeric_scale IS NOT NULL THEN ',' || numeric_scale ELSE '' END || ')'
                    ELSE ''
                END || 
                ')' ||
                CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
                CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = rec.tablename
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '%', query_text;
        END LOOP;
    END LOOP;
END $$;

-- ============================================
-- PARTE 3: ESTRUTURA COMPLETA EM FORMATO TABULAR
-- ============================================

SELECT 
    '========================================' as separador,
    'ESTRUTURA COMPLETA - TODAS AS TABELAS' as titulo,
    '========================================' as separador2;

SELECT 
    t.table_name as "Tabela",
    c.column_name as "Coluna",
    c.data_type || 
    CASE 
        WHEN c.character_maximum_length IS NOT NULL THEN '(' || c.character_maximum_length || ')'
        WHEN c.numeric_precision IS NOT NULL THEN '(' || c.numeric_precision || 
            CASE WHEN c.numeric_scale IS NOT NULL THEN ',' || c.numeric_scale ELSE '' END || ')'
        ELSE ''
    END as "Tipo",
    CASE WHEN c.is_nullable = 'YES' THEN 'Sim' ELSE 'Não' END as "Nulo?",
    COALESCE(c.column_default, '-') as "Padrão",
    c.ordinal_position as "Ordem"
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- ============================================
-- PARTE 4: RELACIONAMENTOS (FOREIGN KEYS)
-- ============================================

SELECT 
    '========================================' as separador,
    'RELACIONAMENTOS ENTRE TABELAS' as titulo,
    '========================================' as separador2;

SELECT
    tc.table_name as "Tabela Origem",
    kcu.column_name as "Coluna Origem",
    '→' as "Relaciona",
    ccu.table_name as "Tabela Destino",
    ccu.column_name as "Coluna Destino",
    tc.constraint_name as "Nome Constraint"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================
-- PARTE 5: RESUMO ESTATÍSTICO
-- ============================================

SELECT 
    '========================================' as separador,
    'RESUMO ESTATÍSTICO' as titulo,
    '========================================' as separador2;

SELECT 
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as "Total de Tabelas",
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public') as "Total de Colunas",
    (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_type = 'PRIMARY KEY') as "Total de Chaves Primárias",
    (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY') as "Total de Chaves Estrangeiras",
    (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_type = 'UNIQUE') as "Total de Constraints Unique",
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as "Total de Índices";

-- ============================================
-- PARTE 6: CONTAGEM DE REGISTROS
-- ============================================

SELECT 
    '========================================' as separador,
    'CONTAGEM DE REGISTROS POR TABELA' as titulo,
    '========================================' as separador2;

SELECT 
    tablename as "Tabela",
    n_live_tup as "Total de Registros",
    CASE 
        WHEN n_live_tup = 0 THEN 'Vazia'
        WHEN n_live_tup < 100 THEN 'Pequena (< 100)'
        WHEN n_live_tup < 1000 THEN 'Média (< 1K)'
        WHEN n_live_tup < 10000 THEN 'Grande (< 10K)'
        ELSE 'Muito Grande (> 10K)'
    END as "Tamanho"
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC, tablename;

-- ============================================
-- PARTE 7: TABELAS POR CATEGORIA (INFERIDO PELO NOME)
-- ============================================

SELECT 
    '========================================' as separador,
    'TABELAS POR CATEGORIA' as titulo,
    '========================================' as separador2;

SELECT 
    CASE 
        WHEN tablename LIKE '%user%' OR tablename LIKE '%client%' THEN 'Usuários/Clientes'
        WHEN tablename LIKE '%ticket%' OR tablename LIKE '%chamado%' THEN 'Chamados'
        WHEN tablename LIKE '%service%' OR tablename LIKE '%servico%' THEN 'Serviços'
        WHEN tablename LIKE '%financial%' OR tablename LIKE '%payment%' THEN 'Financeiro'
        WHEN tablename LIKE '%company%' OR tablename LIKE '%empresa%' THEN 'Empresas'
        WHEN tablename LIKE '%technician%' OR tablename LIKE '%tecnico%' THEN 'Técnicos'
        WHEN tablename LIKE '%integration%' OR tablename LIKE '%integration%' THEN 'Integrações'
        WHEN tablename LIKE '%setting%' OR tablename LIKE '%config%' THEN 'Configurações'
        WHEN tablename LIKE '%session%' THEN 'Sessões'
        ELSE 'Outros'
    END as "Categoria",
    COUNT(*) as "Quantidade de Tabelas",
    STRING_AGG(tablename, ', ' ORDER BY tablename) as "Tabelas"
FROM pg_tables
WHERE schemaname = 'public'
GROUP BY 
    CASE 
        WHEN tablename LIKE '%user%' OR tablename LIKE '%client%' THEN 'Usuários/Clientes'
        WHEN tablename LIKE '%ticket%' OR tablename LIKE '%chamado%' THEN 'Chamados'
        WHEN tablename LIKE '%service%' OR tablename LIKE '%servico%' THEN 'Serviços'
        WHEN tablename LIKE '%financial%' OR tablename LIKE '%payment%' THEN 'Financeiro'
        WHEN tablename LIKE '%company%' OR tablename LIKE '%empresa%' THEN 'Empresas'
        WHEN tablename LIKE '%technician%' OR tablename LIKE '%tecnico%' THEN 'Técnicos'
        WHEN tablename LIKE '%integration%' OR tablename LIKE '%integration%' THEN 'Integrações'
        WHEN tablename LIKE '%setting%' OR tablename LIKE '%config%' THEN 'Configurações'
        WHEN tablename LIKE '%session%' THEN 'Sessões'
        ELSE 'Outros'
    END
ORDER BY "Quantidade de Tabelas" DESC;

-- ============================================
-- FIM DO RELATÓRIO
-- ============================================













