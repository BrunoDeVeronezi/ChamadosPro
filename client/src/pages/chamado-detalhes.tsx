import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { generateReceiptPDF } from '@/utils/receipt-pdf-generator';
import { buildServiceSummary } from '@/utils/service-items';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  CheckCircle2,
  XCircle,
  Navigation,
  MessageCircle,
} from 'lucide-react';
import { TicketCompleteDialog } from '@/components/ticket-complete-dialog';
import { ReceiptPreviewDialog } from '@/components/receipt-preview-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Ticket {
  id: string;
  ticketNumber: string;
  status: string;
  scheduledFor: string;
  startedAt?: string;
  description?: string;
  client: {
    id: string;
    name: string;
    type: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  service: {
    id: string;
    name: string;
  };
  ticketValue?: string;
  kmTotal?: number;
  extraExpenses?: number;
  expenseDetails?: string;
}

export default function ChamadoDetalhes() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/chamado/:id');
  const { toast } = useToast();
  const { user } = useAuth();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [notes, setNotes] = useState('');
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [receiptData, setReceiptPreviewData] = useState<any>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Obter ID do ticket da URL
  const ticketId = params?.id || '';

  const { data: ticket, isLoading } = useQuery<Ticket>({
    queryKey: ['/api/tickets', ticketId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/tickets/${ticketId}`, undefined);
      if (!response.ok) throw new Error('Erro ao carregar chamado');
      return response.json();
    },
    enabled: !!ticketId,
  });

  const updateNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      return await apiRequest('PATCH', `/api/tickets/${ticketId}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketId] });
      toast({
        title: 'Anotações salvas',
        description: 'Suas anotações foram salvas com sucesso.',
      });
    },
  });

  const cancelTicketMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/tickets/${ticketId}/cancel`, {
        cancellationSource: 'TECNICO',
        cancellationReason: 'Cancelado pelo técnico',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketId] });
      toast({
        title: 'Chamado cancelado',
        description: 'O chamado foi cancelado com sucesso.',
      });
      setLocation('/chamados');
    },
  });

  useEffect(() => {
    if (ticket?.startedAt) {
      const startTime = new Date(ticket.startedAt).getTime();
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [ticket?.startedAt]);

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(
      2,
      '0'
    )}:${String(s).padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "d 'de' MMMM, yyyy - HH:mm", {
        locale: ptBR,
      });
    } catch {
      return dateString;
    }
  };

  const handleComplete = async (data: any) => {
    try {
      await apiRequest('POST', `/api/tickets/${ticketId}/complete`, {
        kmTotal: data.kmTotal,
        extraExpenses: data.extraExpenses,
        expenseDetails: data.expenseDetails,
        baseAmount: data.baseAmount,
        totalAmount: data.totalAmount,
        discount: data.discount,
        kmChargeExempt: data.kmChargeExempt,
        serviceItems: data.serviceItems,
        paymentDate: data.paymentDate,
        additionalHourRate: data.additionalHourRate,
        kmRate: data.kmRate,
        warranty: data.warranty,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketId] });

      // Emitir recibo se solicitado
      if (data.shouldIssueReceipt && user && ticket) {
        setReceiptPreviewData({
          company: {
            name: user.companyName || `${user.firstName} ${user.lastName}`,
            // logoUrl: user.companyLogoUrl,
            cnpj: user.cnpj,
            cpf: user.cpf,
            phone: user.phone,
            address: `${user.streetAddress || ''}, ${user.addressNumber || ''} - ${user.neighborhood || ''}, ${user.city || ''}/${user.state || ''}`,
            city: user.city,
          },
          client: {
            name: (ticket as any).client?.name || 'Não informado',
            email: (ticket as any).client?.email,
            phone: (ticket as any).client?.phone,
            document: (ticket as any).client?.cpf || (ticket as any).client?.cnpj,
          },
          ticket: {
            id: (ticket as any).id,
            serviceName: buildServiceSummary(
              data.serviceItems,
              (ticket as any).service?.name || 'Servico Prestado'
            ),
            serviceItems: data.serviceItems,
            date: data.paymentDate || new Date().toISOString(),
            amount: data.totalAmount,
            discount: data.discount,
            kmChargeExempt: data.kmChargeExempt,
            description: data.expenseDetails,
            warranty: data.warranty,
          },
        });
        setIsReceiptModalOpen(true);
      }

      toast({
        title: 'Chamado concluído',
        description: 'O chamado foi finalizado com sucesso.',
      });
      setLocation('/chamados');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao concluir chamado',
        description: error.message,
      });
    }
  };

  if (isLoading) {
    return (
      <div className='max-w-7xl mx-auto p-8'>
        <div className='text-center'>
          <p className='text-slate-500 dark:text-slate-400'>
            Carregando detalhes do chamado...
          </p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className='max-w-7xl mx-auto p-8'>
        <Card className='p-12'>
          <div className='text-center'>
            <XCircle className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>
              Chamado não encontrado
            </h3>
            <p className='text-sm text-muted-foreground mb-4'>
              O chamado solicitado não foi encontrado.
            </p>
            <Button onClick={() => setLocation('/chamados')}>
              Voltar para Chamados
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const isInExecution =
    ticket.status === 'INICIADO' || ticket.status === 'EXECUCAO';

  return (
    <div className='flex flex-col min-h-screen'>
      {/* Fixed Header Banner */}
      {isInExecution && ticket.startedAt && (
        <div className='sticky top-[69px] z-10 border-b border-amber-300 dark:border-amber-800 bg-amber-100 dark:bg-amber-900/50 shadow-sm backdrop-blur-sm'>
          <div className='mx-auto flex max-w-7xl items-center justify-between gap-4 p-4'>
            <div className='flex flex-col md:flex-row md:items-center md:gap-6'>
              <h3 className='text-base font-bold text-amber-900 dark:text-amber-200'>
                Chamado #{ticket.ticketNumber || ticket.id.slice(0, 8)} em
                Execução
              </h3>
              <div className='flex items-center gap-2'>
                <div className='flex items-center justify-center rounded-md px-2 py-1 bg-white/60 dark:bg-slate-800/50'>
                  <p className='text-slate-900 dark:text-slate-100 text-lg font-bold tracking-tighter tabular-nums'>
                    {formatElapsed(elapsedTime)}
                  </p>
                </div>
                <p className='text-sm font-normal text-amber-800 dark:text-amber-300 hidden sm:block'>
                  Tempo decorrido
                </p>
              </div>
            </div>
            <div className='flex flex-shrink-0 gap-3'>
              <Button
                onClick={() => setShowCompleteDialog(true)}
                className='flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#28A745] hover:bg-green-600 text-white text-sm font-bold tracking-wide'
              >
                <span className='truncate'>Concluir</span>
              </Button>
              <Button
                onClick={() => setShowCancelDialog(true)}
                variant='outline'
                className='flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/80 dark:bg-slate-800/50 text-red-600 dark:text-red-400 hover:bg-white dark:hover:bg-slate-800 text-sm font-bold tracking-wide'
              >
                <span className='truncate'>Cancelar</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className='flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        <div className='flex flex-wrap justify-between gap-3 p-4 mb-6'>
          <div className='flex min-w-72 flex-col gap-2'>
            <p className='text-slate-900 dark:text-white text-4xl font-black leading-tight tracking-tighter'>
              Detalhes do Chamado #
              {ticket.ticketNumber || ticket.id.slice(0, 8)}
            </p>
            <p className='text-slate-600 dark:text-slate-400 text-lg font-normal leading-normal'>
              {ticket.service?.name || 'Serviço'}
            </p>
          </div>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          {/* Left Column */}
          <div className='lg:col-span-2 flex flex-col gap-8'>
            {/* Card de Informações do Chamado */}
            <Card className='bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden'>
              <CardHeader className='p-6 border-b border-slate-200 dark:border-slate-800'>
                <CardTitle className='text-lg font-bold text-slate-900 dark:text-white'>
                  Informações do Chamado
                </CardTitle>
              </CardHeader>
              <CardContent className='p-6 grid grid-cols-1 sm:grid-cols-2 gap-6'>
                <div>
                  <p className='text-sm font-medium text-slate-500 dark:text-slate-400 mb-1'>
                    Status
                  </p>
                  <Badge
                    className={
                      ticket.status === 'INICIADO' ||
                      ticket.status === 'EXECUCAO'
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : ticket.status === 'CONCLUÍDO' ||
                          ticket.status === 'CONCLUIDO'
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                        : 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200'
                    }
                  >
                    {ticket.status === 'INICIADO' ||
                    ticket.status === 'EXECUCAO'
                      ? 'Em Execução'
                      : ticket.status === 'CONCLUÍDO' ||
                        ticket.status === 'CONCLUIDO'
                      ? 'Concluído'
                      : ticket.status}
                  </Badge>
                </div>
                <div>
                  <p className='text-sm font-medium text-slate-500 dark:text-slate-400 mb-1'>
                    Data de Abertura
                  </p>
                  <p className='text-base font-semibold text-slate-800 dark:text-slate-200'>
                    {ticket.scheduledFor
                      ? formatDate(ticket.scheduledFor)
                      : 'Não agendado'}
                  </p>
                </div>
                {ticket.description && (
                  <div className='sm:col-span-2'>
                    <p className='text-sm font-medium text-slate-500 dark:text-slate-400 mb-1'>
                      Descrição do Problema
                    </p>
                    <p className='text-base text-slate-700 dark:text-slate-300'>
                      {ticket.description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card de Informações do Cliente */}
            <Card className='bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden'>
              <CardHeader className='p-6 border-b border-slate-200 dark:border-slate-800'>
                <CardTitle className='text-lg font-bold text-slate-900 dark:text-white'>
                  Informações do Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className='p-6 grid grid-cols-1 sm:grid-cols-2 gap-6'>
                <div className='sm:col-span-2'>
                  <p className='text-sm font-medium text-slate-500 dark:text-slate-400 mb-1'>
                    Cliente
                  </p>
                  <p className='text-lg font-semibold text-slate-800 dark:text-slate-200'>
                    {ticket.client.name}
                  </p>
                </div>
                <div>
                  <p className='text-sm font-medium text-slate-500 dark:text-slate-400 mb-1'>
                    Contato
                  </p>
                  <div className='flex items-center gap-2 mt-1'>
                    <Phone className='h-4 w-4 text-slate-500 dark:text-slate-400' />
                    <p className='text-base text-slate-700 dark:text-slate-300'>
                      {ticket.client.phone}
                    </p>
                  </div>
                  <div className='flex items-center gap-2 mt-2'>
                    <Mail className='h-4 w-4 text-slate-500 dark:text-slate-400' />
                    <p className='text-base text-slate-700 dark:text-slate-300'>
                      {ticket.client.email}
                    </p>
                  </div>
                </div>
                {ticket.client.address && (
                  <div>
                    <p className='text-sm font-medium text-slate-500 dark:text-slate-400 mb-1'>
                      Endereço
                    </p>
                    <div className='flex items-start gap-2 mt-1'>
                      <MapPin className='h-4 w-4 text-slate-500 dark:text-slate-400 mt-0.5' />
                      <p className='text-base text-slate-700 dark:text-slate-300'>
                        {ticket.client.address}
                        {ticket.client.city && `, ${ticket.client.city}`}
                        {ticket.client.state && ` - ${ticket.client.state}`}
                        {ticket.client.zipCode && ` - ${ticket.client.zipCode}`}
                      </p>
                    </div>
                    {ticket.client.address && (
                      <Button
                        variant='link'
                        className='inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline mt-2 p-0 h-auto'
                        onClick={() => {
                          const address = encodeURIComponent(
                            `${ticket.client.address}, ${ticket.client.city}, ${ticket.client.state}`
                          );
                          window.open(
                            `https://www.google.com/maps/search/?api=1&query=${address}`,
                            '_blank'
                          );
                        }}
                      >
                        Ver no mapa
                        <Navigation className='h-4 w-4' />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className='flex flex-col gap-8'>
            {/* Card de Serviços */}
            <Card className='bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden'>
              <CardHeader className='p-6 border-b border-slate-200 dark:border-slate-800'>
                <CardTitle className='text-lg font-bold text-slate-900 dark:text-white'>
                  Serviço
                </CardTitle>
              </CardHeader>
              <CardContent className='p-6'>
                <div className='flex items-center gap-4'>
                  <CheckCircle2 className='h-5 w-5 text-primary' />
                  <span className='text-base text-slate-700 dark:text-slate-300'>
                    {ticket.service?.name || 'Serviço não especificado'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Área de Anotações */}
            {isInExecution && (
              <Card className='bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden'>
                <CardHeader className='p-6 border-b border-slate-200 dark:border-slate-800'>
                  <CardTitle className='text-lg font-bold text-slate-900 dark:text-white'>
                    Anotações do Técnico
                  </CardTitle>
                </CardHeader>
                <CardContent className='p-6'>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => {
                      if (notes.trim()) {
                        updateNotesMutation.mutate(notes);
                      }
                    }}
                    className='block w-full rounded-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-200 shadow-sm focus:border-primary focus:ring-primary sm:text-sm'
                    placeholder='Adicione notas sobre o atendimento...'
                    rows={6}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Complete Dialog */}
      {ticket && (
        <TicketCompleteDialog
          isOpen={showCompleteDialog}
          onClose={() => setShowCompleteDialog(false)}
          onComplete={handleComplete}
          isPending={false}
          ticket={ticket as any}
          fullTicketData={ticket as any}
        />
      )}

      {/* Receipt Modal */}
      {receiptData && (
        <ReceiptPreviewDialog
          isOpen={isReceiptModalOpen}
          onClose={() => {
            setIsReceiptModalOpen(false);
            setReceiptPreviewData(null);
          }}
          data={receiptData}
        />
      )}

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className='bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-[#111418] dark:text-white text-2xl font-bold'>
              Cancelar Chamado
            </AlertDialogTitle>
            <AlertDialogDescription className='text-[#60708a] dark:text-gray-400'>
              Tem certeza que deseja cancelar este chamado? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end gap-4 pt-6 border-t dark:border-gray-700'>
            <AlertDialogCancel
              onClick={() => setShowCancelDialog(false)}
              className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-gray-100 dark:bg-gray-700 text-[#111418] dark:text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-200 dark:hover:bg-gray-600'
            >
              <span className='truncate'>Voltar</span>
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                cancelTicketMutation.mutate();
                setShowCancelDialog(false);
              }}
              className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-red-600 text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-red-700'
            >
              <span className='truncate'>Confirmar Cancelamento</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
