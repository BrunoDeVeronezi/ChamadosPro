/**
 * OCR Image Processor - Processador de Imagens para OCR
 * 
 * Esta função processa uma imagem usando Tesseract.js (OCR offline)
 * e retorna o texto extraído em blocos.
 * 
 * @see OCRParser.ts - Parser que processa o texto extraído
 */

import { createWorker } from 'tesseract.js';

export interface OCRResult {
  text: string;
  blocks: string[];
  confidence: number;
}

/**
 * Processa uma imagem e extrai texto usando OCR
 * 
 * @param imageFile - Arquivo de imagem (File ou Blob)
 * @param language - Idioma para OCR (padrão: 'por' para português)
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
  language: string = 'por'
): Promise<OCRResult> {
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
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Formato de imagem inválido. Use JPEG, PNG ou WebP.',
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Imagem muito grande. Tamanho máximo: 10MB.',
    };
  }

  return { valid: true };
}
































