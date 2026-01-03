# 🛠️ Troubleshooting e Resolução de Problemas

Este guia documenta erros comuns e como resolvê-los rapidamente.

## 1. ⏱️ Problemas com o Cronômetro (Active Ticket)
*   **Sintoma**: O timer não inicia ou reseta sozinho.
*   **Causa**: Geralmente discrepância de fuso horário entre o servidor (UTC) e o navegador (Local).
*   **Solução**: Verifique se o campo `started_at` no banco está em formato ISO 8601. O componente `ActiveTicketBanner` possui uma margem de segurança de 4 horas para lidar com UTC-3.

## 2. 💸 Chamado não aparece no Financeiro
*   **Sintoma**: Após clicar em "Finalizar", o chamado some mas não aparece no financeiro.
*   **Causa**: O registro financeiro só é criado no status `CONCLUÍDO`. Verifique se a rota `/api/tickets/:id/complete` retornou sucesso.
*   **Filtro**: Verifique se o `due_date` calculado não caiu para o mês seguinte. Use o filtro "Trimestre" ou "Ano" na tela de financeiro para confirmar.

## 3. 📧 Erros de E-mail (Resend)
*   **Sintoma**: Usuários não recebem e-mail de confirmação.
*   **Causa**: `RESEND_API_KEY` inválida ou domínio não verificado.
*   **Log**: Procure por `[Resend] ❌ Erro` no console do servidor.

## 4. 🗄️ Erros de Schema (Drizzle)
*   **Sintoma**: Erro `column "xxx" does not exist`.
*   **Causa**: O schema local está à frente do banco Supabase.
*   **Solução**: Execute `npm run db:push` para sincronizar as tabelas.

---
[Voltar para o Início](../../README.md)





