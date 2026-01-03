# Estrutura Completa de Dados - ChamadosPro

## 📋 Visão Geral

Este documento descreve a **estrutura completa de dados** da aplicação ChamadosPro, incluindo:
- Todos os campos de cada entidade
- Como os dados são armazenados no Google Sheets
- Mapeamento entre formulários e banco de dados
- Preparação para migração futura para banco de dados relacional

**Última Verificação**: Janeiro 2025  
**Status**: ✅ Estrutura validada e compatível com Google Sheets

---

## 🗂️ Estrutura de Armazenamento no Google Sheets

### Formato Padrão de Todas as Abas

Todas as abas seguem o mesmo formato de 5 colunas:

| Coluna | Nome | Tipo | Descrição |
|--------|------|------|-----------|
| A | `id` | String (UUID) | ID único do registro |
| B | `userId` | String | ID do usuário proprietário |
| C | `data` | JSON String | **Todos os campos da entidade serializados em JSON** |
| D | `createdAt` | ISO String | Data de criação (ISO 8601) |
| E | `updatedAt` | ISO String | Data de última atualização (ISO 8601) |

**Importante**: A coluna C contém um objeto JSON completo com todos os campos da entidade (exceto `id`, `userId`, `createdAt`, `updatedAt` que estão nas outras colunas).

---

## 👥 Entidade: CLIENTES (Clients)

### Aba no Google Sheets
- **Nome da Aba**: `clients`
- **Definição**: `server/storage.ts:116`

### Schema Completo

**Arquivo**: `shared/schema.ts:31-67`

#### Campos Básicos (Todos os Tipos)

| Campo | Tipo no Schema | Tipo no JSON | Obrigatório | Descrição |
|-------|---------------|--------------|-------------|-----------|
| `id` | `varchar` | `string` | ✅ | UUID gerado automaticamente |
| `userId` | `varchar` | `string` | ✅ | ID do usuário proprietário |
| `type` | `text` | `string` | ✅ | "PF", "PJ" ou "EMPRESA_PARCEIRA" |
| `name` | `text` | `string` | ✅ | Nome (PF/PJ) ou Nome Fantasia (EMPRESA_PARCEIRA) |
| `document` | `text` | `string` | ❌ | CPF ou CNPJ |
| `email` | `text` | `string` | ✅ | Email de contato |
| `phone` | `text` | `string` | ✅ | Telefone de contato |
| `address` | `text` | `string` | ❌ | Endereço legado (mantido para compatibilidade) |
| `city` | `text` | `string` | ✅ | Cidade |
| `state` | `text` | `string` | ✅ | Estado (UF) |
| `createdAt` | `timestamp` | `string` (ISO) | ✅ | Data de criação |
| `updatedAt` | `timestamp` | `string` (ISO) | ✅ | Data de atualização |

#### Campos Específicos para EMPRESA_PARCEIRA

##### Informações Fiscais

| Campo | Tipo no Schema | Tipo no JSON | Obrigatório | Descrição |
|-------|---------------|--------------|-------------|-----------|
| `legalName` | `text` | `string` | ❌ | Razão Social |
| `municipalRegistration` | `text` | `string` | ❌ | Inscrição Municipal |
| `stateRegistration` | `text` | `string` | ❌ | Inscrição Estadual |

##### Endereço Completo

| Campo | Tipo no Schema | Tipo no JSON | Obrigatório | Descrição |
|-------|---------------|--------------|-------------|-----------|
| `zipCode` | `text` | `string` | ❌ | CEP (formato: 00000-000) |
| `streetAddress` | `text` | `string` | ❌ | Rua/Logradouro |
| `addressNumber` | `text` | `string` | ❌ | Número do endereço |
| `addressComplement` | `text` | `string` | ❌ | Complemento |
| `neighborhood` | `text` | `string` | ❌ | Bairro/Distrito |

##### Ciclo de Pagamento

| Campo | Tipo no Schema | Tipo no JSON | Obrigatório | Descrição |
|-------|---------------|--------------|-------------|-----------|
| `paymentCycleStartDay` | `integer` | `number` | ❌ | Início do ciclo (dia do mês, 1-31) |
| `paymentCycleEndDay` | `integer` | `number` | ❌ | Fim do ciclo (dia do mês, 1-31) |
| `paymentDueDay` | `integer` | `number` | ❌ | Dia de pagamento (mês seguinte, 1-31) |

##### Valores Padrão

| Campo | Tipo no Schema | Tipo no JSON | Obrigatório | Descrição |
|-------|---------------|--------------|-------------|-----------|
| `defaultTicketValue` | `decimal(10,2)` | `string` | ❌ | Valor padrão do chamado (R$) |
| `defaultHoursIncluded` | `integer` | `number` | ❌ | Quantas horas estão incluídas no valor padrão |
| `defaultKmRate` | `decimal(6,2)` | `string` | ❌ | Valor padrão do KM (R$/km) |
| `defaultAdditionalHourRate` | `decimal(10,2)` | `string` | ❌ | Valor por hora adicional (R$) |

##### Planilha Mensal

| Campo | Tipo no Schema | Tipo no JSON | Obrigatório | Descrição |
|-------|---------------|--------------|-------------|-----------|
| `monthlySpreadsheet` | `boolean` | `boolean` | ❌ | Gerar planilha mensal automaticamente |
| `spreadsheetEmail` | `text` | `string` | ❌ | Email que receberá a planilha |
| `spreadsheetDay` | `integer` | `number` | ❌ | Dia do mês para envio (1-31) |

##### Outros

| Campo | Tipo no Schema | Tipo no JSON | Obrigatório | Descrição |
|-------|---------------|--------------|-------------|-----------|
| `noShowCount` | `integer` | `number` | ❌ | Contador de no-shows (default: 0) |

### Exemplo de JSON na Coluna C (Google Sheets)

```json
{
  "type": "EMPRESA_PARCEIRA",
  "name": "Hit Telecom",
  "document": "07.812.519/0001-13",
  "email": "contato@hittelecom.com.br",
  "phone": "(11) 3132-0674",
  "city": "São Paulo",
  "state": "SP",
  "legalName": "Hit Ti Administracao De Servicos De Tecnologia Ltda",
  "zipCode": "01472-900",
  "streetAddress": "Avenida Brig Faria Lima",
  "addressNumber": "1478",
  "addressComplement": "Andar 5 Conj 510",
  "neighborhood": "Jardim Paulistano",
  "paymentCycleStartDay": 1,
  "paymentCycleEndDay": 30,
  "paymentDueDay": 5,
  "defaultTicketValue": "1500.00",
  "defaultHoursIncluded": 3,
  "defaultKmRate": "2.50",
  "defaultAdditionalHourRate": "200.00",
  "monthlySpreadsheet": true,
  "spreadsheetEmail": "contato@hittelecom.com.br",
  "spreadsheetDay": 1,
  "noShowCount": 0
}
```

### Validação no Formulário

**Arquivo**: `client/src/pages/clientes.tsx`

**Campos Permitidos para Update**: `server/routes.ts:400-425`

Todos os campos listados acima são aceitos e salvos automaticamente no Google Sheets.

---

## 🎫 Entidade: CHAMADOS (Tickets)

### Abas no Google Sheets
- **Aba Principal**: `tickets` (chamados em aberto/execução)
- **Aba Temporária**: `tickets_temp` (dados para finalização)
- **Aba Concluídos**: `tickets_completed` (chamados finalizados)

**Definição**: `server/storage.ts:118-120`

### Schema Completo

**Arquivo**: `shared/schema.ts:83-126`

#### Campos Básicos (Todos os Tipos)

| Campo | Tipo no Schema | Tipo no JSON | Obrigatório | Descrição |
|-------|---------------|--------------|-------------|-----------|
| `id` | `varchar` | `string` | ✅ | UUID gerado automaticamente |
| `userId` | `varchar` | `string` | ✅ | ID do usuário proprietário |
| `clientId` | `varchar` | `string` | ✅ | ID do cliente |
| `serviceId` | `varchar` | `string` | ⚠️ | ID do serviço (obrigatório para PF/PJ, opcional para EMPRESA_PARCEIRA) |
| `technicianId` | `varchar` | `string` | ❌ | ID do técnico responsável |
| `status` | `text` | `string` | ✅ | "ABERTO", "EXECUCAO", "CONCLUIDO", "cancelled", "no-show" |
| `scheduledDate` | `timestamp` | `string` (ISO) | ✅ | Data agendada |
| `scheduledTime` | `text` | `string` | ✅ | Hora agendada (formato: "HH:mm") |
| `duration` | `integer` | `number` | ✅ | Duração em horas |
| `description` | `text` | `string` | ❌ | Descrição/Observações do chamado |
| `createdAt` | `timestamp` | `string` (ISO) | ✅ | Data de criação |
| `updatedAt` | `timestamp` | `string` (ISO) | ✅ | Data de atualização |

#### Campos de Localização (Opcionais)

| Campo | Tipo no Schema | Tipo no JSON | Obrigatório | Descrição |
|-------|---------------|--------------|-------------|-----------|
| `address` | `text` | `string` | ❌ | Endereço do serviço |
| `city` | `text` | `string` | ❌ | Cidade |
| `state` | `text` | `string` | ❌ | Estado (UF) |

#### Campos Específicos para EMPRESA_PARCEIRA

| Campo | Tipo no Schema | Tipo no JSON | Obrigatório | Descrição |
|-------|---------------|--------------|-------------|-----------|
| `ticketNumber` | `varchar` | `string` | ✅ | Número do chamado (ex: "2025-0001") |
| `finalClient` | `text` | `string` | ✅ | Cliente final/contato da empresa |
| `ticketValue` | `decimal(10,2)` | `string` | ✅ | Valor do chamado (R$) |
| `chargeType` | `text` | `string` | ✅ | "DIARIA" ou "AVULSO" |
| `approvedBy` | `text` | `string` | ❌ | Quem aprovou o valor |
| `kmRate` | `decimal(6,2)` | `string` | ❌ | Valor do KM (R$/km) |
| `serviceAddress` | `text` | `string` | ✅ | Endereço do atendimento |

#### Campos de Agendamento (Opcionais)

| Campo | Tipo no Schema | Tipo no JSON | Obrigatório | Descrição |
|-------|---------------|--------------|-------------|-----------|
| `scheduledEndDate` | `timestamp` | `string` (ISO) | ❌ | Data fim prevista |
| `scheduledEndTime` | `text` | `string` | ❌ | Hora fim prevista (formato: "HH:mm") |
| `travelTimeMinutes` | `integer` | `number` | ❌ | Tempo de deslocamento (minutos, default: 30) |
| `bufferTimeMinutes` | `integer` | `number` | ❌ | Tempo de buffer (minutos, default: 15) |

#### Campos de Workflow (Preenchidos durante execução)

| Campo | Tipo no Schema | Tipo no JSON | Obrigatório | Descrição |
|-------|---------------|--------------|-------------|-----------|
| `startedAt` | `timestamp` | `string` (ISO) | ❌ | Quando check-in aconteceu (status: EXECUCAO) |
| `stoppedAt` | `timestamp` | `string` (ISO) | ❌ | Quando finalização aconteceu (status: CONCLUIDO) |
| `elapsedSeconds` | `integer` | `number` | ❌ | Duração calculada (segundos) |
| `kmTotal` | `decimal(8,2)` | `string` | ❌ | Total de quilômetros |
| `extraExpenses` | `decimal(10,2)` | `string` | ❌ | Despesas extras (R$) |
| `expenseDetails` | `text` | `string` | ❌ | Descrição das despesas extras |
| `completedAt` | `timestamp` | `string` (ISO) | ❌ | Data de conclusão |

#### Campos Financeiros e Outros

| Campo | Tipo no Schema | Tipo no JSON | Obrigatório | Descrição |
|-------|---------------|--------------|-------------|-----------|
| `extraHours` | `decimal(4,2)` | `string` | ❌ | Horas extras (default: "0") |
| `totalAmount` | `decimal(10,2)` | `string` | ❌ | Valor total calculado |
| `invoiceNumber` | `text` | `string` | ❌ | Número da Nota Fiscal |
| `cancellationReason` | `text` | `string` | ❌ | Motivo do cancelamento |
| `noShow` | `boolean` | `boolean` | ❌ | Cliente não compareceu (default: false) |

#### Campos de Integração

| Campo | Tipo no Schema | Tipo no JSON | Obrigatório | Descrição |
|-------|---------------|--------------|-------------|-----------|
| `googleCalendarEventId` | `text` | `string` | ❌ | ID do evento no Google Calendar |

### Exemplo de JSON na Coluna C (Google Sheets) - Chamado EMPRESA_PARCEIRA

```json
{
  "clientId": "uuid-do-cliente",
  "serviceId": null,
  "technicianId": "uuid-do-tecnico",
  "status": "ABERTO",
  "scheduledDate": "2025-01-15T00:00:00.000Z",
  "scheduledTime": "14:30",
  "duration": 3,
  "description": "Instalação de sistema de segurança",
  "ticketNumber": "2025-0001",
  "finalClient": "João Silva - Filial Centro",
  "ticketValue": "1500.00",
  "chargeType": "AVULSO",
  "approvedBy": "Maria Santos",
  "kmRate": "2.50",
  "serviceAddress": "Av. Praia de Belas, 800 - Cidade Baixa, Porto Alegre - RS",
  "travelTimeMinutes": 30,
  "bufferTimeMinutes": 15,
  "extraHours": "0",
  "address": null,
  "city": null,
  "state": null
}
```

### Validação no Formulário

**Arquivo**: `client/src/pages/chamados.tsx`

**Campos Obrigatórios por Tipo**:
- **PF/PJ**: `clientId`, `serviceId`, `scheduledDate`, `scheduledTime`, `duration`
- **EMPRESA_PARCEIRA**: `clientId`, `ticketNumber`, `finalClient`, `ticketValue`, `chargeType`, `serviceAddress`

**Validação**: `server/routes.ts:882-915`

---

## 🔍 Verificação de Compatibilidade

### ✅ Status: COMPATÍVEL

Todos os campos dos formulários são **compatíveis** com o Google Sheets:

1. ✅ **Todos os campos são salvos**: O método `writeEntity` salva todos os campos do objeto no JSON
2. ✅ **Nenhum campo é perdido**: Campos opcionais são incluídos mesmo se vazios
3. ✅ **Tipos são preservados**: Strings, números, booleanos e datas são serializados corretamente
4. ✅ **Estrutura é flexível**: Adicionar novos campos não requer alteração na estrutura do Google Sheets

### Processo de Salvamento

**Arquivo**: `server/storage.ts:485-588`

```typescript
// 1. Remove apenas metadados
delete payload.id;
delete payload.userId;
delete payload.createdAt;
delete payload.updatedAt;

// 2. Serializa TODOS os outros campos no JSON
const jsonString = JSON.stringify(payload);

// 3. Salva na coluna C
values: [[id, userId, jsonString, createdAt, updatedAt]]
```

**Resultado**: Todos os campos do formulário são automaticamente incluídos no JSON salvo.

---

## 📊 Mapeamento Formulário → Google Sheets

### Clientes

| Campo no Formulário | Campo no Schema | Campo no JSON | Status |
|---------------------|-----------------|---------------|--------|
| `name` | `name` | `name` | ✅ |
| `email` | `email` | `email` | ✅ |
| `phone` | `phone` | `phone` | ✅ |
| `document` | `document` | `document` | ✅ |
| `city` | `city` | `city` | ✅ |
| `state` | `state` | `state` | ✅ |
| `zipCode` | `zipCode` | `zipCode` | ✅ |
| `streetAddress` | `streetAddress` | `streetAddress` | ✅ |
| `addressNumber` | `addressNumber` | `addressNumber` | ✅ |
| `addressComplement` | `addressComplement` | `addressComplement` | ✅ |
| `neighborhood` | `neighborhood` | `neighborhood` | ✅ |
| `legalName` | `legalName` | `legalName` | ✅ |
| `municipalRegistration` | `municipalRegistration` | `municipalRegistration` | ✅ |
| `stateRegistration` | `stateRegistration` | `stateRegistration` | ✅ |
| `defaultTicketValue` | `defaultTicketValue` | `defaultTicketValue` | ✅ |
| `defaultHoursIncluded` | `defaultHoursIncluded` | `defaultHoursIncluded` | ✅ |
| `defaultKmRate` | `defaultKmRate` | `defaultKmRate` | ✅ |
| `defaultAdditionalHourRate` | `defaultAdditionalHourRate` | `defaultAdditionalHourRate` | ✅ |
| `monthlySpreadsheet` | `monthlySpreadsheet` | `monthlySpreadsheet` | ✅ |
| `spreadsheetEmail` | `spreadsheetEmail` | `spreadsheetEmail` | ✅ |
| `spreadsheetDay` | `spreadsheetDay` | `spreadsheetDay` | ✅ |

### Chamados

| Campo no Formulário | Campo no Schema | Campo no JSON | Status |
|---------------------|-----------------|---------------|--------|
| `clientId` | `clientId` | `clientId` | ✅ |
| `serviceId` | `serviceId` | `serviceId` | ✅ |
| `scheduledDate` | `scheduledDate` | `scheduledDate` | ✅ |
| `scheduledTime` | `scheduledTime` | `scheduledTime` | ✅ |
| `duration` | `duration` | `duration` | ✅ |
| `description` | `description` | `description` | ✅ |
| `ticketNumber` | `ticketNumber` | `ticketNumber` | ✅ |
| `finalClient` | `finalClient` | `finalClient` | ✅ |
| `ticketValue` | `ticketValue` | `ticketValue` | ✅ |
| `chargeType` | `chargeType` | `chargeType` | ✅ |
| `approvedBy` | `approvedBy` | `approvedBy` | ✅ |
| `kmRate` | `kmRate` | `kmRate` | ✅ |
| `serviceAddress` | `serviceAddress` | `serviceAddress` | ✅ |

---

## 🗄️ Preparação para Migração para Banco de Dados

### Estrutura de Tabelas Proposta

#### Tabela: `clients`

```sql
CREATE TABLE clients (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('PF', 'PJ', 'EMPRESA_PARCEIRA')),
  name TEXT NOT NULL,
  document TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  -- EMPRESA_PARCEIRA: Informações Fiscais
  legal_name TEXT,
  municipal_registration TEXT,
  state_registration TEXT,
  -- EMPRESA_PARCEIRA: Endereço Completo
  zip_code TEXT,
  street_address TEXT,
  address_number TEXT,
  address_complement TEXT,
  neighborhood TEXT,
  -- EMPRESA_PARCEIRA: Ciclo de Pagamento
  payment_cycle_start_day INTEGER,
  payment_cycle_end_day INTEGER,
  payment_due_day INTEGER,
  -- EMPRESA_PARCEIRA: Valores Padrão
  default_ticket_value DECIMAL(10,2),
  default_hours_included INTEGER,
  default_km_rate DECIMAL(6,2),
  default_additional_hour_rate DECIMAL(10,2),
  -- EMPRESA_PARCEIRA: Planilha Mensal
  monthly_spreadsheet BOOLEAN DEFAULT false,
  spreadsheet_email TEXT,
  spreadsheet_day INTEGER,
  no_show_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### Tabela: `tickets`

```sql
CREATE TABLE tickets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  technician_id VARCHAR REFERENCES users(id),
  client_id VARCHAR NOT NULL REFERENCES clients(id),
  service_id VARCHAR REFERENCES services(id),
  status TEXT NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'EXECUCAO', 'CONCLUIDO', 'cancelled', 'no-show')),
  scheduled_date TIMESTAMP NOT NULL,
  scheduled_time TEXT NOT NULL,
  duration INTEGER NOT NULL,
  -- Localização
  address TEXT,
  city TEXT,
  state TEXT,
  -- EMPRESA_PARCEIRA
  ticket_number VARCHAR,
  invoice_number TEXT,
  final_client TEXT,
  ticket_value DECIMAL(10,2),
  charge_type TEXT CHECK (charge_type IN ('DIARIA', 'AVULSO')),
  approved_by TEXT,
  km_rate DECIMAL(6,2),
  service_address TEXT,
  scheduled_end_date TIMESTAMP,
  scheduled_end_time TEXT,
  -- Agendamento
  travel_time_minutes INTEGER DEFAULT 30,
  buffer_time_minutes INTEGER DEFAULT 15,
  description TEXT,
  extra_hours DECIMAL(4,2) DEFAULT 0,
  total_amount DECIMAL(10,2),
  google_calendar_event_id TEXT,
  cancellation_reason TEXT,
  no_show BOOLEAN DEFAULT false,
  -- Workflow
  started_at TIMESTAMP,
  stopped_at TIMESTAMP,
  elapsed_seconds INTEGER,
  km_total DECIMAL(8,2),
  extra_expenses DECIMAL(10,2),
  expense_details TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Mapeamento Google Sheets → Banco de Dados

#### Processo de Migração

1. **Ler JSON da coluna C** de cada linha
2. **Parse do JSON** para objeto JavaScript
3. **Inserir na tabela** usando os campos mapeados
4. **Preservar metadados**: `id`, `userId`, `createdAt`, `updatedAt` das colunas A, B, D, E

#### Exemplo de Script de Migração

```typescript
// Pseudocódigo para migração
async function migrateClientsFromSheets() {
  const clients = await readEntitiesFromSheet('clients');
  
  for (const client of clients) {
    // client já contém todos os campos do JSON parseado
    await db.insert(clientsTable).values({
      id: client.id,
      userId: client.userId,
      type: client.type,
      name: client.name,
      // ... todos os outros campos
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    });
  }
}
```

---

## ✅ Checklist de Verificação

### Para Novos Campos

Ao adicionar um novo campo a qualquer formulário:

- [ ] **Campo adicionado ao schema** (`shared/schema.ts`)
- [ ] **Campo adicionado ao estado do formulário** (`formData`)
- [ ] **Campo incluído no payload** ao salvar
- [ ] **Campo aceito na rota API** (`server/routes.ts`)
- [ ] **Campo é salvo no Google Sheets** (automático via `writeEntity`)
- [ ] **Campo documentado** neste arquivo

### Para Novas Entidades

Ao criar uma nova entidade:

- [ ] **Aba criada no Google Sheets** (`DEFAULT_SHEETS`)
- [ ] **Schema definido** (`shared/schema.ts`)
- [ ] **Métodos implementados** (`server/storage.ts`)
- [ ] **Rotas API criadas** (`server/routes.ts`)
- [ ] **Documentação atualizada** (este arquivo)

---

## 📚 Referências

- **Schema Completo**: `shared/schema.ts`
- **Storage Implementation**: `server/storage.ts`
- **API Routes**: `server/routes.ts`
- **Formulário Clientes**: `client/src/pages/clientes.tsx`
- **Formulário Chamados**: `client/src/pages/chamados.tsx`
- **Documentação Google Sheets**: `GOOGLE_SHEETS_INTEGRATION.md`

---

## 🔍 Verificação de Integridade dos Dados

### Processo de Verificação Realizado

**Data**: Janeiro 2025

#### 1. Verificação de Clientes

✅ **Todos os campos do formulário estão no schema**
- Campos básicos: ✅
- Campos EMPRESA_PARCEIRA: ✅
- Campos de endereço: ✅
- Campos de valores padrão: ✅

✅ **Todos os campos são aceitos na rota API**
- Lista de campos permitidos: `server/routes.ts:400-425`
- Todos os 25 campos estão incluídos

✅ **Todos os campos são salvos no Google Sheets**
- Método `writeEntity` salva todos os campos automaticamente
- Nenhum campo é filtrado ou removido

#### 2. Verificação de Chamados

✅ **Todos os campos do formulário estão no schema**
- Campos básicos: ✅
- Campos EMPRESA_PARCEIRA: ✅
- Campos de workflow: ✅

✅ **Todos os campos são incluídos no payload**
- Verificado: `client/src/pages/chamados.tsx:953-978`
- Campo `serviceAddress` está incluído: ✅ (linha 970)

✅ **Todos os campos são salvos no Google Sheets**
- Método `createTicket` salva todos os campos
- Campos de workflow são preservados

### Correções Aplicadas

Durante a verificação, foi identificada e corrigida uma duplicação:

**Problema**: Campo `serviceAddress` estava sendo definido duas vezes no payload.

**Correção**: Removida duplicação, mantendo apenas uma definição que sempre inclui o campo.

**Código**: `client/src/pages/chamados.tsx:970`

### Status Final

✅ **COMPATÍVEL**: Todos os campos dos formulários são salvos corretamente no Google Sheets.

✅ **COMPLETO**: Nenhum campo está faltando ou sendo perdido.

✅ **PRONTO PARA MIGRAÇÃO**: Estrutura documentada e pronta para migração futura para banco de dados relacional.

---

## 📝 Notas para Migração Futura

### Considerações Importantes

1. **Campos Decimais**: No Google Sheets são salvos como strings (ex: "1500.00"). Na migração, converter para `DECIMAL`.

2. **Campos de Data**: No Google Sheets são salvos como ISO strings. Na migração, converter para `TIMESTAMP`.

3. **Campos Booleanos**: No Google Sheets são salvos como `true`/`false`. Na migração, usar `BOOLEAN`.

4. **Campos Opcionais**: Campos `null` ou `undefined` devem ser tratados como `NULL` no banco.

5. **Validação de Tipos**: Implementar validação rigorosa durante migração para garantir integridade.

### Script de Migração Sugerido

```typescript
// Exemplo de função de migração
async function migrateEntity<T>(
  sheetName: SheetName,
  tableName: string,
  transform?: (entity: any) => any
) {
  const entities = await readEntitiesFromSheet<T>(sheetName);
  
  for (const entity of entities) {
    let data = entity;
    
    // Aplicar transformações se necessário
    if (transform) {
      data = transform(entity);
    }
    
    // Converter tipos
    const converted = {
      ...data,
      // Converter decimais
      defaultTicketValue: data.defaultTicketValue 
        ? parseFloat(data.defaultTicketValue) 
        : null,
      // Converter datas
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      // ... outras conversões
    };
    
    await db.insert(tableName).values(converted);
  }
}
```

---

**Última Atualização**: Janeiro 2025  
**Versão**: 1.0  
**Status**: ✅ Estrutura validada e compatível  
**Verificação**: ✅ Todos os campos verificados e funcionando

