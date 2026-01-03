'# Integração com Google Sheets - Documentação

## 📋 Visão Geral

A aplicação **ChamadosPro** utiliza o **Google Sheets** como sistema de persistência de dados. Todos os dados são armazenados em planilhas do Google Sheets, organizadas por usuário.

## 🗂️ Estrutura de Armazenamento

### Localização dos Arquivos

- **Arquivo Principal**: `server/storage.ts`
- **Classe Principal**: `GoogleSheetsStorage` (implementa `IStorage`)
- **Autenticação**: `server/googleAuth.ts`
- **Rotas API**: `server/routes.ts`

### Estrutura de Pastas no Google Drive

Cada usuário possui:
- **Pasta**: `"Chamados Pro Lite"` (criada automaticamente)
- **Planilha**: `"ChamadosPro - {email}"` (criada automaticamente na primeira execução)
- **Localização**: `data/token-store.json` (armazena `spreadsheetId` e `folderId` por usuário)

### Estrutura da Planilha

Cada planilha contém **10 abas (sheets)** pré-configuradas:

| Nome da Aba | Descrição | Tipo de Dados |
|------------|-----------|---------------|
| `users` | Usuários/Técnicos | `User` |
| `clients` | Clientes (PF, PJ, EMPRESA_PARCEIRA) | `Client` |
| `services` | Serviços/Catálogo | `Service` |
| `tickets` | Chamados em aberto/execução | `Ticket` |
| `tickets_temp` | Chamados temporários | `Ticket` |
| `tickets_completed` | Chamados concluídos | `Ticket` |
| `financialRecords` | Registros financeiros | `FinancialRecord` |
| `integrationSettings` | Configurações de integração | `IntegrationSettings` |
| `reminderLogs` | Logs de lembretes enviados | `ReminderLog` |
| `localEvents` | Eventos locais da agenda | `LocalEvent` |

**Definição**: `server/storage.ts:114-124` e `server/storage.ts:126-137`

## 📊 Formato de Armazenamento

### Estrutura das Colunas

Cada aba possui **5 colunas fixas**:

| Coluna | Nome | Descrição |
|--------|------|-----------|
| A | `id` | ID único do registro (UUID) |
| B | `userId` | ID do usuário proprietário |
| C | `data` | **JSON serializado** com todos os campos do objeto |
| D | `createdAt` | Data de criação (ISO string) |
| E | `updatedAt` | Data de atualização (ISO string) |

**Definição**: `server/storage.ts:206`

### Exemplo de Linha

```
A1: "550e8400-e29b-41d4-a716-446655440000"
B1: "user123"
C1: '{"name":"João Silva","email":"joao@example.com","phone":"(11) 99999-9999",...}'
D1: "2024-01-15T10:30:00.000Z"
E1: "2024-01-15T10:30:00.000Z"
```

**Importante**: Os dados são armazenados como **JSON serializado** na coluna C. Isso significa que:
- ✅ Não há colunas individuais para cada campo
- ✅ Adicionar novos campos não requer alteração na estrutura da planilha
- ✅ O campo interno no código (ex: `streetAddress`) é o que importa, não o nome da coluna

### Processo de Escrita

1. **Cache Check**: Verifica se os dados estão em cache (30s TTL)
2. **Busca Existente**: Se não estiver em cache, busca do Google Sheets
3. **Prepara Payload**: Remove metadados (`id`, `userId`, `createdAt`, `updatedAt`)
4. **Serializa JSON**: Converte o objeto para JSON string
5. **Atualiza/Insere**: 
   - Se existe: `spreadsheets.values.update` (linha específica)
   - Se novo: `spreadsheets.values.append` (nova linha)
6. **Atualiza Cache**: Invalida e atualiza cache local

**Código**: `server/storage.ts:485-588`

### Processo de Leitura

1. **Cache Check**: Verifica cache primeiro (30s TTL)
2. **Busca do Sheets**: Se não estiver em cache, lê todas as linhas da aba
3. **Parse JSON**: Deserializa cada linha da coluna C
4. **Reconstrói Objetos**: Adiciona `id`, `userId`, `createdAt`, `updatedAt`
5. **Atualiza Cache**: Armazena no cache por 30 segundos

**Código**: `server/storage.ts:410-455`

## 🔄 Sistema de Cache

### Implementação

- **Classe**: `MemoryCache` (`server/storage.ts:139-203`)
- **TTL Padrão**: 30 segundos
- **Limpeza Automática**: A cada 60 segundos remove entradas expiradas

### Chaves de Cache

Formato: `{operation}:{userId}:{sheetName}`

Exemplos:
- `readEntities:user123:clients`
- `readEntities:user123:tickets`

### Invalidação

O cache é invalidado quando:
- Um registro é **criado** (`writeEntity`)
- Um registro é **atualizado** (`writeEntity`)
- Um registro é **deletado** (`deleteEntity`)

**Método**: `cache.invalidatePrefix()` - invalida todas as chaves com o prefixo

## 🔑 Mapeamento de Campos

### Clientes (Clients)

**Schema**: `shared/schema.ts:31-67`

**Campos Principais**:
- `id`, `userId`, `type`, `name`, `document`, `email`, `phone`
- `address` (legado, mantido para compatibilidade)
- `city`, `state`
- `legalName`, `municipalRegistration`, `stateRegistration`
- **Endereço Completo**:
  - `zipCode` → `zip_code` (no banco)
  - `streetAddress` → `street_address` (no banco) ⚠️ **Campo de rua**
  - `addressNumber` → `address_number`
  - `addressComplement` → `address_complement`
  - `neighborhood` → `neighborhood`

**Rotas API**: `server/routes.ts:173-468`

**Campos Permitidos para Update**: `server/routes.ts:400-425`

### Tickets

**Schema**: `shared/schema.ts:83-126`

**Campos Importantes**:
- `status`: "ABERTO", "EXECUCAO", "CONCLUIDO", "cancelled", "no-show"
- `address`, `city`, `state` (localização do serviço)
- `startedAt`, `stoppedAt`, `elapsedSeconds` (workflow)
- `kmTotal`, `extraExpenses` (custos adicionais)

## 🔍 Onde Procurar para Fazer Mudanças

### 1. Adicionar Novo Campo a Clientes

**Passos**:

1. **Schema** (`shared/schema.ts:31-67`):
   ```typescript
   streetAddress: text("street_address"), // Novo campo
   ```

2. **Tipo TypeScript** (`shared/schema.ts:193-301`):
   - O `insertClientSchema` é gerado automaticamente do schema
   - Não precisa adicionar manualmente

3. **Rotas API** (`server/routes.ts:400-425`):
   - Adicionar o nome do campo em `allowedFields`:
   ```typescript
   const allowedFields = [
     // ... outros campos
     'streetAddress', // Novo campo
   ];
   ```

4. **Frontend** (`client/src/pages/clientes.tsx`):
   - Adicionar ao estado `formData`
   - Adicionar campo no formulário
   - Atualizar função `parseClientText` se necessário

**⚠️ IMPORTANTE**: O Google Sheets **não precisa ser alterado** porque os dados são JSON serializado. O campo será automaticamente incluído no JSON quando salvo.

### 2. Adicionar Nova Aba (Sheet)

**Passos**:

1. **Definir Nome** (`server/storage.ts:114-124`):
   ```typescript
   type SheetName =
     | "users"
     | "clients"
     // ...
     | "novaAba"; // Adicionar aqui
   ```

2. **Adicionar à Lista Padrão** (`server/storage.ts:126-137`):
   ```typescript
   const DEFAULT_SHEETS: SheetName[] = [
     "users",
     "clients",
     // ...
     "novaAba", // Adicionar aqui
   ];
   ```

3. **Implementar Métodos** (`server/storage.ts:205-1411`):
   - Adicionar métodos na interface `IStorage`
   - Implementar na classe `GoogleSheetsStorage`

### 3. Modificar Formato de Armazenamento

**⚠️ ATENÇÃO**: Mudanças na estrutura de colunas afetam **todos os dados existentes**.

**Arquivo**: `server/storage.ts:206`

**Métodos Afetados**:
- `bootstrapHeaders()` - Cria cabeçalhos
- `readEntitiesWithoutCache()` - Lê dados
- `writeEntity()` - Escreve dados

### 4. Ajustar Cache

**Arquivo**: `server/storage.ts:139-203`

**Configurações**:
- TTL padrão: `30 * 1000` (30 segundos)
- Limpeza: `setInterval(() => cache.cleanup(), 60 * 1000)`

**Métodos de Cache**:
- `get<T>(key)`: Busca do cache
- `set<T>(key, data, ttlMs?)`: Armazena no cache
- `invalidatePrefix(prefix)`: Invalida por prefixo
- `cleanup()`: Remove entradas expiradas

## 🔐 Autenticação Google

### Fluxo de Autenticação

1. **Login**: `/api/login` → Redireciona para Google OAuth
2. **Callback**: `/api/callback` → Recebe tokens
3. **Armazenamento**: Tokens salvos em `data/token-store.json`
4. **Uso**: Tokens usados para autenticar requisições ao Google Sheets API

**Arquivo**: `server/googleAuth.ts`

### Escopos Necessários

- `https://www.googleapis.com/auth/spreadsheets` - Leitura/escrita em planilhas
- `https://www.googleapis.com/auth/drive.file` - Acesso a arquivos do Drive

**Definição**: `server/googleAuth.ts:122-130`

## 📝 Exemplo Prático: Campo "Rua"

### Situação

O campo de rua foi renomeado na interface de "Endereço" para "Rua" para facilitar a coleta automática.

### O que Foi Alterado

1. **Frontend** (`client/src/pages/clientes.tsx`):
   - Label: "Endereço" → "Rua"
   - ID do input: `streetAddress` → `rua`
   - Name do input: adicionado `name="rua"`
   - Data-testid: `input-street-address` → `input-rua`

2. **Função de Parse** (`client/src/pages/clientes.tsx:424-480`):
   - Prioriza detecção de "rua" sobre "endereço"
   - Melhorada detecção de "Rua / Logradouro"

### O que NÃO Precisa Ser Alterado

- ✅ **Schema** (`shared/schema.ts`): Campo continua `streetAddress`
- ✅ **Banco de Dados**: Campo continua `street_address`
- ✅ **Google Sheets**: Campo continua `streetAddress` no JSON
- ✅ **API Routes**: Campo continua `streetAddress` no objeto

**Razão**: O Google Sheets armazena JSON serializado. O nome do campo no objeto JavaScript (`streetAddress`) é o que importa, não o ID/name do input HTML.

## 🐛 Troubleshooting

### Problema: Dados não aparecem após salvar

**Solução**:
1. Verificar cache: Aguardar 30 segundos ou limpar cache
2. Verificar autenticação: Tokens válidos em `data/token-store.json`
3. Verificar permissões: Usuário tem acesso à planilha no Google Drive

### Problema: Erro "Conta Google não está conectada"

**Solução**:
1. Verificar `data/token-store.json` existe
2. Verificar tokens não expiraram
3. Fazer login novamente em `/api/login`

### Problema: Planilha não é criada automaticamente

**Solução**:
1. Verificar permissões do Google OAuth
2. Verificar escopos corretos (`spreadsheets`, `drive.file`)
3. Verificar logs do servidor para erros específicos

## 📚 Referências Rápidas

### Arquivos Principais

- `server/storage.ts` - Implementação do Google Sheets Storage
- `server/routes.ts` - Rotas API que usam storage
- `shared/schema.ts` - Schemas e tipos TypeScript
- `server/googleAuth.ts` - Autenticação Google OAuth
- `data/token-store.json` - Tokens e IDs de planilhas (não versionado)

### Métodos Importantes

- `ensureSpreadsheet(userId)` - Garante que planilha existe
- `readEntities<T>(userId, sheet)` - Lê todos os registros
- `writeEntity<T>(sheet, entity)` - Salva/atualiza registro
- `deleteEntity(userId, sheet, id)` - Remove registro

### Constantes Importantes

- `DEFAULT_SHEETS` - Lista de abas padrão
- `headerRow` - Cabeçalhos das colunas (`["id", "userId", "data", "createdAt", "updatedAt"]`)
- Cache TTL: `30 * 1000` (30 segundos)

---

**Última Atualização**: Janeiro 2025
**Versão**: 1.0
































