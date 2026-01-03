# Changelog - ChamadosPro

Registro de todas as mudanças e funcionalidades implementadas.

---

## [2025-01] - Janeiro 2025

### ✨ Funcionalidades Adicionadas

#### 5. Escanear Dados via Foto (OCR Offline)

- **Arquivo**: `client/src/components/image-upload-button.tsx`, `client/src/utils/OCRParser.ts`, `client/src/utils/ocrImageProcessor.ts`
- **Descrição**: Permite escanear documentos (CNH, RG, CNPJ, etc.) e extrair automaticamente dados para preencher o formulário de cadastro de clientes.
- **Características**:
  - OCR 100% offline usando Tesseract.js
  - Sem APIs externas (OpenAI, AWS, etc.)
  - Extrai: CNPJ, CPF, Email, Telefone, CEP, Endereço completo, Razão Social, Nome Fantasia, Inscrições
  - Preenchimento automático do formulário
  - Validação de arquivos (tipo e tamanho)
  - Feedback visual durante processamento
- **Integração**: `client/src/pages/clientes.tsx` (linha ~1318)
- **Dependência**: `tesseract.js: ^5.0.4`
- **Documentação**: `OCR_ESCANEAR_DADOS_FOTO.md`, `INSTALACAO_OCR.md`, `README_OCR.md`
- **Melhorias (v1.1)**:
  - ✅ CNPJ: Priorização para capturar após palavra "CNPJ"
  - ✅ Razão Social: Captura múltiplas linhas para razão social completa
  - ✅ E-mail: Priorização para capturar após "E-mail" ou "Email"
  - ✅ Endereço: Detecção específica para formato "Rua / Logradouro"
  - ✅ Inscrições: Validação rigorosa para evitar capturar números de endereço
- **Melhorias (v1.2)**:
  - ✅ CNPJ: Removido fallback genérico - só captura após label "CNPJ"
  - ✅ Telefone: Priorização para capturar após palavra "Telefone"
  - ✅ Complemento: Validação melhorada para rejeitar placeholders
  - ✅ Bairro: Validação melhorada para rejeitar placeholders
  - ✅ Inscrições: Validação mais rigorosa para rejeitar textos de outros campos
- **Melhorias (v1.3)**:
  - ✅ CNPJ vs CPF: Validação para garantir que CNPJ tenha barra (não confunde com CPF)
  - ✅ CPF: Priorização contextual e validação para não confundir com CNPJ
  - ✅ Inscrição Municipal: Rejeita padrões "Bairro + UF" (ex: "Paulistano SP")
  - ✅ E-mail: Melhorada detecção de label "E-mail" ou "Email"
  - ✅ Telefone: Melhorada detecção de label "Telefone"
- **Melhorias (v1.4)**:
  - ✅ Telefone: Melhorada detecção e formatação automática
  - ✅ Nome Fantasia: Usa razão social como fallback quando nome fantasia não existe
  - ✅ Colar Imagem (CTRL+V): Implementada funcionalidade de colar imagem diretamente com Ctrl+V
- **Melhorias (v1.5)**:
  - ✅ E-mail: Melhorada detecção de label e fallback para múltiplos emails
  - ✅ Telefone: Melhorada detecção de label, regex mais robusto e fallback para telefones sem pontuação
  - ✅ Botão Colar Imagem: Adicionado botão "Colar Imagem" além da funcionalidade CTRL+V
- **Melhorias (v1.6)**:
  - ✅ E-mail: Detecção para seção "Dados de contato" e busca expandida para até 3 linhas
  - ✅ CNPJ: Validação crítica para garantir que CNPJ tenha barra (não confunde com CPF)
  - ✅ CNPJ: Busca expandida para até 3 linhas após encontrar label "CNPJ"

#### 1. Captura Automática de Dados para Chamados

- **Arquivo**: `client/src/pages/chamados.tsx`
- **Função**: `parseTicketText()` (linha ~475)
- **Descrição**: Permite colar um texto estruturado com informações do chamado e preencher automaticamente os campos do formulário.
- **Campos suportados**:
  - Data de agendamento (formato: DD/MM/YYYY ou "Agendamento: DD/MM/YYYY")
  - Hora de agendamento (formato: HH:mm)
  - Duração (em horas)
  - Descrição/Observações
  - Número do chamado (múltiplos formatos: "Número do Chamado: XXX", "Chamado: XXX", "OS: XXX")
  - Valor do chamado
  - Cliente final/Contato
  - Endereço do atendimento (formato: "Endereço: ..." ou "Endereço do Atendimento: ...")
- **Documentação**: `CAPTURA_AUTOMATICA_DADOS.md`

#### 2. Melhorias na Captura Automática de Dados de Clientes

- **Arquivo**: `client/src/pages/clientes.tsx`
- **Função**: `parseClientText()` (linha ~310)
- **Melhorias**:
  - Priorização correta de estratégias de detecção
  - Validação rigorosa para evitar captura de valores incorretos
  - Detecção melhorada de endereços (resolvido bug de capturar "T" no campo rua)
  - Limpeza de texto aprimorada (remove caracteres invisíveis)
- **Documentação**: `CAPTURA_AUTOMATICA_DADOS.md` (atualizado com histórico de erros)

#### 3. Seletor de Tipo de Cobrança (Substituição do Toggle)

- **Arquivo**: `client/src/pages/chamados.tsx`
- **Linha**: ~1364
- **Mudança**: Substituído o toggle grande por um Select simples e elegante
- **Funcionalidade**:
  - Ao mudar o tipo (Diária ou Chamado Avulso), busca automaticamente o valor padrão do cliente
  - Preenche o campo "Valor do Chamado" com o valor padrão (`defaultTicketValue`)
  - O valor pode ser editado manualmente após o preenchimento automático
- **Benefícios**:
  - Interface mais limpa e profissional
  - Preenchimento automático de valores
  - Melhor experiência do usuário

#### 4. Renomeação do Campo "Endereço" para "Rua"

- **Arquivo**: `client/src/pages/clientes.tsx`
- **Linha**: ~1400
- **Mudança**: Campo renomeado de "Endereço" para "Rua" para facilitar captura automática
- **Atributos atualizados**:
  - `id`: "rua"
  - `name`: "rua"
  - `data-testid`: "input-rua"
- **Motivo**: Melhorar a detecção automática de dados de endereço

### 🐛 Correções de Bugs

#### 1. Bug: Campo Rua Capturando Apenas "T"

- **Problema**: Campo de rua capturava apenas a letra "T" ao invés do endereço completo
- **Causa**:
  - Regex genérico sendo priorizado sobre detecção linha por linha
  - Falta de validação rigorosa
  - Não parava ao encontrar outro label
- **Solução**:
  - Priorização correta: detecção linha por linha → regex no texto completo
  - Validação rigorosa: comprimento mínimo, quantidade de palavras, rejeição de labels
  - Parada ao encontrar outro label
- **Arquivo**: `client/src/pages/clientes.tsx`
- **Documentação**: `CAPTURA_AUTOMATICA_DADOS.md` (seção "Erro 1")

#### 2. Bug: Data Não Capturada em Chamados

- **Problema**: Data não era capturada quando estava no formato "Agendamento: DD/MM/YYYY"
- **Causa**: Função só procurava por labels como "Data", mas não detectava "Agendamento:" na mesma linha
- **Solução**: Adicionada detecção prioritária para "Agendamento:" seguido de data na mesma linha
- **Arquivo**: `client/src/pages/chamados.tsx`
- **Documentação**: `CAPTURA_AUTOMATICA_DADOS.md` (seção "Erro 2")

#### 3. Bug: Número do Chamado Não Capturado

- **Problema**: Número do chamado não era detectado em formatos variados
- **Causa**: Regex muito restritivo, só aceitava "Número do chamado:" exato
- **Solução**: Expandida detecção para aceitar múltiplos formatos ("Chamado:", "OS:", "Ordem de Serviço:", etc.)
- **Arquivo**: `client/src/pages/chamados.tsx`
- **Documentação**: `CAPTURA_AUTOMATICA_DADOS.md` (seção "Erro 3")

#### 4. Bug: Campos de Endereço Não Apareciam em Chamados

- **Problema**: Campos de endereço do atendimento não apareciam no formulário
- **Causa**: Campos só aparecem quando cliente é do tipo `EMPRESA_PARCEIRA`
- **Solução**: Documentação clara sobre quando os campos aparecem e garantia de que `serviceAddress` é sempre incluído no payload
- **Arquivo**: `client/src/pages/chamados.tsx`
- **Documentação**: `CAPTURA_AUTOMATICA_DADOS.md` (seção "Erro 4")

#### 5. Bug: Endereço Não Capturado do Texto em Chamados

- **Problema**: Endereço não era capturado quando estava no formato "Endereço: ..." na mesma linha
- **Causa**: Função só procurava "Endereço do atendimento:" ou "Endereço:" em linhas separadas
- **Solução**: Adicionada detecção prioritária para "Endereço:" seguido de endereço na mesma linha
- **Arquivo**: `client/src/pages/chamados.tsx`
- **Documentação**: `CAPTURA_AUTOMATICA_DADOS.md` (seção "Erro 5")

#### 6. Bug: TypeError - Cannot read properties of undefined

- **Problemas**: Múltiplos erros de acesso a propriedades de objetos `undefined`
  - `ticket.client.name`
  - `ticket.service.name`
  - `ticket.service.price`
  - `clients.find(...).type`
  - `timer.running`
- **Causa**: Dados ainda não carregados ou objetos relacionados podem ser `undefined`
- **Solução**: Uso de optional chaining (`?.`) em todos os acessos
- **Arquivos**:
  - `client/src/pages/chamados.tsx`
  - `client/src/components/ticket-list.tsx`
- **Documentação**: `CAPTURA_AUTOMATICA_DADOS.md` (seções "Erro 6", "Erro 7", "Erro 8", "Erro 9")

#### 7. Bug: Duplicação do Campo serviceAddress no Payload

- **Problema**: Campo `serviceAddress` estava sendo definido duas vezes no payload
- **Causa**: Código duplicado durante implementação
- **Solução**: Removida duplicação, mantendo apenas uma definição
- **Arquivo**: `client/src/pages/chamados.tsx` (linha ~970)

### 📚 Documentação Criada/Atualizada

#### 1. CAPTURA_AUTOMATICA_DADOS.md (Atualizado)

- **Versão**: 2.0
- **Conteúdo**:
  - Histórico completo de erros encontrados (9 erros)
  - Soluções implementadas para cada erro
  - Guia de prevenção de erros (5 regras de ouro)
  - Checklist anti-erro para novas implementações
  - Lições aprendidas

#### 2. ESTRUTURA_DADOS_COMPLETA.md (Novo)

- **Versão**: 1.0
- **Conteúdo**:
  - Estrutura completa de dados de todas as entidades
  - Mapeamento formulário → Google Sheets
  - Preparação para migração futura para banco de dados
  - Verificação de compatibilidade
  - Scripts de migração sugeridos

#### 3. VERIFICACAO_GOOGLE_SHEETS_TICKETS.md (Novo)

- **Versão**: 1.0
- **Conteúdo**:
  - Verificação da estrutura das tabelas no Google Sheets
  - Campos salvos no JSON (coluna C)
  - Processo de salvamento
  - Checklist de verificação
  - Como verificar no Google Sheets
  - Problemas comuns e soluções

#### 4. CHANGELOG.md (Novo)

- **Versão**: 1.0
- **Conteúdo**: Este arquivo - registro de todas as mudanças

### 🔍 Verificações Realizadas

#### 1. Verificação de Compatibilidade Google Sheets

- **Status**: ✅ COMPATÍVEL
- **Resultado**: Todos os campos dos formulários são salvos corretamente no Google Sheets
- **Documentação**: `ESTRUTURA_DADOS_COMPLETA.md`

#### 2. Verificação de Integridade dos Dados

- **Clientes**: ✅ Todos os 25 campos verificados
- **Chamados**: ✅ Todos os 30+ campos verificados
- **Status**: Nenhum campo está sendo perdido ou filtrado
- **Documentação**: `ESTRUTURA_DADOS_COMPLETA.md`

### 🎯 Melhorias de Código

#### 1. Optional Chaining

- **Aplicado em**: Todos os acessos a propriedades que podem ser `undefined`
- **Benefício**: Previne erros de runtime
- **Exemplo**: `ticket.client?.name` ao invés de `ticket.client.name`

#### 2. Validação Rigorosa

- **Aplicado em**: Funções de captura automática de dados
- **Benefício**: Previne captura de valores incorretos
- **Exemplo**: Validação de comprimento mínimo, quantidade de palavras, etc.

#### 3. Priorização de Estratégias

- **Aplicado em**: Funções de detecção de dados
- **Ordem**: Detecção na mesma linha → Detecção linha por linha → Regex no texto completo
- **Benefício**: Maior precisão na captura de dados

---

## 📋 Resumo das Mudanças por Arquivo

### `client/src/pages/chamados.tsx`

- ✅ Adicionada função `parseTicketText()` para captura automática
- ✅ Adicionado estado `rawTicketText` para texto de entrada
- ✅ Substituído toggle de tipo de cobrança por Select
- ✅ Adicionada lógica para buscar valor padrão do cliente ao mudar tipo
- ✅ Corrigido campo `serviceAddress` no payload (removida duplicação)
- ✅ Adicionado optional chaining em acessos a `clients` e `services`
- ✅ Melhorada detecção de data, número do chamado e endereço
- ✅ Adicionada documentação inline

### `client/src/pages/clientes.tsx`

- ✅ Melhorada função `parseClientText()` com validações rigorosas
- ✅ Corrigido bug de captura de "T" no campo rua
- ✅ Renomeado campo "Endereço" para "Rua" (id, name, data-testid)
- ✅ Adicionada documentação inline

### `client/src/components/ticket-list.tsx`

- ✅ Adicionado optional chaining em acessos a `ticket.client` e `ticket.service`
- ✅ Adicionado optional chaining em acessos a `timer.running`

### Documentação

- ✅ `CAPTURA_AUTOMATICA_DADOS.md` - Atualizado com histórico de erros
- ✅ `ESTRUTURA_DADOS_COMPLETA.md` - Novo arquivo
- ✅ `VERIFICACAO_GOOGLE_SHEETS_TICKETS.md` - Novo arquivo
- ✅ `CHANGELOG.md` - Novo arquivo

---

## 🎓 Lições Aprendidas

1. **Optional Chaining é OBRIGATÓRIO**: Nunca assuma que objetos/arrays existem
2. **Validação Rigorosa é ESSENCIAL**: Múltiplas validações previnem capturas erradas
3. **Priorização Importa**: Detecção linha por linha > Regex no texto completo
4. **Limpeza de Texto é FUNDAMENTAL**: Caracteres invisíveis quebram detecção
5. **Parar ao Encontrar Label**: Evita capturar valores de campos errados
6. **Detecção na Mesma Linha**: Muitos textos têm label e valor juntos
7. **Múltiplas Variações**: Labels podem ter muitas formas diferentes
8. **Teste com Casos Reais**: Use textos reais do usuário para testar

---

**Última Atualização**: Janeiro 2025  
**Versão do Changelog**: 1.0
