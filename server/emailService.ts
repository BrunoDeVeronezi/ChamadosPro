/**
 * Serviço de envio de emails usando Resend
 *
 * Este serviço é responsável por enviar emails de confirmação para clientes.
 * Usa Resend API para envio de emails transacionais.
 *
 * Configure as variáveis de ambiente no arquivo .env:
 * - RESEND_API_KEY: chave de API do Resend (obtida em https://resend.com/api-keys)
 * - EMAIL_FROM: email remetente verificado no Resend (ex: "noreply@seudominio.com")
 * - BASE_URL: URL base da aplicação (ex: "https://app.seudominio.com")
 */

import dotenv from 'dotenv';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
// Carregar variáveis de .env.local (permite override)
dotenv.config({ path: '.env.local', override: true });

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Criar instância do Resend uma única vez (reutilizável)
let resend: Resend | null = null;

// Criar transporter SMTP uma única vez (reutilizável)
let smtpTransporter: nodemailer.Transporter | null = null;

/**
 * Inicializa o cliente Resend se ainda não foi inicializado
 */
function getResendClient(): Resend | null {
  if (resend) {
    return resend;
  }

  // Verificar se a chave de API está configurada
  const apiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  console.log('[EMAIL] 🔍 Verificando configuração do Resend:', {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length,
    apiKeyPrefix: apiKey ? `${apiKey.substring(0, 7)}...` : 'N/A',
    hasEmailFrom: !!emailFrom,
    emailFrom: emailFrom || 'N/A',
  });

  if (!apiKey) {
    console.error(
      '[EMAIL] ❌ RESEND_API_KEY não configurada. Emails não serão enviados.'
    );
    console.error('[EMAIL] Configure RESEND_API_KEY no arquivo .env');
    return null;
  }

  if (!emailFrom) {
    console.error(
      '[EMAIL] ❌ EMAIL_FROM não configurado. Emails não serão enviados.'
    );
    console.error(
      '[EMAIL] Configure EMAIL_FROM no arquivo .env (ex: noreply@seudominio.com)'
    );
    return null;
  }

  try {
    resend = new Resend(apiKey);
    console.log('[EMAIL] ✅ Cliente Resend configurado com sucesso');
    return resend;
  } catch (error: any) {
    console.error('[EMAIL] ❌ Erro ao criar cliente Resend:', {
      error,
      message: error?.message,
      stack: error?.stack,
    });
    return null;
  }
}

/**
 * Inicializa o transporter SMTP do Resend como fallback
 */
function getSmtpTransporter(): nodemailer.Transporter | null {
  if (smtpTransporter) {
    return smtpTransporter;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    smtpTransporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true, // true para 465, false para outras portas
      auth: {
        user: 'resend',
        pass: apiKey, // A API key do Resend é usada como senha SMTP
      },
    });

    console.log('[EMAIL] ✅ Transporter SMTP configurado com sucesso');
    return smtpTransporter;
  } catch (error: any) {
    console.error('[EMAIL] ❌ Erro ao criar transporter SMTP:', {
      error,
      message: error?.message,
    });
    return null;
  }
}

/**
 * Envia um email usando Resend (API REST primeiro, SMTP como fallback)
 */
export async function sendEmail(
  options: EmailOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    const resendClient = getResendClient();
    const emailFrom = process.env.EMAIL_FROM || 'noreply@chamadospro.com';

    // Se não houver cliente configurado, retornar erro
    if (!resendClient) {
      console.error(
        '[EMAIL] ❌ Resend não configurado. Email não pode ser enviado.',
        {
          from: emailFrom,
          to: options.to,
          subject: options.subject,
        }
      );
      return {
        success: false,
        error:
          'Serviço de email não configurado. Verifique RESEND_API_KEY e EMAIL_FROM no .env',
      };
    }

    // Gerar versão texto se não fornecida
    const textVersion =
      options.text ||
      options.html.replace(/<[^>]*>/g, '').replace(/\n\s*\n/g, '\n\n');

    // Enviar email via Resend
    console.log('[EMAIL] 📤 Enviando email via Resend:', {
      from: emailFrom,
      to: options.to,
      subject: options.subject,
      htmlLength: options.html.length,
      textLength: textVersion.length,
    });

    try {
      const result = await resendClient.emails.send({
        from: emailFrom,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: textVersion,
      });

      // Resend retorna { data, error } ou pode lançar exceção
      if (result.error) {
        console.error('[EMAIL] ❌ Erro retornado pelo Resend:', {
          error: result.error,
          statusCode: result.error.statusCode,
          name: result.error.name,
          message: result.error.message,
        });

        // Tratar erro específico de domínio não verificado - tentar SMTP como fallback
        const statusCode = result.error.statusCode;
        if (statusCode === 403 || statusCode === 450) {
          const errorMsg = result.error.message || '';
          if (
            errorMsg.includes('testing emails') ||
            errorMsg.includes('verify a domain') ||
            errorMsg.includes('You can only send testing emails')
          ) {
            console.log('[EMAIL] 🔄 Tentando enviar via SMTP (fallback)...');
            return await sendEmailViaSmtp(options);
          }
        }

        return {
          success: false,
          error:
            result.error.message ||
            JSON.stringify(result.error) ||
            'Erro ao enviar email',
        };
      }

      console.log('[EMAIL] ✅ Email enviado com sucesso via Resend:', {
        id: result.data?.id,
        to: options.to,
        subject: options.subject,
      });

      return { success: true };
    } catch (sendError: any) {
      // Resend pode lançar exceção em vez de retornar error
      console.error('[EMAIL] ❌ Exceção ao enviar email via Resend:', {
        error: sendError,
        message: sendError?.message,
        name: sendError?.name,
        statusCode: sendError?.statusCode,
        stack: sendError?.stack,
      });

      // Tratar erro específico de domínio não verificado - tentar SMTP como fallback
      const statusCode = sendError?.statusCode;
      if (statusCode === 403 || statusCode === 450) {
        const errorMsg = sendError?.message || '';
        if (
          errorMsg.includes('testing emails') ||
          errorMsg.includes('verify a domain') ||
          errorMsg.includes('You can only send testing emails')
        ) {
          console.log('[EMAIL] 🔄 Tentando enviar via SMTP (fallback)...');
          return await sendEmailViaSmtp(options);
        }
      }

      return {
        success: false,
        error: sendError?.message || 'Erro ao enviar email via Resend',
      };
    }
  } catch (error: any) {
    console.error('[EMAIL] ❌ Erro geral ao enviar email:', {
      error,
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      type: typeof error,
    });

    // Mensagens de erro mais específicas
    let errorMessage = 'Erro ao enviar email';
    if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.toString) {
      errorMessage = error.toString();
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Envia email via SMTP do Resend (fallback quando API REST falha)
 */
async function sendEmailViaSmtp(
  options: EmailOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = getSmtpTransporter();
    const emailFrom = process.env.EMAIL_FROM || 'noreply@chamadospro.com';

    if (!transporter) {
      return {
        success: false,
        error: 'SMTP não configurado. Verifique RESEND_API_KEY no .env',
      };
    }

    // Gerar versão texto se não fornecida
    const textVersion =
      options.text ||
      options.html.replace(/<[^>]*>/g, '').replace(/\n\s*\n/g, '\n\n');

    console.log('[EMAIL] 📤 Enviando email via SMTP:', {
      from: emailFrom,
      to: options.to,
      subject: options.subject,
    });

    const info = await transporter.sendMail({
      from: emailFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: textVersion,
    });

    console.log('[EMAIL] ✅ Email enviado com sucesso via SMTP:', {
      messageId: info.messageId,
      to: options.to,
      subject: options.subject,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[EMAIL] ❌ Erro ao enviar email via SMTP:', {
      error,
      message: error?.message,
      code: error?.code,
      response: error?.response,
      responseCode: error?.responseCode,
    });

    // Verificar se é erro 450 (domínio não verificado)
    const errorMessage = error?.message || '';
    const responseCode = error?.responseCode || error?.code;

    if (
      responseCode === 450 ||
      errorMessage.includes('450') ||
      errorMessage.includes('testing emails') ||
      errorMessage.includes('You can only send testing emails')
    ) {
      return {
        success: false,
        error:
          'O Resend não permite enviar para este email com o domínio de teste. Para testes, use o email da sua conta Resend (bveronezi@gmail.com). Para produção, verifique um domínio próprio em resend.com/domains',
      };
    }

    return {
      success: false,
      error:
        error?.message ||
        'Erro ao enviar email via SMTP. Verifique as configurações do Resend.',
    };
  }
}

/**
 * Gera o conteúdo HTML do email de confirmação
 */
export function generateConfirmationEmailHtml(
  clientName: string,
  confirmationUrl: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme seu cadastro</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #3880f5; margin-top: 0;">Confirme seu cadastro</h1>
    
    <p>Olá, <strong>${clientName}</strong>!</p>
    
    <p>Obrigado por se cadastrar no ChamadosPro. Para ativar sua conta, por favor confirme seu endereço de email clicando no botão abaixo:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${confirmationUrl}" 
         style="display: inline-block; background-color: #3880f5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Confirmar Email
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666;">
      Ou copie e cole este link no seu navegador:<br>
      <a href="${confirmationUrl}" style="color: #3880f5; word-break: break-all;">${confirmationUrl}</a>
    </p>
    
    <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
      <strong>Importante:</strong> Este link expira em 24 horas. Se você não confirmar seu email neste prazo, seu cadastro será removido automaticamente.
    </p>
    
    <p style="font-size: 12px; color: #999;">
      Se você não se cadastrou, pode ignorar este email.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Gera o conteúdo HTML do email com código de confirmação
 */
export function generateConfirmationCodeEmailHtml(
  userName: string,
  confirmationCode: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme seu email</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #3880f5; margin-top: 0;">Confirme seu email</h1>
    
    <p>Olá, <strong>${userName}</strong>!</p>
    
    <p>Use o código abaixo para confirmar seu endereço de email no ChamadosPro:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <div style="background-color: #fff; border: 2px solid #3880f5; border-radius: 8px; padding: 20px; display: inline-block;">
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #3880f5; font-family: 'Courier New', monospace;">
          ${confirmationCode}
        </div>
      </div>
    </div>
    
    <p style="font-size: 14px; color: #666;">
      Este código expira em 10 minutos. Se você não solicitou este código, pode ignorar este email.
    </p>
    
    <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
      <strong>Dica de segurança:</strong> Nunca compartilhe este código com outras pessoas.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Gera o conteúdo texto do email de confirmação
 */
export function generateConfirmationEmailText(
  clientName: string,
  confirmationUrl: string
): string {
  return `
Confirme seu cadastro

Olá, ${clientName}!

Obrigado por se cadastrar no ChamadosPro. Para ativar sua conta, por favor confirme seu endereço de email acessando o link abaixo:

${confirmationUrl}

Importante: Este link expira em 24 horas. Se você não confirmar seu email neste prazo, seu cadastro será removido automaticamente.

Se você não se cadastrou, pode ignorar este email.
  `.trim();
}

/**
 * Gera o conteúdo texto do email com código de confirmação
 */
export function generateConfirmationCodeEmailText(
  userName: string,
  confirmationCode: string
): string {
  return `
Confirme seu email

Olá, ${userName}!

Use o código abaixo para confirmar seu endereço de email no ChamadosPro:

${confirmationCode}

Este código expira em 10 minutos. Se você não solicitou este código, pode ignorar este email.

Dica de segurança: Nunca compartilhe este código com outras pessoas.
  `.trim();
}

/**
 * Gera o conteúdo HTML do email de recuperação de senha
 */
export function generatePasswordResetEmailHtml(
  userName: string,
  resetUrl: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
    <h1 style="color: #3880f5; margin-top: 0;">Recuperação de Senha</h1>
    
    <p>Olá, <strong>${userName}</strong>!</p>
    
    <p>Recebemos uma solicitação para redefinir a senha da sua conta no ChamadosPro. Clique no botão abaixo para criar uma nova senha:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" 
         style="display: inline-block; background-color: #3880f5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Redefinir Senha
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666;">
      Ou copie e cole este link no seu navegador:<br>
      <a href="${resetUrl}" style="color: #3880f5; word-break: break-all;">${resetUrl}</a>
    </p>
    
    <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
      <strong>Importante:</strong> Este link expira em 1 hora. Se você não solicitou esta recuperação de senha, pode ignorar este email e sua senha permanecerá inalterada.
    </p>
    
    <p style="font-size: 12px; color: #999;">
      <strong>Dica de segurança:</strong> Se você não solicitou esta recuperação, recomendamos alterar sua senha através do perfil no sistema.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Gera o conteúdo texto do email de recuperação de senha
 */
export function generatePasswordResetEmailText(
  userName: string,
  resetUrl: string
): string {
  return `
Recuperação de Senha

Olá, ${userName}!

Recebemos uma solicitação para redefinir a senha da sua conta no ChamadosPro. Acesse o link abaixo para criar uma nova senha:

${resetUrl}

Importante: Este link expira em 1 hora. Se você não solicitou esta recuperação de senha, pode ignorar este email e sua senha permanecerá inalterada.

Dica de segurança: Se você não solicitou esta recuperação, recomendamos alterar sua senha através do perfil no sistema.
  `.trim();
}
