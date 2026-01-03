import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TicketCompleteDialog } from '@/components/ticket-complete-dialog';
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
import {
  X,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
} from 'lucide-react';

interface Ticket {
  id: string;
  ticketNumber: string;
  status: string;
  scheduledFor: string;
  startedAt?: string;
  description?: string;
  priority?: string;
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
    contactPerson?: string;
  };
  service: {
    id: string;
    name: string;
  };
  technician?: {
    id: string;
    name: string;
  };
  tasks?: string[];
}

export default function DetalhesChamadoExecucao2() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/detalhes-chamado-execucao-2/:id');
  const { toast } = useToast();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [notes, setNotes] = useState('');
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Obter ID do ticket da URL
  const ticketId = params?.id || '';

  const { data: ticket, isLoading } = useQuery<Ticket>({
    queryKey: ['/api/tickets', ticketId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/tickets/${ticketId}`);
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

  const handleComplete = async (data: any) => {
    try {
      setIsCompleting(true);
      await apiRequest('POST', `/api/tickets/${ticketId}/complete`, {
        kmTotal: data.kmTotal,
        kmRate: data.kmRate,
        additionalHourRate: data.additionalHourRate,
        extraExpenses: data.extraExpenses,
        expenseDetails: data.expenseDetails,
        baseAmount: data.baseAmount,
        totalAmount: data.totalAmount,
        discount: data.discount,
        serviceItems: data.serviceItems,
        paymentDate: data.paymentDate,
        warranty: data.warranty,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      setShowCompleteDialog(false);
      setLocation('/chamados');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao concluir chamado',
        description: error.message || 'Nao foi possivel concluir o chamado.',
      });
    } finally {
      setIsCompleting(false);
    }
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

  if (isLoading) {
    return (
      <div className='font-display bg-background-dark text-slate-300 min-h-screen flex items-center justify-center'>
        <p className='text-slate-400'>Carregando...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className='font-display bg-background-dark text-slate-300 min-h-screen flex items-center justify-center'>
        <p className='text-slate-400'>Chamado não encontrado</p>
      </div>
    );
  }

  return (
    <div className='font-display bg-background-dark text-slate-300'>
      <div className='relative flex min-h-screen w-full flex-col'>
        <header className='sticky top-0 z-20 flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-800 bg-slate-900/80 backdrop-blur-sm px-10 py-3'>
          <div className='flex items-center gap-4 text-slate-200'>
            <div className='size-6 text-primary'>
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
            <h2 className='text-lg font-bold tracking-tight'>ChamadosPro</h2>
          </div>
          <div className='flex flex-1 justify-end gap-8'>
            <nav className='hidden md:flex items-center gap-9'>
              <a
                className='text-sm font-medium text-slate-300 hover:text-primary'
                href='#'
              >
                Dashboard
              </a>
              <a className='text-sm font-bold text-primary' href='#'>
                Chamados
              </a>
              <a
                className='text-sm font-medium text-slate-300 hover:text-primary'
                href='#'
              >
                Clientes
              </a>
              <a
                className='text-sm font-medium text-slate-300 hover:text-primary'
                href='#'
              >
                Agenda
              </a>
              <a
                className='text-sm font-medium text-slate-300 hover:text-primary'
                href='#'
              >
                Financeiro
              </a>
              <a
                className='text-sm font-medium text-slate-300 hover:text-primary'
                href='#'
              >
                Relatórios
              </a>
            </nav>
            <div className='flex items-center gap-2'>
              <Button
                variant='ghost'
                size='icon'
                className='flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700'
              >
                <span>🔔</span>
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700'
              >
                <span>⚙️</span>
              </Button>
              <div className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-primary/20'></div>
            </div>
          </div>
        </header>

        <div className='sticky top-[69px] z-10 border-b border-amber-600 bg-amber-500/90 shadow-lg backdrop-blur-sm'>
          <div className='mx-auto flex max-w-7xl items-center justify-between gap-4 p-4'>
            <div className='flex flex-col md:flex-row md:items-center md:gap-6'>
              <h3 className='text-base font-bold text-white'>
                Chamado #{ticket.ticketNumber || ticket.id.slice(0, 8)} em
                Execução
              </h3>
              <div className='flex items-center gap-3'>
                <div className='flex items-center justify-center rounded-md px-3 py-1.5 bg-white/20 backdrop-blur-sm'>
                  <p className='text-white text-lg font-bold tracking-tighter tabular-nums'>
                    {formatElapsed(elapsedTime)}
                  </p>
                </div>
                <p className='text-sm font-medium text-white hidden sm:block'>
                  Tempo decorrido
                </p>
              </div>
            </div>
            <div className='flex flex-shrink-0 gap-3'>
              <Button
                className='flex min-w-[100px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-green-600 hover:bg-green-500 text-white text-sm font-bold tracking-wide shadow-md'
                onClick={() => setShowCompleteDialog(true)}
              >
                <CheckCircle2 className='w-4 h-4 mr-2' />
                <span className='truncate'>Concluir</span>
              </Button>
              <Button
                variant='outline'
                className='flex min-w-[100px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-red-600 hover:bg-red-500 text-white text-sm font-bold tracking-wide shadow-md border-0'
                onClick={() => setShowCancelDialog(true)}
              >
                <X className='w-4 h-4 mr-2' />
                <span className='truncate'>Cancelar</span>
              </Button>
            </div>
          </div>
        </div>

        <main className='flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
          <div className='flex flex-wrap justify-between gap-3 p-4 mb-6'>
            <div className='flex min-w-72 flex-col gap-2'>
              <h1 className='text-white text-4xl font-black leading-tight tracking-tighter'>
                Detalhes do Chamado #{ticket.ticketNumber}
              </h1>
              <p className='text-slate-400 text-lg font-normal leading-normal'>
                {ticket.service.name}
              </p>
            </div>
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
            <div className='lg:col-span-2 flex flex-col gap-8'>
              <Card className='bg-slate-900 rounded-xl shadow-sm border border-slate-800 overflow-hidden'>
                <div className='p-6 border-b border-slate-800'>
                  <h3 className='text-lg font-bold text-white'>
                    Informações do Chamado
                  </h3>
                </div>
                <div className='p-6 grid grid-cols-1 sm:grid-cols-2 gap-6'>
                  <div>
                    <p className='text-sm font-medium text-slate-400 mb-1'>
                      Status
                    </p>
                    <Badge className='inline-flex items-center rounded-full bg-green-900 px-3 py-1 text-sm font-semibold text-green-200'>
                      Em Execução
                    </Badge>
                  </div>
                  {ticket.priority && (
                    <div>
                      <p className='text-sm font-medium text-slate-400 mb-1'>
                        Prioridade
                      </p>
                      <Badge className='inline-flex items-center rounded-full bg-amber-900 px-3 py-1 text-sm font-semibold text-amber-200'>
                        {ticket.priority}
                      </Badge>
                    </div>
                  )}
                  <div>
                    <p className='text-sm font-medium text-slate-400 mb-1'>
                      Data de Abertura
                    </p>
                    <p className='text-base font-semibold text-slate-200'>
                      {formatDate(ticket.scheduledFor)}
                    </p>
                  </div>
                  {ticket.technician && (
                    <div>
                      <p className='text-sm font-medium text-slate-400 mb-1'>
                        Técnico Responsável
                      </p>
                      <p className='text-base font-semibold text-slate-200'>
                        {ticket.technician.name}
                      </p>
                    </div>
                  )}
                  {ticket.description && (
                    <div className='sm:col-span-2'>
                      <p className='text-sm font-medium text-slate-400 mb-1'>
                        Descrição do Problema
                      </p>
                      <p className='text-base text-slate-300'>
                        {ticket.description}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              <Card className='bg-slate-900 rounded-xl shadow-sm border border-slate-800 overflow-hidden'>
                <div className='p-6 border-b border-slate-800'>
                  <h3 className='text-lg font-bold text-white'>
                    Informações do Cliente
                  </h3>
                </div>
                <div className='p-6 grid grid-cols-1 sm:grid-cols-2 gap-6'>
                  <div className='sm:col-span-2'>
                    <p className='text-sm font-medium text-slate-400 mb-1'>
                      Cliente
                    </p>
                    <p className='text-lg font-semibold text-slate-200'>
                      {ticket.client.name}
                    </p>
                  </div>
                  <div>
                    <p className='text-sm font-medium text-slate-400 mb-1'>
                      Contato Principal
                    </p>
                    <div className='flex items-center gap-2 mt-1'>
                      <span className='text-base text-slate-400'>👤</span>
                      <p className='text-base text-slate-300'>
                        {ticket.client.contactPerson || ticket.client.name}
                      </p>
                    </div>
                    <div className='flex items-center gap-2 mt-2'>
                      <Phone className='w-4 h-4 text-slate-400' />
                      <p className='text-base text-slate-300'>
                        {ticket.client.phone}
                      </p>
                    </div>
                    <div className='flex items-center gap-2 mt-2'>
                      <Mail className='w-4 h-4 text-slate-400' />
                      <p className='text-base text-slate-300'>
                        {ticket.client.email}
                      </p>
                    </div>
                  </div>
                  {ticket.client.address && (
                    <div>
                      <p className='text-sm font-medium text-slate-400 mb-1'>
                        Endereço
                      </p>
                      <div className='flex items-start gap-2 mt-1'>
                        <MapPin className='w-4 h-4 text-slate-400 mt-0.5' />
                        <p className='text-base text-slate-300'>
                          {ticket.client.address}
                          {ticket.client.city && `, ${ticket.client.city}`}
                          {ticket.client.state && `, ${ticket.client.state}`}
                          {ticket.client.zipCode &&
                            ` - ${ticket.client.zipCode}`}
                        </p>
                      </div>
                      <a
                        className='inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline mt-2'
                        href='#'
                      >
                        Ver no mapa
                        <ExternalLink className='w-4 h-4' />
                      </a>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <div className='flex flex-col gap-8'>
              {ticket.tasks && ticket.tasks.length > 0 && (
                <Card className='bg-slate-900 rounded-xl shadow-sm border border-slate-800 overflow-hidden'>
                  <div className='p-6 border-b border-slate-800'>
                    <h3 className='text-lg font-bold text-white'>
                      Serviços a Realizar
                    </h3>
                  </div>
                  <ul className='divide-y divide-slate-800'>
                    {ticket.tasks.map((task, index) => (
                      <li key={index} className='p-4 flex items-center gap-4'>
                        <CheckCircle2 className='w-5 h-5 text-primary' />
                        <span className='text-base text-slate-300'>{task}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card className='bg-slate-900 rounded-xl shadow-sm border border-slate-800 overflow-hidden'>
                <div className='p-6 border-b border-slate-800'>
                  <h3 className='text-lg font-bold text-white'>
                    Anotações do Técnico
                  </h3>
                </div>
                <div className='p-6'>
                  <Textarea
                    className='block w-full rounded-lg border-slate-700 bg-slate-800 text-slate-200 shadow-sm focus:border-primary focus:ring-primary sm:text-sm'
                    id='notes'
                    name='notes'
                    placeholder='Adicione notas sobre o atendimento...'
                    rows={6}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => {
                      if (notes) {
                        updateNotesMutation.mutate(notes);
                      }
                    }}
                  />
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {showCompleteDialog && ticket && (
        <TicketCompleteDialog
          isOpen={showCompleteDialog}
          onClose={() => setShowCompleteDialog(false)}
          onComplete={handleComplete}
          isPending={isCompleting}
          ticket={{
            id: ticket.id,
            serviceId: (ticket as any).serviceId || ticket.service?.id || '',
            ticketValue:
              (ticket as any).ticketValue ||
              (ticket as any).service?.price?.toString() ||
              '0',
            service: {
              name: ticket.service?.name || '',
              price: (ticket as any).service?.price?.toString() || '0',
            },
            kmTotal: (ticket as any).kmTotal || 0,
            kmRate: (ticket as any).kmRate || '0',
          }}
          fullTicketData={ticket as any}
          elapsedSeconds={elapsedTime}
        />
      )}

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Chamado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este chamado? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelTicketMutation.mutate()}
              className='bg-red-600 hover:bg-red-700'
            >
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
