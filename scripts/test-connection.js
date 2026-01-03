/**
 * Script de Diagnóstico - JavaScript puro
 */

require('dotenv').config();
const dns = require('dns').promises;
const { Pool } = require('pg');
const fs = require('fs');

console.log('=== DIAGNÓSTICO DE CONEXÃO SUPABASE ===\n');

async function runDiagnostics() {
  try {
    // 1. Verificar DATABASE_URL
    console.log('1. Verificando DATABASE_URL...');
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL não está configurado!');
      process.exit(1);
    }
    console.log('✅ DATABASE_URL configurado');
    console.log(`   URL: ${process.env.DATABASE_URL.substring(0, 50)}...`);

    // 2. Parsear URL
    console.log('\n2. Parseando URL de conexão...');
    const url = process.env.DATABASE_URL.replace('postgresql://', 'http://');
    const dbUrl = new URL(url);
    const hostname = dbUrl.hostname;
    const port = dbUrl.port || '5432';

    console.log(`   Hostname: ${hostname}`);
    console.log(`   Porta: ${port}`);

    // 3. Testar DNS
    console.log('\n3. Testando resolução DNS...');
    try {
      const addresses = await dns.resolve4(hostname);
      console.log(`✅ DNS resolvido com sucesso!`);
      console.log(`   IPs: ${addresses.join(', ')}`);
    } catch (error) {
      console.error(`❌ Erro DNS: ${error.message}`);
      console.error(`   Código: ${error.code}`);
      console.error('\n💡 Possíveis soluções:');
      console.error('   1. Verifique se o projeto Supabase está ativo');
      console.error('   2. Verifique sua conexão com a internet');
      console.error('   3. Verifique se há firewall bloqueando');
      process.exit(1);
    }

    // 4. Testar conexão
    console.log('\n4. Testando conexão direta...');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
      connectionTimeoutMillis: 10000,
    });

    try {
      console.log('   Tentando conectar...');
      const result = await pool.query('SELECT 1 as test');

      if (result.rows && result.rows.length > 0) {
        console.log('✅ Conexão estabelecida com sucesso!');
        await pool.end();
        console.log('\n✨ Todos os testes passaram!');
        process.exit(0);
      } else {
        console.error('❌ Conexão estabelecida mas sem resultados');
        await pool.end();
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Erro na conexão: ${error.message}`);
      console.error(`   Código: ${error.code}`);
      if (error.code === 'ENOTFOUND') {
        console.error('\n💡 Possíveis soluções:');
        console.error('   1. Verifique se o projeto Supabase está ativo');
        console.error('   2. Verifique sua conexão com a internet');
        console.error('   3. Verifique se há firewall bloqueando porta 5432');
        console.error('   4. Tente usar VPN ou outra rede');
      }
      await pool.end();
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Erro fatal: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

runDiagnostics();


























