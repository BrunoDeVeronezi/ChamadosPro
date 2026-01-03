/**
 * Script completo para criar empresa e perfis de teste
 * Execute: node scripts/criar-empresa-e-perfis-teste.js
 *
 * Requer variáveis de ambiente:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { randomBytes, pbkdf2Sync } from 'crypto';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '❌ Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env'
  );
  process.exit(1);
}

function generatePasswordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function createCompanyAndProfiles() {
  console.log('🚀 Criando empresa e perfis de teste...\n');

  let empresaId = generateUUID();
  const empresaEmail = 'empresa@teste.com';
  const empresaSenha = '123456';
  const empresaHash = generatePasswordHash(empresaSenha);

  // 1. Criar empresa
  console.log('📝 Criando empresa...');
  const empresaResponse = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      id: empresaId,
      email: empresaEmail,
      role: 'company',
      first_name: 'Empresa',
      last_name: 'Teste',
      company_name: 'Empresa Teste LTDA',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });

  if (!empresaResponse.ok) {
    // Verificar se já existe
    const existingResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${empresaEmail}&select=id`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (existingResponse.ok) {
      const existing = await existingResponse.json();
      if (existing && existing.length > 0) {
        console.log('✅ Empresa já existe, usando ID existente');
        empresaId = existing[0].id;
      } else {
        const errorText = await empresaResponse.text();
        console.error('❌ Erro ao criar empresa:', errorText);
        return;
      }
    } else {
      const errorText = await empresaResponse.text();
      console.error('❌ Erro ao criar empresa:', errorText);
      return;
    }
  } else {
    const empresa = await empresaResponse.json();
    empresaId = empresa.id || empresaId;
    console.log('✅ Empresa criada:', empresaId);
  }

  // 2. Criar credencial da empresa
  console.log('🔐 Criando credencial da empresa...');
  const credResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_credentials`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      id: generateUUID(),
      user_id: empresaId,
      password_hash: empresaHash,
      provider: 'email',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });

  if (!credResponse.ok) {
    const errorText = await credResponse.text();
    if (
      !errorText.includes('duplicate') &&
      !errorText.includes('already exists')
    ) {
      console.error('❌ Erro ao criar credencial:', errorText);
    } else {
      console.log('✅ Credencial já existe ou criada');
    }
  } else {
    console.log('✅ Credencial criada');
  }

  // 3. Criar perfil operacional
  console.log('👤 Criando perfil operacional...');
  const operacionalHash = generatePasswordHash('operacional123');
  const opResponse = await fetch(`${SUPABASE_URL}/rest/v1/company_profiles`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      id: generateUUID(),
      company_id: empresaId,
      role: 'operational',
      email: 'operacional@teste.com',
      password_hash: operacionalHash,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });

  if (!opResponse.ok) {
    const errorText = await opResponse.text();
    if (
      !errorText.includes('duplicate') &&
      !errorText.includes('already exists')
    ) {
      console.error('❌ Erro ao criar perfil operacional:', errorText);
    } else {
      console.log('✅ Perfil operacional já existe ou criado');
    }
  } else {
    console.log('✅ Perfil operacional criado');
  }

  // 4. Criar perfil financeiro
  console.log('💰 Criando perfil financeiro...');
  const financeiroHash = generatePasswordHash('financeiro123');
  const finResponse = await fetch(`${SUPABASE_URL}/rest/v1/company_profiles`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      id: generateUUID(),
      company_id: empresaId,
      role: 'financial',
      email: 'financeiro@teste.com',
      password_hash: financeiroHash,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });

  if (!finResponse.ok) {
    const errorText = await finResponse.text();
    if (
      !errorText.includes('duplicate') &&
      !errorText.includes('already exists')
    ) {
      console.error('❌ Erro ao criar perfil financeiro:', errorText);
    } else {
      console.log('✅ Perfil financeiro já existe ou criado');
    }
  } else {
    console.log('✅ Perfil financeiro criado');
  }

  console.log('\n========================================');
  console.log('✅ CREDENCIAIS DE TESTE CRIADAS:');
  console.log('========================================');
  console.log('Empresa:');
  console.log('  Email: empresa@teste.com');
  console.log('  Senha: 123456');
  console.log('');
  console.log('Perfil Operacional:');
  console.log('  Email: operacional@teste.com');
  console.log('  Senha: operacional123');
  console.log('');
  console.log('Perfil Financeiro:');
  console.log('  Email: financeiro@teste.com');
  console.log('  Senha: financeiro123');
  console.log('========================================\n');
}

createCompanyAndProfiles().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
