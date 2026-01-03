/**
 * Tipos TypeScript compartilhados para o módulo de preenchimento automático
 */

/**
 * Dados extraídos de um formulário
 */
export interface ExtractedFormData {
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
  [key: string]: any; // Permite campos adicionais
}

/**
 * Resultado do processamento OCR
 */
export interface OCRResult {
  text: string;
  blocks: string[];
  confidence: number;
}

/**
 * Resposta da API BrasilAPI para CNPJ
 */
export interface CnpjResponse {
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
  telefone_1?: string;
  email?: string | null;
  qsa?: Array<{
    nome_socio?: string;
    qualificacao_socio?: string;
    email?: string | null;
    [key: string]: any;
  }>;
  [key: string]: any;
}

/**
 * Resposta da API BrasilAPI para CEP
 */
export interface CepResponse {
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

/**
 * Opções de configuração para o parser de texto
 */
export interface TextParserOptions {
  /**
   * Se deve fazer consulta automática de CEP quando detectado
   * @default true
   */
  autoFetchCep?: boolean;

  /**
   * Se deve fazer consulta automática de CNPJ quando detectado
   * @default true
   */
  autoFetchCnpj?: boolean;

  /**
   * Callback chamado quando CEP é detectado e precisa ser consultado
   */
  onCepDetected?: (cep: string) => Promise<CepResponse | null>;

  /**
   * Callback chamado quando CNPJ é detectado e precisa ser consultado
   */
  onCnpjDetected?: (cnpj: string) => Promise<CnpjResponse | null>;

  /**
   * Se deve incluir logs de debug
   * @default false
   */
  debug?: boolean;
}

/**
 * Opções de configuração para o processador OCR
 */
export interface OCRProcessorOptions {
  /**
   * Idioma para OCR
   * @default 'por'
   */
  language?: string;

  /**
   * Tamanho máximo do arquivo em bytes
   * @default 10 * 1024 * 1024 (10MB)
   */
  maxFileSize?: number;

  /**
   * Tipos de arquivo permitidos
   * @default ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
   */
  allowedTypes?: string[];
}





























