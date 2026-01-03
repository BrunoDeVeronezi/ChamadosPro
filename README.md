# 📋 ChamadosPro - Sistema de Gestão de Chamados

Bem-vindo ao **ChamadosPro**, uma plataforma SaaS multi-tenant robusta desenvolvida para técnicos e empresas de TI. O sistema automatiza todo o ciclo de vida de um chamado, desde o agendamento inteligente até a cobrança financeira.

---

## 🗺️ Portal de Documentação

Para facilitar a manutenção e evolução do sistema, a documentação foi consolidada em quatro pilares principais. Clique nos tópicos para acessar o guia detalhado:

### 🏛️ [Arquitetura e Dados](./docs/architecture/TECHNICAL_REFERENCE.md)
*   **Referência Técnica**: Estrutura do projeto, fluxo de autenticação e multi-tenancy.
*   **[Dicionário de Dados](./docs/architecture/DATABASE_SCHEMA.md)**: Detalhamento de todas as tabelas (PostgreSQL/Supabase) e relacionamentos.

### 🛠️ [Guia de Desenvolvimento](./docs/development/DEVELOPER_GUIDE.md)
*   **Padrões de Código**: Diretrizes de design (Tailwind/Shadcn), componentes e hooks.
*   **Indicadores e Forms**: Como criar novos cards de dashboard e formulários validados.
*   **[Mapa do Site](./docs/development/LISTA_TELAS.md)**: Índice completo de rotas e componentes.

### 🚀 [Infraestrutura e Setup](./docs/infrastructure/SETUP_GUIDE.md)
*   **Ambiente**: Configuração do Supabase, Resend (E-mail) e Stripe.
*   **Conectividade**: Túnel Cloudflare e Ngrok para desenvolvimento local.

### 🌟 [Recursos e Funcionalidades](./docs/features/FEATURES_OVERVIEW.md)
*   **[Inteligência de Dados](./docs/features/OCR_AND_AUTOFILL.md)**: OCR de fotos e preenchimento automático via BrasilAPI.
*   **[Ecossistema Google](./docs/features/GOOGLE_INTEGRATION.md)**: Sincronização com Calendar e backup em Sheets.
*   **[Financeiro](./docs/features/FINANCE_AND_PAYMENTS.md)**: Fluxo de recebíveis, cálculo de KM e assinaturas Stripe.

---

## 🏗️ Estrutura do Projeto

```bash
├── client/          # Frontend React (Vite + Tailwind + Shadcn/UI)
├── server/          # Backend Node.js (Express + Socket.io)
├── shared/          # Schemas de dados e validações (Drizzle ORM + Zod)
├── migrations/      # Histórico de evolução do banco de dados (SQL)
├── docs/            # Documentação centralizada e otimizada
└── scripts/         # Utilitários de automação e manutenção
```

---

## 🛡️ Guia de Manutenção Rápida (Anti-Bug)

Se algo parou de funcionar após uma alteração, verifique:

1.  **O cronômetro sumiu?** Verifique se o `status` do chamado é `INICIADO` e se `started_at` está no banco.
2.  **Financeiro vazio?** Lembre-se: registros financeiros são criados apenas no momento da **Conclusão** do chamado.
3.  **Erro de Schema?** Verifique se o mapeamento `camelCase` (JS) vs `snake_case` (Postgres) no `storage-supabase.ts` está correto.
4.  **Google Calendar não sincroniza?** Verifique os logs do console para erros de Token ou Escopo.

---

**Última atualização:** Dezembro 2025  
**Versão:** 3.0 (Otimização e Documentação Master)
