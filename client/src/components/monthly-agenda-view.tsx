import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
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
  Edit,
  X,
  Calendar,
  CalendarDays,
  Clock,
  MapPin,
  User,
  Wrench,
  RefreshCw,
  HelpCircle,
  Check,
  Grid3x3,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Ticket, Client, Service } from '@shared/schema';
import { cn } from '@/lib/utils';

type TicketWithRelations = Ticket & {
  client?: Client;
  service?: Service;
  date?: Date;
};

type CalendarView = 'day' | 'week' | 'month' | 'year';
type AgendaViewMode = 'weekly' | 'monthly';

interface GoogleEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  calendarId: string;
  calendarName: string;
  backgroundColor?: string;
  allDay?: boolean;
}

interface MonthlyAgendaViewProps {
  tickets: TicketWithRelations[];
  clients?: Client[];
  onSyncGoogleCalendar?: () => void;
  isGoogleCalendarConnected?: boolean;
  googleEvents?: GoogleEvent[];
  isGoogleCalendarEnabled?: boolean;
  viewMode: AgendaViewMode;
  onViewModeChange: (mode: AgendaViewMode) => void;
  onCurrentDateChange?: (date: Date) => void;
}

const statusLabels: Record<string, string> = {
  ABERTO: 'Aberto',
  INICIADO: 'Iniciado',
  EXECUCAO: 'Em Execução',
  CONCLUÍDO: 'Concluído',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
  CANCELLED: 'Cancelado',
};

const statusColors: Record<string, string> = {
  ABERTO: 'bg-blue-500',
  INICIADO: 'bg-yellow-500',
  EXECUCAO: 'bg-orange-500',
  CONCLUÍDO: 'bg-green-500',
  CONCLUIDO: 'bg-green-500',
  CANCELADO: 'bg-muted-foreground/60',
  CANCELLED: 'bg-muted-foreground/60',
};

function getTicketDate(ticket: TicketWithRelations): Date {
  if (ticket.date) return ticket.date;
  const d = new Date(ticket.scheduledDate);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function MonthlyAgendaView({
  tickets,
  clients = [],
  onSyncGoogleCalendar,
  isGoogleCalendarConnected = false,
  googleEvents = [],
  isGoogleCalendarEnabled = true,
  viewMode,
  onViewModeChange,
  onCurrentDateChange,
}: MonthlyAgendaViewProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [calendarView, setCalendarView] =
    useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTicket, setSelectedTicket] =
    useState<TicketWithRelations | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isDayEventsOpen, setIsDayEventsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [clientFilter, setClientFilter] = useState<string>('ALL');

  const navigateToEdit = (ticketId?: string) => {
    if (!ticketId) return;
    setSelectedTicket(null);
    setIsDayEventsOpen(false);
    setLocation(`/chamados?edit=${ticketId}`);
  };

  useEffect(() => {
    onCurrentDateChange?.(currentDate);
  }, [currentDate, onCurrentDateChange]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });
  const weekStart = startOfWeek(currentDate, { locale: ptBR });
  const weekEnd = endOfWeek(currentDate, { locale: ptBR });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const yearMonths = eachMonthOfInterval({
    start: startOfYear(currentDate),
    end: endOfYear(currentDate),
  });

  // Filtrar tickets
  const filteredTickets = useMemo(() => {
    let filtered = tickets;

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    if (clientFilter !== 'ALL') {
      filtered = filtered.filter((t) => t.clientId === clientFilter);
    }

    return filtered;
  }, [tickets, statusFilter, clientFilter]);

  // Função auxiliar para processar datas do Google (especialmente eventos de dia inteiro)
  const parseGoogleDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    
    // Se não contém 'T', é um evento de dia inteiro (formato YYYY-MM-DD)
    if (!dateStr.includes('T')) {
      const [year, month, day] = dateStr.split('-').map(Number);
      // Criar data no fuso local: mes é 0-indexed no JS
      return new Date(year, month - 1, day, 0, 0, 0);
    }
    
    // Se contém 'T', é um evento com horário específico
    return new Date(dateStr);
  };

  // Combinar tickets locais com eventos do Google Calendar
  const allEvents = useMemo(() => {

    // Processar tickets locais
    const localEvents = filteredTickets
      .filter((ticket) => !(ticket as any).isGoogleEvent) // Filtrar eventos do Google que já foram mesclados
      .map((ticket) => ({
        ...ticket,
        date: getTicketDate(ticket),
        isGoogleEvent: false,
        displayText: ticket.ticketNumber
          ? `[${ticket.ticketNumber}] ${ticket.client?.name || ticket.finalClient || 'Cliente'}`
          : ticket.client?.name || ticket.finalClient || 'Cliente',
        time: ticket.scheduledTime || '00:00',
        isHoliday: false,
      }));

    // Adicionar eventos do Google Calendar apenas se estiver sincronizado e habilitado
    const googleEventsList = (isGoogleCalendarConnected && isGoogleCalendarEnabled && googleEvents)
      ? googleEvents.map((event) => {
          const eventDate = parseGoogleDate(event.start);
          return {
            id: event.id,
            date: eventDate,
            isGoogleEvent: true,
            displayText: event.summary,
            time: event.start.split('T')[1]?.substring(0, 5) || '00:00',
            backgroundColor: event.backgroundColor,
            description: event.description,
            location: event.location,
            isHoliday: false,
            status: 'ABERTO' as const,
            allDay: event.allDay || false,
          };
        })
      : [];

    // Também incluir eventos do Google Calendar que já foram mesclados nos tickets
    const mergedGoogleEvents = filteredTickets
      .filter((ticket) => (ticket as any).isGoogleEvent)
      .map((ticket) => ({
        ...ticket,
        date: getTicketDate(ticket),
        isGoogleEvent: true,
        displayText: (ticket as any).title || ticket.finalClient || 'Evento',
        time: ticket.scheduledTime || '00:00',
        backgroundColor: (ticket as any).backgroundColor,
        description: (ticket as any).description,
        location: (ticket as any).location,
        isHoliday: false,
      }));

    return [...localEvents, ...googleEventsList, ...mergedGoogleEvents];
  }, [filteredTickets, googleEvents, isGoogleCalendarConnected]);

  // Obter eventos para um dia específico
  const getEventsForDay = (day: Date) => {
    return allEvents.filter((event) => {
      return isSameDay(event.date, day);
    });
  };

  // Verificar se um dia está completamente indisponível (evento de dia inteiro do Google)
  const isDayBlocked = (day: Date): boolean => {
    if (!isGoogleCalendarConnected || !isGoogleCalendarEnabled || !googleEvents) {
      return false;
    }
    
    return googleEvents.some((event) => {
      if (!event.allDay) return false;
      
      const eventDate = parseGoogleDate(event.start);
      return isSameDay(eventDate, day);
    });
  };

  // Verificar se um horário específico está indisponível (evento com horário do Google)
  const isTimeSlotBlocked = (day: Date, time: string): boolean => {
    if (!isGoogleCalendarConnected || !isGoogleCalendarEnabled || !googleEvents) {
      return false;
    }
    
    return googleEvents.some((event) => {
      if (event.allDay) return false; // Eventos de dia inteiro já bloqueiam o dia todo
      
      const eventDate = parseGoogleDate(event.start);
      if (!isSameDay(eventDate, day)) return false;
      
      const eventTime = event.start.split('T')[1]?.substring(0, 5) || '00:00';
      return eventTime === time;
    });
  };

  // Detectar se é feriado (pode ser melhorado com uma biblioteca de feriados)
  const isHoliday = (event: any): boolean => {
    const text = event.displayText?.toLowerCase() || '';
    const description = event.description?.toLowerCase() || '';
    const holidayKeywords = [
      'halloween',
      'thanksgiving',
      'thanksgiving day',
      'black friday',
      'election day',
      'veterans day',
      'daylight saving',
      'daylight saving time ends',
      'feriado',
      'natal',
      'ano novo',
      'páscoa',
      'independência',
      'trabalho',
    ];
    return holidayKeywords.some((keyword) => 
      text.includes(keyword) || description.includes(keyword)
    );
  };

  // Obter status únicos dos tickets
  const availableStatuses = useMemo(() => {
    const statuses = new Set(tickets.map((t) => t.status));
    return Array.from(statuses);
  }, [tickets]);

  // Cancelar chamado
  const cancelMutation = useMutation({
    mutationFn: async (data: { ticketId: string; reason?: string }) => {
      return await apiRequest('POST', `/api/tickets/${data.ticketId}/cancel`, {
        cancellationReason: data.reason || 'Cancelado pelo usuário',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setSelectedTicket(null);
      setShowCancelConfirm(false);
      // Manter o modal de eventos do dia aberto para ver a atualização
      toast({
        title: 'Chamado cancelado',
        description: 'O chamado foi cancelado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar chamado',
        description: error.message,
      });
    },
  });

  // Deletar chamado
  const deleteMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      return await apiRequest('DELETE', `/api/tickets/${ticketId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setSelectedTicket(null);
      setShowDeleteConfirm(false);
      // Manter o modal de eventos do dia aberto para ver a atualização
      toast({
        title: 'Chamado excluído',
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

  const handleCancel = () => {
    if (selectedTicket) {
      cancelMutation.mutate({ ticketId: selectedTicket.id });
    }
  };

  const handleDelete = () => {
    if (selectedTicket) {
      deleteMutation.mutate(selectedTicket.id);
    }
  };

  const selectedTicketDate = selectedTicket
    ? getTicketDate(selectedTicket)
    : null;

  const setAnchorDate = (nextDate: Date) => {
    setCurrentDate(nextDate);
    if (calendarView === 'day') {
      setSelectedDay(nextDate);
    }
  };

  const handlePrevious = () => {
    if (calendarView === 'day') {
      setAnchorDate(addDays(currentDate, -1));
      return;
    }
    if (calendarView === 'week') {
      setAnchorDate(addDays(currentDate, -7));
      return;
    }
    if (calendarView === 'year') {
      setAnchorDate(addMonths(currentDate, -12));
      return;
    }
    setAnchorDate(addMonths(currentDate, -1));
  };

  const handleNext = () => {
    if (calendarView === 'day') {
      setAnchorDate(addDays(currentDate, 1));
      return;
    }
    if (calendarView === 'week') {
      setAnchorDate(addDays(currentDate, 7));
      return;
    }
    if (calendarView === 'year') {
      setAnchorDate(addMonths(currentDate, 12));
      return;
    }
    setAnchorDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    setAnchorDate(new Date());
  };

  const handleCalendarViewChange = (value: CalendarView) => {
    setCalendarView(value);
    setIsDayEventsOpen(false);
    setSelectedTicket(null);
    if (value === 'day') {
      const nextDay = selectedDay || currentDate;
      setSelectedDay(nextDay);
      setCurrentDate(nextDay);
    }
  };

  const headerLabel =
    calendarView === 'day'
      ? format(currentDate, "EEEE, d 'de' MMMM, yyyy", { locale: ptBR })
      : calendarView === 'week'
      ? `${format(weekStart, 'd MMM', { locale: ptBR })} - ${format(weekEnd, "d MMM, yyyy", { locale: ptBR })}`
      : calendarView === 'year'
      ? format(currentDate, 'yyyy')
      : format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });

  const activeDay = selectedDay || currentDate;
  const sortedDayEvents = useMemo(() => {
    const events = getEventsForDay(activeDay);
    return [...events].sort((a, b) => {
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      return timeA.localeCompare(timeB);
    });
  }, [activeDay, allEvents]);

  const renderDayCell = (day: Date, dimOutsideMonth: boolean) => {
    const dayEvents = getEventsForDay(day);
    const isCurrentMonth = isSameMonth(day, currentDate);
    const isToday = isSameDay(day, new Date());
    const isBlocked = isDayBlocked(day);

    const sortedEvents = [...dayEvents].sort((a, b) => {
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      return timeA.localeCompare(timeB);
    });

    const holidays = sortedEvents.filter((e) => isHoliday(e));
    const normalEvents = sortedEvents.filter((e) => !isHoliday(e));

    const maxVisibleEvents = 4;
    const allEventsToShow = [...holidays, ...normalEvents];
    const visibleEvents = allEventsToShow.slice(0, maxVisibleEvents);
    const remainingCount = Math.max(0, sortedEvents.length - maxVisibleEvents);

    return (
      <div
        key={day.toISOString()}
        className={cn(
          'min-h-[120px] border-b border-r border-border/50 p-2 flex flex-col transition-colors',
          dimOutsideMonth && !isCurrentMonth && 'bg-muted/30 opacity-40',
          isToday && !isBlocked && 'bg-primary/[0.03] dark:bg-primary/[0.05]',
          isBlocked && 'bg-muted/70 opacity-50 cursor-not-allowed',
          !isBlocked && 'hover:bg-muted/30 cursor-pointer'
        )}
        onClick={() => {
          setSelectedDay(day);
          setCurrentDate(day);
          setIsDayEventsOpen(true);
        }}
      >
        <div className='mb-2 flex justify-center'>
          <span
            className={cn(
              'text-xs font-black w-7 h-7 flex items-center justify-center rounded-full transition-all',
              isBlocked && 'opacity-40 line-through',
              !isBlocked && 'hover:scale-110',
              isToday && !isBlocked
                ? 'bg-primary text-white shadow-md shadow-primary/30'
                : isBlocked
                ? 'text-muted-foreground/60'
                : isCurrentMonth || !dimOutsideMonth
                ? 'text-foreground'
                : 'text-muted-foreground/70'
            )}
          >
            {format(day, 'd')}
          </span>
        </div>

        <div className='flex-1 space-y-1 overflow-hidden px-0.5'>
          {visibleEvents.length > 0 && !isBlocked ? (
            <>
              {visibleEvents.map((event, idx) => {
                const isHolidayEvent = isHoliday(event);
                const eventColor = event.isGoogleEvent
                  ? event.backgroundColor || '#3b82f6'
                  : statusColors[(event as any).status] || 'bg-blue-500';

                if (isHolidayEvent) {
                  return (
                    <div
                      key={`${event.id}-${idx}`}
                      className='bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-md hover:brightness-110 transition-all font-black uppercase tracking-wider truncate'
                      title={event.description || event.displayText}
                    >
                      {event.displayText}
                    </div>
                  );
                }

                const bgColor = event.isGoogleEvent
                  ? eventColor
                  : undefined;
                const borderColor = event.isGoogleEvent
                  ? undefined
                  : eventColor;

                return (
                  <div
                    key={`${event.id}-${idx}`}
                    className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded-md hover:brightness-110 transition-all font-black truncate flex items-center gap-1',
                      event.isGoogleEvent
                        ? 'text-white'
                        : 'text-foreground bg-muted/70 border-l-2'
                    )}
                    style={{
                      backgroundColor: bgColor,
                      borderLeftColor: borderColor,
                    }}
                    title={event.description || event.displayText}
                  >
                    <span className='opacity-70 text-[8px] font-black shrink-0'>
                      {event.time}
                    </span>
                    <span className='truncate'>{event.displayText}</span>
                  </div>
                );
              })}
              {remainingCount > 0 && (
                <div className='text-[9px] font-black text-muted-foreground/70 px-1 pt-0.5 hover:text-primary transition-colors'>
                  + {remainingCount} chamados
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className='space-y-4 w-full overflow-hidden'>
        {/* Barra Superior - Layout Google Calendar - Responsivo */}
        <div className='flex flex-col xl:flex-row xl:items-center justify-between gap-3'>
          {/* Lado Esquerdo */}
          <div className='flex items-center justify-between sm:justify-start gap-2 overflow-x-auto scrollbar-hide pb-1 xl:pb-0 w-full xl:flex-1 xl:min-w-0'>
            <div className='flex items-center bg-muted/60 p-1 rounded-xl border border-border shrink-0'>
              <Button
                variant='ghost'
                size='sm'
                className='h-8 px-2 sm:px-3 rounded-lg text-[10px] sm:text-xs font-black'
                onClick={handleToday}
              >
                Hoje
              </Button>
              <div className='w-[1px] h-4 bg-border mx-1' />
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8 rounded-lg'
                onClick={handlePrevious}
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8 rounded-lg'
                onClick={handleNext}
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
            <div className='text-xs sm:text-base font-black text-foreground ml-2 whitespace-nowrap uppercase tracking-tight bg-muted/60 px-3 py-1.5 rounded-lg'>
              {headerLabel}
            </div>
          </div>

          {/* Lado Direito - Ações compactas */}
          <div className='flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0 scrollbar-hide w-full xl:w-auto xl:ml-auto justify-end'>
            <div className='flex p-1 bg-muted rounded-xl w-full sm:w-fit shrink-0'>
              <button
                onClick={() => onViewModeChange('weekly')}
                className={cn(
                  'flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-black transition-all',
                  viewMode === 'weekly'
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Grid3x3 className='h-3 w-3 sm:h-3.5 sm:w-3.5' />
                Semanal
              </button>
              <button
                onClick={() => onViewModeChange('monthly')}
                className={cn(
                  'flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-black transition-all',
                  viewMode === 'monthly'
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <CalendarDays className='h-3 w-3 sm:h-3.5 sm:w-3.5' />
                Mensal
              </button>
            </div>
          </div>
        </div>

        {/* Calendário mensal - Scroll horizontal no mobile para evitar esmagamento */}
        {calendarView === 'month' && (
          <div className='border border-border rounded-2xl overflow-hidden bg-card shadow-sm'>
          <div className='overflow-x-auto custom-scrollbar'>
            <div className='min-w-[700px]'>
              {/* Cabeçalho dos dias da semana */}
              <div className='grid grid-cols-7 border-b border-border/60 bg-muted/50'>
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((day) => (
                  <div
                    key={day}
                    className='p-3 text-center text-[10px] font-black text-muted-foreground/70 tracking-widest'
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Grid do calendário */}
              <div className='grid grid-cols-7'>
                {calendarDays.map((day) => {
                  const dayEvents = getEventsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isToday = isSameDay(day, new Date());
                  const isBlocked = isDayBlocked(day);
                  
                  const sortedEvents = [...dayEvents].sort((a, b) => {
                    const timeA = a.time || '00:00';
                    const timeB = b.time || '00:00';
                    return timeA.localeCompare(timeB);
                  });

                  const holidays = sortedEvents.filter((e) => isHoliday(e));
                  const normalEvents = sortedEvents.filter((e) => !isHoliday(e));
                  
                  const maxVisibleEvents = 4;
                  const allEventsToShow = [...holidays, ...normalEvents];
                  const visibleEvents = allEventsToShow.slice(0, maxVisibleEvents);
                  const remainingCount = Math.max(0, sortedEvents.length - maxVisibleEvents);

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'min-h-[120px] border-b border-r border-border/50 p-2 flex flex-col transition-colors',
                        !isCurrentMonth && 'bg-muted/30 opacity-40',
                        isToday && !isBlocked && 'bg-primary/[0.03] dark:bg-primary/[0.05]',
                        isBlocked && 'bg-muted/40',
                        'hover:bg-muted/30 cursor-pointer'
                      )}
                      onClick={() => {
                        // Qualquer clique no quadrado do dia abre o modal de eventos
                        setSelectedDay(day);
                        setCurrentDate(day);
                        setIsDayEventsOpen(true);
                      }}
                    >
                      {/* Número do dia */}
                      <div className='mb-2 flex justify-center'>
                        <span
                          className={cn(
                            'text-xs font-black w-7 h-7 flex items-center justify-center rounded-full transition-all',
                            isBlocked && 'text-muted-foreground/70',
                            'hover:scale-110',
                            isToday && !isBlocked
                              ? 'bg-primary text-white shadow-md shadow-primary/30'
                              : isCurrentMonth
                              ? 'text-foreground'
                              : 'text-muted-foreground/70'
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                      </div>

                      {/* Lista de eventos */}
                      <div className='flex-1 space-y-1 overflow-hidden px-0.5'>
                        {visibleEvents.length > 0 ? (
                          <>
                            {visibleEvents.map((event, idx) => {
                              const isHolidayEvent = isHoliday(event);
                              const eventColor = event.isGoogleEvent
                                ? event.backgroundColor || '#3b82f6'
                                : statusColors[(event as any).status] || 'bg-blue-500';

                              if (isHolidayEvent) {
                                return (
                                  <div
                                    key={`${event.id}-${idx}`}
                                    className='bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-md hover:brightness-110 transition-all font-black uppercase truncate'
                                    title={event.description || event.displayText}
                                  >
                                    {event.displayText}
                                  </div>
                                );
                              }

                              const bgColor = event.isGoogleEvent
                                ? event.backgroundColor || '#3b82f6'
                                : undefined;
                              const borderColor = event.isGoogleEvent
                                ? event.backgroundColor || '#3b82f6'
                                : eventColor;

                              return (
                                <div
                                  key={`${event.id}-${idx}`}
                                  className={cn(
                                    'text-[9px] px-1.5 py-0.5 rounded-md hover:brightness-95 transition-all truncate font-bold flex items-center gap-1',
                                    event.isGoogleEvent
                                      ? 'text-white'
                                      : 'text-foreground bg-muted/70 border-l-2'
                                  )}
                                  style={{
                                    backgroundColor: bgColor,
                                    borderLeftColor: event.isGoogleEvent ? undefined : borderColor,
                                  }}
                                  title={event.description || event.displayText}
                                >
                                  <span className='opacity-70 text-[8px] font-black shrink-0'>
                                    {event.time}
                                  </span>
                                  <span className='truncate'>{event.displayText}</span>
                                </div>
                              );
                            })}
                            {remainingCount > 0 && (
                              <div className='text-[9px] font-black text-muted-foreground/70 px-1 pt-0.5 hover:text-primary transition-colors'>
                                + {remainingCount} chamados
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          </div>
        )}

        {calendarView === 'week' && (
          <div className='border border-border rounded-2xl overflow-hidden bg-card shadow-sm'>
            <div className='overflow-x-auto custom-scrollbar'>
              <div className='min-w-[700px]'>
                <div className='grid grid-cols-7 border-b border-border/60 bg-muted/50'>
                  {weekDays.map((day) => (
                    <div
                      key={day.toISOString()}
                      className='p-3 text-center'
                    >
                      <div className='text-[10px] font-black text-muted-foreground/70 tracking-widest'>
                        {format(day, 'EEE', { locale: ptBR }).toUpperCase()}
                      </div>
                      <div className='text-[11px] font-black text-foreground'>
                        {format(day, 'd')}
                      </div>
                    </div>
                  ))}
                </div>

                <div className='grid grid-cols-7'>
                  {weekDays.map((day) => renderDayCell(day, false))}
                </div>
              </div>
            </div>
          </div>
        )}

        {calendarView === 'day' && (
          <div className='border border-border rounded-2xl overflow-hidden bg-card shadow-sm'>
            <div className='p-4 sm:p-6 border-b border-border/60 bg-muted/50 flex items-center justify-between gap-4'>
              <div className='space-y-1'>
                <h2 className='text-base sm:text-lg font-black text-foreground uppercase tracking-tight'>
                  {format(activeDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h2>
                <p className='text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest'>
                  Agenda do dia
                </p>
              </div>
              <Button
                variant='ghost'
                size='icon'
                className='h-9 w-9 rounded-full hover:bg-muted/70'
                onClick={() => {
                  setSelectedDay(activeDay);
                  setIsDayEventsOpen(true);
                }}
                title='Ver eventos'
              >
                <Calendar className='h-4 w-4 text-primary' />
              </Button>
            </div>

            <div className='p-4 sm:p-6 space-y-3 custom-scrollbar'>
              {sortedDayEvents.length > 0 ? (
                sortedDayEvents.map((event, idx) => {
                  const eventColor = event.isGoogleEvent
                    ? event.backgroundColor || '#3b82f6'
                    : statusColors[(event as any).status] || 'bg-blue-500';

                  return (
                    <div
                      key={`${event.id}-${idx}`}
                      onClick={() => setSelectedTicket(event as any)}
                      className='group relative flex items-center gap-4 p-4 rounded-2xl bg-muted/50 border border-border hover:border-primary/50 transition-all cursor-pointer'
                    >
                      <div
                        className={cn(
                          'w-1.5 h-12 rounded-full shrink-0',
                          event.isGoogleEvent ? '' : eventColor
                        )}
                        style={{ backgroundColor: event.isGoogleEvent ? eventColor : undefined }}
                      />

                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center gap-2 mb-1'>
                          <span className='text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg'>
                            {event.time}
                          </span>
                          {event.isGoogleEvent && (
                            <Badge className='bg-orange-500/10 text-orange-500 border-none text-[10px] font-black uppercase tracking-wider h-5'>
                              Google
                            </Badge>
                          )}
                        </div>
                        <h4 className='text-sm font-black text-foreground truncate group-hover:text-primary transition-colors'>
                          {event.displayText}
                        </h4>
                        <p className='text-[10px] font-bold text-muted-foreground truncate flex items-center gap-1 uppercase tracking-wider'>
                          <MapPin className='h-3 w-3' />
                          {event.location || 'Local nao informado'}
                        </p>
                      </div>

                      <ChevronRight className='h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity' />
                    </div>
                  );
                })
              ) : (
                <div className='flex flex-col items-center justify-center py-12 text-center'>
                  <Calendar className='h-12 w-12 text-muted-foreground/30 mb-4' />
                  <p className='text-sm font-bold text-muted-foreground'>
                    Nenhum compromisso agendado para este dia.
                  </p>
                </div>
              )}
            </div>

            <div className='p-4 sm:p-6 bg-muted/50 border-t border-border/60'>
              <Button
                className='w-full rounded-2xl h-12 font-black uppercase tracking-widest gap-2 shadow-lg shadow-primary/20'
                onClick={() => {
                  window.location.href = `/chamados?date=${activeDay.toISOString()}`;
                }}
              >
                <Plus className='h-5 w-5 stroke-[3px]' />
                // Novo Chamado
              </Button>
            </div>
          </div>
        )}

        {calendarView === 'year' && (
          <div className='border border-border rounded-2xl overflow-hidden bg-card shadow-sm'>
            <div className='p-4 sm:p-6'>
              <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4'>
                {yearMonths.map((monthDate) => {
                  const monthEvents = allEvents.filter((event) =>
                    isSameMonth(event.date, monthDate)
                  );
                  const visibleEvents = monthEvents.slice(0, 3);

                  return (
                    <div
                      key={monthDate.toISOString()}
                      className='rounded-2xl border border-border/60 bg-muted/30 hover:bg-muted/40 transition-colors p-3 sm:p-4 cursor-pointer'
                      onClick={() => {
                        handleCalendarViewChange('month');
                        setCurrentDate(monthDate);
                      }}
                    >
                      <div className='flex items-center justify-between mb-3'>
                        <span className='text-xs sm:text-sm font-black uppercase tracking-wide text-foreground'>
                          {format(monthDate, 'MMM', { locale: ptBR })}
                        </span>
                        <span className='text-[10px] font-black text-muted-foreground'>
                          {monthEvents.length} {monthEvents.length === 1 ? 'evento' : 'eventos'}
                        </span>
                      </div>

                      <div className='space-y-1'>
                        {visibleEvents.length > 0 ? (
                          visibleEvents.map((event, idx) => {
                            const eventColor = event.isGoogleEvent
                              ? event.backgroundColor || '#3b82f6'
                              : statusColors[(event as any).status] || 'bg-blue-500';
                            const bgColor = event.isGoogleEvent
                              ? eventColor
                              : undefined;
                            const borderColor = event.isGoogleEvent
                              ? undefined
                              : eventColor;

                            return (
                              <div
                                key={`${event.id}-${idx}`}
                                className={cn(
                                  'text-[9px] px-1.5 py-0.5 rounded-md hover:brightness-110 transition-all font-black truncate flex items-center gap-1',
                                  event.isGoogleEvent
                                    ? 'text-white'
                                    : 'text-foreground bg-muted/70 border-l-2'
                                )}
                                style={{
                                  backgroundColor: bgColor,
                                  borderLeftColor: borderColor,
                                }}
                                title={event.description || event.displayText}
                              >
                                <span className='opacity-70 text-[8px] font-black shrink-0'>
                                  {event.time}
                                </span>
                                <span className='truncate'>{event.displayText}</span>
                              </div>
                            );
                          })
                        ) : (
                          <div className='text-[10px] font-bold text-muted-foreground/70'>
                            Sem eventos
                          </div>
                        )}
                        {monthEvents.length > visibleEvents.length && (
                          <div className='text-[9px] font-black text-muted-foreground/70 px-1 pt-0.5'>
                            + {monthEvents.length - visibleEvents.length} eventos
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de eventos do dia */}
      <Dialog open={isDayEventsOpen} onOpenChange={(open) => {
        setIsDayEventsOpen(open);
        if (!open) {
          // Se fechar o modal de eventos, também fechar o modal de detalhes se estiver aberto
          setSelectedTicket(null);
          setSelectedDay(null);
        }
      }}>
        <DialogContent className='max-w-lg max-h-[80vh] overflow-hidden flex flex-col p-0 border-none bg-transparent shadow-none [&>button]:hidden'>
          <DialogHeader className='sr-only'>
            <DialogTitle>Eventos do dia</DialogTitle>
            <DialogDescription>
              Lista de eventos e chamados do dia selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className='bg-card rounded-3xl overflow-hidden flex flex-col border border-border shadow-2xl'>
            <div className='p-6 border-b border-border/60 flex items-center justify-between bg-muted/50'>
              <div className='space-y-1'>
                <h2 className='text-xl font-black text-foreground uppercase tracking-tight'>
                  {selectedDay && format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h2>
                <p className='text-xs font-bold text-muted-foreground uppercase tracking-widest'>
                  Agendamentos para este dia
                </p>
              </div>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => setIsDayEventsOpen(false)}
                className='rounded-full hover:bg-muted/70'
              >
                <X className='h-5 w-5' />
              </Button>
            </div>

            <div className='flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar'>
              {selectedDay && getEventsForDay(selectedDay).length > 0 ? (
                getEventsForDay(selectedDay)
                  .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'))
                  .map((event, idx) => {
                    const eventColor = event.isGoogleEvent
                      ? event.backgroundColor || '#3b82f6'
                      : statusColors[(event as any).status] || 'bg-blue-500';
                    
                    return (
                      <div
                        key={`${event.id}-${idx}`}
                        onClick={() => {
                          // Ao clicar no evento dentro do modal, abrir os detalhes do evento
                          setSelectedTicket(event as any);
                          // Manter o modal de eventos do dia aberto enquanto mostra os detalhes
                        }}
                        className='group relative flex items-center gap-4 p-4 rounded-2xl bg-muted/50 border border-border hover:border-primary/50 transition-all cursor-pointer'
                      >
                        <div 
                          className={cn(
                            'w-1.5 h-12 rounded-full shrink-0',
                            event.isGoogleEvent ? '' : eventColor
                          )}
                          style={{ backgroundColor: event.isGoogleEvent ? eventColor : undefined }}
                        />
                        
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2 mb-1'>
                            <span className='text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg'>
                              {event.time}
                            </span>
                            {event.isGoogleEvent && (
                              <Badge className='bg-orange-500/10 text-orange-500 border-none text-[10px] font-black uppercase tracking-wider h-5'>
                                Google
                              </Badge>
                            )}
                          </div>
                          <h4 className='text-sm font-black text-foreground truncate group-hover:text-primary transition-colors'>
                            {event.displayText}
                          </h4>
                          <p className='text-[10px] font-bold text-muted-foreground truncate flex items-center gap-1 uppercase tracking-wider'>
                            <MapPin className='h-3 w-3' />
                            {event.location || 'Local não informado'}
                          </p>
                        </div>

                        <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                          {!event.isGoogleEvent && (
                            <>
                              <Button
                                variant='ghost'
                                size='icon'
                                className='h-8 w-8 rounded-full hover:bg-muted/70 text-muted-foreground'
                                type='button'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigateToEdit(event.id);
                                }}
                              >
                                <Edit className='h-3.5 w-3.5' />
                              </Button>
                              <Button
                                variant='ghost'
                                size='icon'
                                className='h-8 w-8 rounded-full hover:bg-red-100 text-muted-foreground hover:text-red-600'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTicket(event as any);
                                  setShowDeleteConfirm(true);
                                }}
                              >
                                <Trash2 className='h-3.5 w-3.5' />
                              </Button>
                            </>
                          )}
                          <ChevronRight className='h-5 w-5 text-primary' />
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className='flex flex-col items-center justify-center py-12 text-center'>
                  <Calendar className='h-12 w-12 text-muted-foreground/30 mb-4' />
                  <p className='text-sm font-bold text-muted-foreground'>
                    Nenhum compromisso agendado para este dia.
                  </p>
                </div>
              )}
            </div>

            <div className='p-6 bg-muted/50 border-t border-border/60'>
              <Button 
                className='w-full rounded-2xl h-12 font-black uppercase tracking-widest gap-2 shadow-lg shadow-primary/20'
                onClick={() => {
                  // Navegar para a página de chamados para criar um novo
                  window.location.href = `/chamados?date=${selectedDay?.toISOString()}`;
                }}
              >
                <Plus className='h-5 w-5 stroke-[3px]' />
                // Novo Chamado
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de detalhes do chamado/evento - Aparece sobre o modal de eventos */}
      <Dialog
        open={!!selectedTicket}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTicket(null);
            // Não fechar o modal de eventos do dia quando fechar o modal de detalhes
            // O modal de eventos permanece aberto
          }
        }}
      >
        <DialogContent className='max-w-md p-0 border-none bg-transparent shadow-none [&>button]:hidden z-[60]'>
          <DialogHeader className='sr-only'>
            <DialogTitle>Detalhes do evento</DialogTitle>
            <DialogDescription>
              Informacoes do chamado ou evento selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className='bg-card rounded-2xl overflow-hidden shadow-2xl border border-border'>
            {/* Header com Ícones Estilo Google Calendar */}
            <div className='flex items-center justify-between p-4 bg-muted/50 border-b border-border/60'>
              <div className='flex items-center gap-2'>
                {!selectedTicket?.isGoogleEvent && (
                  <>
                    <Button
                      variant='ghost'
                      size='sm'
                      type='button'
                      onClick={() => {
                        if (selectedTicket) {
                          navigateToEdit(selectedTicket.id);
                        }
                      }}
                      className='h-9 px-3 rounded-lg hover:bg-muted/70 text-foreground font-bold text-xs gap-2'
                      title='Editar'
                    >
                      <Edit className='h-4 w-4' />
                      Editar
                    </Button>
                    
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => setShowDeleteConfirm(true)}
                      className='h-9 px-3 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-bold text-xs gap-2'
                      title='Excluir'
                    >
                      <Trash2 className='h-4 w-4' />
                      Excluir
                    </Button>
                  </>
                )}
                {selectedTicket?.isGoogleEvent && (
                  <span className='text-xs font-bold text-muted-foreground'>
                    Eventos do Google Calendar não podem ser editados aqui
                  </span>
                )}
                  </div>

              <Button
                variant='ghost'
                size='icon'
                onClick={() => setSelectedTicket(null)}
                className='h-9 w-9 rounded-full hover:bg-muted/70 text-muted-foreground'
              >
                <X className='h-5 w-5' />
              </Button>
                  </div>

            {/* Conteúdo do Card */}
            <div className='p-6 space-y-6'>
              <div className='flex items-start gap-4'>
                <div 
                  className={cn(
                    'w-4 h-4 rounded-md mt-1.5 shrink-0',
                    selectedTicket?.isGoogleEvent 
                      ? '' 
                      : (selectedTicket ? statusColors[selectedTicket.status] : 'bg-blue-500')
                  )}
                  style={{ 
                    backgroundColor: selectedTicket?.isGoogleEvent 
                      ? selectedTicket.backgroundColor || '#3b82f6' 
                      : undefined 
                  }}
                />
                <div className='space-y-1 min-w-0'>
                  <h3 className='text-xl font-black text-foreground leading-tight break-words'>
                    {selectedTicket?.displayText || selectedTicket?.finalClient || 'Sem Título'}
                  </h3>
                  <p className='text-sm font-bold text-muted-foreground'>
                    {selectedTicketDate && format(selectedTicketDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    {' • '}
                    {selectedTicket?.time || '00:00'}
                  </p>
                </div>
                  </div>

              <div className='space-y-4 ml-8'>
                {/* Status */}
                {!selectedTicket?.isGoogleEvent && selectedTicket && (
                  <div className='flex items-center gap-3'>
                    <div className='p-1.5 bg-muted/70 rounded-lg'>
                      <RefreshCw className='h-4 w-4 text-muted-foreground' />
                    </div>
                    <div>
                      <p className='text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mb-0.5'>Status</p>
                      <Badge className={cn('text-[10px] font-black uppercase tracking-wider h-5 border-none text-white', statusColors[selectedTicket.status])}>
                        {statusLabels[selectedTicket.status]}
                      </Badge>
                </div>
                  </div>
                )}

                {/* Cliente */}
                <div className='flex items-center gap-3'>
                  <div className='p-1.5 bg-muted/70 rounded-lg'>
                    <User className='h-4 w-4 text-muted-foreground' />
                  </div>
                  <div className='min-w-0'>
                    <p className='text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mb-0.5'>Cliente</p>
                    <p className='text-sm font-bold text-foreground truncate'>
                      {selectedTicket?.client?.name || selectedTicket?.finalClient || 'Não informado'}
                    </p>
                  </div>
                </div>

                {/* Localização */}
                {(selectedTicket?.location || selectedTicket?.serviceAddress) && (
                  <div className='flex items-start gap-3'>
                    <div className='p-1.5 bg-muted/70 rounded-lg shrink-0'>
                      <MapPin className='h-4 w-4 text-muted-foreground' />
                    </div>
                    <div className='min-w-0'>
                      <p className='text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mb-0.5'>Localização</p>
                      <p className='text-sm font-bold text-foreground break-words'>
                        {selectedTicket?.location || selectedTicket?.serviceAddress}
                      </p>
                    </div>
                  </div>
                )}

                {/* Descrição */}
                {selectedTicket?.description && (
                  <div className='flex items-start gap-3'>
                    <div className='p-1.5 bg-muted/70 rounded-lg shrink-0'>
                      <Grid3x3 className='h-4 w-4 text-muted-foreground' />
                    </div>
                    <div className='min-w-0'>
                      <p className='text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mb-0.5'>Observações</p>
                      <p className='text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed'>
                      {selectedTicket.description}
                      </p>
                    </div>
                  </div>
                )}

                {/* Calendar Source */}
                <div className='flex items-center gap-3'>
                  <div className='p-1.5 bg-muted/70 rounded-lg'>
                    <Calendar className='h-4 w-4 text-muted-foreground' />
                  </div>
                  <div>
                    <p className='text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mb-0.5'>Agenda</p>
                    <p className='text-sm font-bold text-foreground'>
                      {selectedTicket?.isGoogleEvent ? 'Google Calendar' : 'Sistema ChamadosPro'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer com Ações Principais */}
            {!selectedTicket?.isGoogleEvent && (
              <div className='p-4 bg-muted/50 border-t border-border/60 flex flex-col sm:flex-row gap-2'>
                <Button
                  variant='outline'
                  onClick={() => setShowDeleteConfirm(true)}
                  className='h-10 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800'
                >
                  <Trash2 className='h-3.5 w-3.5 mr-2' />
                  Excluir
                </Button>
                {selectedTicket?.status !== 'CANCELADO' && selectedTicket?.status !== 'CANCELLED' && (
                  <Button
                    variant='outline'
                    onClick={() => setShowCancelConfirm(true)}
                    className='flex-1 h-10 rounded-xl font-bold text-xs uppercase tracking-wider'
                  >
                  Cancelar Chamado
                </Button>
              )}
            <Button
                  onClick={() => {
                    if (selectedTicket) {
                      navigateToEdit(selectedTicket.id);
                    }
                  }}
                  type='button'
                  className='flex-1 h-10 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20'
                >
                  <Edit className='h-3.5 w-3.5 mr-2' />
                  Editar
            </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de cancelamento */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Chamado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este chamado? Esta ação pode ser
              revertida editando o chamado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className='bg-orange-600 hover:bg-orange-700'
            >
              {cancelMutation.isPending ? 'Cancelando...' : 'Sim, cancelar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Chamado</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este chamado? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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

