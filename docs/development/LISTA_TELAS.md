# Lista de Telas - Repaginação ChamadosPro

## Status das Telas

### ✅ Autenticação e Acesso

- [x] Página de Login 1 ✅ (Implementado)
- [x] Página de Login 2 ✅ (Implementado)
- [x] Login - Cadastro Unificado ✅ (Implementado)

### ✅ Dashboard

- [x] Dashboard Overview 1 ✅ (Implementado)
- [ ] Dashboard Overview 2
- [ ] Dashboard Overview 3
- [ ] Dashboard Overview 4
- [x] Dashboard da Empresa 1 ✅ (Implementado)
- [ ] Dashboard da Empresa 2
- [x] Dashboard Financeiro 1 ✅ (Implementado)
- [ ] Dashboard Financeiro 2
- [x] Dashboard de Analytics Avançado 1 ✅ (Implementado)
- [ ] Dashboard de Analytics Avançado 2

### ✅ Clientes

- [x] Listagem de Clientes 1 ✅ (Implementado)
- [ ] Listagem de Clientes 2
- [x] Cadastro Manual de Cliente (PF/PJ) 1 ✅ (Implementado)
- [ ] Cadastro Manual de Cliente (PF/PJ) 2
- [ ] Cadastro Manual de Cliente (PF/PJ) 3
- [x] Cadastro de Cliente Parceiro 1 ✅ (Implementado)
- [ ] Cadastro de Cliente Parceiro 2
- [ ] Cadastro de Cliente Parceiro 3
- [ ] Gestão de Clientes (Empresa - PF/PJ)
- [x] Modal de Detalhes do Cliente 1 ✅ (Implementado)
- [ ] Modal de Detalhes do Cliente 2
- [ ] Opções de Cadastro Automático de Cliente 1
- [ ] Opções de Cadastro Automático de Cliente 2

### ✅ Chamados

- [x] Listagem de Chamados 1 ✅ (Implementado)
- [ ] Listagem de Chamados 2
- [x] Criação de Chamado 1 ✅ (Implementado)
- [ ] Criação de Chamado 2
- [x] Fila de Chamados da Empresa 1 ✅ (Implementado)
- [ ] Fila de Chamados da Empresa 2
- [x] Detalhes do Chamado em Execução 1 ✅ (Implementado)
- [ ] Detalhes do Chamado em Execução 2
- [x] Modal de Cancelamento de Chamado 1 ✅ (Implementado)
- [ ] Modal de Cancelamento de Chamado 2
- [ ] Modal de Conclusão de Atendimento 1
- [ ] Modal de Conclusão de Atendimento 2

### ✅ Serviços

- [x] Listagem de Serviços 1 ✅ (Implementado)
- [ ] Listagem de Serviços 2
- [x] Cadastro - Edição de Serviço 1 ✅ (Implementado)
- [ ] Cadastro - Edição de Serviço 2
- [ ] Editor de Ordem de Serviço

### ✅ Financeiro

- [x] Pendências (Contas a Receber) 1 ✅ (Implementado)
- [ ] Pendências (Contas a Receber) 2
- [x] Faturamento (Folhas de Cobrança) 1 ✅ (Implementado)
- [ ] Faturamento (Folhas de Cobrança) 2
- [x] Detalhes de Registro Financeiro 1 ✅ (Implementado)
- [ ] Detalhes de Registro Financeiro 2
- [x] Agendamento de Pagamentos para Técnicos ✅ (Implementado)
- [x] Integração de Pagamentos ✅ (Implementado)
- [ ] Modal de Conexão com Stripe 1
- [ ] Modal de Conexão com Stripe 2

### ✅ Agenda e Agendamento

- [x] Formulário de Agendamento Público 1 ✅ (Header atualizado)
- [ ] Formulário de Agendamento Público 2
- [ ] Agendamento de Chamado via Agenda Pública do Técnico (Empresa)
- [ ] Serviços para Agendamento Público 1
- [ ] Serviços para Agendamento Público 2
- [ ] Sincronização Google Calendar 1
- [ ] Sincronização Google Calendar 2
- [ ] Sincronização Google Calendar 3

### ✅ Relatórios

- [x] Página de Relatórios 1 ✅ (Header atualizado)
- [ ] Página de Relatórios 2
- [ ] Relatórios Avançados com Gráficos 1
- [ ] Relatórios Avançados com Gráficos 2
- [ ] Relatórios Avançados com Gráficos 3
- [ ] Análise de Planilhas de Técnicos
- [x] Modal de Exportação PDF Completa 1 ✅ (Implementado)
- [ ] Modal de Exportação PDF Completa 2

### ✅ Configurações

- [x] Página de Configurações 1 ✅ (Header atualizado)
- [ ] Página de Configurações 2
- [x] Configuração de Lembretes por Email 1 ✅ (Implementado)
- [ ] Configuração de Lembretes por Email 2
- [x] Configuração de Notificações Push 1 ✅ (Implementado)
- [ ] Configuração de Notificações Push 2

### ✅ Gestão

- [x] Cadastro de Empresa ✅ (Implementado)
- [x] Gerenciamento de Colaboradores (Empresa) 1 ✅ (Implementado)
- [ ] Gerenciamento de Colaboradores (Empresa) 2
- [x] Gestão de Técnicos Parceiros (Empresa) 1 ✅ (Implementado)
- [ ] Gestão de Técnicos Parceiros (Empresa) 2
- [ ] Gestão de Técnicos Parceiros (Empresa) 3
- [ ] Gestão de Convites (Técnico)
- [x] Perfil do Usuário 1 ✅ (Implementado)
- [ ] Perfil do Usuário 2

### ✅ Mobile

- [ ] Página ChamadosPro Mobile

---

## Mapeamento de Telas Existentes

### Páginas Atuais → Novas Telas

- `dashboard.tsx` → Dashboard Overview 1-4, Dashboard da Empresa 1-2, Dashboard Financeiro 1-2
- `clientes.tsx` → Listagem de Clientes 1-2, Cadastro Manual 1-3, Cadastro Parceiro 1-3
- `chamados.tsx` → Listagem de Chamados 1-2, Criação de Chamado 1-2, Fila de Chamados 1-2
- `servicos.tsx` → Listagem de Serviços 1-2, Edição de Serviço 1-2
- `agenda.tsx` → Formulário de Agendamento Público 1-2, Sincronização Google Calendar 1-3
- `relatorios.tsx` → Página de Relatórios 1-2, Relatórios Avançados 1-3
- `configuracoes.tsx` → Página de Configurações 1-2, Configuração de Lembretes 1-2, Configuração de Notificações 1-2

---

## Padrões de Design Identificados

### Cores

- Primary: `#3880f5`
- Background Light: `#f5f7f8`
- Background Dark: `#101722`
- Card Dark: `#1a2332`

### Tipografia

- Fonte: Inter
- Tamanhos: text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl, text-4xl

### Componentes Comuns

- Sidebar fixo com navegação
- Cards com bordas arredondadas (rounded-xl)
- Botões com estilo primary
- Inputs com focus ring
- Material Symbols Outlined para ícones
























