/**
 * Script para testar se a sessão está sendo salva corretamente
 * quando um perfil faz login
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5180';

async function testarLoginPerfil(email, password, nomePerfil) {
  console.log(`\n🧪 Testando login do perfil: ${nomePerfil} (${email})`);
  console.log('='.repeat(60));

  try {
    // 1. Fazer login
    console.log('\n1️⃣ Fazendo login...');
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      redirect: 'manual', // Não seguir redirects
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('❌ Erro no login:', loginResponse.status, errorText);
      return null;
    }

    // Extrair cookies da resposta
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('✅ Login realizado com sucesso');
    console.log('📋 Cookies recebidos:', cookies);

    if (!cookies) {
      console.error('❌ Nenhum cookie recebido!');
      return null;
    }

    // Extrair o cookie de sessão (pode ser connect.sid ou sessionId)
    let sessionCookie = cookies
      .split(',')
      .find((c) => c.trim().startsWith('connect.sid='))
      ?.split(';')[0]
      .trim();

    if (!sessionCookie) {
      // Tentar sessionId
      sessionCookie = cookies
        .split(',')
        .find((c) => c.trim().startsWith('sessionId='))
        ?.split(';')[0]
        .trim();
    }

    if (!sessionCookie) {
      console.error('❌ Cookie de sessão não encontrado!');
      console.error('Cookies disponíveis:', cookies);
      return null;
    }

    console.log('🍪 Cookie de sessão:', sessionCookie.substring(0, 50) + '...');

    // 2. Buscar dados do usuário
    console.log('\n2️⃣ Buscando dados do usuário...');
    const userResponse = await fetch(`${BASE_URL}/api/auth/user`, {
      method: 'GET',
      headers: {
        Cookie: sessionCookie,
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error(
        '❌ Erro ao buscar usuário:',
        userResponse.status,
        errorText
      );
      return null;
    }

    const userData = await userResponse.json();
    console.log('✅ Dados do usuário recebidos:');
    console.log(JSON.stringify(userData, null, 2));

    // 3. Verificar se os dados estão corretos
    console.log('\n3️⃣ Verificando dados...');
    const checks = {
      'ID existe': !!userData.id,
      'Email correto': userData.email === email,
      'Role correto':
        userData.role ===
        (nomePerfil === 'Operacional' ? 'operational' : 'financial'),
      'isProfile é true': userData.isProfile === true,
      'profileId existe': !!userData.profileId,
    };

    console.log('\n📊 Resultados:');
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`  ${passed ? '✅' : '❌'} ${check}: ${passed}`);
    });

    const allPassed = Object.values(checks).every((v) => v);
    if (allPassed) {
      console.log('\n🎉 Todos os testes passaram!');
    } else {
      console.log('\n⚠️ Alguns testes falharam!');
    }

    return { userData, sessionCookie, allPassed };
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
    return null;
  }
}

async function main() {
  console.log('🚀 Iniciando testes de sessão de perfis\n');

  // Testar perfil operacional
  const resultadoOperacional = await testarLoginPerfil(
    'operacional@teste.com',
    'operacional123',
    'Operacional'
  );

  // Aguardar um pouco antes do próximo teste
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Testar perfil financeiro
  const resultadoFinanceiro = await testarLoginPerfil(
    'financeiro@teste.com',
    'financeiro123',
    'Financeiro'
  );

  // Resumo final
  console.log('\n' + '='.repeat(60));
  console.log('📋 RESUMO FINAL');
  console.log('='.repeat(60));
  console.log(
    `Perfil Operacional: ${
      resultadoOperacional?.allPassed ? '✅ PASSOU' : '❌ FALHOU'
    }`
  );
  console.log(
    `Perfil Financeiro: ${
      resultadoFinanceiro?.allPassed ? '✅ PASSOU' : '❌ FALHOU'
    }`
  );
}

main().catch(console.error);
