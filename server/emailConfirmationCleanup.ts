/**
 * Job para limpar contas não confirmadas que expiraram (2 horas após cadastro)
 * Executa a cada 15 minutos
 */

import { supabase } from './supabase-client';

let cleanupInterval: NodeJS.Timeout | null = null;

export async function cleanupExpiredUnconfirmedAccounts(): Promise<void> {
  try {

    const now = new Date().toISOString();

    // Buscar contas não confirmadas que expiraram
    const { data: expiredUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, email, email_confirmed, email_confirmation_expires_at')
      .eq('email_confirmed', false)
      .not('email_confirmation_expires_at', 'is', null)
      .lte('email_confirmation_expires_at', now);

    if (fetchError) {
      console.error(
        '[EmailConfirmationCleanup] ❌ Erro ao buscar contas expiradas:',
        fetchError
      );
      return;
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      return;
    }


    // Deletar credenciais e usuários expirados
    let deletedCount = 0;
    for (const user of expiredUsers) {
      try {
        // Deletar credenciais primeiro
        const { error: credError } = await supabase
          .from('user_credentials')
          .delete()
          .eq('user_id', user.id);

        if (credError) {
          console.error(
            `[EmailConfirmationCleanup] ❌ Erro ao deletar credenciais do usuário ${user.id}:`,
            credError
          );
          continue;
        }

        // Deletar usuário
        const { error: userError } = await supabase
          .from('users')
          .delete()
          .eq('id', user.id);

        if (userError) {
          console.error(
            `[EmailConfirmationCleanup] ❌ Erro ao deletar usuário ${user.id}:`,
            userError
          );
          continue;
        }

        deletedCount++;
      } catch (error: any) {
        console.error(
          `[EmailConfirmationCleanup] ❌ Erro ao processar usuário ${user.id}:`,
          error
        );
      }
    }

  } catch (error: any) {
    console.error(
      '[EmailConfirmationCleanup] ❌ Erro geral na limpeza:',
      error
    );
  }
}

export function startEmailConfirmationCleanup(): void {
  // Executar imediatamente na inicialização
  cleanupExpiredUnconfirmedAccounts();

  // Executar a cada 15 minutos
  cleanupInterval = setInterval(() => {
    cleanupExpiredUnconfirmedAccounts();
  }, 15 * 60 * 1000); // 15 minutos

}

export function stopEmailConfirmationCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

