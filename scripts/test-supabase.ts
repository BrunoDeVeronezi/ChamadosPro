/**
 * Script de Testes do Supabase
 *
 * Este script testa:
 * 1. Conexão com o banco de dados
 * 2. Operações CRUD básicas
 * 3. Tenant Isolation (isolamento de dados por userId)
 * 4. Funcionalidades principais do storage
 *
 * Uso:
 *   npm run test:supabase
 */

import dotenv from 'dotenv';

// Carregar variáveis de ambiente PRIMEIRO
dotenv.config();

// Verificar variáveis do Supabase (API REST)
if (!process.env.SUPABASE_URL) {
  console.error('❌ Erro: SUPABASE_URL não está configurado!');
  console.error('Configure a variável SUPABASE_URL no arquivo .env');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Erro: SUPABASE_SERVICE_ROLE_KEY não está configurado!');
  console.error(
    'Configure a variável SUPABASE_SERVICE_ROLE_KEY no arquivo .env'
  );
  process.exit(1);
}

// Cores para output no console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

async function testConnection(supabase: any) {
  log('\n📡 Teste 1: Conexão com a API REST do Supabase', 'blue');
  try {
    // Testar conexão fazendo uma query simples
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      logError(`Falha na conexão: ${error.message}`);
      return false;
    }

    logSuccess('Conexão com API REST estabelecida com sucesso!');
    return true;
  } catch (error: any) {
    logError(`Falha na conexão: ${error.message}`);
    return false;
  }
}

async function testTablesExist(supabase: any) {
  log('\n📋 Teste 2: Verificar se todas as tabelas existem', 'blue');
  const tables = [
    'sessions',
    'users',
    'clients',
    'services',
    'tickets',
    'financial_records',
    'integration_settings',
    'reminder_logs',
    'local_events',
  ];

  let allExist = true;
  for (const tableName of tables) {
    try {
      // Tentar fazer uma query simples para verificar se a tabela existe
      const { error } = await supabase.from(tableName).select('*').limit(1);

      if (error && error.code === '42P01') {
        // Tabela não existe
        logError(`Tabela ${tableName} não encontrada`);
        allExist = false;
      } else if (error && error.code !== 'PGRST116') {
        // Outro erro (pode ser RLS ou permissão)
        logWarning(
          `Tabela ${tableName} existe mas pode ter problemas de acesso: ${error.message}`
        );
      } else {
        logSuccess(`Tabela ${tableName} existe`);
      }
    } catch (error: any) {
      logError(`Erro ao verificar tabela ${tableName}: ${error.message}`);
      allExist = false;
    }
  }
  return allExist;
}

async function testUserOperations(storage: any, supabase: any) {
  log('\n👤 Teste 3: Operações com usuários', 'blue');
  const testUserId = `test-user-${Date.now()}`;
  const testEmail = `test-${Date.now()}@example.com`;

  try {
    // Criar usuário
    logInfo('Criando usuário de teste...');
    const newUser = await storage.upsertUser({
      id: testUserId,
      email: testEmail,
      firstName: 'Teste',
      lastName: 'Usuario',
    });
    logSuccess(`Usuário criado: ${newUser.id}`);

    // Buscar usuário por ID
    logInfo('Buscando usuário por ID...');
    const foundUser = await storage.getUser(testUserId);
    if (foundUser && foundUser.id === testUserId) {
      logSuccess('Usuário encontrado por ID');
    } else {
      logError('Usuário não encontrado por ID');
      return false;
    }

    // Buscar usuário por email
    logInfo('Buscando usuário por email...');
    const foundByEmail = await storage.getUserByEmail(testEmail);
    if (foundByEmail && foundByEmail.email === testEmail) {
      logSuccess('Usuário encontrado por email');
    } else {
      logError('Usuário não encontrado por email');
      return false;
    }

    // Limpar - remover usuário de teste
    logInfo('Removendo usuário de teste...');
    await supabase.from('users').delete().eq('id', testUserId);
    logSuccess('Usuário de teste removido');

    return true;
  } catch (error: any) {
    logError(`Erro nas operações de usuário: ${error.message}`);
    // Tentar limpar mesmo em caso de erro
    try {
      await supabase.from('users').delete().eq('id', testUserId);
    } catch {}
    return false;
  }
}

async function testClientOperations(storage: any, supabase: any) {
  log('\n👥 Teste 4: Operações com clientes (Tenant Isolation)', 'blue');
  const testUserId1 = `test-user-1-${Date.now()}`;
  const testUserId2 = `test-user-2-${Date.now()}`;

  try {
    // Criar dois usuários de teste
    logInfo('Criando usuários de teste...');
    await storage.upsertUser({
      id: testUserId1,
      email: `test1-${Date.now()}@example.com`,
      firstName: 'Usuario',
      lastName: 'Um',
    });
    await storage.upsertUser({
      id: testUserId2,
      email: `test2-${Date.now()}@example.com`,
      firstName: 'Usuario',
      lastName: 'Dois',
    });

    // Criar clientes para cada usuário
    logInfo('Criando clientes para cada usuário...');
    const client1 = await storage.createClient({
      userId: testUserId1,
      type: 'PF',
      name: 'Cliente Usuario 1',
      phone: '11999999999',
      city: 'São Paulo',
      state: 'SP',
    });

    const client2 = await storage.createClient({
      userId: testUserId2,
      type: 'PF',
      name: 'Cliente Usuario 2',
      phone: '11888888888',
      city: 'Rio de Janeiro',
      state: 'RJ',
    });

    logSuccess(`Cliente 1 criado: ${client1.id}`);
    logSuccess(`Cliente 2 criado: ${client2.id}`);

    // Testar Tenant Isolation - Usuario 1 só deve ver seus clientes
    logInfo('Testando Tenant Isolation...');
    const clientsUser1 = await storage.getClientsByUser(testUserId1);
    const clientsUser2 = await storage.getClientsByUser(testUserId2);

    if (clientsUser1.length === 1 && clientsUser1[0].id === client1.id) {
      logSuccess('Usuario 1 vê apenas seus clientes');
    } else {
      logError('Falha no Tenant Isolation - Usuario 1 vê clientes incorretos');
      return false;
    }

    if (clientsUser2.length === 1 && clientsUser2[0].id === client2.id) {
      logSuccess('Usuario 2 vê apenas seus clientes');
    } else {
      logError('Falha no Tenant Isolation - Usuario 2 vê clientes incorretos');
      return false;
    }

    // Limpar
    logInfo('Limpando dados de teste...');
    await supabase.from('clients').delete().eq('user_id', testUserId1);
    await supabase.from('clients').delete().eq('user_id', testUserId2);
    await supabase.from('users').delete().eq('id', testUserId1);
    await supabase.from('users').delete().eq('id', testUserId2);
    logSuccess('Dados de teste removidos');

    return true;
  } catch (error: any) {
    logError(`Erro nas operações de cliente: ${error.message}`);
    // Tentar limpar mesmo em caso de erro
    try {
      await supabase.from('clients').delete().eq('user_id', testUserId1);
      await supabase.from('clients').delete().eq('user_id', testUserId2);
      await supabase.from('users').delete().eq('id', testUserId1);
      await supabase.from('users').delete().eq('id', testUserId2);
    } catch {}
    return false;
  }
}

async function testServiceOperations(storage: any, supabase: any) {
  log('\n🔧 Teste 5: Operações com serviços', 'blue');
  const testUserId = `test-user-${Date.now()}`;

  try {
    // Criar usuário de teste
    await storage.upsertUser({
      id: testUserId,
      email: `test-${Date.now()}@example.com`,
      firstName: 'Teste',
      lastName: 'Usuario',
    });

    // Criar serviço
    logInfo('Criando serviço de teste...');
    const service = await storage.createService({
      userId: testUserId,
      name: 'Serviço de Teste',
      description: 'Descrição do serviço de teste',
      price: '100.00',
      duration: 2,
      active: true,
      publicBooking: true,
    });
    logSuccess(`Serviço criado: ${service.id}`);

    // Buscar serviços do usuário
    logInfo('Buscando serviços do usuário...');
    const userServices = await storage.getServicesByUser(testUserId);
    if (userServices.length > 0 && userServices[0].id === service.id) {
      logSuccess('Serviços encontrados corretamente');
    } else {
      logError('Serviços não encontrados');
      return false;
    }

    // Atualizar serviço
    logInfo('Atualizando serviço...');
    const updated = await storage.updateService(service.id, {
      name: 'Serviço Atualizado',
      price: '150.00',
    });
    if (updated && updated.name === 'Serviço Atualizado') {
      logSuccess('Serviço atualizado com sucesso');
    } else {
      logError('Falha ao atualizar serviço');
      return false;
    }

    // Limpar
    await supabase.from('services').delete().eq('user_id', testUserId);
    await supabase.from('users').delete().eq('id', testUserId);
    logSuccess('Dados de teste removidos');

    return true;
  } catch (error: any) {
    logError(`Erro nas operações de serviço: ${error.message}`);
    try {
      await supabase.from('services').delete().eq('user_id', testUserId);
      await supabase.from('users').delete().eq('id', testUserId);
    } catch {}
    return false;
  }
}

async function testRLSStatus(supabase: any) {
  log('\n🔒 Teste 6: Verificar status do RLS (via API)', 'blue');
  logInfo('Nota: RLS deve estar desativado. Verificação via API REST...');

  const tables = [
    'sessions',
    'users',
    'clients',
    'services',
    'tickets',
    'financial_records',
    'integration_settings',
    'reminder_logs',
    'local_events',
  ];

  let allAccessible = true;

  for (const tableName of tables) {
    try {
      // Tentar fazer uma query simples - se RLS estiver ativo sem políticas, vai falhar
      const { error } = await supabase.from(tableName).select('*').limit(1);

      if (error && error.message.includes('row-level security')) {
        logWarning(
          `Tabela ${tableName}: RLS pode estar ativo (erro de segurança)`
        );
        allAccessible = false;
      } else if (error && error.code === 'PGRST116') {
        // Tabela vazia, mas acessível
        logSuccess(
          `Tabela ${tableName}: Acessível (RLS desativado ou bypassado)`
        );
      } else if (error) {
        logWarning(`Tabela ${tableName}: Erro ao acessar - ${error.message}`);
      } else {
        logSuccess(
          `Tabela ${tableName}: Acessível (RLS desativado ou bypassado)`
        );
      }
    } catch (error: any) {
      logWarning(`Tabela ${tableName}: Erro ao verificar - ${error.message}`);
    }
  }

  return allAccessible;
}

async function runTests() {
  console.log('🚀 Iniciando testes do Supabase (API REST)...\n');
  log('\n🚀 Iniciando testes do Supabase (API REST)...\n', 'blue');

  // Importar dinamicamente após dotenv estar carregado
  console.log('📦 Carregando módulos...');
  const { supabase } = await import('../server/supabase-client');
  const { storage } = await import('../server/storage-supabase');
  console.log('✅ Módulos carregados');

  const results = {
    connection: false,
    tables: false,
    users: false,
    clients: false,
    services: false,
    rls: false,
  };

  // Executar testes
  results.connection = await testConnection(supabase);
  if (!results.connection) {
    logError('\n❌ Teste de conexão falhou. Abortando outros testes.');
    process.exit(1);
  }

  results.tables = await testTablesExist(supabase);
  results.rls = await testRLSStatus(supabase);
  results.users = await testUserOperations(storage, supabase);
  results.clients = await testClientOperations(storage, supabase);
  results.services = await testServiceOperations(storage, supabase);

  // Resumo
  log('\n📊 Resumo dos Testes:', 'blue');
  log('─'.repeat(50), 'blue');
  log(
    `Conexão: ${results.connection ? '✅ PASSOU' : '❌ FALHOU'}`,
    results.connection ? 'green' : 'red'
  );
  log(
    `Tabelas: ${results.tables ? '✅ PASSOU' : '❌ FALHOU'}`,
    results.tables ? 'green' : 'red'
  );
  log(
    `RLS: ${results.rls ? '✅ PASSOU' : '❌ FALHOU'}`,
    results.rls ? 'green' : 'red'
  );
  log(
    `Usuários: ${results.users ? '✅ PASSOU' : '❌ FALHOU'}`,
    results.users ? 'green' : 'red'
  );
  log(
    `Clientes (Tenant Isolation): ${
      results.clients ? '✅ PASSOU' : '❌ FALHOU'
    }`,
    results.clients ? 'green' : 'red'
  );
  log(
    `Serviços: ${results.services ? '✅ PASSOU' : '❌ FALHOU'}`,
    results.services ? 'green' : 'red'
  );
  log('─'.repeat(50), 'blue');

  const allPassed = Object.values(results).every((r) => r === true);

  if (allPassed) {
    log('\n✨ Todos os testes passaram!', 'green');
  } else {
    log('\n⚠️  Alguns testes falharam. Verifique os erros acima.', 'yellow');
  }

  process.exit(allPassed ? 0 : 1);
}

// Executar testes
runTests().catch((error) => {
  logError(`\n❌ Erro fatal nos testes: ${error.message}`);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});


























