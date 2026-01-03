import { supabase } from '../server/supabase-client';

async function fixRoles() {
  console.log('🔧 Corrigindo roles...\n');

  // Corrigir empresa@empresa.com para company
  const { data: empresa, error: err1 } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', 'empresa@empresa.com')
    .single();

  if (err1) {
    console.error('Erro ao buscar empresa:', err1.message);
  } else if (empresa) {
    console.log(
      `Empresa encontrada: ${empresa.email}, role atual: ${empresa.role}`
    );
    if (empresa.role !== 'company') {
      const { error: updateErr } = await supabase
        .from('users')
        .update({ role: 'company' })
        .eq('id', empresa.id);
      if (updateErr) {
        console.error('Erro ao atualizar:', updateErr.message);
      } else {
        console.log('✅ Role da empresa corrigido para: company');
      }
    } else {
      console.log('✅ Role da empresa já está correto');
    }
  }

  // Corrigir tecnico@tecnico.com para technician
  const { data: tecnico, error: err2 } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', 'tecnico@tecnico.com')
    .single();

  if (err2) {
    console.error('Erro ao buscar técnico:', err2.message);
  } else if (tecnico) {
    console.log(
      `Técnico encontrado: ${tecnico.email}, role atual: ${tecnico.role}`
    );
    if (tecnico.role !== 'technician') {
      const { error: updateErr } = await supabase
        .from('users')
        .update({ role: 'technician' })
        .eq('id', tecnico.id);
      if (updateErr) {
        console.error('Erro ao atualizar:', updateErr.message);
      } else {
        console.log('✅ Role do técnico corrigido para: technician');
      }
    } else {
      console.log('✅ Role do técnico já está correto');
    }
  }

  console.log('\n✅ Concluído!');
}

fixRoles()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });



















