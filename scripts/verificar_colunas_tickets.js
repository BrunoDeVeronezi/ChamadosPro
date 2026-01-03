/**
 * Script Node.js para verificar se as colunas existem no banco de dados
 * e se há dados nessas colunas
 * 
 * Uso: node scripts/verificar_colunas_tickets.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erro: SUPABASE_URL e SUPABASE_KEY devem estar configurados no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarColunas() {
  console.log('🔍 Verificando colunas na tabela tickets...\n');

  try {
    // 1. Verificar se as colunas existem
    console.log('1️⃣ Verificando se as colunas existem...');
    const colunasNecessarias = ['due_date', 'payment_date', 'final_client', 'description'];
    const colunasFaltando = [];

    // Buscar todas as colunas da tabela tickets
    const { data: colunas, error: errorColunas } = await supabase
      .from('tickets')
      .select('*')
      .limit(1);

    if (errorColunas) {
      console.error('❌ Erro ao verificar colunas:', errorColunas.message);
      return;
    }

    // Verificar quais colunas existem (baseado na resposta)
    if (colunas && colunas.length > 0) {
      const colunasExistentes = Object.keys(colunas[0]);
      
      for (const coluna of colunasNecessarias) {
        const existe = colunasExistentes.includes(coluna) || 
                      colunasExistentes.some(c => c.toLowerCase() === coluna.toLowerCase());
        
        if (existe) {
          console.log(`   ✅ ${coluna} existe`);
        } else {
          console.log(`   ❌ ${coluna} NÃO existe`);
          colunasFaltando.push(coluna);
        }
      }
    }

    if (colunasFaltando.length > 0) {
      console.log(`\n⚠️  Colunas faltando: ${colunasFaltando.join(', ')}`);
      console.log('   Execute a migration: migrations/add_ticket_payment_fields.sql\n');
    } else {
      console.log('\n✅ Todas as colunas necessárias existem!\n');
    }

    // 2. Verificar quantidade de registros com dados
    console.log('2️⃣ Verificando quantidade de registros com dados...');
    const { data: tickets, error: errorTickets } = await supabase
      .from('tickets')
      .select('due_date, payment_date, final_client, description');

    if (errorTickets) {
      console.error('❌ Erro ao buscar tickets:', errorTickets.message);
      return;
    }

    if (tickets) {
      const total = tickets.length;
      const comDueDate = tickets.filter(t => t.due_date).length;
      const comPaymentDate = tickets.filter(t => t.payment_date).length;
      const comFinalClient = tickets.filter(t => t.final_client && t.final_client.trim() !== '').length;
      const comDescription = tickets.filter(t => t.description && t.description.trim() !== '').length;

      console.log(`   Total de tickets: ${total}`);
      console.log(`   Com due_date (Vencimento): ${comDueDate} (${((comDueDate/total)*100).toFixed(1)}%)`);
      console.log(`   Com payment_date (Pagamento): ${comPaymentDate} (${((comPaymentDate/total)*100).toFixed(1)}%)`);
      console.log(`   Com final_client (Cliente Final): ${comFinalClient} (${((comFinalClient/total)*100).toFixed(1)}%)`);
      console.log(`   Com description (Descrição): ${comDescription} (${((comDescription/total)*100).toFixed(1)}%)`);
    }

    // 3. Verificar tickets sem dados
    console.log('\n3️⃣ Tickets sem dados (mostrando N/A)...');
    const { data: ticketsSemDados, error: errorSemDados } = await supabase
      .from('tickets')
      .select('id, ticket_number, status, due_date, payment_date, final_client, description')
      .or('due_date.is.null,payment_date.is.null,final_client.is.null,description.is.null')
      .limit(10)
      .order('created_at', { ascending: false });

    if (errorSemDados) {
      console.error('❌ Erro ao buscar tickets sem dados:', errorSemDados.message);
    } else if (ticketsSemDados && ticketsSemDados.length > 0) {
      console.log(`   Encontrados ${ticketsSemDados.length} tickets sem dados completos:`);
      ticketsSemDados.forEach((ticket, index) => {
        console.log(`   ${index + 1}. Ticket #${ticket.ticket_number || ticket.id?.slice(0, 8)}`);
        console.log(`      - Vencimento: ${ticket.due_date ? new Date(ticket.due_date).toLocaleDateString('pt-BR') : 'N/A'}`);
        console.log(`      - Pagamento: ${ticket.payment_date ? new Date(ticket.payment_date).toLocaleDateString('pt-BR') : 'N/A'}`);
        console.log(`      - Cliente Final: ${ticket.final_client || 'N/A'}`);
        console.log(`      - Descrição: ${ticket.description ? (ticket.description.substring(0, 50) + '...') : 'N/A'}`);
      });
    } else {
      console.log('   ✅ Todos os tickets têm dados completos!');
    }

    // 4. Estatísticas por status
    console.log('\n4️⃣ Estatísticas por status...');
    const { data: ticketsPorStatus, error: errorStatus } = await supabase
      .from('tickets')
      .select('status, due_date, payment_date, final_client, description');

    if (errorStatus) {
      console.error('❌ Erro ao buscar tickets por status:', errorStatus.message);
    } else if (ticketsPorStatus) {
      const statusMap = {};
      ticketsPorStatus.forEach(ticket => {
        const status = ticket.status || 'SEM_STATUS';
        if (!statusMap[status]) {
          statusMap[status] = {
            total: 0,
            comDueDate: 0,
            comPaymentDate: 0,
            comFinalClient: 0,
            comDescription: 0
          };
        }
        statusMap[status].total++;
        if (ticket.due_date) statusMap[status].comDueDate++;
        if (ticket.payment_date) statusMap[status].comPaymentDate++;
        if (ticket.final_client && ticket.final_client.trim() !== '') statusMap[status].comFinalClient++;
        if (ticket.description && ticket.description.trim() !== '') statusMap[status].comDescription++;
      });

      Object.entries(statusMap).forEach(([status, stats]) => {
        console.log(`   ${status}:`);
        console.log(`      Total: ${stats.total}`);
        console.log(`      Com Vencimento: ${stats.comDueDate} (${((stats.comDueDate/stats.total)*100).toFixed(1)}%)`);
        console.log(`      Com Pagamento: ${stats.comPaymentDate} (${((stats.comPaymentDate/stats.total)*100).toFixed(1)}%)`);
        console.log(`      Com Cliente Final: ${stats.comFinalClient} (${((stats.comFinalClient/stats.total)*100).toFixed(1)}%)`);
        console.log(`      Com Descrição: ${stats.comDescription} (${((stats.comDescription/stats.total)*100).toFixed(1)}%)`);
      });
    }

    console.log('\n✅ Verificação concluída!');

  } catch (error) {
    console.error('❌ Erro durante a verificação:', error);
  }
}

verificarColunas();





