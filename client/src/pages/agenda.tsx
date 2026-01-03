import { useState, useEffect, useMemo, useRef } from 'react';
import { WeeklyAgendaView } from '@/components/weekly-agenda-view';
import { MonthlyAgendaView } from '@/components/monthly-agenda-view';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import {
  Plus,
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getTimeSlotsForDate, type WorkingHoursConfig } from '@/lib/working-hours';
import {
  resolveGoogleCalendarActive,
  resolveGoogleCalendarConnected,
  resolveGoogleCalendarEnabled,
} from '@/lib/google-calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePaidAccess } from '@/hooks/use-paid-access';
import { useAuth } from '@/hooks/use-auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { motion, AnimatePresence } from 'framer-motion';
import type { Ticket, Client, Service } from '@shared/schema';

type TicketWithRelations = Ticket & {
  client?: Client;
  service?: Service;
};

interface GoogleCalendar {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
}

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

type IntegrationSettingsResponse = {
  googleCalendarStatus: string;
  googleCalendarEmail?: string;
  googleCalendarEnabled?: boolean;
  googleCalendarId?: string;
  workingDays?: number[];
  workingHours?: WorkingHoursConfig | string[];
};

export default function Agenda() {
  const { toast } = useToast();
  const { requirePaid, isPaid } = usePaidAccess();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [showCancelCreateConfirm, setShowCancelCreateConfirm] = useState(false);
  const [isCreateEventDialogOpen, setIsCreateEventDialogOpen] = useState(false);
  const [newEventData, setNewEventData] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    location: '',
    color: '#3b82f6',
    allDay: false,
  });
  const [eventViewMode, setEventViewMode] = useState<'start' | 'end'>('start');
  const [selectedStartDate, setSelectedStartDate] = useState<Date | undefined>();
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>();
  const [selectedDateRange, setSelectedDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const monthLabel = useMemo(
    () => format(currentViewDate, 'MMMM yyyy', { locale: ptBR }),
    [currentViewDate]
  );
  const weekdayLabel = useMemo(() => {
    const label = format(now, 'EEEE', { locale: ptBR });
    return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : label;
  }, [now]);
  const dateLabel = useMemo(
    () => format(now, "d 'de' MMMM 'de' yyyy", { locale: ptBR }),
    [now]
  );
  const timeLabel = useMemo(() => format(now, 'HH:mm', { locale: ptBR }), [now]);
  const cityLabel = useMemo(() => {
    const city = user?.city?.trim();
    const state = user?.state?.trim();
    if (city && state) return `${city} - ${state}`;
    if (city) return city;
    if (state) return state;
    return 'Cidade nao informada';
  }, [user?.city, user?.state]);

  // Scroll para o topo quando o modal abrir
  useEffect(() => {
    if (isCreateEventDialogOpen) {
      setTimeout(() => {
        const dialogContent = document.querySelector('[role="dialog"]');
        if (dialogContent) {
          dialogContent.scrollTop = 0;
        }
      }, 100);
    }
  }, [isCreateEventDialogOpen]);

  // Fetch tickets
  const { data: tickets, isLoading: isLoadingTickets } = useQuery<
    TicketWithRelations[]
  >({
    queryKey: ['/api/tickets'],
  });

  // Fetch local events (eventos de bloqueio da agenda)
  const { data: localEvents } = useQuery<any[]>({
    queryKey: ['/api/local-events'],
  });

  // Fetch clients for filters
  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  // Fetch Google Calendar connection status
  const { data: calendarStatus } = useQuery<{
    connected: boolean;
    email?: string;
    status: string;
  }>({
    queryKey: ['/api/calendar/status'],
    enabled: isPaid,
  });

  // Fetch integration settings to check Google Calendar status
  const { data: integrationSettings } = useQuery<IntegrationSettingsResponse>({
    queryKey: ['/api/integration-settings'],
  });

  const googleCalendarEnabled = resolveGoogleCalendarEnabled(
    integrationSettings
  );
  const isGoogleCalendarConnected = resolveGoogleCalendarConnected(
    integrationSettings,
    calendarStatus
  );
  const isGoogleCalendarActive = resolveGoogleCalendarActive(
    integrationSettings,
    calendarStatus
  );

  useEffect(() => {
    const root = document.documentElement;
    const activeClass = isGoogleCalendarActive
      ? 'agenda-theme-google'
      : 'agenda-theme-local';
    root.classList.add(activeClass);
    root.classList.remove(
      isGoogleCalendarActive ? 'agenda-theme-local' : 'agenda-theme-google'
    );
    return () => {
      root.classList.remove('agenda-theme-google');
      root.classList.remove('agenda-theme-local');
    };
  }, [isGoogleCalendarActive]);

  const workingDays = useMemo(() => {
    const defaultWorkingDays = [1, 2, 3, 4, 5, 6];
    const raw = integrationSettings?.workingDays;
    if (!Array.isArray(raw) || raw.length === 0) {
      return defaultWorkingDays;
    }
    const sanitized = raw
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    return sanitized.length > 0 ? sanitized : defaultWorkingDays;
  }, [integrationSettings]);

  const workingDaysSet = useMemo(() => new Set(workingDays), [workingDays]);

  const toggleGoogleCalendarSyncMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return await apiRequest('PATCH', '/api/integration-settings', {
        googleCalendarEnabled: enabled,
      });
    },
    onMutate: async (enabled: boolean) => {
      await queryClient.cancelQueries({
        queryKey: ['/api/integration-settings'],
      });
      const previousSettings = queryClient.getQueryData([
        '/api/integration-settings',
      ]);
      queryClient.setQueryData(
        ['/api/integration-settings'],
        (current: any) => ({
          ...(current || {}),
          googleCalendarEnabled: enabled,
        })
      );
      if (!enabled) {
        queryClient.removeQueries({
          queryKey: ['/api/google-calendar/events'],
          exact: false,
        });
      }
      return { previousSettings };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/integration-settings'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/google-calendar/events'],
        exact: false,
      });
      toast({
        title: 'Sincronizacao atualizada',
        description: 'A configuracao do Google Calendar foi salva.',
      });
    },
    onError: (error: any, _enabled, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(
          ['/api/integration-settings'],
          context.previousSettings
        );
      }
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: error.message,
      });
    },
  });

  const updateCalendarSelectionMutation = useMutation({
    mutationFn: async (calendarId: string) => {
      return await apiRequest('PATCH', '/api/integration-settings', {
        googleCalendarId: calendarId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/integration-settings'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/google-calendar/events'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/tickets/available-slots'],
      });
    },
  });

  const handleCalendarSelection = async (calendarId: string) => {
    if (
      !requirePaid({
        feature: 'Google Calendar',
        description: 'Integracao com Google Calendar esta disponivel apenas na versao paga.',
      })
    ) {
      return false;
    }
    if (!calendarId || calendarId === selectedCalendarId) return false;
    const previousId = selectedCalendarId;
    setSelectedCalendarId(calendarId);
    try {
      await updateCalendarSelectionMutation.mutateAsync(calendarId);
      return true;
    } catch (error: any) {
      setSelectedCalendarId(previousId);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar agenda',
        description: error.message,
      });
      return false;
    }
  };

  const handleManageCalendarSelection = async (calendarId: string) => {
    const updated = await handleCalendarSelection(calendarId);
    if (updated) {
      setIsManageDialogOpen(false);
    }
  };

  const startGoogleCalendarConnection = async () => {
    if (
      !requirePaid({
        feature: 'Google Calendar',
        description: 'Integracao com Google Calendar esta disponivel apenas na versao paga.',
      })
    ) {
      return;
    }
    try {
      const response = await apiRequest(
        'GET',
        '/api/google-calendar/auth',
        undefined
      );
      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
          return;
        }
      }
      toast({
        variant: 'destructive',
        title: 'Erro ao conectar',
        description:
          'Não foi possível iniciar a conexão com o Google Calendar.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao conectar',
        description:
          error.message ||
          'Não foi possível conectar ao Google Calendar.',
      });
    }
  };

  const handleGoogleCalendarToggle = async (checked: boolean) => {
    if (
      checked &&
      !requirePaid({
        feature: 'Google Calendar',
        description: 'Integracao com Google Calendar esta disponivel apenas na versao paga.',
      })
    ) {
      return;
    }
    if (!checked) {
      toggleGoogleCalendarSyncMutation.mutate(false);
      return;
    }

    if (!googleCalendarEnabled) {
      try {
        await toggleGoogleCalendarSyncMutation.mutateAsync(true);
      } catch {
        return;
      }
    }

    if (!isGoogleCalendarConnected) {
      await startGoogleCalendarConnection();
    }
  };

  // Fetch Google Calendars
  const { data: googleCalendars, isLoading: isLoadingCalendars } = useQuery<
    GoogleCalendar[]
  >({
    queryKey: ['/api/google-calendar/calendars'],
    enabled: isPaid && isGoogleCalendarConnected && googleCalendarEnabled,
  });

  // Fetch Google Calendar events
  const { data: googleEvents } = useQuery<GoogleEvent[]>({
    queryKey: ['/api/google-calendar/events', selectedCalendarId],
    queryFn: async () => {
      if (!selectedCalendarId) return [];

      const now = new Date();
      const timeMin = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      ).toISOString();
      const timeMax = new Date(
        now.getFullYear(),
        now.getMonth() + 2,
        0
      ).toISOString();

      const response = await fetch(
        `/api/google-calendar/events?timeMin=${timeMin}&timeMax=${timeMax}`,
        { credentials: 'include' }
      );

      if (!response.ok) return [];
      return response.json();
    },
    enabled:
      isPaid &&
      isGoogleCalendarConnected &&
      !!selectedCalendarId &&
      googleCalendarEnabled,
  });

  // Auto-select primary calendar when calendars load
  useEffect(() => {
    if (!googleCalendars || googleCalendars.length === 0) {
      return;
    }
    if (selectedCalendarId) {
      return;
    }

    const preferredId = integrationSettings?.googleCalendarId;
    const preferred = preferredId
      ? googleCalendars.find((cal) => cal.id === preferredId)
      : undefined;
    if (preferred) {
      setSelectedCalendarId(preferred.id);
      return;
    }

    const primary = googleCalendars.find((cal) => cal.primary);
    if (primary) {
      setSelectedCalendarId(primary.id);
    } else {
      setSelectedCalendarId(googleCalendars[0].id);
    }
  }, [googleCalendars, integrationSettings?.googleCalendarId, selectedCalendarId]);

  // Create calendar mutation
  const createCalendarMutation = useMutation({
    mutationFn: async (data: { summary: string }) => {
      return await apiRequest('POST', '/api/google-calendar/calendars', data);
    },
    onSuccess: async (response) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/google-calendar/calendars'],
      });
      let createdCalendar: GoogleCalendar | null = null;
      try {
        createdCalendar = await response.json();
      } catch {
        createdCalendar = null;
      }
      setIsCreateDialogOpen(false);
      setNewCalendarName('');
      if (createdCalendar?.id) {
        await handleCalendarSelection(createdCalendar.id);
      }
      toast({
        title: 'Agenda criada',
        description: 'A nova agenda foi criada com sucesso no Google Calendar.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar agenda',
        description: error.message,
      });
    },
  });

  // Delete calendar mutation
  const deleteCalendarMutation = useMutation({
    mutationFn: async (calendarId: string) => {
      return await apiRequest(
        'DELETE',
        `/api/google-calendar/calendars/${calendarId}`,
        undefined
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/google-calendar/calendars'],
      });
      setIsDeleteDialogOpen(false);
      const fallbackCalendarId =
        googleCalendars?.find((cal) => cal.primary)?.id || '';
      if (fallbackCalendarId) {
        void handleCalendarSelection(fallbackCalendarId);
      } else {
        setSelectedCalendarId('');
      }
      toast({
        title: 'Agenda excluída',
        description: 'A agenda foi removida do Google Calendar.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir agenda',
        description: error.message,
      });
    },
  });

  const handleCreateCalendar = async () => {
    if (!newCalendarName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Digite um nome para a nova agenda.',
      });
      return;
    }
    await createCalendarMutation.mutateAsync({ summary: newCalendarName });
  };

  const handleDeleteCalendar = async () => {
    if (!selectedCalendarId) return;
    await deleteCalendarMutation.mutateAsync(selectedCalendarId);
  };

  // Create blocking event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      startDate: string;
      endDate: string;
      location?: string;
      color?: string;
      allDay?: boolean;
    }) => {
      return await apiRequest('POST', '/api/local-events', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/local-events'] });
      setIsCreateEventDialogOpen(false);
      setNewEventData({
        title: '',
        description: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        location: '',
        color: '#3b82f6',
        allDay: false,
      });
      setEventViewMode('start');
      setSelectedStartDate(undefined);
      setSelectedEndDate(undefined);
      setSelectedDateRange({ from: undefined, to: undefined });
      toast({
        title: 'Evento criado',
        description: 'O evento foi criado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar evento',
        description: error.message,
      });
    },
  });

  const handleCreateEvent = async () => {
    if (!newEventData.title.trim()) {
      toast({
        variant: 'destructive',
        title: 'Título obrigatório',
        description: 'Digite um título para o evento.',
      });
      return;
    }

    if (!newEventData.startDate) {
      toast({
        variant: 'destructive',
        title: 'Data obrigatória',
        description: 'Selecione a data de início do evento.',
      });
      return;
    }

    if (!newEventData.endDate) {
      toast({
        variant: 'destructive',
        title: 'Data obrigatória',
        description: 'Selecione a data de término do evento.',
      });
      return;
    }

    let startDateTime: Date;
    let endDateTime: Date;

    if (newEventData.allDay) {
      // Dia todo: 00:00 até 23:59
      startDateTime = new Date(newEventData.startDate);
      startDateTime.setHours(0, 0, 0, 0);
      endDateTime = new Date(newEventData.endDate);
      endDateTime.setHours(23, 59, 59, 999);
    } else {
      if (!newEventData.startTime) {
        toast({
          variant: 'destructive',
          title: 'Hora obrigatória',
          description: 'Selecione a hora de início do evento.',
        });
        return;
      }

      if (!newEventData.endTime) {
        toast({
          variant: 'destructive',
          title: 'Hora obrigatória',
          description: 'Selecione a hora de término do evento.',
        });
        return;
      }

      startDateTime = new Date(
        `${newEventData.startDate}T${newEventData.startTime}`
      );
      endDateTime = new Date(
        `${newEventData.endDate}T${newEventData.endTime}`
      );
    }

    if (endDateTime <= startDateTime) {
      toast({
        variant: 'destructive',
        title: 'Data inválida',
        description: 'A data de término deve ser posterior à data de início.',
      });
      return;
    }

    // Verificar conflitos com eventos do Google Calendar (se estiver conectado)
    if (isGoogleCalendarConnected && googleEvents && googleCalendarEnabled) {
      const hasConflict = googleEvents
        .filter((event) => event.calendarId === selectedCalendarId)
        .some((event) => {
          // Parsear data/hora do evento do Google Calendar
          let eventStart: Date;
          let eventEnd: Date;

          if (event.allDay || (!event.start.includes('T') && !event.end.includes('T'))) {
            // Evento de dia inteiro - parsear formato YYYY-MM-DD
            const [startYear, startMonth, startDay] = event.start.split('-').map(Number);
            const [endYear, endMonth, endDay] = event.end.split('-').map(Number);
            eventStart = new Date(startYear, startMonth - 1, startDay, 0, 0, 0);
            eventEnd = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
          } else {
            // Evento com horário específico - o JavaScript já converte ISO para timezone local
            eventStart = new Date(event.start);
            eventEnd = new Date(event.end);
          }

          // Verificar se há sobreposição: startDateTime < eventEnd && endDateTime > eventStart
          const conflicts = startDateTime < eventEnd && endDateTime > eventStart;

          return conflicts;
        });

      if (hasConflict) {
        toast({
          variant: 'destructive',
          title: 'Conflito com evento existente',
          description: 'Este horário conflita com um evento do Google Calendar. Por favor, escolha outro horário.',
        });
        return;
      }
    }

    await createEventMutation.mutateAsync({
      title: newEventData.title,
      description: newEventData.description || undefined,
      startDate: startDateTime.toISOString(),
      endDate: endDateTime.toISOString(),
      location: newEventData.location || undefined,
      color: newEventData.color,
      allDay: newEventData.allDay,
    });
  };

  // Gerar horários disponíveis
  const timeSlots = useMemo(() => {
    const baseDate =
      selectedStartDate ||
      (newEventData.startDate
        ? new Date(`${newEventData.startDate}T00:00:00`)
        : undefined);
    return getTimeSlotsForDate(
      baseDate,
      integrationSettings?.workingHours,
      integrationSettings?.workingDays
    );
  }, [selectedStartDate, newEventData.startDate, integrationSettings]);
  const selectedStartDateLabel = useMemo(() => {
    const baseDate =
      selectedStartDate ||
      (newEventData.startDate
        ? new Date(`${newEventData.startDate}T00:00:00`)
        : undefined);
    if (!baseDate || Number.isNaN(baseDate.getTime())) return '';
    const datePart = format(baseDate, 'dd/MM/yyyy', { locale: ptBR });
    const dayPart = format(baseDate, 'EEEE', { locale: ptBR })
      .replace(/-/g, ' ')
      .split(' ')
      .map((word) =>
        word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : ''
      )
      .join(' ');
    return `${datePart} ${dayPart}`;
  }, [selectedStartDate, newEventData.startDate]);

  // Função auxiliar para converter hora em minutos
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Função para verificar se um horário está indisponível devido a eventos do Google Calendar
  const isTimeSlotUnavailable = (date: Date | undefined, time: string): boolean => {
    // Se não há data selecionada ou Google Calendar não está conectado, horário está disponível
    if (!date || !isGoogleCalendarConnected || !googleEvents || !googleCalendarEnabled) {
      return false;
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const [hours, minutes] = time.split(':').map(Number);
    // Criar horário no timezone local (Brasil) - usando apenas a data local e horário local
    const slotTime = new Date(date);
    slotTime.setHours(hours, minutes, 0, 0);
    // Criar um slot de 30 minutos para verificar conflitos
    const slotEnd = new Date(slotTime);
    slotEnd.setMinutes(slotEnd.getMinutes() + 30);

    return googleEvents
      .filter((event) => event.calendarId === selectedCalendarId)
      .some((event) => {
        if (event.allDay || (!event.start.includes('T') && !event.end.includes('T'))) {
          // Evento de dia inteiro - torna todos os horários do dia indisponíveis
          // Parsear data de dia inteiro (formato YYYY-MM-DD)
          const [year, month, day] = event.start.split('-').map(Number);
          const eventDate = new Date(year, month - 1, day);
          const eventDateStr = format(eventDate, 'yyyy-MM-dd');
          return eventDateStr === dateStr;
        } else {
          // Evento com horário específico
          // O Google Calendar retorna em formato ISO (ex: "2024-12-29T12:00:00Z" ou "2024-12-29T09:00:00-03:00")
          // Quando fazemos new Date() com uma string ISO, o JavaScript converte para o timezone local do navegador
          // Isso já está correto, pois o navegador já está no timezone do Brasil
          const eventStart = new Date(event.start);
          const eventEnd = new Date(event.end);
          
          // Verificar se o evento está no mesmo dia (usando a data local)
          const eventStartDateStr = format(eventStart, 'yyyy-MM-dd');
          if (eventStartDateStr !== dateStr) {
            return false;
          }
          
          // Extrair apenas hora e minuto do evento no timezone local para comparação
          const eventStartHours = eventStart.getHours();
          const eventStartMinutes = eventStart.getMinutes();
          const eventEndHours = eventEnd.getHours();
          const eventEndMinutes = eventEnd.getMinutes();
          
          // Converter horas para minutos para facilitar comparação
          const eventStartTotalMinutes = eventStartHours * 60 + eventStartMinutes;
          const eventEndTotalMinutes = eventEndHours * 60 + eventEndMinutes;
          const slotTotalMinutes = hours * 60 + minutes;
          
          // Um horário está indisponível se está dentro do intervalo do evento
          // Incluindo o horário de início e até o horário de fim (inclusivo no fim também)
          // Se evento é 09:00-14:00, então 09:00, 09:30, 10:00... até 14:00 devem estar indisponíveis
          return slotTotalMinutes >= eventStartTotalMinutes && slotTotalMinutes <= eventEndTotalMinutes;
        }
      });
  };

  const handleDateSelect = (
    date: Date | undefined,
    range?: { from: Date | undefined; to: Date | undefined }
  ) => {
    if (newEventData.allDay && range) {
      // Lógica para dia todo: usar range do calendário
      if (range.from) {
        const startDateStr = format(range.from, 'yyyy-MM-dd');
        const endDateStr = range.to
          ? format(range.to, 'yyyy-MM-dd')
          : startDateStr;

        setSelectedDateRange(range);
        setSelectedStartDate(range.from);
        setSelectedEndDate(range.to || range.from);
        setNewEventData({
          ...newEventData,
          startDate: startDateStr,
          endDate: endDateStr,
        });
      } else {
        // Range foi limpo
        setSelectedDateRange({ from: undefined, to: undefined });
        setSelectedStartDate(undefined);
        setSelectedEndDate(undefined);
        setNewEventData({
          ...newEventData,
          startDate: '',
          endDate: '',
        });
      }
    } else if (date) {
      // Lógica normal: selecionar data e depois horários
      const dateStr = format(date, 'yyyy-MM-dd');
      setSelectedStartDate(date);
      setNewEventData({
        ...newEventData,
        startDate: dateStr,
        endDate: dateStr, // Por padrão, mesma data
        startTime: '', // Resetar horários ao mudar data
        endTime: '',
      });
      setSelectedEndDate(date);
    }
  };

  const handleTimeSelect = (time: string) => {
    // Se não tem horário de início, seleciona como início
    if (!newEventData.startTime) {
      setNewEventData({ ...newEventData, startTime: time, endTime: '' });
    }
    // Se já tem início mas não tem fim, seleciona como fim
    else if (!newEventData.endTime) {
      // Validar se o horário de fim é posterior ao de início
      const startTimeMinutes = timeToMinutes(newEventData.startTime);
      const endTimeMinutes = timeToMinutes(time);
      
      if (endTimeMinutes <= startTimeMinutes) {
        // Se o horário selecionado é anterior ou igual ao início, substitui o início
        setNewEventData({ ...newEventData, startTime: time, endTime: '' });
      } else {
        setNewEventData({ ...newEventData, endTime: time });
      }
    }
    // Se já tem ambos, substitui o fim
    else {
      const startTimeMinutes = timeToMinutes(newEventData.startTime);
      const endTimeMinutes = timeToMinutes(time);
      
      if (endTimeMinutes <= startTimeMinutes) {
        // Se o horário selecionado é anterior ou igual ao início, substitui o início
        setNewEventData({ ...newEventData, startTime: time, endTime: '' });
      } else {
        setNewEventData({ ...newEventData, endTime: time });
      }
    }
  };

  const handleAllDayToggle = (checked: boolean) => {
    setNewEventData({
      ...newEventData,
      allDay: checked,
      startTime: '', // Sempre limpar horários ao mudar o toggle
      endTime: '',
      // Se desativar dia todo, manter as datas
      // Se ativar dia todo, manter as datas mas limpar horários
    });
    // Resetar range quando desativar dia todo
    if (!checked) {
      setSelectedDateRange({ from: undefined, to: undefined });
    } else if (newEventData.startDate) {
      // Se ativar dia todo e já tem data, configurar o range
      const startDate = new Date(newEventData.startDate);
      const endDate = newEventData.endDate
        ? new Date(newEventData.endDate)
        : startDate;
      setSelectedDateRange({ from: startDate, to: endDate });
      setSelectedStartDate(startDate);
      setSelectedEndDate(endDate);
    }
  };

  // Função auxiliar para identificar dias indisponíveis por eventos de dia inteiro do Google Calendar
  // Eventos de dia inteiro tornam o dia inteiro indisponível para novos eventos
  const unavailableDaysSet = useMemo(() => {
    if (!isGoogleCalendarConnected || !googleEvents || !googleCalendarEnabled) {
      return new Set<string>();
    }

    const unavailable = new Set<string>();

    googleEvents
      .filter((event) => event.calendarId === selectedCalendarId)
      .forEach((event) => {
        // Se o evento é de dia inteiro (allDay === true ou formato sem 'T')
        if (event.allDay || (!event.start.includes('T') && !event.end.includes('T'))) {
          const startDate = new Date(event.start);
          const endDate = new Date(event.end);
          
          // Iterar por todos os dias do evento (endDate é exclusivo no Google Calendar)
          const currentDate = new Date(startDate);
          currentDate.setHours(0, 0, 0, 0);
          
          while (currentDate < endDate) {
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            unavailable.add(dateStr);
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      });

    return unavailable;
  }, [googleEvents, selectedCalendarId, isGoogleCalendarConnected, integrationSettings]);

  // Merge local tickets with Google events and local blocking events
  const allEvents = useMemo(() => {
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

    const ticketEvents =
      tickets?.map((ticket) => ({
        ...ticket,
        date: new Date(ticket.scheduledDate),
        isGoogleEvent: false,
        isBlockingEvent: false,
      })) || [];

    const googleEventTickets =
      (googleEvents && googleCalendarEnabled)
        ? googleEvents
            .filter((event) => event.calendarId === selectedCalendarId)
            .map((event) => ({
              id: event.id,
              title: event.summary,
              scheduledDate: event.start,
              scheduledTime: event.start.split('T')[1]?.substring(0, 5) || '00:00',
              date: parseGoogleDate(event.start),
              description: event.description,
              location: event.location,
              isGoogleEvent: true,
              isBlockingEvent: false,
              backgroundColor: event.backgroundColor,
              status: 'ABERTO' as const,
              duration: 1,
            }))
        : [];

    // Converter eventos locais (sem ticketId) para o formato esperado
    const blockingEvents =
      localEvents
        ?.filter((event) => !event.ticketId) // Apenas eventos sem ticket vinculado
        .map((event) => {
          const startDate = new Date(event.startDate);
          const endDate = new Date(event.endDate);
          const durationHours =
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
          
          return {
            id: event.id,
            title: event.title,
            scheduledDate: startDate.toISOString(),
            scheduledTime: startDate.toTimeString().slice(0, 5),
            date: startDate,
            description: event.description,
            location: event.location,
            isGoogleEvent: false,
            isBlockingEvent: true, // Flag interna para lógica, não exibida
            backgroundColor: event.color || '#3b82f6',
            status: 'ABERTO' as const, // Tratar como evento normal
            duration: Math.max(durationHours, 0.5), // Mínimo 30 minutos
            blockingEvent: event, // Manter referência ao evento original
          };
        }) || [];

    return [...ticketEvents, ...googleEventTickets, ...blockingEvents];
  }, [tickets, googleEvents, selectedCalendarId, localEvents]);

  const filteredGoogleEvents = useMemo(() => {
    if (!googleEvents || !selectedCalendarId) {
      return [];
    }
    return googleEvents.filter(
      (event) => event.calendarId === selectedCalendarId
    );
  }, [googleEvents, selectedCalendarId]);

  // Handle Google Calendar sync
  const handleSyncGoogleCalendar = async () => {
    if (!isConnected) {
      toast({
        variant: 'destructive',
        title: 'Google Calendar não conectado',
        description: 'Conecte sua conta do Google Calendar nas configurações.',
      });
      return;
    }

    toast({
      title: 'Sincronizando...',
      description: 'Sincronizando chamados com Google Calendar.',
    });

    // Invalidar queries para forçar atualização
    queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
    queryClient.invalidateQueries({
      queryKey: ['/api/google-calendar/events'],
    });

    toast({
      title: 'Sincronização concluída',
      description: 'Os chamados foram sincronizados com sucesso.',
    });
  };

  const isConnected = isGoogleCalendarConnected;
  const isLoading = isLoadingTickets || (isConnected && isLoadingCalendars);
  const headerContent = (
    <div className='px-2 sm:px-4 md:px-6'>
      <div className='flex flex-col xl:flex-row xl:items-center justify-between gap-4'>
        <div className='flex flex-col gap-2 min-w-0'>
          <h1 className='text-foreground text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 min-w-0'>
            <CalendarIcon className='h-5 w-5 sm:h-6 sm:w-6 text-primary' />
            <span className='truncate'>Agenda</span>
          </h1>
          <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400'>
            <span className='font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[180px] sm:max-w-none'>
              {cityLabel}
            </span>
            <span className='text-slate-300 dark:text-slate-600'>|</span>
            <span className='capitalize'>{weekdayLabel}</span>
            <span className='text-slate-300 dark:text-slate-600'>|</span>
            <span>{dateLabel}</span>
            <span className='text-slate-300 dark:text-slate-600'>|</span>
            <span className='font-semibold text-slate-700 dark:text-slate-200'>
              {timeLabel}
            </span>
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          {/* Acoes Rapidas */}
          <div
            className='flex items-center gap-2 rounded-xl border border-border bg-card/90 px-2 py-1'
            data-testid='badge-google-connected'
            title={`Agenda Google ${isGoogleCalendarActive ? 'conectado' : 'desconectado'}`}
          >
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                isGoogleCalendarActive ? 'bg-emerald-500' : 'bg-amber-500'
              )}
            />
            <span className='text-[10px] sm:text-xs font-bold'>Google</span>
            <span
              className={cn(
                'text-[9px] sm:text-[10px] font-semibold uppercase',
                isGoogleCalendarActive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              )}
            >
              {isGoogleCalendarActive
                ? 'Agenda Google Conectado'
                : 'Agenda Google Desconectado'}
            </span>
            <Label htmlFor='agenda-sync-toggle' className='sr-only'>
              Sincronizacao ativa
            </Label>
            <Switch
              id='agenda-sync-toggle'
              checked={isGoogleCalendarActive}
              onCheckedChange={handleGoogleCalendarToggle}
              disabled={toggleGoogleCalendarSyncMutation.isPending}
              className='scale-75'
            />
          </div>

          <Button
            data-testid='button-new-appointment'
            onClick={() => setIsCreateEventDialogOpen(true)}
            className='h-9 sm:h-10 px-3 sm:px-4 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] gap-1.5 sm:gap-2 ml-auto sm:ml-0'
          >
            <Plus className='h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[3px]' />
            <span className='text-[10px] sm:text-xs uppercase'>Agendar</span>
          </Button>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <PageHeader>{headerContent}</PageHeader>
        <div className='text-center py-12 text-muted-foreground'>
          Carregando agendamentos...
        </div>
      </div>
    );
  }

  const selectedCalendar = googleCalendars?.find(
    (cal) => cal.id === selectedCalendarId
  );
  const canDeleteSelectedCalendar =
    !!selectedCalendar && !selectedCalendar.primary;

  return (
    <div className='space-y-4 px-2 sm:px-4 md:px-6 w-full max-w-[100vw] overflow-hidden'>
      {/* Barra Superior Moderna e Responsiva */}
      <PageHeader>{headerContent}</PageHeader>

      {/* Botão para conectar ao Google Calendar - só aparece se não estiver conectado */}
      {!isGoogleCalendarConnected && (
        <div className='flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4'>
          <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'>
            <CalendarIcon className='h-5 w-5' />
          </div>
          <div className='flex-1'>
            <p className='text-sm font-medium text-amber-900 dark:text-amber-100'>
              Conecte ao Google Calendar
            </p>
            <p className='text-xs text-amber-700 dark:text-amber-300 mt-0.5'>
              Sincronize seus chamados automaticamente com o Google Calendar
              para melhor organização.
            </p>
          </div>
          <Button
            variant='default'
            size='sm'
            onClick={startGoogleCalendarConnection}
            className='whitespace-nowrap'
          >
            <CalendarIcon className='h-4 w-4 mr-2' />
            Conectar
          </Button>
        </div>
      )}

      <div className='w-full pb-4'>
        {viewMode === 'weekly' ? (
          <WeeklyAgendaView
            tickets={allEvents as any}
            clients={clients || []}
            onSyncGoogleCalendar={handleSyncGoogleCalendar}
            isGoogleCalendarConnected={isConnected}
            isGoogleCalendarEnabled={googleCalendarEnabled}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onCurrentDateChange={setCurrentViewDate}
            googleCalendars={googleCalendars || []}
            selectedCalendarId={selectedCalendarId}
            onSelectCalendar={handleCalendarSelection}
            onManageCalendar={() => setIsManageDialogOpen(true)}
            onCreateCalendar={() => setIsCreateDialogOpen(true)}
            isCalendarsLoading={isLoadingCalendars}
          />
        ) : (
          <MonthlyAgendaView
            tickets={allEvents as any}
            clients={clients || []}
            onSyncGoogleCalendar={handleSyncGoogleCalendar}
            isGoogleCalendarConnected={isConnected}
            googleEvents={filteredGoogleEvents}
            isGoogleCalendarEnabled={googleCalendarEnabled}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onCurrentDateChange={setCurrentViewDate}
          />
        )}
      </div>

      {/* Manage Calendar Dialog */}
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar agenda</DialogTitle>
            <DialogDescription>
              Escolha qual agenda sera usada nos chamados e na pagina agenda.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='manage-calendar-select'>Agenda dos chamados</Label>
              <Select
                value={selectedCalendarId || ''}
                onValueChange={handleManageCalendarSelection}
                disabled={
                  isLoadingCalendars ||
                  updateCalendarSelectionMutation.isPending ||
                  (googleCalendars?.length || 0) === 0
                }
              >
                <SelectTrigger id='manage-calendar-select' className='w-full'>
                  <SelectValue placeholder='Selecione uma agenda' />
                </SelectTrigger>
                <SelectContent>
                  {(googleCalendars || []).map((cal) => (
                    <SelectItem key={cal.id} value={cal.id}>
                      {cal.summary || 'Agenda'}
                      {cal.primary ? ' (Principal)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                Esta agenda sera usada nos chamados e na pagina agenda.
              </p>
            </div>
          </div>

          <DialogFooter className='flex-col sm:flex-row gap-2'>
            <Button
              variant='outline'
              onClick={() => setIsManageDialogOpen(false)}
            >
              Fechar
            </Button>
            <Button
              variant='destructive'
              onClick={() => {
                setIsManageDialogOpen(false);
                setIsDeleteDialogOpen(true);
              }}
              disabled={!canDeleteSelectedCalendar}
            >
              Excluir agenda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Calendar Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={() => {}}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle data-testid='text-create-calendar-title'>
              Criar Nova Agenda
            </DialogTitle>
            <DialogDescription>
              Crie uma nova agenda no Google Calendar para organizar seus
              eventos.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='calendarName'>Nome da Agenda *</Label>
              <Input
                id='calendarName'
                value={newCalendarName}
                onChange={(e) => setNewCalendarName(e.target.value)}
                placeholder='Ex: Atendimentos, Manutenções...'
                data-testid='input-calendar-name'
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowCancelCreateConfirm(true)}
              data-testid='button-cancel-create-calendar'
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCalendar}
              disabled={createCalendarMutation.isPending}
              data-testid='button-save-calendar'
            >
              {createCalendarMutation.isPending ? 'Criando...' : 'Criar Agenda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Create Calendar Confirmation */}
      <AlertDialog
        open={showCancelCreateConfirm}
        onOpenChange={setShowCancelCreateConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar criação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar? O nome da agenda será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid='button-cancel-create-no'>
              Não
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewCalendarName('');
                setShowCancelCreateConfirm(false);
              }}
              data-testid='button-cancel-create-yes'
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Calendar Confirmation */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Agenda</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a agenda "
              {selectedCalendar?.summary}"? Todos os eventos desta agenda serão
              removidos do Google Calendar. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid='button-cancel-delete-calendar'>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCalendar}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              data-testid='button-confirm-delete-calendar'
            >
              {deleteCalendarMutation.isPending
                ? 'Excluindo...'
                : 'Excluir Agenda'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Blocking Event Dialog */}
      <Dialog
        open={isCreateEventDialogOpen}
        onOpenChange={(open) => {
          setIsCreateEventDialogOpen(open);
          if (!open) {
            // Reset form when closing
            setNewEventData({
              title: '',
              description: '',
              startDate: '',
              startTime: '',
              endDate: '',
              endTime: '',
              location: '',
              color: '#3b82f6',
              allDay: false,
            });
            setEventViewMode('start');
            setSelectedStartDate(undefined);
            setSelectedEndDate(undefined);
            setSelectedDateRange({ from: undefined, to: undefined });
          } else {
            // Scroll to top when opening
            setTimeout(() => {
              const dialogContent = document.querySelector('[role="dialog"]');
              if (dialogContent) {
                dialogContent.scrollTop = 0;
              }
            }, 100);
          }
        }}
      >
        <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Criar Evento</DialogTitle>
            <DialogDescription>
              Crie um evento na sua agenda. Este horário não estará disponível
              para agendamentos públicos.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-6 py-4'>
            {/* Título e Descrição */}
            <div className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='eventTitle'>Título *</Label>
                <Input
                  id='eventTitle'
                  value={newEventData.title}
                  onChange={(e) =>
                    setNewEventData({ ...newEventData, title: e.target.value })
                  }
                  placeholder='Ex: Consulta médica particular'
                />
    </div>

              <div className='space-y-2'>
                <Label htmlFor='eventDescription'>Descrição</Label>
                <Input
                  id='eventDescription'
                  value={newEventData.description}
                  onChange={(e) =>
                    setNewEventData({
                      ...newEventData,
                      description: e.target.value,
                    })
                  }
                  placeholder='Descrição opcional do evento'
                />
              </div>
            </div>

            {/* Opção Dia Todo */}
            <div className='flex items-center justify-between p-4 bg-muted/50 rounded-xl border'>
              <div className='space-y-0.5'>
                <Label htmlFor='allDay' className='text-base font-semibold'>
                  Dia todo
                </Label>
                <p className='text-sm text-muted-foreground'>
                  Marque o dia inteiro como ocupado
                </p>
              </div>
              <Switch
                id='allDay'
                checked={newEventData.allDay}
                onCheckedChange={handleAllDayToggle}
              />
            </div>

            {/* Calendário e Horários */}
            <div className='space-y-4'>
              <div className='flex items-center gap-2'>
                <div className='h-2 w-2 rounded-full bg-primary' />
                <Label className='text-base font-semibold'>
                  {newEventData.allDay ? 'Período (De até)' : 'Data e Horário'}
                </Label>
              </div>
              <div
                className={cn(
                  'bg-muted/40 rounded-xl border border-border overflow-hidden relative',
                  'h-[380px] max-h-[380px]',
                  !newEventData.allDay && 'transition-all duration-500 ease-in-out'
                )}
              >
                {newEventData.allDay ? (
                  /* Calendário para dia todo - largura total */
                  <div className='w-full p-3 sm:p-4 space-y-3 h-full flex flex-col overflow-hidden'>
                    <div className='flex items-center justify-between shrink-0 mb-1'>
                      <div className='flex items-center gap-2'>
                        <CalendarIcon className='h-4 w-4 text-primary' />
                      <h3 className='font-bold text-[10px] uppercase tracking-widest text-muted-foreground'>
                          {selectedStartDate
                            ? format(selectedStartDate, 'MMMM yyyy', {
                                locale: ptBR,
                              })
                            : format(new Date(), 'MMMM yyyy', { locale: ptBR })}
                        </h3>
                      </div>
                      <div className='flex gap-1'>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          onClick={() => {
                            const newDate = selectedStartDate || new Date();
                            setSelectedStartDate(
                              new Date(
                                newDate.getFullYear(),
                                newDate.getMonth() - 1,
                                1
                              )
                            );
                          }}
                          className='h-7 w-7 rounded-md hover:bg-primary/10'
                        >
                          <ChevronLeft className='h-3.5 w-3.5' />
                        </Button>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          onClick={() => {
                            const newDate = selectedStartDate || new Date();
                            setSelectedStartDate(
                              new Date(
                                newDate.getFullYear(),
                                newDate.getMonth() + 1,
                                1
                              )
                            );
                          }}
                          className='h-7 w-7 rounded-md hover:bg-primary/10'
                        >
                          <ChevronLeft className='h-3.5 w-3.5 rotate-180' />
                        </Button>
                      </div>
                    </div>

                    <div className='bg-card/90 rounded-2xl p-2 sm:p-3 border border-border shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden'>
                      <Calendar
                        mode='range'
                        selected={selectedDateRange}
                        onSelect={(range) =>
                          handleDateSelect(undefined, range)
                        }
                        month={selectedStartDate || new Date()}
                        onMonthChange={setSelectedStartDate}
                        numberOfMonths={1}
                        initialFocus
                        locale={ptBR}
                        disabled={(date) => {
                          // Desabilitar dias com eventos de dia inteiro do Google Calendar (tornam o dia indisponível)
                          const dateStr = format(date, 'yyyy-MM-dd');
                          if (!workingDaysSet.has(date.getDay())) {
                            return true;
                          }
                          return unavailableDaysSet.has(dateStr);
                        }}
                        className='w-full flex-1'
                        classNames={{
                          months: 'w-full space-y-1',
                          month: 'w-full space-y-1',
                          caption: 'hidden',
                          table: 'w-full border-collapse',
                          head_row: 'flex w-full',
                          head_cell:
                            'text-muted-foreground rounded-md flex-1 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest py-1.5 px-0',
                          row: 'flex w-full mt-0.5',
                          cell: 'flex-1 text-center p-0 relative focus-within:relative focus-within:z-20 min-w-0',
                          day: 'h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 p-0 font-medium aria-selected:opacity-100 hover:bg-primary/10 hover:text-primary rounded-lg transition-all mx-auto flex items-center justify-center text-[10px] sm:text-xs text-foreground border border-transparent',
                          day_range_start:
                            'bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white shadow-lg shadow-primary/30 scale-105 z-10 border-primary rounded-l-lg',
                          day_range_end:
                            'bg-destructive text-white hover:bg-destructive hover:text-white focus:bg-destructive focus:text-white shadow-lg shadow-destructive/30 scale-105 z-10 border-destructive rounded-r-lg',
                          day_range_middle:
                            'bg-primary/20 text-primary border-primary/30',
                          day_selected:
                            'bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white shadow-lg shadow-primary/30 scale-105 z-10 border-primary',
                          day_today:
                            'bg-primary/10 text-primary font-black border-primary/20',
                          day_outside: 'text-muted-foreground/40 opacity-50',
                          day_disabled:
                            'text-muted-foreground/30 opacity-40 cursor-not-allowed',
                        }}
                      />
                      <div className='mt-4 p-3 bg-muted/50 rounded-lg border'>
                        <div className='flex items-center justify-between text-sm flex-wrap gap-2'>
                          <div className='flex items-center gap-2'>
                            <div className='h-2 w-2 rounded-full bg-primary' />
                            <span className='font-medium text-muted-foreground'>
                              {newEventData.startDate
                                ? format(new Date(newEventData.startDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                                : 'Selecione a data de início'}
                            </span>
                          </div>
                          {newEventData.startDate && (
                            <>
                              <span className='text-muted-foreground'>→</span>
                              <div className='flex items-center gap-2'>
                                <div className='h-2 w-2 rounded-full bg-destructive' />
                                <span className='font-medium text-muted-foreground'>
                                  {newEventData.endDate && newEventData.endDate !== newEventData.startDate
                                    ? format(new Date(newEventData.endDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                                    : newEventData.startDate
                                    ? 'Mesma data'
                                    : 'Selecione a data de término'}
                                </span>
                              </div>
                              {newEventData.endDate &&
                                newEventData.endDate !== newEventData.startDate && (
                                  <div className='ml-auto text-xs text-muted-foreground'>
                                    {(() => {
                                      const start = new Date(newEventData.startDate);
                                      const end = new Date(newEventData.endDate);
                                      const diffTime =
                                        Math.abs(end.getTime() - start.getTime());
                                      const diffDays =
                                        Math.ceil(diffTime / (1000 * 60 * 60 * 24)) +
                                        1;
                                      return `${diffDays} dia${diffDays > 1 ? 's' : ''}`;
                                    })()}
                                  </div>
                                )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Calendário normal com transição para horários */
                  <div
                    className='flex transition-transform duration-500 ease-in-out w-[200%] h-full'
                    style={{
                      transform:
                        newEventData.startDate
                          ? 'translateX(-50%)'
                          : 'translateX(0)',
                    }}
                  >
                    {/* Calendário */}
                    <div className='w-1/2 p-3 sm:p-4 space-y-3 shrink-0 h-full flex flex-col overflow-hidden'>
                    <div className='flex items-center justify-between shrink-0 mb-1'>
                      <div className='flex items-center gap-2'>
                        <CalendarIcon className='h-4 w-4 text-primary' />
                        <h3 className='font-bold text-[10px] uppercase tracking-widest text-muted-foreground'>
                          {selectedStartDate
                            ? format(selectedStartDate, 'MMMM yyyy', {
                                locale: ptBR,
                              })
                            : format(new Date(), 'MMMM yyyy', { locale: ptBR })}
                        </h3>
                      </div>
                      <div className='flex gap-1'>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          onClick={() => {
                            const newDate = selectedStartDate || new Date();
                            setSelectedStartDate(
                              new Date(
                                newDate.getFullYear(),
                                newDate.getMonth() - 1,
                                1
                              )
                            );
                          }}
                          className='h-7 w-7 rounded-md hover:bg-primary/10'
                        >
                          <ChevronLeft className='h-3.5 w-3.5' />
                        </Button>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          onClick={() => {
                            const newDate = selectedStartDate || new Date();
                            setSelectedStartDate(
                              new Date(
                                newDate.getFullYear(),
                                newDate.getMonth() + 1,
                                1
                              )
                            );
                          }}
                          className='h-7 w-7 rounded-md hover:bg-primary/10'
                        >
                          <ChevronLeft className='h-3.5 w-3.5 rotate-180' />
                        </Button>
                      </div>
                    </div>

                    <div className='bg-card/90 rounded-2xl p-2 sm:p-3 border border-border shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden'>
                      <Calendar
                        mode='single'
                        selected={selectedStartDate}
                        onSelect={(date) => handleDateSelect(date)}
                        month={selectedStartDate || new Date()}
                        onMonthChange={setSelectedStartDate}
                        initialFocus
                        locale={ptBR}
                        disabled={(date) => {
                          // Desabilitar dias com eventos de dia inteiro do Google Calendar (tornam o dia indisponível)
                          const dateStr = format(date, 'yyyy-MM-dd');
                          if (!workingDaysSet.has(date.getDay())) {
                            return true;
                          }
                          return unavailableDaysSet.has(dateStr);
                        }}
                        className='w-full flex-1'
                        classNames={{
                          months: 'w-full space-y-1',
                          month: 'w-full space-y-1',
                          caption: 'hidden',
                          table: 'w-full border-collapse',
                          head_row: 'flex w-full',
                          head_cell:
                            'text-muted-foreground rounded-md flex-1 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest py-1.5 px-0',
                          row: 'flex w-full mt-0.5',
                          cell: 'flex-1 text-center p-0 relative focus-within:relative focus-within:z-20 min-w-0',
                          day: 'h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 p-0 font-medium aria-selected:opacity-100 hover:bg-primary/10 hover:text-primary rounded-lg transition-all mx-auto flex items-center justify-center text-[10px] sm:text-xs text-foreground border border-transparent',
                          day_selected:
                            'bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white shadow-lg shadow-primary/30 scale-105 z-10 border-primary',
                          day_today:
                            'bg-primary/10 text-primary font-black border-primary/20',
                          day_outside: 'text-muted-foreground/40 opacity-50',
                          day_disabled:
                            'text-muted-foreground/30 opacity-40 cursor-not-allowed',
                        }}
                      />
                    </div>
                  </div>

                  {/* Horários */}
                  {!newEventData.allDay && (
                    <div className='w-1/2 p-4 space-y-4 shrink-0 h-full flex flex-col'>
                      <div className='bg-card/90 rounded-xl border border-border overflow-hidden flex flex-col shadow-sm h-full'>
                        <div className='p-2 sm:p-3 space-y-2 flex-1 overflow-y-auto scrollbar-thin'>
                          <div className='grid grid-cols-[1fr_auto_1fr] items-center mb-2 shrink-0 px-1'>
                            <div className='flex items-center gap-2'>
                              <Clock className='h-3.5 w-3.5 text-primary' />
                              <h3 className='text-[10px] font-black uppercase tracking-widest text-muted-foreground'>
                                {!newEventData.startTime
                                  ? 'Selecione o horário de início'
                                  : !newEventData.endTime
                                  ? 'Selecione o horário de término'
                                  : 'Horário selecionado'}
                              </h3>
                            </div>
                            {selectedStartDateLabel ? (
                              <div className='text-[11px] font-bold text-primary tracking-wide text-center bg-primary/10 border border-primary/20 rounded-md px-2 py-1 shadow-sm'>
                                {selectedStartDateLabel}
                              </div>
                            ) : (
                              <div />
                            )}
                            <div className='justify-self-end'>
                              <Button
                                type='button'
                                variant='ghost'
                                size='sm'
                                onClick={() => {
                                  setNewEventData({
                                    ...newEventData,
                                    startDate: '',
                                    startTime: '',
                                    endTime: '',
                                  });
                                  setSelectedStartDate(undefined);
                                }}
                                className='h-7 gap-1 px-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors hover:bg-primary/5 rounded-lg'
                              >
                                <ChevronLeft className='h-3 w-3' />
                                Voltar
                              </Button>
                            </div>
                          </div>

                          <div className='grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3'>
                            {timeSlots.map((slot) => {
                              const isStart = newEventData.startTime === slot;
                              const isEnd = newEventData.endTime === slot;
                              const slotMinutes = timeToMinutes(slot);
                              const startMinutes = newEventData.startTime
                                ? timeToMinutes(newEventData.startTime)
                                : -1;
                              const endMinutes = newEventData.endTime
                                ? timeToMinutes(newEventData.endTime)
                                : -1;
                              
                              // Verificar se o horário está indisponível devido a eventos do Google Calendar
                              const isUnavailable = isTimeSlotUnavailable(selectedStartDate, slot);
                              
                              // Se já tem início selecionado, destacar horários entre início e fim
                              const isInRange =
                                startMinutes >= 0 &&
                                slotMinutes >= startMinutes &&
                                (endMinutes < 0 || slotMinutes <= endMinutes);
                              
                              return (
                                <button
                                  key={slot}
                                  type='button'
                                  onClick={() => {
                                    if (!isUnavailable) {
                                      handleTimeSelect(slot);
                                    }
                                  }}
                                  disabled={isUnavailable}
                                  className={cn(
                                    'flex items-center justify-center py-4 sm:py-6 rounded-xl border text-sm sm:text-base font-black transition-all relative',
                                    isUnavailable
                                      ? 'bg-muted/70 border-border text-muted-foreground/70 opacity-50 cursor-not-allowed line-through'
                                      : isStart
                                      ? 'bg-primary border-primary text-white shadow-xl shadow-primary/30 scale-105 z-10'
                                      : isEnd
                                      ? 'bg-destructive border-destructive text-white shadow-xl shadow-destructive/30 scale-105 z-10'
                                      : isInRange && startMinutes >= 0
                                      ? 'bg-primary/20 border-primary/30 text-primary'
                                      : 'bg-muted/40 border-border text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-card hover:shadow-md'
                                  )}
                                >
                                  {slot}
                                  {isStart && (
                                    <span className='absolute -top-1 -right-1 bg-primary text-white text-[8px] px-1 rounded-full'>
                                      DE
                                    </span>
                                  )}
                                  {isEnd && (
                                    <span className='absolute -top-1 -right-1 bg-destructive text-white text-[8px] px-1 rounded-full'>
                                      ATÉ
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                )}
              </div>
            </div>

            {/* Localização e Cor */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='eventLocation'>Localização</Label>
                <Input
                  id='eventLocation'
                  value={newEventData.location}
                  onChange={(e) =>
                    setNewEventData({
                      ...newEventData,
                      location: e.target.value,
                    })
                  }
                  placeholder='Endereço ou local do evento'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='eventColor'>Cor do Evento</Label>
                <div className='flex items-center gap-2'>
                  <Input
                    id='eventColor'
                    type='color'
                    value={newEventData.color}
                    onChange={(e) =>
                      setNewEventData({
                        ...newEventData,
                        color: e.target.value,
                      })
                    }
                    className='h-10 w-20'
                  />
                  <Input
                    value={newEventData.color}
                    onChange={(e) =>
                      setNewEventData({
                        ...newEventData,
                        color: e.target.value,
                      })
                    }
                    placeholder='#3b82f6'
                    className='flex-1'
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setIsCreateEventDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateEvent}
              disabled={createEventMutation.isPending}
            >
              {createEventMutation.isPending ? 'Criando...' : 'Criar Evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
