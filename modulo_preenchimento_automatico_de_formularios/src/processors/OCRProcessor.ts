/**
 * Processador de Imagens para OCR
 * 
 * Esta função processa uma imagem usando Tesseract.js (OCR offline)
 * e retorna o texto extraído em blocos.
 */

import { createWorker } from 'tesseract.js';
import { OCRResult, OCRProcessorOptions } from '../types';

/**
 * Processa uma imagem e extrai texto usando OCR
 * 
 * @param imageFile - Arquivo de imagem (File ou Blob)
 * @param options - Opções de configuração
 * @returns Promise com o texto extraído e blocos
 * 
 * @example
 * ```typescript
 * const file = event.target.files[0];
 * const result = await processImageOCR(file);
 * console.log(result.text); // Texto completo
 * console.log(result.blocks); // Array de blocos de texto
 * ```
 */
export async function processImageOCR(
  imageFile: File | Blob,
  options: OCRProcessorOptions = {}
): Promise<OCRResult> {
  const {
    language = 'por',
  } = options;

  const worker = await createWorker(language);
  
  try {
    // Processa a imagem
    const { data } = await worker.recognize(imageFile);
    
    // Extrai blocos de texto
    const blocks = data.blocks
      .map(block => block.text.trim())
      .filter(text => text.length > 0);
    
    return {
      text: data.text,
      blocks,
      confidence: data.confidence || 0,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Valida se o arquivo é uma imagem válida
 */
export function validateImageFile(
  file: File,
  options: OCRProcessorOptions = {}
): { valid: boolean; error?: string } {
  const {
    maxFileSize = 10 * 1024 * 1024, // 10MB
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  } = options;

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Formato de imagem inválido. Use JPEG, PNG ou WebP.',
    };
  }

  if (file.size > maxFileSize) {
    return {
      valid: false,
      error: `Imagem muito grande. Tamanho máximo: ${maxFileSize / 1024 / 1024}MB.`,
    };
  }

  return { valid: true };
}





























