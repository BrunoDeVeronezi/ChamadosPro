import * as fs from 'fs';
import * as path from 'path';

const ENV_FILE_PATH = path.join(process.cwd(), '.env');

/**
 * Lê o conteúdo do arquivo .env
 */
export function readEnvFile(): string {
  try {
    if (fs.existsSync(ENV_FILE_PATH)) {
      return fs.readFileSync(ENV_FILE_PATH, 'utf-8');
    }
    return '';
  } catch (error: any) {
    console.error('[EnvManager] Erro ao ler arquivo .env:', error);
    throw new Error(`Erro ao ler arquivo .env: ${error.message}`);
  }
}

/**
 * Escreve conteúdo no arquivo .env
 */
export function writeEnvFile(content: string): void {
  try {
    fs.writeFileSync(ENV_FILE_PATH, content, 'utf-8');
    console.log('[EnvManager] Arquivo .env atualizado com sucesso');
  } catch (error: any) {
    console.error('[EnvManager] Erro ao escrever arquivo .env:', error);
    throw new Error(`Erro ao escrever arquivo .env: ${error.message}`);
  }
}

/**
 * Mapeamento de serviços para variáveis de ambiente
 */
const SERVICE_ENV_MAP: Record<string, string> = {
  Asaas: 'ASAAS_API_KEY',
  'Google OAuth': 'GOOGLE_CLIENT_ID',
  'Google OAuth Secret': 'GOOGLE_CLIENT_SECRET',
  BrasilAPI: 'BRASIL_API_KEY',
  Stripe: 'STRIPE_SECRET_KEY',
  'Stripe Public': 'STRIPE_PUBLIC_KEY',
  Apibrasil: 'APIBRASIL_TOKEN',
};

/**
 * Normaliza o nome do serviço para o formato usado no mapeamento
 */
function normalizeServiceName(service: string): string {
  // Remover espaços extras e capitalizar primeira letra de cada palavra
  return service
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Atualiza ou adiciona uma variável de ambiente no arquivo .env
 */
export function updateEnvVariable(service: string, value: string): void {
  const normalizedService = normalizeServiceName(service);
  const envVarName = SERVICE_ENV_MAP[normalizedService];

  if (!envVarName) {
    throw new Error(
      `Serviço "${service}" não possui mapeamento de variável de ambiente. Serviços disponíveis: ${Object.keys(
        SERVICE_ENV_MAP
      ).join(', ')}`
    );
  }

  let envContent = readEnvFile();
  const lines = envContent.split('\n');

  // Procurar se a variável já existe
  let found = false;
  const updatedLines = lines.map((line) => {
    const trimmedLine = line.trim();
    // Verificar se a linha começa com a variável (ignorando comentários)
    if (
      trimmedLine.startsWith(`${envVarName}=`) &&
      !trimmedLine.startsWith('#')
    ) {
      found = true;
      return `${envVarName}=${value}`;
    }
    return line;
  });

  // Se não encontrou, adicionar no final
  if (!found) {
    // Adicionar linha em branco se o arquivo não terminar com uma
    if (envContent && !envContent.endsWith('\n')) {
      updatedLines.push('');
    }
    updatedLines.push(`${envVarName}=${value}`);
  }

  const newContent = updatedLines.join('\n');
  writeEnvFile(newContent);
}

/**
 * Remove uma variável de ambiente do arquivo .env (comenta a linha)
 */
export function revokeEnvVariable(service: string): void {
  const normalizedService = normalizeServiceName(service);
  const envVarName = SERVICE_ENV_MAP[normalizedService];

  if (!envVarName) {
    throw new Error(
      `Serviço "${service}" não possui mapeamento de variável de ambiente. Serviços disponíveis: ${Object.keys(
        SERVICE_ENV_MAP
      ).join(', ')}`
    );
  }

  let envContent = readEnvFile();
  const lines = envContent.split('\n');

  const updatedLines = lines.map((line) => {
    const trimmedLine = line.trim();
    // Comentar a linha se ela contém a variável
    if (
      trimmedLine.startsWith(`${envVarName}=`) &&
      !trimmedLine.startsWith('#')
    ) {
      return `# ${line} # Revogado em ${new Date().toISOString()}`;
    }
    return line;
  });

  const newContent = updatedLines.join('\n');
  writeEnvFile(newContent);
}

/**
 * Obtém o valor de uma variável de ambiente do arquivo .env
 */
export function getEnvVariable(service: string): string | null {
  const normalizedService = normalizeServiceName(service);
  const envVarName = SERVICE_ENV_MAP[normalizedService];

  if (!envVarName) {
    return null;
  }

  const envContent = readEnvFile();
  const lines = envContent.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (
      trimmedLine.startsWith(`${envVarName}=`) &&
      !trimmedLine.startsWith('#')
    ) {
      const value = trimmedLine.substring(envVarName.length + 1);
      return value;
    }
  }

  return null;
}
