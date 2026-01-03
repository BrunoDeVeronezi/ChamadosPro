/**
 * Teste simples para verificar se @supabase/supabase-js pode ser importado
 */

console.log('Testando importação de @supabase/supabase-js...');

try {
  const { createClient } = await import('@supabase/supabase-js');
  console.log('✅ Importação bem-sucedida!');
  console.log('createClient:', typeof createClient);
} catch (error: any) {
  console.error('❌ Erro na importação:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}


























