import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Download, Timer, Hourglass, PieChart } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ModalExportacaoPdfCompleta2 from '@/pages/modal-exportacao-pdf-completa-2';

interface ReportData {
  sla: string;
  tmr: string;
  ocupacao: number;
  tickets: Array<{
    id: string;
    clientName: string;
    technicianName: string;
    date: string;
    serviceName: string;
    status: string;
  }>;
}

export default function Relatorios2() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('all');
  const [technician, setTechnician] = useState('all');
  const [clientType, setClientType] = useState('all');
  const [service, setService] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');

  const { data: reportData, isLoading } = useQuery<ReportData>({
    queryKey: [
      '/api/reports',
      startDate,
      endDate,
      location,
      technician,
      clientType,
      service,
      paymentStatus,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (location !== 'all') params.append('location', location);
      if (technician !== 'all') params.append('technician', technician);
      if (clientType !== 'all') params.append('clientType', clientType);
      if (service !== 'all') params.append('service', service);
      if (paymentStatus !== 'all')
        params.append('paymentStatus', paymentStatus);
      const response = await apiRequest(
        'GET',
        `/api/reports?${params.toString()}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar relatórios');
      return response.json();
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Concluído':
        return (
          <Badge className='inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'>
            Concluído
          </Badge>
        );
      case 'Em andamento':
        return (
          <Badge className='inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'>
            Em andamento
          </Badge>
        );
      case 'Pendente':
        return (
          <Badge className='inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'>
            Pendente
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className='font-display bg-background-light dark:bg-background-dark'>
      <div className='relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden'>
        <div className='flex min-h-screen'>
          {/* SideNavBar */}
          <div className='flex h-full min-h-screen flex-col justify-between bg-white dark:bg-background-dark dark:border-r dark:border-white/10 p-4 w-64'>
            <div className='flex flex-col gap-4'>
              <div className='flex gap-3 items-center'>
                <div className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-primary/20'></div>
                <div className='flex flex-col'>
                  <h1 className='text-gray-900 dark:text-white text-base font-medium leading-normal'>
                    ChamadosPro
                  </h1>
                  <p className='text-gray-500 dark:text-gray-400 text-sm font-normal leading-normal'>
                    Gestão de Serviços
                  </p>
                </div>
              </div>
              <div className='flex flex-col gap-2 mt-4'>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors'
                  href='#'
                >
                  <span>📊</span>
                  <p className='text-gray-900 dark:text-gray-200 text-sm font-medium leading-normal'>
                    Dashboard
                  </p>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors'
                  href='#'
                >
                  <span>👥</span>
                  <p className='text-gray-900 dark:text-gray-200 text-sm font-medium leading-normal'>
                    Clientes
                  </p>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors'
                  href='#'
                >
                  <span>🎫</span>
                  <p className='text-gray-900 dark:text-gray-200 text-sm font-medium leading-normal'>
                    Chamados
                  </p>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors'
                  href='#'
                >
                  <span>📅</span>
                  <p className='text-gray-900 dark:text-gray-200 text-sm font-medium leading-normal'>
                    Agenda
                  </p>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 dark:bg-primary/20'
                  href='#'
                >
                  <span>📈</span>
                  <p className='text-primary dark:text-primary-400 text-sm font-medium leading-normal'>
                    Relatórios
                  </p>
                </a>
              </div>
            </div>
            <div className='flex flex-col gap-1'>
              <a
                className='flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors'
                href='#'
              >
                <span>⚙️</span>
                <p className='text-gray-900 dark:text-gray-200 text-sm font-medium leading-normal'>
                  Configurações
                </p>
              </a>
              <a
                className='flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors'
                href='#'
              >
                <span>🚪</span>
                <p className='text-gray-900 dark:text-gray-200 text-sm font-medium leading-normal'>
                  Sair
                </p>
              </a>
            </div>
          </div>

          {/* Main Content */}
          <main className='flex-1 p-8 overflow-y-auto'>
            <div className='max-w-7xl mx-auto'>
              {/* Breadcrumbs */}
              <div className='flex flex-wrap gap-2 mb-4'>
                <a
                  className='text-gray-500 dark:text-gray-400 text-sm font-medium leading-normal hover:text-primary'
                  href='#'
                >
                  Dashboard
                </a>
                <span className='text-gray-500 dark:text-gray-400 text-sm font-medium leading-normal'>
                  /
                </span>
                <span className='text-gray-900 dark:text-white text-sm font-medium leading-normal'>
                  Relatórios
                </span>
              </div>

              {/* PageHeading */}
              <div className='flex flex-wrap justify-between gap-4 items-center mb-8'>
                <div className='flex flex-col gap-1'>
                  <p className='text-gray-900 dark:text-white text-3xl font-bold leading-tight tracking-tight'>
                    Relatórios
                  </p>
                  <p className='text-gray-500 dark:text-gray-400 text-base font-normal leading-normal'>
                    Analise o desempenho e os resultados dos seus serviços.
                  </p>
                </div>
                <div className='flex items-center gap-3'>
                  <div className='relative inline-block text-left'>
                    <Button
                      aria-expanded='true'
                      aria-haspopup='true'
                      className='inline-flex w-full justify-center gap-x-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90'
                      onClick={() => setIsExportModalOpen(true)}
                    >
                      Exportar
                      <span>▼</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Page layout with Filters and Content */}
              <div className='grid grid-cols-1 lg:grid-cols-4 gap-8'>
                {/* Filters Panel */}
                <aside className='lg:col-span-1 bg-white dark:bg-background-dark dark:border dark:border-white/10 rounded-xl p-6 h-fit'>
                  <h2 className='text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-tight mb-6'>
                    Filtros
                  </h2>
                  <div className='flex flex-col gap-6'>
                    {/* Date Range Picker Placeholder */}
                    <div>
                      <Label
                        className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'
                        htmlFor='period'
                      >
                        Período
                      </Label>
                      <div className='grid grid-cols-2 gap-2'>
                        <Input
                          className='block w-full rounded-lg border-gray-300 dark:border-white/20 dark:bg-white/10 dark:text-white shadow-sm focus:border-primary focus:ring-primary text-sm'
                          id='start_date'
                          name='start_date'
                          type='date'
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                        <Input
                          className='block w-full rounded-lg border-gray-300 dark:border-white/20 dark:bg-white/10 dark:text-white shadow-sm focus:border-primary focus:ring-primary text-sm'
                          id='end_date'
                          name='end_date'
                          type='date'
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                    {/* Selects */}
                    <div>
                      <Label
                        className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'
                        htmlFor='location'
                      >
                        Estado/Cidade
                      </Label>
                      <Select value={location} onValueChange={setLocation}>
                        <SelectTrigger className='block w-full rounded-lg border-gray-300 dark:border-white/20 dark:bg-white/10 dark:text-white shadow-sm focus:border-primary focus:ring-primary text-sm'>
                          <SelectValue placeholder='Todos' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='all'>Todos</SelectItem>
                          <SelectItem value='sp'>São Paulo, SP</SelectItem>
                          <SelectItem value='rj'>Rio de Janeiro, RJ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label
                        className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'
                        htmlFor='technician'
                      >
                        Técnico
                      </Label>
                      <Select value={technician} onValueChange={setTechnician}>
                        <SelectTrigger className='block w-full rounded-lg border-gray-300 dark:border-white/20 dark:bg-white/10 dark:text-white shadow-sm focus:border-primary focus:ring-primary text-sm'>
                          <SelectValue placeholder='Todos' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='all'>Todos</SelectItem>
                          <SelectItem value='1'>João Silva</SelectItem>
                          <SelectItem value='2'>Maria Oliveira</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label
                        className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'
                        htmlFor='client_type'
                      >
                        Tipo de Cliente
                      </Label>
                      <Select value={clientType} onValueChange={setClientType}>
                        <SelectTrigger className='block w-full rounded-lg border-gray-300 dark:border-white/20 dark:bg-white/10 dark:text-white shadow-sm focus:border-primary focus:ring-primary text-sm'>
                          <SelectValue placeholder='Todos' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='all'>Todos</SelectItem>
                          <SelectItem value='PJ'>Pessoa Jurídica</SelectItem>
                          <SelectItem value='PF'>Pessoa Física</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label
                        className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'
                        htmlFor='service'
                      >
                        Serviço
                      </Label>
                      <Select value={service} onValueChange={setService}>
                        <SelectTrigger className='block w-full rounded-lg border-gray-300 dark:border-white/20 dark:bg-white/10 dark:text-white shadow-sm focus:border-primary focus:ring-primary text-sm'>
                          <SelectValue placeholder='Todos' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='all'>Todos</SelectItem>
                          <SelectItem value='1'>
                            Manutenção Preventiva
                          </SelectItem>
                          <SelectItem value='2'>Suporte Remoto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label
                        className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'
                        htmlFor='payment_status'
                      >
                        Status de Pagamento
                      </Label>
                      <Select
                        value={paymentStatus}
                        onValueChange={setPaymentStatus}
                      >
                        <SelectTrigger className='block w-full rounded-lg border-gray-300 dark:border-white/20 dark:bg-white/10 dark:text-white shadow-sm focus:border-primary focus:ring-primary text-sm'>
                          <SelectValue placeholder='Todos' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='all'>Todos</SelectItem>
                          <SelectItem value='paid'>Pago</SelectItem>
                          <SelectItem value='pending'>Pendente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Action Buttons */}
                    <div className='flex flex-col gap-3 pt-4 border-t border-gray-200 dark:border-white/10'>
                      <Button
                        className='w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90'
                        type='button'
                      >
                        Aplicar Filtros
                      </Button>
                      <Button
                        variant='outline'
                        className='w-full rounded-lg bg-gray-200 dark:bg-white/10 px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-white shadow-sm hover:bg-gray-300 dark:hover:bg-white/20'
                        type='button'
                        onClick={() => {
                          setStartDate('');
                          setEndDate('');
                          setLocation('all');
                          setTechnician('all');
                          setClientType('all');
                          setService('all');
                          setPaymentStatus('all');
                        }}
                      >
                        Limpar Filtros
                      </Button>
                    </div>
                  </div>
                </aside>

                {/* Main content area */}
                <div className='lg:col-span-3'>
                  <div className='flex flex-col gap-8'>
                    {/* Metrics Section */}
                    <div>
                      <h2 className='text-gray-900 dark:text-white text-lg font-bold mb-4'>
                        Resumo do Período
                      </h2>
                      <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6'>
                        <Card className='bg-white dark:bg-background-dark dark:border dark:border-white/10 rounded-xl p-5 flex items-start gap-4'>
                          <div className='flex items-center justify-center size-12 rounded-full bg-primary/10'>
                            <Timer className='text-primary text-3xl' />
                          </div>
                          <div>
                            <p className='text-gray-500 dark:text-gray-400 text-sm font-medium'>
                              SLA (Atendimento)
                            </p>
                            <p className='text-gray-900 dark:text-white text-2xl font-bold mt-1'>
                              {reportData?.sla || '2h 15min'}
                            </p>
                          </div>
                        </Card>
                        <Card className='bg-white dark:bg-background-dark dark:border dark:border-white/10 rounded-xl p-5 flex items-start gap-4'>
                          <div className='flex items-center justify-center size-12 rounded-full bg-primary/10'>
                            <Hourglass className='text-primary text-3xl' />
                          </div>
                          <div>
                            <p className='text-gray-500 dark:text-gray-400 text-sm font-medium'>
                              TMR (Resolução)
                            </p>
                            <p className='text-gray-900 dark:text-white text-2xl font-bold mt-1'>
                              {reportData?.tmr || '8h 47min'}
                            </p>
                          </div>
                        </Card>
                        <Card className='bg-white dark:bg-background-dark dark:border dark:border-white/10 rounded-xl p-5 flex items-start gap-4'>
                          <div className='flex items-center justify-center size-12 rounded-full bg-primary/10'>
                            <PieChart className='text-primary text-3xl' />
                          </div>
                          <div>
                            <p className='text-gray-500 dark:text-gray-400 text-sm font-medium'>
                              Ocupação
                            </p>
                            <p className='text-gray-900 dark:text-white text-2xl font-bold mt-1'>
                              {reportData?.ocupacao || 78}%
                            </p>
                          </div>
                        </Card>
                      </div>
                    </div>

                    {/* Data Table Section */}
                    <div>
                      <h2 className='text-gray-900 dark:text-white text-lg font-bold mb-4'>
                        Dados Detalhados
                      </h2>
                      <Card className='bg-white dark:bg-background-dark dark:border dark:border-white/10 rounded-xl overflow-hidden'>
                        <div className='overflow-x-auto'>
                          <Table className='w-full text-sm text-left text-gray-500 dark:text-gray-400'>
                            <TableHeader>
                              <TableRow className='text-xs text-gray-700 uppercase bg-gray-50 dark:bg-white/10 dark:text-gray-300'>
                                <TableHead className='px-6 py-3' scope='col'>
                                  Cliente
                                </TableHead>
                                <TableHead className='px-6 py-3' scope='col'>
                                  Técnico
                                </TableHead>
                                <TableHead className='px-6 py-3' scope='col'>
                                  Data
                                </TableHead>
                                <TableHead className='px-6 py-3' scope='col'>
                                  Serviço
                                </TableHead>
                                <TableHead className='px-6 py-3' scope='col'>
                                  Status
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {isLoading ? (
                                <TableRow>
                                  <TableCell
                                    colSpan={5}
                                    className='px-6 py-4 text-center text-gray-500 dark:text-gray-400'
                                  >
                                    Carregando...
                                  </TableCell>
                                </TableRow>
                              ) : reportData?.tickets &&
                                reportData.tickets.length > 0 ? (
                                reportData.tickets.map((ticket) => (
                                  <TableRow
                                    key={ticket.id}
                                    className='bg-white dark:bg-background-dark border-b dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5'
                                  >
                                    <TableCell
                                      className='px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap'
                                      scope='row'
                                    >
                                      {ticket.clientName}
                                    </TableCell>
                                    <TableCell className='px-6 py-4'>
                                      {ticket.technicianName}
                                    </TableCell>
                                    <TableCell className='px-6 py-4'>
                                      {format(
                                        new Date(ticket.date),
                                        'yyyy-MM-dd',
                                        {
                                          locale: ptBR,
                                        }
                                      )}
                                    </TableCell>
                                    <TableCell className='px-6 py-4'>
                                      {ticket.serviceName}
                                    </TableCell>
                                    <TableCell className='px-6 py-4'>
                                      {getStatusBadge(ticket.status)}
                                    </TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell
                                    colSpan={5}
                                    className='px-6 py-4 text-center text-gray-500 dark:text-gray-400'
                                  >
                                    Nenhum dado encontrado
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        <nav
                          aria-label='Table navigation'
                          className='flex items-center justify-between p-4'
                        >
                          <span className='text-sm font-normal text-gray-500 dark:text-gray-400'>
                            Exibindo{' '}
                            <span className='font-semibold text-gray-900 dark:text-white'>
                              1-{reportData?.tickets?.length || 0}
                            </span>{' '}
                            de{' '}
                            <span className='font-semibold text-gray-900 dark:text-white'>
                              {reportData?.tickets?.length || 0}
                            </span>
                          </span>
                          <ul className='inline-flex -space-x-px text-sm h-8'>
                            <li>
                              <a
                                className='flex items-center justify-center px-3 h-8 ml-0 leading-tight text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-background-dark dark:border-white/20 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white'
                                href='#'
                              >
                                Anterior
                              </a>
                            </li>
                            <li>
                              <a
                                className='flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-background-dark dark:border-white/20 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white'
                                href='#'
                              >
                                Próximo
                              </a>
                            </li>
                          </ul>
                        </nav>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      <ModalExportacaoPdfCompleta2
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
      />
    </div>
  );
}
























