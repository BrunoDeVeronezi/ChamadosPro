import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import {
  Plus,
  Filter,
  Calendar as CalendarIcon,
  UserPlus,
  MoreVertical,
  Search,
  X,
  List,
  LayoutGrid,
  Edit,
  Eye,
  Trash2,
  Ban,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, useLocation } from 'wouter';
import type { DateRange } from 'react-day-picker';
import { useSocket } from '@/hooks/use-socket';

interface Ticket {
  id: string;
  ticketNumber: string;
  clientName: string;
  clientId: string;
  serviceName: string;
  technicianName: string | null;
  technicianId: string | null;
  status:
    | 'ABERTO'
    | 'INICIADO'
    | 'CONCLUÍDO'
    | 'CANCELADO'
    | 'PENDENTE'
    | 'AGENDADO';
  scheduledFor: string;
  scheduledDate: string;
  scheduledTime: string;
}

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl?: string;
  status?: 'available' | 'busy' | 'unavailable';
  ticketCount?: number;
  specialties?: string[];
}

interface Client {
  id: string;
  name: string;
}

export default function FilaChamadosEmpresa() {
  // Habilitar atualizações em tempo real
  useSocket();
  
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('lista');
  const [statusFilter, setStatusFilter] = useState('all');
  const [technicianFilter, setTechnicianFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [assigningTicket, setAssigningTicket] = useState<Ticket | null>(null);
  const [technicianSearch, setTechnicianSearch] = useState('');
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<
    string | null
  >(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [cancellingTicket, setCancellingTicket] = useState<Ticket | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Debug: Log quando o componente renderiza
  useEffect(() => {
    console.log('[FilaChamadosEmpresa] Componente renderizado', {
      user: user?.id,
      role: user?.role,
    });
  }, [user]);

  // Query para tickets
  const {
    data: tickets,
    isLoading,
    error: ticketsError,
  } = useQuery<Ticket[]>({
    queryKey: [
      '/api/tickets/queue',
      statusFilter,
      technicianFilter,
      clientFilter,
      dateRange?.from,
      dateRange?.to,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (technicianFilter !== 'all')
        params.append('technicianId', technicianFilter);
      if (clientFilter !== 'all') params.append('clientId', clientFilter);
      if (dateRange?.from) {
        params.append('startDate', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        params.append('endDate', dateRange.to.toISOString());
      }
      const response = await apiRequest(
        'GET',
        `/api/tickets/queue?${params.toString()}`,
        undefined
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || 'Erro ao carregar fila de chamados'
        );
      }
      return response.json();
    },
    enabled: !!user && user.role === 'company',
    retry: 1,
  });

  // Query para técnicos
  const { data: technicians, error: techniciansError } = useQuery<Technician[]>(
    {
      queryKey: ['/api/company/technicians'],
      queryFn: async () => {
        try {
          const response = await apiRequest(
            'GET',
            '/api/company/technicians',
            undefined
          );
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Erro ao carregar técnicos');
          }
          return response.json();
        } catch (error: any) {
          console.error(
            '[FilaChamadosEmpresa] Erro ao buscar técnicos:',
            error
          );
          throw error;
        }
      },
      enabled: !!user && user.role === 'company',
      retry: 1,
      onError: (error: any) => {
        console.error(
          '[FilaChamadosEmpresa] Erro ao carregar técnicos:',
          error
        );
      },
    }
  );

  // Query para clientes
  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/clients', undefined);
      if (!response.ok) throw new Error('Erro ao carregar clientes');
      return response.json();
    },
    enabled: !!user && user.role === 'company',
  });

  // Mutation para atribuir técnico
  const assignMutation = useMutation({
    mutationFn: async ({
      ticketId,
      technicianId,
    }: {
      ticketId: string;
      technicianId: string;
    }) => {
      return await apiRequest('PUT', `/api/tickets/${ticketId}`, {
        technicianId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets/queue'] });
      queryClient.invalidateQueries({
        queryKey: ['/api/company/technicians/with-stats'],
      });
      toast({
        title: 'Técnico atribuído',
        description: 'O técnico foi atribuído ao chamado com sucesso.',
      });
      setAssigningTicket(null);
      setSelectedTechnicianId(null);
      setTechnicianSearch('');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atribuir técnico',
        description: error.message || 'Não foi possível atribuir o técnico.',
      });
    },
  });

  // Mutation para cancelar chamado
  const cancelMutation = useMutation({
    mutationFn: async ({
      ticketId,
      reason,
    }: {
      ticketId: string;
      reason: string;
    }) => {
      return await apiRequest('POST', `/api/tickets/${ticketId}/cancel`, {
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets/queue'] });
      toast({
        title: 'Chamado cancelado',
        description: 'O chamado foi cancelado com sucesso.',
      });
      setCancellingTicket(null);
      setCancelReason('');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar chamado',
        description: error.message || 'Não foi possível cancelar o chamado.',
      });
    },
  });

  const filteredTechnicians = useMemo(() => {
    if (!technicians) return [];
    const searchLower = technicianSearch.toLowerCase();
    return technicians.filter(
      (tech) =>
        `${tech.firstName || ''} ${tech.lastName || ''}`
          .toLowerCase()
          .includes(searchLower) ||
        tech.email?.toLowerCase().includes(searchLower) ||
        (tech.specialties &&
          tech.specialties.some((s) => s.toLowerCase().includes(searchLower)))
    );
  }, [technicians, technicianSearch]);

  const getTechnicianStatus = (tech: Technician) => {
    if (tech.status === 'unavailable')
      return { label: 'Indisponível', color: 'red' };
    if (tech.status === 'busy') return { label: 'Ocupado', color: 'yellow' };
    return { label: 'Disponível', color: 'green' };
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      ABERTO: {
        label: 'Aberto',
        className:
          'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
      },
      AGENDADO: {
        label: 'Agendado',
        className:
          'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
      },
      INICIADO: {
        label: 'Em Andamento',
        className:
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
      },
      PENDENTE: {
        label: 'Pendente',
        className:
          'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
      },
      CONCLUÍDO: {
        label: 'Concluído',
        className:
          'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      },
      CANCELADO: {
        label: 'Cancelado',
        className:
          'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
      },
    };

    const config = statusConfig[status] || statusConfig.ABERTO;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const handleAssign = (technicianId: string) => {
    setSelectedTechnicianId(technicianId);
  };

  const handleConfirmAssignment = () => {
    if (assigningTicket && selectedTechnicianId) {
      assignMutation.mutate({
        ticketId: assigningTicket.id,
        technicianId: selectedTechnicianId,
      });
      setSelectedTechnicianId(null);
    }
  };

  const handleCancel = () => {
    if (cancellingTicket && cancelReason.trim()) {
      cancelMutation.mutate({
        ticketId: cancellingTicket.id,
        reason: cancelReason,
      });
    }
  };

  const handleViewDetails = (ticketId: string) => {
    setLocation(`/chamado/${ticketId}`);
  };

  const handleEdit = (ticketId: string) => {
    // Para empresas, redirecionar para detalhes do chamado
    // A edição pode ser feita na página de detalhes se necessário
    setLocation(`/chamado/${ticketId}`);
  };

  // Agrupar tickets por status para Kanban
  const kanbanColumns = useMemo(() => {
    if (!tickets) return {};
    const columns: Record<string, Ticket[]> = {
      ABERTO: [],
      AGENDADO: [],
      INICIADO: [],
      CONCLUÍDO: [],
      CANCELADO: [],
    };

    tickets.forEach((ticket) => {
      const status = ticket.status || 'ABERTO';
      if (columns[status]) {
        columns[status].push(ticket);
      } else {
        columns['ABERTO'].push(ticket);
      }
    });

    return columns;
  }, [tickets]);

  const formatDateRange = () => {
    if (!dateRange?.from) return 'Período';
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'dd/MM/yyyy', {
        locale: ptBR,
      })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}`;
    }
    return format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR });
  };

  // Se não for empresa, não renderizar
  if (!user || user.role !== 'company') {
    return null;
  }

  // Se houver erro, mostrar mensagem
  if (ticketsError) {
    return (
      <div className='relative flex h-auto w-full flex-col bg-[#f5f7f8] dark:bg-[#101722] font-display'>
        <div className='space-y-6 p-6'>
          <div className='flex items-center justify-center min-h-[400px]'>
            <div className='text-center'>
              <p className='text-red-600 dark:text-red-400 text-lg font-semibold mb-2'>
                Erro ao carregar fila de chamados
              </p>
              <p className='text-gray-600 dark:text-gray-400'>
                {ticketsError instanceof Error
                  ? ticketsError.message
                  : 'Erro desconhecido'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='relative flex h-auto w-full flex-col bg-[#f5f7f8] dark:bg-[#101722] font-display'>
      <div className='space-y-6 p-6'>
        {/* Header */}
        <div className='flex flex-wrap justify-between items-center gap-4'>
          <h1 className='text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
            Fila de Chamados
          </h1>
          <Button
            onClick={() => setLocation('/agendar-chamado-empresa')}
            className='bg-[#3880f5] hover:bg-[#3880f5]/90'
          >
            <Plus className='w-4 h-4 mr-2' />
            // Novo Chamado
          </Button>
        </div>

        {/* Filtros e Visualização */}
        <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
          <div className='flex gap-2 flex-wrap'>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className='h-10 w-[140px]'>
                <Filter className='w-4 h-4 mr-2' />
                <SelectValue placeholder='Status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos</SelectItem>
                <SelectItem value='ABERTO'>Aberto</SelectItem>
                <SelectItem value='AGENDADO'>Agendado</SelectItem>
                <SelectItem value='INICIADO'>Em Andamento</SelectItem>
                <SelectItem value='CONCLUÍDO'>Concluído</SelectItem>
                <SelectItem value='CANCELADO'>Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={technicianFilter}
              onValueChange={setTechnicianFilter}
            >
              <SelectTrigger className='h-10 w-[160px]'>
                <Filter className='w-4 h-4 mr-2' />
                <SelectValue placeholder='Técnico' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos</SelectItem>
                {technicians?.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {`${tech.firstName || ''} ${tech.lastName || ''}`.trim() ||
                      tech.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className='h-10 w-[160px]'>
                <Filter className='w-4 h-4 mr-2' />
                <SelectValue placeholder='Cliente' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant='outline' className='h-10'>
                  <CalendarIcon className='w-4 h-4 mr-2' />
                  {formatDateRange()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-auto p-0' align='start'>
                <Calendar
                  initialFocus
                  mode='range'
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                />
                {dateRange && (
                  <div className='p-3 border-t flex justify-end gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setDateRange(undefined)}
                    >
                      Limpar
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Toggle Lista/Kanban */}
          <div className='flex h-10 items-center rounded-lg bg-gray-200 dark:bg-gray-800 p-1'>
            <button
              onClick={() => setViewMode('lista')}
              className={`flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'lista'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <List className='w-4 h-4 mr-2' />
              Lista
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <LayoutGrid className='w-4 h-4 mr-2' />
              Kanban
            </button>
          </div>
        </div>

        {/* Conteúdo - Lista ou Kanban */}
        {viewMode === 'lista' ? (
          <Card className='overflow-hidden'>
            <div className='w-full overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='bg-gray-50 dark:bg-gray-800/50'>
                    <TableHead className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                      # CHAMADO
                    </TableHead>
                    <TableHead className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                      CLIENTE
                    </TableHead>
                    <TableHead className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                      SERVIÇO
                    </TableHead>
                    <TableHead className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                      TÉCNICO
                    </TableHead>
                    <TableHead className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                      STATUS
                    </TableHead>
                    <TableHead className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                      DATA AGENDADA
                    </TableHead>
                    <TableHead className='px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                      AÇÕES
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className='h-16 px-4 py-2 text-center text-gray-500'
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
                          {ticket.ticketNumber}
                        </TableCell>
                        <TableCell className='h-16 px-4 py-2 text-sm text-gray-600 dark:text-gray-300'>
                          {ticket.clientName}
                        </TableCell>
                        <TableCell className='h-16 px-4 py-2 text-sm text-gray-600 dark:text-gray-300'>
                          {ticket.serviceName}
                        </TableCell>
                        <TableCell className='h-16 px-4 py-2 text-sm text-gray-600 dark:text-gray-300'>
                          {ticket.technicianName ? (
                            ticket.technicianName
                          ) : (
                            <span className='text-gray-400 dark:text-gray-500 italic'>
                              Não Atribuído
                            </span>
                          )}
                        </TableCell>
                        <TableCell className='h-16 px-4 py-2 text-sm'>
                          {getStatusBadge(ticket.status)}
                        </TableCell>
                        <TableCell className='h-16 px-4 py-2 text-sm text-gray-600 dark:text-gray-300'>
                          {ticket.scheduledFor
                            ? format(
                                new Date(ticket.scheduledFor),
                                'dd/MM/yyyy HH:mm',
                                { locale: ptBR }
                              )
                            : '-'}
                        </TableCell>
                        <TableCell className='h-16 px-4 py-2 text-center'>
                          {!ticket.technicianName &&
                          (ticket.status === 'ABERTO' ||
                            ticket.status === 'PENDENTE') ? (
                            <Button
                              variant='outline'
                              size='sm'
                              className='flex items-center justify-center gap-2 h-8 px-3 text-xs font-medium'
                              onClick={() => setAssigningTicket(ticket)}
                            >
                              <UserPlus className='w-4 h-4' />
                              Atribuir Técnico
                            </Button>
                          ) : (
                            <DropdownMenu
                              open={actionMenuOpen === ticket.id}
                              onOpenChange={(open) =>
                                setActionMenuOpen(open ? ticket.id : null)
                              }
                            >
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant='ghost'
                                  size='icon'
                                  className='h-8 w-8'
                                >
                                  <MoreVertical className='w-4 h-4' />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align='end'>
                                <DropdownMenuItem
                                  onClick={() => handleViewDetails(ticket.id)}
                                >
                                  <Eye className='w-4 h-4 mr-2' />
                                  Visualizar Detalhes
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleEdit(ticket.id)}
                                >
                                  <Edit className='w-4 h-4 mr-2' />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setAssigningTicket(ticket)}
                                >
                                  <UserPlus className='w-4 h-4 mr-2' />
                                  Atribuir Técnico
                                </DropdownMenuItem>
                                {ticket.status !== 'CANCELADO' &&
                                  ticket.status !== 'CONCLUÍDO' && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setCancellingTicket(ticket)
                                      }
                                      className='text-red-600 dark:text-red-400'
                                    >
                                      <Ban className='w-4 h-4 mr-2' />
                                      Cancelar
                                    </DropdownMenuItem>
                                  )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className='h-16 px-4 py-2 text-center text-gray-500'
                      >
                        Nenhum chamado encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          /* Visualização Kanban */
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'>
            {Object.entries(kanbanColumns).map(([status, statusTickets]) => (
              <div key={status} className='flex flex-col'>
                <div className='mb-2 flex items-center justify-between'>
                  <h3 className='text-sm font-semibold text-gray-700 dark:text-gray-300'>
                    {getStatusBadge(status).props.children}
                  </h3>
                  <Badge variant='secondary' className='text-xs'>
                    {statusTickets.length}
                  </Badge>
                </div>
                <div className='space-y-2 flex-1 overflow-y-auto max-h-[600px]'>
                  {statusTickets.map((ticket) => (
                    <Card
                      key={ticket.id}
                      className='p-3 hover:shadow-md transition-shadow cursor-pointer'
                      onClick={() => handleViewDetails(ticket.id)}
                    >
                      <div className='space-y-2'>
                        <div className='flex items-start justify-between'>
                          <span className='text-xs font-semibold text-gray-900 dark:text-white'>
                            {ticket.ticketNumber}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant='ghost'
                                size='icon'
                                className='h-6 w-6'
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className='w-3 h-3' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(ticket.id);
                                }}
                              >
                                <Eye className='w-4 h-4 mr-2' />
                                Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(ticket.id);
                                }}
                              >
                                <Edit className='w-4 h-4 mr-2' />
                                Editar
                              </DropdownMenuItem>
                              {!ticket.technicianName &&
                                (ticket.status === 'ABERTO' ||
                                  ticket.status === 'PENDENTE') && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAssigningTicket(ticket);
                                    }}
                                  >
                                    <UserPlus className='w-4 h-4 mr-2' />
                                    Atribuir Técnico
                                  </DropdownMenuItem>
                                )}
                              {ticket.technicianName && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAssigningTicket(ticket);
                                  }}
                                >
                                  <UserPlus className='w-4 h-4 mr-2' />
                                  Alterar Técnico
                                </DropdownMenuItem>
                              )}
                              {ticket.status !== 'CANCELADO' &&
                                ticket.status !== 'CONCLUÍDO' && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCancellingTicket(ticket);
                                    }}
                                    className='text-red-600 dark:text-red-400'
                                  >
                                    <Ban className='w-4 h-4 mr-2' />
                                    Cancelar
                                  </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <p className='text-sm font-medium text-gray-900 dark:text-white'>
                          {ticket.clientName}
                        </p>
                        <p className='text-xs text-gray-600 dark:text-gray-400'>
                          {ticket.serviceName}
                        </p>
                        <div className='flex items-center justify-between text-xs'>
                          <span className='text-gray-500 dark:text-gray-400'>
                            {ticket.technicianName || (
                              <span className='italic'>Não Atribuído</span>
                            )}
                          </span>
                          <span className='text-gray-500 dark:text-gray-400'>
                            {ticket.scheduledFor
                              ? format(
                                  new Date(ticket.scheduledFor),
                                  'dd/MM HH:mm',
                                  { locale: ptBR }
                                )
                              : '-'}
                          </span>
                        </div>
                        {!ticket.technicianName &&
                          (ticket.status === 'ABERTO' ||
                            ticket.status === 'PENDENTE') && (
                            <Button
                              variant='outline'
                              size='sm'
                              className='w-full mt-2 text-xs'
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssigningTicket(ticket);
                              }}
                            >
                              <UserPlus className='w-3 h-3 mr-1' />
                              Atribuir Técnico
                            </Button>
                          )}
                      </div>
                    </Card>
                  ))}
                  {statusTickets.length === 0 && (
                    <div className='text-center text-sm text-gray-400 dark:text-gray-500 py-8'>
                      Nenhum chamado
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dialog: Atribuir Técnico */}
        <Dialog
          open={!!assigningTicket}
          onOpenChange={() => {
            setAssigningTicket(null);
            setSelectedTechnicianId(null);
            setTechnicianSearch('');
          }}
        >
          <DialogContent className='w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col'>
            <DialogHeader className='flex-shrink-0'>
              <div className='flex items-center justify-between'>
                <DialogTitle className='text-xl font-bold'>
                  Atribuir Técnico ao Chamado #{assigningTicket?.ticketNumber}
                </DialogTitle>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8'
                  onClick={() => {
                    setAssigningTicket(null);
                    setSelectedTechnicianId(null);
                    setTechnicianSearch('');
                  }}
                >
                  <X className='h-4 w-4' />
                </Button>
              </div>
              <DialogDescription className='sr-only'>
                Selecione o tecnico para este chamado.
              </DialogDescription>
            </DialogHeader>
            <div className='space-y-4 flex-1 overflow-hidden flex flex-col'>
              <div className='relative flex-shrink-0'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5' />
                <Input
                  className='w-full h-10 pl-10 pr-4'
                  placeholder='Buscar por nome ou especialidade...'
                  value={technicianSearch}
                  onChange={(e) => setTechnicianSearch(e.target.value)}
                />
              </div>
              <div className='flex flex-col gap-3 flex-1 overflow-y-auto pr-2'>
                {techniciansError ? (
                  <p className='text-center text-red-500 dark:text-red-400 py-8'>
                    Erro ao carregar técnicos. Tente novamente.
                  </p>
                ) : filteredTechnicians && filteredTechnicians.length > 0 ? (
                  filteredTechnicians.map((technician) => {
                    const status = getTechnicianStatus(technician);
                    const initials =
                      `${technician.firstName?.[0] || ''}${
                        technician.lastName?.[0] || ''
                      }`.toUpperCase() ||
                      technician.email?.[0].toUpperCase() ||
                      '?';
                    const isSelected = selectedTechnicianId === technician.id;
                    const isUnavailable = technician.status === 'unavailable';

                    return (
                      <div
                        key={technician.id}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-[#3880f5] bg-[#3880f5]/5'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        } ${isUnavailable ? 'opacity-60' : 'cursor-pointer'}`}
                        onClick={() =>
                          !isUnavailable && handleAssign(technician.id)
                        }
                      >
                        <div className='flex items-center gap-3 flex-1'>
                          <Avatar className='h-12 w-12'>
                            {technician.profileImageUrl ? (
                              <AvatarImage
                                src={technician.profileImageUrl}
                                alt={`${technician.firstName} ${technician.lastName}`}
                              />
                            ) : (
                              <AvatarFallback className='bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'>
                                {initials}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className='flex-1'>
                            <p className='text-sm font-medium text-gray-900 dark:text-white'>
                              {`${technician.firstName || ''} ${
                                technician.lastName || ''
                              }`.trim() || technician.email}
                            </p>
                            <div className='flex items-center gap-2 mt-1'>
                              <div className='flex items-center gap-1'>
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    status.color === 'green'
                                      ? 'bg-green-500'
                                      : status.color === 'yellow'
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                  }`}
                                />
                                <span className='text-xs text-gray-600 dark:text-gray-400'>
                                  {status.label}
                                </span>
                              </div>
                              <span className='text-xs text-gray-400 dark:text-gray-500'>
                                •
                              </span>
                              <span className='text-xs text-gray-600 dark:text-gray-400'>
                                {technician.ticketCount || 0} chamado
                                {technician.ticketCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          size='sm'
                          disabled={isUnavailable}
                          className={`${
                            isUnavailable
                              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                              : isSelected
                              ? 'bg-[#3880f5] hover:bg-[#3880f5]/90'
                              : 'bg-[#3880f5] hover:bg-[#3880f5]/90'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isUnavailable) {
                              handleAssign(technician.id);
                            }
                          }}
                        >
                          {isSelected ? (
                            <>
                              <CheckCircle2 className='h-4 w-4 mr-2' />
                              Selecionado
                            </>
                          ) : (
                            'Atribuir'
                          )}
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <p className='text-center text-gray-500 dark:text-gray-400 py-8'>
                    Nenhum técnico encontrado
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className='flex-shrink-0 border-t pt-4 mt-4'>
              <Button
                variant='outline'
                onClick={() => {
                  setAssigningTicket(null);
                  setSelectedTechnicianId(null);
                  setTechnicianSearch('');
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmAssignment}
                disabled={!selectedTechnicianId || assignMutation.isPending}
                className='bg-[#3880f5] hover:bg-[#3880f5]/90'
              >
                {assignMutation.isPending ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Atribuindo...
                  </>
                ) : (
                  'Confirmar Atribuição'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Cancelar Chamado */}
        <Dialog
          open={!!cancellingTicket}
          onOpenChange={() => {
            setCancellingTicket(null);
            setCancelReason('');
          }}
        >
          <DialogContent className='w-full max-w-md'>
            <DialogHeader>
              <DialogTitle>
                Cancelar Chamado {cancellingTicket?.ticketNumber}
              </DialogTitle>
              <DialogDescription className='sr-only'>
                Informe o motivo do cancelamento do chamado.
              </DialogDescription>
            </DialogHeader>
            <div className='space-y-4'>
              <div>
                <label className='text-sm font-medium mb-2 block'>
                  Motivo do Cancelamento
                </label>
                <Input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder='Digite o motivo do cancelamento...'
                />
              </div>
              <div className='flex justify-end gap-2'>
                <Button
                  variant='outline'
                  onClick={() => {
                    setCancellingTicket(null);
                    setCancelReason('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCancel}
                  disabled={!cancelReason.trim() || cancelMutation.isPending}
                  className='bg-red-600 hover:bg-red-700'
                >
                  {cancelMutation.isPending
                    ? 'Cancelando...'
                    : 'Confirmar Cancelamento'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}