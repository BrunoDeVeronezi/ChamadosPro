import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Search, Play, Edit, X, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Ticket {
  id: string;
  ticketNumber: string;
  clientName: string;
  serviceName: string;
  address: string;
  scheduledFor: string;
  clientType: 'EMPRESA' | 'RESIDENCIAL';
}

export default function ListagemChamados2() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ['/api/tickets', searchTerm, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await apiRequest(
        'GET',
        `/api/tickets?${params.toString()}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar chamados');
      return response.json();
    },
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      ABERTO: 'bg-blue-900/50 text-blue-300',
      INICIADO: 'bg-orange-900/50 text-orange-300',
      CANCELADO: 'bg-red-900/50 text-red-300',
      CONCLUIDO: 'bg-green-900/50 text-green-300',
    };
    return badges[status as keyof typeof badges] || 'bg-gray-800 text-gray-300';
  };

  const getClientTypeBadge = (type: string) => {
    if (type === 'EMPRESA') {
      return 'bg-purple-900/50 text-purple-300';
    }
    return 'bg-teal-900/50 text-teal-300';
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy - HH:mm', {
        locale: ptBR,
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className='relative flex h-auto min-h-screen w-full flex-col bg-background-dark font-display overflow-x-hidden'>
      <div className='flex h-full w-full'>
        <aside className='flex h-screen min-w-[250px] max-w-[250px] flex-col justify-between border-r border-gray-700 bg-background-dark p-4 sticky top-0'>
          <div className='flex flex-col gap-4'>
            <div className='flex items-center gap-3'>
              <div className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-primary/20'></div>
              <div className='flex flex-col'>
                <h1 className='text-white text-base font-medium leading-normal'>
                  Carlos Silva
                </h1>
                <p className='text-gray-400 text-sm font-normal leading-normal'>
                  Técnico de TI
                </p>
              </div>
            </div>
            <nav className='flex flex-col gap-2 mt-4'>
              <a
                className='flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 rounded-lg'
                href='#'
              >
                <span className='text-gray-200'>Dashboard</span>
              </a>
              <a
                className='flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/20'
                href='#'
              >
                <span className='text-primary text-sm font-medium leading-normal'>
                  Chamados
                </span>
              </a>
              <a
                className='flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 rounded-lg'
                href='#'
              >
                <span className='text-gray-200'>Clientes</span>
              </a>
              <a
                className='flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 rounded-lg'
                href='#'
              >
                <span className='text-gray-200'>Agenda</span>
              </a>
              <a
                className='flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 rounded-lg'
                href='#'
              >
                <span className='text-gray-200'>Financeiro</span>
              </a>
            </nav>
          </div>
          <div className='flex flex-col gap-1'>
            <a
              className='flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 rounded-lg'
              href='#'
            >
              <span className='text-gray-200'>Configurações</span>
            </a>
            <a
              className='flex items-center gap-3 px-3 py-2 text-gray-300 hover:bg-gray-800 rounded-lg'
              href='#'
            >
              <span className='text-gray-200'>Sair</span>
            </a>
          </div>
        </aside>

        <main className='flex-1 p-8 overflow-y-auto'>
          <div className='max-w-7xl mx-auto'>
            <div className='flex flex-wrap justify-between items-center gap-4'>
              <h1 className='text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
                Listagem de Chamados
              </h1>
              <Button
                className='flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90'
                onClick={() => setLocation('/criacao-chamado')}
              >
                <Plus className='w-4 h-4' />
                <span className='truncate'>Novo Chamado</span>
              </Button>
            </div>

            <div className='mt-6 flex flex-col md:flex-row gap-4 items-center'>
              <div className='flex-grow w-full md:w-auto'>
                <div className='flex w-full flex-1 items-stretch rounded-lg h-12 bg-background-dark shadow-sm border border-gray-700'>
                  <div className='text-gray-400 flex items-center justify-center pl-4'>
                    <Search className='w-5 h-5' />
                  </div>
                  <Input
                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-white focus:outline-0 focus:ring-0 border-none bg-transparent h-full placeholder:text-gray-400 px-4 rounded-l-none border-l-0 pl-2 text-base font-normal leading-normal'
                    placeholder='Buscar por cliente, serviço ou endereço...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className='flex gap-2 p-1 overflow-x-auto'>
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'ghost'}
                  size='sm'
                  className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 ${
                    statusFilter === 'all'
                      ? 'bg-primary'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                  onClick={() => setStatusFilter('all')}
                >
                  <p
                    className={`text-sm font-medium leading-normal ${
                      statusFilter === 'all' ? 'text-white' : 'text-gray-200'
                    }`}
                  >
                    Todos
                  </p>
                </Button>
                <Button
                  variant={statusFilter === 'ABERTO' ? 'default' : 'ghost'}
                  size='sm'
                  className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 ${
                    statusFilter === 'ABERTO'
                      ? 'bg-primary'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                  onClick={() => setStatusFilter('ABERTO')}
                >
                  <p
                    className={`text-sm font-medium leading-normal ${
                      statusFilter === 'ABERTO' ? 'text-white' : 'text-gray-200'
                    }`}
                  >
                    Aberto
                  </p>
                </Button>
                <Button
                  variant={statusFilter === 'INICIADO' ? 'default' : 'ghost'}
                  size='sm'
                  className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 ${
                    statusFilter === 'INICIADO'
                      ? 'bg-primary'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                  onClick={() => setStatusFilter('INICIADO')}
                >
                  <p
                    className={`text-sm font-medium leading-normal ${
                      statusFilter === 'INICIADO'
                        ? 'text-white'
                        : 'text-gray-200'
                    }`}
                  >
                    Iniciado
                  </p>
                </Button>
                <Button
                  variant={statusFilter === 'CONCLUIDO' ? 'default' : 'ghost'}
                  size='sm'
                  className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 ${
                    statusFilter === 'CONCLUIDO'
                      ? 'bg-primary'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                  onClick={() => setStatusFilter('CONCLUIDO')}
                >
                  <p
                    className={`text-sm font-medium leading-normal ${
                      statusFilter === 'CONCLUIDO' ? 'text-white' : 'text-gray-200'
                    }`}
                  >
                    Concluido
                  </p>
                </Button>
                <Button
                  variant={statusFilter === 'CANCELADO' ? 'default' : 'ghost'}
                  size='sm'
                  className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 ${
                    statusFilter === 'CANCELADO'
                      ? 'bg-primary'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                  onClick={() => setStatusFilter('CANCELADO')}
                >
                  <p
                    className={`text-sm font-medium leading-normal ${
                      statusFilter === 'CANCELADO'
                        ? 'text-white'
                        : 'text-gray-200'
                    }`}
                  >
                    Cancelado
                  </p>
                </Button>
              </div>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-8'>
              {isLoading ? (
                <div className='col-span-full text-center py-12 text-gray-400'>
                  Carregando...
                </div>
              ) : tickets && tickets.length > 0 ? (
                tickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className='flex flex-col items-stretch justify-start rounded-xl shadow-md bg-gray-850 border border-gray-700 overflow-hidden'
                  >
                    <div className='p-4 border-b border-gray-700'>
                      <div className='flex justify-between items-start'>
                        <p className='text-gray-400 text-sm font-normal'>
                          #{ticket.ticketNumber}
                        </p>
                        <div className='flex items-center gap-2'>
                          <Badge
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getClientTypeBadge(
                              ticket.clientType
                            )}`}
                          >
                            {ticket.clientType === 'EMPRESA'
                              ? 'Empresa'
                              : 'Residencial'}
                          </Badge>
                          <Badge
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getStatusBadge(
                              ticket.status
                            )}`}
                          >
                            {ticket.status}
                          </Badge>
                        </div>
                      </div>
                      <p className='text-white text-lg font-bold leading-tight tracking-[-0.015em] mt-2'>
                        {ticket.clientName}
                      </p>
                    </div>
                    <div className='flex flex-col gap-3 p-4'>
                      <p className='text-gray-300 text-sm font-normal'>
                        <strong className='text-gray-100'>Serviço:</strong>{' '}
                        {ticket.serviceName}
                      </p>
                      <div className='flex items-center gap-2 text-sm text-gray-300'>
                        <span className='text-base'> </span>
                        <span>{formatDate(ticket.scheduledFor)}</span>
                      </div>
                      <div className='flex items-center gap-2 text-sm text-gray-300'>
                        <span className='text-base'>📍</span>
                        <span>{ticket.address}</span>
                      </div>
                    </div>
                    <div className='p-4 mt-auto bg-gray-850/50 border-t border-gray-700 flex flex-wrap gap-2 justify-end'>
                      {ticket.status === 'ABERTO' && (
                        <>
                          <Button
                            size='sm'
                            className='flex items-center justify-center rounded-md h-8 px-3 bg-primary text-white text-xs font-medium hover:bg-primary/90'
                            onClick={() => {
                              // TODO: Implementar iniciar chamado
                            }}
                          >
                            <Play className='w-3 h-3 mr-1' />
                            Iniciar
                          </Button>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='flex items-center justify-center rounded-md h-8 px-3 bg-gray-700 text-gray-200 text-xs font-medium hover:bg-gray-600'
                            onClick={() => setLocation(`/chamado/${ticket.id}`)}
                          >
                            <Edit className='w-3 h-3 mr-1' />
                            Editar
                          </Button>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='flex items-center justify-center rounded-md h-8 px-3 bg-red-900/40 text-red-300 text-xs font-medium hover:bg-red-900/60'
                            onClick={() => {
                              // TODO: Implementar cancelar chamado
                            }}
                          >
                            <X className='w-3 h-3 mr-1' />
                            Cancelar
                          </Button>
                        </>
                      )}
                      {ticket.status === 'INICIADO' && (
                        <>
                          <Button
                            size='sm'
                            className='flex items-center justify-center rounded-md h-8 px-3 bg-green-500 text-white text-xs font-medium hover:bg-green-600'
                            onClick={() => {
                              // TODO: Implementar concluir chamado
                            }}
                          >
                            <span className='mr-1'>OK</span>
                            Concluir
                          </Button>
                          <Button
                            size='sm'
                            variant='ghost'
                            className='flex items-center justify-center rounded-md h-8 px-3 bg-gray-700 text-gray-200 text-xs font-medium hover:bg-gray-600'
                            onClick={() => {
                              // TODO: Implementar reagendar
                            }}
                          >
                            <span className='mr-1'>T</span>
                            Reagendar
                          </Button>
                        </>
                      )}
                        <Button
                          variant='ghost'
                          size='sm'
                          className='flex items-center justify-center rounded-md h-8 px-3 bg-gray-700 text-gray-200 text-xs font-medium hover:bg-gray-600'
                          onClick={() => setLocation(`/chamado/${ticket.id}`)}
                        >
                          <Eye className='w-3 h-3 mr-1' />
                          Ver Detalhes
                        </Button>
                      {ticket.status === 'CANCELADO' && (
                        <Button
                          variant='ghost'
                          size='sm'
                          className='flex items-center justify-center rounded-md h-8 px-3 bg-gray-700 text-gray-200 text-xs font-medium hover:bg-gray-600'
                          onClick={() => {
                            // TODO: Implementar excluir
                          }}
                        >
                          <X className='w-3 h-3 mr-1' />
                          Excluir
                        </Button>
                      )}
                    </div>
                  </Card>
                ))
              ) : (
                <div className='col-span-full text-center py-12 text-gray-400'>
                  Nenhum chamado encontrado
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}























