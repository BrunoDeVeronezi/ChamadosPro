/**
 * Utilitários para confirmação de email de clientes
 */

import { randomUUID } from 'crypto';
import { sendEmail, generateConfirmationEmailHtml, generateConfirmationEmailText } from './emailService';

/**
 * Gera um token único para confirmação de email
 */
export function generateConfirmationToken(): string {
  return randomUUID();
}

/**
 * Calcula a data de expiração do token (1 dia a partir de agora)
 */
export function getTokenExpirationDate(): Date {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 1); // 1 dia
  return expirationDate;
}

/**
 * Verifica se um token está expirado
 */
export function isTokenExpired(expiresAt: Date | string | null | undefined): boolean {
  if (!expiresAt) return true;
  const expirationDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return expirationDate < new Date();
}

/**
 * Envia email de confirmação para o cliente
 */
export async function sendConfirmationEmail(
  clientEmail: string,
  clientName: string,
  confirmationToken: string,
  baseUrl: string = process.env.BASE_URL || 'http://localhost:5180'
): Promise<{ success: boolean; error?: string }> {
  try {
    const confirmationUrl = `${baseUrl}/api/clients/confirm-email?token=${confirmationToken}`;
    
    const html = generateConfirmationEmailHtml(clientName, confirmationUrl);
    const text = generateConfirmationEmailText(clientName, confirmationUrl);

    const result = await sendEmail({
      to: clientEmail,
      subject: 'Confirme seu cadastro no ChamadosPro',
      html,
      text,
    });

    return result;
  } catch (error: any) {
    console.error('[EmailConfirmation] Erro ao enviar email de confirmação:', error);
    return {
      success: false,
      error: error.message || 'Erro ao enviar email de confirmação',
    };
  }
}














