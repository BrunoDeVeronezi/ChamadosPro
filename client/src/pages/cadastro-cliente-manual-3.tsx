import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { fetchCepData } from '@/services/CepService';
import { fetchCnpjData } from '@/services/CnpjService';

import { maskCPF, maskCNPJ, maskPhone, maskCEP, unmaskCEP, unmaskCNPJ } from '@/lib/masks';

const BRAZILIAN_STATES = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];

export default function CadastroClienteManual3() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [clientType, setClientType] = useState<'PF' | 'PJ'>('PF');
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    email: '',
    phone: '',
    cep: '',
    street: '',
    city: '',
    state: 'SP',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData & { type: 'PF' | 'PJ' }) => {
      const response = await apiRequest('POST', '/api/clients', data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao cadastrar cliente');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      toast({
        title: 'Cliente cadastrado',
        description: 'O cliente foi cadastrado com sucesso.',
      });
      setLocation('/clientes');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar cliente',
        description: error.message,
      });
    },
  });

  const handleSearchCep = async () => {
    const cleanCep = unmaskCEP(formData.cep || '');
    if (cleanCep.length !== 8) return;

    try {
      const cepData = await fetchCepData(cleanCep);
      if (cepData) {
        setFormData((prev) => ({
          ...prev,
          cep: maskCEP(cepData.cep || cleanCep),
          street: cepData.street || prev.street || '',
          neighborhood: cepData.neighborhood || prev.neighborhood || '',
          city: cepData.city || prev.city || '',
          state: cepData.state || prev.state || '',
        }));
        
        toast({
          title: 'Endereço encontrado',
          description: 'Os dados do endereço foram preenchidos.',
        });
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar CEP',
        description: 'Não foi possível carregar os dados do endereço.',
      });
    }
  };

  const handleCnpjBlur = async () => {
    if (clientType !== 'PJ') {
      return;
    }
    const cleanCnpj = unmaskCNPJ(formData.document || '');
    if (cleanCnpj.length !== 14) {
      return;
    }
    try {
      const data = await fetchCnpjData(cleanCnpj);
      if (!data) {
        return;
      }
      setFormData((prev) => {
        const updated = { ...prev };
        if (!prev.name || prev.name.trim() === '') {
          updated.name = data.razao_social || data.nome_fantasia || prev.name;
        }
        if (!prev.email || prev.email.trim() === '') {
          if (data.email && data.email.trim() !== '') {
            updated.email = data.email.trim();
          }
        }
        if (!prev.phone || prev.phone.trim() === '') {
          if (data.ddd_telefone_1) {
            updated.phone = maskPhone(data.ddd_telefone_1);
          }
        }
        if (data.cep && (!prev.cep || prev.cep.trim() === '')) {
          updated.cep = maskCEP(data.cep);
        }
        if (data.logradouro && (!prev.street || prev.street.trim() === '')) {
          updated.street = data.logradouro;
        }
        if (data.bairro && (!prev.neighborhood || prev.neighborhood.trim() === '')) {
          updated.neighborhood = data.bairro;
        }
        if (data.municipio && (!prev.city || prev.city.trim() === '')) {
          updated.city = data.municipio;
        }
        if (data.uf && (!prev.state || prev.state.trim() === '')) {
          updated.state = data.uf;
        }
        return updated;
      });
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ ...formData, type: clientType });
  };

  return (
    <div className='relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display overflow-x-hidden'>
      <div className='layout-container flex h-full grow flex-col'>
        <header className='flex w-full items-center justify-center border-b border-solid border-gray-200 dark:border-gray-800 bg-white dark:bg-background-dark px-4 sm:px-6 lg:px-8'>
          <div className='flex w-full max-w-7xl items-center justify-between whitespace-nowrap py-3'>
            <div className='flex items-center gap-4 text-gray-900 dark:text-white'>
              <div className='h-6 w-6 text-primary'>
                <svg
                  fill='none'
                  viewBox='0 0 48 48'
                  xmlns='http://www.w3.org/2000/svg'
                >
                  <path
                    d='M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z'
                    fill='currentColor'
                  ></path>
                </svg>
              </div>
              <h2 className='text-lg font-bold tracking-[-0.015em]'>
                ChamadosPro
              </h2>
            </div>
            <nav className='hidden items-center gap-9 md:flex'>
              <a
                className='text-sm font-medium leading-normal text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary'
                href='#'
              >
                Dashboard
              </a>
              <a
                className='text-sm font-medium leading-normal text-primary'
                href='#'
              >
                Clientes
              </a>
              <a
                className='text-sm font-medium leading-normal text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary'
                href='#'
              >
                Chamados
              </a>
              <a
                className='text-sm font-medium leading-normal text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary'
                href='#'
              >
                Financeiro
              </a>
              <a
                className='text-sm font-medium leading-normal text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary'
                href='#'
              >
                Relatórios
              </a>
            </nav>
          </div>
        </header>
        <main className='flex flex-1 justify-center py-10 px-4 sm:px-6 lg:px-8'>
          <div className='layout-content-container flex w-full max-w-3xl flex-1 flex-col gap-8'>
            <div className='flex flex-col gap-2'>
              <h1 className='text-4xl font-black leading-tight tracking-[-0.033em] text-gray-900 dark:text-white'>
                Cadastro Manual de Cliente
              </h1>
            </div>
            <Card className='flex flex-col gap-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-background-dark/50 p-6 shadow-sm'>
              <div className='flex flex-col gap-2'>
                <Label className='text-base font-medium leading-normal text-gray-900 dark:text-white'>
                  Tipo de Cliente
                </Label>
                <div className='flex h-10 w-full items-center justify-center rounded-lg bg-background-light dark:bg-background-dark p-1'>
                  <label
                    className={`flex h-full flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-lg px-2 text-sm font-medium leading-normal transition-colors ${
                      clientType === 'PF'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span className='truncate'>Pessoa Física (PF)</span>
                    <input
                      checked={clientType === 'PF'}
                      onChange={() => setClientType('PF')}
                      className='invisible w-0'
                      name='customer-type'
                      type='radio'
                      value='PF'
                    />
                  </label>
                  <label
                    className={`flex h-full flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-lg px-2 text-sm font-medium leading-normal transition-colors ${
                      clientType === 'PJ'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span className='truncate'>Pessoa Jurídica (PJ)</span>
                    <input
                      checked={clientType === 'PJ'}
                      onChange={() => setClientType('PJ')}
                      className='invisible w-0'
                      name='customer-type'
                      type='radio'
                      value='PJ'
                    />
                  </label>
                </div>
              </div>

              <form onSubmit={handleSubmit} className='flex flex-col gap-6'>
                <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                  <div className='flex flex-col flex-1'>
                    <Label className='pb-2 text-base font-medium leading-normal text-gray-900 dark:text-white'>
                      {clientType === 'PF' ? 'Nome Completo' : 'Razão Social'}
                    </Label>
                    <Input
                      className='flex h-12 w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-base font-normal leading-normal text-gray-900 dark:text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                      placeholder={
                        clientType === 'PF'
                          ? 'Digite o nome do cliente'
                          : 'Digite a razão social'
                      }
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className='flex flex-col flex-1'>
                    <Label className='pb-2 text-base font-medium leading-normal text-gray-900 dark:text-white'>
                      {clientType === 'PF' ? 'CPF' : 'CNPJ'}
                    </Label>
                    <Input
                      className='flex h-12 w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-base font-normal leading-normal text-gray-900 dark:text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                      placeholder={
                        clientType === 'PF'
                          ? '000.000.000-00'
                          : '00.000.000/0000-00'
                      }
                      value={formData.document}
                      onBlur={handleCnpjBlur}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          document:
                            clientType === 'PF'
                              ? maskCPF(e.target.value)
                              : maskCNPJ(e.target.value),
                        })
                      }
                      required
                    />
                  </div>
                </div>
                <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                  <div className='flex flex-col flex-1'>
                    <Label className='pb-2 text-base font-medium leading-normal text-gray-900 dark:text-white'>
                      Email
                    </Label>
                    <Input
                      type='email'
                      className='flex h-12 w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-base font-normal leading-normal text-gray-900 dark:text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                      placeholder='cliente@email.com'
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className='flex flex-col flex-1'>
                    <Label className='pb-2 text-base font-medium leading-normal text-gray-900 dark:text-white'>
                      Telefone
                    </Label>
                    <Input
                      type='tel'
                      className='flex h-12 w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-base font-normal leading-normal text-gray-900 dark:text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                      placeholder='(00) 00000-0000'
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          phone: maskPhone(e.target.value),
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <hr className='border-gray-200 dark:border-gray-800' />

                <div className='flex flex-col gap-6'>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
                    Endereço
                  </h3>
                  <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
                    <div className='flex flex-col md:col-span-1'>
                      <Label className='pb-2 text-base font-medium leading-normal text-gray-900 dark:text-white'>
                        CEP
                      </Label>
                      <div className='relative flex items-center'>
                        <Input
                          className='flex h-12 w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-base font-normal leading-normal text-gray-900 dark:text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                          placeholder='00000-000'
                          value={formData.cep}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              cep: maskCEP(e.target.value),
                            })
                          }
                          onBlur={handleSearchCep}
                          maxLength={9}
                        />
                      </div>
                    </div>
                    <div className='flex flex-col md:col-span-2'>
                      <Label className='pb-2 text-base font-medium leading-normal text-gray-900 dark:text-white'>
                        // Logradouro
                      </Label>
                      <Input
                        className='flex h-12 w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-base font-normal leading-normal text-gray-900 dark:text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                        placeholder='Ex: Rua das Flores, 123'
                        value={formData.street}
                        onChange={(e) =>
                          setFormData({ ...formData, street: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                    <div className='flex flex-col flex-1'>
                      <Label className='pb-2 text-base font-medium leading-normal text-gray-900 dark:text-white'>
                        Cidade
                      </Label>
                      <Input
                        className='flex h-12 w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-base font-normal leading-normal text-gray-900 dark:text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                        placeholder='Digite a cidade'
                        value={formData.city}
                        onChange={(e) =>
                          setFormData({ ...formData, city: e.target.value })
                        }
                      />
                    </div>
                    <div className='flex flex-col flex-1'>
                      <Label className='pb-2 text-base font-medium leading-normal text-gray-900 dark:text-white'>
                        Estado
                      </Label>
                      <Select
                        value={formData.state}
                        onValueChange={(value) =>
                          setFormData({ ...formData, state: value })
                        }
                      >
                        <SelectTrigger className='flex h-12 w-full min-w-0 flex-1 cursor-pointer resize-none items-center overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-base font-normal leading-normal text-gray-900 dark:text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'>
                          <SelectValue placeholder='Selecione um estado' />
                        </SelectTrigger>
                        <SelectContent>
                          {BRAZILIAN_STATES.map((state) => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className='flex flex-wrap items-center justify-end gap-4 pt-4'>
                  <Button
                    type='button'
                    variant='ghost'
                    className='flex h-11 items-center justify-center rounded-lg bg-transparent px-6 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    onClick={() => setLocation('/clientes')}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type='submit'
                    className='flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-white shadow-sm hover:bg-primary/90'
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending
                      ? 'Salvando...'
                      : 'Salvar Cliente'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </main>
        <footer className='flex w-full items-center justify-center py-6 px-4 sm:px-6 lg:px-8'>
          <p className='text-sm text-gray-500 dark:text-gray-400'>
            © 2024 ChamadosPro
          </p>
        </footer>
      </div>
    </div>
  );
}























