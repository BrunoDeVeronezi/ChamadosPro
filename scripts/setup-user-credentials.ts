/**
 * Script para criar a tabela user_credentials e os usuários padrão
 */

import { supabase } from '../server/supabase-client';
import { storage } from '../server/storage';
import { randomUUID, pbkdf2Sync, randomBytes } from 'crypto';

async function setupUserCredentials() {
  try {
    console.log('🚀 Configurando user_credentials...\n');

    // Criar tabela usando SQL direto
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.user_credentials (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
        password_hash TEXT,
        provider TEXT NOT NULL DEFAULT 'email',
        provider_id TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON public.user_credentials(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_credentials_provider ON public.user_credentials(provider);

      ALTER TABLE IF EXISTS public.user_credentials DISABLE ROW LEVEL SECURITY;
    `;

    // Tentar executar via query direta (pode não funcionar, mas vamos tentar)
    console.log('📦 Tentando criar tabela user_credentials...');

    // Como o Supabase client não permite executar SQL arbitrário diretamente,
    // vamos apenas verificar se a tabela existe e criar os usuários
    // O usuário precisará executar o SQL manualmente no SQL Editor

    console.log('⚠️  O Supabase client não permite executar DDL diretamente.');
    console.log(
      '📝 Por favor, execute o SQL abaixo no SQL Editor do Supabase:\n'
    );
    console.log('='.repeat(70));
    console.log(createTableSQL);
    console.log('='.repeat(70));
    console.log('\n💡 Instruções:');
    console.log('1. Acesse: https://supabase.com/dashboard');
    console.log('2. Selecione seu projeto');
    console.log(
      '3. Vá em SQL Editor (ícone de banco de dados no menu lateral)'
    );
    console.log('4. Cole o SQL acima');
    console.log('5. Clique em "Run" ou pressione Ctrl+Enter\n');
    console.log('⏳ Aguardando você executar o SQL...');
    console.log('   (Pressione Enter após executar o SQL no Supabase)\n');

    // Aguardar um pouco para o usuário executar o SQL
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Agora criar os usuários
    console.log('👤 Criando usuários padrão...\n');

    // Criar usuário técnico
    const tecnicoEmail = 'tecnico@tecnico.com';
    const tecnicoPassword = 'tecnico123';

    let tecnicoUser = await storage.getUserByEmail(tecnicoEmail);

    if (!tecnicoUser) {
      const tecnicoId = randomUUID();
      tecnicoUser = await storage.upsertUser({
        id: tecnicoId,
        email: tecnicoEmail,
        firstName: 'Técnico',
        lastName: 'Teste',
        role: 'technician',
      });

      const tecnicoSalt = randomBytes(16).toString('hex');
      const tecnicoPasswordHash = pbkdf2Sync(
        tecnicoPassword,
        tecnicoSalt,
        10000,
        64,
        'sha512'
      ).toString('hex');
      const tecnicoFullHash = `${tecnicoSalt}:${tecnicoPasswordHash}`;

      const { error: tecnicoCredError } = await supabase
        .from('user_credentials')
        .insert({
          id: randomUUID(),
          user_id: tecnicoId,
          password_hash: tecnicoFullHash,
          provider: 'email',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (tecnicoCredError) {
        console.error(
          '❌ Erro ao criar credenciais do técnico:',
          tecnicoCredError
        );
        console.error(
          '   Certifique-se de que a tabela user_credentials foi criada!\n'
        );
      } else {
        console.log('✅ Usuário técnico criado:', tecnicoEmail);
      }
    } else {
      console.log('ℹ️  Usuário técnico já existe:', tecnicoEmail);

      // Verificar se tem credenciais
      const { data: existingCreds } = await supabase
        .from('user_credentials')
        .select('id')
        .eq('user_id', tecnicoUser.id)
        .maybeSingle();

      if (!existingCreds) {
        console.log('   ⚠️  Mas não tem credenciais. Criando...');
        const tecnicoSalt = randomBytes(16).toString('hex');
        const tecnicoPasswordHash = pbkdf2Sync(
          tecnicoPassword,
          tecnicoSalt,
          10000,
          64,
          'sha512'
        ).toString('hex');
        const tecnicoFullHash = `${tecnicoSalt}:${tecnicoPasswordHash}`;

        const { error } = await supabase.from('user_credentials').insert({
          id: randomUUID(),
          user_id: tecnicoUser.id,
          password_hash: tecnicoFullHash,
          provider: 'email',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (error) {
          console.error('   ❌ Erro:', error.message);
        } else {
          console.log('   ✅ Credenciais criadas!');
        }
      }
    }

    // Criar usuário empresa
    const empresaEmail = 'empresa@empresa.com';
    const empresaPassword = 'empres123';

    let empresaUser = await storage.getUserByEmail(empresaEmail);

    if (!empresaUser) {
      const empresaId = randomUUID();
      empresaUser = await storage.upsertUser({
        id: empresaId,
        email: empresaEmail,
        firstName: 'Empresa',
        lastName: 'Teste',
        role: 'company',
      });

      const empresaSalt = randomBytes(16).toString('hex');
      const empresaPasswordHash = pbkdf2Sync(
        empresaPassword,
        empresaSalt,
        10000,
        64,
        'sha512'
      ).toString('hex');
      const empresaFullHash = `${empresaSalt}:${empresaPasswordHash}`;

      const { error: empresaCredError } = await supabase
        .from('user_credentials')
        .insert({
          id: randomUUID(),
          user_id: empresaId,
          password_hash: empresaFullHash,
          provider: 'email',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (empresaCredError) {
        console.error(
          '❌ Erro ao criar credenciais da empresa:',
          empresaCredError
        );
        console.error(
          '   Certifique-se de que a tabela user_credentials foi criada!\n'
        );
      } else {
        console.log('✅ Usuário empresa criado:', empresaEmail);
      }
    } else {
      console.log('ℹ️  Usuário empresa já existe:', empresaEmail);

      // Verificar se tem credenciais
      const { data: existingCreds } = await supabase
        .from('user_credentials')
        .select('id')
        .eq('user_id', empresaUser.id)
        .maybeSingle();

      if (!existingCreds) {
        console.log('   ⚠️  Mas não tem credenciais. Criando...');
        const empresaSalt = randomBytes(16).toString('hex');
        const empresaPasswordHash = pbkdf2Sync(
          empresaPassword,
          empresaSalt,
          10000,
          64,
          'sha512'
        ).toString('hex');
        const empresaFullHash = `${empresaSalt}:${empresaPasswordHash}`;

        const { error } = await supabase.from('user_credentials').insert({
          id: randomUUID(),
          user_id: empresaUser.id,
          password_hash: empresaFullHash,
          provider: 'email',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (error) {
          console.error('   ❌ Erro:', error.message);
        } else {
          console.log('   ✅ Credenciais criadas!');
        }
      }
    }

    console.log('\n📋 Credenciais de acesso:');
    console.log('Técnico:');
    console.log('  Email: tecnico@tecnico.com');
    console.log('  Senha: tecnico123');
    console.log('\nEmpresa:');
    console.log('  Email: empresa@empresa.com');
    console.log('  Senha: empres123');
    console.log('\n✅ Processo concluído!\n');
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    console.error('\n💡 Certifique-se de que:');
    console.error('   1. A tabela user_credentials foi criada no Supabase');
    console.error('   2. O DATABASE_URL está configurado corretamente');
    console.error('   3. As credenciais do Supabase estão corretas\n');
    process.exit(1);
  }
}

setupUserCredentials()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });



















