import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Edit,
  Trash2,
  Share2,
  MapPin,
  Calendar,
  Clock,
} from 'lucide-react';
import {
  addDays,
  format,
  startOfWeek,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  endOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePaidAccess } from '@/hooks/use-paid-access';
import type { Ticket, Client, Service } from '@shared/schema';

type TicketWithRelations = Ticket & {
  client: Client;
  service: Service;
  date: Date;
};

interface CalendarViewProps {
  tickets: TicketWithRelations[];
}

const statusLabels = {
  ABERTO: 'Aberto',
  INICIADO: 'Iniciado',
  EXECUCAO: 'Iniciado', // Compatibilidade
  CONCLUÍDO: 'Concluído',
  CONCLUIDO: 'Concluído', // Compatibilidade
  CANCELADO: 'Cancelado',
  CANCELLED: 'Cancelado', // Compatibilidade
  cancelled: 'Cancelado',
  'no-show': 'No Compareceu',
};

const statusColors = {
  ABERTO: 'bg-blue-500',
  EXECUCAO: 'bg-yellow-500',
  CONCLUIDO: 'bg-green-600',
  cancelled: 'bg-gray-500',
  'no-show': 'bg-red-500',
};

function getTicketDate(ticket: TicketWithRelations) {
  const d = ticket.date
    ? new Date(ticket.date)
    : new Date(ticket.scheduledDate as any);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function CalendarView({ tickets }: CalendarViewProps) {
  const isMobile = useIsMobile();
  const slotBase = 78; // base size (px) to keep weekly cells closer to square on mobile
  const [currentWeek, setCurrentWeek] = useState(
    startOfWeek(new Date(), { locale: ptBR })
  );
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [selectedTicket, setSelectedTicket] =
    useState<TicketWithRelations | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();
  const { requirePaid } = usePaidAccess();
  const queryClient = useQueryClient();

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));
  const timeSlots = Array.from({ length: 13 }, (_, i) => i + 7); // 7am to 7pm
  const monthStart = startOfMonth(currentWeek);
  const monthEnd = endOfMonth(currentWeek);
  const monthGridDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { locale: ptBR }),
    end: endOfWeek(monthEnd, { locale: ptBR }),
  });

  const getTicketsForSlot = (day: Date, hour: number) => {
    return tickets.filter((ticket) => {
      const timeStr = ticket.scheduledTime || '';
      const parts = timeStr.split(':');
      if (!parts[0]) return false;
      const aptHour = parseInt(parts[0]);
      const ticketDate = getTicketDate(ticket);
      return isSameDay(ticketDate, day) && aptHour === hour;
    });
  };

  const getTicketsForDay = (day: Date) => {
    return tickets
      .filter((ticket) => {
        const ticketDate = getTicketDate(ticket);
        return isSameDay(ticketDate, day);
      })
      .sort((a, b) => {
        const timeA = a.scheduledTime || '00:00';
        const timeB = b.scheduledTime || '00:00';
        return timeA.localeCompare(timeB);
      });
  };

  // Start ticket (check-in)
  const startMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      return await apiRequest('POST', `/api/tickets/${ticketId}/checkin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setSelectedTicket(null);
      toast({
        title: 'Atendimento iniciado',
        description: 'O timer foi iniciado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao iniciar atendimento',
        description: error.message,
      });
    },
  });

  // Delete ticket
  const deleteMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      return await apiRequest('DELETE', `/api/tickets/${ticketId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setSelectedTicket(null);
      toast({
        title: 'Chamado excludo',
        description: 'O chamado foi removido com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir chamado',
        description: error.message,
      });
    },
  });

  const handleShareWhatsApp = (ticket: TicketWithRelations) => {
    if (
      !requirePaid({
        feature: 'Envio por WhatsApp',
        description: 'Envios por WhatsApp estao disponiveis apenas na versao paga.',
      })
    ) {
      return;
    }
    const clientName = ticket.client?.name || 'Cliente';
    const serviceName = ticket.service?.name || ticket.finalClient || 'Serviço';
    const date = format(getTicketDate(ticket), 'dd/MM/yyyy', { locale: ptBR });
    const time = ticket.scheduledTime || '--:--';

    const message = `*Agendamento Confirmado*

Cliente: ${clientName}
Serviço: ${serviceName}
  Data: ${date}
  Horrio: ${time}
  ${ticket.serviceAddress ? `Endereo: ${ticket.serviceAddress}` : ''}
  ${ticket.description ? `\nObservaes: ${ticket.description}` : ''}`.trim();

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
  };

  return (
    <>
      <Card className='shadow-sm'>
        <CardHeader className='p-4 sm:p-6'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4'>
            <CardTitle className='text-lg sm:text-xl font-semibold'>
              {viewMode === 'week' ? 'Calendário Semanal' : 'Calendário Mensal'}
            </CardTitle>
            <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-2'>
              <div className='flex rounded-md border bg-background overflow-hidden w-full sm:w-auto'>
                <Button
                  variant={viewMode === 'week' ? 'default' : 'ghost'}
                  size='sm'
                  className='rounded-none flex-1 sm:flex-none'
                  onClick={() => setViewMode('week')}
                >
                  Semanal
                </Button>
                <Button
                  variant={viewMode === 'month' ? 'default' : 'ghost'}
                  size='sm'
                  className='rounded-none flex-1 sm:flex-none'
                  onClick={() => setViewMode('month')}
                >
                  Mensal
                </Button>
              </div>
              {viewMode === 'week' ? (
                <div className='flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='icon'
                    onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
                    data-testid='button-prev-week'
                    className='flex-shrink-0'
                  >
                    <ChevronLeft className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      setCurrentWeek(startOfWeek(new Date(), { locale: ptBR }))
                    }
                    data-testid='button-today'
                    className='flex-1 sm:flex-none'
                  >
                    Hoje
                  </Button>
                  <Button
                    variant='outline'
                    size='icon'
                    onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
                    data-testid='button-next-week'
                    className='flex-shrink-0'
                  >
                    <ChevronRight className='h-4 w-4' />
                  </Button>
                </div>
              ) : (
                <div className='flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='icon'
                    onClick={() => setCurrentWeek(addDays(monthStart, -1))}
                    data-testid='button-prev-month'
                    className='flex-shrink-0'
                  >
                    <ChevronLeft className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentWeek(startOfMonth(new Date()))}
                    data-testid='button-today-month'
                    className='flex-1 sm:flex-none'
                  >
                    Este mês
                  </Button>
                  <Button
                    variant='outline'
                    size='icon'
                    onClick={() => setCurrentWeek(addDays(monthEnd, 1))}
                    data-testid='button-next-month'
                    className='flex-shrink-0'
                  >
                    <ChevronRight className='h-4 w-4' />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className='p-0 sm:p-6'>
          {viewMode === 'week' ? (
            isMobile ? (
              // Mobile: Lista vertical de agendamentos por dia
              <div className='space-y-4 p-4'>
                {weekDays.map((day) => {
                  const dayTickets = getTicketsForDay(day);
                  return (
                    <div key={day.toISOString()} className='space-y-2'>
                      <div className='flex items-center justify-between border-b pb-2'>
                        <div>
                          <div className='text-sm font-semibold'>
                            {format(day, 'EEEE', { locale: ptBR })}
                          </div>
                          <div className='text-xs text-muted-foreground'>
                            {format(day, "dd 'de' MMMM", { locale: ptBR })}
                          </div>
                        </div>
                        {dayTickets.length > 0 && (
                          <Badge variant='secondary' className='text-xs'>
                            {dayTickets.length}
                          </Badge>
                        )}
                      </div>
                      {dayTickets.length > 0 ? (
                        <div className='space-y-2'>
                          {dayTickets.map((ticket) => (
                            <div
                              key={ticket.id}
                              onClick={() => setSelectedTicket(ticket)}
                              className='bg-card border rounded-lg p-3 cursor-pointer hover:bg-accent transition-colors'
                              data-testid={`appointment-${ticket.id}`}
                            >
                              <div className='flex items-start justify-between gap-2 mb-2'>
                                <div className='flex-1 min-w-0'>
                                  <div className='flex items-center gap-2 mb-1'>
                                    <Badge
                                      className={`${
                                        statusColors[
                                          ticket.status as keyof typeof statusColors
                                        ] || 'bg-primary'
                                      } text-primary-foreground text-xs`}
                                    >
                                      {statusLabels[
                                        ticket.status as keyof typeof statusLabels
                                      ] || ticket.status}
                                    </Badge>
                                    <span className='text-sm font-semibold truncate'>
                                      {ticket.client?.name || 'Cliente'}
                                    </span>
                                  </div>
                                  <div className='text-xs text-muted-foreground truncate mb-1'>
                                    {ticket.service?.name ||
                                      ticket.finalClient ||
                                      'Serviço'}
                                  </div>
                                  <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                                    <div className='flex items-center gap-1'>
                                      <Clock className='h-3 w-3' />
                                      <span>
                                        {ticket.scheduledTime || '--:--'}
                                      </span>
                                    </div>
                                    {ticket.serviceAddress && (
                                      <div className='flex items-center gap-1 truncate'>
                                        <MapPin className='h-3 w-3 flex-shrink-0' />
                                        <span className='truncate'>
                                          {ticket.serviceAddress}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className='flex flex-wrap gap-2 mt-2'>
                                {ticket.status === 'ABERTO' && (ticket as any).calculationsEnabled !== false && (
                                  <Button
                                    variant='secondary'
                                    size='sm'
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startMutation.mutate(ticket.id);
                                    }}
                                    data-testid={`button-start-${ticket.id}`}
                                    className='text-xs h-7 px-2'
                                  >
                                    <Play className='h-3 w-3 mr-1' />
                                    Iniciar
                                  </Button>
                                )}
                                <Button
                                  variant='outline'
                                  size='sm'
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTicket(ticket);
                                  }}
                                  data-testid={`button-edit-${ticket.id}`}
                                  className='text-xs h-7 px-2'
                                >
                                  <Edit className='h-3 w-3 mr-1' />
                                  Detalhes
                                </Button>
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShareWhatsApp(ticket);
                                  }}
                                  data-testid={`button-share-${ticket.id}`}
                                  className='text-xs h-7 px-2'
                                >
                                  <Share2 className='h-3 w-3 mr-1' />
                                  WhatsApp
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className='text-center py-4 text-sm text-muted-foreground'>
                          Sem agendamentos
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              // Desktop: Grade semanal tradicional
              <div className='overflow-x-auto w-full px-2 sm:px-0'>
                <div className='min-w-[600px] sm:min-w-full'>
                  <div className='grid grid-cols-8 border-b'>
                    <div className='p-1.5 sm:p-2 text-xs font-semibold text-muted-foreground min-w-[60px] sm:min-w-0 flex items-center justify-center'>
                      Horário
                    </div>
                    {weekDays.map((day) => (
                      <div
                        key={day.toISOString()}
                        className='p-1.5 sm:p-2 text-center border-l min-w-[80px] sm:min-w-0'
                      >
                        <div className='text-[10px] sm:text-xs font-semibold text-muted-foreground leading-tight'>
                          {format(day, 'EEE', { locale: ptBR })}
                        </div>
                        <div className='text-[10px] sm:text-sm font-semibold leading-tight'>
                          {format(day, 'dd/MM')}
                        </div>
                      </div>
                    ))}
                  </div>

                  {timeSlots.map((hour) => (
                    <div
                      key={hour}
                      className='grid grid-cols-8 border-b min-h-[60px] sm:min-h-[80px]'
                    >
                      <div className='p-1 sm:p-2 text-[10px] sm:text-xs text-muted-foreground border-r min-w-[60px] sm:min-w-0 flex items-center justify-center'>
                        {`${hour.toString().padStart(2, '0')}:00`}
                      </div>
                      {weekDays.map((day) => {
                        const dayTickets = getTicketsForSlot(day, hour);
                        return (
                          <div
                            key={day.toISOString()}
                            className='p-0.5 sm:p-1 border-l relative min-w-[80px] sm:min-w-0 overflow-hidden'
                          >
                            {dayTickets.length > 0 ? (
                              <div className='space-y-1 h-full overflow-y-auto'>
                                {dayTickets.map((ticket) => (
                                  <div
                                    key={ticket.id}
                                    onClick={() => setSelectedTicket(ticket)}
                                    className='bg-primary text-primary-foreground rounded p-1 sm:p-1.5 text-[9px] sm:text-[10px] cursor-pointer hover:opacity-90 transition-opacity'
                                    data-testid={`appointment-${ticket.id}`}
                                  >
                                    <div className='flex flex-col gap-0.5 sm:gap-1'>
                                      <div className='flex items-center gap-1 flex-wrap'>
                                        <Badge
                                          className={`${
                                            statusColors[
                                              ticket.status as keyof typeof statusColors
                                            ] || 'bg-primary'
                                          } text-primary-foreground text-[8px] sm:text-[9px] h-3 sm:h-4 px-1 leading-none`}
                                        >
                                          {statusLabels[
                                            ticket.status as keyof typeof statusLabels
                                          ] || ticket.status}
                                        </Badge>
                                        <span className='font-semibold truncate text-[9px] sm:text-[10px] leading-tight flex-1 min-w-0'>
                                          {ticket.client?.name || 'Cliente'}
                                        </span>
                                      </div>
                                      <div className='text-[8px] sm:text-[9px] text-primary-foreground/80 truncate leading-tight'>
                                        {ticket.service?.name ||
                                          ticket.finalClient ||
                                          'Serviço'}
                                      </div>
                                      <div className='text-[8px] sm:text-[9px] text-primary-foreground/70 leading-tight'>
                                        {ticket.scheduledTime || '--:--'}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className='h-full flex items-center justify-center'>
                                <span className='text-[8px] sm:text-[9px] text-muted-foreground opacity-50'>
                                  —
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className='space-y-2 p-2 sm:p-4'>
              <div className='grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground mb-1'>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sb'].map((d) => (
                  <div key={d} className='py-1 sm:py-2'>
                    {d}
                  </div>
                ))}
              </div>
              <div className='grid grid-cols-7 gap-1 sm:gap-2'>
                {monthGridDays.map((day) => {
                  const dayTickets = tickets.filter((ticket) =>
                    isSameDay(getTicketDate(ticket), day)
                  );
                  const hasTickets = dayTickets.length > 0;
                  const isCurrentMonth =
                    day.getMonth() === monthStart.getMonth() &&
                    day.getFullYear() === monthStart.getFullYear();
                  return (
                    <div
                      key={day.toISOString()}
                      className={`aspect-square rounded-md border bg-background/60 p-0.5 sm:p-1.5 flex flex-col overflow-hidden ${
                        hasTickets ? 'hover:border-primary/50' : ''
                      } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                    >
                      <div className='flex items-center justify-between mb-0.5 sm:mb-1 flex-shrink-0'>
                        <span className='text-[10px] sm:text-xs font-semibold leading-none'>
                          {format(day, 'd')}
                        </span>
                        {hasTickets && (
                          <Badge
                            variant='secondary'
                            className='text-[8px] sm:text-[9px] h-3 sm:h-4 px-1 leading-none'
                          >
                            {dayTickets.length}
                          </Badge>
                        )}
                      </div>
                      <div className='flex-1 overflow-hidden min-h-0 flex flex-col'>
                        {hasTickets ? (
                          <div className='space-y-0.5 h-full overflow-hidden flex flex-col'>
                            {dayTickets
                              .slice(0, isMobile ? 1 : 2)
                              .map((ticket) => (
                                <div
                                  key={ticket.id}
                                  onClick={() => setSelectedTicket(ticket)}
                                  className='p-0.5 sm:p-1 rounded bg-primary/5 border border-primary/10 cursor-pointer hover:bg-primary/10 transition-colors flex-shrink-0'
                                >
                                  <p className='font-semibold truncate text-[8px] sm:text-[9px] leading-tight'>
                                    {ticket.client?.name || 'Cliente'}
                                  </p>
                                  <p className='text-[7px] sm:text-[8px] text-muted-foreground truncate leading-tight'>
                                    {ticket.scheduledTime || '--:--'}
                                  </p>
                                </div>
                              ))}
                            {dayTickets.length > (isMobile ? 1 : 2) && (
                              <p className='text-[7px] sm:text-[8px] text-muted-foreground text-center leading-tight mt-0.5 flex-shrink-0'>
                                +{dayTickets.length - (isMobile ? 1 : 2)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className='flex items-center justify-center h-full'>
                            <p className='text-[7px] sm:text-[8px] text-muted-foreground text-center leading-tight'>
                              {isCurrentMonth ? 'Sem agendamentos' : ''}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedTicket}
        onOpenChange={() => setSelectedTicket(null)}
      >
        <DialogContent className='w-[95vw] sm:w-full max-h-[90vh] flex flex-col'>
          <div className='overflow-y-auto flex-1'>
            <DialogHeader>
              <DialogTitle>Detalhes do Agendamento</DialogTitle>
              <DialogDescription>
                {selectedTicket && (
                  <Badge
                    className={
                      statusColors[
                        selectedTicket.status as keyof typeof statusColors
                      ] || 'bg-primary'
                    }
                  >
                    {statusLabels[
                      selectedTicket.status as keyof typeof statusLabels
                    ] || selectedTicket.status}
                  </Badge>
                )}
              </DialogDescription>
            </DialogHeader>

            {selectedTicket && (
              <div className='space-y-4'>
                <div className='space-y-3'>
                  <div className='flex items-start gap-3'>
                    <div className='text-muted-foreground mt-0.5'>👤</div>
                    <div className='flex-1'>
                      <div className='text-sm font-medium'>Cliente</div>
                      <div className='text-sm'>
                        {selectedTicket.client?.name ||
                          selectedTicket.finalClient ||
                          'No informado'}
                      </div>
                    </div>
                  </div>

                  <div className='flex items-start gap-3'>
                    <div className='text-muted-foreground mt-0.5'>🛠️</div>
                    <div className='flex-1'>
                      <div className='text-sm font-medium'>Serviço</div>
                      <div className='text-sm'>
                        {selectedTicket.service?.name ||
                          selectedTicket.ticketNumber ||
                          'No informado'}
                      </div>
                    </div>
                  </div>

                  <div className='flex items-start gap-3'>
                    <Calendar className='h-4 w-4 text-muted-foreground mt-0.5' />
                    <div className='flex-1'>
                      <div className='flex items-center justify-between'>
                        <div className='text-sm font-medium'>Data e Hora</div>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedTicket) {
                              setShowDeleteConfirm(true);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className='h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10'
                          title='Excluir chamado'
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                      <div className='text-sm'>
                        {format(getTicketDate(selectedTicket), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })}{' '}
                        s {selectedTicket.scheduledTime || '--:--'}
                      </div>
                    </div>
                  </div>

                  {selectedTicket.serviceAddress && (
                    <div className='flex items-start gap-3'>
                      <MapPin className='h-4 w-4 text-muted-foreground mt-0.5' />
                      <div className='flex-1'>
                        <div className='text-sm font-medium'>Endereo</div>
                        <div className='text-sm'>
                          {selectedTicket.serviceAddress}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedTicket.description && (
                    <div className='flex items-start gap-3'>
                      <div className='text-muted-foreground mt-0.5'>💬</div>
                      <div className='flex-1'>
                        <div className='text-sm font-medium'>Observaes</div>
                        <div className='text-sm whitespace-pre-wrap'>
                          {selectedTicket.description}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className='flex-col sm:flex-row gap-2 flex-shrink-0 border-t pt-4 mt-4'>
            {selectedTicket &&
              selectedTicket.status === 'ABERTO' &&
              (selectedTicket as any).calculationsEnabled !== false && (
                <Button
                  onClick={() =>
                    selectedTicket && startMutation.mutate(selectedTicket.id)
                  }
                  disabled={startMutation.isPending}
                  className='w-full sm:w-auto order-1 sm:order-1'
                  data-testid='button-start-ticket'
                >
                  <Play className='h-4 w-4 mr-2' />
                  Iniciar Atendimento
                </Button>
              )}

            <Button
              variant='outline'
              onClick={() => {
                toast({
                  title: 'Em desenvolvimento',
                  description: 'Edio em breve',
                });
              }}
              className='w-full sm:w-auto order-2 sm:order-2'
              data-testid='button-edit-ticket'
            >
              <Edit className='h-4 w-4 mr-2' />
              Editar
            </Button>

            <Button
              variant='outline'
              onClick={() =>
                selectedTicket && handleShareWhatsApp(selectedTicket)
              }
              className='w-full sm:w-auto order-3 sm:order-3'
              data-testid='button-share-whatsapp'
            >
              <Share2 className='h-4 w-4 mr-2' />
              WhatsApp
            </Button>

            <Button
              variant='destructive'
              onClick={() => {
                if (selectedTicket) {
                  setShowDeleteConfirm(true);
                }
              }}
              disabled={deleteMutation.isPending}
              className='w-full sm:w-auto order-4 sm:order-4'
              data-testid='button-delete-ticket'
            >
              <Trash2 className='h-4 w-4 mr-2' />
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir chamado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este chamado? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Não
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedTicket) {
                  deleteMutation.mutate(selectedTicket.id);
                  setShowDeleteConfirm(false);
                }
              }}
              disabled={deleteMutation.isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
