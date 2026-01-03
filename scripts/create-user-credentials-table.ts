/**
 * Script para criar a tabela user_credentials no Supabase
 *
 * Execute este script se a tabela não foi criada automaticamente pelo drizzle push
 */

import { supabase } from '../server/supabase-client';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function createUserCredentialsTable() {
  try {
    console.log('🚀 Criando tabela user_credentials...\n');

    // Ler o SQL
    const sqlPath = join(__dirname, 'create-user-credentials-table.sql');
    const sql = await readFile(sqlPath, 'utf-8');

    // Executar SQL no Supabase
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Se o RPC não existir, tentar executar diretamente
      console.log('⚠️ RPC não disponível, tentando método alternativo...\n');
      console.log(
        '📝 Por favor, execute o SQL manualmente no SQL Editor do Supabase:\n'
      );
      console.log('='.repeat(60));
      console.log(sql);
      console.log('='.repeat(60));
      console.log('\n💡 Instruções:');
      console.log('1. Acesse: https://supabase.com/dashboard');
      console.log('2. Selecione seu projeto');
      console.log('3. Vá em SQL Editor');
      console.log('4. Cole o SQL acima e execute');
      return;
    }

    console.log('✅ Tabela user_credentials criada com sucesso!\n');
    console.log('📋 Próximo passo: Execute o script de criação de usuários:');
    console.log('   npx tsx scripts/create-default-users.ts\n');
  } catch (error: any) {
    console.error('❌ Erro ao criar tabela:', error.message);
    console.log('\n📝 Execute o SQL manualmente no SQL Editor do Supabase:\n');
    const sqlPath = join(__dirname, 'create-user-credentials-table.sql');
    const sql = await readFile(sqlPath, 'utf-8');
    console.log(sql);
  }
}

createUserCredentialsTable()
  .then(() => {
    console.log('✅ Processo concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });



















