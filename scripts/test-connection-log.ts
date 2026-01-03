/**
 * Script de Diagnóstico - Versão com Log em Arquivo
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const logFile = path.join(process.cwd(), 'connection-test.log');
const log: string[] = [];

function addLog(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  log.push(logMessage);
  console.log(message);
}

addLog('=== DIAGNÓSTICO DE CONEXÃO SUPABASE ===\n');

// 1. Verificar DATABASE_URL
addLog('1. Verificando DATABASE_URL...');
if (!process.env.DATABASE_URL) {
  addLog('❌ DATABASE_URL não está configurado!');
  fs.writeFileSync(logFile, log.join('\n'));
  process.exit(1);
}
addLog('✅ DATABASE_URL configurado');
addLog(`   URL: ${process.env.DATABASE_URL.substring(0, 50)}...`);

// 2. Parsear URL
addLog('\n2. Parseando URL de conexão...');
try {
  const url = process.env.DATABASE_URL.replace('postgresql://', 'http://');
  const dbUrl = new URL(url);
  const hostname = dbUrl.hostname;
  const port = dbUrl.port || '5432';

  addLog(`   Hostname: ${hostname}`);
  addLog(`   Porta: ${port}`);

  // 3. Testar DNS
  addLog('\n3. Testando resolução DNS...');
  const dns = await import('dns/promises');
  try {
    const addresses = await dns.resolve4(hostname);
    addLog(`✅ DNS resolvido com sucesso!`);
    addLog(`   IPs: ${addresses.join(', ')}`);
  } catch (error: any) {
    addLog(`❌ Erro DNS: ${error.message}`);
    addLog(`   Código: ${error.code}`);
    fs.writeFileSync(logFile, log.join('\n'));
    process.exit(1);
  }

  // 4. Testar conexão
  addLog('\n4. Testando conexão direta...');
  try {
    const pg = await import('pg');
    const { Pool } = pg;

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
      connectionTimeoutMillis: 10000,
    });

    addLog('   Tentando conectar...');
    const result = await pool.query('SELECT 1 as test');

    if (result.rows && result.rows.length > 0) {
      addLog('✅ Conexão estabelecida com sucesso!');
      await pool.end();
    } else {
      addLog('❌ Conexão estabelecida mas sem resultados');
      await pool.end();
      fs.writeFileSync(logFile, log.join('\n'));
      process.exit(1);
    }
  } catch (error: any) {
    addLog(`❌ Erro na conexão: ${error.message}`);
    addLog(`   Código: ${error.code}`);
    if (error.code === 'ENOTFOUND') {
      addLog('\n💡 Possíveis soluções:');
      addLog('   1. Verifique se o projeto Supabase está ativo');
      addLog('   2. Verifique sua conexão com a internet');
      addLog('   3. Verifique se há firewall bloqueando porta 5432');
      addLog('   4. Tente usar VPN ou outra rede');
    }
    fs.writeFileSync(logFile, log.join('\n'));
    process.exit(1);
  }

  addLog('\n✨ Todos os testes passaram!');
  fs.writeFileSync(logFile, log.join('\n'));
  addLog(`\n📄 Log salvo em: ${logFile}`);
  process.exit(0);
} catch (error: any) {
  addLog(`❌ Erro ao parsear URL: ${error.message}`);
  fs.writeFileSync(logFile, log.join('\n'));
  process.exit(1);
}


























