/**
 * Script para testar os endpoints de perfis
 * Execute: node scripts/testar-endpoints-perfis.js
 * 
 * IMPORTANTE: Você precisa estar logado como empresa primeiro!
 * Use o script de teste de login para obter os cookies de sessão.
 */

import 'dotenv/config';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5180';

// Substitua pelos cookies de sessão obtidos após login como empresa
// Para obter: faça login manualmente no navegador e copie os cookies
const SESSION_COOKIE = process.env.SESSION_COOKIE || '';

// Substitua pelo ID da empresa de teste
const COMPANY_ID = process.env.COMPANY_ID || '';

async function testarEndpoints() {
  console.log('🧪 Testando endpoints de perfis...\n');
  console.log('========================================\n');

  if (!SESSION_COOKIE) {
    console.log('❌ ERRO: SESSION_COOKIE não definido!');
    console.log('   Faça login como empresa e copie o cookie de sessão.');
    console.log('   Exemplo: export SESSION_COOKIE="connect.sid=s%3A..."');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Cookie: SESSION_COOKIE,
  };

  // Teste 1: Listar perfis
  console.log('📋 Teste 1: GET /api/company/profiles');
  try {
    const response = await fetch(`${BASE_URL}/api/company/profiles`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    const data = await response.json();
    if (response.ok) {
      console.log('   ✅ SUCESSO!');
      console.log('   Perfis encontrados:', data.length);
      console.log('   Dados:', JSON.stringify(data, null, 2));
    } else {
      console.log('   ❌ ERRO!');
      console.log('   Status:', response.status);
      console.log('   Resposta:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('   ❌ ERRO DE CONEXÃO!');
    console.log('   Erro:', error.message);
  }

  console.log('\n');

  // Teste 2: Criar perfil operacional
  console.log('📋 Teste 2: POST /api/company/profiles (operational)');
  try {
    const response = await fetch(`${BASE_URL}/api/company/profiles`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        role: 'operational',
        password: 'operacional123',
      }),
    });

    const data = await response.json();
    if (response.ok) {
      console.log('   ✅ SUCESSO!');
      console.log('   Perfil criado:', JSON.stringify(data, null, 2));
      if (data.tempPassword) {
        console.log('   ⚠️  Senha temporária gerada:', data.tempPassword);
      }
    } else {
      console.log('   ❌ ERRO!');
      console.log('   Status:', response.status);
      console.log('   Resposta:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('   ❌ ERRO DE CONEXÃO!');
    console.log('   Erro:', error.message);
  }

  console.log('\n');

  // Teste 3: Criar perfil financeiro
  console.log('📋 Teste 3: POST /api/company/profiles (financial)');
  try {
    const response = await fetch(`${BASE_URL}/api/company/profiles`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        role: 'financial',
        password: 'financeiro123',
      }),
    });

    const data = await response.json();
    if (response.ok) {
      console.log('   ✅ SUCESSO!');
      console.log('   Perfil criado:', JSON.stringify(data, null, 2));
      if (data.tempPassword) {
        console.log('   ⚠️  Senha temporária gerada:', data.tempPassword);
      }
    } else {
      console.log('   ❌ ERRO!');
      console.log('   Status:', response.status);
      console.log('   Resposta:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('   ❌ ERRO DE CONEXÃO!');
    console.log('   Erro:', error.message);
  }

  console.log('\n');

  // Teste 4: Listar perfis novamente (deve ter 2 agora)
  console.log('📋 Teste 4: GET /api/company/profiles (verificar criação)');
  try {
    const response = await fetch(`${BASE_URL}/api/company/profiles`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    const data = await response.json();
    if (response.ok) {
      console.log('   ✅ SUCESSO!');
      console.log('   Total de perfis:', data.length);
      console.log('   Perfis:', JSON.stringify(data, null, 2));
    } else {
      console.log('   ❌ ERRO!');
      console.log('   Status:', response.status);
      console.log('   Resposta:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('   ❌ ERRO DE CONEXÃO!');
    console.log('   Erro:', error.message);
  }

  console.log('\n========================================');
  console.log('✅ Testes concluídos!');
  console.log('========================================\n');
  console.log('💡 DICA: Para testar PUT e DELETE, use o ID de um perfil criado.');
}

testarEndpoints().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

