import crypto from 'crypto';

const ALGORITHM = 'aes-256-ctr';
// A chave deve ter exatamente 32 bytes (256 bits) para AES-256
// Se não existir no .env, usa uma chave padrão (NUNCA USE EM PRODUÇÃO!)
const SECRET_KEY =
  process.env.SECRET_KEY || 'v0c3-pr3c1s4-d3-um4-ch4v3-s3gur4-32-chars';

// Garante que a chave tenha exatamente 32 bytes
const getSecretKey = (): Buffer => {
  if (SECRET_KEY.length < 32) {
    console.warn(
      '⚠️  SECRET_KEY muito curta! Use uma chave de pelo menos 32 caracteres.'
    );
    // Preenche com caracteres repetidos até 32
    return Buffer.from(SECRET_KEY.padEnd(32, '0').substring(0, 32));
  }
  return Buffer.from(SECRET_KEY.substring(0, 32));
};

const IV_LENGTH = 16; // 16 bytes para AES

/**
 * Criptografa um texto usando AES-256-CTR
 *
 * @param text - Texto a ser criptografado
 * @returns String no formato "iv:encrypted_text" (hex)
 *
 * @example
 * const encrypted = encrypt('minha-senha-secreta');
 * // Retorna: "a1b2c3d4e5f6...:9f8e7d6c5b4a..."
 */
export const encrypt = (text: string): string => {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);

    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Retorna IV e texto criptografado separados por ":"
    // O IV é necessário para descriptografar depois
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Erro ao criptografar:', error);
    throw new Error('Falha ao criptografar dados');
  }
};

/**
 * Descriptografa um texto criptografado com AES-256-CTR
 *
 * @param encryptedText - Texto criptografado no formato "iv:encrypted_text"
 * @returns Texto descriptografado
 *
 * @example
 * const decrypted = decrypt('a1b2c3d4e5f6...:9f8e7d6c5b4a...');
 * // Retorna: "minha-senha-secreta"
 */
export const decrypt = (encryptedText: string): string => {
  try {
    const textParts = encryptedText.split(':');

    if (textParts.length !== 2) {
      throw new Error('Formato de texto criptografado inválido');
    }

    const iv = Buffer.from(textParts[0]!, 'hex');
    const encryptedData = Buffer.from(textParts[1]!, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), iv);

    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Erro ao descriptografar:', error);
    throw new Error('Falha ao descriptografar dados');
  }
};

/**
 * Gera uma chave secreta aleatória para uso no .env
 *
 * @returns String hexadecimal de 64 caracteres (32 bytes)
 */
export const generateSecretKey = (): string => {
  return crypto.randomBytes(32).toString('hex');
};


























