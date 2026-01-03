import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { Download, ArrowUp, ArrowDown } from 'lucide-react';
import { usePaidAccess } from '@/hooks/use-paid-access';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { ChartContainer } from '@/components/ui/chart';

interface AdvancedReportData {
  slaCompliance: number;
  slaComplianceChange: number;
  averageResponseTime: number;
  averageResponseTimeChange: number;
  occupancyRate: number;
  occupancyRateChange: number;
  ticketsByStatus: {
    total: number;
    change: number;
    data: Array<{ name: string; value: number; color: string }>;
  };
  topClientsProfitability: {
    total: number;
    change: number;
    data: Array<{ name: string; value: number }>;
  };
  monthlyCashFlow: {
    total: number;
    change: number;
    data: Array<{ month: string; value: number }>;
  };
  averageServiceTime: {
    total: number;
    change: number;
    data: Array<{ type: string; value: number }>;
  };
}

const COLORS = ['#3880f5', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'];

export default function RelatoriosAvancados() {
  const { isPaid } = usePaidAccess();
  if (!isPaid) {
    return (
      <div className='min-h-[60vh] flex items-center justify-center p-6'>
        <Card className='w-full max-w-xl p-6 space-y-4'>
          <div className='space-y-2'>
            <h2 className='text-lg font-semibold'>
              Relatorios avancados sao exclusivos do plano pago
            </h2>
            <p className='text-sm text-muted-foreground'>
              Assine um plano para liberar analytics e exportacoes avancadas.
            </p>
          </div>
          <Button onClick={() => window.location.assign('/planos')}>
            Ver planos
          </Button>
        </Card>
      </div>
    );
  }
  const [period, setPeriod] = useState('30');
  const [state, setState] = useState('all');
  const [technician, setTechnician] = useState('all');
  const [clientType, setClientType] = useState('all');
  const [service, setService] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');

  const { data: reportData, isLoading } = useQuery<AdvancedReportData>({
    queryKey: [
      '/api/reports/advanced',
      period,
      state,
      technician,
      clientType,
      service,
      paymentStatus,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', period);
      if (state !== 'all') params.append('state', state);
      if (technician !== 'all') params.append('technicianId', technician);
      if (clientType !== 'all') params.append('clientType', clientType);
      if (service !== 'all') params.append('serviceId', service);
      if (paymentStatus !== 'all')
        params.append('paymentStatus', paymentStatus);
      const response = await apiRequest(
        'GET',
        `/api/reports/advanced?${params.toString()}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar relatório');
      return response.json();
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const formatChange = (value: number, isPercentage = true) => {
    const sign = value >= 0 ? '+' : '';
    if (isPercentage) {
      return `${sign}${value.toFixed(1)}%`;
    }
    return `${sign}${value.toFixed(1)}h`;
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    params.append('period', period);
    if (state !== 'all') params.append('state', state);
    if (technician !== 'all') params.append('technicianId', technician);
    if (clientType !== 'all') params.append('clientType', clientType);
    if (service !== 'all') params.append('serviceId', service);
    if (paymentStatus !== 'all') params.append('paymentStatus', paymentStatus);
    window.open(`/api/reports/advanced/export?${params.toString()}`, '_blank');
  };

  return (
    <div className='max-w-7xl mx-auto p-6 lg:p-8'>
      {/* Header */}
      <div className='flex flex-wrap justify-between items-start gap-4 mb-6'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-gray-900 dark:text-white text-3xl md:text-4xl font-black leading-tight tracking-[-0.033em]'>
            Relatórios Avançados
          </h1>
          <p className='text-gray-500 dark:text-gray-400 text-base font-normal leading-normal'>
            Visualize métricas e insights detalhados do seu negócio.
          </p>
        </div>
        <Button
          className='bg-[#3880f5] hover:bg-[#3880f5]/90'
          onClick={handleExport}
        >
          <Download className='w-4 h-4 mr-2' />
          Exportar Relatório
        </Button>
      </div>

      {/* Filtros */}
      <div className='flex flex-wrap gap-3 mb-6 pb-6 border-b border-gray-200 dark:border-gray-800'>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className='h-9 w-[140px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'>
            <SelectValue placeholder='Período' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='7'>Últimos 7 dias</SelectItem>
            <SelectItem value='30'>Últimos 30 dias</SelectItem>
            <SelectItem value='90'>Últimos 90 dias</SelectItem>
            <SelectItem value='365'>Último ano</SelectItem>
          </SelectContent>
        </Select>
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className='h-9 w-[140px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'>
            <SelectValue placeholder='Estado/Cidade' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todos</SelectItem>
            {/* TODO: Popular com estados/cidades */}
          </SelectContent>
        </Select>
        <Select value={technician} onValueChange={setTechnician}>
          <SelectTrigger className='h-9 w-[140px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'>
            <SelectValue placeholder='Técnico' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todos</SelectItem>
            {/* TODO: Popular com técnicos */}
          </SelectContent>
        </Select>
        <Select value={clientType} onValueChange={setClientType}>
          <SelectTrigger className='h-9 w-[140px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'>
            <SelectValue placeholder='Tipo de Cliente' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todos</SelectItem>
            <SelectItem value='PF'>Pessoa Física</SelectItem>
            <SelectItem value='PJ'>Pessoa Jurídica</SelectItem>
            <SelectItem value='EMPRESA_PARCEIRA'>Empresa Parceira</SelectItem>
          </SelectContent>
        </Select>
        <Select value={service} onValueChange={setService}>
          <SelectTrigger className='h-9 w-[140px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'>
            <SelectValue placeholder='Serviço' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todos</SelectItem>
            {/* TODO: Popular com serviços */}
          </SelectContent>
        </Select>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger className='h-9 w-[140px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'>
            <SelectValue placeholder='Status Pagamento' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todos</SelectItem>
            <SelectItem value='PAGO'>Pago</SelectItem>
            <SelectItem value='PENDENTE'>Pendente</SelectItem>
            <SelectItem value='ATRASADO'>Atrasado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards de Métricas KPI */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-6'>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Cumprimento de SLA
          </p>
          <div className='flex items-baseline gap-2'>
            <p className='text-gray-900 dark:text-white text-3xl font-bold'>
              {isLoading
                ? '...'
                : `${(reportData?.slaCompliance || 0).toFixed(1)}%`}
            </p>
            <p
              className={`text-sm font-medium flex items-center ${
                (reportData?.slaComplianceChange || 0) >= 0
                  ? 'text-green-600 dark:text-green-500'
                  : 'text-red-600 dark:text-red-500'
              }`}
            >
              {(reportData?.slaComplianceChange || 0) >= 0 ? (
                <ArrowUp className='w-4 h-4 mr-1' />
              ) : (
                <ArrowDown className='w-4 h-4 mr-1' />
              )}
              {formatChange(reportData?.slaComplianceChange || 0)}
            </p>
          </div>
        </Card>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Tempo Médio de Resposta (TMR)
          </p>
          <div className='flex items-baseline gap-2'>
            <p className='text-gray-900 dark:text-white text-3xl font-bold'>
              {isLoading
                ? '...'
                : `${(reportData?.averageResponseTime || 0).toFixed(1)} horas`}
            </p>
            <p
              className={`text-sm font-medium flex items-center ${
                (reportData?.averageResponseTimeChange || 0) >= 0
                  ? 'text-red-600 dark:text-red-500'
                  : 'text-green-600 dark:text-green-500'
              }`}
            >
              {(reportData?.averageResponseTimeChange || 0) >= 0 ? (
                <ArrowUp className='w-4 h-4 mr-1' />
              ) : (
                <ArrowDown className='w-4 h-4 mr-1' />
              )}
              {formatChange(
                Math.abs(reportData?.averageResponseTimeChange || 0),
                false
              )}
            </p>
          </div>
        </Card>
        <Card className='flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800'>
          <p className='text-gray-600 dark:text-gray-400 text-base font-medium leading-normal'>
            Taxa de Ocupação
          </p>
          <div className='flex items-baseline gap-2'>
            <p className='text-gray-900 dark:text-white text-3xl font-bold'>
              {isLoading
                ? '...'
                : `${(reportData?.occupancyRate || 0).toFixed(0)}%`}
            </p>
            <p
              className={`text-sm font-medium flex items-center ${
                (reportData?.occupancyRateChange || 0) >= 0
                  ? 'text-green-600 dark:text-green-500'
                  : 'text-red-600 dark:text-red-500'
              }`}
            >
              {(reportData?.occupancyRateChange || 0) >= 0 ? (
                <ArrowUp className='w-4 h-4 mr-1' />
              ) : (
                <ArrowDown className='w-4 h-4 mr-1' />
              )}
              {formatChange(reportData?.occupancyRateChange || 0)}
            </p>
          </div>
        </Card>
      </div>

      {/* Gráficos */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Chamados por Status */}
        <Card className='flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-900'>
          <div className='flex items-baseline justify-between'>
            <div>
              <p className='text-gray-900 dark:text-white text-lg font-medium leading-normal'>
                Chamados por Status
              </p>
              <div className='flex items-baseline gap-2 mt-1'>
                <p className='text-gray-900 dark:text-white text-3xl font-bold'>
                  {reportData?.ticketsByStatus?.total || 0}
                </p>
                <p className='text-green-600 dark:text-green-500 text-sm font-medium'>
                  {formatChange(reportData?.ticketsByStatus?.change || 0)}
                </p>
              </div>
              <p className='text-gray-500 dark:text-gray-400 text-sm mt-1'>
                Últimos 30 dias
              </p>
            </div>
          </div>
          {isLoading ? (
            <div className='h-[240px] flex items-center justify-center'>
              <p className='text-gray-400'>Carregando...</p>
            </div>
          ) : reportData?.ticketsByStatus?.data &&
            reportData.ticketsByStatus.data.length > 0 ? (
            <ChartContainer config={{}} className='h-[240px] w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie
                    data={reportData.ticketsByStatus.data}
                    cx='50%'
                    cy='50%'
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey='value'
                  >
                    {reportData.ticketsByStatus.data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color || COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [
                      `${value} chamados`,
                      'Quantidade',
                    ]}
                  />
                  <Legend
                    verticalAlign='bottom'
                    height={36}
                    formatter={(value) => value}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className='h-[240px] flex items-center justify-center'>
              <p className='text-gray-400'>Nenhum dado disponível</p>
            </div>
          )}
        </Card>

        {/* Top 10 Clientes por Lucratividade */}
        <Card className='flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-900'>
          <div className='flex items-baseline justify-between'>
            <div>
              <p className='text-gray-900 dark:text-white text-lg font-medium leading-normal'>
                Top 10 Clientes por Lucratividade
              </p>
              <div className='flex items-baseline gap-2 mt-1'>
                <p className='text-gray-900 dark:text-white text-3xl font-bold'>
                  {formatCurrency(
                    reportData?.topClientsProfitability?.total || 0
                  )}
                </p>
                <p className='text-green-600 dark:text-green-500 text-sm font-medium'>
                  {formatChange(
                    reportData?.topClientsProfitability?.change || 0
                  )}
                </p>
              </div>
              <p className='text-gray-500 dark:text-gray-400 text-sm mt-1'>
                Últimos 30 dias
              </p>
            </div>
          </div>
          {isLoading ? (
            <div className='h-[240px] flex items-center justify-center'>
              <p className='text-gray-400'>Carregando...</p>
            </div>
          ) : reportData?.topClientsProfitability?.data &&
            reportData.topClientsProfitability.data.length > 0 ? (
            <ChartContainer config={{}} className='h-[240px] w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart
                  data={reportData.topClientsProfitability.data
                    .slice(0, 10)
                    .reverse()}
                  layout='vertical'
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />
                  <XAxis type='number' stroke='#6b7280' fontSize={12} />
                  <YAxis
                    type='category'
                    dataKey='name'
                    stroke='#6b7280'
                    fontSize={12}
                    width={70}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey='value' fill='#3880f5' radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className='h-[240px] flex items-center justify-center'>
              <p className='text-gray-400'>Nenhum dado disponível</p>
            </div>
          )}
        </Card>

        {/* Fluxo de Caixa Mensal */}
        <Card className='flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-900 lg:col-span-2'>
          <div className='flex items-baseline justify-between'>
            <div>
              <p className='text-gray-900 dark:text-white text-lg font-medium leading-normal'>
                Fluxo de Caixa Mensal
              </p>
              <div className='flex items-baseline gap-2 mt-1'>
                <p className='text-gray-900 dark:text-white text-3xl font-bold'>
                  {formatCurrency(reportData?.monthlyCashFlow?.total || 0)}
                </p>
                <p className='text-green-600 dark:text-green-500 text-sm font-medium'>
                  {formatChange(reportData?.monthlyCashFlow?.change || 0)}
                </p>
              </div>
              <p className='text-gray-500 dark:text-gray-400 text-sm mt-1'>
                Últimos 12 meses
              </p>
            </div>
          </div>
          {isLoading ? (
            <div className='h-[240px] flex items-center justify-center'>
              <p className='text-gray-400'>Carregando...</p>
            </div>
          ) : reportData?.monthlyCashFlow?.data &&
            reportData.monthlyCashFlow.data.length > 0 ? (
            <ChartContainer config={{}} className='h-[240px] w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <AreaChart
                  data={reportData.monthlyCashFlow.data}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id='colorCashFlow'
                      x1='0'
                      y1='0'
                      x2='0'
                      y2='1'
                    >
                      <stop offset='5%' stopColor='#3880f5' stopOpacity={0.3} />
                      <stop offset='95%' stopColor='#3880f5' stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />
                  <XAxis
                    dataKey='month'
                    stroke='#6b7280'
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke='#6b7280'
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `R$ ${(value / 1000).toFixed(0)}k`
                    }
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type='monotone'
                    dataKey='value'
                    stroke='#3880f5'
                    strokeWidth={2}
                    fillOpacity={1}
                    fill='url(#colorCashFlow)'
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className='h-[240px] flex items-center justify-center'>
              <p className='text-gray-400'>Nenhum dado disponível</p>
            </div>
          )}
        </Card>

        {/* Tempo Médio de Atendimento */}
        <Card className='flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-900'>
          <div className='flex items-baseline justify-between'>
            <div>
              <p className='text-gray-900 dark:text-white text-lg font-medium leading-normal'>
                Tempo Médio de Atendimento
              </p>
              <div className='flex items-baseline gap-2 mt-1'>
                <p className='text-gray-900 dark:text-white text-3xl font-bold'>
                  {isLoading
                    ? '...'
                    : `${(reportData?.averageServiceTime?.total || 0).toFixed(
                        1
                      )}h`}
                </p>
                <p
                  className={`text-sm font-medium ${
                    (reportData?.averageServiceTime?.change || 0) >= 0
                      ? 'text-red-600 dark:text-red-500'
                      : 'text-green-600 dark:text-green-500'
                  }`}
                >
                  {formatChange(reportData?.averageServiceTime?.change || 0)}
                </p>
              </div>
              <p className='text-gray-500 dark:text-gray-400 text-sm mt-1'>
                por Tipo de Serviço
              </p>
            </div>
          </div>
          {isLoading ? (
            <div className='h-[240px] flex items-center justify-center'>
              <p className='text-gray-400'>Carregando...</p>
            </div>
          ) : reportData?.averageServiceTime?.data &&
            reportData.averageServiceTime.data.length > 0 ? (
            <ChartContainer config={{}} className='h-[240px] w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart
                  data={reportData.averageServiceTime.data}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' />
                  <XAxis
                    dataKey='type'
                    stroke='#6b7280'
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke='#6b7280'
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}h`}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `${value.toFixed(1)}h`,
                      'Tempo',
                    ]}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey='value' fill='#3880f5' radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className='h-[240px] flex items-center justify-center'>
              <p className='text-gray-400'>Nenhum dado disponível</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
