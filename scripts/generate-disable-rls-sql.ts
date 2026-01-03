/**
 * Script para gerar SQL de desativação de RLS
 *
 * Este script gera o arquivo SQL para desativar RLS sem tentar conectar ao banco.
 * Execute o SQL gerado no SQL Editor do Supabase.
 *
 * Uso:
 *   npm run generate:disable-rls-sql
 */

import { writeFile } from 'fs/promises';

// Lista de todas as tabelas do schema
const TABLES = [
  'sessions',
  'users',
  'clients',
  'services',
  'tickets',
  'financial_records',
  'integration_settings',
  'reminder_logs',
  'local_events',
] as const;

async function generateDisableRLSSQL() {
  console.log('🔓 Gerando SQL para desativar RLS...\n');

  const disableRLSSQL = `-- ============================================
-- Script para desativar RLS em todas as tabelas
-- Projeto: ChamadosPro (oyrfnydwjpafubxvrucu)
-- Execute este SQL no SQL Editor do Supabase
-- ============================================

-- Desativar RLS em todas as tabelas
${TABLES.map(
  (tableName) =>
    `ALTER TABLE IF EXISTS ${tableName} DISABLE ROW LEVEL SECURITY;`
).join('\n')}

-- ============================================
-- Verificar status do RLS após execução
-- ============================================
SELECT
    t.tablename,
    CASE
        WHEN c.relrowsecurity THEN 'RLS ATIVO'
        ELSE 'RLS DESATIVADO'
    END as rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
AND t.tablename IN (${TABLES.map((t) => `'${t}'`).join(', ')})
ORDER BY t.tablename;
`;

  // Salvar SQL em arquivo
  const sqlFilePath = './scripts/disable-rls.sql';
  await writeFile(sqlFilePath, disableRLSSQL, 'utf-8');

  console.log('✅ SQL gerado e salvo em: scripts/disable-rls.sql\n');
  console.log('💡 Para executar este SQL:');
  console.log('   1. Acesse: https://supabase.com/dashboard');
  console.log('   2. Selecione o projeto: ChamadosPro');
  console.log(
    '   3. Vá em SQL Editor (ícone de banco de dados no menu lateral)'
  );
  console.log('   4. Abra o arquivo: scripts/disable-rls.sql');
  console.log('   5. Cole o conteúdo na área de edição');
  console.log('   6. Clique em "Run" ou pressione Ctrl+Enter\n');
  console.log('📋 Tabelas que terão RLS desativado:');
  TABLES.forEach((table) => console.log(`   - ${table}`));
  console.log('');
}

// Executar
generateDisableRLSSQL().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});


























