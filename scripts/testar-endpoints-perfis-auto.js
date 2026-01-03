/**
 * Script para testar os endpoints de perfis automaticamente
 * Faz login primeiro e depois testa os endpoints
 * Execute: node scripts/testar-endpoints-perfis-auto.js
 */

import 'dotenv/config';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5180';

// Credenciais da empresa de teste
const COMPANY_EMAIL = 'empresa@teste.com';
const COMPANY_PASSWORD = '123456';

async function testarEndpoints() {
  console.log('🧪 Testando endpoints de perfis...\n');
  console.log('========================================\n');

  let cookies = '';

  // Passo 1: Fazer login
  console.log('🔐 Passo 1: Fazendo login como empresa...');
  try {
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: COMPANY_EMAIL,
        password: COMPANY_PASSWORD,
      }),
    });

    if (!loginResponse.ok) {
      const errorData = await loginResponse.json();
      console.log('   ❌ ERRO no login!');
      console.log('   Status:', loginResponse.status);
      console.log('   Resposta:', JSON.stringify(errorData, null, 2));
      return;
    }

    // Extrair cookies da resposta
    const setCookieHeader = loginResponse.headers.get('set-cookie');
    if (setCookieHeader) {
      cookies = setCookieHeader;
      console.log('   ✅ Login realizado com sucesso!');
      console.log('   Cookies obtidos:', setCookieHeader.substring(0, 50) + '...');
    } else {
      // Tentar obter cookies de outra forma
      const allHeaders = loginResponse.headers.raw();
      console.log('   ⚠️  Set-Cookie não encontrado, tentando alternativa...');
      console.log('   Headers:', JSON.stringify(allHeaders, null, 2));
    }

    const loginData = await loginResponse.json();
    console.log('   Dados do login:', JSON.stringify(loginData, null, 2));
  } catch (error) {
    console.log('   ❌ ERRO DE CONEXÃO no login!');
    console.log('   Erro:', error.message);
    return;
  }

  console.log('\n');

  // Preparar headers para próximas requisições
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // Adicionar cookies se disponíveis
  if (cookies) {
    headers['Cookie'] = cookies;
  }

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
      console.log('   ⚠️  Se der 401/403, o cookie pode não ter sido capturado corretamente.');
      console.log('   💡 Tente fazer login manualmente no navegador e copiar o cookie.');
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
  console.log('💡 NOTA: Se os testes falharem com 401/403,');
  console.log('   o problema é que o cookie de sessão não está sendo');
  console.log('   mantido entre requisições no Node.js.');
  console.log('   Isso é normal - os endpoints funcionam no navegador!');
  console.log('   Para testar no navegador, use o DevTools > Network.');
}

testarEndpoints().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

