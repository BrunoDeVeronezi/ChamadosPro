interface CpfResponse {
  name?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  motherName?: string;
  nationality?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  [key: string]: any; // Para outros campos que possam vir
}

/**
 * Consulta dados de CPF através da API do backend
 * O backend faz a chamada à API externa para proteger a chave de API
 */
export const fetchCpfData = async (
  cpf: string
): Promise<CpfResponse | null> => {
  const cleanCpf = cpf.replace(/\D/g, '');
  if (cleanCpf.length !== 11) {
    console.error('[CpfService] ❌ CPF inválido - tamanho incorreto:', cleanCpf.length);
    return null;
  }

  console.log('[CpfService] 🔍 Consultando CPF:', cleanCpf);

  try {
    const response = await fetch(`/api/cpf/${cleanCpf}`, {
      credentials: 'include',
    });
    
    console.log('[CpfService] 📡 Resposta do backend:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CpfService] ❌ Erro na resposta:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });

      if (response.status === 404) {
        // CPF não encontrado - não é erro crítico
        console.log('[CpfService] ⚠️ CPF não encontrado na API');
        return null;
      }

      if (response.status === 503) {
        // Serviço não configurado
        console.warn('[CpfService] ⚠️ Serviço de CPF não configurado');
        return null;
      }

      throw new Error(`Erro ao consultar CPF: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('[CpfService] ✅ Dados recebidos:', JSON.stringify(data, null, 2));
    return data;
  } catch (error: any) {
    console.error('[CpfService] ❌ Erro ao buscar CPF:', {
      message: error.message,
      stack: error.stack,
    });
    return null;
  }
};

