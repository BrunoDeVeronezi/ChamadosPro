// Banco de dados Supabase PostgreSQL - OBRIGATÓRIO
// A aplicação agora usa exclusivamente Supabase, não mais Google Sheets

import dotenv from 'dotenv';
import dns from 'node:dns';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';

const { Pool } = pg;

dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL não configurado! Configure a variável DATABASE_URL no arquivo .env'
  );
}

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

let databaseUrl = process.env.DATABASE_URL.trim();
databaseUrl = databaseUrl.replace('@ipv4:', '@');

// Usar pg diretamente para melhor compatibilidade com Supabase
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false, // Supabase requer SSL mas aceita certificados auto-assinados
  },
  connectionTimeoutMillis: 5000, // 5 segundos (reduzido - IPv4 deve ser rápido)
  idleTimeoutMillis: 30000,
  max: 10, // Máximo de conexões no pool
});

// Tratamento de erros de conexão
pool.on('error', (err) => {
  console.error(
    '[Database] ❌ Erro inesperado no pool de conexões:',
    err.message
  );
  if (err.message.includes('ENOTFOUND')) {
    console.error(
      '[Database] ⚠️  Erro de DNS: Não foi possível resolver o hostname do Supabase'
    );
    console.error('[Database] 💡 Verifique:');
    console.error('  1. Se o projeto Supabase está ativo (não pausado)');
    console.error('  2. Se sua conexão com a internet está funcionando');
    console.error('  3. Se há firewall bloqueando conexões na porta 5432');
    console.error(
      '  4. Execute: npm run test:connection para diagnóstico detalhado'
    );
  }
});

const db = drizzle({ client: pool, schema });

export { pool, db };
