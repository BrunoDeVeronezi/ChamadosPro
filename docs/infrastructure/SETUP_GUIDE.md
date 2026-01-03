# 🚀 Guia de Infraestrutura e Setup

Este guia contém as instruções para configurar o ambiente do ChamadosPro do zero.

## 1. 🗄️ Banco de Dados (Supabase)
O projeto utiliza Supabase como camada de dados PostgreSQL.
*   **Schema**: Gerenciado via Drizzle ORM.
*   **Migrations**: Execute `npm run db:push` para sincronizar mudanças.
*   **Conexão**: Certifique-se de que a `DATABASE_URL` está no arquivo `.env`.

## 2. 📧 Serviço de E-mail (Resend)
Usado para confirmação de conta, recuperação de senha e alertas.
*   Configure a `RESEND_API_KEY`.
*   O domínio deve estar verificado no painel do Resend.

## 3. 🌐 Conectividade (Túnel)
Para que os Webhooks do Google e Stripe funcionem localmente:
*   **Cloudflare Tunnel**: `cloudflared tunnel run <nome-do-tunel>`
*   **Ngrok**: Alternativa rápida para teste de endpoints públicos.

## 4. 💳 Pagamentos (Stripe)
*   Configure as chaves `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`.
*   O sistema suporta assinaturas recorrentes e checkout PIX.

---
[Voltar para o Início](../../README.md)





