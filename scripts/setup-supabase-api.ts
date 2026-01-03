/**
 * Script de Setup do Supabase usando API REST e SQL direto
 *
 * Este script:
 * 1. Cria todas as tabelas usando Drizzle Kit Push (via DATABASE_URL)
 * 2. Desativa RLS (Row Level Security) de todas as tabelas usando SQL direto
 *
 * Uso:
 *   npm run setup:supabase:api
 *
 * Configure no .env:
 *   SUPABASE_URL="https://xxx.supabase.co"
 *   SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."
 *   DATABASE_URL="postgresql://postgres:senha@db.xxx.supabase.co:5432/postgres"
 */

import { execSync } from 'child_process';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

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

async function setupSupabaseViaAPI() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const databaseUrl = process.env.DATABASE_URL;

  // Validar variáveis de ambiente
  if (!supabaseUrl) {
    console.error('❌ Erro: SUPABASE_URL não está configurado!');
    console.error('Configure a variável SUPABASE_URL no arquivo .env');
    process.exit(1);
  }

  if (!databaseUrl) {
    console.error('❌ Erro: DATABASE_URL não está configurado!');
    console.error('Configure a variável DATABASE_URL no arquivo .env');
    process.exit(1);
  }

  console.log('🚀 Iniciando setup do Supabase via API...\n');
  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}\n`);

  // Criar pool de conexão usando pg
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false, // Necessário para Supabase
    },
    max: 1, // Usar apenas 1 conexão para o script
  });

  try {
    // 1. Verificar conexão com o banco
    console.log('📡 Verificando conexão com o banco de dados...');
    const result = await pool.query('SELECT 1 as test');
    if (result.rows && result.rows.length > 0) {
      console.log('   ✅ Conexão estabelecida com sucesso!\n');
    }

    // 2. Criar todas as tabelas usando Drizzle Push
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
      throw error;
    }

    // 3. Desativar RLS de todas as tabelas usando SQL direto
    console.log(
      '🔓 Desativando RLS (Row Level Security) de todas as tabelas...\n'
    );

    for (const tableName of TABLES) {
      try {
        // Desativar RLS na tabela
        await pool.query(
          `ALTER TABLE IF EXISTS ${tableName} DISABLE ROW LEVEL SECURITY;`
        );
        console.log(`   ✅ RLS desativado na tabela: ${tableName}`);
      } catch (error: any) {
        console.error(
          `   ⚠️  Erro ao desativar RLS na tabela ${tableName}:`,
          error.message || error
        );
        // Continuar mesmo se houver erro em uma tabela
      }
    }

    console.log('\n✅ Setup concluído com sucesso!\n');

    // 4. Verificar status do RLS
    console.log('📋 Verificando status do RLS nas tabelas...\n');

    const rlsStatusQuery = `
      SELECT 
        t.tablename,
        CASE 
          WHEN c.relrowsecurity THEN 'RLS ATIVO'
          ELSE 'RLS DESATIVADO'
        END as rls_status
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = 'public'
      AND t.tablename = ANY($1::text[])
      ORDER BY t.tablename;
    `;

    const tableNames = TABLES.map((t) => `'${t}'`).join(', ');
    const rlsStatusQueryFinal = rlsStatusQuery.replace(
      'AND t.tablename = ANY($1::text[])',
      `AND t.tablename IN (${tableNames})`
    );

    const rlsStatus = await pool.query(rlsStatusQueryFinal);

    for (const row of rlsStatus.rows) {
      const status =
        row.rls_status === 'RLS ATIVO' ? '🔒 RLS ATIVO' : '🔓 RLS DESATIVADO';
      console.log(`   - ${row.tablename} (${status})`);
    }

    console.log('\n✨ Setup do Supabase via API finalizado!\n');
    console.log('📝 Próximos passos:');
    console.log('   1. ✅ Tabelas criadas via Drizzle ORM');
    console.log('   2. ✅ RLS desativado em todas as tabelas');
    console.log(
      '   3. Configure o Tenant Isolation na camada de aplicação (Node.js)'
    );
    console.log('   4. Teste a conexão com a aplicação\n');
  } catch (error: any) {
    console.error('\n❌ Erro durante o setup:');

    if (error instanceof Error) {
      console.error('   Tipo: Error');
      console.error('   Mensagem:', error.message);
      if (error.stack) {
        console.error('   Stack:', error.stack);
      }
    } else if (error && typeof error === 'object') {
      console.error('   Tipo:', error.constructor?.name || 'Unknown');
      console.error(
        '   Detalhes:',
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      );
    } else {
      console.error('   Erro desconhecido:', error);
    }

    // Dicas de troubleshooting
    console.error('\n💡 Dicas para resolver:');
    console.error(
      '   1. Verifique se SUPABASE_URL está correto no arquivo .env'
    );
    console.error('   2. Verifique se DATABASE_URL está correto');
    console.error('   3. Verifique se o projeto Supabase está ativo');
    console.error('   4. Verifique se a senha do banco está correta');
    console.error(
      '   5. Para desativar RLS manualmente, use o SQL Editor no dashboard do Supabase\n'
    );

    process.exit(1);
  } finally {
    // Fechar pool
    try {
      await pool.end();
    } catch (closeError) {
      console.warn('⚠️  Erro ao fechar pool:', closeError);
    }
  }
}

// Executar setup
setupSupabaseViaAPI().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});


























