// Serviços para consulta na API Brasil
// Documentação: https://brasilapi.com.br/docs

interface CNPJResponse {
  cnpj: string;
  identificador_matriz_filial: number;
  descricao_matriz_filial: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao_cadastral: number;
  descricao_situacao_cadastral: string;
  data_situacao_cadastral: string;
  motivo_situacao_cadastral: number | null;
  nome_cidade_exterior: string | null;
  codigo_natureza_juridica: number;
  data_inicio_atividade: string;
  cnae_fiscal_principal: {
    codigo: number;
    descricao: string;
  };
  cnae_fiscal_secundaria: Array<{
    codigo: number;
    descricao: string;
  }>;
  descricao_tipo_logradouro: string;
  // logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cep: string;
  uf: string;
  codigo_municipio: number;
  municipio: string;
  ddd_telefone_1: string | null;
  ddd_telefone_2: string | null;
  ddd_fax: string | null;
  qualificacao_do_responsavel: number | null;
  capital_social: number;
  porte: string;
  descricao_porte: string;
  opcao_pelo_simples: boolean | null;
  data_opcao_pelo_simples: string | null;
  data_exclusao_do_simples: string | null;
  opcao_pelo_mei: boolean | null;
  situacao_especial: string | null;
  data_situacao_especial: string | null;
  qsa: Array<{
    identificador_de_socio: number;
    nome_socio: string;
    cnpj_cpf_do_socio: string;
    codigo_qualificacao_socio: number;
    percentual_capital_social: number;
    data_entrada_sociedade: string;
    cpf_representante_legal: string | null;
    nome_representante_legal: string | null;
    codigo_qualificacao_representante_legal: number | null;
  }>;
}

interface CEPResponse {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  service: string;
  location?: {
    type: string;
    coordinates: {
      longitude: string;
      latitude: string;
    };
  };
}

/**
 * Consulta CNPJ na API Brasil
 * @param cnpj CNPJ sem formatação (apenas números)
 * @returns Dados da empresa ou null em caso de erro
 */
export async function consultarCNPJ(
  cnpj: string
): Promise<CNPJResponse | null> {
  try {
    // Remove formatação do CNPJ
    const cnpjLimpo = cnpj.replace(/\D/g, '');

    if (cnpjLimpo.length !== 14) {
      throw new Error('CNPJ deve ter 14 dígitos');
    }

    const response = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('CNPJ não encontrado');
      }
      throw new Error(`Erro ao consultar CNPJ: ${response.statusText}`);
    }

    const data = await response.json();
    return data as CNPJResponse;
  } catch (error: any) {
    console.error('Erro ao consultar CNPJ:', error);
    throw error;
  }
}

/**
 * Consulta CEP na API Brasil
 * @param cep CEP sem formatação (apenas números) ou com formatação
 * @returns Dados do endereço ou null em caso de erro
 */
export async function consultarCEP(cep: string): Promise<CEPResponse | null> {
  try {
    // Remove formatação do CEP
    const cepLimpo = cep.replace(/\D/g, '');

    if (cepLimpo.length !== 8) {
      throw new Error('CEP deve ter 8 dígitos');
    }

    const response = await fetch(
      `https://brasilapi.com.br/api/cep/v1/${cepLimpo}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('CEP não encontrado');
      }
      throw new Error(`Erro ao consultar CEP: ${response.statusText}`);
    }

    const data = await response.json();
    return data as CEPResponse;
  } catch (error: any) {
    console.error('Erro ao consultar CEP:', error);
    throw error;
  }
}



















