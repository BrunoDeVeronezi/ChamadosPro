/**
 * Script para verificar dados dos tenants necessários para criar subconta Asaas
 *
 * Uso:
 *   node scripts/check-tenant-data.js
 *
 * Este script verifica quais tenants têm todos os dados necessários
 * para criar subconta real no Asaas (com API key).
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
  console.log('🔍 Verificando dados dos tenants...\n');

  // Buscar todos os tenants
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .neq('role', 'super_admin')
    .not('email', 'is', null);

  if (error) {
    console.error('❌ Erro ao buscar tenants:', error);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('ℹ️ Nenhum tenant encontrado.');
    process.exit(0);
  }

  console.log(`📊 Total de tenants: ${users.length}\n`);
  console.log('='.repeat(80));

  const results = {
    ready: [], // Prontos para criar subconta
    missingDocument: [], // Faltando CPF/CNPJ
    missingAddress: [], // Faltando endereço completo
    hasApiKey: [], // Já tem API key
  };

  for (const tenant of users) {
    const tenantName =
      tenant.company_name ||
      [tenant.first_name, tenant.last_name].filter(Boolean).join(' ') ||
      tenant.email ||
      tenant.id;

    // Verificar se já tem API key
    if (tenant.asaas_api_key) {
      results.hasApiKey.push({
        email: tenant.email,
        name: tenantName,
      });
      continue;
    }

    // Buscar CNPJ na tabela company_data se não tiver
    let document = tenant.cpf;
    if (!document) {
      const { data: companyData } = await supabase
        .from('company_data')
        .select('cnpj, cnpj_clean, cpf')
        .eq('user_id', tenant.id)
        .single();

      if (companyData) {
        document =
          companyData.cnpj_clean || companyData.cnpj || companyData.cpf;
      }
    }

    // Se ainda não tem, tentar cnpj direto na tabela users (se existir)
    if (!document && tenant.cnpj) {
      document = tenant.cnpj;
    }

    // Limpar formatação do documento
    if (document) {
      document = document.replace(/\D/g, '');
    }

    const isCNPJ = document && document.length === 14;
    const isCPF = document && document.length === 11;
    const hasDocument = isCNPJ || isCPF;

    // Verificar endereço completo
    const hasAddress =
      tenant.zip_code &&
      tenant.street_address &&
      tenant.address_number &&
      tenant.neighborhood &&
      tenant.city &&
      tenant.state;

    const status = {
      email: tenant.email,
      name: tenantName,
      hasDocument,
      document: hasDocument ? (isCNPJ ? 'CNPJ' : 'CPF') : 'FALTANDO',
      documentValue: document
        ? `${document.substring(0, 3)}***${document.substring(
            document.length - 3
          )}`
        : null,
      hasAddress,
      hasApiKey: !!tenant.asaas_api_key,
      hasWalletId: !!tenant.asaas_wallet_id,
      hasCustomerId: !!tenant.asaas_customer_id,
    };

    if (hasDocument && hasAddress) {
      results.ready.push(status);
    } else if (!hasDocument) {
      results.missingDocument.push(status);
    } else if (!hasAddress) {
      results.missingAddress.push(status);
    }
  }

  // Mostrar resultados
  console.log('\n✅ TENANTS COM API KEY (já configurados):');
  console.log('='.repeat(80));
  if (results.hasApiKey.length === 0) {
    console.log('  Nenhum tenant tem API key ainda.\n');
  } else {
    results.hasApiKey.forEach((t) => {
      console.log(`  ✅ ${t.name} (${t.email})`);
    });
    console.log(`\n  Total: ${results.hasApiKey.length}\n`);
  }

  console.log('\n✅ TENANTS PRONTOS PARA CRIAR SUBCONTA:');
  console.log('='.repeat(80));
  if (results.ready.length === 0) {
    console.log('  Nenhum tenant está pronto.\n');
  } else {
    results.ready.forEach((t) => {
      console.log(`  ✅ ${t.name} (${t.email})`);
      console.log(`     Documento: ${t.document} ${t.documentValue}`);
      console.log(`     Endereço: ✅ Completo`);
    });
    console.log(`\n  Total: ${results.ready.length}`);
    console.log(
      `  💡 Execute: npm run sync:asaas para criar subcontas para estes tenants\n`
    );
  }

  console.log('\n⚠️ TENANTS FALTANDO CPF/CNPJ:');
  console.log('='.repeat(80));
  if (results.missingDocument.length === 0) {
    console.log('  Nenhum tenant está faltando documento.\n');
  } else {
    results.missingDocument.forEach((t) => {
      console.log(`  ⚠️ ${t.name} (${t.email})`);
      console.log(`     Documento: ❌ FALTANDO`);
      console.log(
        `     Endereço: ${t.hasAddress ? '✅' : '⚠️'} ${
          t.hasAddress ? 'Completo' : 'Incompleto'
        }`
      );
      console.log(
        `     💡 Ação: Adicione CPF ou CNPJ na tabela users.cpf ou company_data.cnpj`
      );
    });
    console.log(`\n  Total: ${results.missingDocument.length}`);
    console.log(
      `  ⚠️ Estes tenants NÃO podem ter subconta real sem CPF/CNPJ.\n`
    );
  }

  console.log('\n⚠️ TENANTS FALTANDO ENDEREÇO COMPLETO:');
  console.log('='.repeat(80));
  if (results.missingAddress.length === 0) {
    console.log('  Nenhum tenant está faltando endereço.\n');
  } else {
    results.missingAddress.forEach((t) => {
      console.log(`  ⚠️ ${t.name} (${t.email})`);
      console.log(`     Documento: ✅ ${t.document} ${t.documentValue}`);
      console.log(`     Endereço: ❌ Incompleto`);
      console.log(
        `     💡 Ação: Complete o endereço (CEP, rua, número, bairro, cidade, estado)`
      );
    });
    console.log(`\n  Total: ${results.missingAddress.length}`);
    console.log(
      `  ⚠️ Estes tenants podem ter subconta criada, mas é recomendado ter endereço completo.\n`
    );
  }

  // Resumo final
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESUMO');
  console.log('='.repeat(80));
  console.log(`Total de tenants:           ${users.length}`);
  console.log(`Já têm API key:             ${results.hasApiKey.length}`);
  console.log(`Prontos para criar:         ${results.ready.length}`);
  console.log(`Faltando CPF/CNPJ:          ${results.missingDocument.length}`);
  console.log(`Faltando endereço:          ${results.missingAddress.length}`);
  console.log('='.repeat(80));

  if (results.ready.length > 0) {
    console.log(
      '\n💡 Execute: npm run sync:asaas para criar subcontas para os tenants prontos.'
    );
  }

  if (results.missingDocument.length > 0) {
    console.log(
      '\n⚠️ ATENÇÃO: Tenants sem CPF/CNPJ NÃO podem ter subconta real.'
    );
    console.log(
      '   Eles serão criados apenas como "customer" (sem API key), e os dados da conta principal continuarão aparecendo nas cobranças.'
    );
  }
}

main().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
