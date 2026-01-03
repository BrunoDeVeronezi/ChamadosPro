import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface NgrokInfo {
  url: string;
  port: number;
  startedAt: string;
}

/**
 * Obtém a URL do tunnel (Ngrok ou Cloudflare) se estiver ativo
 */
export function getNgrokUrl(): string | null {
  // 1. Verificar variável de ambiente (prioridade: CLOUDFLARE_URL > NGROK_URL)
  if (process.env.CLOUDFLARE_URL) {
    return process.env.CLOUDFLARE_URL;
  }
  if (process.env.NGROK_URL) {
    return process.env.NGROK_URL;
  }

  // 2. Verificar arquivo .tunnel.json (Cloudflare)
  const tunnelFile = join(process.cwd(), '.tunnel.json');
  if (existsSync(tunnelFile)) {
    try {
      const content = readFileSync(tunnelFile, 'utf-8');
      const info: NgrokInfo = JSON.parse(content);
      return info.url;
    } catch (error) {
      console.warn('Erro ao ler .tunnel.json:', error);
    }
  }

  // 3. Verificar arquivo .ngrok.json (Ngrok)
  const ngrokFile = join(process.cwd(), '.ngrok.json');
  if (existsSync(ngrokFile)) {
    try {
      const content = readFileSync(ngrokFile, 'utf-8');
      const info: NgrokInfo = JSON.parse(content);
      return info.url;
    } catch (error) {
      console.warn('Erro ao ler .ngrok.json:', error);
    }
  }

  return null;
}

/**
 * Obtém a URL de callback do Google OAuth
 * Prioriza Ngrok se disponível, senão usa localhost
 */
export function getGoogleRedirectUri(): string {
  const ngrokUrl = getNgrokUrl();
  
  if (ngrokUrl) {
    return `${ngrokUrl}/api/callback`;
  }

  // Fallback para localhost
  const port = process.env.PORT || '5180';
  const protocol = process.env.PROTOCOL || 'http';
  return process.env.GOOGLE_REDIRECT_URI || `${protocol}://localhost:${port}/api/callback`;
}

/**
 * Obtém a URL base da aplicação
 */
export function getBaseUrl(): string {
  const ngrokUrl = getNgrokUrl();
  
  if (ngrokUrl) {
    return ngrokUrl;
  }

  const port = process.env.PORT || '5180';
  const protocol = process.env.PROTOCOL || 'http';
  return process.env.BASE_URL || `${protocol}://localhost:${port}`;
}

/**
 * Verifica se o Ngrok está ativo
 */
export function isNgrokActive(): boolean {
  return getNgrokUrl() !== null;
}

