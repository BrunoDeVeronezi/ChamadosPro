/**
 * Script para testar o envio de email via Resend
 *
 * Uso:
 * node scripts/testar-resend.js seu-email@exemplo.com
 */

import 'dotenv/config';
import { Resend } from 'resend';

const emailDestino =
  process.argv[2] || process.env.TEST_EMAIL || 'bruno.veronezi@hotmail.com';

async function testarResend() {
  console.log('🧪 Testando configuração do Resend...\n');

  // Verificar variáveis de ambiente
  const apiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  console.log('📋 Configuração:');
  console.log(
    `  RESEND_API_KEY: ${
      apiKey ? `${apiKey.substring(0, 10)}...` : '❌ NÃO CONFIGURADO'
    }`
  );
  console.log(`  EMAIL_FROM: ${emailFrom || '❌ NÃO CONFIGURADO'}`);
  console.log(`  Email destino: ${emailDestino}\n`);

  if (!apiKey) {
    console.error('❌ ERRO: RESEND_API_KEY não configurado no .env');
    process.exit(1);
  }

  if (!emailFrom) {
    console.error('❌ ERRO: EMAIL_FROM não configurado no .env');
    process.exit(1);
  }

  try {
    // Criar cliente Resend
    console.log('🔧 Criando cliente Resend...');
    const resend = new Resend(apiKey);
    console.log('✅ Cliente criado com sucesso\n');

    // Enviar email de teste
    console.log('📤 Enviando email de teste...');
    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: emailDestino,
      subject: 'Teste de Email - ChamadosPro',
      html: `
        <h1>Teste de Email</h1>
        <p>Este é um email de teste do ChamadosPro.</p>
        <p>Se você recebeu este email, o Resend está configurado corretamente! ✅</p>
        <p><strong>Código de teste:</strong> <code>123456</code></p>
      `,
      text: 'Este é um email de teste do ChamadosPro. Código: 123456',
    });

    if (error) {
      console.error('❌ ERRO ao enviar email:');
      console.error(JSON.stringify(error, null, 2));
      process.exit(1);
    }

    console.log('✅ Email enviado com sucesso!');
    console.log(`   ID: ${data?.id}`);
    console.log(`   Para: ${emailDestino}`);
    console.log(`   De: ${emailFrom}\n`);
    console.log('📬 Verifique sua caixa de entrada (e spam!)');
  } catch (error) {
    console.error('❌ ERRO inesperado:');
    console.error(error);
    process.exit(1);
  }
}

testarResend();
