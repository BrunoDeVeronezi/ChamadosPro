import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Search } from 'lucide-react';
import { maskCurrency } from '@/lib/masks';

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  active: boolean;
}

export default function ListagemServicos2() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: ['/api/services', searchTerm, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') {
        params.append('active', statusFilter === 'Ativo' ? 'true' : 'false');
      }
      const response = await apiRequest(
        'GET',
        `/api/services?${params.toString()}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar serviços');
      return response.json();
    },
  });

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h}h ${m}min`;
  };

  return (
    <div className='bg-background-light dark:bg-background-dark font-display'>
      <div className='flex h-screen w-full'>
        {/* SideNavBar */}
        <aside className='flex h-full w-64 shrink-0 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-background-dark p-4'>
          <div className='flex h-full flex-col justify-between'>
            <div className='flex flex-col gap-4'>
              <div className='flex items-center gap-3'>
                <div className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-primary/20'></div>
                <div className='flex flex-col'>
                  <h1 className='text-gray-900 dark:text-white text-base font-medium leading-normal'>
                    Técnico Pro
                  </h1>
                  <p className='text-gray-500 dark:text-gray-400 text-sm font-normal leading-normal'>
                    tecnico@email.com
                  </p>
                </div>
              </div>
              <nav className='flex flex-col gap-2 mt-4'>
                <a
                  className='flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg'
                  href='#'
                >
                  <span className='text-gray-800 dark:text-gray-200'>
                    Dashboard
                  </span>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg'
                  href='#'
                >
                  <span className='text-gray-800 dark:text-gray-200'>
                    Chamados
                  </span>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg'
                  href='#'
                >
                  <span className='text-gray-800 dark:text-gray-200'>
                    Clientes
                  </span>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 dark:bg-primary/20'
                  href='#'
                >
                  <span className='text-primary text-sm font-medium leading-normal'>
                    Serviços
                  </span>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg'
                  href='#'
                >
                  <span className='text-gray-800 dark:text-gray-200'>
                    Financeiro
                  </span>
                </a>
              </nav>
            </div>
            <div className='flex flex-col gap-1'>
              <a
                className='flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg'
                href='#'
              >
                <span className='text-gray-800 dark:text-gray-200'>
                  Configurações
                </span>
              </a>
              <a
                className='flex items-center gap-3 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg'
                href='#'
              >
                <span className='text-gray-800 dark:text-gray-200'>Ajuda</span>
              </a>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className='flex-1 overflow-y-auto'>
          <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
            {/* PageHeading */}
            <div className='flex flex-wrap items-center justify-between gap-4'>
              <h1 className='text-gray-900 dark:text-white text-3xl font-bold leading-tight tracking-tight'>
                Listagem de Serviços
              </h1>
              <Button
                className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-11 px-5 bg-primary text-white gap-2 text-sm font-bold leading-normal tracking-[0.015em] shadow-sm hover:bg-primary/90 transition-colors'
                onClick={() => setLocation('/edicao-servico/novo')}
              >
                <Plus className='w-5 h-5' />
                <span className='truncate'>Novo Serviço</span>
              </Button>
            </div>

            {/* Filters Section */}
            <div className='mt-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4'>
              {/* SearchBar */}
              <div className='md:col-span-2 lg:col-span-3'>
                <div className='flex w-full flex-1 items-stretch rounded-lg h-11'>
                  <div className='text-gray-500 dark:text-gray-400 flex border-none bg-white dark:bg-background-dark items-center justify-center pl-4 rounded-l-lg border-r-0 border border-gray-200 dark:border-gray-700'>
                    <Search className='w-5 h-5' />
                  </div>
                  <Input
                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border-gray-200 dark:border-gray-700 bg-white dark:bg-background-dark h-full placeholder:text-gray-500 dark:placeholder:text-gray-400 px-4 rounded-l-none border-l-0 pl-2 text-sm font-normal leading-normal'
                    placeholder='Buscar por nome...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              {/* SegmentedButtons */}
              <div className='flex h-11 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 p-1'>
                <label
                  className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-md px-2 transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-white dark:bg-background-dark shadow-sm text-primary'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <span className='truncate text-sm font-medium leading-normal'>
                    // Todos
                  </span>
                  <input
                    checked={statusFilter === 'all'}
                    onChange={() => setStatusFilter('all')}
                    className='invisible w-0'
                    name='status-filter'
                    type='radio'
                    value='Todos'
                  />
                </label>
                <label
                  className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-md px-2 transition-colors ${
                    statusFilter === 'Ativo'
                      ? 'bg-white dark:bg-background-dark shadow-sm text-primary'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <span className='truncate text-sm font-medium leading-normal'>
                    Ativo
                  </span>
                  <input
                    checked={statusFilter === 'Ativo'}
                    onChange={() => setStatusFilter('Ativo')}
                    className='invisible w-0'
                    name='status-filter'
                    type='radio'
                    value='Ativo'
                  />
                </label>
                <label
                  className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-md px-2 transition-colors ${
                    statusFilter === 'Inativo'
                      ? 'bg-white dark:bg-background-dark shadow-sm text-primary'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <span className='truncate text-sm font-medium leading-normal'>
                    Inativo
                  </span>
                  <input
                    checked={statusFilter === 'Inativo'}
                    onChange={() => setStatusFilter('Inativo')}
                    className='invisible w-0'
                    name='status-filter'
                    type='radio'
                    value='Inativo'
                  />
                </label>
              </div>
            </div>

            {/* Service Cards Grid */}
            <div className='mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
              {isLoading ? (
                <div className='col-span-full text-center py-12 text-gray-500 dark:text-gray-400'>
                  Carregando...
                </div>
              ) : services && services.length > 0 ? (
                services.map((service) => (
                  <Card
                    key={service.id}
                    className='flex flex-col justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-background-dark p-5 shadow-sm hover:shadow-md transition-shadow'
                  >
                    <div>
                      <div className='flex items-center justify-between'>
                        <h3 className='text-lg font-bold text-gray-900 dark:text-white'>
                          {service.name}
                        </h3>
                        <Badge
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            service.active
                              ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {service.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <p className='mt-2 text-sm text-gray-600 dark:text-gray-400'>
                        {service.description || 'Sem descrição'}
                      </p>
                    </div>
                    <div className='mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 flex justify-between text-sm text-gray-600 dark:text-gray-400'>
                      <div>
                        <span className='font-medium text-gray-800 dark:text-gray-200'>
                          Preço:
                        </span>{' '}
                        {maskCurrency(service.price.toString())}
                      </div>
                      <div>
                        <span className='font-medium text-gray-800 dark:text-gray-200'>
                          Duração:
                        </span>{' '}
                        {formatDuration(service.duration)}
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className='sm:col-span-2 lg:col-span-3 xl:col-span-4 mt-10 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center'>
                  <Search className='w-16 h-16 text-gray-400 dark:text-gray-500 mb-4' />
                  <h3 className='mt-4 text-lg font-medium text-gray-900 dark:text-white'>
                    Nenhum serviço encontrado
                  </h3>
                  <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                    Tente ajustar seus filtros ou adicione um novo serviço.
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}























