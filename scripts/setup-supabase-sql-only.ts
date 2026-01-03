/**
 * Script de Setup do Supabase - Geração de SQL
 *
 * Este script:
 * 1. Cria todas as tabelas usando Drizzle Kit Push (via DATABASE_URL)
 * 2. Gera arquivo SQL para desativar RLS (para executar manualmente no SQL Editor)
 *
 * Uso:
 *   npm run setup:supabase:sql
 *
 * Configure no .env:
 *   DATABASE_URL="postgresql://postgres:senha@db.xxx.supabase.co:5432/postgres"
 */

import { execSync } from 'child_process';
import { writeFile } from 'fs/promises';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

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

async function setupSupabaseSQL() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ Erro: DATABASE_URL não está configurado!');
    console.error('Configure a variável DATABASE_URL no arquivo .env');
    process.exit(1);
  }

  console.log('🚀 Iniciando setup do Supabase (modo SQL)...\n');
  console.log(`   Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}\n`);

  try {
    // 1. Criar todas as tabelas usando Drizzle Push
    console.log('📦 Criando tabelas usando Drizzle ORM...');
    console.log('   (Isso pode levar alguns segundos...)\n');

    try {
      execSync('npx drizzle-kit push', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: databaseUrl },
      });
      console.log('\n✅ Tabelas criadas com sucesso!\n');
    } catch (error) {
      console.error('❌ Erro ao criar tabelas:', error);
      console.error('\n💡 Dica: Se o erro for de conexão DNS, você pode:');
      console.error(
        '   1. Criar as tabelas manualmente usando o SQL Editor do Supabase'
      );
      console.error('   2. Ou verificar se o DATABASE_URL está correto\n');
      throw error;
    }

    // 2. Gerar SQL para desativar RLS
    console.log('🔓 Gerando SQL para desativar RLS...\n');

    const disableRLSSQL = `-- ============================================
-- Script para desativar RLS em todas as tabelas
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

    console.log('📝 SQL gerado e salvo em: scripts/disable-rls.sql\n');
    console.log('💡 Para executar este SQL:');
    console.log('   1. Acesse: https://supabase.com/dashboard');
    console.log('   2. Selecione seu projeto');
    console.log(
      '   3. Vá em SQL Editor (ícone de banco de dados no menu lateral)'
    );
    console.log('   4. Abra o arquivo: scripts/disable-rls.sql');
    console.log('   5. Cole o conteúdo na área de edição');
    console.log('   6. Clique em "Run" ou pressione Ctrl+Enter\n');

    console.log('✨ Setup concluído!\n');
    console.log('📝 Próximos passos:');
    console.log('   1. ✅ Tabelas criadas via Drizzle ORM');
    console.log(
      '   2. 🔓 Execute o SQL em scripts/disable-rls.sql no SQL Editor'
    );
    console.log(
      '   3. Configure o Tenant Isolation na camada de aplicação (Node.js)'
    );
    console.log('   4. Teste a conexão com a aplicação\n');
  } catch (error: any) {
    console.error('\n❌ Erro durante o setup:');

    if (error instanceof Error) {
      console.error('   Tipo: Error');
      console.error('   Mensagem:', error.message);
    }

    console.error('\n💡 Alternativa:');
    console.error('   Se não conseguir conectar, você pode:');
    console.error('   1. Acessar o SQL Editor do Supabase diretamente');
    console.error(
      '   2. Executar o SQL manualmente para criar tabelas e desativar RLS'
    );
    console.error(
      '   3. O arquivo scripts/disable-rls.sql contém o SQL necessário\n'
    );

    process.exit(1);
  }
}

// Executar setup
setupSupabaseSQL().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});


























