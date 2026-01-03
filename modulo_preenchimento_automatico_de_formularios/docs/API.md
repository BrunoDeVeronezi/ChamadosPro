# API Reference - Módulo de Preenchimento Automático

## Índice

- [TextParser](#textparser)
- [OCRProcessor](#ocrprocessor)
- [Services](#services)
- [Types](#types)

---

## TextParser

### Classe `TextParser`

Parser principal para extração de dados de texto.

#### Construtor

```typescript
constructor(options?: TextParserOptions)
```

**Parâmetros:**

- `options.autoFetchCep?: boolean` - Consulta CEP automaticamente (padrão: `true`)
- `options.autoFetchCnpj?: boolean` - Consulta CNPJ automaticamente (padrão: `true`)
- `options.onCepDetected?: (cep: string) => Promise<CepResponse | null>` - Callback customizado
- `options.onCnpjDetected?: (cnpj: string) => Promise<CnpjResponse | null>` - Callback customizado
- `options.debug?: boolean` - Ativa logs de debug (padrão: `false`)

#### Método `parse()`

```typescript
parse(text: string): Promise<ExtractedFormData>
```

Extrai dados estruturados do texto.

**Parâmetros:**

- `text: string` - Texto a ser parseado

**Retorna:** `Promise<ExtractedFormData>`

**Exemplo:**

```typescript
const parser = new TextParser();
const result = await parser.parse('Nome: João Silva\nEmail: joao@example.com');
console.log(result.name); // "João Silva"
console.log(result.email); // "joao@example.com"
```

---

## OCRProcessor

### Função `processImageOCR()`

Processa uma imagem e extrai texto usando OCR.

```typescript
processImageOCR(
  imageFile: File | Blob,
  options?: OCRProcessorOptions
): Promise<OCRResult>
```

**Parâmetros:**

- `imageFile: File | Blob` - Arquivo de imagem
- `options.language?: string` - Idioma para OCR (padrão: `'por'`)
- `options.maxFileSize?: number` - Tamanho máximo em bytes (padrão: `10MB`)
- `options.allowedTypes?: string[]` - Tipos permitidos

**Retorna:** `Promise<OCRResult>`

**Exemplo:**

```typescript
const file = event.target.files[0];
const result = await processImageOCR(file, { language: 'por' });
console.log(result.text); // Texto extraído
console.log(result.blocks); // Array de blocos
console.log(result.confidence); // Confiança (0-100)
```

### Função `validateImageFile()`

Valida se o arquivo é uma imagem válida.

```typescript
validateImageFile(
  file: File,
  options?: OCRProcessorOptions
): { valid: boolean; error?: string }
```

**Parâmetros:**

- `file: File` - Arquivo a ser validado
- `options` - Mesmas opções de `processImageOCR()`

**Retorna:** `{ valid: boolean; error?: string }`

**Exemplo:**

```typescript
const validation = validateImageFile(file);
if (!validation.valid) {
  console.error(validation.error);
  return;
}
```

---

## Services

### Função `fetchCnpjData()`

Busca dados de empresa pelo CNPJ na BrasilAPI.

```typescript
fetchCnpjData(cnpj: string): Promise<CnpjResponse | null>
```

**Parâmetros:**

- `cnpj: string` - CNPJ com ou sem formatação

**Retorna:** `Promise<CnpjResponse | null>`

**Exemplo:**

```typescript
const data = await fetchCnpjData('21.090.061/0001-67');
if (data) {
  console.log(data.razao_social);
  console.log(data.nome_fantasia);
}
```

### Função `fetchCepData()`

Busca dados de endereço pelo CEP na BrasilAPI.

```typescript
fetchCepData(cep: string): Promise<CepResponse | null>
```

**Parâmetros:**

- `cep: string` - CEP com ou sem formatação

**Retorna:** `Promise<CepResponse | null>`

**Exemplo:**

```typescript
const data = await fetchCepData('89201-400');
if (data) {
  console.log(data.street);
  console.log(data.neighborhood);
  console.log(data.city);
}
```

---

## Types

### `ExtractedFormData`

Dados extraídos de um formulário.

```typescript
interface ExtractedFormData {
  name?: string;
  cpf?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  addressComplement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  legalName?: string;
  fantasyName?: string;
  [key: string]: any;
}
```

### `OCRResult`

Resultado do processamento OCR.

```typescript
interface OCRResult {
  text: string;
  blocks: string[];
  confidence: number;
}
```

### `CnpjResponse`

Resposta da API BrasilAPI para CNPJ.

```typescript
interface CnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  municipio: string;
  uf: string;
  ddd_telefone_1: string;
  email?: string | null;
  qsa?: Array<{
    nome_socio?: string;
    qualificacao_socio?: string;
    email?: string | null;
    [key: string]: any;
  }>;
  [key: string]: any;
}
```

### `CepResponse`

Resposta da API BrasilAPI para CEP.

```typescript
interface CepResponse {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  complement?: string;
  location?: {
    type?: string;
    coordinates?: {
      longitude?: number;
      latitude?: number;
    };
  };
  [key: string]: any;
}
```

### `TextParserOptions`

Opções de configuração para o parser de texto.

```typescript
interface TextParserOptions {
  autoFetchCep?: boolean;
  autoFetchCnpj?: boolean;
  onCepDetected?: (cep: string) => Promise<CepResponse | null>;
  onCnpjDetected?: (cnpj: string) => Promise<CnpjResponse | null>;
  debug?: boolean;
}
```

### `OCRProcessorOptions`

Opções de configuração para o processador OCR.

```typescript
interface OCRProcessorOptions {
  language?: string;
  maxFileSize?: number;
  allowedTypes?: string[];
}
```

---

**Última Atualização**: Janeiro 2025

