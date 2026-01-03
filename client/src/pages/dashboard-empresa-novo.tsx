import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiRequest } from '@/lib/queryClient';
import {
  ArrowUp,
  ArrowDown,
  Ticket,
  Users,
  UserCog,
  Briefcase,
  Calendar,
  TrendingUp,
  DollarSign,
  Send,
  Settings,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

interface CompanyStats {
  partnerTechnicians: number;
  partnerTechniciansChange: number;
  managedClients: number;
  managedClientsChange: number;
  activeTickets: number;
  activeTicketsChange: number;
  consolidatedBilling: number;
  consolidatedBillingChange: number;
  employees: number;
  employeesChange: number;
}

const periodOptions = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '14', label: 'Últimos 14 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '60', label: 'Últimos 60 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: '365', label: 'Último ano' },
];

type DashboardCategory = 'chamados' | 'clientes' | 'tecnicos' | 'colaboradores';

export default function DashboardEmpresaNovo() {
  const [category, setCategory] = useState<DashboardCategory>('chamados');
  const [period, setPeriod] = useState('30');
  const { user, isAuthenticated } = useAuth();

  const { data: stats, isLoading } = useQuery<CompanyStats>({
    queryKey: ['/api/company/dashboard', period],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/company/dashboard?period=${period}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar dashboard');
      return response.json();
    },
    enabled: !!user && isAuthenticated && user.role === 'company',
    retry: false,
  });

  // Buscar dados específicos para cada categoria
  const { data: technicians } = useQuery({
    queryKey: ['/api/company/technicians'],
    queryFn: async () => {
      if (category !== 'tecnicos') return null;
      try {
        const response = await apiRequest(
          'GET',
          '/api/company/technicians',
          undefined
        );
        if (!response.ok) return [];
        return response.json();
      } catch (error) {
        console.error('Erro ao buscar técnicos:', error);
        return [];
      }
    },
    enabled: category === 'tecnicos',
  });

  const { data: employees } = useQuery({
    queryKey: ['/api/company/users'],
    queryFn: async () => {
      if (category !== 'colaboradores') return null;
      try {
        const response = await apiRequest(
          'GET',
          '/api/company/users',
          undefined
        );
        if (!response.ok) return [];
        return response.json();
      } catch (error) {
        console.error('Erro ao buscar colaboradores:', error);
        return [];
      }
    },
    enabled: category === 'colaboradores',
  });

  const { data: clients } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      if (category !== 'clientes') return null;
      try {
        // Usar a API de clients padrão
        const response = await apiRequest('GET', '/api/clients', undefined);
        if (!response.ok) return [];
        return response.json();
      } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        return [];
      }
    },
    enabled: category === 'clientes',
  });

  const { data: tickets } = useQuery({
    queryKey: ['/api/tickets/queue'],
    queryFn: async () => {
      if (category !== 'chamados') return null;
      try {
        // Usar a API de fila de tickets da empresa
        const response = await apiRequest(
          'GET',
          '/api/tickets/queue?',
          undefined
        );
        if (!response.ok) return [];
        return response.json();
      } catch (error) {
        console.error('Erro ao buscar tickets:', error);
        return [];
      }
    },
    enabled: category === 'chamados',
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  const formatChange = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(0)}%`;
  };

  const getPeriodLabel = () => {
    return (
      periodOptions.find((opt) => opt.value === period)?.label ||
      'Últimos 30 dias'
    );
  };

  // Dashboard de Chamados
  const renderChamadosDashboard = () => (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Chamados Ativos
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            {stats?.activeTickets || 0}
          </p>
          <p
            className={`text-sm font-medium leading-normal flex items-center ${
              (stats?.activeTicketsChange || 0) >= 0
                ? 'text-green-600 dark:text-green-500'
                : 'text-red-600 dark:text-red-500'
            }`}
          >
            {(stats?.activeTicketsChange || 0) >= 0 ? (
              <ArrowUp className='w-4 h-4 mr-1' />
            ) : (
              <ArrowDown className='w-4 h-4 mr-1' />
            )}
            {formatChange(stats?.activeTicketsChange || 0)}
          </p>
        </Card>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Em Progresso
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            {Math.floor((stats?.activeTickets || 0) * 0.4)}
          </p>
          <p className='text-sm font-medium leading-normal text-gray-500 dark:text-gray-400'>
            {getPeriodLabel()}
          </p>
        </Card>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Pendentes
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            {Math.floor((stats?.activeTickets || 0) * 0.3)}
          </p>
          <p className='text-sm font-medium leading-normal text-gray-500 dark:text-gray-400'>
            {getPeriodLabel()}
          </p>
        </Card>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Concluídos
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            {Math.floor((stats?.activeTickets || 0) * 1.2)}
          </p>
          <p className='text-sm font-medium leading-normal text-gray-500 dark:text-gray-400'>
            {getPeriodLabel()}
          </p>
        </Card>
      </div>

      {/* Gráficos e Visualizações */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              Visão Geral de Chamados
            </h3>
            <Link href='/fila-chamados-empresa'>
              <Button variant='outline' size='sm'>
                Ver Todos
              </Button>
            </Link>
          </div>
          <div className='grid min-h-[200px] grid-flow-col gap-6 grid-rows-[1fr_auto] items-end justify-items-center px-3 pt-4'>
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(
              (label, index) => (
                <div key={label} className='flex flex-col items-center gap-2'>
                  <div
                    className='bg-[#3880f5]/20 dark:bg-[#3880f5]/40 w-full rounded-t'
                    style={{ height: `${60 + Math.random() * 40}%` }}
                  ></div>
                  <p className='text-gray-500 dark:text-gray-400 text-[13px] font-bold leading-normal tracking-[0.015em]'>
                    {label}
                  </p>
                </div>
              )
            )}
          </div>
        </Card>
        <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              Chamados por Status
            </h3>
          </div>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  Abertos
                </span>
                <span className='text-sm font-semibold text-gray-900 dark:text-white'>
                  {Math.floor((stats?.activeTickets || 0) * 0.4)}
                </span>
              </div>
              <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                <div
                  className='h-full bg-blue-500 rounded-full'
                  style={{ width: '40%' }}
                ></div>
              </div>
            </div>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  Em Progresso
                </span>
                <span className='text-sm font-semibold text-gray-900 dark:text-white'>
                  {Math.floor((stats?.activeTickets || 0) * 0.3)}
                </span>
              </div>
              <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                <div
                  className='h-full bg-yellow-500 rounded-full'
                  style={{ width: '30%' }}
                ></div>
              </div>
            </div>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  Pendentes
                </span>
                <span className='text-sm font-semibold text-gray-900 dark:text-white'>
                  {Math.floor((stats?.activeTickets || 0) * 0.2)}
                </span>
              </div>
              <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                <div
                  className='h-full bg-orange-500 rounded-full'
                  style={{ width: '20%' }}
                ></div>
              </div>
            </div>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  Concluídos
                </span>
                <span className='text-sm font-semibold text-gray-900 dark:text-white'>
                  {Math.floor((stats?.activeTickets || 0) * 0.1)}
                </span>
              </div>
              <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                <div
                  className='h-full bg-green-500 rounded-full'
                  style={{ width: '10%' }}
                ></div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabela de Chamados Recentes */}
      <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            Chamados Recentes
          </h3>
          <Link href='/fila-chamados-empresa'>
            <Button variant='outline' size='sm'>
              Ver Todos
            </Button>
          </Link>
        </div>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow className='text-xs text-gray-500 dark:text-gray-400 uppercase bg-[#f5f7f8] dark:bg-gray-800/50'>
                <TableHead className='px-6 py-3'>ID</TableHead>
                <TableHead className='px-6 py-3'>Cliente</TableHead>
                <TableHead className='px-6 py-3'>Serviço</TableHead>
                <TableHead className='px-6 py-3'>Status</TableHead>
                <TableHead className='px-6 py-3'>Data</TableHead>
                <TableHead className='px-6 py-3 text-right'>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets && tickets.length > 0 ? (
                tickets.slice(0, 5).map((ticket: any) => (
                  <TableRow
                    key={ticket.id}
                    className='border-t border-gray-200 dark:border-gray-800'
                  >
                    <TableCell className='px-6 py-4 font-medium text-gray-900 dark:text-white'>
                      #{ticket.id?.slice(0, 8) || 'N/A'}
                    </TableCell>
                    <TableCell className='px-6 py-4 text-gray-600 dark:text-gray-300'>
                      {ticket.clientName || 'N/A'}
                    </TableCell>
                    <TableCell className='px-6 py-4 text-gray-600 dark:text-gray-300'>
                      {ticket.serviceName || 'N/A'}
                    </TableCell>
                    <TableCell className='px-6 py-4'>
                      <Badge
                        className={
                          ticket.status === 'completed'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                            : ticket.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                        }
                      >
                        {ticket.status || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className='px-6 py-4 text-gray-600 dark:text-gray-300'>
                      {ticket.createdAt
                        ? format(new Date(ticket.createdAt), 'dd/MM/yyyy', {
                            locale: ptBR,
                          })
                        : 'N/A'}
                    </TableCell>
                    <TableCell className='px-6 py-4 text-right'>
                      <Link href={`/chamado/${ticket.id}`}>
                        <Button variant='link' size='sm'>
                          Ver Detalhes
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className='border-t border-gray-200 dark:border-gray-800'>
                  <TableCell
                    colSpan={6}
                    className='px-6 py-8 text-center text-gray-500 dark:text-gray-400'
                  >
                    Nenhum chamado encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );

  // Dashboard de Clientes
  const renderClientesDashboard = () => (
    <div className='space-y-6'>
      {/* Cards de Métricas Principais */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Clientes Gerenciados
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            {stats?.managedClients || 0}
          </p>
          <p
            className={`text-sm font-medium leading-normal flex items-center ${
              (stats?.managedClientsChange || 0) >= 0
                ? 'text-green-600 dark:text-green-500'
                : 'text-red-600 dark:text-red-500'
            }`}
          >
            {(stats?.managedClientsChange || 0) >= 0 ? (
              <ArrowUp className='w-4 h-4 mr-1' />
            ) : (
              <ArrowDown className='w-4 h-4 mr-1' />
            )}
            {formatChange(stats?.managedClientsChange || 0)}
          </p>
        </Card>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            // Novos Clientes
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            {Math.floor((stats?.managedClients || 0) * 0.15)}
          </p>
          <p className='text-sm font-medium leading-normal text-gray-500 dark:text-gray-400'>
            {getPeriodLabel()}
          </p>
        </Card>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Clientes Ativos
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            {Math.floor((stats?.managedClients || 0) * 0.85)}
          </p>
          <p className='text-sm font-medium leading-normal text-gray-500 dark:text-gray-400'>
            {getPeriodLabel()}
          </p>
        </Card>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Taxa de Retenção
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            92%
          </p>
          <p className='text-sm font-medium leading-normal text-gray-500 dark:text-gray-400'>
            {getPeriodLabel()}
          </p>
        </Card>
      </div>

      {/* Gráficos e Visualizações */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              Crescimento de Clientes
            </h3>
            <Link href='/gestao-clientes-empresa'>
              <Button variant='outline' size='sm'>
                Gerenciar Clientes
              </Button>
            </Link>
          </div>
          <div className='flex min-h-[200px] flex-1 flex-col gap-8 py-4'>
            <div className='h-full w-full bg-gradient-to-t from-[#3880f5]/20 to-transparent rounded'></div>
          </div>
        </Card>
        <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              Distribuição por Status
            </h3>
          </div>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  Clientes Ativos
                </span>
                <span className='text-sm font-semibold text-gray-900 dark:text-white'>
                  {Math.floor((stats?.managedClients || 0) * 0.85)}
                </span>
              </div>
              <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                <div
                  className='h-full bg-green-500 rounded-full'
                  style={{ width: '85%' }}
                ></div>
              </div>
            </div>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  Clientes Inativos
                </span>
                <span className='text-sm font-semibold text-gray-900 dark:text-white'>
                  {Math.floor((stats?.managedClients || 0) * 0.15)}
                </span>
              </div>
              <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                <div
                  className='h-full bg-gray-400 rounded-full'
                  style={{ width: '15%' }}
                ></div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center justify-center size-12 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-500 dark:text-blue-400'>
              <Users className='w-6 h-6' />
            </div>
            <div className='flex-1'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-1'>
                Gerenciar Clientes
              </h3>
              <p className='text-sm text-gray-500 dark:text-gray-400 mb-3'>
                Adicione novos clientes e gerencie informações.
              </p>
              <Link href='/gestao-clientes-empresa'>
                <Button className='w-full bg-[#3880f5] hover:bg-[#3880f5]/90'>
                  Acessar Gestão
                </Button>
              </Link>
            </div>
          </div>
        </Card>
        <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center justify-center size-12 rounded-full bg-green-100 dark:bg-green-900/50 text-green-500 dark:text-green-400'>
              <TrendingUp className='w-6 h-6' />
            </div>
            <div className='flex-1'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-1'>
                Relatórios de Clientes
              </h3>
              <p className='text-sm text-gray-500 dark:text-gray-400 mb-3'>
                Visualize relatórios detalhados sobre seus clientes.
              </p>
              <Link href='/relatorios'>
                <Button variant='outline' className='w-full'>
                  Ver Relatórios
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabela de Clientes Recentes */}
      <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            Clientes Recentes
          </h3>
          <Link href='/gestao-clientes-empresa'>
            <Button variant='outline' size='sm'>
              Ver Todos
            </Button>
          </Link>
        </div>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow className='text-xs text-gray-500 dark:text-gray-400 uppercase bg-[#f5f7f8] dark:bg-gray-800/50'>
                <TableHead className='px-6 py-3'>Nome</TableHead>
                <TableHead className='px-6 py-3'>Email</TableHead>
                <TableHead className='px-6 py-3'>Telefone</TableHead>
                <TableHead className='px-6 py-3'>Status</TableHead>
                <TableHead className='px-6 py-3 text-right'>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients && clients.length > 0 ? (
                clients.slice(0, 5).map((client: any) => (
                  <TableRow
                    key={client.id}
                    className='border-t border-gray-200 dark:border-gray-800'
                  >
                    <TableCell className='px-6 py-4 font-medium text-gray-900 dark:text-white'>
                      {client.name ||
                        client.firstName + ' ' + client.lastName ||
                        'N/A'}
                    </TableCell>
                    <TableCell className='px-6 py-4 text-gray-600 dark:text-gray-300'>
                      {client.email || 'N/A'}
                    </TableCell>
                    <TableCell className='px-6 py-4 text-gray-600 dark:text-gray-300'>
                      {client.phone || 'N/A'}
                    </TableCell>
                    <TableCell className='px-6 py-4'>
                      <Badge
                        className={
                          client.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300'
                        }
                      >
                        {client.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className='px-6 py-4 text-right'>
                      <Link href={`/clientes/${client.id}`}>
                        <Button variant='link' size='sm'>
                          Ver Detalhes
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className='border-t border-gray-200 dark:border-gray-800'>
                  <TableCell
                    colSpan={5}
                    className='px-6 py-8 text-center text-gray-500 dark:text-gray-400'
                  >
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );

  // Dashboard de Técnicos
  const renderTecnicosDashboard = () => (
    <div className='space-y-6'>
      {/* Cards de Métricas Principais */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Técnicos Parceiros
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            {stats?.partnerTechnicians || 0}
          </p>
          <p
            className={`text-sm font-medium leading-normal flex items-center ${
              (stats?.partnerTechniciansChange || 0) >= 0
                ? 'text-green-600 dark:text-green-500'
                : 'text-red-600 dark:text-red-500'
            }`}
          >
            {(stats?.partnerTechniciansChange || 0) >= 0 ? (
              <ArrowUp className='w-4 h-4 mr-1' />
            ) : (
              <ArrowDown className='w-4 h-4 mr-1' />
            )}
            {formatChange(stats?.partnerTechniciansChange || 0)}
          </p>
        </Card>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Técnicos Ativos
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            {Math.floor((stats?.partnerTechnicians || 0) * 0.9)}
          </p>
          <p className='text-sm font-medium leading-normal text-gray-500 dark:text-gray-400'>
            {getPeriodLabel()}
          </p>
        </Card>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Média de Chamados/Técnico
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            {stats?.partnerTechnicians
              ? Math.floor(
                  (stats?.activeTickets || 0) / stats.partnerTechnicians
                )
              : 0}
          </p>
          <p className='text-sm font-medium leading-normal text-gray-500 dark:text-gray-400'>
            {getPeriodLabel()}
          </p>
        </Card>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Performance Média
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            4.8/5
          </p>
          <p className='text-sm font-medium leading-normal text-gray-500 dark:text-gray-400'>
            Avaliação
          </p>
        </Card>
      </div>

      {/* Gráficos e Visualizações */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              Performance dos Técnicos
            </h3>
            <Link href='/tecnicos-parceiros'>
              <Button variant='outline' size='sm'>
                Ver Todos
              </Button>
            </Link>
          </div>
          <div className='grid min-h-[200px] grid-flow-col gap-6 grid-rows-[1fr_auto] items-end justify-items-center px-3 pt-4'>
            {['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'].map((label, index) => (
              <div key={label} className='flex flex-col items-center gap-2'>
                <div
                  className='bg-[#3880f5]/20 dark:bg-[#3880f5]/40 w-full rounded-t'
                  style={{ height: `${60 + Math.random() * 40}%` }}
                ></div>
                <p className='text-gray-500 dark:text-gray-400 text-[13px] font-bold leading-normal tracking-[0.015em]'>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              Distribuição de Técnicos
            </h3>
          </div>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  Técnicos Disponíveis
                </span>
                <span className='text-sm font-semibold text-gray-900 dark:text-white'>
                  {Math.floor((stats?.partnerTechnicians || 0) * 0.7)}
                </span>
              </div>
              <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                <div
                  className='h-full bg-[#3880f5] rounded-full'
                  style={{ width: '70%' }}
                ></div>
              </div>
            </div>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-gray-600 dark:text-gray-400'>
                  Técnicos em Atendimento
                </span>
                <span className='text-sm font-semibold text-gray-900 dark:text-white'>
                  {Math.floor((stats?.partnerTechnicians || 0) * 0.3)}
                </span>
              </div>
              <div className='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                <div
                  className='h-full bg-green-500 rounded-full'
                  style={{ width: '30%' }}
                ></div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center justify-center size-12 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-500 dark:text-blue-400'>
              <Briefcase className='w-6 h-6' />
            </div>
            <div className='flex-1'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-1'>
                Gerenciar Técnicos
              </h3>
              <p className='text-sm text-gray-500 dark:text-gray-400 mb-3'>
                Adicione novos técnicos e gerencie parcerias.
              </p>
              <Link href='/tecnicos-parceiros'>
                <Button className='w-full bg-[#3880f5] hover:bg-[#3880f5]/90'>
                  Acessar Gestão
                </Button>
              </Link>
            </div>
          </div>
        </Card>
        <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center justify-center size-12 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-500 dark:text-purple-400'>
              <Send className='w-6 h-6' />
            </div>
            <div className='flex-1'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-1'>
                Convites de Parceria
              </h3>
              <p className='text-sm text-gray-500 dark:text-gray-400 mb-3'>
                Envie convites para novos técnicos parceiros.
              </p>
              <Link href='/gestao-convites'>
                <Button variant='outline' className='w-full'>
                  Gerenciar Convites
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabela de Técnicos */}
      <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            Técnicos Parceiros
          </h3>
          <Link href='/tecnicos-parceiros'>
            <Button variant='outline' size='sm'>
              Ver Todos
            </Button>
          </Link>
        </div>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow className='text-xs text-gray-500 dark:text-gray-400 uppercase bg-[#f5f7f8] dark:bg-gray-800/50'>
                <TableHead className='px-6 py-3'>Nome</TableHead>
                <TableHead className='px-6 py-3'>Email</TableHead>
                <TableHead className='px-6 py-3'>Chamados</TableHead>
                <TableHead className='px-6 py-3'>Performance</TableHead>
                <TableHead className='px-6 py-3 text-right'>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {technicians && technicians.length > 0 ? (
                technicians.slice(0, 5).map((technician: any) => (
                  <TableRow
                    key={technician.id || technician.technician_id}
                    className='border-t border-gray-200 dark:border-gray-800'
                  >
                    <TableCell className='px-6 py-4 font-medium text-gray-900 dark:text-white'>
                      {technician.name ||
                        technician.firstName + ' ' + technician.lastName ||
                        'N/A'}
                    </TableCell>
                    <TableCell className='px-6 py-4 text-gray-600 dark:text-gray-300'>
                      {technician.email || 'N/A'}
                    </TableCell>
                    <TableCell className='px-6 py-4 text-gray-600 dark:text-gray-300'>
                      {technician.ticketsCount || 0}
                    </TableCell>
                    <TableCell className='px-6 py-4 text-gray-600 dark:text-gray-300'>
                      {technician.rating || '4.8'}/5
                    </TableCell>
                    <TableCell className='px-6 py-4 text-right'>
                      <Badge
                        className={
                          technician.status === 'accepted'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                        }
                      >
                        {technician.status === 'accepted'
                          ? 'Ativo'
                          : 'Pendente'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className='border-t border-gray-200 dark:border-gray-800'>
                  <TableCell
                    colSpan={5}
                    className='px-6 py-8 text-center text-gray-500 dark:text-gray-400'
                  >
                    Nenhum técnico encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );

  // Dashboard de Colaboradores
  const renderColaboradoresDashboard = () => (
    <div className='space-y-6'>
      {/* Cards de Métricas Principais */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Total de Colaboradores
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            {stats?.employees || 0}
          </p>
          <p
            className={`text-sm font-medium leading-normal flex items-center ${
              (stats?.employeesChange || 0) >= 0
                ? 'text-green-600 dark:text-green-500'
                : 'text-red-600 dark:text-red-500'
            }`}
          >
            {(stats?.employeesChange || 0) >= 0 ? (
              <ArrowUp className='w-4 h-4 mr-1' />
            ) : (
              <ArrowDown className='w-4 h-4 mr-1' />
            )}
            {formatChange(stats?.employeesChange || 0)}
          </p>
        </Card>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Colaboradores Ativos
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            {Math.floor((stats?.employees || 0) * 0.95)}
          </p>
          <p className='text-sm font-medium leading-normal text-gray-500 dark:text-gray-400'>
            {getPeriodLabel()}
          </p>
        </Card>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            // Novos Contratos
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            {Math.floor((stats?.employees || 0) * 0.1)}
          </p>
          <p className='text-sm font-medium leading-normal text-gray-500 dark:text-gray-400'>
            {getPeriodLabel()}
          </p>
        </Card>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#101722] border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Taxa de Engajamento
          </p>
          <p className='text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight'>
            88%
          </p>
          <p className='text-sm font-medium leading-normal text-gray-500 dark:text-gray-400'>
            {getPeriodLabel()}
          </p>
        </Card>
      </div>

      {/* Gráficos e Visualizações */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              Crescimento de Colaboradores
            </h3>
            <Link href='/gerenciamento-colaboradores-empresa'>
              <Button variant='outline' size='sm'>
                Gerenciar
              </Button>
            </Link>
          </div>
          <div className='flex min-h-[200px] flex-1 flex-col gap-8 py-4'>
            <div className='h-full w-full bg-gradient-to-t from-[#3880f5]/20 to-transparent rounded'></div>
          </div>
        </Card>
        <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              Status dos Colaboradores
            </h3>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50'>
              <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                {Math.floor((stats?.employees || 0) * 0.6)}
              </p>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                Em Treinamento
              </p>
            </div>
            <div className='text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50'>
              <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                {Math.floor((stats?.employees || 0) * 0.3)}
              </p>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                Em Atendimento
              </p>
            </div>
            <div className='text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50'>
              <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                {Math.floor((stats?.employees || 0) * 0.1)}
              </p>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                Disponíveis
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center justify-center size-12 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-500 dark:text-blue-400'>
              <UserCog className='w-6 h-6' />
            </div>
            <div className='flex-1'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-1'>
                Gerenciar Colaboradores
              </h3>
              <p className='text-sm text-gray-500 dark:text-gray-400 mb-3'>
                Adicione novos colaboradores e gerencie permissões.
              </p>
              <Link href='/gerenciamento-colaboradores-empresa'>
                <Button className='w-full bg-[#3880f5] hover:bg-[#3880f5]/90'>
                  Acessar Gestão
                </Button>
              </Link>
            </div>
          </div>
        </Card>
        <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center justify-center size-12 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-500 dark:text-orange-400'>
              <Settings className='w-6 h-6' />
            </div>
            <div className='flex-1'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-1'>
                Permissões e Acessos
              </h3>
              <p className='text-sm text-gray-500 dark:text-gray-400 mb-3'>
                Configure permissões e acessos dos colaboradores.
              </p>
              <Link href='/configuracoes'>
                <Button variant='outline' className='w-full'>
                  Configurar
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabela de Colaboradores */}
      <Card className='p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            Colaboradores
          </h3>
          <Link href='/gerenciamento-colaboradores-empresa'>
            <Button variant='outline' size='sm'>
              Ver Todos
            </Button>
          </Link>
        </div>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow className='text-xs text-gray-500 dark:text-gray-400 uppercase bg-[#f5f7f8] dark:bg-gray-800/50'>
                <TableHead className='px-6 py-3'>Nome</TableHead>
                <TableHead className='px-6 py-3'>Email</TableHead>
                <TableHead className='px-6 py-3'>Cargo</TableHead>
                <TableHead className='px-6 py-3'>Status</TableHead>
                <TableHead className='px-6 py-3 text-right'>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees && employees.length > 0 ? (
                employees.slice(0, 5).map((employee: any) => (
                  <TableRow
                    key={employee.id || employee.user_id}
                    className='border-t border-gray-200 dark:border-gray-800'
                  >
                    <TableCell className='px-6 py-4 font-medium text-gray-900 dark:text-white'>
                      {employee.name ||
                        employee.firstName + ' ' + employee.lastName ||
                        'N/A'}
                    </TableCell>
                    <TableCell className='px-6 py-4 text-gray-600 dark:text-gray-300'>
                      {employee.email || 'N/A'}
                    </TableCell>
                    <TableCell className='px-6 py-4 text-gray-600 dark:text-gray-300'>
                      {employee.role || 'Colaborador'}
                    </TableCell>
                    <TableCell className='px-6 py-4'>
                      <Badge className='bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'>
                        Ativo
                      </Badge>
                    </TableCell>
                    <TableCell className='px-6 py-4 text-right'>
                      <Link
                        href={`/colaboradores/${
                          employee.id || employee.user_id
                        }`}
                      >
                        <Button variant='link' size='sm'>
                          Ver Detalhes
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className='border-t border-gray-200 dark:border-gray-800'>
                  <TableCell
                    colSpan={5}
                    className='px-6 py-8 text-center text-gray-500 dark:text-gray-400'
                  >
                    Nenhum colaborador encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );

  const renderDashboardContent = () => {
    switch (category) {
      case 'chamados':
        return renderChamadosDashboard();
      case 'clientes':
        return renderClientesDashboard();
      case 'tecnicos':
        return renderTecnicosDashboard();
      case 'colaboradores':
        return renderColaboradoresDashboard();
      default:
        return renderChamadosDashboard();
    }
  };

  return (
    <div className='space-y-6'>
      {/* Header com Tabs e Período */}
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
            Dashboard da Empresa
          </h1>
          <p className='text-gray-500 dark:text-gray-400 text-base font-normal leading-normal'>
            Visão geral estratégica das suas operações de serviço.
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className='h-10 w-[200px]'>
            <Calendar className='w-4 h-4 mr-2' />
            <SelectValue>
              {periodOptions.find((opt) => opt.value === period)?.label ||
                'Últimos 30 dias'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Menu Superior de Navegação entre Dashboards */}
      <div className='border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
        <nav className='flex space-x-1 px-1' aria-label='Tabs'>
          <button
            onClick={() => setCategory('chamados')}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-colors
              ${
                category === 'chamados'
                  ? 'bg-white dark:bg-gray-800 text-[#3880f5] border-b-2 border-[#3880f5]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }
            `}
          >
            <Ticket className='w-4 h-4' />
            <span>Chamados</span>
          </button>
          <button
            onClick={() => setCategory('clientes')}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-colors
              ${
                category === 'clientes'
                  ? 'bg-white dark:bg-gray-800 text-[#3880f5] border-b-2 border-[#3880f5]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }
            `}
          >
            <Users className='w-4 h-4' />
            <span>Clientes</span>
          </button>
          <button
            onClick={() => setCategory('tecnicos')}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-colors
              ${
                category === 'tecnicos'
                  ? 'bg-white dark:bg-gray-800 text-[#3880f5] border-b-2 border-[#3880f5]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }
            `}
          >
            <Briefcase className='w-4 h-4' />
            <span>Técnicos</span>
          </button>
          <button
            onClick={() => setCategory('colaboradores')}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-colors
              ${
                category === 'colaboradores'
                  ? 'bg-white dark:bg-gray-800 text-[#3880f5] border-b-2 border-[#3880f5]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }
            `}
          >
            <UserCog className='w-4 h-4' />
            <span>Colaboradores</span>
          </button>
        </nav>
      </div>

      {/* Conteúdo do Dashboard selecionado */}
      {isLoading ? (
        <div className='flex items-center justify-center h-64'>
          <p className='text-gray-500 dark:text-gray-400'>Carregando...</p>
        </div>
      ) : (
        renderDashboardContent()
      )}
    </div>
  );
}