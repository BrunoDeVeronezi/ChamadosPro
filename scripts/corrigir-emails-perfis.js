/**
 * Script para corrigir emails dos perfis
 * Execute: node scripts/corrigir-emails-perfis.js
 */

import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '❌ Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env'
  );
  process.exit(1);
}

async function corrigirEmails() {
  console.log('🔧 Corrigindo emails dos perfis...\n');

  // Buscar empresa
  const empresaResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/users?email=eq.empresa@teste.com&select=id`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  const empresas = await empresaResponse.json();
  if (!empresas || empresas.length === 0) {
    console.log('❌ Empresa não encontrada!');
    return;
  }

  const empresaId = empresas[0].id;
  console.log('✅ Empresa encontrada:', empresaId);

  // Atualizar email do perfil operacional
  console.log('\n📝 Atualizando perfil operacional...');
  const operacionalResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/company_profiles?company_id=eq.${empresaId}&role=eq.operational`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        email: 'operacional@teste.com',
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (operacionalResponse.ok) {
    console.log(
      '   ✅ Email atualizado: operational@teste.com → operacional@teste.com'
    );
  } else {
    const error = await operacionalResponse.text();
    console.log('   ❌ Erro:', error);
  }

  // Atualizar email do perfil financeiro
  console.log('\n📝 Atualizando perfil financeiro...');
  const financeiroResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/company_profiles?company_id=eq.${empresaId}&role=eq.financial`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        email: 'financeiro@teste.com',
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (financeiroResponse.ok) {
    console.log(
      '   ✅ Email atualizado: financial@teste.com → financeiro@teste.com'
    );
  } else {
    const error = await financeiroResponse.text();
    console.log('   ❌ Erro:', error);
  }

  console.log('\n✅ Correção concluída!');
  console.log('\n📋 Credenciais atualizadas:');
  console.log('   Operacional: operacional@teste.com / operacional123');
  console.log('   Financeiro: financeiro@teste.com / financeiro123');
}

corrigirEmails().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
