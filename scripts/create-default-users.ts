import { storage } from '../server/storage';
import { supabase } from '../server/supabase-client';
import { randomUUID, pbkdf2Sync, randomBytes } from 'crypto';

async function createDefaultUsers() {
  try {
    // Criar usuário técnico
    const tecnicoEmail = 'tecnico@tecnico.com';
    const tecnicoPassword = 'tecnico123';

    // Verificar se já existe
    let tecnicoUser = await storage.getUserByEmail(tecnicoEmail);

    // Se existe mas tem role errado, corrigir primeiro
    if (tecnicoUser && tecnicoUser.role !== 'technician') {
      console.log('⚠️  Corrigindo role do técnico existente...');
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'technician' })
        .eq('id', tecnicoUser.id);
      if (updateError) {
        console.error('   ❌ Erro ao atualizar role:', updateError.message);
      } else {
        console.log('   ✅ Role corrigido para: technician');
      }
      // Recarregar o usuário
      tecnicoUser = await storage.getUserByEmail(tecnicoEmail);
    }

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
          'Erro ao criar credenciais do técnico:',
          tecnicoCredError
        );
      } else {
        console.log('✅ Usuário técnico criado:', tecnicoEmail);
      }
    } else {
      console.log('ℹ️ Usuário técnico já existe:', tecnicoEmail);
      console.log(`   Role atual: ${tecnicoUser.role}`);
      // Garantir que o role está correto (verificação dupla)
      if (tecnicoUser.role !== 'technician') {
        console.log('   ⚠️  Corrigindo role para technician...');
        const { error: updateError } = await supabase
          .from('users')
          .update({ role: 'technician' })
          .eq('id', tecnicoUser.id);
        if (updateError) {
          console.error('   ❌ Erro ao atualizar:', updateError.message);
        } else {
          console.log('   ✅ Role corrigido!');
        }
      } else {
        console.log('   ✅ Role já está correto!');
      }
    }

    // Criar usuário empresa
    const empresaEmail = 'empresa@empresa.com';
    const empresaPassword = 'empres123';

    // Verificar se já existe
    let empresaUser = await storage.getUserByEmail(empresaEmail);

    // Se existe mas tem role errado, corrigir primeiro
    if (empresaUser && empresaUser.role !== 'company') {
      console.log('⚠️  Corrigindo role da empresa existente...');
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'company' })
        .eq('id', empresaUser.id);
      if (updateError) {
        console.error('   ❌ Erro ao atualizar role:', updateError.message);
      } else {
        console.log('   ✅ Role corrigido para: company');
      }
      // Recarregar o usuário
      empresaUser = await storage.getUserByEmail(empresaEmail);
    }

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
          'Erro ao criar credenciais da empresa:',
          empresaCredError
        );
      } else {
        console.log('✅ Usuário empresa criado:', empresaEmail);
      }
    } else {
      console.log('ℹ️ Usuário empresa já existe:', empresaEmail);
      console.log(`   Role atual: ${empresaUser.role}`);
      // Garantir que o role está correto (verificação dupla)
      if (empresaUser.role !== 'company') {
        console.log('   ⚠️  Corrigindo role para company...');
        const { error: updateError } = await supabase
          .from('users')
          .update({ role: 'company' })
          .eq('id', empresaUser.id);
        if (updateError) {
          console.error('   ❌ Erro ao atualizar:', updateError.message);
        } else {
          console.log('   ✅ Role corrigido!');
        }
      } else {
        console.log('   ✅ Role já está correto!');
      }
    }

    console.log('\n📋 Credenciais de acesso:');
    console.log('Técnico:');
    console.log('  Email: tecnico@tecnico.com');
    console.log('  Senha: tecnico123');
    console.log('\nEmpresa:');
    console.log('  Email: empresa@empresa.com');
    console.log('  Senha: empres123');
  } catch (error) {
    console.error('Erro ao criar usuários:', error);
    process.exit(1);
  }
}

createDefaultUsers()
  .then(() => {
    console.log('\n✅ Processo concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });



















