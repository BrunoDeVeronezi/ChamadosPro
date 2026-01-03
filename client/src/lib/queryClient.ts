import { QueryClient, QueryFunction } from '@tanstack/react-query';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(
  /\/+$/,
  ''
);

const buildApiUrl = (url: string) => {
  if (!API_BASE_URL) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
};

type ApiRequestOptions = {
  allowStatuses?: number[];
};

async function throwIfResNotOk(
  res: Response,
  options?: ApiRequestOptions
) {
  const allowedStatuses = options?.allowStatuses;
  const isAllowed =
    Array.isArray(allowedStatuses) && allowedStatuses.includes(res.status);

  if (!res.ok && !isAllowed) {
    // Clonar a resposta para poder ler o texto sem consumir a resposta original
    const clonedRes = res.clone();
    const text = (await clonedRes.text()) || res.statusText;

    // Tentar fazer parse como JSON se possível
    let errorMessage = text;
    try {
      const jsonError = JSON.parse(text);
      if (jsonError.message) {
        errorMessage = jsonError.message;
      }
    } catch {
      // Se não for JSON, verificar se é HTML
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        errorMessage = `Erro ${res.status}: O servidor retornou uma página HTML. Verifique se o endpoint existe e se o servidor está rodando corretamente.`;
      }
    }

    throw new Error(`${res.status}: ${errorMessage}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data: unknown | undefined,
  options?: ApiRequestOptions
): Promise<Response> {
  const res = await fetch(buildApiUrl(url), {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include',
  });

  await throwIfResNotOk(res, options);
  return res;
}

type UnauthorizedBehavior = 'returnNull' | 'throw';
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Construir URL corretamente: se tiver período, usar como query param
    let url = queryKey[0] as string;
    if (queryKey.length > 1 && queryKey[1]) {
      const period = queryKey[1];
      // Se a URL já tiver query params, usar &, senão usar ?
      url = `${url}${url.includes('?') ? '&' : '?'}period=${period}`;
    }

    const res = await fetch(buildApiUrl(url), {
      credentials: 'include',
    });

    if (unauthorizedBehavior === 'returnNull' && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();

    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false, // âœ  // CORREÃ‡ÃƒO: Não refazer ao montar (evita loops)
      refetchOnReconnect: false, // âœ  // CORREÃ‡ÃƒO: Não refazer ao reconectar
      staleTime: 5 * 60 * 1000, // âœ  // CORREÃ‡ÃƒO: 5 minutos (ao invés de Infinity)
      gcTime: 10 * 60 * 1000, // âœ  // ADICIONAR: Manter em cache por 10 minutos
      retry: false,
      // Suprimir logs de erro no console
      onError: () => {
        // Silenciar erros de query
      },
    },
    mutations: {
      retry: false,
      // Suprimir logs de erro no console
      onError: () => {
        // Silenciar erros de mutation
      },
    },
  },
  // Logger silencioso para suprimir logs de erro
  logger: {
    log: () => {},
    warn: () => {},
    error: () => {},
  },
});

const ticketQueryPrefixes = ['/api/tickets', '/api/dashboard', '/api/financial'];

export async function invalidateTicketDependentQueries() {
  const predicate = (query: { queryKey?: unknown[] }) => {
    const key = query.queryKey?.[0];
    return (
      typeof key === 'string' &&
      ticketQueryPrefixes.some((prefix) => key.startsWith(prefix))
    );
  };

  await queryClient.invalidateQueries({
    predicate,
    refetchType: 'active',
  });

  queryClient.removeQueries({
    predicate,
    type: 'inactive',
  });
}
