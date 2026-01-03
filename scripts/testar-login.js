/**
 * Script para testar o login unificado
 * Execute: node scripts/testar-login.js
 */

import 'dotenv/config';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5180';

const credenciais = [
  {
    nome: 'Empresa (Tenant Principal)',
    email: 'empresa@teste.com',
    password: '123456',
  },
  {
    nome: 'Perfil Operacional',
    email: 'operacional@teste.com',
    password: 'operacional123',
  },
  {
    nome: 'Perfil Financeiro',
    email: 'financeiro@teste.com',
    password: 'financeiro123',
  },
];

async function testarLogin(credencial) {
  console.log(`\n🧪 Testando: ${credencial.nome}`);
  console.log(`   Email: ${credencial.email}`);

  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: credencial.email,
        password: credencial.password,
      }),
      credentials: 'include', // Importante para cookies
    });

    const data = await response.json();

    if (response.ok) {
      console.log('   ✅ SUCESSO!');
      console.log('   Resposta:', JSON.stringify(data, null, 2));
      console.log('   Status:', response.status);
      console.log('   Cookies:', response.headers.get('set-cookie') ? 'Criados' : 'Não criados');
    } else {
      console.log('   ❌ ERRO!');
      console.log('   Status:', response.status);
      console.log('   Resposta:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('   ❌ ERRO DE CONEXÃO!');
    console.log('   Erro:', error.message);
    console.log('   Verifique se o servidor está rodando em', BASE_URL);
  }
}

async function testarTodos() {
  console.log('🚀 Iniciando testes de login...');
  console.log('========================================\n');

  for (const credencial of credenciais) {
    await testarLogin(credencial);
    // Pequeno delay entre testes
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log('\n========================================');
  console.log('✅ Testes concluídos!');
  console.log('========================================\n');
}

testarTodos().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

