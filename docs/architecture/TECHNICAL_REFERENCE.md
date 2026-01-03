# Documentação Técnica - ChamadosPro

## Sumário

- [1. Implementação do Banco de Dados](#1-implementação-do-banco-de-dados)
  - [1.3.3 Tabela: clients](#133-tabela-clients)
  - [1.4 Sistema de Preenchimento Automático de Clientes](#14-sistema-de-preenchimento-automático-de-clientes)
  - [1.6 Erros Comuns e Prevenção](#16-erros-comuns-e-prevenção)
- [1.7 Guia de Implementação para novas funcionalidades](#17-guia-de-implementação-para-novas-funcionalidades)
- [2. Integração com Google Calendar API](#2-integração-com-google-calendar-api)
- [3. Fluxos de Dados e Sincronização](#3-fluxos-de-dados-e-sincronização)

---

## 1. Implementação do Banco de Dados

### 1.1 Arquitetura de Dados

O ChamadosPro utiliza PostgreSQL como banco de dados principal, gerenciado através do Drizzle ORM. A arquitetura segue o padrão de multi-tenancy, onde cada técnico (user) possui seus próprios clientes, serviços e chamados isolados.

### 1.2 Tecnologias Utilizadas

- **Banco de Dados**: PostgreSQL (Neon Serverless)
- **ORM**: Drizzle ORM
- **Driver**: @neondatabase/serverless
- **Validação**: Zod + drizzle-zod
- **Migrations**: Drizzle Kit

### 1.3 Schema do Banco de Dados

#### 1.3.1 Tabela: `sessions`

Gerencia sessões de autenticação.

```typescript
{
  sid: varchar (PRIMARY KEY)           // Session ID único
  sess: jsonb                          // Dados da sessão em JSON
  expire: timestamp                    // Timestamp de expiração

  Índices:
  - IDX_session_expire (expire)        // Otimiza limpeza de sessões expiradas
}
```

**Uso**: Armazena sessões HTTP para autenticação baseada em cookies.

---

#### 1.3.2 Tabela: `users`

Representa técnicos e funcionários do sistema.

```typescript
{
  id: varchar (PRIMARY KEY)            // ID do usuário (Google OAuth)
  email: varchar (UNIQUE)              // Email do usuário
  firstName: varchar                   // Primeiro nome
  lastName: varchar                    // Sobrenome
  profileImageUrl: varchar             // URL da foto de perfil
  role: text (DEFAULT 'technician')    // Papel do usuário
  publicSlug: varchar (UNIQUE)         // Slug público para agendamentos
  createdAt: timestamp                 // Data de criação
  updatedAt: timestamp                 // Data de atualização
}
```

**Relacionamentos**:

- Um usuário possui muitos clientes (1:N)
- Um usuário possui muitos serviços (1:N)
- Um usuário possui muitos chamados (1:N)

**Validações**:

- Email deve ser único
- publicSlug é gerado automaticamente através de slugify do nome/email

**Geração do publicSlug**:

```typescript
// Algoritmo de geração:
1. Tenta usar: firstName + lastName
2. Se vazio, usa: parte antes do @ do email
3. Se vazio, usa: "tecnico"
4. Aplica slugify() para normalizar (remove acentos, converte para lowercase)
5. Se slug já existe, adiciona sufixo numérico (-1, -2, etc)
```

---

#### 1.3.3 Tabela: `clients`

Armazena informações de clientes (Pessoa Física, Pessoa Jurídica ou Empresa Parceira).

```typescript
{
  id: varchar (PRIMARY KEY)            // UUID auto-gerado
  userId: varchar (FK → users.id)      // Proprietário do cliente
  type: text                           // "PF", "PJ" ou "EMPRESA_PARCEIRA"
  name: text                           // Nome (PF/PJ) ou Nome Fantasia (EMPRESA_PARCEIRA)
  document: text                       // CPF ou CNPJ
  email: text                          // Email do cliente
  phone: text                          // Telefone
  address: text                        // Endereço (mantido para compatibilidade)
  city: text                           // Cidade
  state: text                          // Estado (UF)

  // Campos específicos de EMPRESA_PARCEIRA - Informações Fiscais
  legalName: text                      // Razão Social
  municipalRegistration: text          // Inscrição Municipal
  stateRegistration: text             // Inscrição Estadual

  // Campos específicos de EMPRESA_PARCEIRA - Endereço Completo
  zipCode: text                        // CEP
  streetAddress: text                  // Logradouro/Rua
  addressNumber: text                  // Número
  addressComplement: text              // Complemento
  neighborhood: text                   // Bairro/Distrito

  // Campos específicos de EMPRESA_PARCEIRA - Ciclo de Pagamento
  paymentCycleStartDay: integer        // Dia de início do ciclo (1-31)
  paymentCycleEndDay: integer         // Dia de fim do ciclo (1-31)
  paymentDueDay: integer               // Dia de vencimento (mês seguinte, 1-31)

  // Campos específicos de EMPRESA_PARCEIRA - Valores Padrão
  defaultTicketValue: decimal(10,2)   // Valor padrão do chamado
  defaultHoursIncluded: integer       // Horas incluídas no valor padrão
  defaultKmRate: decimal(6,2)         // Taxa de KM (R$/km)
  defaultAdditionalHourRate: decimal(10,2) // Taxa de hora adicional (R$)

  // Planilha Mensal (todos os tipos)
  monthlySpreadsheet: boolean          // Se deve receber planilha mensal
  spreadsheetEmail: text               // Email para envio de planilha
  spreadsheetDay: integer              // Dia do mês para envio (1-31)

  noShowCount: integer (DEFAULT 0)     // Contador de faltas
  createdAt: timestamp                 // Data de criação
  updatedAt: timestamp                 // Data de atualização
}
```

**Regras de Negócio**:

- Se `type = "PJ"` ou `type = "EMPRESA_PARCEIRA"` e `monthlySpreadsheet = true`:
  - `spreadsheetEmail` é obrigatório
  - `spreadsheetDay` é obrigatório (1-31)
- Email deve ter formato válido
- `noShowCount` é incrementado automaticamente quando `noShow = true` em tickets
- Para `EMPRESA_PARCEIRA`: `legalName` (Razão Social) é obrigatório
- Para `EMPRESA_PARCEIRA`: `name` (Nome Fantasia) é opcional, se não informado recebe "N/C"

#### 1.3.3.1 Requisitos de Campos dos Formulários

##### Formulário de Cliente - Pessoa Física (PF)

| Campo             | Obrigatório    | Tipo  | Observações                     |
| ----------------- | -------------- | ----- | ------------------------------- |
| Nome              | ❌ Opcional    | Text  | Nome completo da pessoa         |
| CPF               | ❌ Opcional    | Text  | Formato: 000.000.000-00         |
| E-mail            | ❌ Opcional    | Email | Formato de email válido         |
| Telefone          | ✅ Obrigatório | Text  | Formato: (00) 00000-0000        |
| Endereço          | ❌ Opcional    | Text  | Endereço completo ou apenas rua |
| Número            | ❌ Opcional    | Text  | Número do endereço              |
| Complemento       | ❌ Opcional    | Text  | Complemento do endereço         |
| Bairro / Distrito | ❌ Opcional    | Text  | Bairro ou distrito              |
| Estado            | ❌ Opcional    | Text  | UF (2 caracteres)               |
| Cidade            | ❌ Opcional    | Text  | Nome da cidade                  |

##### Formulário de Cliente - Pessoa Jurídica (PJ Cliente Final)

| Campo             | Obrigatório    | Tipo  | Observações                     |
| ----------------- | -------------- | ----- | ------------------------------- |
| Nome da Empresa   | ❌ Opcional    | Text  | Nome fantasia da empresa        |
| Razão Social      | ✅ Obrigatório | Text  | Razão social completa           |
| CNPJ              | ❌ Opcional    | Text  | Formato: 00.000.000/0000-00     |
| E-mail            | ❌ Opcional    | Email | Formato de email válido         |
| Telefone          | ✅ Obrigatório | Text  | Formato: (00) 00000-0000        |
| Endereço          | ❌ Opcional    | Text  | Endereço completo ou apenas rua |
| Número            | ❌ Opcional    | Text  | Número do endereço              |
| Complemento       | ❌ Opcional    | Text  | Complemento do endereço         |
| Bairro / Distrito | ❌ Opcional    | Text  | Bairro ou distrito              |
| Estado            | ❌ Opcional    | Text  | UF (2 caracteres)               |
| Cidade            | ❌ Opcional    | Text  | Nome da cidade                  |

##### Formulário de Cliente - Empresa Parceira (EMPRESA_PARCEIRA)

**Seção: Informações Fiscais**

| Campo                   | Obrigatório    | Tipo  | Observações                         |
| ----------------------- | -------------- | ----- | ----------------------------------- |
| Empresa (Nome Fantasia) | ❌ Opcional    | Text  | Nome fantasia (se vazio, usa "N/C") |
| Razão Social            | ✅ Obrigatório | Text  | Razão social completa               |
| Inscrição Municipal     | ❌ Opcional    | Text  | Inscrição municipal                 |
| Inscrição Estadual      | ❌ Opcional    | Text  | Inscrição estadual                  |
| CNPJ                    | ❌ Opcional    | Text  | Formato: 00.000.000/0000-00         |
| E-mail                  | ❌ Opcional    | Email | Formato de email válido             |
| Telefone                | ✅ Obrigatório | Text  | Formato: (00) 00000-0000            |

**Seção: Endereço Completo**

| Campo             | Obrigatório | Tipo | Observações             |
| ----------------- | ----------- | ---- | ----------------------- |
| CEP               | ❌ Opcional | Text | Formato: 00000-000      |
| Rua / Logradouro  | ❌ Opcional | Text | Nome da rua/avenida     |
| Número            | ❌ Opcional | Text | Número do endereço      |
| Complemento       | ❌ Opcional | Text | Complemento do endereço |
| Bairro / Distrito | ❌ Opcional | Text | Bairro ou distrito      |
| Estado            | ❌ Opcional | Text | UF (2 caracteres)       |
| Cidade            | ❌ Opcional | Text | Nome da cidade          |

**Seção: Ciclo de Pagamento**

| Campo                        | Obrigatório | Tipo    | Observações                   |
| ---------------------------- | ----------- | ------- | ----------------------------- |
| Início do Ciclo (dia)        | ❌ Opcional | Integer | Dia do mês (1-31), padrão: 1  |
| Fim do Ciclo (dia)           | ❌ Opcional | Integer | Dia do mês (1-31), padrão: 30 |
| Pagamento (dia mês seguinte) | ❌ Opcional | Integer | Dia do mês (1-31), padrão: 5  |

**Seção: Valores Padrão**

| Campo                     | Obrigatório | Tipo    | Observações                                |
| ------------------------- | ----------- | ------- | ------------------------------------------ |
| Valor Chamado (R$)        | ❌ Opcional | Decimal | Valor padrão do chamado                    |
| Até x Horas               | ❌ Opcional | Integer | Horas incluídas no valor padrão, padrão: 3 |
| Valor Hora Adicional (R$) | ❌ Opcional | Decimal | Valor por hora adicional                   |
| Valor KM (R$/km)          | ❌ Opcional | Decimal | Taxa de KM por quilômetro                  |

**Seção: Planilha Mensal**

| Campo                  | Obrigatório    | Tipo    | Observações                                       |
| ---------------------- | -------------- | ------- | ------------------------------------------------- |
| Enviar Planilha Mensal | ❌ Opcional    | Boolean | Se deve receber planilha mensal                   |
| E-mail para Planilha   | ⚠️ Condicional | Email   | Obrigatório se `monthlySpreadsheet = true`        |
| Dia do Mês             | ⚠️ Condicional | Integer | Obrigatório se `monthlySpreadsheet = true` (1-31) |

**Notas Importantes**:

- ✅ = Campo obrigatório (validação HTML5 + backend)
- ❌ = Campo opcional (pode ser deixado em branco)
- ⚠️ = Campo condicional (obrigatório apenas em certas condições)
- Campos opcionais que ficam vazios são salvos como string vazia (`''`) no banco de dados
- O campo `name` (Nome/Nome da Empresa) não é obrigatório para nenhum tipo de cliente
- O campo `legalName` (Razão Social) é obrigatório apenas para PJ e EMPRESA_PARCEIRA
- O campo `phone` (Telefone) é obrigatório para todos os tipos de cliente

---

#### 1.3.4 Tabela: `services`

Catálogo de serviços oferecidos.

```typescript
{
  id: varchar (PRIMARY KEY)            // UUID auto-gerado
  userId: varchar (FK → users.id)      // Proprietário do serviço
  name: text                           // Nome do serviço
  description: text                    // Descrição detalhada
  price: decimal(10,2)                 // Preço (formato: 9999999.99)
  duration: integer                    // Duração em horas
  active: boolean (DEFAULT true)       // Se está disponível para agendamento
  createdAt: timestamp                 // Data de criação
}
```

**Uso**:

- Apenas serviços com `active = true` aparecem no agendamento público
- Preço é armazenado como decimal para precisão financeira
- Duração é usada para calcular slots de agendamento

---

#### 1.3.5 Tabela: `tickets`

Registros de chamados/agendamentos de serviço.

```typescript
{
  id: varchar (PRIMARY KEY)                    // UUID auto-gerado
  userId: varchar (FK → users.id)              // Proprietário do chamado
  technicianId: varchar (FK → users.id)        // Técnico designado
  clientId: varchar (FK → clients.id)          // Cliente do serviço
  serviceId: varchar (FK → services.id)        // Serviço contratado
  status: text (DEFAULT 'pending')             // Status: pending, in-progress, completed, cancelled
  scheduledDate: timestamp                     // Data/hora do agendamento
  scheduledTime: text                          // Hora formatada (HH:MM)
  duration: integer                            // Duração em horas

  // Localização
  address: text                                // Endereço do atendimento
  city: text                                   // Cidade
  state: text                                  // Estado (UF)

  // Metadados de agendamento
  travelTimeMinutes: integer (DEFAULT 30)      // Tempo de deslocamento
  bufferTimeMinutes: integer (DEFAULT 15)      // Buffer entre agendamentos
  description: text                            // Descrição do serviço

  // Financeiro
  extraHours: decimal(4,2) (DEFAULT 0)         // Horas extras
  totalAmount: decimal(10,2)                   // Valor total

  // Integrações
  googleCalendarEventId: text                  // ID do evento no Google Calendar

  // Controle
  cancellationReason: text                     // Motivo do cancelamento
  noShow: boolean (DEFAULT false)              // Se cliente faltou
  completedAt: timestamp                       // Data de conclusão
  createdAt: timestamp                         // Data de criação
}
```

**Fluxo de Status**:

```
pending → in-progress → completed
   ↓
cancelled
```

**Cálculos Automáticos**:

- `totalAmount` = (preço do serviço) + (extraHours Î valor hora extra)
- Duração total real = duration + travelTime + buffer

---

#### 1.3.6 Tabela: `financial_records`

Registros financeiros e contas a receber.

```typescript
{
  id: varchar (PRIMARY KEY)            // UUID auto-gerado
  userId: varchar (FK → users.id)      // Proprietário do registro
  ticketId: varchar (FK → tickets.id)  // Chamado relacionado (opcional)
  clientId: varchar (FK → clients.id)  // Cliente relacionado
  amount: decimal(10,2)                // Valor
  type: text                           // "receivable" ou "paid"
  status: text (DEFAULT 'pending')     // pending, overdue, paid
  dueDate: timestamp                   // Data de vencimento
  paidAt: timestamp                    // Data de pagamento
  description: text                    // Descrição
  createdAt: timestamp                 // Data de criação
}
```

**Regras de Status**:

- `pending`: Aguardando pagamento, ainda no prazo
- `overdue`: Vencido (dueDate < hoje e não pago)
- `paid`: Pago (paidAt preenchido)

**Cálculos Agregados Disponíveis**:

```typescript
getCashFlowSummary(userId, startDate?, endDate?) {
  totalReceivables: sum(amount WHERE type = 'receivable')
  totalPaid: sum(amount WHERE status = 'paid')
  totalPending: sum(amount WHERE status = 'pending')
  totalOverdue: sum(amount WHERE status = 'overdue')
}
```

---

#### 1.3.7 Tabela: `integration_settings`

Configurações de integração por usuário.

```typescript
{
  id: varchar (PRIMARY KEY)                        // UUID auto-gerado
  userId: varchar (FK → users.id, UNIQUE)          // Um registro por usuário

  // Google Calendar
  googleCalendarStatus: text (DEFAULT 'not_connected')  // not_connected, connected, error, pending
  googleCalendarTokens: jsonb                           // Tokens OAuth (armazenados localmente)
  googleCalendarEmail: text                             // Email da conta conectada

  // Configurações de Agendamento
  leadTimeMinutes: integer (DEFAULT 30)            // Tempo mínimo antes do agendamento
  bufferMinutes: integer (DEFAULT 15)              // Buffer entre agendamentos
  travelMinutes: integer (DEFAULT 30)              // Tempo de deslocamento padrão
  defaultDurationHours: integer (DEFAULT 3)        // Duração padrão de serviços
  timezone: text (DEFAULT 'America/Sao_Paulo')     // Fuso horário

  // Lembretes
  reminder24hEnabled: boolean (DEFAULT true)       // Lembrete 24h antes
  reminder1hEnabled: boolean (DEFAULT true)        // Lembrete 1h antes

  updatedAt: timestamp                             // Data de atualização
}
```

**Uso**:

- `leadTimeMinutes`: Clientes não podem agendar com menos de X minutos de antecedência
- `bufferMinutes`: Tempo de folga entre agendamentos para imprevistos
- `travelMinutes`: Tempo de deslocamento considerado no cálculo de conflitos

---

#### 1.3.8 Tabela: `reminder_logs`

Histórico de envio de lembretes.

```typescript
{
  id: varchar (PRIMARY KEY)            // UUID auto-gerado
  ticketId: varchar (FK → tickets.id)  // Chamado relacionado
  type: text                           // "24h" ou "1h"
  status: text                         // "sent" ou "failed"
  sentAt: timestamp                    // Data de envio
  error: text                          // Mensagem de erro (se falhou)
}
```

**Sistema de Lembretes**:

- Scheduler roda a cada 5 minutos
- Lembrete T-24h: enviado entre 22-25h antes do agendamento
- Lembrete T-1h: enviado entre 0.5-1.5h antes do agendamento
- Previne duplicatas verificando logs existentes

---

### 1.4 Sistema de Preenchimento Automático de Clientes

O sistema implementa três métodos de captura de dados para cadastro de clientes:

**📚 Documentação Completa**:

- **Manual de Implementação**: `MANUAL_IMPLEMENTACAO_AUTO_PREENCHIMENTO.md` - Guia completo passo a passo
- **Sistema de Parsing de Texto**: `SISTEMA_PARSING_TEXTO_CLIENTES.md` - Detalhes técnicos do sistema de scoring

#### 1.4.1 Preenchimento por CPF/CNPJ (Busca Automática)

**Funcionamento**:

1. Usuário digita CPF (11 dígitos) ou CNPJ (14 dígitos) no campo inicial
2. Sistema identifica automaticamente o tipo de documento
3. Sistema verifica se o cliente já está cadastrado no banco de dados
4. Se não estiver cadastrado:
   - **CPF**: Mostra automaticamente os campos de Pessoa Física
   - **CNPJ**: Exibe modal perguntando se é "PJ Cliente Final" ou "Empresa Parceira"
5. Para CNPJ, busca dados na API BrasilAPI (`https://brasilapi.com.br/api/cnpj/v1/{cnpj}`)
6. Preenche automaticamente os campos com dados da API

**Campos preenchidos pela API BrasilAPI**:

- `razaoSocial` → `legalName`
- `nome_fantasia` → `name`
- `cep` → `zipCode`
- `logradouro` → `streetAddress`
- `numero` → `addressNumber`
- `bairro` → `neighborhood`
- `municipio` → `city`
- `uf` → `state`
- `ddd_telefone_1` → `phone`
- `email` → `email` (se disponível)

**Validações**:

- Verifica se cliente já existe antes de mostrar campos
- Exibe aviso se cliente já estiver cadastrado
- Aplica máscaras automaticamente (CPF: `000.000.000-00`, CNPJ: `00.000.000/0000-00`)

#### 1.4.2 Preenchimento por Texto Colado

**Funcionamento**:

1. Usuário cola texto contendo dados do cliente (ex: copiado de documento, email, etc.)
2. Sistema detecta automaticamente:
   - Nome
   - Email
   - Telefone (com DDD)
   - CPF ou CNPJ
   - Cidade e UF
   - Endereço completo (CEP, rua, número, complemento, bairro)
3. Identifica automaticamente se é PF ou PJ baseado no documento encontrado
4. Preenche os campos automaticamente

**Tecnologia**: Regex patterns e parsing inteligente de texto

#### 1.4.3 Preenchimento por Imagem (OCR)

**Funcionamento**:

1. Usuário faz upload de imagem ou cola imagem do clipboard
2. Sistema processa a imagem com OCR (Tesseract.js) 100% offline
3. Extrai texto da imagem
4. Aplica o mesmo parsing do texto colado
5. Para CNPJ encontrado, busca dados na API BrasilAPI
6. Preenche campos automaticamente

**Tecnologias**:

- **OCR**: Tesseract.js (processamento 100% no navegador)
- **Parser**: `OCRParser.ts` com lógica multi-camadas:
  - Detecção baseada em labels
  - Análise linha por linha
  - Fallback com listas de padrões
  - Regex patterns para validação

**Correções Automáticas de OCR**:

- Email: Corrige caracteres mal lidos (`Q`, `Z`, `O`, `0`, `&`, `e` → `@`)
- Telefone: Detecta e corrige DDD quando ausente
- CNPJ/CPF: Validação rigorosa com verificação de dígitos
- Razão Social vs Nome Fantasia: Separação inteligente quando aparecem juntos

#### 1.4.4 Modo Manual vs Automático

**Modo Automático (Padrão)**:

- Mostra apenas: Campo CPF/CNPJ, Campo de texto colado, Campo de imagem
- Campos do formulário ficam ocultos até detecção automática
- Botão "Preenchimento Manual" disponível para alternar

**Modo Manual**:

- Ativado pelo botão "Preenchimento Manual"
- Mostra todos os campos do formulário
- Oculta campos automáticos (CPF/CNPJ, texto, imagem)
- Botão "Voltar para Preenchimento Automático" disponível

**Fluxo de Estados**:

```
Estado Inicial
  ↓
[CPF/CNPJ digitado] → Verifica se existe → [Não existe] → Mostra campos apropriados
  ↓
[Texto colado] → Processa → Detecta documento → Mostra campos
  ↓
[Imagem enviada] → OCR → Processa → Detecta documento → Mostra campos
  ↓
[Botão Manual] → Modo Manual → Todos os campos visíveis
```

#### 1.4.5 Estrutura de Armazenamento no Google Sheets

**Compatibilidade**:

- ✅ **Totalmente compatível**: O Google Sheets armazena dados como JSON na coluna "data"
- ✅ **Campos novos são automaticamente incluídos**: Não requer alteração na estrutura da planilha
- ✅ **Retrocompatibilidade**: Campos antigos continuam funcionando

**Estrutura da Planilha**:

```
Coluna A: id (UUID)
Coluna B: userId (ID do usuário)
Coluna C: data (JSON com todos os campos do cliente)
Coluna D: createdAt (ISO timestamp)
Coluna E: updatedAt (ISO timestamp)
```

**Exemplo de JSON na coluna "data"**:

```json
{
  "type": "EMPRESA_PARCEIRA",
  "name": "Findup",
  "legalName": "Findup Tecnologia Em Sistemas Ltda",
  "document": "12.345.678/0001-90",
  "email": "contato@findup.com.br",
  "phone": "(11) 98765-4321",
  "zipCode": "01234-567",
  "streetAddress": "Rua Exemplo",
  "addressNumber": "123",
  "addressComplement": "Sala 45",
  "neighborhood": "Centro",
  "city": "São Paulo",
  "state": "SP",
  "municipalRegistration": "123456",
  "stateRegistration": "123.456.789.123",
  "paymentCycleStartDay": 1,
  "paymentCycleEndDay": 30,
  "paymentDueDay": 5,
  "defaultTicketValue": "150.00",
  "defaultHoursIncluded": 3,
  "defaultKmRate": "0.50",
  "defaultAdditionalHourRate": "50.00",
  "monthlySpreadsheet": true,
  "spreadsheetEmail": "financeiro@findup.com.br",
  "spreadsheetDay": 5
}
```

---

### 1.5 Relacionamentos e Integridade Referencial

```
users (1) ──→ (N) clients
  │
  ├──→ (N) services
  │
  ├──→ (N) tickets
  │
  └──→ (1) integration_settings

clients (1) ──→ (N) tickets
  │
  └──→ (N) financial_records

services (1) ──→ (N) tickets

tickets (1) ──→ (0..1) financial_records
  │
  └──→ (N) reminder_logs
```

**Políticas de Cascata**:

- Deleção de usuário: **NÃO IMPLEMENTADA** (requer análise de impacto)
- Deleção de cliente: Bloqueia se houver tickets associados
- Deleção de serviço: Bloqueia se houver tickets associados
- Deleção de ticket: Remove reminder_logs associados

---

### 1.5 Interface de Storage (IStorage)

A camada de abstração de dados expõe os seguintes métodos:

#### Usuários

```typescript
getUser(id: string): Promise<User | undefined>
getUserByEmail(email: string): Promise<User | undefined>
getUserBySlug(slug: string): Promise<User | undefined>
getAllUsers(): Promise<User[]>
upsertUser(user: UpsertUser): Promise<User>  // Cria ou atualiza
```

#### Clientes

```typescript
getClient(id: string): Promise<Client | undefined>
getClientsByUser(userId: string): Promise<Client[]>
createClient(client: InsertClient): Promise<Client>
updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>
deleteClient(id: string): Promise<boolean>
```

#### Serviços

```typescript
getService(id: string): Promise<Service | undefined>
getServicesByUser(userId: string): Promise<Service[]>
getActiveServicesByUser(userId: string): Promise<Service[]>  // Apenas active = true
createService(service: InsertService): Promise<Service>
updateService(id: string, service: Partial<InsertService>): Promise<Service | undefined>
deleteService(id: string): Promise<boolean>
```

#### Chamados

```typescript
getTicket(id: string): Promise<Ticket | undefined>
getTicketsByUser(userId: string): Promise<Ticket[]>
getTicketsByClient(clientId: string): Promise<Ticket[]>
getTicketsByTechnician(technicianId: string): Promise<Ticket[]>
getTicketsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Ticket[]>
getTicketsByStatus(userId: string, status: string): Promise<Ticket[]>
getTicketsByStatuses(userId: string, statuses: string[]): Promise<Ticket[]>
createTicket(ticket: InsertTicket): Promise<Ticket>
updateTicket(id: string, ticket: Partial<InsertTicket>): Promise<Ticket | undefined>
deleteTicket(id: string): Promise<boolean>
```

#### Registros Financeiros

```typescript
getFinancialRecord(id: string): Promise<FinancialRecord | undefined>
getFinancialRecordsByUser(userId: string, filters?: {...}): Promise<FinancialRecord[]>
createFinancialRecord(record: InsertFinancialRecord): Promise<FinancialRecord>
updateFinancialRecord(id: string, record: Partial<InsertFinancialRecord>): Promise<FinancialRecord | undefined>
deleteFinancialRecord(id: string): Promise<boolean>
getCashFlowSummary(userId: string, startDate?, endDate?): Promise<{...}>
getReceivables(userId: string, overdue?: boolean): Promise<FinancialRecord[]>
```

#### Configurações de Integração

```typescript
getIntegrationSettings(userId: string): Promise<IntegrationSettings | undefined>
createIntegrationSettings(settings: InsertIntegrationSettings): Promise<IntegrationSettings>
updateIntegrationSettings(userId: string, settings: Partial<InsertIntegrationSettings>): Promise<IntegrationSettings | undefined>
createOrUpdateIntegrationSettings(settings: InsertIntegrationSettings): Promise<IntegrationSettings>
```

#### Logs de Lembretes

```typescript
getReminderLog(id: string): Promise<ReminderLog | undefined>
getReminderLogsByTicket(ticketId: string): Promise<ReminderLog[]>
createReminderLog(log: InsertReminderLog): Promise<ReminderLog>
```

---

### 1.6 Sistema de Migrations

**Configuração** (`drizzle.config.ts`):

```typescript
{
  out: "./migrations",              // Diretório de migrations
  schema: "./shared/schema.ts",     // Schema fonte
  dialect: "postgresql",            // Banco de dados
  dbCredentials: {
    url: process.env.DATABASE_URL   // String de conexão
  }
}
```

**Comandos Disponíveis**:

```bash
# Gerar migration baseado em mudanças no schema
npm run db:generate

# Aplicar migrations pendentes
npm run db:migrate

# Sincronizar schema diretamente (desenvolvimento)
npm run db:push

# Forçar sincronização (cuidado em produção)
npm run db:push --force

# Abrir Drizzle Studio (interface visual)
npm run db:studio
```

**Fluxo de Desenvolvimento**:

1. Modificar `shared/schema.ts`
2. Executar `npm run db:push` (desenvolvimento) ou `npm run db:generate && npm run db:migrate` (produção)
3. Validar mudanças via Drizzle Studio
4. Testar aplicação

**⚠️ IMPORTANTE - Regras de Segurança**:

- NUNCA alterar tipo de colunas de ID primário (serial ↔ varchar)
- Sempre usar `npm run db:push --force` ao invés de migrations manuais
- Verificar schema existente antes de fazer alterações
- Mudanças destrutivas devem ser testadas em staging primeiro

---

### 1.7 Validação de Dados

O sistema utiliza **Zod** para validação em runtime, integrado com Drizzle através de `drizzle-zod`.

**Exemplo - Validação de Cliente**:

```typescript
export const insertClientSchema = createInsertSchema(clients)
  .omit({
    id: true, // Auto-gerado
    createdAt: true, // Auto-gerado
    noShowCount: true, // Gerenciado pelo sistema
  })
  .refine(
    (data) => {
      // PJ com planilha mensal requer email e dia
      if (data.type === 'PJ' && data.monthlySpreadsheet) {
        return !!data.spreadsheetEmail && !!data.spreadsheetDay;
      }
      return true;
    },
    {
      message:
        'Para clientes PJ com planilha mensal ativada, é obrigatório informar o email e o dia de envio',
      path: ['monthlySpreadsheet'],
    }
  )
  .refine(
    (data) => {
      // Validar dia entre 1-31
      if (data.spreadsheetDay !== null && data.spreadsheetDay !== undefined) {
        return data.spreadsheetDay >= 1 && data.spreadsheetDay <= 31;
      }
      return true;
    },
    {
      message: 'O dia de envio da planilha deve estar entre 1 e 31',
      path: ['spreadsheetDay'],
    }
  )
  .refine(
    (data) => {
      // Validar formato de email
      if (data.spreadsheetEmail) {
        return z.string().email().safeParse(data.spreadsheetEmail).success;
      }
      return true;
    },
    {
      message: 'Email inválido para envio de planilha',
      path: ['spreadsheetEmail'],
    }
  );
```

**Validações Implementadas**:

- ✅ Formato de email
- ✅ Dia de envio de planilha (1-31)
- ✅ Campos obrigatórios condicionais (PJ + planilha mensal)
- ✅ Tipos de dados (string, number, boolean, date)
- ✅ Precisão decimal (valores financeiros)

---

### 1.6 Erros Comuns e Prevenção

Esta seção documenta erros reais encontrados durante o desenvolvimento do ChamadosPro,
as causas raiz e o padrão de correção recomendado. A ideia é que futuras IAs/DEV
sigam estes padrões e **não reintroduzam os mesmos bugs**.

#### 1.6.1 Erro: Ícone Inexistente no lucide-react

**Erro Encontrado**:

```
Uncaught SyntaxError: The requested module 'lucide-react' does not provide an export named 'FileXml'
```

**Causa**:

- Tentativa de importar ícone `FileXml` que não existe no pacote `lucide-react`
- O pacote `lucide-react` não possui todos os ícones com nomes específicos como `FileXml`
- Falta de verificação prévia da disponibilidade do ícone antes de usar

**Solução Aplicada**:

- Substituído `FileXml` por `FileCode` (ícone válido e apropriado para arquivos XML)
- Verificado disponibilidade do ícone na documentação oficial

**Regras para Prevenção**:

1. **Sempre verificar disponibilidade do ícone antes de usar**:

   - ✅ Consultar documentação oficial: https://lucide.dev/icons/
   - ✅ Usar busca na documentação para encontrar ícones similares
   - ✅ Testar importação antes de usar em produção
   - ❌ Nunca assumir que um ícone existe baseado apenas no nome

2. **Ícones alternativos comuns**:

   ```typescript
   // Para arquivos XML/código
   FileXml → FileCode ✅

   // Para PDFs
   FilePdf → FileText ou File ✅

   // Para planilhas Excel
   FileExcel → FileSpreadsheet ou File ✅

   // Para documentos Word
   FileWord → FileText ✅
   ```

3. **Processo de verificação obrigatório**:

   ```typescript
   // ❌ ERRADO - Não verificar antes
   import { FileXml } from 'lucide-react';

   // ✅ CORRETO - Verificar na documentação primeiro
   import { FileCode } from 'lucide-react'; // Ícone válido para XML
   ```

4. **Checklist antes de adicionar novo ícone**:

   - [ ] Consultar https://lucide.dev/icons/ para verificar se o ícone existe
   - [ ] Testar importação no código (se der erro, o ícone não existe)
   - [ ] Verificar se o nome está correto (case-sensitive: `FileCode` não é `filecode`)
   - [ ] Se não existir, encontrar alternativa apropriada na documentação
   - [ ] Verificar se a alternativa faz sentido semanticamente

5. **Ícones comuns disponíveis no lucide-react**:

   ```typescript
   // Arquivos
   File, FileText, FileCode, FileImage, FileVideo, FileAudio;
   FileSpreadsheet, FileCheck, FileX, FileSearch, FileUp, FileDown;

   // Pastas
   Folder, FolderOpen, FolderPlus, FolderMinus;

   // Usuários
   User, Users, UserPlus, UserCheck, UserX, UserCircle;

   // Edifícios/Localização
   Building, Building2, Home, MapPin, Navigation;

   // Comunicação
   Mail, Phone, MessageCircle, MessageSquare;

   // Tempo
   Calendar, Clock, Timer, CalendarClock;

   // Ações
   Search, Filter, Settings, Edit, Trash2, Plus, Minus;
   Upload, Download, Save, Check, X, AlertCircle;

   // Navegação
   ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ChevronLeft, ChevronRight;

   // Status
   Loader2, AlertCircle, Info, CheckCircle, XCircle, AlertTriangle;
   ```

6. **Como verificar se um ícone existe**:

   ```bash
   # Método 1: Consultar documentação online
   # Acessar: https://lucide.dev/icons/
   # Buscar pelo nome do ícone

   # Método 2: Testar no código
   import { NomeDoIcone } from 'lucide-react';
   # Se der erro, o ícone não existe

   # Método 3: Verificar no node_modules
   # Navegar até: node_modules/lucide-react/dist/esm/icons/
   # Verificar se o arquivo existe
   ```

7. **Padrão de nomenclatura do lucide-react**:

   - ✅ PascalCase para nomes de componentes: `FileCode`, `UserPlus`
   - ✅ Sem sufixos específicos de formato: não há `FileXml`, `FilePdf`
   - ✅ Nomes genéricos e descritivos: `FileCode` para código/XML
   - ✅ Sempre verificar na documentação antes de usar

8. **Exemplo de Implementação Segura**:

   ```typescript
   // ✅ Implementação correta
   import { FileCode } from 'lucide-react';

   <Button>
     <FileCode className='h-4 w-4 mr-2' />
     Selecionar arquivo XML
   </Button>;
   ```

9. **Referências**:
   - Documentação oficial: https://lucide.dev/icons/
   - Repositório: https://github.com/lucide-icons/lucide
   - Busca de ícones: https://lucide.dev/icons/ (usar a barra de busca)

**Regra Geral**:

> **NUNCA assuma que um ícone existe. SEMPRE verifique na documentação oficial do lucide-react antes de usar um novo ícone.**

---

#### 1.6.2 Erros de OCR / Extração de Dados (CNPJ, Email, Telefone, Razão Social)

**Problemas encontrados**:

- CNPJ capturado errado (confundindo com CPF ou outros números).
- Emails com `@` lido errado (`&`, `e`, `Q`, `O`, `0` etc).
- Telefones sem DDD ou com DDD OCRizado errado (`tm) 3132-0674`).
- Razão Social misturada com Nome Fantasia, ou contendo literalmente o texto `"Nome fantasia"`.

**Soluções implementadas** (em `client/src/utils/OCRParser.ts`):

- Estratégia multi-camada de extração:
  - Busca por labels (`CNPJ`, `CPF`, `E-mail`, `Telefone`, `Razão Social`, `Nome Fantasia`).
  - Leitura linha-a-linha com validação rígida de formato.
  - Fallback com regex no texto completo.
- Validações:
  - `validateCNPJ()` e `validateCPF()` com dígitos verificadores.
  - `validateEmail()` com correções para caracteres suspeitos (`QZO0&` → `@`).
  - `validatePhone()` garantindo 10–11 dígitos e DDD válido.
- Funções auxiliares:
  - `tryRecoverInlineEmail()` para reconstruir emails sem `@` ou com padrões repetidos.
  - `extractPhone()` com heurísticas específicas para “DDD corrompido” e para padrão
    `(\d{2})\s?[a-z]{0,3}\)?\s(\d{4,5}-?\d{4})`.
  - `separateRazaoSocialFromNomeFantasia()` para separar linha única em Razão Social + Fantasia.

**Padrão para novas implementações**:

- Sempre que adicionar um novo campo OCR:
  - Implementar **validador** dedicado (formato + semântica).
  - Seguir a ordem: `label → linha seguinte → regex no texto → fallback`.
  - Logar passos de extração durante o desenvolvimento, e depois remover/ reduzir logs.

---

#### 1.6.3 Erros de Acesso a Propriedades Nulas/Indefinidas

**Erros típicos**:

```ts
Cannot read properties of null (reading 'name')
Cannot read properties of undefined (reading 'name')
```

**Casos concretos**:

- `deletingService.name` em `servicos.tsx` quando `deletingService` era `null`.
- `ticket.client.name` em `calendar-view.tsx` quando `ticket.client` não estava populado.

**Correção aplicada**:

- Uso sistemático de **optional chaining** e valores padrão:
  - `deletingService?.name ?? ''`
  - `ticket.client?.name ?? 'Cliente'`
- Ao mapear listas relacionadas (tickets + clientes/serviços), garantir que os
  joins sejam feitos no backend ou na query (React Query) antes de renderizar
  o componente.

**Regra para novas features**:

- Nunca acessar diretamente propriedades de objetos provenientes de API/estado
  sem:
  - `obj?.prop` **ou**
  - checagem explícita: `if (!obj) return null;`.

---

#### 1.6.4 Dialogs e Modais que Fecham Inesperadamente

**Problemas**:

- Modais de cadastro em massa (XML, múltiplas imagens) fechando no meio do processo.
- Botões de confirmação (ex.: “Sim, sobrescrever”, “Excluir todos”) encerrando o
  `AlertDialog` antes de concluir o fluxo assíncrono.
- Botão `X` de fechar `Dialog` ignorando confirmação de cancelamento.

**Padrões adotados**:

- Para **AlertDialog** com processamento assíncrono:
  - Usar `onClick={(e) => { e.preventDefault(); ... }}` no `AlertDialogAction` para
    impedir o fechamento automático.
  - Controlar o fechamento manualmente após o término do processamento.
- Para modais com confirmação:
  - `onOpenChange={(open) => { if (!open) setShowCancelConfirm(true); }}`
    (ex.: modal de “Novo Chamado”).
  - Botão “Cancelar” abre `AlertDialog` de confirmação; só depois de “Sim, cancelar”
    o formulário é resetado/fechado.
- Para fluxos de cadastro em massa:
  - Manter o Dialog **aberto** durante todo o processo e exibir progresso + logs
    dentro do próprio modal, não via `console.log`.

---

#### 1.6.5 Importação de XML e Cadastro em Massa

**Problemas reais encontrados**:

- XML com tags diferentes do esperado (`e_mail`, `rua_logradouro`, `bairro_distrito`,
  `uf_estado`, `razao_social`, `nome_fantasia` etc.).
- Todos os clientes importados como PF.
- Clientes PF sendo descartados por falta de nome/email/telefone.
- Backend crashando por validação Zod/Drizzle (email obrigatório).
- Processo travando em 10% após clicar em “Sim, sobrescrever” em cliente duplicado.

**Soluções aplicadas em `clientes.tsx`**:

- Função `getText` com **aliases de tags** para cada campo.
- Função `detectCompanyType(name)` para inferir `type` quando não há documento.
- Função `treatClientData(rawData)`:
  - Normaliza nome, documento (com máscara), email, telefone, CEP, UF.
  - Gera nome padrão para PF (`email` local-part ou `CPF xxx`).
  - Garante email placeholder (`sem-email@placeholder.local`) quando ausente.
  - Não exige campos obrigatórios para persistir no banco; apenas o frontend
    impõe obrigatoriedade.
- Remoção de validações frontend “duras” que bloqueavam PF sem email/telefone.
- Modal dedicado para cadastro em massa (XML) com:
  - Barra de progresso de **tratamento** e de **inserção**.
  - Mensagens individuais de sucesso/erro por cliente.
  - Tratamento correto do modal de duplicados (removido AlertDialog duplicado,
    garantindo que `onConfirm`/`onCancel` sejam respeitados).

**Boas práticas para novas integrações em lote**:

- Sempre parsear XML/CSV em **dois estágios**:
  1. Tratamento/normalização de dados.
  2. Inserção no banco com feedback granular ao usuário.
- Nunca depender de um único campo obrigatório para decidir se o cliente é válido;
  preferir defaults e deixar regras de negócio no frontend.

---

#### 1.6.6 Exclusão em Massa e Feedback ao Usuário

**Erros encontrados**:

- Endpoint `/api/clients` aparentemente não deletando clientes.
- Mensagem enganosa “Nenhum cliente foi removido” mesmo quando havia erro.
- Exclusão acontecendo apenas no backend, sem feedback visual (somente logs no console).

**Correções**:

- Backend:
  - `storage.deleteAllClientsByUser(userId)` iterando clientes e chamando
    `deleteEntity` para cada um.
- Frontend (`clientes.tsx`):
  - Estratégia segura: `GET /api/clients` → loop `DELETE /api/clients/:id`.
  - Modal dedicado com:
    - Barra de progresso (%).
    - Lista de mensagens por cliente (`success`/`error`).
  - `AlertDialogAction` com `e.preventDefault()` para manter modal aberto.
  - Toast só exibido se `deleted > 0`.

**Padrão para novas remoções em massa**:

- Sempre:
  - Buscar a lista primeiro.
  - Exibir progresso incremental.
  - Registrar sucesso/erro por item.
  - Não fechar modal automaticamente no meio do processo.

---

#### 1.6.7 Campos de Formulário vs. Banco de Dados

**Decisão importante**:

- Para cadastros em massa (XML, múltiplas imagens), **nenhum campo é obrigatório
  no banco de dados**. Apenas as telas (frontend) aplicam obrigatoriedade.

**Motivação**:

- Permitir importação de bases heterogêneas (clientes PF sem email, por exemplo).
- Evitar crashes do backend por validação Zod ao processar grandes lotes.

**Implementação**:

- `shared/schema.ts`:
  - `insertClientSchema` com `email` e `phone` opcionais + defaults vazios.
- Frontend:
  - Formularios de PF/PJ/EMPRESA_PARCEIRA continuam com `required` nos campos
    que fazem sentido na UI.

---

### 1.7 Guia Rápido para a IA: Como Implementar Novas Funcionalidades

Este guia orienta como **uma IA ou desenvolvedor futuro** deve proceder para
implementar features no ChamadosPro sem quebrar decisões já tomadas.

#### 1.7.1 Padrão Geral de Trabalho

1. **Ler esta documentação** (especialmente seções 1.3, 1.4, 1.6).
2. **Identificar a camada correta**:
   - UI/UX → `client/src/pages/*` ou `client/src/components/*`.
   - Regra de negócio → `server/routes.ts`, `server/storage.ts`, helpers.
   - Persistência → `shared/schema.ts`.
3. **Respeitar os fluxos existentes**:
   - Cadastro automát ico vs. manual de clientes.
   - Busca automática por CPF/CNPJ (clientes e chamados).
   - Sincronização com Google Calendar (tickets).
4. **Adicionar logs apenas durante desenvolvimento** e removê-los
   depois de estabilizar o comportamento.

#### 1.7.2 Para Novos Campos OCR / Preenchimento Automático

- Implementar extração no `OCRParser.ts` seguindo:
  - `findValueAfterKeyword()` para labels.
  - Fallbacks com regex.
  - Validação rígida (regex + regras de domínio).
- Integrar no frontend:
  - `clientes.tsx` (cadastro de clientes) ou `chamados.tsx` (cadastro de chamados).
  - Preencher campos apenas quando vazios para não sobrescrever entradas manuais.
  - Combinar com APIs externas (CNPJ/CEP) **antes** de gravar no banco.

#### 1.7.3 Para Novos Fluxos de Cadastro em Massa (XML/Imagens/Excel)

- Reutilizar os componentes:
  - `MultipleImageUpload` para imagens (com `onProcessingChange` e `onProcessingFinished`).
  - Modal semelhante ao de XML para exibir progresso e mensagens.
- Seguir o pipeline:
  1. Coletar arquivos.
  2. Validar e normalizar dados (`treatClientData`-like).
  3. Resolver duplicados (modal de confirmação).
  4. Inserir um a um, com barra de progresso e logs visíveis.

#### 1.7.4 Para Filtros por Tipo de Cliente

- Usar sempre o componente `ClientCounters` (botões neon PF/PJ/PJ P) que:
  - Exibe a quantidade de clientes por tipo.
  - Atua como filtro/selector (`onTypeClick`).
- Locais atuais onde este padrão é aplicado:
  - Lista de clientes (`clientes.tsx`).
  - Modal de novo cliente.
  - Modal de novo chamado (`chamados.tsx`).

#### 1.7.5 Para Novos Modais e Confirmações

- Regra:
  - `Dialog` para formulários principais.
  - `AlertDialog` para confirmações (cancelar, excluir, sobrescrever).
- Sempre que uma ação for destrutiva ou perder dados:
  - Usar `AlertDialog` com texto claro.
  - Evitar fechamento automático no meio de promessas async (`e.preventDefault()`).

#### 1.7.6 Checklist Antes de Finalizar uma Feature

- [ ] Não há acessos diretos a `.name`, `.email`, etc., sem optional chaining.
- [ ] Modais não fecham no meio de cadastros em massa ou exclusões em massa.
- [ ] Fluxos de cadastro automático respeitam:
  - API BrasilAPI para CNPJ/CEP primeiro.
  - OCR/Text fallback depois.
- [ ] Logs cruciais aparecem no **frontend** (modais, toasts), não apenas no console.
- [ ] Documentação (esta seção) foi atualizada se algum novo padrão foi introduzido.

---

### 1.7 Segurança e Isolamento de Dados

**Tenant Isolation**:
Todos os endpoints da API verificam `req.user.claims.sub` (userId da sessão) e filtram dados por `userId`:

```typescript
// Exemplo: Listar clientes apenas do usuário logado
app.get('/api/clients', isAuthenticated, async (req: any, res) => {
  const userId = req.user.claims.sub; // ← Isolamento por tenant
  const clients = await storage.getClientsByUser(userId);
  res.json(clients);
});
```

**Prevenção de Vulnerabilidades**:

- ✅ Sem possibilidade de reassignment de `userId` em updates
- ✅ Validação de ownership antes de update/delete
- ✅ Rate limiting em endpoints públicos (100 req/15min)
- ✅ Google Calendar tokens protegidos (não expõe via API)
- ✅ Session-based authentication com cookies HTTP-only

**Endpoints Públicos** (sem autenticação):

- `GET /:publicSlug` - Lista serviços públicos
- `GET /api/public/:publicSlug/services` - Lista serviços ativos
- `POST /api/public/:publicSlug/book` - Criar agendamento público
- `GET /api/public/:publicSlug/slots` - Consultar horários disponíveis

---

### 1.6 Erros Comuns e Prevenção

#### 1.6.1 Erro: Ícone Inexistente no lucide-react

**Erro Encontrado**:

```
Uncaught SyntaxError: The requested module 'lucide-react' does not provide an export named 'FileXml'
```

**Causa**:

- Tentativa de importar ícone `FileXml` que não existe no pacote `lucide-react`
- O pacote `lucide-react` não possui todos os ícones com nomes específicos como `FileXml`

**Solução Aplicada**:

- Substituído `FileXml` por `FileCode` (ícone válido e apropriado para arquivos XML)
- Verificado disponibilidade do ícone antes de usar

**Regras para Prevenção**:

1. **Sempre verificar disponibilidade do ícone antes de usar**:

   - Consultar documentação oficial: https://lucide.dev/icons/
   - Usar busca na documentação para encontrar ícones similares
   - Testar importação antes de usar em produção

2. **Ícones alternativos comuns**:

   - `FileXml` → `FileCode` (para arquivos XML/código)
   - `FilePdf` → `FileText` ou `File` (para PDFs)
   - `FileExcel` → `FileSpreadsheet` ou `File` (para planilhas)
   - `FileWord` → `FileText` (para documentos Word)

3. **Processo de verificação**:

   ```typescript
   // ❌ ERRADO - Não verificar antes
   import { FileXml } from 'lucide-react';

   // ✅ CORRETO - Verificar na documentação primeiro
   import { FileCode } from 'lucide-react'; // Ícone válido para XML
   ```

4. **Checklist antes de adicionar novo ícone**:

   - [ ] Consultar https://lucide.dev/icons/ para verificar se o ícone existe
   - [ ] Testar importação no código
   - [ ] Verificar se o nome está correto (case-sensitive)
   - [ ] Se não existir, encontrar alternativa apropriada

5. **Ícones comuns disponíveis no lucide-react**:

   - `File`, `FileText`, `FileCode`, `FileImage`, `FileVideo`, `FileAudio`
   - `FileSpreadsheet`, `FileCheck`, `FileX`, `FileSearch`
   - `Upload`, `Download`, `Folder`, `FolderOpen`
   - `User`, `Users`, `UserPlus`, `UserCheck`
   - `Building`, `Building2`, `Home`, `MapPin`
   - `Mail`, `Phone`, `Calendar`, `Clock`
   - `Search`, `Filter`, `Settings`, `Edit`, `Trash2`
   - `Plus`, `Minus`, `X`, `Check`, `ArrowLeft`, `ArrowRight`
   - `Loader2`, `AlertCircle`, `Info`, `CheckCircle`

6. **Como verificar se um ícone existe**:

   ```bash
   # No terminal, dentro do projeto
   npm list lucide-react

   # Ou verificar diretamente na documentação
   # https://lucide.dev/icons/
   ```

7. **Padrão de nomenclatura do lucide-react**:
   - PascalCase para nomes de componentes
   - Sem sufixos específicos de formato (ex: não há `FileXml`, `FilePdf`)
   - Nomes genéricos e descritivos (ex: `FileCode` para código/XML)

**Exemplo de Implementação Segura**:

```typescript
// ✅ Implementação correta
import { FileCode } from 'lucide-react';

<Button>
  <FileCode className='h-4 w-4 mr-2' />
  Selecionar arquivo XML
</Button>;
```

**Referências**:

- Documentação oficial: https://lucide.dev/icons/
- Repositório: https://github.com/lucide-icons/lucide

---

### 1.7 Guia de Implementação para novas funcionalidades

Esta seção consolida as **melhores práticas** aprendidas ao longo do projeto, listando:

- Funcionalidades implementadas
- Erros reais que aconteceram
- Critérios para não repetir os mesmos problemas

#### 1.7.1 Responsividade e Layout

**Problemas que aconteceram**

- Componentes (cards e botões) ultrapassando a largura visível em mobile.
- Uso de `max-width` fixo (ex: `max-w-screen-sm`) em páginas internas (`clientes.tsx`) gerando cards com largura maior que a viewport.
- Botões com `w-full` e `flex-1` em containers estreitos, forçando overflow lateral.

**Padrão atual**

- O layout base (`App.tsx`) usa `div.flex.h-screen.w-full` com sidebar fixa e `<main>` rolando.
- Páginas internas devem usar:
  - `w-full max-w-full` (ou nenhum `max-w` rígido) quando a página deve ocupar 100% da largura disponível.
  - `px-3 sm:px-6` para espaçamento horizontal, sem adicionar margens negativas.
  - Em elementos que podem quebrar o layout, evitar `w-[...]` e `max-w-[...]` maiores que a tela em páginas internas.

**Checklist para novas telas**

- [ ] Testar em viewport ~390px (iPhone) e garantir **zero scroll horizontal**.
- [ ] Conferir se nenhum componente tem `w-[...]` ou `max-w-[...]` maior que `100%` dentro da página.
- [ ] Evitar `w-full` em botões quando não é desejado que ocupem a largura inteira; preferir largura automática ou `justify-between` no container.
- [ ] Quando for necessário limitar largura (ex: formulários grandes), usar containers externos responsivos (por exemplo, `max-w-3xl mx-auto`) e não em cada card isolado.

#### 1.7.2 Campos de texto, OCR e CNPJ

**Funcionalidades principais**

- OCR via `ImageUploadButton` e `MultipleImageUpload` com:
  - Extração de CNPJ/CPF, email, telefone, razão social, nome fantasia, endereço e inscrições.
  - Consulta CNPJ na BrasilAPI (`CnpjService.ts`) e CEP (`CepService.ts`).
  - Preenchimento automático do formulário de clientes e chamados.
- Upload múltiplo de imagens:
  - Cada imagem gera um cliente com enriquecimento de dados (OCR → BrasilAPI CNPJ → BrasilAPI CEP).
  - Barra de progresso e mensagens por cliente.
- Importação de XML:
  - Parser com aliases de campos (`e_mail`, `razao_social`, `rua_logradouro`, etc.).
  - Tratamento dos dados antes de enviar para o backend (`treatClientData`).
  - Modal dedicado de processamento em massa com barra de progresso e logs visíveis ao usuário.

**Erros comuns e correções**

- **CNPJ extraído incorretamente** (pegando CPF ou qualquer número de 14 dígitos):
  - Implementado `validateCNPJ` com verificação de dígitos verificadores e blacklist de sequências repetidas.
  - Priorizar padrões com label “CNPJ” e layout esperado em vez de regex global.
- **Email não extraído ou com `@` errado**:
  - Regex reforçada com validação de tamanho mínimo.
  - Função de correção de OCR (`tryRecoverInlineEmail`) tratando casos como `financeiro.sustento&gmail.com` (`&` → `@`) e `e` no lugar de `@`.
- **Nome fantasia entrando em razão social**:
  - Separação por função auxiliar que divide linha única em razão social + nome fantasia, evitando repetir literal “Nome fantasia” dentro do campo de razão social.
- **Campos obrigatórios demais na importação XML**:
  - Backend (Zod + schema shared) ajustado para aceitar email/telefone vazios.
  - `treatClientData` gera valores padrão (ex: nome PF a partir do email ou placeholder) e email placeholder quando necessário.

**Critérios para novas integrações OCR/API**

- Sempre aplicar fluxo em camadas:
  1. Dados confiáveis de API oficial (BrasilAPI CNPJ/CEP).
  2. Depois, preencher apenas campos **vazios** com OCR ou XML.
  3. Nunca sobrescrever manualmente campos já revisados pelo usuário.
- Toda nova fonte de dados (imagem, XML, texto colado) deve:
  - Ter **logs claros** de entrada/saída durante desenvolvimento.
  - Ter barra de progresso visível ao usuário quando for processamento em lote.
  - Tratar erros de rede/API com mensagens amigáveis e opção de preenchimento manual.

#### 1.7.3 Fluxos automáticos de cadastro de clientes

**Funcionalidades implementadas**

- Modos **Cadastro Automático** e **Cadastro Manual** com:
  - Botões grandes no topo do modal de clientes.
  - Alternância que mostra/esconde campos automáticos (CPF/CNPJ, texto, imagem, XML) ou todos os campos manuais.
- Detecção dinâmica de tipo de cliente:
  - CPF → PF.
  - CNPJ → abre modal para escolher `PJ Cliente Final` ou `EMPRESA_PARCEIRA`.
  - XML sem documento → inferência por nome (`detectCompanyType`).
- Contadores PF/PJ/EMPRESA_PARCEIRA em todos os lugares de clientes (lista, cadastro, edição) atuando como filtro.
- Exclusão em massa de clientes com:
  - Modal dedicado, chave de confirmação dinamicamente gerada.
  - Barra de progresso e mensagens por cliente excluído.

**Erros que já apareceram**

- Edição de cliente mostrando opções automáticas (imagem, texto, XML) → risco de sobrescrever cadastro existente.
  - Correção: em edição, somente campos manuais + tipo de cliente; blocos automáticos ficam desativados.
- Botões de contador duplicados ou muito grandes.
  - Correção: componente `ClientCounters` centralizado e reutilizado com tamanho reduzido, sem duplicação.
- Botão “Excluir todos” sem feedback visual.
  - Correção: modal de exclusão em massa com barra de progresso e mensagens.

**Regras para futuras alterações**

- Sempre distinguir claramente entre:
  - **Criação** (pode usar fluxos automáticos agressivos).
  - **Edição** (apenas preenchimento manual ou complementação pontual).
- Qualquer ação em massa (XML, múltiplas imagens, exclusão total):
  - Deve abrir modal dedicado.
  - Deve exibir progresso (0–100%) e nome/ID do item atual.
  - Não deve depender apenas de logs de console.

#### 1.7.4 Textos e linguagem da interface

**Casos corrigidos**

- “Servio” → “Serviço” / “Serviços” em:
  - Página de serviços (`servicos.tsx`): títulos, labels, botões e toasts.
  - Página de chamados (`chamados.tsx`): label e mensagem de validação.
  - `ticket-list.tsx`: textos de fallback e cabeçalhos.

**Critérios para não errar de novo**

- Antes de subir uma tela nova:
  - [ ] Revisar textos em PT-BR (acentos, concordância, termos técnicos).
  - [ ] Padronizar termos chave:
    - “Serviço”, “Cliente”, “Chamado”, “Empresa Parceira”.
  - [ ] Evitar abreviações sem legenda.
- Em revisões feitas por IA:
  - [ ] Rodar uma busca rápida (`grep "Servio" -n`) para pegar restos de textos quebrados por encoding/acentos.

#### 1.7.5 Padrão geral para novas features

1. **Planejamento**
   - Definir claramente: qual tela, quais estados (carregando, sucesso, erro, vazio) e qual impacto em banco / API.
2. **Implementação**
   - Centralizar lógica de negócio em serviços/utilitários (`CnpjService`, `CepService`, `OCRParser`, `storage.ts`).
   - Manter componentes visuais (`pages/*.tsx`, `components/*`) o mais “finos” possível.
3. **Tratamento de erros**
   - Sempre usar `try/catch` em chamadas externas e exibir `toast`/`AlertDialog` amigável.
   - Nunca deixar erros só no console se afetarem o usuário final.
4. **Logs de debug**
   - Em desenvolvimento, logs detalhados são bem-vindos (como `[DEBUG][Clientes][CardWidth]`).
   - Antes de produção, remover ou reduzir a logs essenciais.
5. **Checklist final**
   - [ ] Testar responsividade em 390px, 768px e >= 1024px.
   - [ ] Testar fluxo completo: criar cliente → criar chamado → excluir cliente.
   - [ ] Confirmar que Google Sheets recebe todos os campos esperados (para fluxos que escrevem na planilha).
   - [ ] Atualizar esta documentação com qualquer regra de negócio nova.

## 2. Integração com Google Calendar API

### 2.1 Arquitetura da Integração

A integração com Google Calendar utiliza **Google OAuth 2.0** diretamente, com tokens armazenados localmente em `data/token-store.json`.

**Componentes**:

- `server/googleCalendar.ts` - Módulo principal de integração
- `server/tokenStore.ts` - Armazenamento local de tokens OAuth
- `googleapis` - Cliente oficial do Google

---

### 2.2 Autenticação OAuth via Google OAuth 2.0

#### 2.2.1 Fluxo de Autenticação

```
1. Usuário clica em "Fazer Login" na UI
   ↓
2. Frontend redireciona para `/api/login`
   ↓
3. Backend redireciona para Google OAuth consent screen
   ↓
4. Usuário autoriza acesso ao Google (Calendar, Sheets, Drive)
   ↓
5. Google redireciona para `/api/callback` com código de autorização
   ↓
6. Backend troca código por tokens (access_token, refresh_token)
   ↓
7. Tokens são salvos localmente em `data/token-store.json`
   ↓
8. Tokens são usados para acessar Google Calendar API quando necessário
```

#### 2.2.2 Obtenção de Access Token

```typescript
async function getAuthClient(userId: string) {
  const record = getUserRecord(userId);
  if (!record?.tokens?.refresh_token) {
    throw new Error('Conta Google não está conectada. Faça login novamente.');
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5180/api/callback'
  );

  client.setCredentials({
    refresh_token: record.tokens.refresh_token,
    access_token: record.tokens.access_token,
    expiry_date: record.tokens.expiry_date,
  });

  // Refresh automático quando tokens expiram
  client.on('tokens', (tokens) => {
    if (!tokens) return;
    updateUserRecord(userId, {
      tokens: {
        ...record.tokens,
        access_token: tokens.access_token ?? record.tokens.access_token,
        refresh_token: tokens.refresh_token ?? record.tokens.refresh_token,
        expiry_date: tokens.expiry_date ?? record.tokens.expiry_date,
      },
    });
  });

  return client;
}
```

**Variáveis de Ambiente Necessárias**:

- `GOOGLE_CLIENT_ID` - Client ID do Google OAuth
- `GOOGLE_CLIENT_SECRET` - Client Secret do Google OAuth
- `GOOGLE_REDIRECT_URI` - URI de redirecionamento após autorização

#### 2.2.3 Criação do Cliente Google Calendar

```typescript
async function getCalendarClient(userId: string) {
  const auth = await getAuthClient(userId);
  return google.calendar({ version: 'v3', auth });
}
```

**Refresh de Tokens**:

- Gerenciado automaticamente pelo cliente OAuth2 do Google
- Sistema detecta quando tokens expiram e solicita refresh automaticamente
- Tokens atualizados são salvos automaticamente em `token-store.json`

---

### 2.3 Operações do Google Calendar

#### 2.3.1 Criar Evento no Calendário

```typescript
export async function createCalendarEvent(
  userId: string,
  ticket: Ticket,
  clientName: string,
  serviceName: string,
  timezone: string = 'America/Sao_Paulo'
): Promise<string | null> {
  try {
    const calendar = await getCalendarClient();

    // Calcular data/hora de início e fim
    const scheduledDate = new Date(ticket.scheduledDate);
    const endDate = new Date(
      scheduledDate.getTime() + ticket.duration * 60 * 60 * 1000
    );

    // Montar objeto de evento
    const event = {
      summary: `${serviceName} - ${clientName}`,
      description: ticket.description || `Service ticket for ${clientName}`,
      location:
        ticket.address && ticket.city && ticket.state
          ? `${ticket.address}, ${ticket.city}, ${ticket.state}`
          : undefined,
      start: {
        dateTime: scheduledDate.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: timezone,
      },
    };

    // Criar evento no calendário primário
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    return response.data.id || null; // Retorna ID do evento criado
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return null;
  }
}
```

**Campos do Evento**:

- `summary`: Nome do serviço + nome do cliente
- `description`: Descrição do ticket
- `location`: Endereço completo (se disponível)
- `start/end`: Data/hora com timezone específico
- `calendarId`: 'primary' (calendário principal do usuário)

**Retorno**:

- Sucesso: ID do evento no Google Calendar (string)
- Erro: null (erro é logado no console)

---

#### 2.3.2 Atualizar Evento Existente

```typescript
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  ticket: Ticket,
  clientName: string,
  serviceName: string,
  timezone: string = 'America/Sao_Paulo'
): Promise<boolean> {
  try {
    const calendar = await getCalendarClient();

    const scheduledDate = new Date(ticket.scheduledDate);
    const endDate = new Date(
      scheduledDate.getTime() + ticket.duration * 60 * 60 * 1000
    );

    const event = {
      summary: `${serviceName} - ${clientName}`,
      description: ticket.description || `Service ticket for ${clientName}`,
      location:
        ticket.address && ticket.city && ticket.state
          ? `${ticket.address}, ${ticket.city}, ${ticket.state}`
          : undefined,
      start: {
        dateTime: scheduledDate.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: timezone,
      },
    };

    await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: event,
    });

    return true;
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return false;
  }
}
```

**Casos de Uso**:

- Mudança de horário do agendamento
- Alteração de endereço
- Modificação de duração
- Atualização de descrição

---

#### 2.3.3 Deletar Evento

```typescript
export async function deleteCalendarEvent(
  userId: string,
  eventId: string
): Promise<boolean> {
  try {
    const calendar = await getCalendarClient();

    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });

    return true;
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return false;
  }
}
```

**Casos de Uso**:

- Cancelamento de agendamento
- Exclusão de ticket
- Reagendamento (delete + create novo)

---

#### 2.3.4 Verificar Status da Conexão

```typescript
export async function checkCalendarConnection(): Promise<{
  connected: boolean;
  email?: string;
}> {
  try {
    await getAccessToken(); // Valida se token existe e é válido
    const email = await getCalendarEmail(); // Busca email da conta conectada

    if (email) {
      return { connected: true, email };
    }

    return { connected: true };
  } catch (error) {
    console.error('Failed to verify Google Calendar connection:', error);
    return { connected: false };
  }
}
```

**Uso**:

- Verificação de status na página de Configurações
- Validação antes de criar eventos
- Atualização de `googleCalendarStatus` no banco

---

#### 2.3.5 Obter Email da Conta Conectada

```typescript
export async function getCalendarEmail(): Promise<string | null> {
  try {
    const accessToken = await getAccessToken();
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    // Usar OAuth2 API para obter informações do usuário
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    return data.email ?? null;
  } catch (error) {
    console.error('Error fetching Google Calendar email:', error);
    return null;
  }
}
```

**Uso**:

- Exibir email conectado na UI
- Validar se usuário correto está conectado
- Armazenar em `integration_settings.googleCalendarEmail`

---

#### 2.3.6 Listar Horários Ocupados (Busy Slots)

```typescript
export async function listCalendarBusySlots(
  userId: string,
  timeMin: Date,
  timeMax: Date
): Promise<Array<{ start: Date; end: Date }>> {
  try {
    const calendar = await getCalendarClient();

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: 'primary' }],
      },
    });

    const busySlots = response.data.calendars?.primary?.busy || [];
    return busySlots.map((slot) => ({
      start: new Date(slot.start!),
      end: new Date(slot.end!),
    }));
  } catch (error) {
    console.error('Error fetching calendar busy slots:', error);
    return [];
  }
}
```

**Uso**:

- Cálculo de horários disponíveis para agendamento público
- Prevenção de conflitos de agenda
- Exibição de disponibilidade no calendário

**Retorno**:

```typescript
[
  {
    start: new Date('2025-11-03T09:00:00Z'),
    end: new Date('2025-11-03T12:00:00Z'),
  },
  {
    start: new Date('2025-11-03T14:00:00Z'),
    end: new Date('2025-11-03T16:00:00Z'),
  },
];
```

---

### 2.4 Sincronização Bidirecional

#### 2.4.1 Ticket → Google Calendar

**Trigger**: Criação ou atualização de ticket

```typescript
// No endpoint POST /api/tickets
const ticket = await storage.createTicket(validatedData);

// Buscar configurações de integração
const settings = await storage.getIntegrationSettings(userId);

if (settings?.googleCalendarStatus === 'connected') {
  // Buscar dados relacionados
  const client = await storage.getClient(ticket.clientId);
  const service = await storage.getService(ticket.serviceId);

  // Criar evento no Google Calendar
  const eventId = await createCalendarEvent(
    userId,
    ticket,
    client!.name,
    service!.name,
    settings.timezone || 'America/Sao_Paulo'
  );

  if (eventId) {
    // Salvar ID do evento no ticket
    await storage.updateTicket(ticket.id, {
      googleCalendarEventId: eventId,
    });
  }
}
```

#### 2.4.2 Atualização de Ticket

```typescript
// No endpoint PATCH /api/tickets/:id
const updatedTicket = await storage.updateTicket(id, validatedData);

// Se ticket tem evento do Google Calendar associado
if (updatedTicket.googleCalendarEventId) {
  const client = await storage.getClient(updatedTicket.clientId);
  const service = await storage.getService(updatedTicket.serviceId);
  const settings = await storage.getIntegrationSettings(userId);

  // Atualizar evento existente
  await updateCalendarEvent(
    userId,
    updatedTicket.googleCalendarEventId,
    updatedTicket,
    client!.name,
    service!.name,
    settings?.timezone || 'America/Sao_Paulo'
  );
}
```

#### 2.4.3 Cancelamento de Ticket

```typescript
// No endpoint DELETE /api/tickets/:id
if (ticket.googleCalendarEventId) {
  // Deletar evento do Google Calendar
  await deleteCalendarEvent(userId, ticket.googleCalendarEventId);
}

// Deletar ticket do banco
await storage.deleteTicket(id);
```

---

### 2.5 Gerenciamento de Timezones

**Timezone Padrão**: `America/Sao_Paulo` (UTC-3)

**Configuração por Usuário**:

- Armazenado em `integration_settings.timezone`
- Usado em todas as operações do Google Calendar
- Pode ser alterado nas configurações

**Conversão de Datas**:

```typescript
// Backend sempre trabalha com ISO strings
const scheduledDate = new Date(ticket.scheduledDate); // UTC
const endDate = new Date(
  scheduledDate.getTime() + ticket.duration * 60 * 60 * 1000
);

// Google Calendar recebe timezone explícito
const event = {
  start: {
    dateTime: scheduledDate.toISOString(), // 2025-11-03T12:00:00.000Z
    timeZone: 'America/Sao_Paulo', // Interpretado como 09:00 BRT
  },
};
```

**⚠️ IMPORTANTE**:

- Sempre passar timezone explícito para Google Calendar
- Frontend deve enviar datas em ISO 8601
- Backend não deve assumir timezone local

---

### 2.6 Tratamento de Erros

**Cenários de Erro Comuns**:

1. **Token Expirado**:

```typescript
// Cliente OAuth2 do Google faz refresh automático
// Se falhar, retorna erro genérico
throw new Error('Google Calendar not connected');
```

2. **Evento Não Encontrado**:

```typescript
// Ao atualizar/deletar evento que não existe mais
// Operação falha silenciosamente, retorna false
return false;
```

3. **Quota Excedida**:

```typescript
// Google Calendar tem limites de API
// Erro é logado, operação retorna null/false
console.error('Error creating calendar event:', error);
return null;
```

4. **Conexão Não Configurada**:

```typescript
// Verificar status antes de operações
const settings = await storage.getIntegrationSettings(userId);
if (settings?.googleCalendarStatus !== 'connected') {
  // Não tentar criar evento
  return;
}
```

**Estratégia de Fallback**:

- Falha em criar evento → Ticket é criado mesmo assim
- Falha em atualizar evento → Ticket é atualizado, inconsistência aceitável
- Falha em deletar evento → Ticket é deletado, evento fica órfão no calendário

---

### 2.7 Rate Limits e Quotas

**Google Calendar API Limits**:

- 1.000.000 requisições/dia por projeto
- 500 requisições/100 segundos por usuário
- 10 requisições/segundo por usuário

**Mitigação no ChamadosPro**:

- Operações são síncronas (não em lote)
- Cache de tokens para reduzir requisições de autenticação
- Operações em background (lembretes) executam em intervalos de 5 minutos
- Busy slots são consultados apenas quando necessário (agendamento público)

**Monitoramento**:

- Erros são logados no console
- Status da conexão pode ser verificado via `/api/calendar/status`

---

## 3. Fluxos de Dados e Sincronização

### 3.1 Fluxo de Agendamento Completo

```
1. Cliente acessa link público: /{publicSlug}
   ↓
2. Sistema carrega serviços ativos do técnico
   ↓
3. Cliente seleciona serviço e horário
   ↓
4. Sistema verifica:
   - Conflitos de agenda (tickets existentes)
   - Lead time (tempo mínimo antes do agendamento)
   - Horários ocupados no Google Calendar
   - Buffer entre agendamentos
   ↓
5. POST /api/public/{publicSlug}/book
   - Validar dados
   - Criar ou reutilizar cliente
   - Criar ticket com status 'pending'
   - Criar registro financeiro (receivable)
   ↓
6. Sincronização Google Calendar:
   - Buscar integration_settings
   - Se conectado: createCalendarEvent()
   - Salvar googleCalendarEventId no ticket
   ↓
7. Agendar lembretes:
   - Criar registros para T-24h e T-1h
   - Background job enviará nos momentos corretos
   ↓
8. Retornar confirmação ao cliente
```

---

### 3.2 Fluxo de Atualização de Ticket

```
1. Técnico edita ticket na interface
   ↓
2. PATCH /api/tickets/:id
   - Validar ownership (userId)
   - Validar dados
   - Atualizar ticket no banco
   ↓
3. Se googleCalendarEventId existe:
   - updateCalendarEvent()
   - Manter mesmo eventId
   ↓
4. Se mudou status para 'completed':
   - Atualizar completedAt
   - Atualizar status financeiro se aplicável
   ↓
5. Se mudou status para 'cancelled':
   - Salvar cancellationReason
   - Deletar evento do Google Calendar
   - Marcar registro financeiro como cancelado
```

---

### 3.3 Fluxo de Envio de Lembretes

```
Background Job (a cada 5 minutos):
  ↓
1. Buscar tickets com status IN ('pending', 'in-progress')
   ↓
2. Filtrar tickets agendados para próximas 25 horas
   ↓
3. Para cada ticket:
   a) Verificar se lembrete T-24h já foi enviado
      - Se não: enviar e criar reminder_log

   b) Verificar se lembrete T-1h já foi enviado
      - Se não e falta <= 1.5h: enviar e criar reminder_log
   ↓
4. Gerar arquivo ICS com detalhes do agendamento
   ↓
5. Enviar via WhatsApp com anexo ICS
   (Atualmente: console.log - aguardando implementação real)
   ↓
6. Se noShow detectado (ticket passou e status != completed):
   - Marcar ticket.noShow = true
   - Incrementar client.noShowCount
```

---

### 3.4 Fluxo de Verificação de Slots Disponíveis

```
GET /api/public/{publicSlug}/slots?date=YYYY-MM-DD&serviceId=xxx
  ↓
1. Buscar usuário por publicSlug
   ↓
2. Buscar serviço e validar se está ativo
   ↓
3. Buscar integration_settings (lead time, buffer, travel)
   ↓
4. Calcular horários potenciais:
   - Início: 08:00
   - Fim: 18:00
   - Intervalo: 30 minutos
   ↓
5. Filtrar horários ocupados:
   a) Buscar tickets do dia (banco de dados)
   b) Buscar busy slots do Google Calendar
   c) Aplicar lead time mínimo
   d) Aplicar buffer entre agendamentos
   e) Aplicar tempo de deslocamento
   ↓
6. Retornar lista de horários disponíveis:
   [
     { time: "08:00", available: true },
     { time: "08:30", available: false },
     { time: "09:00", available: true },
     ...
   ]
```

---

### 3.5 Fluxo de Cálculo Financeiro

```
Criação de Ticket:
  ↓
1. Calcular totalAmount:
   - Preço base do serviço
   - + (extraHours Î valorHoraExtra)
   ↓
2. Criar financial_record:
   - type: 'receivable'
   - status: 'pending'
   - amount: totalAmount
   - dueDate: scheduledDate + 7 dias (padrão)
   ↓
3. Atualizar dashboard:
   - getCashFlowSummary()
   - getReceivables()
```

**Atualização de Status Financeiro**:

```
Sistema verifica diariamente:
  - Se dueDate < hoje && status = 'pending'
  - Atualizar status para 'overdue'
```

**Pagamento Recebido**:

```
PATCH /api/financial/:id
  - status: 'paid'
  - paidAt: timestamp atual
  ↓
Dashboard atualiza automaticamente:
  - totalPaid aumenta
  - totalPending diminui
  - totalOverdue diminui (se aplicável)
```

---

### 3.6 Diagrama de Dependências

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                    │
├─────────────────────────────────────────────────────────────┤
│  Pages:                                                     │
│  - Dashboard      - Clientes       - Serviços              │
│  - Chamados       - Agenda         - Financeiro            │
│  - Configurações  - Agendamento Público                    │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/JSON API
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express.js)                     │
├─────────────────────────────────────────────────────────────┤
│  Routes (server/routes.ts)                                 │
│  - /api/auth/*           - /api/clients/*                  │
│  - /api/services/*       - /api/tickets/*                  │
│  - /api/financial/*      - /api/integration-settings       │
│  - /api/public/*         - /api/calendar/*                 │
├─────────────────────────────────────────────────────────────┤
│  Business Logic                                            │
│  - bookingHelper.ts      - reminderScheduler.ts            │
│  - icsGenerator.ts       - googleCalendar.ts               │
└────────┬────────────────────────────────┬──────────────────┘
         │                                │
         │ Drizzle ORM                   │ OAuth/API
         ↓                                ↓
┌─────────────────────┐      ┌────────────────────────────┐
│   PostgreSQL        │      │   Google Calendar API      │
│   (Neon Serverless) │      │   via Google OAuth 2.0     │
└─────────────────────┘      └────────────────────────────┘
```

---

## Conclusão

Esta documentação cobre:

- ✅ Estrutura completa do banco de dados (8 tabelas)
- ✅ Relacionamentos e integridade referencial
- ✅ Sistema de migrations com Drizzle
- ✅ Validação de dados com Zod
- ✅ Segurança e isolamento multi-tenant
- ✅ Integração completa com Google Calendar API
- ✅ Autenticação OAuth via Google OAuth 2.0
- ✅ Operações CRUD do calendário
- ✅ Sincronização bidirecional
- ✅ Gerenciamento de timezones
- ✅ Fluxos de dados principais

Para questões técnicas adicionais ou detalhes de implementação específicos, consultar o código-fonte nos seguintes arquivos:

- `shared/schema.ts` - Definições de schema
- `server/storage.ts` - Camada de dados
- `server/googleCalendar.ts` - Integração Google
- `server/routes.ts` - Endpoints da API
- `server/bookingHelper.ts` - Lógica de agendamento
- `drizzle.config.ts` - Configuração do ORM
