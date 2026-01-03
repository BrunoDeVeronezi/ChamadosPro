interface CepResponse {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  complement?: string;
  location?: {
    type?: string;
    coordinates?: {
      longitude?: number;
      latitude?: number;
    };
  };
  [key: string]: any; // Para outros campos que possam vir
}

export const fetchCepData = async (
  cep: string
): Promise<CepResponse | null> => {
  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length !== 8) return null;

  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/cep/v2/${cleanCep}`
    );
    if (!response.ok) {
      throw new Error(`Erro ao consultar CEP: ${response.status}`);
    }
    const data = await response.json();
    return {
      cep: data.cep,
      state: data.state,
      city: data.city,
      neighborhood: data.neighborhood,
      street: data.street,
      complement: data.complement || data.complemento || null,
    };
  } catch (error) {
    console.error('Erro ao buscar CEP na BrasilAPI:', error);
    return null;
  }
};
