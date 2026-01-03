import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { DateInput, TimeInput } from '@/components/ui/date-time-input';
import { getTimeSlotsForDate, type WorkingHoursConfig } from '@/lib/working-hours';
import {
  resolveGoogleCalendarConnected,
  resolveGoogleCalendarEnabled,
} from '@/lib/google-calendar';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { usePaidAccess } from '@/hooks/use-paid-access';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Plus,
  Loader2,
  ChevronsUpDown,
  Check,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Copy,
  Navigation,
  User,
  Building2,
  Briefcase,
  Search,
  ClipboardList,
  Clock,
  MapPin,
  FileText,
  X,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TicketCompleteDialog } from '@/components/ticket-complete-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  maskCPF,
  maskCNPJ,
  maskCurrency,
  unmaskCPF,
  unmaskCNPJ,
  unmaskCurrency,
} from '@/lib/masks';

interface Client {
  id: string;
  name: string;
  type: 'PF' | 'PJ' | 'EMPRESA_PARCEIRA';
  document: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  address?: string;
  streetAddress?: string;
  defaultTicketValue?: string;
  defaultKmRate?: string;
  defaultHoursIncluded?: number;
  defaultAdditionalHourRate?: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration?: number;
}

interface CreateTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedClientId?: string | null;
}

const INITIAL_FORM_DATA = {
  clientId: '',
  serviceId: '',
  scheduledDate: '',
  scheduledTime: '',
  scheduledEndDate: '',
  scheduledEndTime: '',
  duration: 3,
  description: '',
  address: '',
  ticketNumber: '',
  finalClient: '',
  ticketValue: '',
  chargeType: 'VALOR_FIXO' as
    | 'DIARIA'
    | 'CHAMADO_AVULSO'
    | 'VALOR_FIXO'
    | 'VALOR_POR_HORA',
  approvedBy: '',
  kmRate: '',
  additionalHourRate: '',
  serviceAddress: '',
  calculationsEnabled: true,
};

const isCreateTicketDebugEnabled = () =>
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  window.localStorage.getItem('createTicketDebug') === 'true';

const createTicketLog = (...args: unknown[]) => {
  if (isCreateTicketDebugEnabled()) {
    console.log(...args);
  }
};

export function CreateTicketModal({
  open,
  onOpenChange,
  preselectedClientId,
}: CreateTicketModalProps) {
  const { toast } = useToast();
  const { requirePaid, isPaid } = usePaidAccess();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [clientTypeFilter, setClientTypeFilter] = useState<
    'PF' | 'PJ' | 'EMPRESA_PARCEIRA'
  >('PF');
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchValue, setClientSearchValue] = useState('');
  const [documentSearch, setDocumentSearch] = useState('');
  const documentSearchLabel = clientTypeFilter === 'PF' ? 'CPF' : 'CNPJ';
  const documentSearchMaxDigits = clientTypeFilter === 'PF' ? 11 : 14;
  const documentSearchPlaceholder =
    clientTypeFilter === 'PF' ? 'Buscar por CPF...' : 'Buscar por CNPJ...';
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [isCreateServiceOpen, setIsCreateServiceOpen] = useState(false);
  const [newServiceData, setNewServiceData] = useState({
    name: '',
    price: '',
    description: '',
  });

  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['/api/services'],
  });

  const { data: nextTicketNumber } = useQuery<string>({
    queryKey: ['/api/tickets/next-number'],
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: integrationSettings } = useQuery<{
    googleCalendarStatus: string;
    googleCalendarEmail?: string;
    googleCalendarEnabled?: boolean;
    googleCalendarId?: string;
    defaultDurationHours?: number;
    workingDays?: number[];
    workingHours?: WorkingHoursConfig | string[];
    calculationsEnabled?: boolean;
    calculationsPerTicket?: boolean;
    calculationsClientTypes?: string[];
  }>({
    queryKey: ['/api/integration-settings'],
    enabled: open,
  });

  // Buscar horários disponíveis quando Google Calendar estiver conectado
  const [availableSlotsDateRange, setAvailableSlotsDateRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  // Inicializar o range de datas para os slots disponíveis (mês atual e próximo)
  useEffect(() => {
    if (open && !availableSlotsDateRange) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setMonth(end.getMonth() + 2); // 2 meses a frente
      end.setHours(23, 59, 59, 999);
      setAvailableSlotsDateRange({ start, end });
    }
  }, [open, availableSlotsDateRange]);

  const googleCalendarEnabled = resolveGoogleCalendarEnabled(
    integrationSettings
  );
  const isGoogleCalendarConnected =
    isPaid && resolveGoogleCalendarConnected(integrationSettings);
  const isGoogleCalendarActive =
    isGoogleCalendarConnected && googleCalendarEnabled;

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

  createTicketLog('[create-ticket-modal] 🔍 Status:', {
    open,
    isGoogleCalendarConnected,
    googleCalendarStatus: integrationSettings?.googleCalendarStatus,
  });

  // Buscar eventos do Google Calendar para identificar dias indisponíveis (igual página de agenda)
  interface GoogleEvent {
    id: string;
    summary: string;
    start: string;
    end: string;
    calendarId: string;
    allDay?: boolean;
  }

  const { data: googleEvents } = useQuery<GoogleEvent[]>({
    queryKey: ['/api/google-calendar/events', 'all'],
    queryFn: async () => {
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
      open &&
      isGoogleCalendarConnected &&
      googleCalendarEnabled,
  });

  const activeCalendarId = integrationSettings?.googleCalendarId;
  const filteredGoogleEvents = useMemo(() => {
    if (!googleEvents) return [];
    if (!activeCalendarId || activeCalendarId === 'primary') {
      return googleEvents;
    }
    return googleEvents.filter((event) => event.calendarId === activeCalendarId);
  }, [googleEvents, activeCalendarId]);

  // Criar Set de dias indisponíveis por eventos de dia inteiro (igual página de agenda)
  const unavailableDaysSet = useMemo(() => {
    if (
      !isGoogleCalendarConnected ||
      filteredGoogleEvents.length === 0 ||
      !googleCalendarEnabled
    ) {
      createTicketLog(
        '[create-ticket-modal] ❌ Google Calendar não conectado ou desabilitado'
      );
      return new Set<string>();
    }

    const unavailable = new Set<string>();

    createTicketLog(
      '[create-ticket-modal]   Processando eventos do Google Calendar:',
      filteredGoogleEvents.length
    );

    filteredGoogleEvents.forEach((event) => {
      // Se o evento é de dia inteiro (allDay === true ou formato sem 'T')
      if (
        event.allDay ||
        (!event.start.includes('T') && !event.end.includes('T'))
      ) {
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);

        // Iterar por todos os dias do evento (endDate é exclusivo no Google Calendar)
        const currentDate = new Date(startDate);
        currentDate.setHours(0, 0, 0, 0);

        while (currentDate < endDate) {
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          unavailable.add(dateStr);
          createTicketLog(
            '[create-ticket-modal]   Dia indisponível adicionado:',
            dateStr,
            event.summary
          );
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    });

    createTicketLog(
      '[create-ticket-modal]   Dias indisponíveis:',
      Array.from(unavailable).sort()
    );
    return unavailable;
  }, [filteredGoogleEvents, isGoogleCalendarConnected, integrationSettings]);

  const { data: availableSlotsData, isLoading: isLoadingSlots } = useQuery<{
    slots: Array<{ date: string; time: string; datetime: string }>;
    count: number;
  }>({
    queryKey: [
      '/api/tickets/available-slots',
      availableSlotsDateRange?.start.toISOString(),
      availableSlotsDateRange?.end.toISOString(),
      formData.serviceId,
    ],
    enabled: open && !!availableSlotsDateRange,
    queryFn: async () => {
      if (!availableSlotsDateRange) return { slots: [], count: 0 };
      const params = new URLSearchParams({
        startDate: availableSlotsDateRange.start.toISOString(),
        endDate: availableSlotsDateRange.end.toISOString(),
        ...(formData.serviceId ? { serviceId: formData.serviceId } : {}),
      });
      const response = await apiRequest(
        'GET',
        `/api/tickets/available-slots?${params.toString()}`,
        undefined
      );
      if (!response.ok) throw new Error('Failed to fetch available slots');
      return response.json();
    },
  });

  const availableSlots = availableSlotsData?.slots || [];

  createTicketLog('[create-ticket-modal] 🔍 availableSlots atualizado:', {
    availableSlotsLength: availableSlots.length,
    isLoadingSlots,
    sampleDates: availableSlots.slice(0, 5).map((s) => s.date),
    currentScheduledDate: formData.scheduledDate,
  });

  const availableDatesSet = useMemo(() => {
    // Se ainda está carregando, não filtrar ainda
    if (isLoadingSlots) {
      return undefined;
    }

    // Se há slots disponíveis, criar Set com as datas
    if (availableSlots.length > 0) {
      const datesSet = new Set(availableSlots.map((slot) => slot.date));

      // IMPORTANTE: Remover dias que estão em unavailableDaysSet
      // Dias com eventos de dia inteiro não devem aparecer em availableDates
      if (unavailableDaysSet && unavailableDaysSet.size > 0) {
        unavailableDaysSet.forEach((unavailableDate) => {
          datesSet.delete(unavailableDate);
        });
      }

      createTicketLog('[create-ticket-modal]   Available dates set:', {
        totalSlots: availableSlots.length,
        totalDates: datesSet.size,
        dates: Array.from(datesSet).sort().slice(0, 20), // Mostrar primeiras 20 datas
        unavailableDays: unavailableDaysSet
          ? Array.from(unavailableDaysSet)
          : [],
        isGoogleCalendarConnected,
        isLoadingSlots,
      });

      return datesSet;
    }

    // Se não há slots, retornar undefined para não filtrar.
    // Isso evita bloquear o calendário quando os slots ainda não estão disponíveis.
    createTicketLog(
      '[create-ticket-modal] ⚠️ Available dates set: slots vazios, retornando undefined'
    );
    return undefined;
  }, [
    availableSlots,
    isGoogleCalendarConnected,
    isLoadingSlots,
    unavailableDaysSet,
  ]);

  // Função para verificar se um horário está indisponível devido a eventos do Google Calendar
  // Seguindo exatamente o padrão da página agenda.tsx
  const isTimeSlotUnavailable = (
    date: Date | undefined,
    time: string
  ): boolean => {
    // Se não há data selecionada ou Google Calendar não está conectado, horário está disponível
    if (
      !date ||
      !isGoogleCalendarConnected ||
      filteredGoogleEvents.length === 0 ||
      !googleCalendarEnabled
    ) {
      return false;
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const [hours, minutes] = time.split(':').map(Number);
    const slotTotalMinutes = hours * 60 + minutes;

    return filteredGoogleEvents.some((event) => {
      if (
        event.allDay ||
        (!event.start.includes('T') && !event.end.includes('T'))
      ) {
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

        // Um horário está indisponível se está dentro do intervalo do evento
        // Incluindo o horário de início e até o horário de fim (inclusivo no fim também)
        // Se evento é 09:00-14:00, então 09:00, 09:30, 10:00... até 14:00 devem estar indisponíveis
        return (
          slotTotalMinutes >= eventStartTotalMinutes &&
          slotTotalMinutes <= eventEndTotalMinutes
        );
      }
    });
  };

  const availableTimesForSelectedDate = useMemo(() => {
    // Se não há data selecionada, retornar undefined
    if (!formData.scheduledDate || isLoadingSlots) {
      return undefined;
    }

    // Filtrar slots para a data selecionada
    const slotsForDate = availableSlots.filter(
      (slot) => slot.date === formData.scheduledDate
    );

    // Se não há slots do backend para esta data, retornar array vazio
    // Array vazio faz o DateTimePicker mostrar "Sem horários"
    if (slotsForDate.length === 0) {
      return [];
    }

    const selectedDate = new Date(formData.scheduledDate + 'T00:00:00');

    // Se há slots, filtrar pelos horários ocupados do Google Calendar
    const times = slotsForDate
      .map((slot) => slot.time)
      .filter((time) => {
        if (
          isGoogleCalendarConnected &&
          isTimeSlotUnavailable(selectedDate, time)
        ) {
          return false;
        }
        return true;
      })
      .sort();

    // IMPORTANTE: Se após filtrar não sobrou nenhum horário,
    // retornar array vazio para bloquear seleção
    return times.length === 0 ? [] : times;
  }, [
    formData.scheduledDate,
    availableSlots,
    isGoogleCalendarConnected,
    isTimeSlotUnavailable,
    isLoadingSlots,
  ]);

  const scheduleTimeSlots = useMemo<string[] | undefined>(() => {
    if (!formData.scheduledDate) {
      return undefined;
    }
    const selectedDate = new Date(`${formData.scheduledDate}T00:00:00`);
    return getTimeSlotsForDate(
      selectedDate,
      integrationSettings?.workingHours,
      integrationSettings?.workingDays
    );
  }, [formData.scheduledDate, integrationSettings]);

  const defaultDuration = integrationSettings?.defaultDurationHours || 3;

  // Reset form and scroll to top when modal opens
  useEffect(() => {
    if (open) {
      const isCalculationsEnabledGlobally =
        integrationSettings?.calculationsEnabled ?? true;
      const selectedClient = clients?.find(
        (c) => c.id === (preselectedClientId || formData.clientId)
      );
      const clientType = selectedClient?.type || clientTypeFilter;
      const isTypeEnabled =
        integrationSettings?.calculationsClientTypes?.includes(clientType) ??
        true;

      setFormData({
        ...INITIAL_FORM_DATA,
        duration: defaultDuration,
        clientId: preselectedClientId || '',
        calculationsEnabled: isCalculationsEnabledGlobally && isTypeEnabled,
      });
      setClientTypeFilter('PF');
      setClientSearchValue('');
      setDocumentSearch('');
      setFormErrors({});

      // Scroll to top after a small delay to ensure content is rendered
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }, 50);
    }
  }, [open, defaultDuration]);

  useEffect(() => {
    if (preselectedClientId && clients && open) {
      const selectedClient = clients.find((c) => c.id === preselectedClientId);
      if (selectedClient) {
        setFormData((prev) => ({
          ...prev,
          clientId: selectedClient.id,
          address: selectedClient.address || selectedClient.streetAddress || '',
          duration: defaultDuration,
        }));
        setClientTypeFilter(
          selectedClient.type === 'EMPRESA_PARCEIRA'
            ? 'EMPRESA_PARCEIRA'
            : selectedClient.type === 'PJ'
            ? 'PJ'
            : 'PF'
        );
      }
    }
  }, [preselectedClientId, clients, open, defaultDuration]);

  useEffect(() => {
    if (open && services && services.length > 0) {
      setFormData((prev) => {
        if (prev.serviceId) return prev;
        const combinarNoLocal = services.find((service) => {
          const serviceName = (service.name || '').toLowerCase().trim();
          return (
            serviceName.includes('combinar') && serviceName.includes('local')
          );
        });
        if (combinarNoLocal) {
          return { ...prev, serviceId: combinarNoLocal.id };
        }
        return prev;
      });
    }
  }, [open, services]);

  const calculatedDuration = useMemo(() => {
    if (!formData.clientId || !clients) return defaultDuration;
    const selectedClient = clients.find((c) => c.id === formData.clientId);
    if (!selectedClient) return defaultDuration;
    if (
      selectedClient.type === 'EMPRESA_PARCEIRA' &&
      selectedClient.defaultHoursIncluded
    ) {
      return selectedClient.defaultHoursIncluded;
    }
    return defaultDuration;
  }, [formData.clientId, clients, defaultDuration]);

  useEffect(() => {
    if (calculatedDuration !== formData.duration) {
      setFormData((prev) => ({ ...prev, duration: calculatedDuration }));
    }
  }, [calculatedDuration]);

  useEffect(() => {
    if (
      formData.scheduledDate &&
      formData.scheduledTime &&
      calculatedDuration
    ) {
      try {
        const [year, month, day] = formData.scheduledDate
          .split('-')
          .map(Number);
        const [hours, minutes] = formData.scheduledTime.split(':').map(Number);
        const startDate = new Date(year, month - 1, day, hours, minutes);
        const endDate = new Date(
          startDate.getTime() + calculatedDuration * 60 * 60 * 1000
        );
        const endDateStr = `${endDate.getFullYear()}-${String(
          endDate.getMonth() + 1
        ).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
        const endTimeStr = `${String(endDate.getHours()).padStart(
          2,
          '0'
        )}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        setFormData((prev) => ({
          ...prev,
          scheduledEndDate: endDateStr,
          scheduledEndTime: endTimeStr,
        }));
      } catch (error) {
        console.error('Erro ao calcular data/hora de fim:', error);
      }
    }
  }, [formData.scheduledDate, formData.scheduledTime, calculatedDuration]);

  // Sincronizar cálculos habilitados com tipo de cliente e configurações
  useEffect(() => {
    if (open && integrationSettings) {
      const isCalculationsEnabledGlobally =
        integrationSettings.calculationsEnabled ?? true;

      // Verificar tipo de cliente (prioriza cliente selecionado)
      const selectedClient = clients?.find((c) => c.id === formData.clientId);
      const clientType = selectedClient?.type || clientTypeFilter;

      const isTypeEnabled =
        integrationSettings.calculationsClientTypes?.includes(clientType) ??
        true;

      setFormData((prev) => ({
        ...prev,
        calculationsEnabled: isCalculationsEnabledGlobally && isTypeEnabled,
      }));
    }
  }, [clientTypeFilter, formData.clientId, integrationSettings, open, clients]);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    return clients.filter((client) => {
      const matchesType = client.type === clientTypeFilter;
      const matchesSearch =
        clientSearchValue === '' ||
        client.name.toLowerCase().includes(clientSearchValue.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [clients, clientTypeFilter, clientSearchValue]);

  const searchClientByDocument = async (
    document: string
  ): Promise<Client | null> => {
    try {
      const response = await apiRequest(
        'GET',
        `/api/clients/search/document?document=${encodeURIComponent(document)}`,
        undefined
      );
      const client = (await response.json()) as Client;
      if (client && client.id) return client;
      return null;
    } catch (error: any) {
      if (error.status === 404 || error.message?.includes('404')) return null;
      console.error('Erro ao buscar cliente:', error);
      return null;
    }
  };

  const handleDocumentSearchBlur = async () => {
    if (!documentSearch.trim()) return;
    const cleanDocument = documentSearch.replace(/\D/g, '');
    if (cleanDocument.length !== documentSearchMaxDigits) return;
    setIsSearchingClient(true);
    try {
      const foundClient = await searchClientByDocument(cleanDocument);
      if (foundClient && foundClient.id) {
        const clientType =
          foundClient.type === 'EMPRESA_PARCEIRA'
            ? 'EMPRESA_PARCEIRA'
            : foundClient.type === 'PJ'
            ? 'PJ'
            : 'PF';
        queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
        setClientTypeFilter(clientType);
        setTimeout(() => {
          setFormData((prev) => ({ ...prev, clientId: foundClient.id }));
          setClientSearchOpen(false);
          setDocumentSearch('');
        }, 100);
        toast({
          title: 'Cliente encontrado!',
          description: `Cliente "${foundClient.name}" selecionado automaticamente.`,
        });
      } else {
        toast({
          title: 'Cliente não encontrado',
          description: 'Nenhum cliente cadastrado com este documento.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
    } finally {
      setIsSearchingClient(false);
    }
  };

  const handleCurrencyChange = (
    field: 'ticketValue' | 'kmRate' | 'additionalHourRate',
    value: string
  ) => {
    const formatted = maskCurrency(value);
    setFormData({ ...formData, [field]: formatted });
  };

  const resetForm = () => {
    setFormData({
      clientId: preselectedClientId || '',
      serviceId: '',
      scheduledDate: '',
      scheduledTime: '',
      scheduledEndDate: '',
      scheduledEndTime: '',
      duration: defaultDuration,
      description: '',
      address: '',
      ticketNumber: '',
      finalClient: '',
      ticketValue: '',
      chargeType: 'VALOR_FIXO' as
        | 'DIARIA'
        | 'CHAMADO_AVULSO'
        | 'VALOR_FIXO'
        | 'VALOR_POR_HORA',
      approvedBy: '',
      kmRate: '',
      additionalHourRate: '',
      serviceAddress: '',
      calculationsEnabled: integrationSettings?.calculationsEnabled ?? true,
    });
    setDocumentSearch('');
    setClientSearchValue('');
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/tickets', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets/next-number'] });
      onOpenChange(false);
      resetForm();
      toast({
        title: 'Chamado criado',
        description: 'O chamado foi agendado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar chamado',
        description: error.message,
      });
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const unmaskedPrice = unmaskCurrency(data.price);
      const priceValue = Number.parseFloat(unmaskedPrice);
      const payload = {
        name: data.name.trim(),
        description: data.description.trim() || undefined,
        price: Number.isFinite(priceValue) ? priceValue.toFixed(2) : '0.00',
        duration: 3,
        active: true,
        publicBooking: true,
      };
      return await apiRequest('POST', '/api/services', payload);
    },
    onSuccess: async (response) => {
      const newService = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      setIsCreateServiceOpen(false);
      setNewServiceData({ name: '', price: '', description: '' });
      setFormData({ ...formData, serviceId: newService.id });
      toast({
        title: 'Serviço criado',
        description: 'O serviço foi criado e selecionado automaticamente.',
      });
    },
  });

  const handleConnectGoogleCalendar = async () => {
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
        if (data.authUrl) window.location.href = data.authUrl;
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao conectar',
        description: error.message,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, boolean> = {};

    if (!formData.clientId) errors.clientId = true;
    if (!formData.scheduledDate) errors.scheduledDate = true;
    if (!formData.scheduledTime) errors.scheduledTime = true;

    const selectedClient = clients?.find((c) => c.id === formData.clientId);
    const isEmpresaParceira = selectedClient?.type === 'EMPRESA_PARCEIRA';

    if (isEmpresaParceira && formData.calculationsEnabled) {
      const ticketNumberToValidate =
        formData.ticketNumber || nextTicketNumber || '';
      if (!ticketNumberToValidate.trim()) errors.ticketNumber = true;
      if (!formData.finalClient?.trim()) errors.finalClient = true;
      // Verificar serviceAddress - campo obrigatório para EMPRESA_PARCEIRA
      const serviceAddressValue = formData.serviceAddress?.trim() || '';
      if (!serviceAddressValue) {
        errors.serviceAddress = true;
      }
      // Validar ticketValue - maskCurrency retorna formato "150,00" (sem R$)
      const ticketValueClean = formData.ticketValue?.trim() || '';
      // Remover pontos de milhar e verificar se o valor numérico é maior que zero
      const numericValue = ticketValueClean
        .replace(/\./g, '')
        .replace(',', '.');
      const isZeroOrEmpty =
        !ticketValueClean ||
        ticketValueClean === '0,00' ||
        ticketValueClean === '0' ||
        ticketValueClean === '0,0' ||
        parseFloat(numericValue) <= 0;
      if (isZeroOrEmpty) errors.ticketValue = true;
      // approvedBy é opcional segundo a documentação (DATABASE_SCHEMA.md linha 199)
    } else if (isEmpresaParceira && !formData.calculationsEnabled) {
      // If calculations disabled for partner company, still need ticket number and address
      const ticketNumberToValidate =
        formData.ticketNumber || nextTicketNumber || '';
      if (!ticketNumberToValidate.trim()) errors.ticketNumber = true;
      if (!formData.finalClient?.trim()) errors.finalClient = true;
      // Verificar serviceAddress - campo obrigatório para EMPRESA_PARCEIRA
      const serviceAddressValue = (formData.serviceAddress || '').trim();
      if (!serviceAddressValue) {
        errors.serviceAddress = true;
      }
      // approvedBy é opcional segundo a documentação
    } else {
      if (!formData.serviceId) errors.serviceId = true;
    }

    // Debug: log dos erros encontrados
    if (Object.keys(errors).length > 0) {
      createTicketLog('[CreateTicketModal] Erros de validação:', errors);
      createTicketLog('[CreateTicketModal] FormData atual:', {
        clientId: formData.clientId,
        scheduledDate: formData.scheduledDate,
        scheduledTime: formData.scheduledTime,
        serviceId: formData.serviceId,
        ticketNumber: formData.ticketNumber,
        nextTicketNumber,
        finalClient: formData.finalClient,
        serviceAddress: formData.serviceAddress,
        ticketValue: formData.ticketValue,
        isEmpresaParceira,
        calculationsEnabled: formData.calculationsEnabled,
      });
      setFormErrors(errors);
      toast({
        variant: 'destructive',
        title: 'Erro de validação',
        description:
          'Por favor, preencha todos os campos destacados em vermelho.',
      });
      return;
    }

    setFormErrors({});

    const payload: any = {
      clientId: formData.clientId,
      scheduledFor: `${formData.scheduledDate}T${formData.scheduledTime}:00`,
      duration: formData.duration,
      description: formData.description || '',
      syncToGoogleCalendar: isGoogleCalendarActive,
      calculationsEnabled: formData.calculationsEnabled,
    };

    if (!isEmpresaParceira && formData.serviceId)
      payload.serviceId = formData.serviceId;

    if (isEmpresaParceira) {
      payload.ticketNumber = formData.ticketNumber || nextTicketNumber || '';
      payload.finalClient = formData.finalClient;
      payload.ticketValue = String(unmaskCurrency(formData.ticketValue));
      payload.chargeType = formData.chargeType;
      payload.approvedBy = formData.approvedBy;
      payload.kmRate = formData.kmRate
        ? String(unmaskCurrency(formData.kmRate))
        : undefined;
      payload.additionalHourRate = formData.additionalHourRate
        ? String(unmaskCurrency(formData.additionalHourRate))
        : undefined;
      payload.serviceAddress = formData.serviceAddress || '';
    } else if (selectedClient) {
      payload.address = formData.address || selectedClient.address || '';
      payload.city = selectedClient.city || '';
      payload.state = selectedClient.state || '';
    }

    createMutation.mutate(payload);
  };

  const clientCounts = useMemo(
    () => ({
      PF: (clients?.filter((c) => c.type === 'PF') || []).length,
      PJ: (clients?.filter((c) => c.type === 'PJ') || []).length,
      EMPRESA_PARCEIRA: (
        clients?.filter((c) => c.type === 'EMPRESA_PARCEIRA') || []
      ).length,
    }),
    [clients]
  );

  const ClientCounters = ({
    activeType,
    onTypeClick,
  }: {
    activeType?: 'PF' | 'PJ' | 'EMPRESA_PARCEIRA';
    onTypeClick?: (type: 'PF' | 'PJ' | 'EMPRESA_PARCEIRA') => void;
  }) => (
    <div className='flex gap-2 p-1 bg-muted/50 border border-border/50 rounded-xl w-full'>
      {[
        { id: 'PF', label: 'PF', count: clientCounts.PF, icon: User },
        { id: 'PJ', label: 'PJ', count: clientCounts.PJ, icon: Building2 },
        {
          id: 'EMPRESA_PARCEIRA',
          label: 'Parceira',
          count: clientCounts.EMPRESA_PARCEIRA,
          icon: Briefcase,
        },
      ].map((type) => (
        <button
          key={type.id}
          type='button'
          onClick={onTypeClick ? () => onTypeClick(type.id as any) : undefined}
          className={cn(
            'flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all duration-200 border border-transparent',
            activeType === type.id
              ? 'bg-background shadow-sm border-border text-primary ring-1 ring-border/50'
              : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
          )}
        >
          <type.icon
            className={cn(
              'h-3.5 w-3.5 mb-1',
              activeType === type.id ? 'text-primary' : 'opacity-50'
            )}
          />
          <span className='text-[10px] font-black uppercase tracking-wider mb-0.5 opacity-70'>
            {type.label}
          </span>
          <div className='flex items-center gap-1.5'>
            <span className='text-sm font-bold'>{type.count}</span>
            <span className='text-[9px] font-medium opacity-60'>
              {type.count === 1 ? 'cliente' : 'clientes'}
            </span>
          </div>
        </button>
      ))}
    </div>
  );

  // Auto-fill client defaults
  useEffect(() => {
    if (formData.clientId && clients) {
      const selectedClient = clients.find((c) => c.id === formData.clientId);
      if (selectedClient?.type === 'EMPRESA_PARCEIRA') {
        const formatVal = (v: any) =>
          v
            ? parseFloat(v).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : '';

        setFormData((prev) => ({
          ...prev,
          ticketNumber: prev.ticketNumber || nextTicketNumber || '',
          ticketValue:
            formatVal(selectedClient.defaultTicketValue) || prev.ticketValue,
          kmRate: formatVal(selectedClient.defaultKmRate) || prev.kmRate,
          additionalHourRate:
            formatVal(selectedClient.defaultAdditionalHourRate) ||
            prev.additionalHourRate,
          duration: selectedClient.defaultHoursIncluded || prev.duration,
          chargeType: 'VALOR_FIXO', // Padrão para parceiros
        }));
      } else if (selectedClient) {
        const fullAddr = [
          selectedClient.address,
          selectedClient.city,
          selectedClient.state,
        ]
          .filter(Boolean)
          .join(', ');
        setFormData((prev) => ({
          ...prev,
          address: fullAddr || selectedClient.address || '',
        }));
      }
    }
  }, [formData.clientId, clients]);

  // Auto-fill service price for PF/PJ
  useEffect(() => {
    if (formData.serviceId && services && formData.clientId && clients) {
      const selectedClient = clients.find((c) => c.id === formData.clientId);
      if (selectedClient?.type !== 'EMPRESA_PARCEIRA') {
        const selectedService = services.find(
          (s) => s.id === formData.serviceId
        );
        if (selectedService) {
          const formatVal = (v: any) =>
            v
              ? parseFloat(v).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : '';
          setFormData((prev) => ({
            ...prev,
            ticketValue: formatVal(selectedService.price),
            duration: selectedService.duration || prev.duration,
          }));
        }
      }
    }
  }, [formData.serviceId, services, formData.clientId, clients]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='max-w-4xl w-[98vw] md:w-full max-h-[98vh] md:max-h-[90vh] flex flex-col p-0 border-0 rounded-2xl overflow-hidden shadow-2xl'
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <form
          onSubmit={handleSubmit}
          className='flex flex-col h-full bg-white dark:bg-[#0f172a] overflow-hidden'
        >
          <DialogHeader className='p-5 pb-4 bg-primary/5 border-b border-primary/10 shrink-0'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20'>
                <Plus className='h-5 w-5' />
              </div>
              <div className='space-y-0.5'>
                <DialogTitle className='text-xl font-black tracking-tight text-gray-900 dark:text-slate-100'>
                  Criação de Chamado
                </DialogTitle>
                <DialogDescription className='text-xs text-muted-foreground dark:text-slate-400'>
                  Registre um novo atendimento preenchendo as informações
                  abaixo.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div
            ref={scrollContainerRef}
            className='flex-1 overflow-y-auto p-3 sm:p-6 pb-8 space-y-4 sm:space-y-8 scrollbar-thin dark:bg-[#0f172a]'
          >
            {/* Banner Google */}
            {isGoogleCalendarConnected ? (
              <Alert className='bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 rounded-xl py-2'>
                <CheckCircle2 className='h-4 w-4 text-blue-600' />
                <AlertDescription className='text-blue-700 dark:text-blue-300 text-xs font-medium ml-2'>
                  Sincronizado com Google Calendar (
                  {integrationSettings?.googleCalendarEmail})
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className='bg-amber-50/50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between gap-4 py-2 px-4'>
                <div className='flex items-center gap-2'>
                  <AlertCircle className='h-4 w-4 text-amber-600' />
                  <p className='text-amber-800 dark:text-amber-300 text-xs font-medium'>
                    Conecte ao Google Calendar para sincronizar seus chamados.
                  </p>
                </div>
                <Button
                  type='button'
                  onClick={handleConnectGoogleCalendar}
                  variant='outline'
                  size='sm'
                  className='h-8 text-xs border-amber-200 hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/20 text-amber-800 dark:text-amber-300'
                >
                  Conectar
                </Button>
              </Alert>
            )}

            {/* Informações Gerais */}
            <div className='space-y-4'>
              <div className='flex items-center gap-2 border-b border-border/50 dark:border-slate-800 pb-2'>
                <ClipboardList className='h-4 w-4 text-primary' />
                <h3 className='font-bold text-base dark:text-slate-200'>
                  Informações Gerais
                </h3>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-12 gap-4'>
                <div className='md:col-span-7 space-y-1.5'>
                  <div className='h-4 flex items-center ml-1'>
                    <label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400'>
                      Documento ({documentSearchLabel})
                    </label>
                  </div>
                  <div className='relative group'>
                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors' />
                    <Input
                      id='documentSearch'
                      value={documentSearch}
                      onChange={(e) => {
                        const cleanValue = e.target.value
                          .replace(/\D/g, '')
                          .slice(0, documentSearchMaxDigits);
                        const maskedValue =
                          clientTypeFilter === 'PF'
                            ? maskCPF(cleanValue)
                            : maskCNPJ(cleanValue);
                        setDocumentSearch(maskedValue);
                      }}
                      onBlur={handleDocumentSearchBlur}
                      placeholder={documentSearchPlaceholder}
                      className='pl-10 h-11 bg-muted/30 dark:bg-slate-900/50 border-border/50 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-sm dark:text-slate-200'
                      disabled={isSearchingClient}
                    />
                    {isSearchingClient && (
                      <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary' />
                    )}
                  </div>
                </div>

                <div className='md:col-span-5 space-y-1.5'>
                  <div className='h-4 flex items-center ml-1'>
                    <label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400'>
                      Tipo de Cliente *
                    </label>
                  </div>
                  <ClientCounters
                    activeType={clientTypeFilter}
                    onTypeClick={(type) => {
                      setClientTypeFilter(type);
                      setFormData({ ...formData, clientId: '' });
                      setClientSearchValue('');
                      setDocumentSearch('');
                    }}
                  />
                </div>

                <div className='md:col-span-8 space-y-1.5'>
                  <div className='h-4 flex items-center ml-1'>
                    <label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400'>
                      Cliente Selecionado *
                    </label>
                  </div>
                  <Popover
                    open={clientSearchOpen}
                    onOpenChange={setClientSearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant='outline'
                        className={cn(
                          'w-full justify-between h-11 bg-muted/30 dark:bg-slate-900/50 border-border/50 dark:border-slate-800 rounded-xl px-4 text-left font-medium hover:bg-muted/50 dark:hover:bg-slate-800 transition-all text-sm dark:text-slate-200',
                          formErrors.clientId && 'input-error'
                        )}
                      >
                        <span className='truncate'>
                          {formData.clientId
                            ? clients?.find((c) => c.id === formData.clientId)
                                ?.name
                            : 'Selecione um cliente da lista...'}
                        </span>
                        <ChevronsUpDown className='h-4 w-4 opacity-40 shrink-0' />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className='w-[400px] p-0 rounded-xl shadow-2xl border-border dark:border-slate-800 overflow-hidden'
                      align='start'
                    >
                      <Command className='dark:bg-slate-900'>
                        <div className='flex items-center border-b border-border dark:border-slate-800 px-3'>
                          <Search className='mr-2 h-4 w-4 opacity-40' />
                          <CommandInput
                            placeholder='Filtrar clientes...'
                            value={clientSearchValue}
                            onValueChange={setClientSearchValue}
                            className='h-11 bg-transparent'
                          />
                        </div>
                        <CommandList className='max-h-[250px] dark:bg-slate-900'>
                          <CommandEmpty className='py-4 text-center text-xs text-muted-foreground'>
                            Nenhum cliente encontrado.
                          </CommandEmpty>
                          <CommandGroup className='p-1'>
                            {filteredClients.map((client) => (
                              <CommandItem
                                key={client.id}
                                value={client.id}
                                onSelect={() => {
                                  setFormData({
                                    ...formData,
                                    clientId: client.id,
                                  });
                                  setClientSearchOpen(false);
                                }}
                                className='flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-primary/5 mb-0.5'
                              >
                                <div
                                  className={cn(
                                    'h-4 w-4 border-2 rounded-full flex items-center justify-center transition-all shrink-0',
                                    formData.clientId === client.id
                                      ? 'bg-primary border-primary'
                                      : 'border-muted-foreground/30 dark:border-slate-700'
                                  )}
                                >
                                  {formData.clientId === client.id && (
                                    <Check className='h-3 w-3 text-white' />
                                  )}
                                </div>
                                <span
                                  className={cn(
                                    'text-xs font-medium truncate',
                                    formData.clientId === client.id &&
                                      'text-primary font-bold'
                                  )}
                                >
                                  {client.name}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className='md:col-span-4 space-y-1.5'>
                  <div className='h-4 flex items-center ml-1'>
                    <label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400'>
                      Nº do Chamado
                    </label>
                  </div>
                  <Input
                    value={formData.ticketNumber || nextTicketNumber || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, ticketNumber: e.target.value })
                    }
                    placeholder='2024-0001'
                    className={cn(
                      'h-11 bg-muted/30 dark:bg-slate-900/50 border-border/50 dark:border-slate-800 rounded-xl font-mono text-base text-primary font-bold shadow-none',
                      formErrors.ticketNumber && 'input-error'
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Agendamento */}
            <div className='space-y-4'>
              <div className='flex items-center gap-2 border-b border-border/50 dark:border-slate-800 pb-2'>
                <Clock className='h-4 w-4 text-primary' />
                <h3 className='font-bold text-base dark:text-slate-200'>
                  Agendamento
                </h3>
              </div>

              <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
                <div className='lg:col-span-8 mb-4 lg:mb-0'>
                  <DateTimePicker
                    date={formData.scheduledDate}
                    time={formData.scheduledTime}
                    onDateChange={(date) => {
                      createTicketLog(
                        '[create-ticket-modal]   onDateChange chamado com:',
                        date
                      );
                      setFormData({ ...formData, scheduledDate: date });
                    }}
                    onTimeChange={(time) =>
                      setFormData({ ...formData, scheduledTime: time })
                    }
                    timeSlots={scheduleTimeSlots}
                    availableDates={availableDatesSet}
                    availableTimes={availableTimesForSelectedDate}
                    unavailableDays={unavailableDaysSet}
                    workingDays={workingDays}
                    isLoadingAvailability={isLoadingSlots}
                    error={formErrors.scheduledDate}
                    errorTime={formErrors.scheduledTime}
                    className='bg-muted/20 dark:bg-slate-900/50 border-border/50 dark:border-slate-800 rounded-2xl p-0 overflow-hidden'
                  />
                </div>

                <div className='lg:col-span-4 flex flex-col gap-4'>
                  <div className='space-y-1.5'>
                    <label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400 ml-1'>
                      Previsão de Término
                    </label>
                    <div className='grid grid-cols-1 gap-2'>
                      <div className='relative'>
                        <Calendar className='absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-50' />
                        <DateInput
                          value={formData.scheduledEndDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              scheduledEndDate: e.target.value,
                            })
                          }
                          className='pl-9 h-10 rounded-xl bg-muted/30 dark:bg-slate-900/50 text-sm border-border/50'
                        />
                      </div>
                      <div className='relative'>
                        <Clock className='absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-50' />
                        <TimeInput
                          value={formData.scheduledEndTime}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              scheduledEndTime: e.target.value,
                            })
                          }
                          className='pl-9 h-10 rounded-xl bg-muted/30 dark:bg-slate-900/50 text-sm border-border/50'
                        />
                      </div>
                    </div>
                  </div>

                  <div className='p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/10 space-y-2'>
                    <div className='flex items-center gap-2'>
                      <div className='p-1.5 bg-primary/10 rounded-lg'>
                        <Clock className='h-3.5 w-3.5 text-primary' />
                      </div>
                      <span className='text-[10px] font-black uppercase tracking-wider text-primary'>
                        Duração
                      </span>
                    </div>
                    <p className='text-xs text-muted-foreground dark:text-slate-400 font-medium leading-relaxed'>
                      Tempo estimado de{' '}
                      <strong className='text-primary'>
                        {calculatedDuration} horas
                      </strong>
                      <br />
                      <span className='text-[10px] opacity-60 italic'>
                        {(() => {
                          const client = clients?.find(
                            (c) => c.id === formData.clientId
                          );
                          return client?.type === 'EMPRESA_PARCEIRA'
                            ? 'Definido por contrato'
                            : 'Tempo padrão do sistema';
                        })()}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Serviço e Endereço */}
            <div className='space-y-4'>
              <div className='flex items-center justify-between border-b border-border/50 dark:border-slate-800 pb-2'>
                <div className='flex items-center gap-2'>
                  <MapPin className='h-4 w-4 text-primary' />
                  <h3 className='font-bold text-base dark:text-slate-200'>
                    Local e Serviço
                  </h3>
                </div>

                {(() => {
                  // Configuração Mãe: Habilitar Cálculos e Cronômetro
                  const isEnabledGlobally =
                    integrationSettings?.calculationsEnabled ?? true;
                  // Opção: Permitir escolher em cada chamado
                  const isPerTicket =
                    integrationSettings?.calculationsPerTicket ?? false;
                  // Se desativado globalmente OU não for permitido por chamado, ESCONDE o botão
                  if (!isEnabledGlobally || !isPerTicket) return false;

                  // Verificar se o tipo de cliente atual está habilitado para cálculos
                  const selectedClient = clients?.find(
                    (c) => c.id === formData.clientId
                  );
                  const clientType = selectedClient?.type || clientTypeFilter;
                  const enabledTypes =
                    integrationSettings?.calculationsClientTypes || [
                      'PF',
                      'PJ',
                      'EMPRESA_PARCEIRA',
                    ];

                  return enabledTypes.includes(clientType);
                })() && (
                  <div className='flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50'>
                    <label
                      htmlFor='calculations-toggle'
                      className='text-[10px] font-bold uppercase tracking-wider cursor-pointer'
                    >
                      Cálculos e Cronômetro
                    </label>
                    <Switch
                      id='calculations-toggle'
                      checked={formData.calculationsEnabled}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          calculationsEnabled: checked,
                        })
                      }
                      className='scale-75'
                    />
                  </div>
                )}
              </div>
              <div className='grid grid-cols-1 gap-4'>
                {clients?.find((c) => c.id === formData.clientId)?.type !==
                  'EMPRESA_PARCEIRA' && (
                  <div className='space-y-1.5'>
                    <label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400 ml-1 flex items-center gap-1'>
                      Serviço <span className='text-red-500'>*</span>
                    </label>
                    <div className='flex gap-2'>
                      <Select
                        value={formData.serviceId}
                        onValueChange={(v) =>
                          setFormData({ ...formData, serviceId: v })
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            'h-11 bg-muted/30 dark:bg-slate-900/50 border-border/50 dark:border-slate-800 rounded-xl flex-1 text-sm dark:text-slate-200 transition-all',
                            formErrors.serviceId && 'input-error'
                          )}
                        >
                          <SelectValue placeholder='Selecione o serviço...' />
                        </SelectTrigger>
                        <SelectContent className='rounded-xl shadow-xl dark:bg-slate-900 dark:border-slate-800'>
                          {services?.map((s) => (
                            <SelectItem
                              key={s.id}
                              value={s.id}
                              className='text-xs'
                            >
                              {s.name}
                              {formData.calculationsEnabled &&
                                ` - R$ ${Number(s.price).toFixed(2)}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        onClick={() => setIsCreateServiceOpen(true)}
                        className='h-11 w-11 shrink-0 rounded-xl border-primary/30 text-primary hover:bg-primary/5'
                      >
                        <Plus className='h-5 w-5' />
                      </Button>
                    </div>
                  </div>
                )}

                <div className='space-y-1.5'>
                  <label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400 ml-1'>
                    Endereço do Atendimento
                  </label>
                  <div className='relative group'>
                    <MapPin className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                    <Input
                      value={(() => {
                        const client = clients?.find(
                          (c) => c.id === formData.clientId
                        );
                        const isEmpresaParceira =
                          client?.type === 'EMPRESA_PARCEIRA';
                        return isEmpresaParceira
                          ? formData.serviceAddress || ''
                          : formData.address || '';
                      })()}
                      onChange={(e) => {
                        const client = clients?.find(
                          (c) => c.id === formData.clientId
                        );
                        const isEmpresaParceira =
                          client?.type === 'EMPRESA_PARCEIRA';
                        const value = e.target.value;
                        setFormData({
                          ...formData,
                          ...(isEmpresaParceira
                            ? { serviceAddress: value }
                            : { address: value }),
                        });
                      }}
                      placeholder='Rua, número, bairro, cidade...'
                      className={cn(
                        'pl-10 h-11 bg-muted/30 dark:bg-slate-900/50 border-border/50 dark:border-slate-800 rounded-xl text-sm dark:text-slate-200 transition-all',
                        (formErrors.serviceAddress || formErrors.address) &&
                          'input-error'
                      )}
                    />
                  </div>
                </div>

                <div className='space-y-1.5'>
                  <label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400 ml-1'>
                    Descrição Adicional
                  </label>
                  <div className='relative group'>
                    <FileText className='absolute left-3 top-4 h-4 w-4 text-muted-foreground' />
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder='Instruções, detalhes do problema, observações...'
                      className='pl-10 min-h-[100px] bg-muted/30 dark:bg-slate-900/50 border-border/50 dark:border-slate-800 rounded-xl resize-none pr-4 py-3.5 text-sm dark:text-slate-200'
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Empresa Parceira - Campos Extra */}
            {clients?.find((c) => c.id === formData.clientId)?.type ===
              'EMPRESA_PARCEIRA' &&
              formData.calculationsEnabled && (
                <div className='p-5 bg-primary/5 dark:bg-primary/5 border border-primary/10 rounded-2xl space-y-4'>
                  <div className='flex items-center gap-2'>
                    <Building2 className='h-4 w-4 text-primary' />
                    <h3 className='font-bold text-sm text-primary uppercase tracking-wide'>
                      Faturamento (Empresa Parceira)
                    </h3>
                  </div>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div className='space-y-1.5'>
                      <label className='text-[10px] font-bold uppercase text-primary/70 ml-1'>
                        Valor do Chamado (R$)
                      </label>
                      <Input
                        value={formData.ticketValue}
                        onChange={(e) =>
                          handleCurrencyChange('ticketValue', e.target.value)
                        }
                        placeholder='0,00'
                        className={cn(
                          'h-10 rounded-lg bg-background dark:bg-slate-900 border-primary/20 focus:border-primary text-sm shadow-none dark:text-slate-200 transition-all',
                          formErrors.ticketValue && 'input-error'
                        )}
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <label className='text-[10px] font-bold uppercase text-primary/70 ml-1'>
                        Hora Adicional (R$)
                      </label>
                      <Input
                        value={formData.additionalHourRate || ''}
                        onChange={(e) =>
                          handleCurrencyChange(
                            'additionalHourRate',
                            e.target.value
                          )
                        }
                        placeholder='0,00'
                        className='h-10 rounded-lg bg-background dark:bg-slate-900 border-primary/20 focus:border-primary text-sm shadow-none dark:text-slate-200'
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <label className='text-[10px] font-bold uppercase text-primary/70 ml-1'>
                        Tipo de Cobrança
                      </label>
                      <Select
                        value={formData.chargeType}
                        onValueChange={(v: any) =>
                          setFormData({ ...formData, chargeType: v })
                        }
                      >
                        <SelectTrigger className='h-10 rounded-lg bg-background dark:bg-slate-900 border-primary/20 text-xs shadow-none dark:text-slate-200'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className='rounded-xl dark:bg-slate-900 dark:border-slate-800'>
                          <SelectItem value='VALOR_FIXO' className='text-xs'>
                            Valor Fixo
                          </SelectItem>
                          <SelectItem
                            value='CHAMADO_AVULSO'
                            className='text-xs'
                          >
                            Chamado Avulso
                          </SelectItem>
                          <SelectItem value='DIARIA' className='text-xs'>
                            Diária
                          </SelectItem>
                          <SelectItem
                            value='VALOR_POR_HORA'
                            className='text-xs'
                          >
                            Valor por Hora
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='space-y-1.5'>
                      <label className='text-[10px] font-bold uppercase text-primary/70 ml-1'>
                        Aprovado por
                      </label>
                      <Input
                        value={formData.approvedBy}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            approvedBy: e.target.value,
                          })
                        }
                        className='h-10 rounded-lg bg-background dark:bg-slate-900 border-primary/20 text-sm shadow-none dark:text-slate-200'
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <label className='text-[10px] font-bold uppercase text-primary/70 ml-1'>
                        Cliente Final
                      </label>
                      <Input
                        value={formData.finalClient}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            finalClient: e.target.value,
                          })
                        }
                        placeholder='Nome do cliente final'
                        className={cn(
                          'h-10 rounded-lg bg-background dark:bg-slate-900 border-primary/20 text-sm shadow-none dark:text-slate-200 transition-all',
                          formErrors.finalClient && 'input-error'
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}
          </div>

          <div className='p-4 sm:p-5 bg-white dark:bg-slate-900 border-t border-border/50 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]'>
            <div className='flex-1 flex flex-col min-w-0 animate-in fade-in slide-in-from-left-2'>
              {formData.scheduledDate && formData.scheduledTime && (
                <>
                  <div className='flex items-center gap-2'>
                    <span className='text-[10px] font-black uppercase tracking-wider text-primary'>
                      Agendamento:
                    </span>
                    <span className='text-sm font-bold text-slate-900 dark:text-white'>
                      {(() => {
                        const [y, m, d] = formData.scheduledDate.split('-');
                        return `${d}/${m}`;
                      })()}{' '}
                      às {formData.scheduledTime}
                    </span>
                  </div>
                  {(formData.address || formData.serviceAddress) && (
                    <div className='flex items-center gap-1 opacity-70 truncate'>
                      <MapPin className='h-3 w-3 shrink-0' />
                      <span className='text-[10px] truncate'>
                        {clients?.find((c) => c.id === formData.clientId)
                          ?.type === 'EMPRESA_PARCEIRA'
                          ? formData.serviceAddress
                          : formData.address}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className='flex items-center gap-2 sm:gap-3'>
              <Button
                type='button'
                variant='ghost'
                onClick={() => onOpenChange(false)}
                className='h-9 sm:h-10 w-9 sm:w-auto px-0 sm:px-6 rounded-xl font-bold text-xs sm:text-sm dark:text-slate-400 dark:hover:text-slate-200'
              >
                <X className='h-5 w-5 sm:hidden' />
                <span className='hidden sm:inline'>Cancelar</span>
              </Button>
              <Button
                type='submit'
                disabled={createMutation.isPending}
                className='h-9 sm:h-10 w-9 sm:w-auto px-0 sm:px-8 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 text-xs sm:text-sm flex items-center justify-center gap-2'
              >
                {createMutation.isPending ? (
                  <Loader2 className='w-4 h-4 animate-spin' />
                ) : (
                  <>
                    <Check className='h-5 w-5 sm:hidden' />
                    <span className='hidden sm:inline'>Criar Chamado</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>

      {/* Modal de Criação de Serviço */}
      <Dialog open={isCreateServiceOpen} onOpenChange={setIsCreateServiceOpen}>
        <DialogContent className='max-w-md rounded-3xl p-8'>
          <DialogHeader className='mb-6'>
            <DialogTitle className='text-xl font-black'>
              // Novo Serviço
            </DialogTitle>
            <DialogDescription>
              Cadastre um serviço que ainda não está na sua lista.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createServiceMutation.mutate(newServiceData);
            }}
            className='space-y-5'
          >
            <div className='space-y-2'>
              <label className='text-xs font-bold uppercase text-muted-foreground'>
                Nome do Serviço *
              </label>
              <Input
                value={newServiceData.name}
                onChange={(e) =>
                  setNewServiceData({ ...newServiceData, name: e.target.value })
                }
                placeholder='Ex: Reparo de Placa'
                className='h-12 rounded-xl bg-muted/30'
                required
              />
            </div>
            <div className='space-y-2'>
              <label className='text-xs font-bold uppercase text-muted-foreground'>
                Preço sugerido (R$)
              </label>
              <Input
                value={newServiceData.price}
                onChange={(e) =>
                  setNewServiceData({
                    ...newServiceData,
                    price: maskCurrency(e.target.value),
                  })
                }
                placeholder='0,00'
                className='h-12 rounded-xl bg-muted/30'
              />
            </div>
            <div className='flex gap-3 pt-4'>
              <Button
                type='button'
                variant='ghost'
                onClick={() => setIsCreateServiceOpen(false)}
                className='flex-1 rounded-xl'
              >
                Cancelar
              </Button>
              <Button
                type='submit'
                disabled={createServiceMutation.isPending}
                className='flex-1 rounded-xl bg-primary text-white'
              >
                Criar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}