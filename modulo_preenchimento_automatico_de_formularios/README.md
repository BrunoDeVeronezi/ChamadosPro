# Módulo de Preenchimento Automático de Formulários

API reutilizável para extração de dados de formulários a partir de texto, imagens (OCR) e APIs externas.

## 📋 Índice

- [Instalação](#instalação)
- [Funcionalidades](#funcionalidades)
- [Uso Básico](#uso-básico)
- [API Reference](#api-reference)
- [Exemplos](#exemplos)
- [Documentação Técnica](#documentação-técnica)

## 🚀 Instalação

### Instalar dependências

```bash
npm install tesseract.js
```

### Copiar módulo para seu projeto

Copie a pasta `modulo_preenchimento_automatico_de_formularios` para seu projeto e importe:

```typescript
import {
  TextParser,
  processImageOCR,
  fetchCnpjData,
  fetchCepData,
} from './modulo_preenchimento_automatico_de_formularios/src';
```

## ✨ Funcionalidades

### 1. **Parsing de Texto Inteligente**

- Sistema de scoring para detecção de campos
- Detecção multi-camadas (label → scoring → regex)
- Suporte para: Nome, CPF/CNPJ, Email, Telefone, CEP, Endereço completo

### 2. **Processamento OCR**

- Extração de texto de imagens usando Tesseract.js
- 100% offline (processamento no navegador)
- Suporte para: JPEG, PNG, WebP

### 3. **Integração com APIs Externas**

- **BrasilAPI - CNPJ**: Consulta automática de dados de empresas
- **BrasilAPI - CEP**: Consulta automática de dados de endereço

## 📖 Uso Básico

### Parsing de Texto

```typescript
import { TextParser } from './modulo_preenchimento_automatico_de_formularios/src';

const parser = new TextParser({
  autoFetchCep: true, // Consulta CEP automaticamente
  autoFetchCnpj: true, // Consulta CNPJ automaticamente
  debug: false, // Logs de debug
});

const text = `
Ariane kotekewis Tavares

Cliente
Dados de contato
E-mail: akotekewis@gmail.com
Telefone: (51) 99135-9898

Informações fiscais
CPF: 004.899.110-48

Endereço
CEP: 91260-000
Rua / Logradouro: Avenida Protásio Alves
Número: 8201
Complemento: Torre 5 Apto 810
Bairro / Distrito: Morro Santana
UF / Estado: RS
Cidade: Porto Alegre
`;

const result = await parser.parse(text);

console.log(result);
// {
//   name: "Ariane kotekewis Tavares",
//   email: "akotekewis@gmail.com",
//   phone: "51991359898",
//   cpf: "004.899.110-48",
//   cep: "91260-000",
//   address: "Avenida Protásio Alves",
//   addressNumber: "8201",
//   addressComplement: "Torre 5 Apto 810",
//   neighborhood: "Morro Santana",
//   city: "Porto Alegre",
//   state: "RS"
// }
```

### Processamento OCR

```typescript
import {
  processImageOCR,
  validateImageFile,
} from './modulo_preenchimento_automatico_de_formularios/src';

// Validar arquivo
const file = event.target.files[0];
const validation = validateImageFile(file);
if (!validation.valid) {
  console.error(validation.error);
  return;
}

// Processar imagem
const ocrResult = await processImageOCR(file, {
  language: 'por', // Português
});

console.log(ocrResult.text); // Texto completo
console.log(ocrResult.blocks); // Array de blocos
console.log(ocrResult.confidence); // Confiança (0-100)

// Usar com TextParser
const parser = new TextParser();
const extractedData = await parser.parse(ocrResult.text);
```

### Consulta de CNPJ

```typescript
import { fetchCnpjData } from './modulo_preenchimento_automatico_de_formularios/src';

const cnpj = '21.090.061/0001-67';
const data = await fetchCnpjData(cnpj);

if (data) {
  console.log(data.razao_social); // Razão Social
  console.log(data.nome_fantasia); // Nome Fantasia
  console.log(data.cep); // CEP
  console.log(data.logradouro); // Endereço
  console.log(data.bairro); // Bairro
  console.log(data.municipio); // Cidade
  console.log(data.uf); // Estado
  console.log(data.email); // Email (se disponível)
}
```

### Consulta de CEP

```typescript
import { fetchCepData } from './modulo_preenchimento_automatico_de_formularios/src';

const cep = '89201-400';
const data = await fetchCepData(cep);

if (data) {
  console.log(data.street); // Rua
  console.log(data.neighborhood); // Bairro
  console.log(data.city); // Cidade
  console.log(data.state); // Estado
  console.log(data.complement); // Complemento (se disponível)
}
```

## 📚 API Reference

### `TextParser`

Classe principal para parsing de texto.

#### Construtor

```typescript
new TextParser(options?: TextParserOptions)
```

**Opções:**

- `autoFetchCep?: boolean` - Consulta CEP automaticamente (padrão: `true`)
- `autoFetchCnpj?: boolean` - Consulta CNPJ automaticamente (padrão: `true`)
- `onCepDetected?: (cep: string) => Promise<CepResponse | null>` - Callback customizado para CEP
- `onCnpjDetected?: (cnpj: string) => Promise<CnpjResponse | null>` - Callback customizado para CNPJ
- `debug?: boolean` - Ativa logs de debug (padrão: `false`)

#### Método `parse()`

```typescript
parse(text: string): Promise<ExtractedFormData>
```

Extrai dados estruturados do texto.

**Retorna:** `Promise<ExtractedFormData>`

### `processImageOCR()`

Processa uma imagem e extrai texto usando OCR.

```typescript
processImageOCR(
  imageFile: File | Blob,
  options?: OCRProcessorOptions
): Promise<OCRResult>
```

**Opções:**

- `language?: string` - Idioma para OCR (padrão: `'por'`)
- `maxFileSize?: number` - Tamanho máximo em bytes (padrão: `10MB`)
- `allowedTypes?: string[]` - Tipos permitidos (padrão: `['image/jpeg', 'image/jpg', 'image/png', 'image/webp']`)

### `validateImageFile()`

Valida se o arquivo é uma imagem válida.

```typescript
validateImageFile(
  file: File,
  options?: OCRProcessorOptions
): { valid: boolean; error?: string }
```

### `fetchCnpjData()`

Busca dados de empresa pelo CNPJ.

```typescript
fetchCnpjData(cnpj: string): Promise<CnpjResponse | null>
```

### `fetchCepData()`

Busca dados de endereço pelo CEP.

```typescript
fetchCepData(cep: string): Promise<CepResponse | null>
```

## 💡 Exemplos

### Exemplo Completo: Formulário React

```typescript
import { useState } from 'react';
import {
  TextParser,
  processImageOCR,
} from './modulo_preenchimento_automatico_de_formularios/src';

function ClientForm() {
  const [formData, setFormData] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const parser = new TextParser({ autoFetchCep: true, autoFetchCnpj: true });

  // Processar texto colado
  const handleTextPaste = async (text: string) => {
    setIsProcessing(true);
    try {
      const extracted = await parser.parse(text);
      setFormData((prev) => ({ ...prev, ...extracted }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Processar imagem
  const handleImageUpload = async (file: File) => {
    setIsProcessing(true);
    try {
      const ocrResult = await processImageOCR(file);
      const extracted = await parser.parse(ocrResult.text);
      setFormData((prev) => ({ ...prev, ...extracted }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form>
      <textarea
        placeholder='Cole o texto aqui'
        onChange={(e) => handleTextPaste(e.target.value)}
      />
      <input
        type='file'
        accept='image/*'
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file);
        }}
      />
      {/* Campos do formulário */}
    </form>
  );
}
```

### Exemplo: Callbacks Customizados

```typescript
import { TextParser } from './modulo_preenchimento_automatico_de_formularios/src';

const parser = new TextParser({
  autoFetchCep: true,
  autoFetchCnpj: true,
  // Callback customizado para CEP
  onCepDetected: async (cep) => {
    // Sua lógica customizada aqui
    const response = await fetch(`https://sua-api.com/cep/${cep}`);
    return await response.json();
  },
  // Callback customizado para CNPJ
  onCnpjDetected: async (cnpj) => {
    // Sua lógica customizada aqui
    const response = await fetch(`https://sua-api.com/cnpj/${cnpj}`);
    return await response.json();
  },
});
```

## 🔧 Campos Extraídos

O `TextParser` extrai os seguintes campos:

| Campo               | Tipo      | Descrição                                    | Prioridade de Preenchimento                                        |
| ------------------- | --------- | -------------------------------------------- | ------------------------------------------------------------------ |
| `name`              | `string?` | Nome completo / Nome Fantasia / Razão Social | 1. Nome Fantasia<br>2. Nome (detecção genérica)<br>3. Razão Social |
| `fantasyName`       | `string?` | Nome Fantasia (detectado do texto ou CNPJ)   | Detectado do texto ou API CNPJ                                     |
| `legalName`         | `string?` | Razão Social (detectado do texto ou CNPJ)    | Detectado do texto ou API CNPJ                                     |
| `cpf`               | `string?` | CPF formatado                                | Regex no texto                                                     |
| `cnpj`              | `string?` | CNPJ formatado                               | Regex no texto                                                     |
| `email`             | `string?` | Email                                        | Regex no texto ou API CNPJ (incluindo QSA)                         |
| `phone`             | `string?` | Telefone                                     | Regex no texto ou API CNPJ                                         |
| `cep`               | `string?` | CEP formatado                                | Label "CEP:" ou regex                                              |
| `address`           | `string?` | Rua/Logradouro                               | Label "Rua / Logradouro" ou regex ou API CEP/CNPJ                  |
| `addressNumber`     | `string?` | Número do endereço                           | Label "Número:" ou regex ou API CNPJ                               |
| `addressComplement` | `string?` | Complemento                                  | Label "Complemento:" ou regex ou API CNPJ/CEP                      |
| `neighborhood`      | `string?` | Bairro                                       | Label "Bairro / Distrito:" ou regex ou API CEP/CNPJ                |
| `city`              | `string?` | Cidade                                       | Label "Cidade:" ou regex ou API CEP/CNPJ                           |
| `state`             | `string?` | Estado (UF)                                  | Label "UF / Estado:" ou regex ou API CEP/CNPJ                      |

### Detecção de Nome Fantasia e Razão Social

O parser agora detecta especificamente:

- **Nome Fantasia**: Quando encontra o label "Nome fantasia" seguido do valor
- **Razão Social**: Quando encontra o label "Razão social" seguido do valor

Ambos usam sistema de detecção em duas camadas:

1. **PRIORIDADE 0**: Detecção direta por label (mais confiável)
2. **PRIORIDADE 1**: Fallback com regex patterns

O campo `name` é preenchido com a seguinte prioridade:

1. Nome Fantasia (se detectado)
2. Nome genérico (detecção por scoring)
3. Razão Social (se não houver nome fantasia)

## 🎯 Sistema de Scoring

O parser utiliza um sistema de scoring inteligente para detectar campos:

1. **PRIORIDADE 0**: Detecção direta por label (mais confiável)
2. **PRIORIDADE 1**: Sistema de scoring contextual
3. **PRIORIDADE 2**: Fallback com regex patterns

### Exemplo de Scoring para Nome

- **Bonus**: Múltiplas palavras, palavras com maiúscula, estar no início do texto
- **Penalidades**: Conter termos de endereço, números significativos, emails, telefones

## 📝 Notas Importantes

1. **Tesseract.js**: Requer instalação separada (`npm install tesseract.js`)
2. **APIs Externas**: BrasilAPI é pública e gratuita, mas pode ter rate limits
3. **Performance**: OCR pode ser lento em dispositivos móveis
4. **Precisão**: Depende da qualidade do texto/imagem de entrada

## 🐛 Troubleshooting

### OCR não funciona

- Verifique se `tesseract.js` está instalado
- Verifique se o arquivo é uma imagem válida
- Tente com uma imagem de melhor qualidade

### Campos não são detectados

- Ative `debug: true` para ver logs detalhados
- Verifique se o texto está bem formatado
- Alguns campos podem precisar de labels específicos

### API retorna null

- Verifique se o CNPJ/CEP está correto
- Verifique sua conexão com a internet
- BrasilAPI pode estar temporariamente indisponível

## 📄 Licença

MIT

## 🔗 Referências

- **Tesseract.js**: https://tesseract.projectnaptha.com/
- **BrasilAPI**: https://brasilapi.com.br/
- **Documentação Completa**: Ver `MANUAL_IMPLEMENTACAO_AUTO_PREENCHIMENTO.md`

---

**Versão**: 2.0.0  
**Última Atualização**: Janeiro 2025

### Changelog v2.0.0

- ✅ Adicionada detecção específica de **Nome Fantasia**
- ✅ Adicionada detecção específica de **Razão Social**
- ✅ Melhorada lógica de preenchimento do campo `name` (prioriza Nome Fantasia)
- ✅ Suporte para busca de email no quadro de sócios (QSA) da API CNPJ
- ✅ Suporte para complemento na API CEP
- ✅ Sistema de scoring aprimorado para detecção de nomes próprios
