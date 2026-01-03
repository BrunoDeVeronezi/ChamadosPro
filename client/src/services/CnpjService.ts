/**
 * Serviço para buscar dados de empresa pelo CNPJ usando a BrasilAPI
 * https://brasilapi.com.br/api/cnpj/v1/{cnpj}
 */

export interface CnpjResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  cep: string;
  // logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  ddd_telefone_1: string;
  // Campos opcionais que podem vir na resposta
  telefone_1?: string;
  email?: string | null;
  complemento?: string;
  qsa?: Array<{
    nome_socio?: string;
    qualificacao_socio?: string;
    email?: string | null;
    [key: string]: any;
  }>;
  [key: string]: any; // Para outros campos que possam vir
}

/**
 * Busca dados de empresa pelo CNPJ na BrasilAPI
 * @param cnpj - CNPJ com ou sem formatação (apenas números serão usados)
 * @returns Dados da empresa ou null se não encontrado/erro
 */
export const fetchCnpjData = async (
  cnpj: string
): Promise<CnpjResponse | null> => {
  // Remove caracteres não numéricos
  const cleanCnpj = cnpj.replace(/\D/g, '');

  // Valida se tem 14 dígitos
  if (cleanCnpj.length !== 14) {
    return null;
  }

  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`
    );

    // Se não encontrou (404) ou outro erro
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      // Outros erros HTTP
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    return data as CnpjResponse;
  } catch (error) {
    console.error('Erro ao buscar CNPJ:', error);
    return null;
  }
};