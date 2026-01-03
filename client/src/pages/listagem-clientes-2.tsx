import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  MessageCircle,
  User,
  Building2,
  Handshake,
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
  type: 'PF' | 'PJ' | 'EMPRESA_PARCEIRA';
  email: string;
  phone: string;
}

export default function ListagemClientes2() {
  const [searchTerm, setSearchTerm] = useState('');
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('all');

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients', searchTerm, clientTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (clientTypeFilter !== 'all') params.append('type', clientTypeFilter);
      const response = await apiRequest(
        'GET',
        `/api/clients?${params.toString()}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar clientes');
      return response.json();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['/api/clients/stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/clients/stats', undefined);
      if (!response.ok) throw new Error('Erro ao carregar estatísticas');
      return response.json();
    },
  });

  const getClientIcon = (type: string) => {
    switch (type) {
      case 'PF':
        return <User className='w-6 h-6' />;
      case 'PJ':
        return <Building2 className='w-6 h-6' />;
      case 'EMPRESA_PARCEIRA':
        return <Handshake className='w-6 h-6' />;
      default:
        return <User className='w-6 h-6' />;
    }
  };

  const getClientTypeLabel = (type: string) => {
    switch (type) {
      case 'PF':
        return 'Pessoa Física';
      case 'PJ':
        return 'Pessoa Jurídica';
      case 'EMPRESA_PARCEIRA':
        return 'Empresa Parceira';
      default:
        return type;
    }
  };

  return (
    <div className='relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display overflow-x-hidden'>
      <main className='flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Page Heading and Primary Action */}
        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6'>
          <h1 className='text-3xl font-bold tracking-tight text-gray-900 dark:text-white'>
            Listagem de Clientes
          </h1>
          <Button className='flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold shadow-sm hover:bg-primary/90 transition-colors'>
            <Plus className='w-4 h-4' />
            <span className='truncate'>Novo Cliente</span>
          </Button>
        </div>

        {/* Stats */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6'>
          <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-background-dark border border-gray-200 dark:border-gray-800'>
            <p className='text-gray-600 dark:text-gray-400 text-sm font-medium'>
              Total de Pessoas Físicas
            </p>
            <p className='text-gray-900 dark:text-white text-3xl font-bold tracking-tight'>
              {stats?.totalPF || 0}
            </p>
          </Card>
          <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-background-dark border border-gray-200 dark:border-gray-800'>
            <p className='text-gray-600 dark:text-gray-400 text-sm font-medium'>
              Total de Pessoas Jurídicas
            </p>
            <p className='text-gray-900 dark:text-white text-3xl font-bold tracking-tight'>
              {stats?.totalPJ || 0}
            </p>
          </Card>
          <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-background-dark border border-gray-200 dark:border-gray-800'>
            <p className='text-gray-600 dark:text-gray-400 text-sm font-medium'>
              Total de Empresas Parceiras
            </p>
            <p className='text-gray-900 dark:text-white text-3xl font-bold tracking-tight'>
              {stats?.totalParceiras || 0}
            </p>
          </Card>
        </div>

        {/* Filters and Search Bar */}
        <Card className='p-4 bg-white dark:bg-background-dark border border-gray-200 dark:border-gray-800 rounded-xl mb-6'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='md:col-span-2'>
              <div className='flex w-full flex-1 items-stretch rounded-lg h-12 bg-background-light dark:bg-gray-900'>
                <div className='text-gray-500 flex items-center justify-center pl-4'>
                  <Search className='w-5 h-5' />
                </div>
                <Input
                  className='flex w-full min-w-0 flex-1 resize-none overflow-hidden text-gray-900 dark:text-white focus:outline-none focus:ring-0 border-none bg-transparent h-full placeholder:text-gray-500 dark:placeholder:text-gray-500 px-2 text-base font-normal'
                  placeholder='Buscar por nome ou documento...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div>
              <select
                className='w-full h-12 appearance-none rounded-lg border-none bg-background-light dark:bg-gray-900 text-gray-900 dark:text-white pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-primary'
                value={clientTypeFilter}
                onChange={(e) => setClientTypeFilter(e.target.value)}
              >
                <option value='all'>Tipo de Cliente</option>
                <option value='PF'>Pessoa Física</option>
                <option value='PJ'>Pessoa Jurídica</option>
                <option value='EMPRESA_PARCEIRA'>Empresa Parceira</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Client Cards Grid */}
        {isLoading ? (
          <div className='text-center py-12 text-gray-500'>Carregando...</div>
        ) : clients && clients.length > 0 ? (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {clients.map((client) => (
              <Card
                key={client.id}
                className='flex flex-col rounded-xl p-6 bg-white dark:bg-background-dark border border-gray-200 dark:border-gray-800 hover:shadow-md hover:border-primary/50 dark:hover:border-primary/50 transition-all'
              >
                <div className='flex items-center gap-4 mb-4'>
                  <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary'>
                    {getClientIcon(client.type)}
                  </div>
                  <div>
                    <p className='font-bold text-gray-900 dark:text-white'>
                      {client.name}
                    </p>
                    <p className='text-sm text-gray-500 dark:text-gray-400'>
                      {getClientTypeLabel(client.type)}
                    </p>
                  </div>
                </div>
                <div className='flex-1 mb-4'>
                  <p className='text-sm text-gray-600 dark:text-gray-300'>
                    {client.email}
                  </p>
                  <p className='text-sm text-gray-600 dark:text-gray-300'>
                    {client.phone}
                  </p>
                </div>
                <div className='flex items-center justify-end gap-2'>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-primary/20 hover:text-primary dark:hover:bg-primary/20 dark:hover:text-primary transition-colors'
                  >
                    <Edit className='w-4 h-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-red-500/20 hover:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-500 transition-colors'
                  >
                    <Trash2 className='w-4 h-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-green-500/20 hover:text-green-500 dark:hover:bg-green-500/20 dark:hover:text-green-500 transition-colors'
                  >
                    <MessageCircle className='w-4 h-4' />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className='md:col-span-2 lg:col-span-3 mt-8 flex flex-col items-center justify-center text-center p-12 bg-white dark:bg-background-dark border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl'>
            <Search className='w-12 h-12 text-gray-400 dark:text-gray-600 mb-4' />
            <p className='text-xl font-bold text-gray-800 dark:text-gray-200'>
              Nenhum cliente encontrado
            </p>
            <p className='text-gray-500 dark:text-gray-400 mt-1'>
              Tente ajustar sua busca ou filtros.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}
























