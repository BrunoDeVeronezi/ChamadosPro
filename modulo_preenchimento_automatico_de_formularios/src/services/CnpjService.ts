/**
 * Serviço para buscar dados de empresa pelo CNPJ usando a BrasilAPI
 * https://brasilapi.com.br/api/cnpj/v1/{cnpj}
 */

import { CnpjResponse } from '../types';

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





























