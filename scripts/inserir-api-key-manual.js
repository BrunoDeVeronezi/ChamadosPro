/**
 * Script para inserir manualmente a API key de uma subconta Asaas
 * 
 * Uso:
 *   node scripts/inserir-api-key-manual.js <email> <api-key>
 * 
 * Exemplo:
 *   node scripts/inserir-api-key-manual.js contatestebveronezi@gmail.com $aact_hmlg_...
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local', override: true });
dotenv.config();

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '❌ Erro: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configurados no .env'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const email = process.argv[2];
  const apiKey = process.argv[3];

  if (!email || !apiKey) {
    console.error('❌ Uso: node scripts/inserir-api-key-manual.js <email> <api-key>');
    console.error('');
    console.error('Exemplo:');
    console.error('  node scripts/inserir-api-key-manual.js contatestebveronezi@gmail.com $aact_hmlg_...');
    process.exit(1);
  }

  console.log(`🔍 Buscando usuário: ${email}`);

  // Buscar usuário
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, email, asaas_customer_id, asaas_wallet_id')
    .eq('email', email)
    .single();

  if (fetchError || !user) {
    console.error('❌ Erro ao buscar usuário:', fetchError?.message || 'Usuário não encontrado');
    process.exit(1);
  }

  console.log(`✅ Usuário encontrado: ${user.email}`);
  console.log(`   Customer ID: ${user.asaas_customer_id || 'N/A'}`);
  console.log(`   Wallet ID: ${user.asaas_wallet_id || 'N/A'}`);
  console.log('');

  // Atualizar API key
  console.log('🔄 Atualizando API key no banco de dados...');

  const { error: updateError } = await supabase
    .from('users')
    .update({
      asaas_api_key: apiKey,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('❌ Erro ao atualizar API key:', updateError.message);
    process.exit(1);
  }

  console.log('✅ API key atualizada com sucesso!');
  console.log('');
  console.log('📋 Resumo:');
  console.log(`   Email: ${user.email}`);
  console.log(`   Customer ID: ${user.asaas_customer_id || 'N/A'}`);
  console.log(`   Wallet ID: ${user.asaas_wallet_id || 'N/A'}`);
  console.log(`   API Key: ${apiKey.substring(0, 20)}...`);
  console.log('');
  console.log('🎉 Pronto! Agora você pode testar o envio por WhatsApp.');
}

main().catch((error) => {
  console.error('❌ Erro:', error);
  process.exit(1);
});

