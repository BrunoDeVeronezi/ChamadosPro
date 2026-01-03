import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Filter, MoreVertical, List, LayoutGrid } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Ticket {
  id: string;
  ticketNumber: string;
  clientName: string;
  serviceName: string;
  technicianName: string | null;
  status: 'ABERTO' | 'EM_ANDAMENTO' | 'AGENDADO' | 'CONCLUÍDO' | 'CANCELADO';
  scheduledFor: string;
}

export default function FilaChamadosEmpresa2() {
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('lista');

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ['/api/tickets/queue'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/tickets/queue', undefined);
      if (!response.ok) throw new Error('Erro ao carregar fila de chamados');
      return response.json();
    },
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      ABERTO:
        'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
      EM_ANDAMENTO:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
      AGENDADO:
        'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
      CONCLUÍDO:
        'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      CANCELADO: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    };
    return (
      badges[status as keyof typeof badges] ||
      'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300'
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  return (
    <div className='font-display bg-background-light dark:bg-background-dark text-gray-800 dark:text-gray-200'>
      <div className='relative flex min-h-screen w-full flex-col group/design-root'>
        <div className='flex h-full w-full'>
          {/* SideNavBar */}
          <aside className='flex w-64 flex-col bg-white dark:bg-gray-900/40 p-4 border-r border-gray-200 dark:border-gray-800'>
            <div className='flex flex-col h-full justify-between'>
              <div className='flex flex-col gap-6'>
                <div className='flex items-center gap-3'>
                  <div className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-primary/20'></div>
                  <div className='flex flex-col'>
                    <h1 className='text-gray-900 dark:text-white text-base font-semibold leading-normal'>
                      ChamadosPro
                    </h1>
                    <p className='text-gray-500 dark:text-gray-400 text-sm font-normal leading-normal'>
                      Plano Pro
                    </p>
                  </div>
                </div>
                <nav className='flex flex-col gap-2'>
                  <a
                    className='flex items-center gap-3 px-3 py-2 text-gray-500 dark:text-gray-400 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors'
                    href='#'
                  >
                    <span>Dashboard</span>
                  </a>
                  <a
                    className='flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary'
                    href='#'
                  >
                    <span className='text-sm font-medium leading-normal'>
                      Fila de Chamados
                    </span>
                  </a>
                  <a
                    className='flex items-center gap-3 px-3 py-2 text-gray-500 dark:text-gray-400 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors'
                    href='#'
                  >
                    <span>Técnicos</span>
                  </a>
                  <a
                    className='flex items-center gap-3 px-3 py-2 text-gray-500 dark:text-gray-400 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors'
                    href='#'
                  >
                    <span>Clientes</span>
                  </a>
                  <a
                    className='flex items-center gap-3 px-3 py-2 text-gray-500 dark:text-gray-400 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors'
                    href='#'
                  >
                    <span>Relatórios</span>
                  </a>
                </nav>
              </div>
              <div className='flex flex-col gap-1'>
                <a
                  className='flex items-center gap-3 px-3 py-2 text-gray-500 dark:text-gray-400 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors'
                  href='#'
                >
                  <span>Configurações</span>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 text-gray-500 dark:text-gray-400 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors'
                  href='#'
                >
                  <span>Ajuda</span>
                </a>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className='flex-1 flex flex-col p-6 lg:p-8'>
            <div className='flex flex-col max-w-7xl mx-auto w-full'>
              {/* Page Heading */}
              <header className='flex flex-wrap justify-between items-center gap-4 mb-6'>
                <h1 className='text-gray-900 dark:text-white text-3xl font-bold leading-tight'>
                  Fila de Chamados
                </h1>
                <Button
                  className='flex min-w-[84px] items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-wide shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors'
                  onClick={() => setLocation('/criacao-chamado')}
                >
                  <Plus className='mr-2 w-4 h-4' />
                  <span className='truncate'>Novo Chamado</span>
                </Button>
              </header>

              {/* Filters & View Controls */}
              <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4'>
                {/* Chips */}
                <div className='flex gap-2 flex-wrap'>
                  <Button
                    variant='outline'
                    size='sm'
                    className='flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
                  >
                    <Filter className='w-4 h-4 text-gray-600 dark:text-gray-400' />
                    <p className='text-gray-700 dark:text-gray-300 text-sm font-medium leading-normal'>
                      Status
                    </p>
                    <span className='text-gray-600 dark:text-gray-400'>▼</span>
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    className='flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
                  >
                    <Filter className='w-4 h-4 text-gray-600 dark:text-gray-400' />
                    <p className='text-gray-700 dark:text-gray-300 text-sm font-medium leading-normal'>
                      Técnico
                    </p>
                    <span className='text-gray-600 dark:text-gray-400'>▼</span>
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    className='flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
                  >
                    <Filter className='w-4 h-4 text-gray-600 dark:text-gray-400' />
                    <p className='text-gray-700 dark:text-gray-300 text-sm font-medium leading-normal'>
                      Cliente
                    </p>
                    <span className='text-gray-600 dark:text-gray-400'>▼</span>
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    className='flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
                  >
                    <span className='text-gray-600 dark:text-gray-400'>📅</span>
                    <p className='text-gray-700 dark:text-gray-300 text-sm font-medium leading-normal'>
                      Período
                    </p>
                    <span className='text-gray-600 dark:text-gray-400'>▼</span>
                  </Button>
                </div>
                {/* SegmentedButtons */}
                <div className='flex h-10 w-full md:w-auto items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-800 p-1'>
                  <label
                    className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-md px-4 transition-colors ${
                      viewMode === 'lista'
                        ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span className='truncate text-sm font-medium leading-normal'>
                      Lista
                    </span>
                    <input
                      checked={viewMode === 'lista'}
                      onChange={() => setViewMode('lista')}
                      className='invisible w-0'
                      name='view-toggle'
                      type='radio'
                      value='Lista'
                    />
                  </label>
                  <label
                    className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-md px-4 transition-colors ${
                      viewMode === 'kanban'
                        ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span className='truncate text-sm font-medium leading-normal'>
                      Kanban
                    </span>
                    <input
                      checked={viewMode === 'kanban'}
                      onChange={() => setViewMode('kanban')}
                      className='invisible w-0'
                      name='view-toggle'
                      type='radio'
                      value='Kanban'
                    />
                  </label>
                </div>
              </div>

              {/* Table */}
              {viewMode === 'lista' && (
                <div className='w-full @container'>
                  <Card className='flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40'>
                    <Table>
                      <TableHeader>
                        <TableRow className='bg-gray-50 dark:bg-gray-800/50'>
                          <TableHead className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 w-[10%]'>
                            # Chamado
                          </TableHead>
                          <TableHead className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 w-[20%]'>
                            Cliente
                          </TableHead>
                          <TableHead className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 w-[20%]'>
                            Serviço
                          </TableHead>
                          <TableHead className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 w-[15%]'>
                            Técnico
                          </TableHead>
                          <TableHead className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 w-[10%]'>
                            Status
                          </TableHead>
                          <TableHead className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 w-[15%]'>
                            Data Agendada
                          </TableHead>
                          <TableHead className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 w-[10%] text-center'>
                            Ações
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className='divide-y divide-gray-200 dark:divide-gray-800'>
                        {isLoading ? (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className='h-16 px-4 py-2 text-center text-gray-600 dark:text-gray-300'
                            >
                              Carregando...
                            </TableCell>
                          </TableRow>
                        ) : tickets && tickets.length > 0 ? (
                          tickets.map((ticket) => (
                            <TableRow
                              key={ticket.id}
                              className='hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors'
                            >
                              <TableCell className='h-16 px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100'>
                                #{ticket.ticketNumber}
                              </TableCell>
                              <TableCell className='h-16 px-4 py-2 text-sm text-gray-600 dark:text-gray-300'>
                                {ticket.clientName}
                              </TableCell>
                              <TableCell className='h-16 px-4 py-2 text-sm text-gray-600 dark:text-gray-300'>
                                {ticket.serviceName}
                              </TableCell>
                              <TableCell className='h-16 px-4 py-2 text-sm text-gray-600 dark:text-gray-300'>
                                {ticket.technicianName || (
                                  <span className='text-gray-400 dark:text-gray-500 italic'>
                                    Não Atribuído
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className='h-16 px-4 py-2 text-sm'>
                                <Badge
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(
                                    ticket.status
                                  )}`}
                                >
                                  {ticket.status === 'EM_ANDAMENTO'
                                    ? 'Em Andamento'
                                    : ticket.status === 'AGENDADO'
                                    ? 'Agendado'
                                    : ticket.status}
                                </Badge>
                              </TableCell>
                              <TableCell className='h-16 px-4 py-2 text-sm text-gray-600 dark:text-gray-300'>
                                {formatDate(ticket.scheduledFor)}
                              </TableCell>
                              <TableCell className='h-16 px-4 py-2 text-center'>
                                <Button
                                  variant='ghost'
                                  size='icon'
                                  className='text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors'
                                  onClick={() =>
                                    setLocation(`/chamado/${ticket.id}`)
                                  }
                                >
                                  <MoreVertical className='w-4 h-4' />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className='h-16 px-4 py-2 text-center text-gray-600 dark:text-gray-300'
                            >
                              Nenhum chamado encontrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              )}

              {viewMode === 'kanban' && (
                <div className='text-center py-12 text-gray-500 dark:text-gray-400'>
                  Visualização Kanban será implementada em breve
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
























