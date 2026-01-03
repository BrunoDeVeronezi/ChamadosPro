# Setup do Supabase - ChamadosPro

Este guia explica como configurar o banco de dados Supabase para o ChamadosPro usando Drizzle ORM.

## 📋 Pré-requisitos

1. Conta no Supabase criada
2. Projeto Supabase criado
3. Credenciais de conexão do Supabase

## 🔑 Credenciais do Supabase

Você forneceu as seguintes credenciais:

```
PostgreSQL Connection String:
postgresql://postgres:7440Strinbarg!@db.oyrfnydwjpafubxvrucu.supabase.co:5432/postgres

Anon Key (public):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95cmZueWR3anBhZnVieHZydWN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzM4MjksImV4cCI6MjA4MDEwOTgyOX0.a3sKBdlJUshdSAmBAuBOOgLZeKq3fsuhuIxdYoXPyZE

Service Role Key (secret):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95cmZueWR3anBhZnVieHZydWN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMzgyOSwiZXhwIjoyMDgwMTA5ODI5fQ.EzLht3w4JoPS-RTGTEH2YgIWWqHKViMbR9FU1i13Zr4
```

## 🚀 Configuração

### 1. Configurar Variável de Ambiente

Crie ou edite o arquivo `.env` na raiz do projeto:

```bash
DATABASE_URL="postgresql://postgres:7440Strinbarg!@db.oyrfnydwjpafubxvrucu.supabase.co:5432/postgres"
```

**⚠️ IMPORTANTE**: Adicione `?sslmode=require` se necessário:

```bash
DATABASE_URL="postgresql://postgres:7440Strinbarg!@db.oyrfnydwjpafubxvrucu.supabase.co:5432/postgres?sslmode=require"
```

### 2. Executar Setup Automático

Execute o script de setup que irá:

- Criar todas as tabelas usando Drizzle ORM
- Desativar RLS (Row Level Security) de todas as tabelas

```bash
npm run setup:supabase
```

### 3. Verificar Setup

O script irá exibir:

- ✅ Status da conexão
- ✅ Tabelas criadas
- ✅ Status do RLS (deve estar desativado em todas)

## 📊 Tabelas Criadas

O schema cria as seguintes tabelas:

1. **sessions** - Armazena sessões de autenticação
2. **users** - Usuários/técnicos do sistema
3. **clients** - Clientes (PF, PJ, EMPRESA_PARCEIRA)
4. **services** - Catálogo de serviços
5. **tickets** - Chamados/agendamentos
6. **financial_records** - Registros financeiros
7. **integration_settings** - Configurações de integração
8. **reminder_logs** - Logs de lembretes enviados
9. **local_events** - Eventos locais da agenda

## 🔓 Row Level Security (RLS)

**IMPORTANTE**: O RLS está desativado em todas as tabelas porque o isolamento de dados (Tenant Isolation) é feito na camada de aplicação (Node.js).

Todos os endpoints da API verificam `req.user.claims.sub` (userId da sessão) e filtram dados por `userId`. Portanto, não é necessário usar RLS do Supabase.

### Desativar RLS Manualmente (Alternativa)

Se preferir desativar manualmente, execute o script SQL no Supabase SQL Editor:

```sql
-- Desativar RLS em todas as tabelas
ALTER TABLE IF EXISTS sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS financial_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS integration_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reminder_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS local_events DISABLE ROW LEVEL SECURITY;
```

Ou use o arquivo `scripts/disable-rls.sql` que contém o script completo.

## 🔍 Verificar Status do RLS

Para verificar o status do RLS de todas as tabelas, execute no Supabase SQL Editor:

```sql
SELECT
    schemaname,
    tablename,
    CASE
        WHEN rowsecurity THEN 'RLS ATIVO'
        ELSE 'RLS DESATIVADO'
    END as rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
ORDER BY tablename;
```

## 🛠️ Troubleshooting

### Erro: "DATABASE_URL não está configurado"

- Verifique se o arquivo `.env` existe na raiz do projeto
- Verifique se a variável `DATABASE_URL` está definida corretamente
- Certifique-se de que não há espaços extras na string de conexão

### Erro: "Connection refused" ou "Timeout"

- Verifique se a string de conexão está correta
- Verifique se o Supabase está acessível
- Tente adicionar `?sslmode=require` ao final da string de conexão

### Erro: "Table already exists"

- Isso é normal se as tabelas já existem
- O Drizzle irá atualizar o schema se necessário
- Use `npm run db:push -- --force` para forçar atualização

### RLS ainda está ativo após o script

- Execute o script SQL manualmente no Supabase SQL Editor
- Verifique se você tem permissões suficientes (use service_role key se necessário)

## 📝 Próximos Passos

Após o setup:

1. ✅ Verifique se todas as tabelas foram criadas
2. ✅ Confirme que o RLS está desativado
3. ✅ Configure o Tenant Isolation na camada de aplicação (Node.js)
4. ✅ Teste a conexão com a aplicação

## 🔐 Segurança

**Lembre-se**:

- O isolamento de dados é feito na camada de aplicação
- Todos os endpoints verificam `req.user.claims.sub` (userId)
- Nunca exponha as credenciais de conexão no código
- Use variáveis de ambiente para todas as credenciais

## 📚 Referências

- [Documentação Drizzle ORM](https://orm.drizzle.team/)
- [Documentação Supabase](https://supabase.com/docs)
- [Documentação Técnica do Projeto](./DOCUMENTACAO_TECNICA.md)


























