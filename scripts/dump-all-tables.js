/**
 * Script para fazer dump completo do banco Supabase via API REST
 * 
 * Execute: node scripts/dump-all-tables.js
 * 
 * Requer variáveis de ambiente:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (ou ANON_KEY se não precisar de acesso total)
 */

import fs from 'fs';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Erro: Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

// Tabelas do sistema que não precisamos ler
const SKIP_TABLES = new Set([
  'schema_migrations',
  'pgmigrations',
  'pg_stat_statements',
  'storage.objects',
  'storage.buckets',
  'realtime.schema_migrations',
]);

/**
 * Lista todas as tabelas do schema public
 */
async function listTables() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/get_tables`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ schema_name: 'public' }),
    }
  );

  // Se não houver RPC, tentar via query direta
  if (!response.ok) {
    // Alternativa: usar uma query SQL customizada
    console.log('⚠️  RPC não disponível, tentando método alternativo...');
    return null;
  }

  return await response.json();
}

/**
 * Busca dados de uma tabela via REST API
 */
async function fetchTableData(tableName) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${tableName}?select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { data, count: Array.isArray(data) ? data.length : 0 };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Lista tabelas usando query SQL via REST
 */
async function getTablesViaQuery() {
  // Tentar buscar via information_schema (se tiver acesso)
  const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  try {
    // Nota: Supabase REST não permite queries SQL diretas
    // Vamos tentar descobrir tabelas testando endpoints conhecidos
    const knownTables = [
      'users',
      'user_credentials',
      'clients',
      'services',
      'tickets',
      'financial_records',
      'company_data',
      'company_users',
      'company_technicians',
      'local_events',
      'vehicle_settings',
      'integration_settings',
      'reminder_logs',
      'subscriptions',
      'plans',
    ];

    return knownTables;
  } catch (error) {
    console.error('Erro ao listar tabelas:', error);
    return [];
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🔍 Iniciando dump do banco de dados Supabase...\n');
  console.log(`URL: ${SUPABASE_URL}\n`);

  // Tentar descobrir tabelas
  let tables = await listTables();
  
  if (!tables || tables.length === 0) {
    console.log('📋 Usando lista de tabelas conhecidas...');
    tables = await getTablesViaQuery();
  }

  if (!tables || tables.length === 0) {
    console.error('❌ Não foi possível listar tabelas. Verifique as credenciais.');
    process.exit(1);
  }

  // Filtrar tabelas do sistema
  const tableNames = Array.isArray(tables) 
    ? tables.filter(t => {
        const name = typeof t === 'string' ? t : t.table_name || t.name;
        return !SKIP_TABLES.has(name);
      })
    : [];

  console.log(`📊 Encontradas ${tableNames.length} tabelas para processar:\n`);
  tableNames.forEach(t => {
    const name = typeof t === 'string' ? t : t.table_name || t.name;
    console.log(`  - ${name}`);
  });
  console.log('');

  const dump = {
    metadata: {
      supabase_url: SUPABASE_URL,
      timestamp: new Date().toISOString(),
      tables_count: tableNames.length,
    },
    tables: {},
  };

  // Processar cada tabela
  for (const table of tableNames) {
    const tableName = typeof table === 'string' ? table : table.table_name || table.name;
    
    console.log(`📥 Lendo tabela: ${tableName}...`);
    
    const result = await fetchTableData(tableName);
    
    if (result.error) {
      console.log(`  ⚠️  Erro: ${result.error}`);
      dump.tables[tableName] = { error: result.error };
    } else {
      console.log(`  ✅ ${result.count} registros encontrados`);
      dump.tables[tableName] = result.data;
    }
  }

  // Salvar resultado
  const outputFile = 'supabase-dump.json';
  fs.writeFileSync(outputFile, JSON.stringify(dump, null, 2));
  
  console.log(`\n✅ Dump completo salvo em: ${outputFile}`);
  console.log(`\n📊 Resumo:`);
  console.log(`   - Tabelas processadas: ${tableNames.length}`);
  console.log(`   - Tabelas com sucesso: ${Object.keys(dump.tables).filter(t => !dump.tables[t].error).length}`);
  console.log(`   - Tabelas com erro: ${Object.keys(dump.tables).filter(t => dump.tables[t].error).length}`);
}

main().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

