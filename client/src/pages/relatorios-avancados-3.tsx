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

interface AdvancedReportData {
  slaCompliance: number;
  slaComplianceChange: number;
  averageResponseTime: number;
  averageResponseTimeChange: number;
  occupancyRate: number;
  occupancyRateChange: number;
  ticketsByStatus: number;
  ticketsByStatusChange: number;
  topClientsProfitability: number;
  topClientsProfitabilityChange: number;
  monthlyCashFlow: number;
  monthlyCashFlowChange: number;
  averageServiceTime: number;
  averageServiceTimeChange: number;
}

export default function RelatoriosAvancados3() {
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
    }).format(value);

  const formatChange = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  return (
    <div className='relative flex h-auto min-h-screen w-full flex-col bg-[#101722] font-display text-gray-200 overflow-x-hidden'>
      <div className='flex h-full grow'>
        <main className='flex-1 p-6 lg:p-8'>
          <div className='max-w-7xl mx-auto'>
            <div className='flex flex-wrap justify-between items-start gap-4 mb-6'>
              <div className='flex flex-col gap-2'>
                <h1 className='text-white text-3xl font-black tracking-tight'>
                  Relatórios Avançados
                </h1>
                <p className='text-gray-400 text-base font-normal'>
                  Visualize métricas e insights detalhados do seu negócio.
                </p>
              </div>
              <Button className='bg-[#3880f5] hover:bg-[#3880f5]/90'>
                <Download className='w-4 h-4 mr-2' />
                Exportar Relatório
              </Button>
            </div>

            {/* Filtros */}
            <div className='flex flex-wrap gap-3 mb-6 border-b border-gray-800 pb-6'>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className='h-8 shrink-0 bg-gray-800 border-gray-700 text-gray-200 hover:border-gray-600'>
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
                <SelectTrigger className='h-8 shrink-0 bg-gray-800 border-gray-700 text-gray-200 hover:border-gray-600'>
                  <SelectValue placeholder='Estado/Cidade' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={technician} onValueChange={setTechnician}>
                <SelectTrigger className='h-8 shrink-0 bg-gray-800 border-gray-700 text-gray-200 hover:border-gray-600'>
                  <SelectValue placeholder='Técnico' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={clientType} onValueChange={setClientType}>
                <SelectTrigger className='h-8 shrink-0 bg-gray-800 border-gray-700 text-gray-200 hover:border-gray-600'>
                  <SelectValue placeholder='Tipo de Cliente' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todos</SelectItem>
                  <SelectItem value='PF'>Pessoa Física</SelectItem>
                  <SelectItem value='PJ'>Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger className='h-8 shrink-0 bg-gray-800 border-gray-700 text-gray-200 hover:border-gray-600'>
                  <SelectValue placeholder='Serviço' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className='h-8 shrink-0 bg-gray-800 border-gray-700 text-gray-200 hover:border-gray-600'>
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

            {/* Cards de Métricas */}
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6'>
              <Card className='flex flex-col gap-2 rounded-xl p-6 border border-gray-800 bg-gray-900/50'>
                <p className='text-gray-300 text-base font-medium'>
                  Cumprimento de SLA
                </p>
                <div className='flex items-baseline gap-2'>
                  <p className='text-white text-3xl font-bold'>
                    {reportData?.slaCompliance.toFixed(1) || '0'}%
                  </p>
                  <p
                    className={`text-sm font-medium flex items-center ${
                      (reportData?.slaComplianceChange || 0) >= 0
                        ? 'text-green-500'
                        : 'text-red-500'
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
              <Card className='flex flex-col gap-2 rounded-xl p-6 border border-gray-800 bg-gray-900/50'>
                <p className='text-gray-300 text-base font-medium'>
                  Tempo Médio de Resposta
                </p>
                <div className='flex items-baseline gap-2'>
                  <p className='text-white text-3xl font-bold'>
                    {reportData?.averageResponseTime.toFixed(1) || '0'} horas
                  </p>
                  <p
                    className={`text-sm font-medium flex items-center ${
                      (reportData?.averageResponseTimeChange || 0) >= 0
                        ? 'text-red-500'
                        : 'text-green-500'
                    }`}
                  >
                    {(reportData?.averageResponseTimeChange || 0) >= 0 ? (
                      <ArrowUp className='w-4 h-4 mr-1' />
                    ) : (
                      <ArrowDown className='w-4 h-4 mr-1' />
                    )}
                    {formatChange(
                      Math.abs(reportData?.averageResponseTimeChange || 0)
                    )}
                    h
                  </p>
                </div>
              </Card>
              <Card className='flex flex-col gap-2 rounded-xl p-6 border border-gray-800 bg-gray-900/50'>
                <p className='text-gray-300 text-base font-medium'>
                  Taxa de Ocupação
                </p>
                <div className='flex items-baseline gap-2'>
                  <p className='text-white text-3xl font-bold'>
                    {reportData?.occupancyRate.toFixed(0) || '0'}%
                  </p>
                  <p
                    className={`text-sm font-medium flex items-center ${
                      (reportData?.occupancyRateChange || 0) >= 0
                        ? 'text-green-500'
                        : 'text-red-500'
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
              <Card className='flex w-full flex-col gap-2 rounded-xl border border-gray-800 p-6 bg-gray-900/50'>
                <p className='text-white text-base font-medium'>
                  Chamados por Status
                </p>
                <div className='flex items-baseline gap-2'>
                  <p className='text-white text-3xl font-bold'>
                    {reportData?.ticketsByStatus || 0}
                  </p>
                  <p className='text-green-500 text-sm font-medium'>
                    {formatChange(reportData?.ticketsByStatusChange || 0)}
                  </p>
                </div>
                <p className='text-gray-400 text-sm'>Últimos 30 dias</p>
                <div className='flex items-center justify-center min-h-[240px] w-full pt-4'>
                  <div className='w-full h-full bg-gray-800 rounded flex items-center justify-center'>
                    <p className='text-gray-500 text-sm'>
                      Gráfico de Pizza - Chamados por Status
                    </p>
                  </div>
                </div>
              </Card>
              <Card className='flex w-full flex-col gap-2 rounded-xl border border-gray-800 p-6 bg-gray-900/50'>
                <p className='text-white text-base font-medium'>
                  Top 10 Clientes por Lucratividade
                </p>
                <div className='flex items-baseline gap-2'>
                  <p className='text-white text-3xl font-bold'>
                    {formatCurrency(reportData?.topClientsProfitability || 0)}
                  </p>
                  <p className='text-green-500 text-sm font-medium'>
                    {formatChange(
                      reportData?.topClientsProfitabilityChange || 0
                    )}
                  </p>
                </div>
                <p className='text-gray-400 text-sm'>Últimos 30 dias</p>
                <div className='grid min-h-[240px] gap-x-4 gap-y-3 grid-cols-[auto_1fr] items-center pt-4'>
                  {[
                    'Cliente C',
                    'Cliente A',
                    'Cliente E',
                    'Cliente D',
                    'Cliente B',
                  ].map((client, idx) => (
                    <>
                      <p className='text-gray-400 text-xs font-bold tracking-wider'>
                        {client}
                      </p>
                      <div className='h-4 rounded bg-[#3880f5]/30'>
                        <div
                          className='bg-[#3880f5] h-full rounded'
                          style={{ width: `${100 - idx * 15}%` }}
                        ></div>
                      </div>
                    </>
                  ))}
                </div>
              </Card>
              <Card className='flex w-full flex-col gap-2 rounded-xl border border-gray-800 p-6 bg-gray-900/50 lg:col-span-2'>
                <p className='text-white text-base font-medium'>
                  Fluxo de Caixa Mensal
                </p>
                <div className='flex items-baseline gap-2'>
                  <p className='text-white text-3xl font-bold'>
                    {formatCurrency(reportData?.monthlyCashFlow || 0)}
                  </p>
                  <p className='text-green-500 text-sm font-medium'>
                    {formatChange(reportData?.monthlyCashFlowChange || 0)}
                  </p>
                </div>
                <p className='text-gray-400 text-sm'>Últimos 12 meses</p>
                <div className='flex min-h-[240px] flex-1 flex-col gap-4 py-4'>
                  <div className='h-full w-full bg-gradient-to-t from-[#3880f5]/20 to-transparent rounded'></div>
                  <div className='flex justify-between -mt-4 px-2'>
                    {[
                      'Jan',
                      'Fev',
                      'Mar',
                      'Abr',
                      'Mai',
                      'Jun',
                      'Jul',
                      'Ago',
                      'Set',
                      'Out',
                      'Nov',
                      'Dez',
                    ].map((month) => (
                      <p
                        key={month}
                        className='text-gray-400 text-xs font-bold tracking-wider'
                      >
                        {month}
                      </p>
                    ))}
                  </div>
                </div>
              </Card>
              <Card className='flex w-full flex-col gap-2 rounded-xl border border-gray-800 p-6 bg-gray-900/50'>
                <p className='text-white text-base font-medium'>
                  Tempo Médio de Atendimento
                </p>
                <div className='flex items-baseline gap-2'>
                  <p className='text-white text-3xl font-bold'>
                    {reportData?.averageServiceTime.toFixed(1) || '0'}h
                  </p>
                  <p
                    className={`text-sm font-medium ${
                      (reportData?.averageServiceTimeChange || 0) >= 0
                        ? 'text-red-500'
                        : 'text-green-500'
                    }`}
                  >
                    {formatChange(reportData?.averageServiceTimeChange || 0)}
                  </p>
                </div>
                <p className='text-gray-400 text-sm'>por Tipo de Serviço</p>
                <div className='grid min-h-[240px] grid-flow-col gap-6 grid-rows-[1fr_auto] items-end justify-items-center px-3 pt-4'>
                  {['Remoto', 'Presencial', 'Lab', 'Garantia'].map(
                    (type, idx) => (
                      <div
                        key={type}
                        className='flex flex-col items-center gap-2'
                      >
                        <div
                          className='bg-[#3880f5]/30 w-full rounded-t'
                          style={{ height: `${[30, 100, 10, 70][idx]}%` }}
                        ></div>
                        <p className='text-gray-400 text-xs font-bold tracking-wider'>
                          {type}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
























