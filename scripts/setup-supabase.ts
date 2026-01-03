/**
 * Script de Setup do Supabase
 *
 * Este script:
 * 1. Cria todas as tabelas usando Drizzle Kit Push
 * 2. Desativa RLS (Row Level Security) de todas as tabelas
 *
 * Uso:
 *   npm run setup:supabase
 *
 * Configure no .env:
 *   DATABASE_URL="postgresql://postgres:senha@db.xxx.supabase.co:5432/postgres"
 */

import { execSync } from 'child_process';
import pg from 'pg';
import { lookup } from 'dns/promises';
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

async function setupSupabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ Erro: DATABASE_URL não está configurado!');
    console.error(
      'Configure a variável DATABASE_URL no arquivo .env ou como variável de ambiente.'
    );
    process.exit(1);
  }

  console.log('🚀 Iniciando setup do Supabase...\n');

  // Extrair hostname da URL para verificação de DNS (disponível em todo o escopo)
  let hostname: string | null = null;
  try {
    const urlMatch = databaseUrl.match(/@([^:]+):/);
    if (urlMatch) {
      hostname = urlMatch[1];
    }
  } catch (e) {
    // Ignorar erro de parsing
  }

  // 1. Verificar DNS antes de tentar conectar (opcional - não bloqueia se falhar)
  if (hostname) {
    console.log('🔍 Verificando resolução DNS...');
    console.log(`   Hostname: ${hostname}`);
    try {
      const addresses = await lookup(hostname);
      console.log(`   ✅ DNS resolvido: ${addresses.address}\n`);
    } catch (dnsError: any) {
      console.warn(
        `   ⚠️  Aviso: Não foi possível verificar DNS: ${dnsError.message}`
      );
      console.warn(
        '   Continuando mesmo assim - o driver PostgreSQL tentará resolver...\n'
      );
      // Não lançar erro - deixar o driver pg tentar conectar
    }
  }

  // Criar pool de conexão para executar SQL
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000, // 10 segundos de timeout
  });

  try {
    // 2. Verificar conexão
    console.log('📡 Verificando conexão com o banco de dados...');
    console.log(`   URL: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`); // Ocultar senha

    try {
      const result = await pool.query('SELECT 1 as test');
      if (result.rows && result.rows.length > 0) {
        console.log('✅ Conexão estabelecida com sucesso!\n');
      } else {
        throw new Error(
          'Conexão estabelecida mas query não retornou resultado'
        );
      }
    } catch (queryError: any) {
      console.error('❌ Erro na query de teste:', queryError);
      if (queryError.message) {
        console.error('   Mensagem:', queryError.message);
      }
      if (queryError.code) {
        console.error('   Código:', queryError.code);
      }
      throw queryError;
    }

    // 3. Criar todas as tabelas usando Drizzle Push
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

    // 4. Desativar RLS de todas as tabelas
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
      } catch (error) {
        console.error(
          `   ⚠️  Erro ao desativar RLS na tabela ${tableName}:`,
          error
        );
        // Continuar mesmo se houver erro em uma tabela
      }
    }

    console.log('\n✅ Setup concluído com sucesso!\n');

    // 5. Listar tabelas criadas e verificar status do RLS
    console.log('📋 Verificando tabelas criadas e status do RLS...\n');

    // Verificar cada tabela individualmente
    for (const tableName of TABLES) {
      try {
        const result = await pool.query(
          `
          SELECT 
            CASE 
              WHEN c.relrowsecurity THEN 'RLS ATIVO'
              ELSE 'RLS DESATIVADO'
            END as rls_status
          FROM pg_class c
          WHERE c.relname = $1
          AND c.relkind = 'r';
        `,
          [tableName]
        );

        if (result.rows.length > 0) {
          const status =
            result.rows[0].rls_status === 'RLS ATIVO'
              ? '🔒 RLS ATIVO'
              : '🔓 RLS DESATIVADO';
          console.log(`   - ${tableName} (${status})`);
        } else {
          console.log(`   - ${tableName} (⚠️  Tabela não encontrada)`);
        }
      } catch (error) {
        console.log(`   - ${tableName} (⚠️  Erro ao verificar)`);
      }
    }

    console.log('\n✨ Setup do Supabase finalizado!\n');
    console.log('📝 Próximos passos:');
    console.log(
      '   1. Verifique se todas as tabelas foram criadas corretamente'
    );
    console.log('   2. Confirme que o RLS está desativado em todas as tabelas');
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

    // Dicas de troubleshooting específicas para ENOTFOUND
    console.error('\n💡 Dicas para resolver erro de DNS (ENOTFOUND):');

    if (error.code === 'ENOTFOUND' || error.message?.includes('ENOTFOUND')) {
      console.error(
        '   Este erro indica que o DNS não consegue resolver o hostname.\n'
      );
      console.error('   📋 Passos para diagnosticar:');
      console.error('   1. Verifique sua conexão com a internet');
      console.error('   2. Teste o DNS manualmente:');
      console.error(`      nslookup ${hostname || 'db.xxx.supabase.co'}`);
      console.error(`      ping ${hostname || 'db.xxx.supabase.co'}`);
      console.error('   3. Verifique se o hostname está correto no Supabase:');
      console.error('      - Acesse: https://supabase.com/dashboard');
      console.error('      - Vá em Settings > Database');
      console.error('      - Copie a Connection String (URI)');
      console.error('   4. Verifique se há firewall bloqueando DNS');
      console.error('   5. Tente usar um DNS público (8.8.8.8 ou 1.1.1.1)');
      console.error('   6. Verifique se o projeto Supabase está ativo\n');
    } else {
      console.error(
        '   1. Verifique se DATABASE_URL está correto no arquivo .env'
      );
      console.error(
        '   2. Verifique se a string de conexão inclui ?sslmode=require'
      );
      console.error('   3. Verifique se o Supabase está acessível');
      console.error('   4. Verifique se a senha está correta');
      console.error(
        '   5. Tente conectar manualmente com psql para testar a conexão\n'
      );
    }

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
setupSupabase().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});


























