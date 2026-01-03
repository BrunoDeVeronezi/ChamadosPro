/**
 * Script para verificar e recriar perfis se necessário
 * Execute: node scripts/verificar-perfis.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { pbkdf2Sync, randomBytes } from 'crypto';

// Usar as mesmas variáveis do script de criação
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    '❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios!'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verificarPerfis() {
  console.log('🔍 Verificando perfis no banco de dados...\n');

  // Buscar empresa de teste
  const { data: empresas, error: empresasError } = await supabase
    .from('users')
    .select('id, email, company_name')
    .eq('email', 'empresa@teste.com')
    .limit(1);

  if (empresasError || !empresas || empresas.length === 0) {
    console.log('❌ Empresa "empresa@teste.com" não encontrada!');
    console.log(
      '   Execute primeiro: node scripts/criar-empresa-e-perfis-teste.js'
    );
    return;
  }

  const empresa = empresas[0];
  console.log('✅ Empresa encontrada:');
  console.log('   ID:', empresa.id);
  console.log('   Email:', empresa.email);
  console.log('   Nome:', empresa.company_name || 'N/A');
  console.log('\n');

  // Buscar perfis da empresa
  const { data: perfis, error: perfisError } = await supabase
    .from('company_profiles')
    .select('id, role, email, active, created_at')
    .eq('company_id', empresa.id);

  if (perfisError) {
    console.error('❌ Erro ao buscar perfis:', perfisError);
    return;
  }

  console.log(`📋 Perfis encontrados: ${perfis?.length || 0}\n`);

  if (!perfis || perfis.length === 0) {
    console.log('⚠️  Nenhum perfil encontrado!');
    console.log('   Execute: node scripts/criar-empresa-e-perfis-teste.js');
    return;
  }

  perfis.forEach((perfil) => {
    console.log(`   - ${perfil.role}:`);
    console.log(`     Email: ${perfil.email}`);
    console.log(`     Ativo: ${perfil.active ? '✅' : '❌'}`);
    console.log(`     Criado em: ${perfil.created_at}`);
    console.log('');
  });

  // Verificar se os perfis esperados existem
  const operacional = perfis.find((p) => p.role === 'operational');
  const financeiro = perfis.find((p) => p.role === 'financial');

  if (!operacional) {
    console.log('⚠️  Perfil operacional não encontrado!');
    console.log('   Criando perfil operacional...');
    await criarPerfil(
      empresa.id,
      'operational',
      'operacional@teste.com',
      'operacional123'
    );
  } else if (!operacional.active) {
    console.log('⚠️  Perfil operacional está inativo!');
    console.log('   Ativando perfil...');
    await supabase
      .from('company_profiles')
      .update({ active: true })
      .eq('id', operacional.id);
    console.log('   ✅ Perfil operacional ativado!');
  } else {
    console.log('✅ Perfil operacional está OK');
  }

  if (!financeiro) {
    console.log('⚠️  Perfil financeiro não encontrado!');
    console.log('   Criando perfil financeiro...');
    await criarPerfil(
      empresa.id,
      'financial',
      'financeiro@teste.com',
      'financeiro123'
    );
  } else if (!financeiro.active) {
    console.log('⚠️  Perfil financeiro está inativo!');
    console.log('   Ativando perfil...');
    await supabase
      .from('company_profiles')
      .update({ active: true })
      .eq('id', financeiro.id);
    console.log('   ✅ Perfil financeiro ativado!');
  } else {
    console.log('✅ Perfil financeiro está OK');
  }

  console.log('\n✅ Verificação concluída!');
}

async function criarPerfil(companyId, role, email, password) {
  const salt = randomBytes(16).toString('hex');
  const passwordHash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString(
    'hex'
  );
  const fullHash = `${salt}:${passwordHash}`;

  const { data, error } = await supabase
    .from('company_profiles')
    .insert({
      id: crypto.randomUUID(),
      company_id: companyId,
      role,
      email: email.toLowerCase(),
      password_hash: fullHash,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('   ❌ Erro ao criar perfil:', error);
  } else {
    console.log(`   ✅ Perfil ${role} criado com sucesso!`);
    console.log(`      Email: ${email}`);
    console.log(`      Senha: ${password}`);
  }
}

verificarPerfis().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
