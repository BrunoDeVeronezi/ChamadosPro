/**
 * Módulo de Preenchimento Automático de Formulários
 * 
 * API reutilizável para extração de dados de formulários a partir de:
 * - Texto colado (com sistema de scoring inteligente)
 * - Imagens (OCR com Tesseract.js)
 * - APIs externas (BrasilAPI - CNPJ e CEP)
 */

// Services
export { fetchCnpjData, fetchCepData } from './services';
export type { CnpjResponse, CepResponse } from './services';

// Processors
export { processImageOCR, validateImageFile } from './processors';
export type { OCRResult, OCRProcessorOptions } from './processors';

// Parsers
export { TextParser } from './parsers';
export type { ExtractedFormData, TextParserOptions } from './parsers';

// Types
export type {
  ExtractedFormData,
  OCRResult,
  CnpjResponse,
  CepResponse,
  TextParserOptions,
  OCRProcessorOptions,
} from './types';





























