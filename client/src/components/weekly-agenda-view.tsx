import { useState, useMemo, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  X,
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  MapPin,
  User,
  Wrench,
  RefreshCw,
  Filter,
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  Settings,
  Bell,
  Trash2,
  Grid3x3,
} from 'lucide-react';
import {
  addDays,
  format,
  startOfWeek,
  isSameDay,
  parse,
  startOfDay,
  addHours,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Ticket, Client, Service } from '@shared/schema';
import { cn } from '@/lib/utils';

type TicketWithRelations = Ticket & {
  client?: Client;
  service?: Service;
  date?: Date;
};

interface GoogleCalendar {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
}

type AgendaViewMode = 'weekly' | 'monthly';

interface WeeklyAgendaViewProps {
  tickets: TicketWithRelations[];
  clients?: Client[];
  onSyncGoogleCalendar?: () => void;
  isGoogleCalendarConnected?: boolean;
  isGoogleCalendarEnabled?: boolean;
  viewMode: AgendaViewMode;
  onViewModeChange: (mode: AgendaViewMode) => void;
  onCurrentDateChange?: (date: Date) => void;
  googleCalendars?: GoogleCalendar[];
  selectedCalendarId?: string;
  onSelectCalendar?: (calendarId: string) => void;
  onManageCalendar?: () => void;
  onCreateCalendar?: () => void;
  isCalendarsLoading?: boolean;
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
  ABERTO: 'bg-blue-100 border-blue-300 text-blue-900',
  INICIADO: 'bg-yellow-100 border-yellow-300 text-yellow-900',
  EXECUCAO: 'bg-orange-100 border-orange-300 text-orange-900',
  CONCLUÍDO: 'bg-green-100 border-green-300 text-green-900',
  CONCLUIDO: 'bg-green-100 border-green-300 text-green-900',
  CANCELADO: 'bg-muted/70 border-border text-muted-foreground',
  CANCELLED: 'bg-muted/70 border-border text-muted-foreground',
};

function getTicketDate(ticket: TicketWithRelations): Date {
  if (ticket.date) return ticket.date;
  const d = new Date(ticket.scheduledDate);
  return isNaN(d.getTime()) ? new Date() : d;
}

function getTicketTime(ticket: TicketWithRelations): {
  hour: number;
  minute: number;
} {
  const timeStr = ticket.scheduledTime || '00:00';
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour: hour || 0, minute: minute || 0 };
}

export function WeeklyAgendaView({
  tickets,
  clients = [],
  onSyncGoogleCalendar,
  isGoogleCalendarConnected = false,
  isGoogleCalendarEnabled = true,
  viewMode,
  onViewModeChange,
  onCurrentDateChange,
  googleCalendars = [],
  selectedCalendarId,
  onSelectCalendar,
  onManageCalendar,
  onCreateCalendar,
  isCalendarsLoading = false,
}: WeeklyAgendaViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(
    startOfWeek(new Date(), { locale: ptBR })
  );
  const [selectedTicket, setSelectedTicket] =
    useState<TicketWithRelations | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editEventData, setEditEventData] = useState({
    title: '',
    description: '',
    location: '',
    color: '#3b82f6',
  });
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [clientFilter, setClientFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<Date>(
    startOfWeek(new Date(), { locale: ptBR })
  );
  const [intervalMinutes, setIntervalMinutes] = useState<number>(10);
  const [expandedFilters, setExpandedFilters] = useState<{
    service: boolean;
    staff: boolean;
    location: boolean;
    amenities: boolean;
    pages: boolean;
  }>({
    service: true,
    staff: true,
    location: false,
    amenities: false,
    pages: false,
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    onCurrentDateChange?.(currentWeek);
  }, [currentWeek, onCurrentDateChange]);

  const canManageCalendar =
    !!onManageCalendar && !isCalendarsLoading && googleCalendars.length > 0;
  const showCalendarControls = isGoogleCalendarConnected;

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  // Gerar intervalos de tempo de 10 em 10 minutos das 8h às 20h
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 8; hour < 20; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        slots.push({ hour, minute });
      }
    }
    return slots;
  }, [intervalMinutes]);

  // Obter serviços únicos
  const availableServices = useMemo(() => {
    const services = new Set<string>();
    tickets.forEach((t) => {
      if (t.service?.name) {
        services.add(t.service.name);
      }
    });
    return Array.from(services);
  }, [tickets]);

  // Filtrar tickets
  const filteredTickets = useMemo(() => {
    let filtered = tickets;

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    if (clientFilter !== 'ALL') {
      filtered = filtered.filter((t) => t.clientId === clientFilter);
    }

    if (serviceFilter !== 'ALL') {
      filtered = filtered.filter((t) => t.service?.name === serviceFilter);
    }

    return filtered;
  }, [tickets, statusFilter, clientFilter, serviceFilter]);

  // Obter tickets para um slot específico (dia + hora + minuto)
  const getTicketsForSlot = (day: Date, hour: number, minute: number = 0) => {
    return filteredTickets.filter((ticket) => {
      const ticketDate = getTicketDate(ticket);
      const { hour: ticketHour, minute: ticketMinute } = getTicketTime(ticket);
      if (!isSameDay(ticketDate, day)) return false;

      // Considerar tickets que começam neste slot ou estão em andamento
      if (ticketHour === hour && ticketMinute <= minute) {
        return true;
      }
      // Verificar se o ticket está em andamento neste slot
      const ticketStartMinutes = ticketHour * 60 + ticketMinute;
      const slotStartMinutes = hour * 60 + minute;
      const durationMinutes = (ticket.duration || 1) * 60;
      const ticketEndMinutes = ticketStartMinutes + durationMinutes;

      return (
        slotStartMinutes >= ticketStartMinutes &&
        slotStartMinutes < ticketEndMinutes
      );
    });
  };

  const getTicketsForDay = (day: Date) => {
    return filteredTickets
      .filter((ticket) => isSameDay(getTicketDate(ticket), day))
      .sort((a, b) => {
        const timeA = getTicketTime(a);
        const timeB = getTicketTime(b);
        return timeA.hour * 60 + timeA.minute - (timeB.hour * 60 + timeB.minute);
      });
  };

  // Obter cor do ticket baseada no serviço/staff
  const getTicketColor = (ticket: TicketWithRelations): string => {
    // Eventos de bloqueio usam cor via estilo inline, não via classe
    // Usar cores diferentes baseadas no serviço ou status
    const serviceName = ticket.service?.name?.toLowerCase() || '';
    const status = ticket.status;

    if (status === 'CONCLUÍDO' || status === 'CONCLUIDO') {
      return 'bg-green-500 border-green-600';
    }
    if (status === 'CANCELADO' || status === 'CANCELLED') {
      return 'bg-muted-foreground/60 border-muted-foreground/80';
    }

    // Cores baseadas no tipo de serviço (adaptar conforme necessário)
    const colorMap: Record<string, string> = {
      massagem: 'bg-blue-500 border-blue-600',
      massage: 'bg-blue-500 border-blue-600',
      yoga: 'bg-purple-500 border-purple-600',
      corte: 'bg-indigo-500 border-indigo-600',
      haircut: 'bg-indigo-500 border-indigo-600',
      manicure: 'bg-pink-500 border-pink-600',
      pedicure: 'bg-pink-500 border-pink-600',
      depilação: 'bg-orange-500 border-orange-600',
      waxing: 'bg-orange-500 border-orange-600',
      facial: 'bg-cyan-500 border-cyan-600',
      acupuntura: 'bg-teal-500 border-teal-600',
      acupuncture: 'bg-teal-500 border-teal-600',
      reiki: 'bg-violet-500 border-violet-600',
      consulta: 'bg-amber-500 border-amber-600',
      consultation: 'bg-amber-500 border-amber-600',
    };

    for (const [key, color] of Object.entries(colorMap)) {
      if (serviceName.includes(key)) {
        return color;
      }
    }

    // Cor padrão baseada no status
    if (status === 'ABERTO') return 'bg-blue-500 border-blue-600';
    if (status === 'INICIADO') return 'bg-yellow-500 border-yellow-600';
    if (status === 'EXECUCAO') return 'bg-orange-500 border-orange-600';

    return 'bg-blue-500 border-blue-600';
  };

  const toggleFilter = (filter: keyof typeof expandedFilters) => {
    setExpandedFilters((prev) => ({
      ...prev,
      [filter]: !prev[filter],
    }));
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

  // Atualizar evento local
  const updateEventMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      title: string;
      description?: string;
      location?: string;
      color?: string;
    }) => {
      return await apiRequest('PATCH', `/api/local-events/${data.id}`, {
        title: data.title,
        description: data.description,
        location: data.location,
        color: data.color,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/local-events'] });
      setIsEditingEvent(false);
      setSelectedTicket(null); // Fechar modal após salvar
      toast({
        title: 'Evento atualizado',
        description: 'O evento foi atualizado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar evento',
        description: error.message,
      });
    },
  });

  // Deletar evento local
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return await apiRequest('DELETE', `/api/local-events/${eventId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/local-events'] });
      setSelectedTicket(null);
      setShowDeleteConfirm(false);
      toast({
        title: 'Evento excluído',
        description: 'O evento foi removido com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir evento',
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
      const isBlockingEvent = (selectedTicket as any)?.isBlockingEvent;
      if (isBlockingEvent) {
        // Deletar evento local
        const blockingEvent = (selectedTicket as any).blockingEvent;
        if (blockingEvent?.id) {
          deleteEventMutation.mutate(blockingEvent.id);
        }
      } else {
        // Deletar ticket
        deleteMutation.mutate(selectedTicket.id);
      }
    }
  };

  const handleStartEdit = () => {
    if (selectedTicket && (selectedTicket as any)?.isBlockingEvent) {
      const blockingEvent = (selectedTicket as any).blockingEvent;
      setEditEventData({
        title: (selectedTicket as any).title || '',
        description: blockingEvent?.description || '',
        location: blockingEvent?.location || '',
        color: blockingEvent?.color || '#3b82f6',
      });
      setIsEditingEvent(true);
    }
  };

  const handleSaveEdit = () => {
    if (selectedTicket && (selectedTicket as any)?.isBlockingEvent) {
      const blockingEvent = (selectedTicket as any).blockingEvent;
      if (blockingEvent?.id && editEventData.title.trim()) {
        updateEventMutation.mutate({
          id: blockingEvent.id,
          ...editEventData,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Título obrigatório',
          description: 'Digite um título para o evento.',
        });
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditingEvent(false);
    setEditEventData({
      title: '',
      description: '',
      location: '',
      color: '#3b82f6',
    });
  };

  const selectedTicketDate = selectedTicket
    ? getTicketDate(selectedTicket)
    : null;
  const selectedTicketTime = selectedTicket
    ? getTicketTime(selectedTicket)
    : null;

  // Calcular altura de cada slot em pixels (ajustar conforme necessário)
  const slotHeight = useMemo(() => {
    return intervalMinutes === 10
      ? 8
      : intervalMinutes === 15
      ? 12
      : intervalMinutes === 30
      ? 24
      : 48;
  }, [intervalMinutes]);
  intervalMinutes === 10
    ? 8
    : intervalMinutes === 15
    ? 12
    : intervalMinutes === 30
    ? 24
    : 48; // Ajustar altura baseado no intervalo

  return (
    <>
      <div className='flex flex-col h-full w-full overflow-hidden'>
        {/* Área Principal - Layout Google Calendar */}
        <div className='flex-1 flex flex-col w-full min-w-0'>
          {/* Controles de Navegação e Ações - Mais compactos no mobile */}
          <div className='flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-4 pb-4 border-b'>
            <div className='flex items-center justify-between sm:justify-start gap-2 sm:gap-4 w-full xl:flex-1 xl:min-w-0'>
              <div className='flex items-center bg-muted/60 p-1 rounded-xl border border-border shrink-0'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 rounded-lg'
                  onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
                >
                  <ChevronLeft className='h-4 w-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-8 px-2 sm:px-3 rounded-lg text-[10px] sm:text-xs font-black'
                  onClick={() =>
                    setCurrentWeek(startOfWeek(new Date(), { locale: ptBR }))
                  }
                >
                  Hoje
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 rounded-lg'
                  onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
                >
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </div>
              <div className='text-[10px] sm:text-sm font-black text-foreground whitespace-nowrap bg-muted/60 px-3 py-1.5 rounded-lg'>
                <span className='hidden xs:inline'>
                  {format(weekDays[0], 'd', { locale: ptBR })} -{' '}
                  {format(weekDays[6], "d 'de' MMMM, yyyy", { locale: ptBR })}
                </span>
                <span className='xs:hidden'>
                  {format(weekDays[0], 'd/MM')} - {format(weekDays[6], 'd/MM')}
                </span>
              </div>
            </div>

            <div className='flex items-center gap-2 w-full xl:w-auto xl:ml-auto justify-end overflow-x-auto pb-1 xl:pb-0 scrollbar-hide'>
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
              {showCalendarControls && (
                <>
                  <div className='flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border flex-1 sm:flex-none justify-center'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-8 px-2 sm:px-3 rounded-lg text-[10px] font-black gap-1 sm:gap-1.5 flex-1 sm:flex-none'
                      onClick={() => onManageCalendar?.()}
                      disabled={!canManageCalendar}
                    >
                      <Settings className='h-3.5 w-3.5' />
                      <span className='hidden sm:inline'>Gerenciar</span>
                      <span className='sm:hidden'>Geren.</span>
                    </Button>
                    <Button
                      size='sm'
                      className='h-8 px-2 sm:px-3 bg-primary text-white rounded-lg text-[10px] font-black gap-1 sm:gap-1.5 shadow-sm flex-1 sm:flex-none'
                      onClick={() => onCreateCalendar?.()}
                      disabled={!onCreateCalendar}
                    >
                      <Plus className='h-3.5 w-3.5' />
                      <span className='hidden sm:inline'>Adicionar</span>
                      <span className='sm:hidden'>Add</span>
                    </Button>
                  </div>

                  <Select
                    value={selectedCalendarId || ''}
                    onValueChange={(value) => onSelectCalendar?.(value)}
                    disabled={isCalendarsLoading || googleCalendars.length === 0}
                  >
                    <SelectTrigger className='h-9 w-[160px] sm:w-[220px] rounded-xl border-border bg-card font-bold text-[10px] shrink-0'>
                      <SelectValue placeholder='Agenda Google' />
                    </SelectTrigger>
                    <SelectContent>
                      {googleCalendars.map((cal) => (
                        <SelectItem key={cal.id} value={cal.id} className='text-[10px] sm:text-xs'>
                          {cal.summary || 'Agenda'}{cal.primary ? ' (Principal)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              <Select
                value={intervalMinutes.toString()}
                onValueChange={(value) => setIntervalMinutes(Number(value))}
              >
                <SelectTrigger className='h-9 w-[100px] sm:w-[140px] rounded-xl border-border bg-card font-bold text-[10px] shrink-0'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='10' className='text-[10px] sm:text-xs'>10 min</SelectItem>
                  <SelectItem value='15' className='text-[10px] sm:text-xs'>15 min</SelectItem>
                  <SelectItem value='30' className='text-[10px] sm:text-xs'>30 min</SelectItem>
                  <SelectItem value='60' className='text-[10px] sm:text-xs'>60 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grade Semanal - Lista no mobile, grade no desktop */}
          {isMobile && (
            <div className='space-y-4'>
              {weekDays.map((day) => {
                const dayTickets = getTicketsForDay(day);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={day.toISOString()}
                    className='rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden'
                  >
                    <div
                      className={cn(
                        'flex items-center justify-between px-3 py-2 border-b border-border/60',
                        isToday && 'bg-primary/5'
                      )}
                    >
                      <div>
                        <div className='text-[11px] font-black uppercase tracking-wide'>
                          {format(day, 'EEEE', { locale: ptBR })}
                        </div>
                        <div className='text-[10px] text-muted-foreground'>
                          {format(day, "dd 'de' MMM", { locale: ptBR })}
                        </div>
                      </div>
                      {dayTickets.length > 0 && (
                        <Badge
                          variant='secondary'
                          className='text-[10px] font-black'
                        >
                          {dayTickets.length}
                        </Badge>
                      )}
                    </div>
                    <div className='p-3 space-y-2'>
                      {dayTickets.length > 0 ? (
                        dayTickets.map((ticket) => {
                          const isBlockingEvent = (ticket as any).isBlockingEvent;
                          const blockingEvent = (ticket as any).blockingEvent;
                          const ticketTitle =
                            ticket.service?.name ||
                            (ticket as any).title ||
                            ticket.finalClient ||
                            'Servico';
                          const ticketSubtitle = isBlockingEvent
                            ? ticket.description ||
                              blockingEvent?.description ||
                              (ticket as any).location ||
                              blockingEvent?.location ||
                              'Bloqueio de agenda'
                            : ticket.client?.name || ticket.finalClient || 'Cliente';
                          const location = isBlockingEvent
                            ? (ticket as any).location || blockingEvent?.location
                            : ticket.serviceAddress || ticket.address;
                          const statusClass =
                            statusColors[ticket.status] ||
                            'bg-muted/70 border-border text-muted-foreground';
                          const statusLabel =
                            statusLabels[ticket.status] || ticket.status;
                          const accentColor = isBlockingEvent
                            ? blockingEvent?.color || '#ef4444'
                            : undefined;

                          return (
                            <button
                              key={ticket.id}
                              type='button'
                              onClick={() => setSelectedTicket(ticket)}
                              className='w-full text-left rounded-xl border border-border/60 bg-muted/30 px-3 py-2 hover:bg-muted/40 transition-colors'
                            >
                              <div className='flex items-start gap-2'>
                                <span
                                  className={cn(
                                    'mt-1 h-2.5 w-2.5 rounded-full border',
                                    !isBlockingEvent && getTicketColor(ticket)
                                  )}
                                  style={
                                    isBlockingEvent && accentColor
                                      ? {
                                          backgroundColor: accentColor,
                                          borderColor: accentColor,
                                        }
                                      : undefined
                                  }
                                />
                                <div className='min-w-0 flex-1 space-y-1'>
                                  <div className='flex items-center gap-2'>
                                    {isBlockingEvent ? (
                                      <Badge
                                        variant='secondary'
                                        className='text-[9px] font-black uppercase'
                                      >
                                        Bloqueio
                                      </Badge>
                                    ) : (
                                      <Badge
                                        className={cn(
                                          'text-[9px] font-black',
                                          statusClass
                                        )}
                                      >
                                        {statusLabel}
                                      </Badge>
                                    )}
                                    <span className='text-xs font-bold truncate'>
                                      {ticketTitle}
                                    </span>
                                  </div>
                                  {ticketSubtitle && (
                                    <div className='text-[10px] text-muted-foreground truncate'>
                                      {ticketSubtitle}
                                    </div>
                                  )}
                                  <div className='flex items-center gap-2 text-[10px] text-muted-foreground'>
                                    <Clock className='h-3 w-3' />
                                    <span>{ticket.scheduledTime || '--:--'}</span>
                                    {location ? (
                                      <span className='flex items-center gap-1 min-w-0'>
                                        <MapPin className='h-3 w-3 shrink-0' />
                                        <span className='truncate'>
                                          {location}
                                        </span>
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className='py-3 text-center text-[11px] text-muted-foreground'>
                          Sem agendamentos
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!isMobile && (
          <div className='flex-1 border border-border rounded-2xl overflow-hidden bg-card shadow-sm flex flex-col min-h-0'>
            {/* Scroll Container para a grade */}
            <div className='flex-1 overflow-x-auto overflow-y-auto custom-scrollbar'>
              <div className='min-w-[800px] flex flex-col h-full'>
                {/* Cabeçalho dos dias */}
                <div className='grid grid-cols-8 border-b border-border/60 bg-card sticky top-0 z-20'>
                  <div className='p-1 sm:p-2 text-[9px] sm:text-[10px] font-black text-muted-foreground/70 border-r border-border/60 bg-muted/50'>
                    {/* Espaço vazio para alinhar com coluna de horários */}
                  </div>
                  {weekDays.map((day) => {
                    const isSelected = isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          'p-1 sm:p-2 text-center border-l border-border/60 cursor-pointer transition-colors',
                          isSelected && 'bg-primary/5 dark:bg-primary/10',
                          isToday && !isSelected && 'bg-muted/50'
                        )}
                      >
                        <div className='text-[8px] sm:text-[10px] font-black text-muted-foreground/70 mb-0.5 sm:mb-1 tracking-tighter sm:tracking-widest uppercase'>
                          {format(day, 'EEE', { locale: ptBR })}
                        </div>
                        <div
                          className={cn(
                            'text-sm sm:text-lg font-black w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-full mx-auto transition-transform active:scale-90',
                            isToday
                              ? 'bg-primary text-white shadow-lg shadow-primary/30'
                              : isSelected
                              ? 'text-primary'
                              : 'text-foreground'
                          )}
                        >
                          {format(day, 'd')}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Grade de horários - Estilo Google Calendar */}
                <div className='flex-1'>
                  <div className='relative'>
                    {timeSlots.map((slot, index) => {
                      const isNewHour = slot.minute === 0;
                      return (
                        <div
                          key={`${slot.hour}-${slot.minute}`}
                          className={cn(
                            'grid grid-cols-8 border-b border-border/50 transition-colors hover:bg-muted/30',
                            isNewHour && 'border-b border-border/60'
                          )}
                          style={{ minHeight: `${slotHeight}px` }}
                        >
                          {/* Coluna de horário */}
                          <div className='p-1 text-[10px] text-muted-foreground/70 border-r border-border/60 bg-card flex items-start justify-end pr-3 font-bold sticky left-0 z-10'>
                            {isNewHour && (
                              <span className='-mt-2 bg-card px-1'>
                                {slot.hour.toString().padStart(2, '0')}:00
                              </span>
                            )}
                          </div>

                          {/* Colunas dos dias */}
                          {weekDays.map((day) => {
                            const isSelected = isSameDay(day, selectedDate);
                            const isToday = isSameDay(day, new Date());
                            const slotTickets = getTicketsForSlot(
                              day,
                              slot.hour,
                              slot.minute
                            );

                            const startingTickets = slotTickets.filter((ticket) => {
                              const { hour: ticketHour, minute: ticketMinute } =
                                getTicketTime(ticket);
                              return (
                                ticketHour === slot.hour &&
                                ticketMinute === slot.minute
                              );
                            });

                            return (
                              <div
                                key={day.toISOString()}
                                className={cn(
                                  'p-0 border-l border-border/50 relative',
                                  isSelected && 'bg-primary/[0.02] dark:bg-primary/[0.05]',
                                  isToday &&
                                    !isSelected &&
                                    'bg-muted/20'
                                )}
                              >
                                {startingTickets.map((ticket) => {
                                  const duration = ticket.duration || 1;
                                  const durationMinutes = duration * 60;
                                  const heightInSlots = Math.max(
                                    durationMinutes / intervalMinutes,
                                    1
                                  );
                                  const isBlockingEvent = (ticket as any).isBlockingEvent;
                                  const blockingEvent = (ticket as any).blockingEvent;
                                  const ticketColor = getTicketColor(ticket);
                                  
                                  // Para eventos de bloqueio, usar cor customizada via estilo inline
                                  const backgroundColor = isBlockingEvent 
                                    ? (blockingEvent?.color || '#ef4444')
                                    : undefined;

                                  return (
                                    <div
                                      key={ticket.id}
                                      onClick={() => setSelectedTicket(ticket)}
                                      className={cn(
                                        'rounded-lg p-2 cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all text-white shadow-sm ring-1 ring-background/10 overflow-hidden',
                                        !isBlockingEvent && ticketColor,
                                        'mx-1 my-0.5'
                                      )}
                                      style={{
                                        height: `${Math.max(
                                          heightInSlots * slotHeight - 4,
                                          28
                                        )}px`,
                                        zIndex: 5,
                                        position: 'absolute',
                                        width: 'calc(100% - 8px)',
                                        ...(backgroundColor && {
                                          backgroundColor,
                                          borderColor: backgroundColor,
                                        }),
                                      }}
                                    >
                                      <div className='h-full flex flex-col justify-start'>
                                        <div className='text-[10px] font-black truncate uppercase tracking-tight'>
                                          {ticket.service?.name ||
                                            (ticket as any).title ||
                                            ticket.finalClient ||
                                            'Serviço'}
                                        </div>
                                        {heightInSlots * slotHeight > 45 && (
                                          <div className='text-[9px] font-bold opacity-90 truncate mt-0.5'>
                                            {isBlockingEvent
                                              ? (ticket as any).description || (ticket as any).title
                                              : ticket.client?.name || ticket.finalClient}
                                          </div>
                                        )}
                                        {heightInSlots * slotHeight > 60 && (
                                          <div className='flex items-center gap-1 mt-auto opacity-80 text-[8px] font-black uppercase'>
                                            <Clock className='h-2.5 w-2.5' />
                                            {ticket.scheduledTime}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Modal de detalhes */}
      <Dialog
        open={!!selectedTicket}
        onOpenChange={() => {
          setSelectedTicket(null);
          setIsEditingEvent(false);
          handleCancelEdit();
        }}
      >
        <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {selectedTicket && (selectedTicket as any)?.isBlockingEvent
                ? isEditingEvent
                  ? 'Editar Evento'
                  : 'Detalhes do Evento'
                : 'Detalhes do Chamado'}
            </DialogTitle>
            <DialogDescription>
              {selectedTicket && !isEditingEvent && (
                <Badge
                  className={
                    statusColors[selectedTicket.status] ||
                    'bg-muted/70 border-border text-muted-foreground'
                  }
                >
                  {statusLabels[selectedTicket.status] || selectedTicket.status}
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className='space-y-4'>
              {isEditingEvent && (selectedTicket as any)?.isBlockingEvent ? (
                // Formulário de edição
                <div className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='editTitle'>Título *</Label>
                    <Input
                      id='editTitle'
                      value={editEventData.title}
                      onChange={(e) =>
                        setEditEventData({
                          ...editEventData,
                          title: e.target.value,
                        })
                      }
                      placeholder='Ex: Consulta médica particular'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='editDescription'>Descrição</Label>
                    <Input
                      id='editDescription'
                      value={editEventData.description}
                      onChange={(e) =>
                        setEditEventData({
                          ...editEventData,
                          description: e.target.value,
                        })
                      }
                      placeholder='Descrição opcional do evento'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='editLocation'>Localização</Label>
                    <Input
                      id='editLocation'
                      value={editEventData.location}
                      onChange={(e) =>
                        setEditEventData({
                          ...editEventData,
                          location: e.target.value,
                        })
                      }
                      placeholder='Endereço ou local do evento'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='editColor'>Cor do Evento</Label>
                    <div className='flex items-center gap-2'>
                      <Input
                        id='editColor'
                        type='color'
                        value={editEventData.color}
                        onChange={(e) =>
                          setEditEventData({
                            ...editEventData,
                            color: e.target.value,
                          })
                        }
                        className='h-10 w-20'
                      />
                      <Input
                        value={editEventData.color}
                        onChange={(e) =>
                          setEditEventData({
                            ...editEventData,
                            color: e.target.value,
                          })
                        }
                        placeholder='#3b82f6'
                        className='flex-1'
                      />
                    </div>
                  </div>
                </div>
              ) : (
                // Visualização de detalhes
                <>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    {(selectedTicket as any)?.isBlockingEvent ? (
                      // Exibição para eventos locais (sem ticket)
                      <>
                        <div className='space-y-2'>
                          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                            <CalendarIcon className='h-4 w-4' />
                            <span className='font-medium'>Título</span>
                          </div>
                          <div className='text-base font-semibold'>
                            {(selectedTicket as any).title || 'Não informado'}
                          </div>
                        </div>

                        <div className='space-y-2'>
                          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                            <Clock className='h-4 w-4' />
                            <span className='font-medium'>Duração</span>
                          </div>
                          <div className='text-base'>
                            {selectedTicket.duration
                              ? `${selectedTicket.duration} hora${
                                  selectedTicket.duration > 1 ? 's' : ''
                                }`
                              : 'Não informado'}
                          </div>
                        </div>
                      </>
                    ) : (
                  // Exibição para tickets normais
                  <>
                    <div className='space-y-2'>
                      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <User className='h-4 w-4' />
                        <span className='font-medium'>Cliente</span>
                      </div>
                      <div className='text-base font-semibold'>
                        {selectedTicket.client?.name ||
                          selectedTicket.finalClient ||
                          'Não informado'}
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <Wrench className='h-4 w-4' />
                        <span className='font-medium'>Serviço</span>
                      </div>
                      <div className='text-base'>
                        {selectedTicket.service?.name ||
                          selectedTicket.ticketNumber ||
                          'Não informado'}
                      </div>
                    </div>
                  </>
                )}
                  </div>

                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <CalendarIcon className='h-4 w-4' />
                        <span className='font-medium'>Data</span>
                      </div>
                      <div className='text-base'>
                        {selectedTicketDate
                          ? format(
                              selectedTicketDate,
                              "EEEE, d 'de' MMMM 'de' yyyy",
                              {
                                locale: ptBR,
                              }
                            )
                          : 'Não informado'}
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <Clock className='h-4 w-4' />
                        <span className='font-medium'>Horário</span>
                      </div>
                      <div className='text-base'>
                        {selectedTicketTime
                          ? `${selectedTicketTime.hour
                              .toString()
                              .padStart(2, '0')}:${selectedTicketTime.minute
                              .toString()
                              .padStart(2, '0')}`
                          : selectedTicket.scheduledTime || 'Não informado'}
                      </div>
                    </div>

                    {((selectedTicket as any)?.isBlockingEvent
                      ? (selectedTicket as any).blockingEvent?.location
                      : selectedTicket.serviceAddress) && (
                      <div className='space-y-2 sm:col-span-2'>
                        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                          <MapPin className='h-4 w-4' />
                          <span className='font-medium'>Localização</span>
                        </div>
                        <div className='text-base'>
                          {(selectedTicket as any)?.isBlockingEvent
                            ? (selectedTicket as any).blockingEvent?.location
                            : selectedTicket.serviceAddress}
                        </div>
                      </div>
                    )}

                    {((selectedTicket as any)?.isBlockingEvent
                      ? (selectedTicket as any).blockingEvent?.description
                      : selectedTicket.description) && (
                      <div className='space-y-2 sm:col-span-2'>
                        <div className='text-sm font-medium text-muted-foreground'>
                          {(selectedTicket as any)?.isBlockingEvent
                            ? 'Descrição'
                            : 'Observações'}
                        </div>
                        <div className='text-base whitespace-pre-wrap'>
                          {(selectedTicket as any)?.isBlockingEvent
                            ? (selectedTicket as any).blockingEvent?.description
                            : selectedTicket.description}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className='flex-col sm:flex-row gap-2'>
            {isEditingEvent && (selectedTicket as any)?.isBlockingEvent ? (
              // Botões de edição
              <>
                <Button
                  variant='outline'
                  onClick={handleCancelEdit}
                  className='w-full sm:w-auto'
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={updateEventMutation.isPending}
                  className='w-full sm:w-auto'
                >
                  {updateEventMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </>
            ) : (
              // Botões de visualização
              <>
                {(selectedTicket as any)?.isBlockingEvent ? (
                  // Botões para eventos locais
                  <>
                    <Button
                      variant='outline'
                      onClick={handleStartEdit}
                      className='w-full sm:w-auto'
                    >
                      <Edit className='h-4 w-4 mr-2' />
                      Editar
                    </Button>
                    <Button
                      variant='destructive'
                      onClick={() => setShowDeleteConfirm(true)}
                      className='w-full sm:w-auto'
                    >
                      <X className='h-4 w-4 mr-2' />
                      Excluir
                    </Button>
                  </>
                ) : (
                  // Botões para tickets normais
                  <>
                    <Button
                      variant='outline'
                      onClick={() => {
                        toast({
                          title: 'Em desenvolvimento',
                          description: 'Edição em breve',
                        });
                      }}
                      className='w-full sm:w-auto'
                    >
                      <Edit className='h-4 w-4 mr-2' />
                      Editar
                    </Button>
                    {selectedTicket &&
                      selectedTicket.status !== 'CANCELADO' &&
                      selectedTicket.status !== 'CANCELLED' && (
                        <Button
                          variant='outline'
                          onClick={() => setShowCancelConfirm(true)}
                          className='w-full sm:w-auto'
                        >
                          <X className='h-4 w-4 mr-2' />
                          Cancelar Chamado
                        </Button>
                      )}
                    <Button
                      variant='destructive'
                      onClick={() => setShowDeleteConfirm(true)}
                      className='w-full sm:w-auto'
                    >
                      <X className='h-4 w-4 mr-2' />
                      Excluir
                    </Button>
                  </>
                )}
              </>
            )}
          </DialogFooter>
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
            <AlertDialogTitle>
              {selectedTicket && (selectedTicket as any)?.isBlockingEvent
                ? 'Excluir Evento'
                : 'Excluir Chamado'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedTicket && (selectedTicket as any)?.isBlockingEvent
                ? 'Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.'
                : 'Tem certeza que deseja excluir este chamado? Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={
                deleteMutation.isPending || deleteEventMutation.isPending
              }
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteMutation.isPending || deleteEventMutation.isPending
                ? 'Excluindo...'
                : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
