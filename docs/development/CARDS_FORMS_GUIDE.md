# 📚 Manual Completo: Criação de Cards, Formulários e Dashboards

Este manual consolida o conhecimento necessário para criar e manter funcionalidades no **ChamadosPro**, garantindo que a integração entre Banco de Dados, Backend e Frontend funcione perfeitamente.

---

## 🎯 Índice
1.  [Fluxo Geral de Desenvolvimento](#fluxo-geral-de-desenvolvimento)
2.  [Criação de Cards no Dashboard](#criação-de-cards-no-dashboard)
3.  [Criação de Formulários](#criação-de-formulários)
4.  [Convenções de Nomenclatura (camelCase vs snake_case)](#convenções-de-nomenclatura)
5.  [Fluxo de Diagnóstico e Correção de Erros](#fluxo-de-diagnóstico-e-correção-de-erros)
6.  [Exemplos Práticos (Receita por Hora e Lucro com KM)](#exemplos-práticos)

---

## 🔄 Fluxo Geral de Desenvolvimento

Sempre siga esta ordem para evitar o erro de "conserta um, estraga outro":

1.  **BANCO DE DADOS (Schema)**: Garanta que as colunas existem e os tipos estão corretos.
2.  **BACKEND (API)**: Crie os endpoints e mapeie os campos corretamente no `storage-supabase.ts`.
3.  **FRONTEND (Interface)**: Crie os componentes, formulários e consuma os dados via `useQuery`.
4.  **TESTES**: Valide com dados reais no banco, não apenas mocks.

---

## 📊 Criação de Cards no Dashboard

### 1. Script SQL de Verificação
Antes de codificar, verifique se os dados existem:
```sql
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'tickets' AND column_name IN ('km_total', 'km_rate');
```

### 2. Lógica de Cálculo (Backend)
No arquivo `server/routes.ts`, implemente a lógica de agregação.
**Dica**: Use o `normalizeStatus` e `getCompletionDate` para garantir que está filtrando corretamente tickets do mês atual e concluídos.

### 3. Exibição (Frontend)
No `client/src/pages/dashboard.tsx`, use o `useQuery` para buscar os dados e o componente `<MetricCard />` para exibir.

---

## 📝 Criação de Formulários

### 1. Autopreenchimento
O sistema deve preencher campos conhecidos (como nome e email do usuário logado) automaticamente.
- No Backend: Garanta que o campo está no `SELECT_FIELDS`.
- No Frontend: Use `useEffect` com o objeto `user` do `useAuth`.

### 2. Mapeamento de Campos
O formulário envia dados em `camelCase`, mas o banco espera `snake_case`.
**Garantia de Integridade**: No `storage-supabase.ts`, mapeie explicitamente:
```typescript
.insert({
  first_name: data.firstName, // ✅ Seguro
  zip_code: data.zipCode      // ✅ Seguro
})
```

---

## 🔗 Convenções de Nomenclatura

| Camada | Formato | Exemplo |
| :--- | :--- | :--- |
| **Banco de Dados** | `snake_case` | `due_date`, `ticket_number` |
| **Backend/Frontend** | `camelCase` | `dueDate`, `ticketNumber` |

**Fallback Crucial no Frontend**:
```typescript
// ✅ Sempre use fallback para evitar campos vazios na transição de dados
const data = (obj as any).dueDate || (obj as any).due_date || '';
```

---

## 🔍 Fluxo de Diagnóstico e Correção de Erros

Se um dado não aparece na tela:
1.  **Network Tab (F12)**: Verifique se a API está retornando o campo.
2.  **SELECT_FIELDS**: Veja se o campo foi esquecido na query do Supabase.
3.  **Mapeamento**: Veja se o nome do campo no JSON (camelCase) coincide com o que o Frontend espera.
4.  **Filtro de Data**: Verifique se o registro não está em um mês diferente do filtrado.

---

## 📖 Exemplos Práticos

### Exemplo 1: Card "R$ Por Hora (Mês)"
**Lógica**: `Receita Total (Pagos) / Horas Totais (Concluídos)`.
- **Filtro**: Apenas tickets vinculados a registros financeiros com status `paid`.
- **Cálculo de Horas**: Prioriza `stoppedAt - startedAt`, com fallback para `duration`.

### Exemplo 2: Card "Lucro com KM"
**Lógica**: `(KM Total * Taxa KM) - Gasto Combustível`.
- **Garantia**: O `km_rate` deve ser salvo no momento da conclusão do ticket.
- **Configuração**: Usa os dados de consumo de `vehicle_settings`.

---

**Última atualização:** Dezembro 2025

