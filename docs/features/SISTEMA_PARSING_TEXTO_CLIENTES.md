# Sistema de Parsing Inteligente de Texto - Cadastro de Clientes

## 📋 Visão Geral

Este documento descreve o sistema completo de parsing inteligente de texto implementado no módulo de cadastro de clientes. O sistema utiliza uma abordagem multi-camadas com sistema de scoring para detectar e extrair dados estruturados de texto não formatado.

**Última Atualização**: Janeiro 2025  
**Versão**: 1.0  
**Arquivo**: `client/src/pages/clientes.tsx`

---

## 🎯 Objetivo

Extrair automaticamente dados de clientes a partir de texto colado (de documentos, emails, mensagens, etc.) e preencher o formulário de cadastro com alta precisão.

---

## 🏗️ Arquitetura do Sistema

### Componentes Principais

```
┌─────────────────────────────────────────┐
│   Textarea (Input do Usuário)          │
│   - Recebe texto colado                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   parseClientText()                     │
│   - Limpeza e normalização              │
│   - Divisão em linhas                   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Sistema de Filtros                    │
│   - ignoredTerms (labels a ignorar)     │
│   - addressRelatedTerms (blindagem)     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Detecção Multi-Camadas                │
│   - PRIORIDADE 0: Detecção direta       │
│   - PRIORIDADE 1: Sistema de scoring    │
│   - PRIORIDADE 2: Regex fallback        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Integração com APIs                   │
│   - Consulta CEP automática             │
│   - Consulta CNPJ automática            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│   Preenchimento do Formulário           │
│   - Aplicação de máscaras               │
│   - Validação de dados                  │
└─────────────────────────────────────────┘
```

---

## 🔧 Implementação Detalhada

### 1. Limpeza e Normalização

```typescript
const parseClientText = () => {
  // Limpa o texto: remove caracteres invisíveis e normaliza quebras de linha
  const cleanedText = (rawClientText || '')
    .replace(/\r\n/g, '\n') // Normaliza quebras de linha Windows
    .replace(/\r/g, '\n') // Normaliza quebras de linha Mac
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
    .trim();
  
  const text = cleanedText;
  const lines = text.split(/\n/).map((l) => l.trim());
  
  // ... resto da implementação
};
```

### 2. Sistema de Filtros

#### 2.1 Termos Ignorados

Lista de labels e seções que devem ser ignorados no preenchimento, mas usados como marcadores contextuais:

```typescript
const ignoredTerms = [
  'cliente',
  'dados de contato',
  'dados',
  'contato',
  'informações fiscais',
  'informações',
  'fiscais',
  'endereço',
  'endereco',
  'nome',
  'e-mail',
  'email',
  'telefone',
  'cpf',
  'cnpj',
  'cep',
  'rua / logradouro',
  'rua/logradouro',
  'rua logradouro',
  'rua',
  'logradouro',
  'número',
  'numero',
  'nº',
  'n░',
  'complemento',
  'bairro / distrito',
  'bairro/distrito',
  'bairro',
  'distrito',
  'cidade',
  'uf / estado',
  'uf/estado',
  'uf',
  'estado',
  'município',
  'municipio',
];
```

#### 2.2 Termos Relacionados a Endereço

Lista de termos que devem ser rejeitados no campo nome (blindagem):

```typescript
const addressRelatedTerms = [
  'torre',
  'apto',
  'apartamento',
  'bloco',
  'sala',
  'andar',
  'casa',
  'lote',
  'quadra',
  'avenida',
  'rua',
  'estrada',
  'rodovia',
  'praça',
  'travessa',
  'alameda',
  'viela',
  'passagem',
  'logradouro',
  'protásio',
  'protasio',
  'alves',
  'morro',
  'santana',
  'porto',
  'alegre',
];
```

#### 2.3 Funções Auxiliares

```typescript
// Verifica se uma linha é um termo ignorado
const isIgnoredTerm = (line: string): boolean => {
  const normalized = line.toLowerCase().trim();
  return ignoredTerms.some((term) => {
    return (
      normalized === term ||
      normalized === `${term}:` ||
      normalized === `${term}-` ||
      normalized.match(new RegExp(`^${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[:\-]?$`, 'i'))
    );
  });
};

// Verifica se uma linha contém termos de endereço
const containsAddressTerms = (line: string): boolean => {
  const normalized = line.toLowerCase();
  return addressRelatedTerms.some((term) => normalized.includes(term));
};
```

### 3. Detecção de Nome com Sistema de Scoring

#### 3.1 Função de Validação de Nome Próprio

```typescript
const looksLikeProperName = (line: string): boolean => {
  const trimmed = line.trim();
  
  // Deve ter pelo menos 5 caracteres e 2 palavras
  if (trimmed.length < 5) return false;
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 2) return false;

  // Todas as palavras devem começar com maiúscula
  const allWordsStartWithCapital = words.every(
    (word) => word[0] === word[0].toUpperCase()
  );
  if (!allWordsStartWithCapital) return false;

  // Deve ter pelo menos 60% de letras
  const letterCount = trimmed.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').length;
  const letterRatio = letterCount / trimmed.length;
  if (letterRatio < 0.6) return false;

  // Não deve conter termos de endereço, ignorados, números significativos
  if (containsAddressTerms(trimmed)) return false;
  if (isIgnoredTerm(trimmed)) return false;
  if (/\d{2,}/.test(trimmed)) return false; // 2+ dígitos
  if (trimmed.includes('@')) return false; // Email
  if (/^\(\d{2}\)\s*\d{4,5}-?\d{4}$/.test(trimmed)) return false; // Telefone
  if (/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(trimmed)) return false; // CPF
  if (/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(trimmed)) return false; // CNPJ
  if (/^\d{5}-?\d{3}$/.test(trimmed)) return false; // CEP

  return true;
};
```

#### 3.2 Função de Cálculo de Score

```typescript
const calculateNameScore = (line: string, index: number, lines: string[]): number => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 5) return 0;

  let score = 0;

  // Base score for looking like a proper name
  if (looksLikeProperName(trimmed)) {
    score += 10;
  } else {
    return 0; // Must look like a proper name to get any score
  }

  // Bonus for multiple words
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  score += words.length * 2;

  // Bonus for being early in the text
  score += Math.max(0, 10 - index);

  // Bonus if preceded by a known section header
  if (index > 0) {
    const prevLine = lines[index - 1].toLowerCase().trim();
    if (prevLine.match(/^(?:cliente|dados de contato|informações fiscais)[:\-]?$/i)) {
      score += 5;
    }
  }

  // Penalty if preceded by a label for another field
  if (index > 0) {
    const prevLine = lines[index - 1].toLowerCase().trim();
    if (prevLine.match(/^(?:e-mail|email|telefone|cpf|cnpj|cep|rua|logradouro|número|numero|complemento|bairro|distrito|cidade|uf|estado|endereço|endereco)[:\-]?$/i)) {
      score -= 15; // Strong penalty
    }
  }

  return score;
};
```

#### 3.3 Detecção com Scoring

```typescript
// PRIORIDADE 0: Procura por padrão de nome próprio em qualquer linha
let nameMatch = null;
let bestNameScore = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line || isIgnoredTerm(line)) continue;

  const score = calculateNameScore(line, i, lines);
  if (score > bestNameScore && score > 20) {
    // Threshold mínimo de 20 pontos
    bestNameScore = score;
    nameMatch = line;
  }
}
```

### 4. Detecção de Endereço com Sistema de Scoring

#### 4.1 Função de Cálculo de Score para Endereço

```typescript
const calculateAddressScore = (line: string, index: number): number => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 5) return 0;

  let score = 0;

  // Deve ter pelo menos 2 palavras
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 2) return 0;
  score += words.length * 3;

  // Bonus por conter palavras-chave de endereço
  const addressKeywords = [
    'avenida', 'av', 'rua', 'estrada', 'rodovia', 'praça',
    'travessa', 'alameda', 'viela', 'passagem', 'logradouro',
    'protásio', 'protasio', 'alves', 'brig', 'faria', 'lima',
    'são', 'paulo', 'santos', 'silva', 'oliveira',
  ];
  const hasAddressKeyword = addressKeywords.some((keyword) =>
    trimmed.toLowerCase().includes(keyword)
  );
  if (hasAddressKeyword) {
    score += 30; // Bonus alto por ter palavra-chave de endereço
  }

  // Bonus especial: se contém "Avenida" ou "Av" e tem pelo menos 2 palavras
  if (trimmed.toLowerCase().match(/\b(?:avenida|av\.?)\b/) && words.length >= 2) {
    score += 25; // Bonus alto para endereços com "Avenida"
  }

  // Deve ter pelo menos 50% de letras
  const letterCount = trimmed.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').length;
  const letterRatio = letterCount / trimmed.length;
  if (letterRatio >= 0.5) {
    score += letterRatio * 15;
  } else {
    return 0;
  }

  // Penalidades
  if (isIgnoredTerm(trimmed)) return 0;
  if (/^\d{5}-?\d{3}$/.test(trimmed)) return 0; // Rejeita CEP
  if (/^\d+$/.test(trimmed)) return 0; // Rejeita só números
  if (/^[A-Z]{2}$/.test(trimmed)) return 0; // Rejeita só UF

  // Bonus por contexto: se está após label de rua/logradouro
  const prevLine = index > 0 ? lines[index - 1].toLowerCase().trim() : '';
  const normalizedPrevLine = prevLine.replace(/\s+/g, ' ');
  const isAfterRuaLabel =
    normalizedPrevLine === 'rua / logradouro' ||
    normalizedPrevLine === 'rua/logradouro' ||
    normalizedPrevLine === 'rua logradouro' ||
    normalizedPrevLine.match(/^rua\s*\/\s*logradouro$/i) ||
    (normalizedPrevLine.includes('rua') && normalizedPrevLine.includes('logradouro'));

  if (isAfterRuaLabel) {
    score += 50; // Bonus máximo se está após label de rua
  } else if (prevLine.match(/^(?:endereço|endereco)[:\-]?$/)) {
    score += 20; // Bonus se está após label de endereço
  }

  // Penalidade se está após labels de outros campos (mas não rejeita completamente)
  if (prevLine.match(/^(?:e-mail|email|telefone|cpf|cnpj|cep|número|numero|complemento|bairro|distrito|cidade|uf|estado)$/)) {
    score -= 50; // Penalidade reduzida
  }

  return score;
};
```

#### 4.2 Detecção Multi-Camadas

```typescript
let addressMatch = null;
let bestAddressScore = 0;

// PRIORIDADE 0: Detecção direta quando encontra label "Rua / Logradouro"
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].toLowerCase().trim();
  const normalizedLine = line.replace(/\s+/g, ' ');
  const isRuaLabel =
    normalizedLine === 'rua / logradouro' ||
    normalizedLine === 'rua/logradouro' ||
    normalizedLine === 'rua logradouro' ||
    normalizedLine.match(/^rua\s*\/\s*logradouro$/i) ||
    (normalizedLine.includes('rua') && normalizedLine.includes('logradouro'));

  if (isRuaLabel && i + 1 < lines.length) {
    const nextLine = lines[i + 1].trim();
    if (
      nextLine &&
      nextLine.length >= 3 &&
      !isIgnoredTerm(nextLine) &&
      !nextLine.match(/^(?:número|numero|nº|n░|cep|bairro|distrito|cidade|uf|estado|complemento|endereço|endereco|rua|logradouro|e-mail|email|telefone|cpf|cnpj)/i) &&
      /[A-Za-zÀ-ÿ]/.test(nextLine)
    ) {
      addressMatch = nextLine;
      break;
    }
  }
}

// PRIORIDADE 1: Análise contextual com scoring
if (!addressMatch) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || isIgnoredTerm(line)) continue;

    const score = calculateAddressScore(line, i);
    if (score > bestAddressScore && score > 10) {
      // Threshold mínimo de 10 pontos
      bestAddressScore = score;
      addressMatch = line;
    }
  }
}

// PRIORIDADE 2: Padrões regex no texto completo
if (!addressMatch) {
  const addressPatterns = [
    /\b(?:avenida|av\.?)\s+([A-Za-zÀ-ÿ0-9\s]+?)(?:\s*\n|$)/i,
    /\b(?:rua|r\.?)\s+([A-Za-zÀ-ÿ0-9\s]+?)(?:\s*\n|$)/i,
    /(?:logradouro)[:\-]?\s*([A-Za-zÀ-ÿ0-9\s,]+?)(?:\s*\n|$)/i,
    /(?:endereço|endereco)[:\-]?\s*([A-Za-zÀ-ÿ0-9\s,]+?)(?:\s*[,\n]|$)/i,
  ];

  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match && match[1]?.trim()) {
      const candidate = match[1].trim();
      if (
        candidate.length >= 5 &&
        !isIgnoredTerm(candidate) &&
        !candidate.match(/^(?:número|numero|nº|n░|cep|bairro|distrito|cidade|uf|estado|complemento)/i)
      ) {
        addressMatch = candidate;
        break;
      }
    }
  }
}
```

### 5. Detecção de Número do Endereço

```typescript
const calculateNumberScore = (line: string, index: number): number => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 1) return 0;

  let score = 0;

  // Deve ser principalmente números (pode ter letras no final, ex: "123A")
  const hasNumbers = /\d/.test(trimmed);
  if (!hasNumbers) return 0;

  // Bonus se é um número simples (ex: "8201")
  if (/^\d+[A-Za-z]?$/.test(trimmed)) {
    score += 30;
  }

  // Bonus se tem formato comum de número de endereço (1-5 dígitos + letra opcional)
  if (/^\d{1,5}[A-Za-z]?$/.test(trimmed)) {
    score += 20;
  }

  // Penalidades
  if (isIgnoredTerm(trimmed)) return 0;
  if (trimmed.match(/^(?:complemento|cep|bairro|distrito|cidade|uf|estado|endereço|endereco|rua|logradouro)/i))
    return 0;
  if (/^\d{5,}$/.test(trimmed)) score -= 20; // Penaliza números muito longos

  // Bonus por contexto: se está após label de número
  const prevLine = index > 0 ? lines[index - 1].toLowerCase().trim() : '';
  if (prevLine.match(/^(?:número|numero|nº|n░|num\.?)[:\-]?$/)) {
    score += 50; // Bonus máximo se está após label de número
  }

  // Penalidade se está após labels de outros campos
  if (prevLine.match(/^(?:e-mail|email|telefone|cpf|cnpj|cep|complemento|bairro|distrito|cidade|uf|estado|endereço|endereco|rua|logradouro)$/)) {
    score -= 100;
  }

  return score;
};

// Detecção
let addressNumberMatch = null;
let bestNumberScore = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const score = calculateNumberScore(line, i);
  if (score > bestNumberScore && score > 10) {
    bestNumberScore = score;
    addressNumberMatch = line;
  }
}
```

### 6. Detecção de Complemento

```typescript
const calculateComplementScore = (line: string, index: number): number => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return 0;

  let score = 0;

  // Bonus por conter palavras-chave de complemento
  const complementKeywords = [
    'torre', 'apto', 'apartamento', 'bloco', 'sala', 'andar', 'box',
  ];
  const hasComplementKeyword = complementKeywords.some((keyword) =>
    trimmed.toLowerCase().includes(keyword)
  );
  if (hasComplementKeyword) {
    score += 40; // Bonus alto por ter palavra-chave de complemento
  }

  // Bonus por conter números (complementos geralmente têm números)
  if (/\d/.test(trimmed)) {
    score += 20;
  }

  // Deve ter no máximo 5 palavras (complementos são geralmente curtos)
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= 5) {
    score += 10;
  } else {
    score -= 20; // Penaliza se for muito longo
  }

  // Penalidades
  if (isIgnoredTerm(trimmed)) return 0;
  if (trimmed.match(/^(?:bairro|distrito|cidade|uf|estado|cep|número|numero|endereço|endereco|rua|logradouro)/i))
    return 0;
  if (/^\d{5}-?\d{3}$/.test(trimmed)) return 0; // Rejeita CEP
  if (/^[A-Z]{2}$/.test(trimmed)) return 0; // Rejeita só UF

  // Bonus por contexto: se está após label de complemento
  const prevLine = index > 0 ? lines[index - 1].toLowerCase().trim() : '';
  if (prevLine.match(/^(?:complemento|apto|apartamento|bloco|sala|andar)[:\-]?$/)) {
    score += 50; // Bonus máximo se está após label de complemento
  }

  // Penalidade se está após labels de outros campos
  if (prevLine.match(/^(?:e-mail|email|telefone|cpf|cnpj|cep|número|numero|bairro|distrito|cidade|uf|estado|endereço|endereco|rua|logradouro)$/)) {
    score -= 100;
  }

  return score;
};

// Detecção
let complementMatch = null;
let bestComplementScore = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const score = calculateComplementScore(line, i);
  if (score > bestComplementScore && score > 20) {
    // Threshold mínimo de 20 pontos
    bestComplementScore = score;
    complementMatch = line;
  }
}

// PRIORIDADE 2: Procura padrões específicos de complemento
if (!complementMatch) {
  const complementPatterns = [
    /\b(?:torre|bloco)\s+[\dA-Za-z]+\s+(?:apto|apartamento|sala|andar)\s+[\dA-Za-z]+/i,
    /\b(?:apto|apartamento|apt\.?)\s+[\dA-Za-z]+(?:\s+torre\s+[\dA-Za-z]+)?/i,
    /\b(?:bloco|bl\.?)\s+[\dA-Za-z]+(?:\s+sala\s+[\dA-Za-z]+)?/i,
    /\b(?:sala|andar)\s+[\dA-Za-z]+/i,
    /\b(?:box)\s+[\dA-Za-z]+/i,
  ];

  for (const pattern of complementPatterns) {
    const match = text.match(pattern);
    if (match && match[0]) {
      complementMatch = match[0].trim();
      break;
    }
  }
}
```

### 7. Detecção de Bairro

```typescript
const calculateNeighborhoodScore = (line: string, index: number): number => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return 0;

  let score = 0;

  // Deve ter pelo menos 1 palavra
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 1) return 0;
  score += words.length * 5;

  // Deve ter pelo menos 70% de letras
  const letterCount = trimmed.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').length;
  const letterRatio = letterCount / trimmed.length;
  if (letterRatio >= 0.7) {
    score += letterRatio * 20;
  } else {
    return 0;
  }

  // Bonus por conter palavras-chave comuns de bairros
  const neighborhoodKeywords = [
    'vila', 'jardim', 'parque', 'centro', 'bairro',
    'distrito', 'morro', 'santana',
  ];
  const hasNeighborhoodKeyword = neighborhoodKeywords.some((keyword) =>
    trimmed.toLowerCase().includes(keyword)
  );
  if (hasNeighborhoodKeyword) {
    score += 15;
  }

  // Penalidades
  if (isIgnoredTerm(trimmed)) return 0;
  if (trimmed.match(/^(?:cidade|uf|estado|cep|número|numero|endereço|endereco|complemento|rua|logradouro)/i))
    return 0;
  if (/^\d+$/.test(trimmed)) return 0;
  if (/^\d{5}-?\d{3}$/.test(trimmed)) return 0; // Rejeita CEP
  if (/^[A-Z]{2}$/.test(trimmed)) return 0; // Rejeita só UF

  // Bonus por contexto: se está após label de bairro
  const prevLine = index > 0 ? lines[index - 1].toLowerCase().trim() : '';
  if (prevLine.match(/^(?:bairro\s*\/?\s*distrito|bairro|distrito|vila|jardim|parque)[:\-]?$/)) {
    score += 50; // Bonus máximo se está após label de bairro
  }

  // Penalidade se está após labels de outros campos
  if (prevLine.match(/^(?:e-mail|email|telefone|cpf|cnpj|cep|número|numero|complemento|cidade|uf|estado|endereço|endereco|rua|logradouro)$/)) {
    score -= 100;
  }

  return score;
};

// Detecção
let neighborhoodMatch = null;
let bestNeighborhoodScore = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line || isIgnoredTerm(line)) continue;

  const score = calculateNeighborhoodScore(line, i);
  if (score > bestNeighborhoodScore && score > 15) {
    // Threshold mínimo de 15 pontos
    bestNeighborhoodScore = score;
    neighborhoodMatch = line;
  }
}
```

### 8. Integração com Consulta Automática de CEP

```typescript
// Quando CEP é detectado no texto, consulta API automaticamente
if (updated.zipCode && updated.zipCode.replace(/\D/g, '').length === 8) {
  const cleanCep = updated.zipCode.replace(/\D/g, '');
  
  setTimeout(() => {
    setFormData((prev) => {
      fetchCepData(cleanCep)
        .then((cepInfo) => {
          if (cepInfo) {
            setFormData((prevForm) => {
              const updatedForm = { ...prevForm };
              
              // Preenche apenas campos vazios para não sobrescrever dados já preenchidos
              if (!prevForm.streetAddress || prevForm.streetAddress.trim() === '') {
                updatedForm.streetAddress = cepInfo.street || '';
              }
              if (!prevForm.neighborhood || prevForm.neighborhood.trim() === '') {
                updatedForm.neighborhood = cepInfo.neighborhood || '';
              }
              if (!prevForm.city || prevForm.city.trim() === '') {
                updatedForm.city = cepInfo.city || '';
              }
              if (!prevForm.state || prevForm.state.trim() === '') {
                updatedForm.state = cepInfo.state?.toUpperCase() || '';
              }
              if (cepInfo.complement && (!prevForm.addressComplement || prevForm.addressComplement.trim() === '')) {
                updatedForm.addressComplement = cepInfo.complement;
              }
              
              return updatedForm;
            });
          }
        })
        .catch((error) => {
          console.error('Erro ao buscar CEP:', error);
        });
      
      return prev;
    });
  }, 100);
}
```

---

## 📊 Campos Suportados e Estratégias

| Campo | Estratégia | Threshold | Prioridades |
|-------|-----------|-----------|-------------|
| **Nome** | Scoring | 20 pontos | 0: Scoring contextual<br>1: Label "Nome:"<br>2: Antes de seções |
| **Endereço** | Scoring + Direta | 10 pontos | 0: Label "Rua / Logradouro"<br>1: Scoring contextual<br>2: Regex patterns |
| **Número** | Scoring | 10 pontos | 0: Scoring contextual<br>1: Label "Número:"<br>2: Regex patterns |
| **Complemento** | Scoring + Regex | 20 pontos | 0: Scoring contextual<br>1: Padrões específicos<br>2: Regex patterns |
| **Bairro** | Scoring | 15 pontos | 0: Scoring contextual<br>1: Label "Bairro:"<br>2: Regex patterns |
| **Cidade** | Direta | - | 0: Label "Cidade:"<br>1: Regex patterns |
| **Estado** | Direta | - | 0: Label "UF / Estado:"<br>1: Regex patterns |
| **CEP** | Direta + Regex | - | 0: Label "CEP:"<br>1: Regex patterns<br>2: Consulta API automática |
| **Email** | Regex | - | Regex padrão de email |
| **Telefone** | Regex | - | Regex padrão de telefone |
| **CPF/CNPJ** | Regex | - | Regex padrão + validação |

---

## 🎯 Boas Práticas

### 1. Sistema de Scoring

- **Use scoring quando**: O campo pode aparecer em diferentes formatos e precisa de alta precisão
- **Threshold mínimo**: Defina um threshold mínimo de pontos para evitar falsos positivos
- **Contexto**: Considere linhas anteriores e posteriores para dar bonus/penalidades

### 2. Detecção Direta por Label

- **Use quando**: O campo sempre aparece após um label específico
- **Vantagem**: Muito confiável quando o label está presente
- **Implementação**: Procure o label e pegue a próxima linha válida

### 3. Regex Patterns

- **Use quando**: O campo tem formato fixo e previsível
- **Vantagem**: Rápido e eficiente
- **Limitação**: Pode capturar falsos positivos se não validado

### 4. Integração com APIs

- **Sempre**: Preencha apenas campos vazios (não sobrescreva dados já preenchidos)
- **Use setTimeout**: Para evitar conflitos com atualizações de estado
- **Trate 404**: Como caso esperado, não como erro

---

## 🐛 Debug e Troubleshooting

### Logs de Debug

O sistema inclui logs detalhados para debugging:

```typescript
console.log('[DEBUG] 🔍 Endereço final calculado:', {
  addressMatch: addressMatch?.trim() || '(não encontrado)',
  fullAddressMatch: fullAddressMatch?.[1]?.trim() || '(não encontrado)',
  finalAddress: finalAddress || '(não encontrado)',
  hasAddressMatch: !!addressMatch,
  hasFullAddressMatch: !!fullAddressMatch?.[1],
});

console.log(`[DEBUG] ✅ Endereço detectado diretamente após label: "${addressMatch}"`);
console.log(`[DEBUG] Endereço candidato: "${line}" - Score: ${score}`);
console.log(`[DEBUG] CEP detectado: ${cleanCep}, consultando API...`);
console.log(`[DEBUG] Dados do CEP recebidos:`, cepInfo);
```

**IMPORTANTE**: Remover todos os `console.log` antes de produção!

### Problemas Comuns

1. **Campo não é detectado**
   - Verifique se o termo está em `ignoredTerms` (se for um label)
   - Verifique se o threshold de scoring não está muito alto
   - Adicione logs de debug para ver o score calculado

2. **Campo detectado incorretamente**
   - Adicione validações mais rigorosas na função de scoring
   - Aumente as penalidades para contextos incorretos
   - Adicione mais termos à lista de blindagem

3. **CEP não consulta API**
   - Verifique se o CEP tem 8 dígitos após limpeza
   - Verifique se o `setTimeout` está sendo executado
   - Verifique logs de debug da consulta

---

## ✅ Checklist para Adicionar Novo Campo

- [ ] Adicionar termo ao array `ignoredTerms` se for um label
- [ ] Criar função `calculate{Field}Score()` se usar scoring
- [ ] Implementar detecção direta por label (PRIORIDADE 0)
- [ ] Implementar sistema de scoring (PRIORIDADE 1)
- [ ] Implementar fallback com regex (PRIORIDADE 2)
- [ ] Adicionar validação específica do campo
- [ ] Adicionar campo ao formulário se não existir
- [ ] Garantir que campo é preenchido no `setFormData`
- [ ] Testar com diferentes formatos de texto
- [ ] Adicionar logs de debug
- [ ] Remover logs antes de produção

---

## 📝 Exemplo de Texto de Entrada

```
Ariane kotekewis Tavares

Cliente

Dados de contato

E-mail

akotekewis@gmail.com

Telefone

(51) 99135-9898

Informações fiscais

CPF

004.899.110-48

Endereço

CEP

91260-000

Rua / Logradouro

Avenida Protásio Alves

Número

8201

Complemento

Torre 5 Apto 810

Bairro / Distrito

Morro Santana

UF / Estado

RS

Cidade

Porto Alegre
```

### Resultado Esperado

- **Nome**: "Ariane kotekewis Tavares"
- **Email**: "akotekewis@gmail.com"
- **Telefone**: "(51) 99135-9898"
- **CPF**: "004.899.110-48"
- **CEP**: "91260-000" → Consulta API automaticamente
- **Endereço**: "Avenida Protásio Alves"
- **Número**: "8201"
- **Complemento**: "Torre 5 Apto 810"
- **Bairro**: "Morro Santana"
- **Cidade**: "Porto Alegre"
- **Estado**: "RS"

---

## 🔗 Referências

- **Manual de Implementação Completo**: `MANUAL_IMPLEMENTACAO_AUTO_PREENCHIMENTO.md`
- **Documentação Técnica**: `DOCUMENTACAO_TECNICA.md`
- **BrasilAPI**: https://brasilapi.com.br/

---

**Última Revisão**: Janeiro 2025  
**Versão do Documento**: 1.0





























