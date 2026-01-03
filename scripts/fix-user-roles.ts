/**
 * Script para corrigir os roles dos usuários padrão
 *
 * Este script atualiza os roles dos usuários técnico e empresa
 * para garantir que estejam corretos no banco de dados.
 */

import { storage } from '../server/storage';
import { supabase } from '../server/supabase-client';

async function fixUserRoles() {
  try {
    console.log('🔧 Corrigindo roles dos usuários padrão...\n');

    // Corrigir usuário técnico
    const tecnicoEmail = 'tecnico@tecnico.com';
    const tecnicoUser = await storage.getUserByEmail(tecnicoEmail);

    if (tecnicoUser) {
      console.log(`📋 Usuário técnico encontrado: ${tecnicoEmail}`);
      console.log(`   Role atual: ${tecnicoUser.role}`);

      if (tecnicoUser.role !== 'technician') {
        console.log('   ⚠️  Role incorreto! Corrigindo...');

        const { error } = await supabase
          .from('users')
          .update({ role: 'technician' })
          .eq('id', tecnicoUser.id);

        if (error) {
          console.error('   ❌ Erro ao atualizar:', error.message);
        } else {
          console.log('   ✅ Role corrigido para: technician');
        }
      } else {
        console.log('   ✅ Role já está correto!');
      }
    } else {
      console.log(`⚠️  Usuário técnico não encontrado: ${tecnicoEmail}`);
    }

    console.log('');

    // Corrigir usuário empresa
    const empresaEmail = 'empresa@empresa.com';
    const empresaUser = await storage.getUserByEmail(empresaEmail);

    if (empresaUser) {
      console.log(`📋 Usuário empresa encontrado: ${empresaEmail}`);
      console.log(`   Role atual: ${empresaUser.role}`);

      if (empresaUser.role !== 'company') {
        console.log('   ⚠️  Role incorreto! Corrigindo...');

        const { error } = await supabase
          .from('users')
          .update({ role: 'company' })
          .eq('id', empresaUser.id);

        if (error) {
          console.error('   ❌ Erro ao atualizar:', error.message);
        } else {
          console.log('   ✅ Role corrigido para: company');
        }
      } else {
        console.log('   ✅ Role já está correto!');
      }
    } else {
      console.log(`⚠️  Usuário empresa não encontrado: ${empresaEmail}`);
    }

    console.log('\n📋 Verificando roles após correção...\n');

    // Verificar novamente
    const tecnicoVerificado = await storage.getUserByEmail(tecnicoEmail);
    const empresaVerificada = await storage.getUserByEmail(empresaEmail);

    if (tecnicoVerificado) {
      console.log(
        `Técnico: ${tecnicoVerificado.email} → Role: ${tecnicoVerificado.role}`
      );
    }

    if (empresaVerificada) {
      console.log(
        `Empresa: ${empresaVerificada.email} → Role: ${empresaVerificada.role}`
      );
    }

    console.log('\n✅ Processo concluído!\n');
    console.log('📋 Credenciais de acesso:');
    console.log('Técnico:');
    console.log('  Email: tecnico@tecnico.com');
    console.log('  Senha: tecnico123');
    console.log('  Role: technician');
    console.log('\nEmpresa:');
    console.log('  Email: empresa@empresa.com');
    console.log('  Senha: empres123');
    console.log('  Role: company');
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    console.error('\n💡 Certifique-se de que:');
    console.error('   1. O DATABASE_URL está configurado corretamente');
    console.error('   2. As credenciais do Supabase estão corretas');
    console.error('   3. A tabela users existe no banco de dados\n');
    process.exit(1);
  }
}

fixUserRoles()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });



















