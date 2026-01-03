import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  AlertCircle,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Spreadsheet {
  id: string;
  sentDate: string;
  technicianName: string;
  periodStart: string;
  periodEnd: string;
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'COM_ERROS';
  origin: 'AUTOMATICA' | 'UPLOAD';
  discrepancies?: number;
}

interface SpreadsheetDetail {
  technicianSpreadsheet: Array<{
    ticketId: string;
    date: string;
    amount: number;
    hasDiscrepancy?: boolean;
    discrepancyType?: 'VALUE' | 'NOT_FOUND';
  }>;
  chamadosproData: Array<{
    ticketId: string;
    date: string;
    amount: number;
    isMissing?: boolean;
  }>;
}

export default function AnalisePlanilhasTecnicos() {
  const { toast } = useToast();
  const [selectedTechnician, setSelectedTechnician] = useState('all');
  const [dateRange, setDateRange] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDENTE');
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<string | null>(
    null
  );
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: spreadsheets, isLoading } = useQuery<Spreadsheet[]>({
    queryKey: [
      '/api/financial/spreadsheets',
      selectedTechnician,
      dateRange,
      statusFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTechnician !== 'all')
        params.append('technicianId', selectedTechnician);
      if (dateRange) params.append('dateRange', dateRange);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await apiRequest(
        'GET',
        `/api/financial/spreadsheets?${params.toString()}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar planilhas');
      return response.json();
    },
  });

  const { data: spreadsheetDetail } = useQuery<SpreadsheetDetail>({
    queryKey: ['/api/financial/spreadsheets', selectedSpreadsheet, 'detail'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/financial/spreadsheets/${selectedSpreadsheet}/detail`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar detalhes');
      return response.json();
    },
    enabled: !!selectedSpreadsheet,
  });

  const approveMutation = useMutation({
    mutationFn: async (spreadsheetId: string) => {
      const response = await apiRequest(
        'POST',
        `/api/financial/spreadsheets/${spreadsheetId}/approve`,
        {}
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao aprovar planilha');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/financial/spreadsheets'],
      });
      toast({
        title: 'Planilha aprovada',
        description: 'A planilha foi aprovada com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao aprovar planilha',
        description: error.message,
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (spreadsheetId: string) => {
      const response = await apiRequest(
        'POST',
        `/api/financial/spreadsheets/${spreadsheetId}/reject`,
        {}
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao rejeitar planilha');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/financial/spreadsheets'],
      });
      toast({
        title: 'Planilha rejeitada',
        description: 'A planilha foi rejeitada.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao rejeitar planilha',
        description: error.message,
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APROVADA':
        return (
          <Badge className='bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'>
            Aprovada
          </Badge>
        );
      case 'PENDENTE':
        return (
          <Badge className='bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'>
            Pendente
          </Badge>
        );
      case 'REJEITADA':
        return (
          <Badge className='bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'>
            Rejeitada
          </Badge>
        );
      case 'COM_ERROS':
        return (
          <Badge className='bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'>
            Com Erros
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  const selectedSheet = spreadsheets?.find((s) => s.id === selectedSpreadsheet);

  return (
    <div className='relative flex h-auto min-h-screen w-full flex-col bg-[#f5f7f8] dark:bg-[#101722] font-display overflow-x-hidden'>
      <div className='layout-container flex h-full grow flex-col'>
        <header className='flex items-center justify-between whitespace-nowrap border-b border-solid border-gray-200 dark:border-gray-700 bg-white dark:bg-[#101722] px-6 py-3 sticky top-0 z-10'>
          <div className='flex items-center gap-4 text-gray-900 dark:text-white'>
            <div className='size-6 text-[#3880f5]'>
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
          <div className='flex flex-1 justify-center items-center gap-8'>
            <Link href='/'>
              <a className='text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-[#3880f5] dark:hover:text-[#3880f5]'>
                Dashboard
              </a>
            </Link>
            <Link href='/tecnicos-parceiros'>
              <a className='text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-[#3880f5] dark:hover:text-[#3880f5]'>
                Técnicos
              </a>
            </Link>
            <Link href='/clientes'>
              <a className='text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-[#3880f5] dark:hover:text-[#3880f5]'>
                Clientes
              </a>
            </Link>
            <Link href='/chamados'>
              <a className='text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-[#3880f5] dark:hover:text-[#3880f5]'>
                Chamados
              </a>
            </Link>
            <Link href='/dashboard-financeiro'>
              <a className='text-sm font-semibold text-[#3880f5]'>Financeiro</a>
            </Link>
          </div>
          <div className='flex items-center gap-4'>
            <div className='flex gap-2'>
              <Button variant='ghost' size='icon' className='h-10 w-10'>
                <Bell className='w-5 h-5' />
              </Button>
              <Button variant='ghost' size='icon' className='h-10 w-10'>
                <Settings className='w-5 h-5' />
              </Button>
            </div>
            <div className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-gray-300 dark:bg-gray-700'></div>
          </div>
        </header>
        <main className='flex-1 px-4 sm:px-6 lg:px-8 py-8'>
          <div className='mx-auto max-w-7xl'>
            <div className='flex flex-col gap-4 mb-6'>
              <div className='flex flex-wrap gap-2'>
                <Link href='/'>
                  <a className='text-[#60708a] dark:text-gray-400 text-base font-medium leading-normal hover:text-[#3880f5]'>
                    Dashboard
                  </a>
                </Link>
                <span className='text-[#60708a] dark:text-gray-400 text-base font-medium leading-normal'>
                  /
                </span>
                <Link href='/dashboard-financeiro'>
                  <a className='text-[#60708a] dark:text-gray-400 text-base font-medium leading-normal hover:text-[#3880f5]'>
                    Financeiro
                  </a>
                </Link>
                <span className='text-[#60708a] dark:text-gray-400 text-base font-medium leading-normal'>
                  /
                </span>
                <span className='text-[#111418] dark:text-white text-base font-medium leading-normal'>
                  Análise de Planilhas
                </span>
              </div>
              <div className='flex flex-wrap justify-between gap-3 items-center'>
                <h1 className='text-[#111418] dark:text-white text-4xl font-black leading-tight tracking-[-0.033em] min-w-72'>
                  Análise de Planilhas de Técnicos
                </h1>
                <Button
                  className='bg-[#3880f5] hover:bg-[#3880f5]/90'
                  onClick={() => setShowUploadDialog(true)}
                >
                  <Upload className='w-5 h-5 mr-2' />
                  Fazer Upload de Planilha
                </Button>
              </div>
            </div>
            <div className='flex flex-col lg:flex-row gap-6 mt-4'>
              {/* Left Panel: Filters */}
              <div className='w-full lg:w-1/4 xl:w-1/5 shrink-0'>
                <Card className='p-4 rounded-xl bg-white dark:bg-[#101722]/50 border border-gray-200 dark:border-gray-800'>
                  <h3 className='font-bold text-lg mb-4'>Filtros</h3>
                  <div className='flex flex-col gap-4'>
                    <div>
                      <Label
                        className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
                        htmlFor='technician-filter'
                      >
                        Técnico
                      </Label>
                      <Select
                        value={selectedTechnician}
                        onValueChange={setSelectedTechnician}
                      >
                        <SelectTrigger
                          id='technician-filter'
                          className='w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-[#101722] focus:border-[#3880f5] focus:ring-[#3880f5] text-sm'
                        >
                          <SelectValue placeholder='Todos os Técnicos' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='all'>Todos os Técnicos</SelectItem>
                          {/* TODO: Popular com técnicos */}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label
                        className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
                        htmlFor='date-range'
                      >
                        Período
                      </Label>
                      <Input
                        id='date-range'
                        type='date'
                        className='w-full rounded-lg border-gray-300 dark:border-gray-700 dark:bg-[#101722] focus:border-[#3880f5] focus:ring-[#3880f5] text-sm'
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                        Status
                      </Label>
                      <div className='flex flex-wrap gap-2'>
                        <Button
                          variant={
                            statusFilter === 'PENDENTE' ? 'default' : 'outline'
                          }
                          size='sm'
                          className='h-8 rounded-full'
                          onClick={() => setStatusFilter('PENDENTE')}
                        >
                          Pendente
                        </Button>
                        <Button
                          variant={
                            statusFilter === 'APROVADA' ? 'default' : 'outline'
                          }
                          size='sm'
                          className='h-8 rounded-full'
                          onClick={() => setStatusFilter('APROVADA')}
                        >
                          Aprovada
                        </Button>
                        <Button
                          variant={
                            statusFilter === 'REJEITADA' ? 'default' : 'outline'
                          }
                          size='sm'
                          className='h-8 rounded-full'
                          onClick={() => setStatusFilter('REJEITADA')}
                        >
                          Rejeitada
                        </Button>
                        <Button
                          variant={
                            statusFilter === 'COM_ERROS' ? 'default' : 'outline'
                          }
                          size='sm'
                          className='h-8 rounded-full'
                          onClick={() => setStatusFilter('COM_ERROS')}
                        >
                          Com Erros
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Right Panel: Spreadsheets List and Details */}
              <div className='w-full lg:w-3/4 xl:w-4/5'>
                <div className='flex flex-col gap-6'>
                  {/* Spreadsheets Table */}
                  <Card className='bg-white dark:bg-[#101722]/50 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden'>
                    <div className='overflow-x-auto'>
                      <Table>
                        <TableHeader>
                          <TableRow className='bg-gray-50 dark:bg-gray-900/50'>
                            <TableHead className='px-6 py-3 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                              Data de Envio
                            </TableHead>
                            <TableHead className='px-6 py-3 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                              Técnico
                            </TableHead>
                            <TableHead className='px-6 py-3 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                              Período da Planilha
                            </TableHead>
                            <TableHead className='px-6 py-3 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                              Status
                            </TableHead>
                            <TableHead className='px-6 py-3 font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                              Origem
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className='px-6 py-8 text-center text-gray-500'
                              >
                                Carregando...
                              </TableCell>
                            </TableRow>
                          ) : spreadsheets && spreadsheets.length > 0 ? (
                            spreadsheets.map((spreadsheet) => (
                              <TableRow
                                key={spreadsheet.id}
                                className={`border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/30 cursor-pointer ${
                                  selectedSpreadsheet === spreadsheet.id
                                    ? 'bg-[#3880f5]/10 dark:bg-[#3880f5]/20'
                                    : ''
                                }`}
                                onClick={() =>
                                  setSelectedSpreadsheet(spreadsheet.id)
                                }
                              >
                                <TableCell className='px-6 py-4 whitespace-nowrap'>
                                  {format(
                                    new Date(spreadsheet.sentDate),
                                    'dd/MM/yyyy',
                                    {
                                      locale: ptBR,
                                    }
                                  )}
                                </TableCell>
                                <TableCell className='px-6 py-4 whitespace-nowrap font-medium'>
                                  {spreadsheet.technicianName}
                                </TableCell>
                                <TableCell className='px-6 py-4 whitespace-nowrap'>
                                  {format(
                                    new Date(spreadsheet.periodStart),
                                    'dd/MM/yy',
                                    {
                                      locale: ptBR,
                                    }
                                  )}{' '}
                                  -{' '}
                                  {format(
                                    new Date(spreadsheet.periodEnd),
                                    'dd/MM/yy',
                                    {
                                      locale: ptBR,
                                    }
                                  )}
                                </TableCell>
                                <TableCell className='px-6 py-4 whitespace-nowrap'>
                                  {getStatusBadge(spreadsheet.status)}
                                </TableCell>
                                <TableCell className='px-6 py-4 whitespace-nowrap'>
                                  {spreadsheet.origin === 'AUTOMATICA'
                                    ? 'Automática'
                                    : 'Upload'}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className='px-6 py-8 text-center text-gray-500'
                              >
                                Nenhuma planilha encontrada
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>

                  {/* Comparison Detail Panel */}
                  {selectedSpreadsheet &&
                    spreadsheetDetail &&
                    selectedSheet && (
                      <Card className='bg-white dark:bg-[#101722]/50 rounded-xl border border-gray-200 dark:border-gray-800'>
                        <div className='p-4 border-b dark:border-gray-800 flex flex-wrap justify-between items-center gap-4'>
                          <div>
                            <h3 className='font-bold text-lg'>
                              Detalhes da Planilha:{' '}
                              {selectedSheet.technicianName}
                            </h3>
                            <p className='text-sm text-gray-500 dark:text-gray-400'>
                              Período:{' '}
                              {format(
                                new Date(selectedSheet.periodStart),
                                'dd/MM/yy',
                                {
                                  locale: ptBR,
                                }
                              )}{' '}
                              -{' '}
                              {format(
                                new Date(selectedSheet.periodEnd),
                                'dd/MM/yy',
                                {
                                  locale: ptBR,
                                }
                              )}{' '}
                              |{' '}
                              <span className='font-semibold text-yellow-600 dark:text-yellow-400'>
                                {selectedSheet.discrepancies || 0} divergências
                                encontradas
                              </span>
                            </p>
                          </div>
                          <div className='flex gap-2'>
                            <Button
                              variant='destructive'
                              className='bg-red-600 hover:bg-red-700'
                              onClick={() =>
                                rejectMutation.mutate(selectedSpreadsheet)
                              }
                              disabled={rejectMutation.isPending}
                            >
                              <ThumbsDown className='w-4 h-4 mr-2' />
                              Rejeitar
                            </Button>
                            <Button
                              className='bg-green-600 hover:bg-green-700'
                              onClick={() =>
                                approveMutation.mutate(selectedSpreadsheet)
                              }
                              disabled={approveMutation.isPending}
                            >
                              <ThumbsUp className='w-4 h-4 mr-2' />
                              Aprovar Planilha
                            </Button>
                          </div>
                        </div>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-200 dark:bg-gray-800'>
                          {/* Left: Technician's Spreadsheet */}
                          <div className='bg-white dark:bg-[#101722]/50'>
                            <h4 className='font-semibold p-4 border-b dark:border-gray-800'>
                              Planilha do Técnico
                            </h4>
                            <div className='overflow-x-auto'>
                              <Table>
                                <TableHeader>
                                  <TableRow className='bg-gray-50 dark:bg-gray-900/50'>
                                    <TableHead className='px-4 py-2 font-medium text-gray-500 dark:text-gray-400'>
                                      ID Chamado
                                    </TableHead>
                                    <TableHead className='px-4 py-2 font-medium text-gray-500 dark:text-gray-400'>
                                      Data
                                    </TableHead>
                                    <TableHead className='px-4 py-2 font-medium text-gray-500 dark:text-gray-400 text-right'>
                                      Valor
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {spreadsheetDetail.technicianSpreadsheet.map(
                                    (item, idx) => (
                                      <TableRow
                                        key={idx}
                                        className={`border-b dark:border-gray-800 ${
                                          item.hasDiscrepancy
                                            ? item.discrepancyType === 'VALUE'
                                              ? 'bg-yellow-100 dark:bg-yellow-900/20'
                                              : 'bg-red-100 dark:bg-red-900/20'
                                            : ''
                                        }`}
                                      >
                                        <TableCell className='px-4 py-2'>
                                          {item.ticketId}
                                        </TableCell>
                                        <TableCell className='px-4 py-2'>
                                          {item.date}
                                        </TableCell>
                                        <TableCell className='px-4 py-2 text-right font-bold flex items-center justify-end gap-1'>
                                          {formatCurrency(item.amount)}
                                          {item.hasDiscrepancy && (
                                            <span className='text-yellow-600 dark:text-yellow-400'>
                                              {item.discrepancyType ===
                                              'VALUE' ? (
                                                <AlertTriangle
                                                  className='w-4 h-4'
                                                  title='Valor divergente'
                                                />
                                              ) : (
                                                <AlertCircle
                                                  className='w-4 h-4'
                                                  title='Chamado não encontrado'
                                                />
                                              )}
                                            </span>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    )
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                          {/* Right: ChamadosPro Data */}
                          <div className='bg-white dark:bg-[#101722]/50'>
                            <h4 className='font-semibold p-4 border-b dark:border-gray-800'>
                              Dados do ChamadosPro
                            </h4>
                            <div className='overflow-x-auto'>
                              <Table>
                                <TableHeader>
                                  <TableRow className='bg-gray-50 dark:bg-gray-900/50'>
                                    <TableHead className='px-4 py-2 font-medium text-gray-500 dark:text-gray-400'>
                                      ID Chamado
                                    </TableHead>
                                    <TableHead className='px-4 py-2 font-medium text-gray-500 dark:text-gray-400'>
                                      Data
                                    </TableHead>
                                    <TableHead className='px-4 py-2 font-medium text-gray-500 dark:text-gray-400 text-right'>
                                      Valor
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {spreadsheetDetail.chamadosproData.map(
                                    (item, idx) => (
                                      <TableRow
                                        key={idx}
                                        className={`border-b dark:border-gray-800 ${
                                          item.isMissing
                                            ? 'bg-blue-100 dark:bg-blue-900/20'
                                            : spreadsheetDetail.technicianSpreadsheet.find(
                                                (t) =>
                                                  t.ticketId === item.ticketId
                                              )?.hasDiscrepancy
                                            ? 'bg-yellow-100 dark:bg-yellow-900/20'
                                            : ''
                                        }`}
                                      >
                                        <TableCell
                                          className={`px-4 py-2 ${
                                            item.isMissing
                                              ? 'font-medium text-blue-600 dark:text-blue-400'
                                              : ''
                                          }`}
                                        >
                                          {item.ticketId}
                                        </TableCell>
                                        <TableCell
                                          className={`px-4 py-2 ${
                                            item.isMissing
                                              ? 'font-medium text-blue-600 dark:text-blue-400'
                                              : ''
                                          }`}
                                        >
                                          {item.date}
                                        </TableCell>
                                        <TableCell
                                          className={`px-4 py-2 text-right font-bold flex items-center justify-end gap-1 ${
                                            item.isMissing
                                              ? 'text-blue-600 dark:text-blue-400'
                                              : spreadsheetDetail.technicianSpreadsheet.find(
                                                  (t) =>
                                                    t.ticketId === item.ticketId
                                                )?.hasDiscrepancy
                                              ? 'text-yellow-600 dark:text-yellow-400'
                                              : ''
                                          }`}
                                        >
                                          {formatCurrency(item.amount)}
                                          {item.isMissing && (
                                            <Info
                                              className='w-4 h-4'
                                              title='Não consta na planilha'
                                            />
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    )
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className='sm:max-w-[500px]'>
          <DialogHeader>
            <DialogTitle>Fazer Upload de Planilha</DialogTitle>
            <DialogDescription>
              Selecione um arquivo Excel (.xlsx, .xls) ou CSV (.csv) para fazer
              upload.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='file-upload'>Arquivo</Label>
              <Input
                id='file-upload'
                type='file'
                ref={fileInputRef}
                accept='.xlsx,.xls,.csv'
                onChange={handleFileSelect}
                className='cursor-pointer'
              />
              {uploadFile && (
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  Arquivo selecionado: <strong>{uploadFile.name}</strong>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setShowUploadDialog(false);
                setUploadFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || uploadMutation.isPending}
              className='bg-[#3880f5] hover:bg-[#3880f5]/90'
            >
              {uploadMutation.isPending ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
