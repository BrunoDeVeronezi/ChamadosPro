/**
 * Script de Diagnóstico de Conexão
 *
 * Testa a conectividade com o Supabase antes de executar os testes completos
 */

import dotenv from 'dotenv';
import dns from 'dns/promises';

// Carregar dotenv primeiro
dotenv.config();

// Log inicial para debug
console.log('🔍 Script de diagnóstico iniciado...');
console.log('DATABASE_URL configurado:', !!process.env.DATABASE_URL);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

async function testDNS(hostname: string) {
  log('\n🔍 Teste 1: Resolução DNS', 'blue');
  try {
    const addresses = await dns.resolve4(hostname);
    logSuccess(`DNS resolvido com sucesso!`);
    logInfo(`IPs encontrados: ${addresses.join(', ')}`);
    return true;
  } catch (error: any) {
    logError(`Falha na resolução DNS: ${error.message}`);
    logWarning('Possíveis causas:');
    logWarning('  - Projeto Supabase pode estar pausado');
    logWarning('  - Problema de rede/firewall');
    logWarning('  - DNS local não está funcionando');
    return false;
  }
}

async function testConnectionString() {
  log('\n🔍 Teste 2: Validação da String de Conexão', 'blue');

  if (!process.env.DATABASE_URL) {
    logError('DATABASE_URL não está configurado!');
    return false;
  }

  const url = process.env.DATABASE_URL;
  logInfo(`String de conexão encontrada: ${url.substring(0, 30)}...`);

  try {
    const dbUrl = new URL(url.replace('postgresql://', 'http://'));
    const hostname = dbUrl.hostname;
    const port = dbUrl.port || '5432';

    logInfo(`Hostname: ${hostname}`);
    logInfo(`Porta: ${port}`);

    return await testDNS(hostname);
  } catch (error: any) {
    logError(`Erro ao parsear DATABASE_URL: ${error.message}`);
    return false;
  }
}

async function testDirectConnection() {
  log('\n🔍 Teste 3: Tentativa de Conexão Direta', 'blue');

  if (!process.env.DATABASE_URL) {
    logError('DATABASE_URL não está configurado!');
    return false;
  }

  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
      connectionTimeoutMillis: 5000, // 5 segundos
    });

    logInfo('Tentando conectar...');
    const result = await pool.query('SELECT 1 as test');

    if (result.rows && result.rows.length > 0) {
      logSuccess('Conexão estabelecida com sucesso!');
      await pool.end();
      return true;
    }

    await pool.end();
    return false;
  } catch (error: any) {
    logError(`Falha na conexão: ${error.message}`);

    if (error.code === 'ENOTFOUND') {
      logWarning('\n💡 Soluções possíveis:');
      logWarning('1. Verifique se o projeto Supabase está ativo (não pausado)');
      logWarning('2. Verifique sua conexão com a internet');
      logWarning(
        '3. Verifique se há firewall bloqueando conexões na porta 5432'
      );
      logWarning('4. Tente usar um VPN ou outra rede');
      logWarning(
        '5. Verifique se o hostname está correto no dashboard do Supabase'
      );
    }

    return false;
  }
}

async function runDiagnostics() {
  log('\n🚀 Iniciando Diagnóstico de Conexão...\n', 'blue');

  const results = {
    connectionString: false,
    dns: false,
    connection: false,
  };

  results.connectionString = await testConnectionString();

  if (results.connectionString) {
    const url = new URL(
      process.env.DATABASE_URL!.replace('postgresql://', 'http://')
    );
    results.dns = await testDNS(url.hostname);

    if (results.dns) {
      results.connection = await testDirectConnection();
    }
  }

  // Resumo
  log('\n📊 Resumo do Diagnóstico:', 'blue');
  log('─'.repeat(50), 'blue');
  log(
    `String de Conexão: ${results.connectionString ? '✅ OK' : '❌ FALHOU'}`,
    results.connectionString ? 'green' : 'red'
  );
  log(
    `Resolução DNS: ${results.dns ? '✅ OK' : '❌ FALHOU'}`,
    results.dns ? 'green' : 'red'
  );
  log(
    `Conexão Direta: ${results.connection ? '✅ OK' : '❌ FALHOU'}`,
    results.connection ? 'green' : 'red'
  );
  log('─'.repeat(50), 'blue');

  if (results.connection) {
    log('\n✨ Todos os testes de conectividade passaram!', 'green');
    log(
      'Você pode executar os testes completos com: npm run test:supabase',
      'cyan'
    );
  } else {
    log('\n⚠️  Problemas de conectividade detectados.', 'yellow');
    log('Verifique as mensagens acima para mais detalhes.', 'yellow');
  }

  process.exit(results.connection ? 0 : 1);
}

runDiagnostics().catch((error) => {
  logError(`\n❌ Erro fatal no diagnóstico: ${error.message}`);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});


























