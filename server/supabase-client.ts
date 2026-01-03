/**
 * Cliente Supabase usando API REST
 *
 * Usa @supabase/supabase-js para todas as operações, evitando problemas de DNS
 * com conexão direta PostgreSQL.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carrega variáveis de .env.local (preferido em dev)
dotenv.config({ path: '.env.local', override: true });

if (!process.env.SUPABASE_URL) {
  throw new Error(
    'SUPABASE_URL não configurado! Configure a variável SUPABASE_URL no arquivo .env'
  );
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY não configurado! Configure a variável SUPABASE_SERVICE_ROLE_KEY no arquivo .env'
  );
}

// Usar SERVICE_ROLE_KEY para bypass de RLS (já que desativamos RLS)
// Tenant Isolation é feito na camada de aplicação
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public', // Especificar schema para melhor performance
    },
    global: {
      headers: {
        'x-client-info': 'chamadospro-server',
      },
      // Configurar fetch customizado com timeout
      // Isso garante que requests HTTP não fiquem esperando muito tempo
      fetch: async (url, options = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return response;
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            throw new Error(`Request timeout após 8 segundos: ${url}`);
          }
          throw error;
        }
      },
    },
  }
);
