import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  X,
  Loader2,
  History,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateInput } from '@/components/ui/date-input';

interface TechnicianPayment {
  technicianId: string;
  technicianName: string;
  technicianAvatar?: string;
  totalAmount: number;
  status: 'PENDENTE' | 'AGENDADO' | 'PAGO';
  scheduledDate?: string;
  paymentScheduleId?: string;
}

interface PaymentDetails {
  technicianId: string;
  tickets: Array<{
    ticketId: string;
    ticketNumber: string;
    clientName: string;
    serviceName: string;
    scheduledDate: string;
    completedAt: string;
    ticketValue: number;
    kmValue: number;
    extraExpenses: number;
    total: number;
  }>;
  totalAmount: number;
  paymentSchedules: any[];
}

interface PaymentHistory {
  id: string;
  technician_id: string;
  technicianName: string;
  technicianAvatar?: string;
  amount: string;
  scheduled_date: string;
  status: string;
  payment_method: string;
  processed_at?: string;
}

export default function AgendamentoPagamentos() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [schedulingPayment, setSchedulingPayment] =
    useState<TechnicianPayment | null>(null);
  const [viewingDetails, setViewingDetails] =
    useState<TechnicianPayment | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'ted'>('pix');

  const { data: payments, isLoading } = useQuery<TechnicianPayment[]>({
    queryKey: ['/api/payments/technicians', statusFilter],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/payments/technicians?status=${statusFilter}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar pagamentos');
      return response.json();
    },
  });

  const { data: paymentDetails, isLoading: detailsLoading } =
    useQuery<PaymentDetails>({
      queryKey: [
        '/api/payments/technicians',
        viewingDetails?.technicianId,
        'details',
      ],
      queryFn: async () => {
        if (!viewingDetails) return null;
        const response = await apiRequest(
          'GET',
          `/api/payments/technicians/${viewingDetails.technicianId}/details`,
          undefined
        );
        if (!response.ok) throw new Error('Erro ao carregar detalhes');
        return response.json();
      },
      enabled: !!viewingDetails,
    });

  const { data: paymentHistory, isLoading: historyLoading } = useQuery<
    PaymentHistory[]
  >({
    queryKey: ['/api/payments/history'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        '/api/payments/history',
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar histórico');
      return response.json();
    },
    enabled: showHistory,
  });

  const scheduleMutation = useMutation({
    mutationFn: async ({
      technicianId,
      amount,
      date,
      method,
    }: {
      technicianId: string;
      amount: number;
      date: Date;
      method: 'pix' | 'ted';
    }) => {
      const response = await apiRequest('POST', '/api/payments/schedule', {
        technicianId,
        amount,
        scheduledDate: date.toISOString(),
        paymentMethod: method,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao agendar pagamento');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/payments/technicians'],
      });
      queryClient.invalidateQueries({ queryKey: ['/api/payments/history'] });
      toast({
        title: 'Pagamento agendado',
        description: 'O pagamento foi agendado com sucesso.',
      });
      setSchedulingPayment(null);
      setScheduledDate(undefined);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao agendar pagamento',
        description: error.message || 'Não foi possível agendar o pagamento.',
      });
    },
  });

  const filteredPayments = payments?.filter((payment) =>
    payment.technicianName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDENTE':
        return (
          <Badge className='bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'>
            Pendente
          </Badge>
        );
      case 'AGENDADO':
        return (
          <Badge className='bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'>
            Agendado
          </Badge>
        );
      case 'PAGO':
        return (
          <Badge className='bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'>
            Pago
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleSchedule = () => {
    if (schedulingPayment && scheduledDate) {
      scheduleMutation.mutate({
        technicianId: schedulingPayment.technicianId,
        amount: schedulingPayment.totalAmount,
        date: scheduledDate,
        method: paymentMethod,
      });
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className='space-y-6 p-6'>
      {/* Breadcrumb */}
      <div className='flex flex-wrap gap-2'>
        <span className='text-[#60708a] dark:text-gray-400 text-base font-medium leading-normal'>
          Financeiro
        </span>
        <span className='text-[#60708a] dark:text-gray-500 text-base font-medium leading-normal'>
          /
        </span>
        <span className='text-[#111418] dark:text-white text-base font-medium leading-normal'>
          Pagamentos
        </span>
      </div>

      {/* Header */}
      <div className='flex flex-wrap justify-between items-center gap-4'>
        <div className='flex flex-col gap-2'>
          <h1 className='text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
            Gestão de Pagamentos - Técnicos
          </h1>
          <p className='text-base text-gray-600 dark:text-gray-400'>
            Agende e gerencie os pagamentos dos técnicos parceiros.
          </p>
        </div>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={() => setShowHistory(true)}
            className='flex items-center gap-2'
          >
            <History className='w-4 h-4' />
            Histórico
          </Button>
          <Button
            className='bg-[#3880f5] hover:bg-[#3880f5]/90'
            onClick={() => {
              // TODO: Implementar agendamento em massa
              toast({
                title: 'Em desenvolvimento',
                description: 'Agendamento em massa será implementado em breve.',
              });
            }}
          >
            <Plus className='w-5 h-5 mr-2' />
            Agendar Novo Pagamento
          </Button>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <Card className='flex flex-col sm:flex-row justify-between items-center gap-4 p-4'>
        <div className='relative w-full sm:max-w-xs'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5' />
          <Input
            className='w-full pl-10 pr-4 py-2 text-sm'
            placeholder='Buscar por nome do técnico...'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='icon'>
            <Filter className='w-4 h-4' />
          </Button>
          <Button variant='outline' size='icon'>
            <Download className='w-4 h-4' />
          </Button>
        </div>
      </Card>

      {/* Status Filters */}
      <div className='flex gap-3 overflow-x-auto pb-2'>
        <Button
          variant={statusFilter === 'pending' ? 'default' : 'outline'}
          className='flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full'
          onClick={() => setStatusFilter('pending')}
        >
          <p className='text-sm font-medium leading-normal'>
            Com Saldo Pendente
          </p>
        </Button>
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          className='flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full'
          onClick={() => setStatusFilter('all')}
        >
          <p className='text-sm font-medium leading-normal'>Todos</p>
        </Button>
        <Button
          variant={statusFilter === 'scheduled' ? 'default' : 'outline'}
          className='flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full'
          onClick={() => setStatusFilter('scheduled')}
        >
          <p className='text-sm font-medium leading-normal'>Agendados</p>
        </Button>
        <Button
          variant={statusFilter === 'paid' ? 'default' : 'outline'}
          className='flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full'
          onClick={() => setStatusFilter('paid')}
        >
          <p className='text-sm font-medium leading-normal'>Pagos</p>
        </Button>
      </div>

      {/* Technicians Table */}
      <Card className='overflow-hidden'>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow className='bg-gray-50 dark:bg-gray-800/50'>
                <TableHead className='px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                  Nome do Técnico
                </TableHead>
                <TableHead className='px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                  Total a Pagar
                </TableHead>
                <TableHead className='px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'>
                  Status
                </TableHead>
                <TableHead className='px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 text-right'>
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='px-6 py-8 text-center text-gray-500'
                  >
                    <div className='flex items-center justify-center gap-2'>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      Carregando...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredPayments && filteredPayments.length > 0 ? (
                filteredPayments.map((payment) => (
                  <TableRow
                    key={payment.technicianId}
                    className='hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors'
                  >
                    <TableCell className='px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap'>
                      <div className='flex items-center gap-3'>
                        <Avatar className='h-8 w-8'>
                          <AvatarImage
                            src={payment.technicianAvatar}
                            alt={payment.technicianName}
                          />
                          <AvatarFallback className='bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300'>
                            {getInitials(payment.technicianName)}
                          </AvatarFallback>
                        </Avatar>
                        {payment.technicianName}
                      </div>
                    </TableCell>
                    <TableCell className='px-6 py-4 font-semibold text-gray-900 dark:text-white'>
                      {formatCurrency(payment.totalAmount)}
                    </TableCell>
                    <TableCell className='px-6 py-4'>
                      {getStatusBadge(payment.status)}
                    </TableCell>
                    <TableCell className='px-6 py-4 text-right'>
                      <div className='flex items-center justify-end gap-2'>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-9 w-9'
                          onClick={() => setViewingDetails(payment)}
                          title='Visualizar Detalhes Financeiros'
                        >
                          <Eye className='w-4 h-4' />
                        </Button>
                        {payment.status === 'PENDENTE' && (
                          <Button
                            className='flex items-center justify-center gap-2 h-9 px-3 text-xs font-medium text-white bg-[#3880f5] hover:bg-[#3880f5]/90'
                            onClick={() => setSchedulingPayment(payment)}
                          >
                            <Calendar className='w-4 h-4' />
                            Agendar
                          </Button>
                        )}
                        {payment.status === 'AGENDADO' && (
                          <Button
                            variant='outline'
                            size='sm'
                            className='cursor-not-allowed'
                            disabled
                          >
                            <Calendar className='w-4 h-4 mr-2' />
                            Agendado
                          </Button>
                        )}
                        {payment.status === 'PAGO' && (
                          <Button
                            variant='outline'
                            size='sm'
                            className='cursor-not-allowed'
                            disabled
                          >
                            <Calendar className='w-4 h-4 mr-2' />
                            Pago
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='px-6 py-8 text-center text-gray-500'
                  >
                    Nenhum pagamento encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Schedule Payment Dialog */}
      <Dialog
        open={!!schedulingPayment}
        onOpenChange={() => {
          setSchedulingPayment(null);
          setScheduledDate(undefined);
        }}
      >
        <DialogContent className='w-full max-w-md'>
          <DialogHeader>
            <div className='flex items-center justify-between'>
              <DialogTitle className='text-lg font-semibold'>
                Agendar Pagamento
              </DialogTitle>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => {
                  setSchedulingPayment(null);
                  setScheduledDate(undefined);
                }}
                className='h-6 w-6'
              >
                <X className='w-4 h-4' />
              </Button>
            </div>
            <DialogDescription className='sr-only'>
              Defina metodo e data para agendar o pagamento.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div>
              <p className='text-sm text-gray-600 dark:text-gray-400 mb-2'>
                Técnico:{' '}
                <span className='font-medium text-gray-900 dark:text-white'>
                  {schedulingPayment?.technicianName}
                </span>
              </p>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                Valor:{' '}
                <span className='font-medium text-gray-900 dark:text-white'>
                  {formatCurrency(schedulingPayment?.totalAmount || 0)}
                </span>
              </p>
            </div>
            <div>
              <Label className='mb-2 block'>Método de Pagamento</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value: 'pix' | 'ted') =>
                  setPaymentMethod(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='pix'>PIX</SelectItem>
                  <SelectItem value='ted'>TED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className='mb-2 block'>Data do Pagamento</Label>
              <DateInput
                value={scheduledDate}
                onChange={setScheduledDate}
                className='w-full'
                minDate={new Date()}
              />
            </div>
            <div className='flex justify-end gap-3 pt-4'>
              <Button
                variant='ghost'
                onClick={() => {
                  setSchedulingPayment(null);
                  setScheduledDate(undefined);
                }}
              >
                Cancelar
              </Button>
              <Button
                className='bg-[#3880f5] hover:bg-[#3880f5]/90'
                onClick={handleSchedule}
                disabled={!scheduledDate || scheduleMutation.isPending}
              >
                {scheduleMutation.isPending ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                    Agendando...
                  </>
                ) : (
                  'Confirmar Agendamento'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Details Dialog */}
      <Dialog
        open={!!viewingDetails}
        onOpenChange={() => setViewingDetails(null)}
      >
        <DialogContent className='w-full max-w-3xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              Detalhes Financeiros - {viewingDetails?.technicianName}
            </DialogTitle>
            <DialogDescription className='sr-only'>
              Resumo financeiro dos chamados concluidos para o tecnico.
            </DialogDescription>
          </DialogHeader>
          {detailsLoading ? (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='w-6 h-6 animate-spin' />
            </div>
          ) : paymentDetails ? (
            <div className='space-y-4'>
              <div className='p-4 bg-gray-50 dark:bg-gray-800 rounded-lg'>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  Total a Pagar
                </p>
                <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                  {formatCurrency(paymentDetails.totalAmount)}
                </p>
              </div>
              <div>
                <h3 className='text-lg font-semibold mb-3'>
                  Chamados Concluídos
                </h3>
                <div className='space-y-2'>
                  {paymentDetails.tickets.map((ticket) => (
                    <Card key={ticket.ticketId} className='p-4'>
                      <div className='flex justify-between items-start'>
                        <div>
                          <p className='font-medium text-gray-900 dark:text-white'>
                            {ticket.ticketNumber} - {ticket.clientName}
                          </p>
                          <p className='text-sm text-gray-600 dark:text-gray-400'>
                            {ticket.serviceName}
                          </p>
                          <p className='text-xs text-gray-500 dark:text-gray-500'>
                            {ticket.completedAt
                              ? format(
                                  new Date(ticket.completedAt),
                                  'dd/MM/yyyy',
                                  {
                                    locale: ptBR,
                                  }
                                )
                              : '-'}
                          </p>
                        </div>
                        <div className='text-right'>
                          <p className='font-semibold text-gray-900 dark:text-white'>
                            {formatCurrency(ticket.total)}
                          </p>
                          <p className='text-xs text-gray-500 dark:text-gray-500'>
                            Serviço: {formatCurrency(ticket.ticketValue)}
                            {ticket.kmValue > 0 &&
                              ` + KM: ${formatCurrency(ticket.kmValue)}`}
                            {ticket.extraExpenses > 0 &&
                              ` + Extras: ${formatCurrency(
                                ticket.extraExpenses
                              )}`}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className='w-full max-w-4xl max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Histórico de Pagamentos</DialogTitle>
            <DialogDescription className='sr-only'>
              Historico de pagamentos realizados.
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='w-6 h-6 animate-spin' />
            </div>
          ) : paymentHistory && paymentHistory.length > 0 ? (
            <div className='space-y-2'>
              {paymentHistory.map((payment) => (
                <Card key={payment.id} className='p-4'>
                  <div className='flex justify-between items-center'>
                    <div className='flex items-center gap-3'>
                      <Avatar className='h-10 w-10'>
                        <AvatarImage
                          src={payment.technicianAvatar}
                          alt={payment.technicianName}
                        />
                        <AvatarFallback>
                          {getInitials(payment.technicianName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className='font-medium text-gray-900 dark:text-white'>
                          {payment.technicianName}
                        </p>
                        <p className='text-sm text-gray-600 dark:text-gray-400'>
                          {format(
                            new Date(payment.scheduled_date),
                            'dd/MM/yyyy',
                            {
                              locale: ptBR,
                            }
                          )}
                        </p>
                      </div>
                    </div>
                    <div className='text-right'>
                      <p className='font-semibold text-gray-900 dark:text-white'>
                        {formatCurrency(parseFloat(payment.amount))}
                      </p>
                      <div className='flex items-center gap-2 mt-1'>
                        {getStatusBadge(payment.status.toUpperCase())}
                        <Badge variant='outline' className='text-xs'>
                          {payment.payment_method?.toUpperCase() || 'N/A'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className='text-center py-8 text-gray-500'>
              Nenhum pagamento no histórico
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
