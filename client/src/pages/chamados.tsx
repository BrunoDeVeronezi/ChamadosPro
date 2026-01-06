import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useSearch } from 'wouter';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateInput, TimeInput } from '@/components/ui/date-time-input';
import { Card } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTimeSlotsForDate, type WorkingHoursConfig } from '@/lib/working-hours';
import {
  resolveGoogleCalendarConnected,
  resolveGoogleCalendarEnabled,
} from '@/lib/google-calendar';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { generateReceiptPDF } from '@/utils/receipt-pdf-generator';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Plus,
  PlusCircle,
  Briefcase,
  Search,
  SearchX,
  Clock,
  Loader2,
  ChevronsUpDown,
  Check,
  ClipboardList,
  FileText,
  Image,
  FileCode,
  X,
  Copy,
  Navigation,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Link2,
  MapPin,
  Ticket as TicketIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TicketCompleteDialog } from '@/components/ticket-complete-dialog';
import { ReceiptPreviewDialog } from '@/components/receipt-preview-dialog';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  maskCurrency,
  unmaskCurrency,
  maskCPF,
  maskCNPJ,
  maskPhone,
  unmaskCPF,
  unmaskCNPJ,
  unmaskPhone,
} from '@/lib/masks';
import { TicketList } from '@/components/ticket-list';
import { User, Building2 } from 'lucide-react';
import { ImageUploadButton } from '@/components/image-upload-button';
import { OCRParser } from '@/utils/OCRParser';
import { fetchCpfData } from '@/services/CpfService';
import { fetchCnpjData } from '@/services/CnpjService';
import { maskCEP, unmaskCEP } from '@/lib/masks';
import { buildServiceSummary } from '@/utils/service-items';
import { fetchCepData } from '@/services/CepService';

interface Client {
  id: string;
  name: string;
  type: 'PF' | 'PJ' | 'EMPRESA_PARCEIRA';
  document: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  address?: string; // Endereço do cliente (PF e PJ Cliente Final)
  neighborhood?: string; // Bairro do cliente
  ratTemplateId?: string;
  // Campos adicionais para PJ e EMPRESA_PARCEIRA
  legalName?: string;
  municipalRegistration?: string;
  stateRegistration?: string;
  zipCode?: string;
  streetAddress?: string;
  addressNumber?: string;
  addressComplement?: string;
  // EMPRESA_PARCEIRA default values
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

interface ServiceOrderTemplate {
  id: string;
  name: string;
}

interface GoogleEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  calendarId: string;
  allDay?: boolean;
}

interface Ticket {
  id: string;
  clientId: string;
  serviceId: string; // Opcional para EMPRESA_PARCEIRA
  scheduledFor: string;
  duration: number; // Pode ser opcional em alguns casos
  status: 'ABERTO' | 'INICIADO' | 'CONCLUÍDO' | 'CANCELADO' | 'no-show';
  description: string;
  client: Client;
  service: Service;
  startedAt: string;
  stoppedAt: string;
  elapsedSeconds: number;
  kmTotal: number;
  extraExpenses: number;
  expenseDetails: string;
  // EMPRESA_PARCEIRA specific fields
  ticketNumber: string;
  finalClient: string;
  ticketValue: string;
  chargeType: 'DIARIA' | 'CHAMADO_AVULSO' | 'VALOR_FIXO' | 'VALOR_POR_HORA';
  approvedBy: string;
  kmRate: string;
  additionalHourRate?: string;
  serviceAddress: string;
  scheduledEndDate: string;
  scheduledEndTime: string;
  address?: string;
  city?: string;
  state?: string;
  dueDate?: string;
  paymentDate?: string;
}

const STATUS_ALL = 'ALL';
const STATUS_MAP: Record<string, string> = {
  // ABERTO: 'ABERTO',
  // INICIADO: 'INICIADO',
  // EXECUCAO: 'INICIADO', // Compatibilidade
  // CONCLUÍDO: 'CONCLUÍDO',
  // CONCLUIDO: 'CONCLUÍDO', // Compatibilidade
  // CANCELADO: 'CANCELADO',
  // CANCELLED: 'CANCELADO', // Compatibilidade
  'NO-SHOW': 'NO_SHOW',
  // NO_SHOW: 'NO_SHOW',
  cancelled: 'CANCELLED',
  'no-show': 'NO_SHOW',
  'in-progress': 'EXECUCAO',
  pending: 'ABERTO',
  completed: 'CONCLUIDO',
};

const normalizeStatus = (status: any): string => {
  if (!status) return 'ABERTO';
  const s = status.toString().toUpperCase().trim();
  return STATUS_MAP[s] || s;
};

import { useSocket } from '@/hooks/use-socket';

const INITIAL_FORM_DATA = {
  clientId: '',
  serviceId: '',
  scheduledDate: '',
  scheduledTime: '',
  duration: 3,
  description: '',
  address: '', // Endereço editável (preenchido do cliente, mas pode ser editado)
  city: '', // Cidade
  state: '', // Estado
  // EMPRESA_PARCEIRA-specific fields
  ticketNumber: '',
  finalClient: '',
  ticketValue: '',
  chargeType: 'VALOR_FIXO' as
    | 'DIARIA'
    | 'CHAMADO_AVULSO'
    | 'VALOR_FIXO'
    | 'VALOR_POR_HORA',
  approvedBy: 'Nome do analista',
  kmRate: '',
  additionalHourRate: '',
  serviceAddress: '',
  dueDate: '', // Data de vencimento
  paymentDate: '', // Data de pagamento
  calculationsEnabled: true,
};

const INITIAL_NEW_CLIENT_DATA = {
  name: '',
  type: 'PF' as 'PF' | 'PJ' | 'EMPRESA_PARCEIRA',
  document: '',
  email: '',
  phone: '',
  // logoUrl: '',
  address: '',
  city: '',
  state: '',
  ratTemplateId: '',
  // EMPRESA_PARCEIRA specific fields
  legalName: '',
  municipalRegistration: '',
  stateRegistration: '',
  zipCode: '',
  streetAddress: '',
  addressNumber: '',
  addressComplement: '',
  neighborhood: '',
  paymentCycleStartDay: 1,
  paymentCycleEndDay: 30,
  paymentDueDay: 5,
  defaultTicketValue: '120,00',
  defaultHoursIncluded: 3,
  defaultKmRate: '1,00',
  defaultAdditionalHourRate: '20,00',
  monthlySpreadsheet: false,
  spreadsheetEmail: '',
  spreadsheetDay: 1,
};

export default function Chamados() {
  // Habilitar atualizações em tempo real
  useSocket();

  const { toast } = useToast();
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Inicializar filtro com STATUS_ALL, será atualizado pelo useEffect
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [deletingTicket, setDeletingTicket] = useState<Ticket | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCancelClientConfirm, setShowCancelClientConfirm] = useState(false);
  const [completingTicket, setCompletingTicket] = useState<Ticket | null>(null);
  const [receiptData, setReceiptPreviewData] = useState<any>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Reset form and scroll to top when modal opens for creation
  useEffect(() => {
    if (isCreateOpen && !editingTicket && !isRescheduling) {
      setFormData(INITIAL_FORM_DATA);
      setSelectedDate(undefined);
      setSelectedTime('');
      setSchedulingStep('calendar');
      setClientTypeFilter('PF');
      setClientSearchValue('');
      setDocumentSearch('');
      setRawTicketText('');

      // Scroll to top after a small delay
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }, 50);
    }
  }, [isCreateOpen, editingTicket, isRescheduling]);

  // Estados para seleção de data e horário fixa
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [schedulingStep, setSchedulingStep] = useState<'calendar' | 'time'>(
    'calendar'
  );

  // Client selection states
  const [clientTypeFilter, setClientTypeFilter] = useState<
    'PF' | 'PJ' | 'EMPRESA_PARCEIRA'
  >('PF');
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchValue, setClientSearchValue] = useState('');
  const [documentSearch, setDocumentSearch] = useState('');
  const documentSearchLabel = clientTypeFilter === 'PF' ? 'CPF' : 'CNPJ';
  const documentSearchMaxDigits = clientTypeFilter === 'PF' ? 11 : 14;
  const documentSearchPlaceholder =
    clientTypeFilter === 'PF'
      ? 'Digite o CPF para preencher...'
      : 'Digite o CNPJ para preencher...';
  const [isSearchingClient, setIsSearchingClient] = useState(false);

  // New client modal states
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [newClientData, setNewClientData] = useState(
    INITIAL_NEW_CLIENT_DATA
  );
  const [newClientErrors, setNewClientErrors] = useState<
    Record<string, boolean>
  >({});
  const [showNewClientFields, setShowNewClientFields] = useState(false); // Campos aparecem ao sair do CPF/CNPJ
  const [showNewClientTypeModal, setShowNewClientTypeModal] = useState(false); // Modal para escolher PJ ou EMPRESA_PARCEIRA
  const [, setNewClientActiveTab] = useState<
    'PF' | 'PJ' | 'EMPRESA_PARCEIRA'
  >('PF');
  const [existingNewClient, setExistingNewClient] = useState<Client | null>(
    null
  );
  const [, setNewClientDocumentType] = useState<
    'CPF' | 'CNPJ' | null
  >(null);
  const newClientTypeModalOpenedForDocument = useRef<string | null>(null);
  const isOpeningNewClientTypeModal = useRef<boolean>(false);
  const [isCheckingNewClient, setIsCheckingNewClient] = useState(false); // Verificando se cliente existe
  const [isLoadingNewClientCnpj, setIsLoadingNewClientCnpj] = useState(false);
  const lastNewClientCnpjRef = useRef<string | null>(null);

  /**
   * Estado para captura automática de dados do chamado
   *
   * Permite que o usuário cole um texto estruturado com informações do chamado
   * e preencha automaticamente os campos do formulário.
   *
   * @see parseTicketText() - Função que processa o texto e extrai os dados
   * @see CAPTURA_AUTOMATICA_DADOS.md - Documentação completa da funcionalidade
   */
  const [rawTicketText, setRawTicketText] = useState('');

  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  const { data: tickets, isLoading: ticketsLoading } = useQuery<Ticket[]>({
    queryKey: ['/api/tickets'],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['/api/services'],
  });

  const { data: serviceOrderTemplates = [] } = useQuery<
    ServiceOrderTemplate[]
  >({
    queryKey: ['/api/service-order-templates'],
    staleTime: 5 * 60 * 1000,
  });

  // Buscar configurações de integração para verificar Google Calendar
  const { data: integrationSettings } = useQuery<{
    googleCalendarStatus?: string;
    googleCalendarEmail?: string;
    googleCalendarEnabled?: boolean;
    googleCalendarId?: string;
    workingDays?: number[];
    workingHours?: WorkingHoursConfig | string[];
    calculationsEnabled?: boolean;
    calculationsPerTicket?: boolean;
    calculationsClientTypes?: string[];
  }>({
    queryKey: ['/api/integration-settings'],
  });

  const googleCalendarEnabled = resolveGoogleCalendarEnabled(
    integrationSettings
  );
  const isGoogleCalendarAccountConnected = resolveGoogleCalendarConnected(
    integrationSettings
  );
  const isGoogleCalendarConnected =
    isGoogleCalendarAccountConnected && googleCalendarEnabled;

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

  const startGoogleCalendarConnection = async () => {
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

    if (!isGoogleCalendarAccountConnected) {
      await startGoogleCalendarConnection();
    }
  };

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

  // Buscar horários disponíveis quando Google Calendar estiver conectado
  const isSchedulingOpen = isCreateOpen || !!editingTicket || isRescheduling;

  const selectedDayRange = useMemo(() => {
    if (!selectedDate) return null;
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [selectedDate]);

  const { data: googleEvents } = useQuery<GoogleEvent[]>({
    queryKey: [
      '/api/google-calendar/events',
      (selectedDate ?? currentMonth).toISOString(),
    ],
    queryFn: async () => {
      try {
        const baseDate = selectedDate ?? currentMonth;
        const rangeStart = startOfMonth(subMonths(baseDate, 1));
        const rangeEnd = endOfMonth(addMonths(baseDate, 2));
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd.setHours(23, 59, 59, 999);

        const response = await fetch(
          `/api/google-calendar/events?timeMin=${rangeStart.toISOString()}&timeMax=${rangeEnd.toISOString()}`,
          { credentials: 'include' }
        );

        if (!response.ok) {
          console.error('[chamados] Failed to fetch Google Calendar events', {
            status: response.status,
            statusText: response.statusText,
          });
          return [];
        }
        return response.json();
      } catch (error) {
        console.error('[chamados] Error fetching Google Calendar events', error);
        return [];
      }
    },
    enabled:
      isSchedulingOpen &&
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

  const [availableSlots, setAvailableSlots] = useState<
    Array<{ date: string; time: string; datetime: string }>
  >([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [availableSlotsError, setAvailableSlotsError] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (
      !isSchedulingOpen ||
      !selectedDayRange
    ) {
      setAvailableSlots([]);
      setAvailableSlotsError(null);
      setIsLoadingSlots(false);
      return;
    }

    let cancelled = false;

    const loadAvailableSlots = async () => {
      setIsLoadingSlots(true);
      setAvailableSlotsError(null);
      try {
        const params = new URLSearchParams({
          startDate: selectedDayRange.start.toISOString(),
          endDate: selectedDayRange.end.toISOString(),
          ...(formData.serviceId ? { serviceId: formData.serviceId } : {}),
        });
        const response = await apiRequest(
          'GET',
          `/api/tickets/available-slots?${params.toString()}`,
          undefined
        );
        const data = await response.json();
        if (!cancelled) {
          const slots = Array.isArray(data?.slots) ? data.slots : [];
          if (!Array.isArray(data?.slots)) {
            console.error('[chamados] Invalid available-slots payload', {
              data,
            });
          }
          if (slots.length === 0) {
            console.warn('[chamados] No available slots returned', {
              serviceId: formData.serviceId || null,
              startDate: selectedDayRange.start.toISOString(),
              endDate: selectedDayRange.end.toISOString(),
            });
          }
          setAvailableSlots(slots);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('[chamados] Failed to load available slots', {
            error: err,
            serviceId: formData.serviceId || null,
            startDate: selectedDayRange.start.toISOString(),
            endDate: selectedDayRange.end.toISOString(),
          });
          setAvailableSlots([]);
          setAvailableSlotsError(
            err?.message || 'Erro ao carregar horarios'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSlots(false);
        }
      }
    };

    loadAvailableSlots();

    return () => {
      cancelled = true;
    };
  }, [
    isSchedulingOpen,
    selectedDayRange,
    formData.serviceId,
  ]);

  // Criar um Set de datas disponíveis para desabilitar dias sem horários
  const unavailableDaysSet = useMemo(() => {
    if (
      !isGoogleCalendarConnected ||
      filteredGoogleEvents.length === 0 ||
      !googleCalendarEnabled
    ) {
      return new Set<string>();
    }

    const unavailable = new Set<string>();

    filteredGoogleEvents.forEach((event) => {
      if (!event?.start || !event?.end) return;
      const isAllDay =
        event.allDay ||
        (!event.start.includes('T') && !event.end.includes('T'));
      if (!isAllDay) return;

      const startDate = new Date(event.start);
      const endDate = new Date(event.end);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

      const currentDate = new Date(startDate);
      currentDate.setHours(0, 0, 0, 0);

      while (currentDate < endDate) {
        unavailable.add(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    return unavailable;
  }, [filteredGoogleEvents, isGoogleCalendarConnected, integrationSettings]);

  // Verifica se um horario conflita com eventos do Google Calendar
  const isTimeSlotUnavailable = (
    date: Date | undefined,
    time: string
  ): boolean => {
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
      if (!event?.start || !event?.end) return false;

      if (
        event.allDay ||
        (!event.start.includes('T') && !event.end.includes('T'))
      ) {
        const [year, month, day] = event.start.split('-').map(Number);
        if (!year || !month || !day) return false;
        const eventDate = new Date(year, month - 1, day);
        const eventDateStr = format(eventDate, 'yyyy-MM-dd');
        return eventDateStr === dateStr;
      }

      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) {
        return false;
      }

      const eventStartDateStr = format(eventStart, 'yyyy-MM-dd');
      if (eventStartDateStr !== dateStr) {
        return false;
      }

      const eventStartTotalMinutes =
        eventStart.getHours() * 60 + eventStart.getMinutes();
      const eventEndTotalMinutes =
        eventEnd.getHours() * 60 + eventEnd.getMinutes();

      return (
        slotTotalMinutes >= eventStartTotalMinutes &&
        slotTotalMinutes <= eventEndTotalMinutes
      );
    });
  };

  // Criar um Set de horarios disponiveis para a data selecionada
  const availableTimesForSelectedDate = useMemo(() => {
    if (!selectedDate || availableSlots.length === 0) {
      return [];
    }
    const dateStr = selectedDate.toISOString().split('T')[0];
    const times = availableSlots
      .filter((slot) => slot.date === dateStr)
      .map((slot) => slot.time)
      .filter((time) => !isTimeSlotUnavailable(selectedDate, time))
      .sort();
    return times;
  }, [
    selectedDate,
    availableSlots,
    isTimeSlotUnavailable,
  ]);
  const selectedDateLabel = useMemo(() => {
    if (!selectedDate || Number.isNaN(selectedDate.getTime())) return '';
    const datePart = format(selectedDate, 'dd/MM/yyyy', { locale: ptBR });
    const dayPart = format(selectedDate, 'EEEE', { locale: ptBR })
      .replace(/-/g, ' ')
      .split(' ')
      .map((word) =>
        word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : ''
      )
      .join(' ');
    return `${datePart} ${dayPart}`;
  }, [selectedDate]);

  // Buscar próximo número de chamado quando abrir o formulário
 // Correcao: adicionar staleTime para evitar cache incorreto.
  const { data: nextTicketNumber } = useQuery<string>({
    queryKey: ['/api/tickets/next-number'],
    enabled: isCreateOpen && !editingTicket,
    staleTime: 0, // Sempre considerar obsoleto para buscar número atualizado
    gcTime: 0, // Não cachear para garantir número sempre atualizado
  });

  // Verificar parâmetros da URL para abrir edição ou criação com data pré-selecionada
  useEffect(() => {
    const params = new URLSearchParams(search || '');
    const editId = params.get('edit');
    const dateParam = params.get('date');

    if (editId && tickets && !editingTicket) {
      const ticketToEdit = tickets.find((t) => t.id === editId);
      if (ticketToEdit) {
        handleEdit(ticketToEdit);
        // Limpar apenas o parâmetro edit, mantendo outros se houver
        const newParams = new URLSearchParams(params);
        newParams.delete('edit');
        const newUrl = newParams.toString() ? `/chamados?${newParams.toString()}` : '/chamados';
        setLocation(newUrl);
      }
    }

    if (dateParam && !isCreateOpen && !editingTicket) {
      const selectedDate = new Date(dateParam);
      if (!isNaN(selectedDate.getTime())) {
        setSelectedDate(selectedDate);
        setIsCreateOpen(true);
        // Limpar parâmetro date
        const newParams = new URLSearchParams(params);
        newParams.delete('date');
        const newUrl = newParams.toString() ? `/chamados?${newParams.toString()}` : '/chamados';
        setLocation(newUrl);
      }
    }
  }, [search, tickets, editingTicket, isCreateOpen, setLocation]);

  // Verificar se há parâmetro de reagendamento na URL
  useEffect(() => {
    const params = new URLSearchParams(search || '');
    const rescheduleId = params.get('reschedule');
    if (rescheduleId && tickets) {
      const ticketToReschedule = tickets.find((t) => t.id === rescheduleId);
      if (ticketToReschedule) {
        handleReschedule(ticketToReschedule);
        // Limpar parâmetro da URL
        setLocation('/chamados');
      }
    }
  }, [search, tickets, setLocation]);

  // Verificar parâmetro de status na URL para aplicar filtro quando a URL mudar
  useEffect(() => {
    const params = new URLSearchParams(search || '');
    const statusParam = params.get('status');

    if (statusParam) {
      const normalizedStatus = statusParam.toUpperCase();
      // Verificar se o status está no mapa de status válidos ou é ALL
      if (normalizedStatus in STATUS_MAP || normalizedStatus === STATUS_ALL) {
        // Sempre atualizar o filtro quando houver parâmetro na URL
        setStatusFilter(normalizedStatus);
      }
    } else {
      // Se não há parâmetro status na URL, usar ALL
      setStatusFilter(STATUS_ALL);
    }
  }, [search]);

  // Verificar se há parâmetro clientId na URL para pré-preencher formulário
  useEffect(() => {
    const params = new URLSearchParams(search || '');
    const clientId = params.get('clientId');
    const isModal = params.get('modal') === 'true';

    if (clientId && clients && !isCreateOpen) {
      const selectedClient = clients.find((c) => c.id === clientId);
      if (selectedClient) {
        // Pré-preencher o formulário com os dados do cliente
        setFormData((prev) => ({
          ...prev,
          clientId: selectedClient.id,
          // Preencher endereço do cliente se disponível
          address:
            selectedClient.address ||
            (selectedClient as any).streetAddress ||
            '',
        }));
        // Abrir o modal de criação
        setIsCreateOpen(true);
        // Limpar parâmetro da URL apenas se não for modal
        if (!isModal) {
          const newParams = new URLSearchParams(params);
          newParams.delete('clientId');
          const newUrl = newParams.toString()
            ? `/chamados?${newParams.toString()}`
            : '/chamados';
          setLocation(newUrl);
        }
      }
    }
  }, [search, clients, isCreateOpen, setLocation]);

  // Contadores de clientes por tipo (para usar nos botões neon de filtro)
  const clientCounts = useMemo(
    () => ({
      // PF: (clients?.filter((c) => c.type === 'PF') || []).length,
      // PJ: (clients?.filter((c) => c.type === 'PJ') || []).length,
      EMPRESA_PARCEIRA: (
        clients?.filter((c) => c.type === 'EMPRESA_PARCEIRA') || []
      ).length,
    }),
    [clients]
  );

  type ClientTypeKey = 'PF' | 'PJ' | 'EMPRESA_PARCEIRA';

  const ClientCounters = ({
    className = '',
    activeType,
    onTypeClick,
  }: {
    className?: string;
    activeType?: ClientTypeKey;
    onTypeClick?: (type: ClientTypeKey) => void;
  }) => (
    <div
      className={`flex flex-wrap gap-3 justify-center sm:justify-start ${className}`}
    >
      {/* PF */}
      <button
        type='button'
        onClick={onTypeClick ? () => onTypeClick('PF') : undefined}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-left text-xs transition-all duration-150 shadow-sm ${
          activeType === 'PF'
            ? 'border-blue-400 bg-blue-500/40 dark:bg-blue-500/40 bg-blue-500/60 shadow-blue-400/60 translate-y-0'
            : 'border-blue-400 bg-blue-400/10 dark:bg-blue-400/10 bg-blue-50 shadow-blue-400/30 hover:bg-blue-500/20 dark:hover:bg-blue-500/20 hover:bg-blue-100 hover:-translate-y-0.5'
        } ${onTypeClick ? 'cursor-pointer' : ''}`}
      >
        <User className='h-3 w-3 text-blue-200 dark:text-blue-200 text-blue-700' />
        <span className='text-[11px] font-medium text-muted-foreground dark:text-muted-foreground text-blue-900'>
          PF
        </span>
        <span className='text-sm font-bold text-blue-200 dark:text-blue-200 text-blue-700'>
          {clientCounts.PF}
        </span>
        <span className='text-[10px] text-muted-foreground dark:text-muted-foreground text-blue-800'>
          {clientCounts.PF === 1 ? 'cliente' : 'clientes'}
        </span>
      </button>

      {/* PJ */}
      <button
        type='button'
        onClick={onTypeClick ? () => onTypeClick('PJ') : undefined}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-left text-xs transition-all duration-150 shadow-sm ${
          activeType === 'PJ'
            ? 'border-purple-400 bg-purple-500/40 dark:bg-purple-500/40 bg-purple-500/60 shadow-purple-400/60 translate-y-0'
            : 'border-purple-400 bg-purple-400/10 dark:bg-purple-400/10 bg-purple-50 shadow-purple-400/30 hover:bg-purple-500/20 dark:hover:bg-purple-500/20 hover:bg-purple-100 hover:-translate-y-0.5'
        } ${onTypeClick ? 'cursor-pointer' : ''}`}
      >
        <Building2 className='h-3 w-3 text-purple-200 dark:text-purple-200 text-purple-700' />
        <span className='text-[11px] font-medium text-muted-foreground dark:text-muted-foreground text-purple-900'>
          PJ
        </span>
        <span className='text-sm font-bold text-purple-200 dark:text-purple-200 text-purple-700'>
          {clientCounts.PJ}
        </span>
        <span className='text-[10px] text-muted-foreground dark:text-muted-foreground text-purple-800'>
          {clientCounts.PJ === 1 ? 'cliente' : 'clientes'}
        </span>
      </button>

      {/* PJ P */}
      <button
        type='button'
        onClick={
          onTypeClick ? () => onTypeClick('EMPRESA_PARCEIRA') : undefined
        }
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-left text-xs transition-all duration-150 shadow-sm ${
          activeType === 'EMPRESA_PARCEIRA'
            ? 'border-green-400 bg-green-500/40 dark:bg-green-500/40 bg-green-500/60 shadow-green-400/60 translate-y-0'
            : 'border-green-400 bg-green-400/10 dark:bg-green-400/10 bg-green-50 shadow-green-400/30 hover:bg-green-500/20 dark:hover:bg-green-500/20 hover:bg-green-100 hover:-translate-y-0.5'
        } ${onTypeClick ? 'cursor-pointer' : ''}`}
      >
        <Building2 className='h-3 w-3 text-green-200 dark:text-green-200 text-green-700' />
        <span className='text-[11px] font-medium text-muted-foreground dark:text-muted-foreground text-green-900'>
          PJ P
        </span>
        <span className='text-sm font-bold text-green-200 dark:text-green-200 text-green-700'>
          {clientCounts.EMPRESA_PARCEIRA}
        </span>
        <span className='text-[10px] text-muted-foreground dark:text-muted-foreground text-green-800'>
          {clientCounts.EMPRESA_PARCEIRA === 1 ? 'cliente' : 'clientes'}
        </span>
      </button>
    </div>
  );

  // Filter clients by type and search term
  const filteredClients = useMemo(() => {
    if (!clients) return [];

    return clients.filter((client) => {
      // Filter by type
      const matchesType = client.type === clientTypeFilter;

      // Filter by search term
      const matchesSearch =
        clientSearchValue === '' ||
        client.name.toLowerCase().includes(clientSearchValue.toLowerCase());

      return matchesType && matchesSearch;
    });
  }, [clients, clientTypeFilter, clientSearchValue]);

  // Auto-fill EMPRESA_PARCEIRA default values and address when client is selected
  useEffect(() => {
    if (formData.clientId && clients) {
      const selectedClient = clients.find((c) => c.id === formData.clientId);

      if (selectedClient?.type === 'EMPRESA_PARCEIRA') {
        // Format default values from client
        const formatDefaultValue = (value: string | undefined): string => {
          if (!value) return '';
          const numValue = parseFloat(value);
          if (isNaN(numValue)) return '';
          return numValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        };

        // Auto-fill with formatted default values from client
        setFormData((prev) => ({
          ...prev,
          // Preencher ticketNumber automaticamente se estiver vazio e nextTicketNumber estiver disponível
          ticketNumber: (
            prev.ticketNumber ||
            nextTicketNumber ||
            ''
          ).toString(),
          ticketValue:
            formatDefaultValue(selectedClient.defaultTicketValue) ||
            prev.ticketValue,
          kmRate:
            formatDefaultValue(selectedClient.defaultKmRate) || prev.kmRate,
        }));
      } else if (
        selectedClient &&
        (selectedClient.type === 'PF' || selectedClient.type === 'PJ')
      ) {
        // Para PF e PJ, preencher endereço automaticamente (mas pode ser editado depois)
        const clientAddress = selectedClient.address || '';
        const fullAddress = [
          clientAddress,
          selectedClient.neighborhood || '',
          selectedClient.city || '',
          selectedClient.state || '',
        ]
          .filter(Boolean)
          .join(', ');

        setFormData((prev) => ({
          ...prev,
          address: fullAddress || clientAddress, // Preencher, mas pode ser editado
        }));
      }
    }
  }, [formData.clientId, clients, nextTicketNumber]);

  // Função para buscar cliente ao sair do campo CPF/CNPJ (onBlur)
  const handleDocumentSearchBlur = async () => {
    if (!documentSearch.trim()) {
      return;
    }

    // Remove formatação
    const cleanDocument = documentSearch.replace(/\D/g, '');

    // Valida se tem tamanho suficiente (CPF: 11, CNPJ: 14)
    if (cleanDocument.length !== documentSearchMaxDigits) {
      return;
    }

    setIsSearchingClient(true);
    try {
      const foundClient = await searchClientByDocument(cleanDocument);

      if (foundClient && foundClient.id) {
        // Garantir que o cliente tenha nome (fallback)
        const clientName = foundClient.name || 'Cliente sem nome';

        // Define tipo e cliente
        const clientType =
          foundClient.type === 'EMPRESA_PARCEIRA'
            ? 'EMPRESA_PARCEIRA'
            : foundClient.type === 'PJ'
            ? 'PJ'
            : 'PF';

        // Invalidar cache de clientes para garantir que a lista esteja atualizada
        queryClient.invalidateQueries({ queryKey: ['/api/clients'] });

        // Primeiro define o tipo para filtrar a lista corretamente
        setClientTypeFilter(clientType);

        // Depois define o cliente (usar setTimeout para garantir que o filtro foi aplicado)
        setTimeout(() => {
          setFormData((prev) => ({
            ...prev,
            clientId: foundClient.id,
          }));
          setClientSearchOpen(false);

          // Limpar campo de busca após encontrar o cliente
          setDocumentSearch('');
        }, 100);

        const typeLabel =
          clientType === 'PF'
            ? 'Pessoa Física'
            : clientType === 'PJ'
            ? 'Pessoa Jurídica'
            : 'Empresa Parceira';

        toast({
          title: 'Cliente encontrado!',
          description: `Cliente "${clientName}" selecionado automaticamente (${typeLabel}).`,
        });
      } else {
        toast({
          title: 'Cliente não encontrado',
          description:
            'Nenhum cliente cadastrado com este documento. Selecione manualmente ou cadastre um novo cliente.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
    } finally {
      setIsSearchingClient(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/tickets', data);
    },
    onSuccess: async () => {
      // Invalidar queries para marcar como desatualizadas
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
 // Correcao: invalidar query do proximo numero para gerar novo numero.
      queryClient.invalidateQueries({ queryKey: ['/api/tickets/next-number'] });

      // Recarregar imediatamente a lista de chamados para aparecer dinamicamente
      await queryClient.refetchQueries({ queryKey: ['/api/tickets'] });

      setIsCreateOpen(false);
      setIsRescheduling(false);
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest('PATCH', `/api/tickets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setEditingTicket(null);
      setIsRescheduling(false);
      resetForm();
      toast({
        title: 'Chamado atualizado',
        description: 'As alterações foram salvas com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar chamado',
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/tickets/${id}`, undefined);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

 // LIMPEZA ADICIONAL: Limpar ticket excluído do localStorage para remover o banner
      try {
        const ACTIVE_TICKETS_STORAGE_KEY = 'active_tickets_startedAt';
        const storedJson = localStorage.getItem(ACTIVE_TICKETS_STORAGE_KEY);
        if (storedJson) {
          const stored = JSON.parse(storedJson);
          if (stored[deletedId]) {
            delete stored[deletedId];
            localStorage.setItem(
              ACTIVE_TICKETS_STORAGE_KEY,
              JSON.stringify(stored)
            );
            // Disparar evento de storage para que o banner saiba da mudança
            window.dispatchEvent(new Event('storage'));
          }
        }
      } catch (e) {
        console.warn('Erro ao limpar localStorage após exclusão:', e);
      }

      setDeletingTicket(null);
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

  const resetNewClientForm = (
    nextType: 'PF' | 'PJ' | 'EMPRESA_PARCEIRA' = 'PF'
  ) => {
    const shouldShowFields = nextType === 'PF';
    setNewClientData({ ...INITIAL_NEW_CLIENT_DATA, type: nextType });
    setNewClientErrors({});
    setShowNewClientFields(shouldShowFields);
    setShowNewClientTypeModal(false);
    setNewClientActiveTab(nextType);
    setExistingNewClient(null);
    setNewClientDocumentType(null);
    setIsLoadingNewClientCnpj(false);
    newClientTypeModalOpenedForDocument.current = null;
    isOpeningNewClientTypeModal.current = false;
    lastNewClientCnpjRef.current = null;
  };

  const createClientMutation = useMutation<Client, Error, typeof newClientData>(
    {
      mutationFn: async (data) => {
        const res = await apiRequest('POST', '/api/clients', data);
        return await res.json();
      },
      onSuccess: (newClient) => {
        queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
        setIsNewClientOpen(false);
        // Auto-select the new client
        setFormData((prev) => ({ ...prev, clientId: newClient.id }));
        resetNewClientForm();
        toast({
          title: 'Cliente criado',
          description:
            'O cliente foi cadastrado e selecionado automaticamente.',
        });
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Erro ao criar cliente',
          description: error.message,
        });
      },
    }
  );

  // Função para buscar dados do CNPJ e preencher campos
  const fetchAndFillNewClientCnpjData = async (
    cnpj: string
  ): Promise<boolean> => {
    const cleanCnpj = unmaskCNPJ(cnpj);

    if (cleanCnpj.length !== 14) {
      return false;
    }

    try {
      const data = await fetchCnpjData(cleanCnpj);

      if (data) {
        console.log('[CNPJ API] Dados recebidos:', {
          email: data.email,
          complemento: data.complemento,
          qsa: data.qsa,
        });

        setNewClientData((prev) => {
          const updated = { ...prev };

          if (
            data.razao_social &&
            (!prev.legalName || prev.legalName.trim() === '')
          ) {
            updated.legalName = data.razao_social;
          }

          if (!prev.name || prev.name.trim() === '') {
            const fantasia = data.nome_fantasia?.trim();
            const razao = data.razao_social?.trim();

            if (fantasia) {
              updated.name = fantasia;
            } else if (razao) {
              updated.name = razao;
            } else {
              updated.name = 'N/C';
            }
          }

          if (data.cep && (!prev.zipCode || prev.zipCode.trim() === '')) {
            updated.zipCode = maskCEP(data.cep);
          }

          if (data.complemento) {
            const complementoValue = String(data.complemento).trim();
            if (
              complementoValue &&
              (!prev.addressComplement || prev.addressComplement.trim() === '')
            ) {
              updated.addressComplement = complementoValue;
              console.log('[CNPJ API] Complemento preenchido:', complementoValue);
            }
          }

          if (
            data.numero &&
            (!prev.addressNumber || prev.addressNumber.trim() === '')
          ) {
            updated.addressNumber = data.numero;
          }

          if (data.ddd_telefone_1 && (!prev.phone || prev.phone.trim() === '')) {
            let phoneValue = data.ddd_telefone_1;
            if (!phoneValue.includes('(') && !phoneValue.includes(')')) {
              const phoneDigits = phoneValue.replace(/\D/g, '');
              if (phoneDigits.length >= 10) {
                const ddd = phoneDigits.slice(0, 2);
                const number = phoneDigits.slice(2);
                if (number.length === 8) {
                  phoneValue = `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
                } else if (number.length === 9) {
                  phoneValue = `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
                }
              }
            }
            updated.phone = maskPhone(phoneValue);
          }

          if (!prev.email || prev.email.trim() === '') {
            if (
              data.email &&
              data.email !== null &&
              data.email.trim() !== ''
            ) {
              updated.email = data.email.trim();
            } else if (data.qsa && Array.isArray(data.qsa) && data.qsa.length > 0) {
              const socioComEmail = data.qsa.find(
                (socio: any) =>
                  socio.email &&
                  socio.email !== null &&
                  socio.email.trim() !== ''
              );
              if (socioComEmail?.email) {
                updated.email = socioComEmail.email.trim();
              }
            }
          }

          return updated;
        });

        if (data.cep) {
          try {
            const cepInfo = await fetchCepData(data.cep);
            if (cepInfo) {
              setNewClientData((prev) => {
                const updated = { ...prev };
                if (!prev.streetAddress || prev.streetAddress.trim() === '') {
                  updated.streetAddress = cepInfo.street;
                }
                if (!prev.neighborhood || prev.neighborhood.trim() === '') {
                  updated.neighborhood = cepInfo.neighborhood;
                }
                if (!prev.city || prev.city.trim() === '') {
                  updated.city = cepInfo.city;
                }
                if (!prev.state || prev.state.trim() === '') {
                  updated.state = cepInfo.state.toUpperCase();
                }
                if (
                  cepInfo.complement &&
                  (!prev.addressComplement || prev.addressComplement.trim() === '')
                ) {
                  updated.addressComplement = cepInfo.complement;
                }
                return updated;
              });
            }
          } catch (error) {
            console.error('Erro ao buscar CEP na BrasilAPI após CNPJ:', error);
          }
        } else {
          setNewClientData((prev) => {
            const updated = { ...prev };
            if (
              data.logradouro &&
              (!prev.streetAddress || prev.streetAddress.trim() === '')
            ) {
              updated.streetAddress = data.logradouro;
            }
            if (data.bairro && (!prev.neighborhood || prev.neighborhood.trim() === '')) {
              updated.neighborhood = data.bairro;
            }
            if (data.municipio && (!prev.city || prev.city.trim() === '')) {
              updated.city = data.municipio;
            }
            if (data.uf && (!prev.state || prev.state.trim() === '')) {
              updated.state = data.uf.toUpperCase();
            }
            return updated;
          });
        }

        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
      return false;
    }
  };

  const handleNewClientCnpjBlur = async () => {
    const cleanCnpj = unmaskCNPJ(newClientData.document || '');
    if (cleanCnpj.length !== 14 || isLoadingNewClientCnpj) {
      return;
    }
    if (lastNewClientCnpjRef.current === cleanCnpj) {
      return;
    }
    lastNewClientCnpjRef.current = cleanCnpj;
    setIsLoadingNewClientCnpj(true);
    try {
      await fetchAndFillNewClientCnpjData(cleanCnpj);
    } finally {
      setIsLoadingNewClientCnpj(false);
    }
  };

  const searchExistingNewClient = async (
    document: string
  ): Promise<Client | null> => {
    try {
      const response = await apiRequest(
        'GET',
        `/api/clients/search/document?document=${encodeURIComponent(document)}`,
        undefined
      );
      return (await response.json()) as Client;
    } catch (error: any) {
      if (
        error.status === 404 ||
        error.message?.includes('404') ||
        error.message?.includes('Client not found')
      ) {
        return null;
      }
      console.error('Erro ao buscar cliente:', error);
      return null;
    }
  };

  // Funcao para processar CPF/CNPJ ao sair do campo
  const handleAdvanceNewClient = async () => {
    if (!newClientData.document) {
      toast({
        variant: 'destructive',
        title: 'Documento obrigatório',
        description: 'Digite o CPF ou CNPJ do cliente.',
      });
      return;
    }

    const cleanDocument = newClientData.document.replace(/\D/g, '');

    if (cleanDocument.length !== 11 && cleanDocument.length !== 14) {
      toast({
        variant: 'destructive',
        title: 'Documento inválido',
        description: 'Digite um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.',
      });
      return;
    }

    setIsCheckingNewClient(true);
    try {
      const existing = await searchExistingNewClient(cleanDocument);

      if (existing) {
        setExistingNewClient(existing);
        setShowNewClientFields(false);
        toast({
          variant: 'destructive',
          title: 'Cliente já cadastrado',
          description: `O cliente "${
            existing.name || existing.legalName
          }" já está cadastrado no sistema.`,
        });
        setIsCheckingNewClient(false);
        return;
      }

      setExistingNewClient(null);

      if (cleanDocument.length === 11) {
        setNewClientDocumentType('CPF');
        setNewClientActiveTab('PF');
        setNewClientData((prev) => ({ ...prev, type: 'PF' }));

        try {
          const cpfData = await fetchCpfData(cleanDocument);

          if (cpfData) {
            setNewClientData((prev) => ({
              ...prev,
              type: 'PF',
              document: maskCPF(cleanDocument),
              name: cpfData.name || prev.name,
              address: cpfData.address?.street || prev.address,
              addressNumber: cpfData.address?.number || prev.addressNumber,
              addressComplement:
                cpfData.address?.complement || prev.addressComplement,
              neighborhood: cpfData.address?.neighborhood || prev.neighborhood,
              city: cpfData.address?.city || prev.city,
              state: cpfData.address?.state || prev.state,
              zipCode: cpfData.address?.zipCode
                ? maskCEP(cpfData.address.zipCode)
                : prev.zipCode,
            }));

            toast({
              title: 'Dados do CPF encontrados',
              description: 'Os campos foram preenchidos automaticamente.',
            });
          } else {
            setNewClientData((prev) => ({
              ...prev,
              type: 'PF',
              document: maskCPF(cleanDocument),
            }));
          }
        } catch (error: any) {
          console.error('Erro ao buscar dados do CPF:', error);
          setNewClientData((prev) => ({
            ...prev,
            type: 'PF',
            document: maskCPF(cleanDocument),
          }));

          if (!error.message?.includes('não configurado')) {
            toast({
              variant: 'default',
              title: 'Aviso',
              description:
                'Não foi possível buscar dados do CPF. Você pode preencher manualmente.',
            });
          }
        }

        setShowNewClientFields(true);
      } else if (cleanDocument.length === 14) {
        setNewClientDocumentType('CNPJ');

        if (
          !showNewClientTypeModal &&
          !isOpeningNewClientTypeModal.current &&
          newClientTypeModalOpenedForDocument.current !== cleanDocument
        ) {
          isOpeningNewClientTypeModal.current = true;
          newClientTypeModalOpenedForDocument.current = cleanDocument;
          setShowNewClientTypeModal(true);
          setTimeout(() => {
            isOpeningNewClientTypeModal.current = false;
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar cliente:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível processar o documento. Tente novamente.',
      });
    } finally {
      setIsCheckingNewClient(false);
    }
  };

  // Função para buscar CEP e preencher endereço do novo cliente
  const handleSearchNewClientCep = async () => {
    const cleanCep = unmaskCEP(newClientData.zipCode || '');
    if (cleanCep.length !== 8) {
      toast({
        variant: 'destructive',
        title: 'CEP inválido',
        description: 'Digite um CEP válido com 8 dígitos.',
      });
      return;
    }

    try {
      const cepData = await fetchCepData(cleanCep);
      if (cepData) {
        setNewClientData((prev) => ({
          ...prev,
          zipCode: maskCEP(cepData.cep || cleanCep),
          streetAddress: cepData.street || prev.streetAddress || '',
          neighborhood: cepData.neighborhood || prev.neighborhood || '',
          city: cepData.city || prev.city || '',
          state: cepData.state ? cepData.state.toUpperCase() : prev.state || '',
          addressComplement: cepData.complement || prev.addressComplement || '',
        }));
        toast({
          title: 'CEP encontrado!',
          description: 'Os campos de endereço foram preenchidos automaticamente.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'CEP não encontrado',
          description: 'Não foi possível encontrar o endereço para este CEP.',
        });
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar CEP',
        description: 'Não foi possível consultar o CEP. Tente novamente.',
      });
    }
  };

  const handleNewClient = () => {
    resetNewClientForm(clientTypeFilter);
    if (clientTypeFilter !== 'PF') {
      setShowNewClientFields(true);
    }
    setIsNewClientOpen(true);
    setClientSearchOpen(false);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, boolean> = {};

    if (!newClientData.name?.trim()) errors.name = true;
    if (!newClientData.phone?.trim()) errors.phone = true;
    if (!newClientData.city?.trim()) errors.city = true;
    if (!newClientData.state?.trim()) errors.state = true;

    if (Object.keys(errors).length > 0) {
      setNewClientErrors(errors);
      toast({
        variant: 'destructive',
        title: 'Erro de validação',
        description: 'Por favor, preencha todos os campos destacados em vermelho.',
      });
      return;
    }

    setNewClientErrors({});

    const baseData: any = {
      name: (newClientData.name?.trim() || '').trim(),
      type: newClientData.type,
      phone: (unmaskPhone(newClientData.phone) || '').trim(),
      city: (newClientData.city?.trim() || '').trim(),
      state: (newClientData.state?.trim() || '').trim(),
      document: newClientData.document
        ? newClientData.type === 'PF'
          ? unmaskCPF(newClientData.document)
          : unmaskCNPJ(newClientData.document)
        : null,
      email: newClientData.email?.trim() || null,
      // logoUrl: newClientData.logoUrl?.trim() || null,
      address: newClientData.address?.trim() || null,
      zipCode: newClientData.zipCode ? unmaskCEP(newClientData.zipCode) : null,
      streetAddress: newClientData.streetAddress?.trim() || null,
      addressNumber: newClientData.addressNumber?.trim() || null,
      addressComplement: newClientData.addressComplement?.trim() || null,
      neighborhood: newClientData.neighborhood?.trim() || null,
    };

    if (newClientData.type !== 'PF') {
      baseData.legalName = newClientData.legalName?.trim() || null;
      baseData.municipalRegistration =
        newClientData.municipalRegistration?.trim() || null;
      baseData.stateRegistration =
        newClientData.stateRegistration?.trim() || null;
      baseData.ratTemplateId =
        newClientData.type === 'EMPRESA_PARCEIRA'
          ? newClientData.ratTemplateId || null
          : null;
      baseData.paymentCycleStartDay = newClientData.paymentCycleStartDay || null;
      baseData.paymentCycleEndDay = newClientData.paymentCycleEndDay || null;
      baseData.paymentDueDay = newClientData.paymentDueDay || null;
      baseData.defaultHoursIncluded = newClientData.defaultHoursIncluded || null;
      baseData.monthlySpreadsheet = newClientData.monthlySpreadsheet || false;
      baseData.spreadsheetEmail = newClientData.spreadsheetEmail?.trim() || null;
      baseData.spreadsheetDay = newClientData.spreadsheetDay || null;
      baseData.defaultTicketValue =
        newClientData.defaultTicketValue &&
        newClientData.defaultTicketValue.trim()
          ? unmaskCurrency(String(newClientData.defaultTicketValue))
          : null;
      baseData.defaultKmRate =
        newClientData.defaultKmRate && newClientData.defaultKmRate.trim()
          ? unmaskCurrency(String(newClientData.defaultKmRate))
          : null;
      baseData.defaultAdditionalHourRate =
        newClientData.defaultAdditionalHourRate &&
        newClientData.defaultAdditionalHourRate.trim()
          ? unmaskCurrency(String(newClientData.defaultAdditionalHourRate))
          : null;
    }

    await createClientMutation.mutateAsync(baseData);
  };

  const checkInMutation = useMutation({
    mutationFn: async (id: string) => {
      const startedAt = new Date().toISOString();

      // Salvar no localStorage IMEDIATAMENTE para garantir que o banner aparece
      try {
        const stored = JSON.parse(
          localStorage.getItem('active_tickets_startedAt') || '{}'
        );
        stored[id] = startedAt;
        localStorage.setItem(
          'active_tickets_startedAt',
          JSON.stringify(stored)
        );
      } catch (err) {
        console.warn('Erro ao salvar startedAt no localStorage:', err);
      }

      // Fazer check-in no backend
      const response = await apiRequest(
        'POST',
        `/api/tickets/${id}/check-in`,
        {}
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao iniciar atendimento');
      }
      const updatedTicket = await response.json();

      // Atualizar localStorage com startedAt do backend se disponível
      if (updatedTicket.startedAt) {
        try {
          const stored = JSON.parse(
            localStorage.getItem('active_tickets_startedAt') || '{}'
          );
          stored[id] = updatedTicket.startedAt;
          localStorage.setItem(
            'active_tickets_startedAt',
            JSON.stringify(stored)
          );
        } catch (err) {
          console.warn('Erro ao atualizar startedAt no localStorage:', err);
        }
      }

      return updatedTicket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: 'Check-in realizado',
        description: 'Atendimento iniciado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao fazer check-in',
        description: error.message,
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        kmTotal: number;
        kmRate?: number;
        kmChargeExempt?: boolean;
        additionalHourRate?: number;
        extraExpenses: number;
        expenseDetails: string;
        baseAmount: number;
        totalAmount: number;
        discount: number;
        serviceItems: Array<{ name: string; amount: number }>;
        paymentDate?: string;
        warranty?: string;
      };
    }) => {
      return await apiRequest('POST', `/api/tickets/${id}/complete`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      setCompletingTicket(null);
      toast({
        title: 'Atendimento finalizado',
        description: 'O chamado foi concludo com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao finalizar chamado',
        description: error.message,
      });
    },
  });

  const handleCurrencyChange = (
    field: 'ticketValue' | 'kmRate' | 'additionalHourRate',
    value: string
  ) => {
    const formatted = maskCurrency(value);
    setFormData({ ...formData, [field]: formatted });
  };

  // Função para buscar cliente por CNPJ/CPF
  const searchClientByDocument = async (
    document: string
  ): Promise<Client | null> => {
    try {
      const response = await apiRequest(
        'GET',
        `/api/clients/search/document?document=${encodeURIComponent(document)}`,
        undefined
      );
      // Parse da resposta JSON
      const client = (await response.json()) as Client;
      if (client && client.id) {
        return client;
      }
      return null;
    } catch (error: any) {
      if (error.status === 404 || error.message?.includes('404')) {
        return null;
      }
      console.error('Erro ao buscar cliente:', error);
      return null;
    }
  };

  // Função para processar dados extraídos (OCR ou texto) e buscar cliente
  const processExtractedData = async (data: {
    cnpj?: string;
    cpf?: string;
  }) => {
    let foundClient: Client | null = null;

    // Se encontrou CNPJ, busca cliente
    if (data.cnpj) {
      foundClient = await searchClientByDocument(data.cnpj);
      if (foundClient) {
        // Define tipo e cliente
        const clientType =
          foundClient.type === 'EMPRESA_PARCEIRA' ? 'EMPRESA_PARCEIRA' : 'PJ';
        setClientTypeFilter(clientType);
        setFormData((prev) => ({
          ...prev,
          clientId: foundClient!.id,
        }));
        setClientSearchOpen(false);
        toast({
          title: 'Cliente encontrado!',
          description: `Cliente "${
            foundClient.name
          }" selecionado automaticamente (${
            clientType === 'EMPRESA_PARCEIRA' ? 'Empresa Parceira' : 'PJ'
          }).`,
        });
        return;
      }
    }

    // Se encontrou CPF, busca cliente
    if (data.cpf && !foundClient) {
      foundClient = await searchClientByDocument(data.cpf);
      if (foundClient) {
        // Define tipo e cliente
        setClientTypeFilter('PF');
        setFormData((prev) => ({
          ...prev,
          clientId: foundClient!.id,
        }));
        setClientSearchOpen(false);
        toast({
          title: 'Cliente encontrado!',
          description: `Cliente "${foundClient.name}" selecionado automaticamente (PF).`,
        });
        return;
      }
    }

    // Se não encontrou cliente, mostra mensagem
    if (data.cnpj || data.cpf) {
      toast({
        title: 'Cliente não encontrado',
        description:
          'Nenhum cliente cadastrado com este CNPJ/CPF. Selecione manualmente ou cadastre um novo cliente.',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      clientId: '',
      serviceId: '',
      scheduledDate: '',
      scheduledTime: '',
      duration: 3,
      description: '',
      address: '', // Limpar endereço ao resetar
      city: '',
      state: '',
      // EMPRESA_PARCEIRA-specific fields
      ticketNumber: '',
      finalClient: '',
      ticketValue: '',
      chargeType: 'VALOR_FIXO' as
        | 'DIARIA'
        | 'CHAMADO_AVULSO'
        | 'VALOR_FIXO'
        | 'VALOR_POR_HORA',
      approvedBy: 'Nome do analista',
      kmRate: '',
      additionalHourRate: '',
      serviceAddress: '',
      dueDate: '',
      paymentDate: '',
    });
    setClientTypeFilter('PF');
    setClientSearchValue('');
    setClientSearchOpen(false);
    setRawTicketText('');
    setDocumentSearch('');
    setFormErrors({});
    setSelectedDate(undefined);
    setSelectedTime('');
    setCurrentMonth(new Date());
    setSchedulingStep('calendar');
  };

  const scheduleTimesForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return getTimeSlotsForDate(
      selectedDate,
      integrationSettings?.workingHours,
      integrationSettings?.workingDays
    );
  }, [selectedDate, integrationSettings]);

  const isAvailabilityLoading = isLoadingSlots;

  const availableTimes = useMemo(() => {
    if (!selectedDate) {
      return [];
    }
    if (availableSlotsError) {
      return scheduleTimesForSelectedDate;
    }
    if (availableSlots.length > 0) {
      return availableTimesForSelectedDate;
    }
    return [];
  }, [
    selectedDate,
    availableSlotsError,
    availableSlots.length,
    availableTimesForSelectedDate,
    scheduleTimesForSelectedDate,
  ]);

  // Sincronizar selectedDate e selectedTime com formData
  useEffect(() => {
    if (selectedDate && selectedTime) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      setFormData((prev) => {
        // Só atualiza se os valores forem diferentes para evitar loops
        if (
          prev.scheduledDate !== dateStr ||
          prev.scheduledTime !== selectedTime
        ) {
          return {
            ...prev,
            scheduledDate: dateStr,
            scheduledTime: selectedTime,
          };
        }
        return prev;
      });
    }
  }, [selectedDate, selectedTime]);

  // Sincronizar cálculos habilitados com tipo de cliente e configurações
  useEffect(() => {
    if (isCreateOpen && integrationSettings) {
      const selectedClient = clients?.find((c) => c.id === formData.clientId);
      const clientType = selectedClient?.type || clientTypeFilter;

      const isCalculationsEnabledGlobally =
        integrationSettings.calculationsEnabled ?? true;
      const isTypeEnabled =
        integrationSettings.calculationsClientTypes?.includes(clientType) ??
        true;

      setFormData((prev) => ({
        ...prev,
        calculationsEnabled: isCalculationsEnabledGlobally && isTypeEnabled,
      }));
    }
  }, [isCreateOpen, formData.clientId, clientTypeFilter, integrationSettings, clients]);

  // Função para captura automática de dados do chamado
  const parseTicketText = async () => {
    // Limpa o texto: remove caracteres invisíveis e normaliza quebras de linha
    const cleanedText = (rawTicketText || '')
      .replace(/\r\n/g, '\n') // Normaliza quebras de linha Windows
      .replace(/\r/g, '\n') // Normaliza quebras de linha Mac
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
      .trim();
    const text = cleanedText;
    const lowered = text.toLowerCase();
    const lines = text.split(/\n/).map((l) => l.trim());

    // Extrai CNPJ e CPF do texto usando OCRParser
    const parser = new OCRParser();
    const extractedData = parser.parse(lines);

    // Busca cliente se encontrou CNPJ ou CPF
    if (extractedData.cnpj || extractedData.cpf) {
      await processExtractedData({
        cnpj: extractedData.cnpj,
        cpf: extractedData.cpf,
      });
    }

    // Data - detecta quando o label está em uma linha e o valor na próxima
    // PRIORIDADE 1: Procura por "Agendamento:" seguido de data na mesma linha
    let dateMatch = null;

    // Primeiro tenta detectar "Agendamento: DD/MM/YYYY" na mesma linha
    const agendamentoMatch = text.match(
      /agendamento[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i
    );
    if (agendamentoMatch && agendamentoMatch[1]) {
      const dateStr = agendamentoMatch[1];
      if (dateStr.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/)) {
        const [day, month, year] = dateStr.split(/[\/\-]/);
        dateMatch = `${year}-${month}-${day}`;
      }
    }

    // PRIORIDADE 2: Detecta quando o label está em uma linha e o valor na próxima
    if (!dateMatch) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase().trim();
        const normalizedLine = line.replace(/\s+/g, ' ').trim();

        const isDateLabel =
          normalizedLine === 'data' ||
          normalizedLine === 'data do chamado' ||
          normalizedLine === 'data agendamento' ||
          normalizedLine.match(/^data[:\-]?$/i);

        if (isDateLabel && i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          // Valida formato de data (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
          if (
            nextLine &&
            (nextLine.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/) ||
              nextLine.match(/^\d{4}[\/\-]\d{2}[\/\-]\d{2}$/))
          ) {
            // Converte para formato YYYY-MM-DD
            let formattedDate = nextLine;
            if (nextLine.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/)) {
              const [day, month, year] = nextLine.split(/[\/\-]/);
              formattedDate = `${year}-${month}-${day}`;
            }
            dateMatch = formattedDate;
            break;
          }
        }
      }
    }

    // PRIORIDADE 3: Se não encontrou, tenta regex no texto completo
    if (!dateMatch) {
      const dateRegex = text.match(
        /(?:data|data\s+do\s+chamado|data\s+agendamento)[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})/i
      );
      if (dateRegex && dateRegex[1]) {
        let formattedDate = dateRegex[1];
        if (formattedDate.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/)) {
          const [day, month, year] = formattedDate.split(/[\/\-]/);
          formattedDate = `${year}-${month}-${day}`;
        }
        dateMatch = formattedDate;
      }
    }

    // Hora - detecta quando o label está em uma linha e o valor na próxima
    let timeMatch = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ').trim();

      const isTimeLabel =
        normalizedLine === 'hora' ||
        normalizedLine === 'horário' ||
        normalizedLine === 'horario' ||
        normalizedLine === 'hora agendamento' ||
        normalizedLine.match(/^hora[:\-]?$/i);

      if (isTimeLabel && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        // Valida formato de hora (HH:MM ou HHhMM)
        if (
          nextLine &&
          (nextLine.match(/^\d{1,2}:\d{2}$/) ||
            nextLine.match(/^\d{1,2}h\d{2}$/i))
        ) {
          timeMatch = nextLine.replace(/h/gi, ':').padStart(5, '0');
          break;
        }
      }
    }

    // Se não encontrou na linha seguinte, tenta regex no texto completo
    if (!timeMatch) {
      const timeRegex = text.match(
        /(?:hora|horário|horario|hora\s+agendamento)[:\-]?\s*(\d{1,2}[:h]\d{2})/i
      );
      if (timeRegex && timeRegex[1]) {
        timeMatch = timeRegex[1].replace(/h/gi, ':').padStart(5, '0');
      }
    }

    // Duração - detecta quando o label está em uma linha e o valor na próxima
    let durationMatch = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ').trim();

      const isDurationLabel =
        normalizedLine === 'duração' ||
        normalizedLine === 'duracao' ||
        normalizedLine === 'tempo' ||
        normalizedLine === 'duração (horas)' ||
        normalizedLine.match(/^duração[:\-]?$/i);

      if (isDurationLabel && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        // Valida se é um número
        if (nextLine && nextLine.match(/^\d+$/)) {
          durationMatch = parseInt(nextLine, 10);
          break;
        }
      }
    }

    // Se não encontrou na linha seguinte, tenta regex no texto completo
    if (!durationMatch) {
      const durationRegex = text.match(
        /(?:duração|duracao|tempo)[:\-]?\s*(\d+)\s*(?:hora|horas|h)?/i
      );
      if (durationRegex && durationRegex[1]) {
        durationMatch = parseInt(durationRegex[1], 10);
      }
    }

    // Descrição/Observações - pega texto após label ou texto livre
    let descriptionMatch = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ').trim();

      const isDescriptionLabel =
        normalizedLine === 'descrição' ||
        normalizedLine === 'descricao' ||
        normalizedLine === 'observações' ||
        normalizedLine === 'observacoes' ||
        normalizedLine === 'observação' ||
        normalizedLine === 'obs' ||
        normalizedLine.match(/^(?:descrição|observações|obs)[:\-]?$/i);

      if (isDescriptionLabel && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && nextLine.length >= 5) {
          // Pega a próxima linha e todas as linhas seguintes até encontrar outro label
          let descriptionLines = [nextLine];
          for (let j = i + 2; j < lines.length; j++) {
            const candidateLine = lines[j].trim();
            // Para se encontrar outro label conhecido
            if (
              candidateLine.match(
                /^(?:data|hora|duração|cliente|serviço|valor|número|tipo)/i
              )
            ) {
              break;
            }
            if (candidateLine) {
              descriptionLines.push(candidateLine);
            }
          }
          descriptionMatch = descriptionLines.join(' ');
          break;
        }
      }
    }

    // Se não encontrou na linha seguinte, tenta pegar texto livre (linhas longas sem labels)
    if (!descriptionMatch) {
      const longLines = lines.filter(
        (line) =>
          line.length >= 20 &&
          !line.match(
            /^(?:data|hora|duração|cliente|serviço|valor|número|tipo|email|telefone|cep)/i
          ) &&
          !line.match(/^\d+$/) &&
          !line.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/)
      );
      if (longLines.length > 0) {
        descriptionMatch = longLines.join(' ');
      }
    }

    // Número do Chamado (EMPRESA_PARCEIRA) - detecta quando o label está em uma linha e o valor na próxima
    let ticketNumberMatch = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ').trim();

      const isTicketNumberLabel =
        normalizedLine === 'número do chamado' ||
        normalizedLine === 'numero do chamado' ||
        normalizedLine === 'número' ||
        normalizedLine === 'numero' ||
        normalizedLine === 'nº do chamado' ||
        normalizedLine.match(/^número\s+do\s+chamado[:\-]?$/i);

      if (isTicketNumberLabel && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && nextLine.length >= 3) {
          ticketNumberMatch = nextLine;
          break;
        }
      }
    }

    // Se não encontrou na linha seguinte, tenta regex no texto completo
    if (!ticketNumberMatch) {
      // Tenta vários padrões: "Número do Chamado: XXX", "Chamado: XXX", "OS: XXX", etc.
      const ticketNumberRegex = text.match(
        /(?:número|numero|nº|chamado|os|ordem\s+de\s+serviço)[:\-]?\s*([A-Za-z0-9\-]+)/i
      );
      if (
        ticketNumberRegex &&
        ticketNumberRegex[1] &&
        ticketNumberRegex[1].length >= 3
      ) {
        ticketNumberMatch = ticketNumberRegex[1];
      }
    }

    // Valor do Chamado (EMPRESA_PARCEIRA) - detecta quando o label está em uma linha e o valor na próxima
    let ticketValueMatch = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ').trim();

      const isTicketValueLabel =
        normalizedLine === 'valor do chamado' ||
        normalizedLine === 'valor' ||
        normalizedLine === 'valor (r$)' ||
        normalizedLine.match(/^valor\s+do\s+chamado[:\-]?$/i);

      if (isTicketValueLabel && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        // Remove R$, espaços e formata
        const cleanedValue = nextLine
          .replace(/r\$\s*/gi, '')
          .replace(/\./g, '')
          .replace(',', '.');
        if (cleanedValue && cleanedValue.match(/^\d+\.?\d*$/)) {
          ticketValueMatch = maskCurrency(cleanedValue);
          break;
        }
      }
    }

    // Se não encontrou na linha seguinte, tenta regex no texto completo
    if (!ticketValueMatch) {
      const ticketValueRegex = text.match(
        /(?:valor\s+do\s+chamado|valor)[:\-]?\s*r?\$?\s*([\d.,]+)/i
      );
      if (ticketValueRegex && ticketValueRegex[1]) {
        const cleanedValue = ticketValueRegex[1]
          .replace(/\./g, '')
          .replace(',', '.');
        ticketValueMatch = maskCurrency(cleanedValue);
      }
    }

    // Cliente Final (EMPRESA_PARCEIRA) - detecta quando o label está em uma linha e o valor na próxima
    let finalClientMatch = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const normalizedLine = line.replace(/\s+/g, ' ').trim();

      const isFinalClientLabel =
        normalizedLine === 'cliente final' ||
        normalizedLine === 'contato' ||
        normalizedLine === 'cliente final / contato' ||
        normalizedLine.match(/^cliente\s+final[:\-]?$/i);

      if (isFinalClientLabel && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && nextLine.length >= 3) {
          finalClientMatch = nextLine;
          break;
        }
      }
    }

    // Se não encontrou na linha seguinte, tenta regex no texto completo
    if (!finalClientMatch) {
      const finalClientRegex = text.match(
        /(?:cliente\s+final|contato)[:\-]?\s*([A-Za-zÀ-ÿ\s]+?)(?:\s*\n|$)/i
      );
      if (finalClientRegex && finalClientRegex[1]) {
        finalClientMatch = finalClientRegex[1].trim();
      }
    }

    // Endereço do Atendimento (EMPRESA_PARCEIRA) - detecta quando o label está em uma linha e o valor na próxima
    // PRIORIDADE 1: Detecta "Endereço:" seguido de endereço na mesma linha
    let serviceAddressMatch = null;

    // Primeiro tenta detectar "Endereço: ..." na mesma linha
    const enderecoMatch = text.match(
      /endereço[:\-]?\s*([A-Za-zÀ-ÿ0-9\s,\-\.]+?)(?:\s*(?:Contato|Descrição|CEP|Bairro|Cidade|UF|Estado)|\n|$)/i
    );
    if (enderecoMatch && enderecoMatch[1]) {
      const address = enderecoMatch[1].trim();
      // Validações: deve ser uma linha válida de endereço
      if (
        address.length >= 10 &&
        address.split(/\s+/).length >= 2 &&
        !address.match(
          /^(?:número|cep|bairro|distrito|cidade|uf|estado|contato|descrição)/i
        ) &&
        !address.match(/^\d{5}-?\d{3}$/) &&
        !address.match(/^\d+$/) &&
        !address.match(/^[A-Z]{2}$/)
      ) {
        serviceAddressMatch = address;
      }
    }

    // PRIORIDADE 2: Detecta quando o label está em uma linha e o valor na próxima
    if (!serviceAddressMatch) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase().trim();
        const normalizedLine = line.replace(/\s+/g, ' ').trim();

        const isServiceAddressLabel =
          normalizedLine === 'endereço do atendimento' ||
          normalizedLine === 'endereco do atendimento' ||
          normalizedLine === 'endereço' ||
          normalizedLine === 'endereco' ||
          normalizedLine === 'local' ||
          normalizedLine.match(/^endereço\s+do\s+atendimento[:\-]?$/i);

        if (isServiceAddressLabel && i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          // Validações: deve ser uma linha válida de endereço
          if (
            nextLine &&
            nextLine.length >= 10 &&
            nextLine.split(/\s+/).length >= 2 &&
            !nextLine.match(
              /^(?:número|cep|bairro|distrito|cidade|uf|estado|contato|descrição)/i
            ) &&
            !nextLine.match(/^\d{5}-?\d{3}$/) &&
            !nextLine.match(/^\d+$/) &&
            !nextLine.match(/^[A-Z]{2}$/)
          ) {
            serviceAddressMatch = nextLine;
            break;
          }
        }
      }
    }

    // PRIORIDADE 3: Se não encontrou, tenta regex no texto completo
    if (!serviceAddressMatch) {
      const serviceAddressRegex = text.match(
        /(?:endereço|endereco)\s+do\s+atendimento[:\-]?\s*([A-Za-zÀ-ÿ0-9\s,]+?)(?:\s*\n|$)/i
      );
      if (serviceAddressRegex && serviceAddressRegex[1]) {
        serviceAddressMatch = serviceAddressRegex[1].trim();
      }
    }

    // Aplica os dados encontrados ao formulário
    setFormData((prev) => ({
      ...prev,
      scheduledDate: dateMatch || prev.scheduledDate,
      scheduledTime: timeMatch || prev.scheduledTime,
      duration: durationMatch || prev.duration,
      description: descriptionMatch || prev.description,
      // EMPRESA_PARCEIRA-specific fields
      ticketNumber: ticketNumberMatch || prev.ticketNumber,
      ticketValue: ticketValueMatch || prev.ticketValue,
      finalClient: finalClientMatch || prev.finalClient,
      serviceAddress: serviceAddressMatch || prev.serviceAddress,
    }));

    toast({
      title: 'Dados preenchidos',
      description:
        'Os dados foram extraídos e preenchidos automaticamente. Revise e complete os campos faltantes.',
    });
  };

  const handleCreate = () => {
    resetForm();
    setIsRescheduling(false);
    setIsCreateOpen(true);
  };

  const handleEdit = (ticket: Ticket) => {
    // Extract scheduledDate and scheduledTime from scheduledFor
    const [date, time] = ticket.scheduledFor.split('T');
    const dateObj = date ? new Date(date) : undefined;
    const timeStr = time ? time.substring(0, 5) : '';

    setFormData({
      clientId: ticket.clientId,
      serviceId: ticket.serviceId || '',
      scheduledDate: date || '',
      scheduledTime: timeStr, // HH:mm format
      duration: ticket.duration || 3,
      description: ticket.description || '',
      // EMPRESA_PARCEIRA-specific fields
      ticketNumber: ticket.ticketNumber || '',
      finalClient: ticket.finalClient || '',
      ticketValue: ticket.ticketValue
        ? maskCurrency(ticket.ticketValue.toString())
        : '',
      chargeType: (ticket.chargeType || 'VALOR_FIXO') as
        | 'DIARIA'
        | 'CHAMADO_AVULSO'
        | 'VALOR_FIXO'
        | 'VALOR_POR_HORA',
      approvedBy: ticket.approvedBy || 'Nome do analista',
      kmRate: ticket.kmRate ? maskCurrency(ticket.kmRate.toString()) : '',
      additionalHourRate: ticket.additionalHourRate
        ? maskCurrency(ticket.additionalHourRate.toString())
        : '',
      serviceAddress: ticket.serviceAddress || '',
      address: ticket.address || '',
      city: ticket.city || '',
      state: ticket.state || '',
      dueDate: ticket.dueDate || '',
      paymentDate: ticket.paymentDate || '',
    });

    // Sincronizar estados de data e horário
    if (dateObj && !isNaN(dateObj.getTime())) {
      setSelectedDate(dateObj);
      setCurrentMonth(startOfMonth(dateObj));
    }
    setSelectedTime(timeStr);

    setEditingTicket(ticket);
    setIsRescheduling(false);
    setRawTicketText('');
  };

  const handleReschedule = (ticket: Ticket) => {
    // Extract scheduledDate and scheduledTime from scheduledFor
    const [date, time] = ticket.scheduledFor.split('T');
    const dateObj = date ? new Date(date) : undefined;
    const timeStr = time ? time.substring(0, 5) : '';

    // Preencher formulário com dados do chamado para reagendamento
    setFormData({
      clientId: ticket.clientId,
      serviceId: ticket.serviceId || '',
      scheduledDate: date || '',
      scheduledTime: timeStr, // HH:mm format
      duration: ticket.duration || 3,
      description: ticket.description || '',
      // EMPRESA_PARCEIRA-specific fields
      ticketNumber: ticket.ticketNumber || '',
      finalClient: ticket.finalClient || '',
      ticketValue: ticket.ticketValue
        ? maskCurrency(ticket.ticketValue.toString())
        : '',
      chargeType: (ticket.chargeType || 'VALOR_FIXO') as
        | 'DIARIA'
        | 'CHAMADO_AVULSO'
        | 'VALOR_FIXO'
        | 'VALOR_POR_HORA',
      approvedBy: ticket.approvedBy || 'Nome do analista',
      kmRate: ticket.kmRate ? maskCurrency(ticket.kmRate.toString()) : '',
      additionalHourRate: ticket.additionalHourRate
        ? maskCurrency(ticket.additionalHourRate.toString())
        : '',
      serviceAddress: ticket.serviceAddress || '',
      address: ticket.address || '',
      city: ticket.city || '',
      state: ticket.state || '',
      dueDate: ticket.dueDate || '',
      paymentDate: ticket.paymentDate || '',
    });

    // Sincronizar estados de data e horário
    if (dateObj && !isNaN(dateObj.getTime())) {
      setSelectedDate(dateObj);
      setCurrentMonth(startOfMonth(dateObj));
    }
    setSelectedTime(timeStr);

    setEditingTicket(null); // Não é edição, é novo chamado
    setIsRescheduling(true);
    setIsCreateOpen(true); // Abre o formulário de criação
    setRawTicketText('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, boolean> = {};

    // Validate scheduled date and time
    if (!formData.scheduledDate) errors.scheduledDate = true;
    if (!formData.scheduledTime) errors.scheduledTime = true;
    if (!formData.clientId) errors.clientId = true;

    const selectedClient = clients?.find((c) => c.id === formData.clientId);
    const isEmpresaParceira = selectedClient?.type === 'EMPRESA_PARCEIRA';

    // Validate EMPRESA_PARCEIRA required fields
    if (isEmpresaParceira) {
      // Validar ticketNumber - obrigatório para EMPRESA_PARCEIRA
      const ticketNumberToValidate =
        formData.ticketNumber || nextTicketNumber || '';
      if (!ticketNumberToValidate.trim()) errors.ticketNumber = true;
      if (!formData.finalClient) errors.finalClient = true;
      if (!formData.ticketValue || formData.ticketValue === '0,00')
        errors.ticketValue = true;
      if (!formData.serviceAddress?.trim()) errors.serviceAddress = true;
    } else {
      // Validate that serviceId is present for PF and PJ clients
      if (!formData.serviceId) errors.serviceId = true;
    }

    if (Object.keys(errors).length > 0) {
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
      scheduledDate: formData.scheduledDate,
      scheduledTime: formData.scheduledTime,
      duration: formData.duration,
      description: formData.description,
      status: 'ABERTO', // Garantir que status seja sempre 'ABERTO' ao criar
      calculationsEnabled: formData.calculationsEnabled,
    };

    // Add serviceId for PF and PJ clients
    if (!isEmpresaParceira) {
      payload.serviceId = formData.serviceId;
      // Usar endereço do formData (que pode ter sido editado) ou do cadastro do cliente
      const selectedClient = clients?.find((c) => c.id === formData.clientId);
      if (selectedClient) {
        // Se o usuário editou o endereço, usar o editado; senão, usar o do cliente
        const addressToUse = formData.address || selectedClient.address || '';
        payload.address = addressToUse;
        payload.city = selectedClient.city || '';
        payload.state = selectedClient.state || '';
      }
    }

    // Add ticketNumber - obrigatório para EMPRESA_PARCEIRA, opcional para outros
    // Para EMPRESA_PARCEIRA, sempre usar o valor do formData ou nextTicketNumber
    if (isEmpresaParceira) {
      // Para EMPRESA_PARCEIRA, sempre incluir ticketNumber (obrigatório)
      // Usar o valor do formData se preenchido, senão usar nextTicketNumber
      payload.ticketNumber = formData.ticketNumber || nextTicketNumber || '';
    } else if (formData.ticketNumber) {
      // Para outros tipos, incluir apenas se fornecido
      payload.ticketNumber = formData.ticketNumber;
    }

    // Add EMPRESA_PARCEIRA fields if client is EMPRESA_PARCEIRA
    /**
     * Campos específicos para clientes EMPRESA_PARCEIRA
     *
     * Todos os campos abaixo são salvos no Google Sheets na coluna C (JSON).
     *
     * Campos obrigatórios:
     * - ticketNumber: Número do chamado (ex: "2025-0001") - agora gerado automaticamente
     * - finalClient: Cliente final/contato da empresa
     * - ticketValue: Valor do chamado (R$)
     * - chargeType: Tipo de cobrança ("DIARIA", "CHAMADO_AVULSO", "VALOR_FIXO" ou "VALOR_POR_HORA")
     * - serviceAddress: Endereço do atendimento
     *
     * Campos opcionais:
     * - approvedBy: Quem aprovou o valor
     * - kmRate: Valor do KM (R$/km)
     *
     * @see ESTRUTURA_DADOS_COMPLETA.md - Estrutura completa de dados
     * @see VERIFICACAO_GOOGLE_SHEETS_TICKETS.md - Verificação de compatibilidade
     */
    if (isEmpresaParceira) {
      payload.finalClient = formData.finalClient;
      payload.serviceAddress = formData.serviceAddress || ''; // Sempre incluir, mesmo se vazio
 // Correcao: garantir que ticketValue e kmRate sejam sempre strings.
      payload.ticketValue = formData.ticketValue
        ? String(unmaskCurrency(formData.ticketValue))
        : '';
      payload.chargeType = formData.chargeType;
      if (formData.approvedBy) payload.approvedBy = formData.approvedBy;
      if (formData.kmRate) {
        payload.kmRate = String(unmaskCurrency(formData.kmRate));
      }
      if (formData.additionalHourRate) {
        payload.additionalHourRate = String(
          unmaskCurrency(formData.additionalHourRate)
        );
      }
    }

    // Adicionar campos de endereço (city e state) se não for EMPRESA_PARCEIRA
    if (!isEmpresaParceira && formData.city) {
      payload.city = formData.city;
    }
    if (!isEmpresaParceira && formData.state) {
      payload.state = formData.state;
    }

    // Adicionar campos de pagamento e vencimento
    if (formData.dueDate) {
      payload.dueDate = formData.dueDate;
    }
    if (formData.paymentDate) {
      payload.paymentDate = formData.paymentDate;
    }

    if (editingTicket) {
      await updateMutation.mutateAsync({ id: editingTicket.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const handleDelete = async () => {
    if (deletingTicket) {
      await deleteMutation.mutateAsync(deletingTicket.id);
    }
  };

  const filteredTickets = useMemo(() => {
    if (!tickets) return undefined;

    const filtered = tickets.filter((ticket) => {
      const term = searchTerm.toLowerCase();
      const clientName = (ticket.client?.name || '').toLowerCase();
      const serviceName = (ticket.service?.name || '').toLowerCase();
      const description = (ticket.description || '').toLowerCase();

      // Incluir endereço na busca
      const address = (() => {
        const isEmpresaParceira = (ticket.client?.type || '')
          .toString()
          .includes('EMPRESA_PARCEIRA');
        if (isEmpresaParceira) {
          return ((ticket as any).serviceAddress || '').toLowerCase();
        } else {
          const addressFromTicket = (
            (ticket as any).address || ''
          ).toLowerCase();
          const city = ((ticket as any).city || '').toLowerCase();
          const state = ((ticket as any).state || '').toLowerCase();
          return [addressFromTicket, city, state].filter(Boolean).join(' ');
        }
      })();

      const matchesSearch =
        !term ||
        clientName.includes(term) ||
        serviceName.includes(term) ||
        description.includes(term) ||
        address.includes(term);

      const rawStatus = (ticket.status || '').toString();
      const normalizedStatus = STATUS_MAP[rawStatus] || rawStatus.toUpperCase();
      const filterValue = statusFilter.toUpperCase();

      // Mapear valores de filtro para valores normalizados
      const filterMap: Record<string, string[]> = {
        [STATUS_ALL]: [
          'ABERTO',
          'INICIADO',
          'CONCLUÍDO',
          'CONCLUIDO',
          'CANCELADO',
          'CANCELLED',
        ],
        // ABERTO: ['ABERTO'],
        // INICIADO: ['INICIADO', 'EXECUCAO'],
        // CONCLUÍDO: ['CONCLUÍDO', 'CONCLUIDO'],
        // CONCLUIDO: ['CONCLUÍDO', 'CONCLUIDO'],
        // CANCELADO: ['CANCELADO', 'CANCELLED'],
        // CANCELLED: ['CANCELADO', 'CANCELLED'],
        cancelled: ['CANCELADO', 'CANCELLED'],
      };

      const allowedStatuses = filterMap[filterValue] || [filterValue];
      const matchesStatus =
        filterValue === STATUS_ALL ||
        allowedStatuses.includes(normalizedStatus);

      return matchesSearch && matchesStatus;
    });

    // Ordenar: abertos/em execução primeiro, concluídos por último
    return filtered.sort((a, b) => {
      const statusA =
        STATUS_MAP[(a.status ?? '').toString()] ||
        (a.status ?? '').toString().toUpperCase();
      const statusB =
        STATUS_MAP[(b.status ?? '').toString()] ||
        (b.status ?? '').toString().toUpperCase();

      const isCompletedA = statusA === 'CONCLUIDO';
      const isCompletedB = statusB === 'CONCLUIDO';

      // Se um  concludo e o outro no, o no concludo vem primeiro
      if (isCompletedA && !isCompletedB) return 1;
      if (!isCompletedA && isCompletedB) return -1;

      // Se ambos tm o mesmo status (ambos concludos ou ambos no concludos),
      // ordenar por data (mais recentes primeiro)
      const dateA = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
      const dateB = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
      return dateB - dateA;
    });
  }, [tickets, searchTerm, statusFilter]);

  return (
    <div className='space-y-6 px-4 sm:px-0 pb-20 sm:pb-0'>
      {/* Header Moderno e Compacto */}
      <PageHeader>
        <div className='px-4 sm:px-0'>
          <div className='flex flex-row items-center justify-between gap-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2.5 bg-primary/10 rounded-xl sm:rounded-2xl shrink-0 ring-1 ring-primary/20'>
                <TicketIcon className='h-6 w-6 sm:h-8 sm:w-8 text-primary stroke-[2.5px]' />
              </div>
              <div className='min-w-0'>
                <h1 className='text-xl sm:text-4xl font-black leading-none tracking-tight text-slate-900 dark:text-white truncate'>
                  Chamados
                </h1>
                <p className='hidden xs:block text-slate-500 dark:text-slate-400 text-[10px] sm:text-sm font-medium mt-1 line-clamp-1'>
                  Gerencie atendimentos em tempo real
                </p>
              </div>
            </div>

            <Button
              onClick={handleCreate}
              data-testid='button-new-ticket'
              className='h-11 sm:h-12 px-4 sm:px-6 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] gap-2 shrink-0'
            >
              <Plus className='h-4 w-4 stroke-[3px]' />
              <span className='hidden sm:inline'>Novo Chamado</span>
              <span className='inline sm:hidden'>Novo</span>
            </Button>
          </div>
        </div>
      </PageHeader>

      {/* Busca e Filtros - Estilo App Moderno */}
      <div className='flex flex-col gap-4'>
        {/* SearchBar Otimizada */}
        <div className='relative group'>
          <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-5 h-5' />
          <Input
            placeholder='Buscar chamado...'
            className='pl-12 h-12 sm:h-14 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl shadow-sm focus:ring-2 focus:ring-primary/20 transition-all text-sm sm:text-base placeholder:text-slate-400'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid='input-search-tickets'
          />
        </div>

        {/* Filtros em Estilo Segmented Control / Tabs */}
        <div className='bg-slate-100/50 dark:bg-slate-900/50 p-1.5 rounded-2xl flex items-center gap-1 w-full ring-1 ring-slate-200 dark:ring-slate-800'>
          {[
            {
              id: STATUS_ALL,
              label: 'Todos',
              icon: ClipboardList,
              color: 'slate',
              count: tickets?.length || 0,
            },
            {
              id: 'ABERTO',
              label: 'Abertos',
              icon: Clock,
              color: 'amber',
              count:
                tickets?.filter((t) => normalizeStatus(t.status) === 'ABERTO')
                  .length || 0,
            },
            {
              id: 'INICIADO',
              label: 'Iniciado',
              icon: Loader2,
              color: 'blue',
              count:
                tickets?.filter((t) => normalizeStatus(t.status) === 'INICIADO')
                  .length || 0,
            },
            {
              id: 'CONCLUÍDO',
              label: 'Concluído',
              icon: CheckCircle2,
              color: 'emerald',
              count:
                tickets?.filter(
                  (t) => normalizeStatus(t.status) === 'CONCLUÍDO'
                ).length || 0,
            },
            {
              id: 'CANCELADO',
              label: 'Cancelado',
              icon: XCircle,
              color: 'red',
              count:
                tickets?.filter(
                  (t) => normalizeStatus(t.status) === 'CANCELADO'
                ).length || 0,
            },
          ].map((item) => {
            const isActive =
              statusFilter === item.id ||
              (item.id === 'INICIADO' && statusFilter === 'EXECUCAO') ||
              (item.id === 'CONCLUÍDO' && statusFilter === 'CONCLUIDO');
            const colorMap: Record<string, string> = {
              slate: isActive
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800',
              amber: isActive
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'text-amber-600 hover:bg-amber-500/10',
              blue: isActive
                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                : 'text-blue-600 hover:bg-blue-500/10',
              emerald: isActive
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'text-emerald-600 hover:bg-emerald-500/10',
              red: isActive
                ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                : 'text-red-600 hover:bg-red-500/10',
            };

            return (
              <button
                key={item.id}
                type='button'
                onClick={() => {
                  setStatusFilter(item.id);
                  if (item.id === STATUS_ALL) setLocation('/chamados');
                  else setLocation(`/chamados?status=${item.id}`);
                }}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center py-1.5 sm:py-2 gap-0.5 rounded-xl transition-all duration-200 font-black min-w-0',
                  colorMap[item.color]
                )}
              >
                <span className='text-[7px] sm:text-[9px] uppercase tracking-tighter opacity-80 mb-0.5 block truncate max-w-full px-0.5'>
                  {item.label}
                </span>
                <div className='flex items-center gap-1 sm:gap-1.5'>
                  <item.icon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      isActive ? 'opacity-100' : 'opacity-60',
                      item.id === 'INICIADO' && isActive && 'animate-spin'
                    )}
                  />
                  <span className='text-[8px] sm:text-[10px] font-black opacity-80 bg-black/10 dark:bg-white/10 px-1 rounded-md'>
                    {item.count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ticket List */}
      {ticketsLoading ? (
        <div className='space-y-3'>
          {[1, 2, 3].map((i) => (
            <Card key={i} className='p-6'>
              <div className='flex items-center gap-4'>
                <Skeleton className='h-10 w-10 rounded-full' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-5 w-48' />
                  <Skeleton className='h-4 w-64' />
                </div>
                <Skeleton className='h-9 w-9' />
              </div>
            </Card>
          ))}
        </div>
      ) : !filteredTickets || filteredTickets.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-16 sm:py-24 px-4 bg-white dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] transition-all duration-300'>
          <div className='relative mb-6'>
            <div className='absolute inset-0 bg-primary/10 blur-2xl rounded-full' />
            <div className='relative p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl ring-1 ring-slate-200 dark:ring-slate-700 shadow-xl'>
              <SearchX className='h-12 w-12 text-slate-400 dark:text-slate-500' />
            </div>
          </div>

          <h3 className='text-xl sm:text-2xl font-black text-slate-900 dark:text-white text-center mb-2'>
            {searchTerm || statusFilter !== STATUS_ALL
              ? 'Nenhum chamado encontrado'
              : 'Nenhum chamado cadastrado'}
          </h3>
          <p className='text-slate-500 dark:text-slate-400 text-center max-w-[280px] sm:max-w-md font-medium text-sm sm:text-base mb-8'>
            {searchTerm || statusFilter !== STATUS_ALL
              ? 'Não encontramos nenhum resultado para sua busca atual. Tente mudar os filtros.'
              : 'Você ainda não tem atendimentos agendados. Que tal criar o primeiro agora?'}
          </p>

          <Button
            onClick={handleCreate}
            className='h-12 px-8 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 gap-2'
          >
            <Plus className='h-5 w-5 stroke-[3px]' />
            Criar Chamado
          </Button>
        </div>
      ) : (
        <TicketList
          tickets={(filteredTickets || []) as any}
          onEdit={handleEdit as any}
          onDelete={(ticket) => setDeletingTicket(ticket as any)}
          onCheckIn={(ticket) => checkInMutation.mutate(ticket.id)}
          onFinish={(ticket) => setCompletingTicket(ticket as any)}
          onReschedule={handleReschedule as any}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateOpen || !!editingTicket}
        onOpenChange={(open) => {
          // Quando tentar fechar (botão X ou atalho), exibe confirmação de cancelamento
          if (!open) {
            setShowCancelConfirm(true);
          }
        }}
      >
        <DialogContent
          className='max-w-4xl max-h-[90vh] flex flex-col p-0 border-0 rounded-2xl overflow-hidden shadow-2xl'
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
                  <PlusCircle className='h-5 w-5' />
                </div>
                <div>
                  <DialogTitle className='text-xl font-black tracking-tight text-gray-900 dark:text-slate-100'>
                    {editingTicket ? 'Edição de Chamado' : 'Criação de Chamado'}
                  </DialogTitle>
                  <DialogDescription className='text-xs text-muted-foreground dark:text-slate-400'>
                    {editingTicket
                      ? 'Atualize as informações do chamado.'
                      : 'Preencha os detalhes abaixo para registrar um novo chamado de serviço.'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div
              ref={scrollContainerRef}
              className='flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin dark:bg-[#0f172a]'
            >
              {/* Seção: Informações Gerais */}
              <div className='relative'>
                <div className='flex items-center gap-2 mb-4 border-b border-border/50 dark:border-slate-800 pb-2'>
                  <ClipboardList className='h-4 w-4 text-primary' />
                  <h2 className='text-base font-bold text-gray-900 dark:text-slate-200'>
                    Informações Gerais
                  </h2>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-12 gap-4'>
                  {/* Busca por CPF/CNPJ - Coluna 1 a 7 */}
                  <div className='md:col-span-7 space-y-1.5'>
                    <div className='h-4 flex items-center ml-1'>
                      <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400'>
                        Buscar por {documentSearchLabel} (opcional)
                      </Label>
                    </div>
                    <div className='relative group'>
                      <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors' />
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
                        className='pl-10 h-11 bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-sm shadow-none dark:text-slate-200'
                        disabled={isSearchingClient}
                      />
                      {isSearchingClient && (
                        <Loader2 className='absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary' />
                      )}
                    </div>
                  </div>

                  {/* Filtro de Tipo - Coluna 8 a 12 */}
                  <div className='md:col-span-5 space-y-1.5'>
                    <div className='h-4 flex items-center ml-1'>
                      <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400'>
                        Filtrar Tipo
                      </Label>
                    </div>
                    <div className='flex gap-1.5 p-1 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800 rounded-xl h-11'>
                      {[
                        { id: 'PF', label: 'PF', icon: User },
                        { id: 'PJ', label: 'PJ', icon: Building2 },
                        {
                          id: 'EMPRESA_PARCEIRA',
                          label: 'Parceira',
                          icon: Briefcase,
                        },
                      ].map((type) => (
                        <button
                          key={type.id}
                          type='button'
                          onClick={() => {
                            setClientTypeFilter(type.id as ClientTypeKey);
                            setFormData({ ...formData, clientId: '' });
                            setClientSearchValue('');
                            setDocumentSearch('');
                          }}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 rounded-lg text-[10px] font-bold transition-all duration-300',
                            clientTypeFilter === type.id
                              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-gray-200 dark:ring-slate-700'
                              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                          )}
                        >
                          <type.icon className='h-3 w-3' />
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Seleção de Cliente - Coluna 1 a 8 */}
                  <div className='md:col-span-8 space-y-1.5'>
                    <div className='h-4 flex items-center ml-1'>
                      <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400'>
                        Cliente <span className='text-red-500'>*</span>
                      </Label>
                    </div>
                    <Popover
                      open={clientSearchOpen}
                      onOpenChange={setClientSearchOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant='outline'
                          className={cn(
                            'w-full justify-between h-11 bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 rounded-xl px-4 text-left font-medium shadow-none hover:bg-white dark:hover:bg-slate-800 transition-all text-sm dark:text-slate-200',
                            formErrors.clientId && 'input-error'
                          )}
                        >
                          <span className='truncate'>
                            {formData.clientId
                              ? (clients || []).find(
                                  (client) => client.id === formData.clientId
                                )?.name
                              : 'Selecione um cliente da lista...'}
                          </span>
                          <ChevronsUpDown className='h-4 w-4 opacity-40 shrink-0' />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className='w-[400px] p-0 rounded-xl shadow-2xl border-gray-100 dark:border-slate-800 overflow-hidden'
                        align='start'
                      >
                        <Command className='dark:bg-slate-900'>
                          <div className='flex items-center border-b border-gray-100 dark:border-slate-800 px-3'>
                            <Search className='mr-2 h-4 w-4 shrink-0 opacity-40' />
                            <CommandInput
                              placeholder='Pesquisar por nome...'
                              value={clientSearchValue}
                              onValueChange={setClientSearchValue}
                              className='border-none focus:ring-0 h-11 bg-transparent text-sm'
                            />
                          </div>
                          <CommandList className='max-h-[300px] scrollbar-thin'>
                            <CommandEmpty className='py-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2'>
                              <Search className='h-6 w-6 opacity-10' />
                              Nenhum cliente encontrado.
                            </CommandEmpty>
                            <CommandGroup className='p-1'>
                              <CommandItem
                                onSelect={handleNewClient}
                                className='flex items-center gap-2 p-3 rounded-lg bg-primary/5 text-primary font-bold hover:bg-primary/10 cursor-pointer mb-1.5 transition-all group text-xs'
                              >
                                <div className='p-1.5 bg-primary text-white rounded-md group-hover:scale-110 transition-transform'>
                                  <Plus className='h-3.5 w-3.5' />
                                </div>
                                Cadastrar Novo Cliente
                              </CommandItem>
                              <div className='px-2 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/50'>
                                Clientes Cadastrados
                              </div>
                              {filteredClients.map((client) => (
                                <CommandItem
                                  key={client.id}
                                  value={client.id}
                                  onSelect={() => {
                                    const selectedClient = client;
                                    setFormData((prev) => {
                                      const newData = {
                                        ...prev,
                                        clientId: selectedClient.id,
                                        ...(selectedClient.type !==
                                        'EMPRESA_PARCEIRA'
                                          ? { serviceAddress: '' }
                                          : {}),
                                      };

                                      // Auto-fill defaults for EMPRESA_PARCEIRA
                                      if (
                                        selectedClient.type ===
                                        'EMPRESA_PARCEIRA'
                                      ) {
                                        const formatVal = (v: any) =>
                                          v
                                            ? parseFloat(v).toLocaleString(
                                                'pt-BR',
                                                {
                                                  minimumFractionDigits: 2,
                                                  maximumFractionDigits: 2,
                                                }
                                              )
                                            : '';

                                        newData.ticketValue =
                                          formatVal(
                                            selectedClient.defaultTicketValue
                                          ) || prev.ticketValue;
                                        newData.kmRate =
                                          formatVal(
                                            selectedClient.defaultKmRate
                                          ) || prev.kmRate;
                                        newData.duration =
                                          selectedClient.defaultHoursIncluded ||
                                          prev.duration;
                                        newData.chargeType = 'VALOR_FIXO';
                                      } else {
                                        // For PF/PJ, clear partner fields
                                        newData.ticketNumber = '';
                                        newData.finalClient = '';
                                        // Endereço completo
                                        const fullAddr = [
                                          selectedClient.address,
                                          selectedClient.city,
                                          selectedClient.state,
                                        ]
                                          .filter(Boolean)
                                          .join(', ');
                                        newData.address =
                                          fullAddr ||
                                          selectedClient.address ||
                                          '';
                                      }

                                      return newData;
                                    });
                                    setClientSearchOpen(false);
                                  }}
                                  className='flex items-center gap-2 p-3 rounded-lg cursor-pointer hover:bg-primary/5 transition-all mb-0.5'
                                >
                                  <div
                                    className={cn(
                                      'h-4 w-4 border-2 rounded-full flex items-center justify-center transition-all shrink-0',
                                      formData.clientId === client.id
                                        ? 'bg-primary border-primary scale-110'
                                        : 'border-gray-200 dark:border-slate-700'
                                    )}
                                  >
                                    {formData.clientId === client.id && (
                                      <Check className='h-3 w-3 text-white' />
                                    )}
                                  </div>
                                  <span
                                    className={cn(
                                      'flex-1 text-xs font-medium truncate',
                                      formData.clientId === client.id
                                        ? 'text-primary font-bold'
                                        : 'text-gray-700 dark:text-slate-300'
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

                  {/* Número do Chamado - Coluna 9 a 12 */}
                  <div className='md:col-span-4 space-y-1.5'>
                    <div className='h-4 flex items-center ml-1'>
                      <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400'>
                        Nº Chamado
                      </Label>
                    </div>
                    <Input
                      id='ticketNumber'
                      value={formData.ticketNumber || nextTicketNumber || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ticketNumber: e.target.value,
                        })
                      }
                      placeholder={nextTicketNumber || '2024-0001'}
                      className={cn(
                        'h-11 bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 rounded-xl font-mono text-base tracking-wider focus:ring-2 focus:ring-primary/20 transition-all shadow-none dark:text-primary',
                        formErrors.ticketNumber && 'input-error'
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Seção: Detalhes do Serviço */}
              <div className='relative'>
                <div className='flex items-center justify-between mb-4 border-b border-border/50 dark:border-slate-800 pb-2'>
                  <div className='flex items-center gap-2'>
                    <MapPin className='h-4 w-4 text-primary' />
                    <h2 className='text-base font-bold text-gray-900 dark:text-slate-200'>
                      Detalhes do Serviço
                    </h2>
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
                    const enabledTypes = integrationSettings?.calculationsClientTypes || [
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
                  {/* Service Selection - Hidden for EMPRESA_PARCEIRA */}
                  {clients?.find((c) => c.id === formData.clientId)?.type !==
                    'EMPRESA_PARCEIRA' && (
                    <div className='space-y-1.5'>
                      <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400 ml-1 flex items-center gap-1'>
                        Serviço <span className='text-red-500'>*</span>
                      </Label>
                      <Select
                        value={formData.serviceId}
                        onValueChange={(value) => {
                          const selectedService = services?.find(
                            (s) => s.id === value
                          );
                          setFormData((prev) => {
                            const newData = { ...prev, serviceId: value };

                            // Auto-fill price for PF/PJ
                            const selectedClient = clients?.find(
                              (c) => c.id === prev.clientId
                            );
                            if (
                              selectedClient?.type !== 'EMPRESA_PARCEIRA' &&
                              selectedService
                            ) {
                              const formatVal = (v: any) =>
                                v
                                  ? parseFloat(v).toLocaleString('pt-BR', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })
                                  : '';
                              newData.ticketValue = formatVal(
                                selectedService.price
                              );
                              newData.duration =
                                selectedService.duration || prev.duration;
                            }

                            return newData;
                          });
                        }}
                        required
                      >
                        <SelectTrigger
                          id='service'
                          className={cn(
                            'h-11 bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 rounded-xl px-4 shadow-none text-sm dark:text-slate-200 transition-all',
                            formErrors.serviceId && 'input-error'
                          )}
                        >
                          <SelectValue placeholder='Selecione o tipo de serviço...' />
                        </SelectTrigger>
                        <SelectContent className='rounded-xl shadow-xl dark:bg-slate-900 dark:border-slate-800'>
                          {services?.map((service) => (
                            <SelectItem
                              key={service.id}
                              value={service.id}
                              className='p-2 rounded-lg cursor-pointer hover:bg-primary/5'
                            >
                              <div className='flex items-center justify-between w-full gap-4'>
                                <span className='font-bold text-xs'>
                                  {service.name}
                                </span>
                                <span className='text-primary font-black bg-primary/5 px-2 py-0.5 rounded-md text-[10px]'>
                                  R$ {Number(service.price).toFixed(2)}
                                </span>
                              </div>
                            </SelectItem>
                          )) || []}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Endereço do Cliente - Editável para PF e PJ Cliente Final */}
                  {(() => {
                    const selectedClient = clients?.find(
                      (c) => c.id === formData.clientId
                    );
                    const isEmpresaParceira =
                      selectedClient?.type === 'EMPRESA_PARCEIRA';
                    const isPfOrPj = selectedClient && !isEmpresaParceira;

                    if (isPfOrPj && selectedClient) {
                      return (
                        <div className='space-y-1.5'>
                          <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400 ml-1'>
                            Endereço de Execução
                          </Label>
                          <div className='relative'>
                            <MapPin className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
                            <Input
                              value={formData.address || ''}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  address: e.target.value,
                                })
                              }
                              placeholder='Digite o endereço onde o serviço será realizado...'
                              className='pl-10 h-11 bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 rounded-xl text-sm shadow-none dark:text-slate-200'
                            />
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Descrição do Chamado */}
                  <div className='space-y-1.5'>
                    <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400 ml-1'>
                      Descrição da Solicitação
                    </Label>
                    <div className='relative'>
                      <FileText className='absolute left-3 top-4 h-4 w-4 text-gray-400' />
                      <Textarea
                        value={formData.description || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        placeholder='Descreva detalhadamente o problema...'
                        className='pl-10 min-h-[100px] bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 rounded-xl shadow-none resize-none pr-4 py-3.5 text-sm leading-relaxed dark:text-slate-200'
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção: Agendamento */}
              <div className='relative'>
                <div className='flex items-center justify-between mb-4 border-b border-border/50 dark:border-slate-800 pb-2'>
                  <div className='flex items-center gap-2'>
                    <Clock className='h-4 w-4 text-primary' />
                    <h2 className='text-base font-bold text-gray-900 dark:text-slate-200'>
                      Agendamento
                    </h2>
                  </div>

                  {/* Status do Google Calendar */}
                  <div className='flex items-center gap-2'>
                    <div className='flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50'>
                      <Label
                        htmlFor='google-calendar-sync-toggle'
                        className='text-[10px] font-bold uppercase tracking-wider cursor-pointer'
                      >
                        Sincronizacao ativa
                      </Label>
                      <Switch
                        id='google-calendar-sync-toggle'
                        checked={isGoogleCalendarConnected}
                        onCheckedChange={handleGoogleCalendarToggle}
                        disabled={toggleGoogleCalendarSyncMutation.isPending}
                        className='scale-75'
                      />
                    </div>
                    <div
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all',
                        isGoogleCalendarConnected
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800'
                      )}
                    >
                      {isGoogleCalendarConnected ? (
                        <>
                          <div className='w-1 h-1 rounded-full bg-emerald-500 animate-pulse' />
                          Agenda Google Conectado
                        </>
                      ) : (
                        <>
                          <div className='w-1 h-1 rounded-full bg-amber-500' />
                          Agenda Google Desconectado
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className='bg-gray-50/50 dark:bg-slate-900/30 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden relative'>
                  <div
                    className='flex transition-transform duration-500 ease-in-out w-[200%]'
                    style={{
                      transform:
                        schedulingStep === 'time'
                          ? 'translateX(-50%)'
                          : 'translateX(0)',
                    }}
                  >
                    {/* Lado 1: Calendário */}
                    <div className='w-1/2 p-4 space-y-4 shrink-0'>
                      <div className='flex items-center justify-between px-1 shrink-0'>
                        <h3 className='text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-slate-400'>
                          Selecione a Data:{' '}
                          {format(currentMonth, 'MMMM yyyy', {
                            locale: ptBR,
                          })}
                        </h3>
                        <div className='flex gap-1'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            onClick={() =>
                              setCurrentMonth(subMonths(currentMonth, 1))
                            }
                            className='h-7 w-7 rounded-md hover:bg-primary/10'
                          >
                            <ChevronLeft className='h-3.5 w-3.5' />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            onClick={() =>
                              setCurrentMonth(addMonths(currentMonth, 1))
                            }
                            className='h-7 w-7 rounded-md hover:bg-primary/10'
                          >
                            <ChevronRight className='h-3.5 w-3.5' />
                          </Button>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'bg-white dark:bg-slate-900/80 rounded-2xl p-4 border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden min-h-[320px] flex items-center justify-center transition-all',
                          formErrors.scheduledDate && 'input-error'
                        )}
                      >
                        <Calendar
                          mode='single'
                          selected={selectedDate}
                          onSelect={(date) => {
                            if (date) {
                              setSelectedDate(date);
                              setSelectedTime('');
                              setSchedulingStep('time');
                            }
                          }}
                          month={currentMonth}
                          onMonthChange={(month) =>
                            month && setCurrentMonth(startOfMonth(month))
                          }
                          locale={ptBR}
                          className='w-full'
                          classNames={{
                            months: 'w-full',
                            month: 'w-full space-y-4',
                            caption: 'hidden',
                            table: 'w-full border-collapse',
                            head_row: 'flex w-full',
                            head_cell:
                              'text-muted-foreground dark:text-slate-500 rounded-md flex-1 font-bold text-[10px] uppercase tracking-widest py-3',
                            row: 'flex w-full mt-2',
                            cell: 'flex-1 text-center p-0 relative focus-within:relative focus-within:z-20',
                            day: 'h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 p-0 font-medium aria-selected:opacity-100 hover:bg-primary/10 hover:text-primary rounded-xl transition-all mx-auto flex items-center justify-center text-sm sm:text-base dark:text-slate-300 border border-transparent',
                            day_selected:
                              'bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white shadow-xl shadow-primary/30 scale-110 z-10 border-primary',
                            day_today:
                              'bg-primary/10 text-primary font-black border-primary/20',
                            day_outside:
                              'text-muted-foreground/40 dark:text-slate-600 opacity-50',
                            day_disabled:
                              'text-muted-foreground/30 dark:text-slate-700 opacity-40 cursor-not-allowed',
                          }}
                          disabled={(date) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            if (date < today) return true;
                            if (!workingDaysSet.has(date.getDay())) {
                              return true;
                            }
                            if (
                              isGoogleCalendarConnected &&
                              unavailableDaysSet &&
                              unavailableDaysSet.size > 0
                            ) {
                              const dateStr = date.toISOString().split('T')[0];
                              return unavailableDaysSet.has(dateStr);
                            }
                            return false;
                          }}
                        />
                      </div>
                    </div>

                    {/* Lado 2: Horários */}
                    <div className='w-1/2 p-4 space-y-4 shrink-0'>
                      <div
                        className={cn(
                          'bg-white dark:bg-slate-900/80 rounded-xl border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col shadow-sm min-h-[320px] transition-all',
                          formErrors.scheduledTime && 'input-error'
                        )}
                      >
                        <div className='p-4 space-y-4 flex-1 overflow-y-auto scrollbar-thin'>
                          <div className='grid grid-cols-[1fr_auto_1fr] items-center mb-2 shrink-0 px-1'>
                            <div className='flex items-center gap-2'>
                              <Clock className='h-3.5 w-3.5 text-primary' />
                              <h3 className='text-[10px] font-black uppercase tracking-widest text-muted-foreground'>
                                Horários Disponíveis
                              </h3>
                            </div>
                            {selectedDateLabel ? (
                              <div className='text-[11px] font-bold text-primary tracking-wide text-center bg-primary/10 border border-primary/20 rounded-md px-2 py-1 shadow-sm'>
                                {selectedDateLabel}
                              </div>
                            ) : (
                              <div />
                            )}
                            <div className='justify-self-end'>
                              <Button
                                type='button'
                                variant='ghost'
                                size='sm'
                                onClick={() => setSchedulingStep('calendar')}
                                className='h-7 gap-1 px-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors hover:bg-primary/5 rounded-lg'
                              >
                                <ChevronLeft className='h-3 w-3' />
                                Voltar
                              </Button>
                            </div>
                          </div>

                          {isAvailabilityLoading ? (
                            <div className='flex flex-col items-center justify-center py-12 text-center space-y-3'>
                              <div className='p-3 bg-slate-50 dark:bg-slate-900/40 rounded-full'>
                                <Loader2 className='h-6 w-6 text-slate-300 dark:text-slate-600 animate-spin' />
                              </div>
                              <p className='text-xs text-muted-foreground font-bold'>
                                Carregando horarios...
                              </p>
                            </div>
                          ) : availableTimes.length === 0 ? (
                            <div className='flex flex-col items-center justify-center py-12 text-center space-y-3'>
                              <div className='p-3 bg-red-50 dark:bg-red-900/10 rounded-full'>
                                <XCircle className='h-6 w-6 text-red-300 dark:text-red-900/50' />
                              </div>
                              <p className='text-xs text-red-500 font-bold'>
                                Sem horários para este dia
                              </p>
                            </div>
                          ) : (
                            <div className='grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3'>
                              {availableTimes.map((time) => {
                                const isSelected = selectedTime === time;
                                return (
                                  <button
                                    key={time}
                                    type='button'
                                    onClick={() => setSelectedTime(time)}
                                    className={cn(
                                      'flex items-center justify-center py-4 sm:py-6 rounded-xl border text-sm sm:text-base font-black transition-all relative',
                                      isSelected
                                        ? 'bg-primary border-primary text-white shadow-xl shadow-primary/30 scale-105 z-10'
                                        : 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-primary/50 hover:text-primary hover:bg-white dark:hover:bg-slate-700 hover:shadow-md'
                                    )}
                                  >
                                    {time}
                                    {isSelected && (
                                      <div className='absolute -top-1 -right-1 bg-white text-primary rounded-full p-0.5 shadow-sm'>
                                        <Check className='h-2.5 w-2.5' />
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção: Empresa Parceira */}
              {clients?.find((c) => c.id === formData.clientId)?.type ===
                'EMPRESA_PARCEIRA' && (
                <div className='relative'>
                  <div className='flex items-center gap-2 mb-4 border-b border-border/50 dark:border-slate-800 pb-2'>
                    <Building2 className='h-4 w-4 text-primary' />
                    <h2 className='text-base font-bold text-gray-900 dark:text-slate-200'>
                      Empresa Parceira
                    </h2>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4 bg-primary/5 dark:bg-primary/5 p-4 rounded-xl border border-primary/20'>
                    <div className='space-y-1.5'>
                      <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400 ml-1'>
                        Valor do Repasse (R$)
                      </Label>
                      <div className='relative'>
                        <span className='absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary'>
                          R$
                        </span>
                        <Input
                          id='ticketValue'
                          type='text'
                          value={formData.ticketValue}
                          onChange={(e) =>
                            handleCurrencyChange('ticketValue', e.target.value)
                          }
                          placeholder='0,00'
                          required
                          className={cn(
                            'pl-8 h-11 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary/20 text-base font-bold shadow-none dark:text-slate-200 transition-all',
                            formErrors.ticketValue && 'input-error'
                          )}
                        />
                      </div>
                    </div>

                    <div className='space-y-1.5'>
                      <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400 ml-1'>
                        Hora Adicional (R$)
                      </Label>
                      <div className='relative'>
                        <span className='absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary'>
                          R$
                        </span>
                        <Input
                          id='additionalHourRate'
                          type='text'
                          value={formData.additionalHourRate || ''}
                          onChange={(e) =>
                            handleCurrencyChange(
                              'additionalHourRate',
                              e.target.value
                            )
                          }
                          placeholder='0,00'
                          className='pl-8 h-11 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary/20 text-base font-bold shadow-none dark:text-slate-200'
                        />
                      </div>
                    </div>

                    <div className='space-y-1.5'>
                      <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400 ml-1'>
                        Tipo de Cobrança
                      </Label>
                      <div className='relative'>
                        <Select
                          value={formData.chargeType}
                          onValueChange={(v: any) =>
                            setFormData({ ...formData, chargeType: v })
                          }
                        >
                          <SelectTrigger className='h-11 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 rounded-xl text-xs shadow-none dark:text-slate-200'>
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
                    </div>

                    <div className='space-y-1.5'>
                      <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400 ml-1'>
                        Aprovado por
                      </Label>
                      <div className='relative'>
                        <User className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
                        <Input
                          value={formData.approvedBy}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              approvedBy: e.target.value,
                            })
                          }
                          className='pl-10 h-11 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 rounded-xl text-sm shadow-none dark:text-slate-200'
                        />
                      </div>
                    </div>

                    <div className='space-y-1.5 md:col-span-2'>
                      <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400 ml-1'>
                        Endereço do Atendimento
                      </Label>
                      <div className='relative'>
                        <MapPin className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
                        <Input
                          value={formData.serviceAddress}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              serviceAddress: e.target.value,
                            })
                          }
                          placeholder='Rua, número, bairro, cidade...'
                          className={cn(
                            'pl-10 h-11 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 rounded-xl text-sm shadow-none dark:text-slate-200 transition-all',
                            formErrors.serviceAddress && 'input-error'
                          )}
                        />
                      </div>
                    </div>

                    <div className='space-y-1.5'>
                      <Label className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400 ml-1'>
                        Cliente Final
                      </Label>
                      <div className='relative'>
                        <Building2 className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
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
                            'pl-10 h-11 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 rounded-xl text-sm shadow-none dark:text-slate-200 transition-all',
                            formErrors.finalClient && 'input-error'
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className='p-4 sm:p-5 bg-white dark:bg-slate-900 border-t border-border/50 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]'>
              <div className='flex-1 flex flex-col min-w-0 animate-in fade-in slide-in-from-left-2'>
                {selectedDate && selectedTime && (
                  <>
                    <div className='flex items-center gap-2'>
                      <span className='text-[10px] font-black uppercase tracking-wider text-primary'>
                        Agendamento:
                      </span>
                      <span className='text-sm font-bold text-slate-900 dark:text-white'>
                        {format(selectedDate, 'dd/MM')} às {selectedTime}
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
                  onClick={() => setShowCancelConfirm(true)}
                  className='h-9 sm:h-10 w-9 sm:w-auto px-0 sm:px-6 rounded-xl font-bold text-xs sm:text-sm dark:text-slate-400 dark:hover:text-slate-200'
                >
                  <X className='h-5 w-5 sm:hidden' />
                  <span className='hidden sm:inline'>Cancelar</span>
                </Button>
                <Button
                  type='submit'
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className='h-9 sm:h-10 w-9 sm:w-auto px-0 sm:px-8 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 text-xs sm:text-sm flex items-center justify-center gap-2'
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <>
                      <Check className='h-5 w-5 sm:hidden' />
                      <span className='hidden sm:inline'>
                        {editingTicket ? 'Salvar Alterações' : 'Criar Chamado'}
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingTicket}
        onOpenChange={(open) => !open && setDeletingTicket(null)}
      >
        <AlertDialogContent className='bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-[#111418] dark:text-white text-2xl font-bold leading-tight tracking-tight'>
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className='text-[#60708a] dark:text-gray-400 text-base font-normal leading-normal'>
              Tem certeza que deseja excluir este chamado? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end gap-4 pt-4 border-t dark:border-gray-700'>
            <AlertDialogCancel
              data-testid='button-cancel-delete'
              className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-gray-100 dark:bg-gray-700 text-[#111418] dark:text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-200 dark:hover:bg-gray-600'
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-red-600 text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700'
              data-testid='button-confirm-delete'
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Client Dialog */}
      <Dialog
        open={isNewClientOpen}
        onOpenChange={(open) => {
          if (open) return;
          if (showNewClientFields) {
            setShowCancelClientConfirm(true);
            return;
          }
          setIsNewClientOpen(false);
          resetNewClientForm();
        }}
      >
        <DialogContent
          className='max-w-2xl w-[95vw] sm:w-full bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 max-h-[95vh] overflow-y-auto'
          onInteractOutside={(e) => e.preventDefault()}
        >
          <form onSubmit={handleCreateClient}>
            <DialogHeader>
              <DialogTitle
                data-testid='text-new-client-title'
                className='text-[#111418] dark:text-white text-3xl font-bold leading-tight tracking-tight'
              >
                Cadastro/Edição de Cliente
              </DialogTitle>
              <DialogDescription className='text-[#60708a] dark:text-gray-400 text-base font-normal leading-normal'>
                Preencha os dados do novo cliente.
              </DialogDescription>
            </DialogHeader>

            <div className='bg-white dark:bg-gray-900/50 rounded-xl shadow-sm p-8 space-y-6'>
              {/* Campo CPF/CNPJ - Sempre visível primeiro */}
              {!showNewClientFields && newClientData.type === 'PJ' && (
                <div className='space-y-2'>
                  <label className='flex flex-col'>
                    <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                      CPF ou CNPJ *
                    </p>
                    <div className='flex gap-2'>
                      <Input
                        id='newClientDocument'
                        value={newClientData.document}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          lastNewClientCnpjRef.current = null;
                          setNewClientData({
                            ...newClientData,
                            document: value,
                          });
                        }}
                        onBlur={async (e) => {
                          const cleanDocument = e.currentTarget.value.replace(/\D/g, '');
                          if (cleanDocument.length === 11 || cleanDocument.length === 14) {
                            await handleAdvanceNewClient();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAdvanceNewClient();
                          }
                        }}
                        placeholder='Digite CPF (11 dígitos) ou CNPJ (14 dígitos) sem formatação'
                        required
                        data-testid='input-new-client-document'
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                      />
                    </div>
                    {existingNewClient && (
                      <div className='p-3 rounded-md border border-red-500 bg-red-50 dark:bg-red-950'>
                        <p className='text-sm text-red-700 dark:text-red-400 font-medium'>
                          ⚠️ Cliente já cadastrado:{' '}
                          {existingNewClient.name || existingNewClient.legalName}
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              )}

              {/* Campos do formulario - aparecem ao sair do CPF/CNPJ */}
              {showNewClientFields && (
                <>
                  {/* EMPRESA_PARCEIRA - Formulário Completo */}
                  {newClientData.type === 'EMPRESA_PARCEIRA' ? (
                    <>
                      {/* Seção: Dados da Empresa */}
                      <div className='space-y-6'>
                        <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                          Dados da Empresa
                        </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              CNPJ *
                            </p>
                            <Input
                              id='newClientDocumentDisplay'
                              value={maskCNPJ(newClientData.document)}
                              onBlur={handleNewClientCnpjBlur}
                              onChange={(e) => {
                                lastNewClientCnpjRef.current = null;
                                setNewClientData({
                                  ...newClientData,
                                  document: maskCNPJ(e.target.value),
                                });
                              }}
                              placeholder='00.000.000/0000-00'
                              data-testid='input-new-client-document'
                              maxLength={18}
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Razão Social *
                            </p>
                            <Input
                              id='newClientLegalName'
                              value={newClientData.legalName}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  legalName: e.target.value,
                                })
                              }
                              data-testid='input-new-client-legal-name'
                              required
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Empresa (Nome Fantasia)
                            </p>
                            <Input
                              id='newClientName'
                              value={newClientData.name}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  name: e.target.value,
                                })
                              }
                              data-testid='input-new-client-name'
                              className={cn(
                                'flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal',
                                newClientErrors.name && 'input-error'
                              )}
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Inscrição Municipal
                            </p>
                            <Input
                              id='newClientMunicipalRegistration'
                              value={newClientData.municipalRegistration}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  municipalRegistration: e.target.value,
                                })
                              }
                              data-testid='input-new-client-municipal-registration'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Inscrição Estadual
                            </p>
                            <Input
                              id='newClientStateRegistration'
                              value={newClientData.stateRegistration}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  stateRegistration: e.target.value,
                                })
                              }
                              data-testid='input-new-client-state-registration'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Modelo RAT/OS
                            </p>
                            <select
                              id='newClientRatTemplateId'
                              value={newClientData.ratTemplateId || ''}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  ratTemplateId: e.target.value,
                                })
                              }
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 px-4 text-base font-normal leading-normal'
                            >
                              <option value=''>Nenhum</option>
                              {serviceOrderTemplates.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              E-mail
                            </p>
                            <Input
                              id='newClientEmail'
                              type='email'
                              value={newClientData.email}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  email: e.target.value,
                                })
                              }
                              data-testid='input-new-client-email'
                              placeholder='contato@empresa.com'
                              required
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Telefone *
                            </p>
                            <Input
                              id='newClientPhone'
                              value={newClientData.phone}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  phone: maskPhone(e.target.value),
                                })
                              }
                              required
                              data-testid='input-new-client-phone'
                              placeholder='(00) 00000-0000'
                              maxLength={15}
                              className={cn(
                                'flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal',
                                newClientErrors.phone && 'input-error'
                              )}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Seção: Endereço */}
                      <div className='space-y-6'>
                        <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                          Endereço
                        </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              CEP
                            </p>
                            <Input
                              id='newClientZipCode'
                              value={newClientData.zipCode}
                              onChange={(e) => {
                                const value = e.target.value;
                                const masked = maskCEP(value);
                                setNewClientData({
                                  ...newClientData,
                                  zipCode: masked,
                                });
                              }}
                              onBlur={async () => {
                                const cleanCep = newClientData.zipCode.replace(
                                  /\D/g,
                                  ''
                                );
                                if (cleanCep.length !== 8) return;
                                try {
                                  const cepData = await fetchCepData(cleanCep);
                                  if (cepData) {
                                    setNewClientData((prev) => ({
                                      ...prev,
                                      zipCode: maskCEP(cepData.cep || cleanCep),
                                      streetAddress:
                                        prev.streetAddress?.trim() ||
                                        cepData.street ||
                                        '',
                                      neighborhood:
                                        prev.neighborhood?.trim() ||
                                        cepData.neighborhood ||
                                        '',
                                      city:
                                        prev.city?.trim() ||
                                        cepData.city ||
                                        '',
                                      state:
                                        prev.state?.trim() ||
                                        (cepData.state
                                          ? cepData.state.toUpperCase()
                                          : ''),
                                      addressComplement:
                                        prev.addressComplement?.trim() ||
                                        cepData.complement ||
                                        '',
                                    }));
                                  }
                                } catch (error) {
                                  console.error(
                                    'Erro ao buscar CEP no blur:',
                                    error
                                  );
                                }
                              }}
                              placeholder='00000-000'
                              data-testid='input-new-client-zip-code'
                              maxLength={9}
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col md:col-span-2'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Rua / Logradouro
                            </p>
                            <Input
                              id='newClientStreetAddress'
                              value={newClientData.streetAddress}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  streetAddress: e.target.value,
                                })
                              }
                              data-testid='input-new-client-street-address'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Número
                            </p>
                            <Input
                              id='newClientAddressNumber'
                              value={newClientData.addressNumber}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  addressNumber: e.target.value,
                                })
                              }
                              data-testid='input-new-client-address-number'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Complemento
                            </p>
                            <Input
                              id='newClientAddressComplement'
                              value={newClientData.addressComplement}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  addressComplement: e.target.value,
                                })
                              }
                              data-testid='input-new-client-address-complement'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Bairro / Distrito
                            </p>
                            <Input
                              id='newClientNeighborhood'
                              value={newClientData.neighborhood}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  neighborhood: e.target.value,
                                })
                              }
                              data-testid='input-new-client-neighborhood'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Estado
                            </p>
                            <Input
                              id='newClientState'
                              value={newClientData.state}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  state: e.target.value,
                                })
                              }
                              maxLength={2}
                              placeholder='UF'
                              data-testid='input-new-client-state'
                              className={cn(
                                'flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal',
                                newClientErrors.state && 'input-error'
                              )}
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Cidade
                            </p>
                            <Input
                              id='newClientCity'
                              value={newClientData.city}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  city: e.target.value,
                                })
                              }
                              data-testid='input-new-client-city'
                              className={cn(
                                'flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal',
                                newClientErrors.city && 'input-error'
                              )}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Secao: Ciclo de Pagamento */}
                      <div className='space-y-6'>
                        <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                          Ciclo de Pagamento
                        </h3>
                        <p className='text-sm text-[#60708a] dark:text-gray-400'>
                          Define o periodo de fechamento mensal e data de
                          pagamento
                        </p>
                        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Inicio do Ciclo (dia)
                            </p>
                            <Input
                              id='newClientPaymentCycleStartDay'
                              type='number'
                              min='1'
                              max='31'
                              value={newClientData.paymentCycleStartDay}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  paymentCycleStartDay:
                                    parseInt(e.target.value) || 1,
                                })
                              }
                              data-testid='input-payment-cycle-start'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Fim do Ciclo (dia)
                            </p>
                            <Input
                              id='newClientPaymentCycleEndDay'
                              type='number'
                              min='1'
                              max='31'
                              value={newClientData.paymentCycleEndDay}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  paymentCycleEndDay:
                                    parseInt(e.target.value) || 30,
                                })
                              }
                              data-testid='input-payment-cycle-end'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <div className='space-y-2'>
                            <Label htmlFor='newClientPaymentDueDay'>
                              Pagamento (dia mes seguinte)
                            </Label>
                            <Input
                              id='newClientPaymentDueDay'
                              type='number'
                              min='1'
                              max='31'
                              value={newClientData.paymentDueDay}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  paymentDueDay:
                                    parseInt(e.target.value) || 5,
                                })
                              }
                              data-testid='input-payment-due-day'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </div>
                        </div>
                      </div>

                      {/* Secao: Valores Padrao */}
                      <div className='space-y-6'>
                        <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                          Valores Padrao
                        </h3>
                        <p className='text-sm text-[#60708a] dark:text-gray-400'>
                          Estes valores serao pre-preenchidos automaticamente ao
                          criar chamados
                        </p>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Valor Chamado (R$)
                            </p>
                            <Input
                              id='newClientDefaultTicketValue'
                              value={newClientData.defaultTicketValue}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  defaultTicketValue: maskCurrency(
                                    e.target.value
                                  ),
                                })
                              }
                              placeholder='0,00'
                              data-testid='input-default-ticket-value'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Ate x Horas
                            </p>
                            <Input
                              id='newClientDefaultHoursIncluded'
                              type='number'
                              min='1'
                              value={newClientData.defaultHoursIncluded}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  defaultHoursIncluded:
                                    parseInt(e.target.value) || 3,
                                })
                              }
                              placeholder='3'
                              data-testid='input-default-hours-included'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Valor Hora Adicional (R$)
                            </p>
                            <Input
                              id='newClientDefaultAdditionalHourRate'
                              value={newClientData.defaultAdditionalHourRate}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  defaultAdditionalHourRate: maskCurrency(
                                    e.target.value
                                  ),
                                })
                              }
                              placeholder='0,00'
                              data-testid='input-default-additional-hour-rate'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Valor KM (R$/km)
                            </p>
                            <Input
                              id='newClientDefaultKmRate'
                              value={newClientData.defaultKmRate}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  defaultKmRate: maskCurrency(e.target.value),
                                })
                              }
                              placeholder='0,00'
                              data-testid='input-default-km-rate'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>
                        </div>
                      </div>

                      {/* Secao: Planilha Mensal */}
                      <div className='space-y-4'>
                        <div className='flex items-center justify-between p-4 rounded-lg border border-black/20 dark:border-border bg-white dark:bg-card shadow-sm'>
                          <div className='space-y-0.5'>
                            <Label
                              htmlFor='newClientMonthlySpreadsheet'
                              className='text-base'
                            >
                              Planilha Mensal
                            </Label>
                            <p className='text-sm text-muted-foreground'>
                              Gerar planilha automatica de chamados mensalmente
                            </p>
                          </div>
                          <Switch
                            id='newClientMonthlySpreadsheet'
                            checked={newClientData.monthlySpreadsheet === true}
                            onCheckedChange={(checked) => {
                              setNewClientData({
                                ...newClientData,
                                monthlySpreadsheet: checked,
                              });
                            }}
                            data-testid='switch-monthly-spreadsheet'
                          />
                        </div>

                        {newClientData.monthlySpreadsheet && (
                          <div className='p-4 rounded-lg border border-black/20 dark:border-border bg-white dark:bg-muted/30 shadow-sm'>
                            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                              <div className='space-y-2'>
                                <Label htmlFor='newClientSpreadsheetDay'>
                                  Dia de Envio
                                </Label>
                                <Input
                                  id='newClientSpreadsheetDay'
                                  type='number'
                                  min='1'
                                  max='31'
                                  value={newClientData.spreadsheetDay}
                                  onChange={(e) =>
                                    setNewClientData({
                                      ...newClientData,
                                      spreadsheetDay:
                                        parseInt(e.target.value) || 1,
                                    })
                                  }
                                  placeholder='1'
                                  data-testid='input-spreadsheet-day'
                                  className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                                />
                                <p className='text-xs text-muted-foreground'>
                                  Dia do mes para envio automatico (1-31)
                                </p>
                              </div>
                              <div className='space-y-2'>
                                <Label htmlFor='newClientSpreadsheetEmail'>
                                  Email para Envio
                                </Label>
                                <Input
                                  id='newClientSpreadsheetEmail'
                                  type='email'
                                  value={newClientData.spreadsheetEmail}
                                  onChange={(e) =>
                                    setNewClientData({
                                      ...newClientData,
                                      spreadsheetEmail: e.target.value,
                                    })
                                  }
                                  placeholder='financeiro@empresa.com'
                                  data-testid='input-spreadsheet-email'
                                  className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                                />
                                <p className='text-xs text-muted-foreground'>
                                  Email que recebera a planilha mensal
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : newClientData.type === 'PJ' ? (
                    <>
                      {/* Secao: Dados da Empresa */}
                      <div className='space-y-6'>
                        <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                          Dados da Empresa
                        </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              CNPJ *
                            </p>
                            <Input
                              id='newClientDocumentDisplay'
                              value={maskCNPJ(newClientData.document)}
                              onBlur={handleNewClientCnpjBlur}
                              onChange={(e) => {
                                lastNewClientCnpjRef.current = null;
                                setNewClientData({
                                  ...newClientData,
                                  document: maskCNPJ(e.target.value),
                                });
                              }}
                              placeholder='00.000.000/0000-00'
                              data-testid='input-new-client-document'
                              maxLength={18}
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Razao Social *
                            </p>
                            <Input
                              id='newClientLegalName'
                              value={newClientData.legalName}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  legalName: e.target.value,
                                })
                              }
                              data-testid='input-new-client-legal-name'
                              required
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Nome Fantasia
                            </p>
                            <Input
                              id='newClientName'
                              value={newClientData.name}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  name: e.target.value,
                                })
                              }
                              data-testid='input-new-client-name'
                              className={cn(
                                'flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal',
                                newClientErrors.name && 'input-error'
                              )}
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Inscricao Estadual
                            </p>
                            <Input
                              id='newClientStateRegistration'
                              value={newClientData.stateRegistration}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  stateRegistration: e.target.value,
                                })
                              }
                              data-testid='input-new-client-state-registration'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              E-mail
                            </p>
                            <Input
                              id='newClientEmail'
                              type='email'
                              value={newClientData.email}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  email: e.target.value,
                                })
                              }
                              data-testid='input-new-client-email'
                              placeholder='contato@empresa.com'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Telefone *
                            </p>
                            <Input
                              id='newClientPhone'
                              value={newClientData.phone}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  phone: maskPhone(e.target.value),
                                })
                              }
                              required
                              data-testid='input-new-client-phone'
                              placeholder='(00) 00000-0000'
                              maxLength={15}
                              className={cn(
                                'flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal',
                                newClientErrors.phone && 'input-error'
                              )}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Seção: Endereço */}
                      <div className='space-y-6'>
                        <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                          Endereço
                        </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              CEP
                            </p>
                            <Input
                              id='newClientZipCode'
                              value={newClientData.zipCode}
                              onChange={(e) => {
                                const value = e.target.value;
                                const masked = maskCEP(value);
                                setNewClientData({
                                  ...newClientData,
                                  zipCode: masked,
                                });
                              }}
                              onBlur={async () => {
                                const cleanCep = newClientData.zipCode.replace(
                                  /\D/g,
                                  ''
                                );
                                if (cleanCep.length !== 8) return;
                                try {
                                  const cepData = await fetchCepData(cleanCep);
                                  if (cepData) {
                                    setNewClientData((prev) => ({
                                      ...prev,
                                      zipCode: maskCEP(cepData.cep || cleanCep),
                                      streetAddress:
                                        prev.streetAddress?.trim() ||
                                        cepData.street ||
                                        '',
                                      neighborhood:
                                        prev.neighborhood?.trim() ||
                                        cepData.neighborhood ||
                                        '',
                                      city:
                                        prev.city?.trim() ||
                                        cepData.city ||
                                        '',
                                      state:
                                        prev.state?.trim() ||
                                        (cepData.state
                                          ? cepData.state.toUpperCase()
                                          : ''),
                                      addressComplement:
                                        prev.addressComplement?.trim() ||
                                        cepData.complement ||
                                        '',
                                    }));
                                  }
                                } catch (error) {
                                  console.error(
                                    'Erro ao buscar CEP no blur:',
                                    error
                                  );
                                }
                              }}
                              placeholder='00000-000'
                              data-testid='input-new-client-zip-code'
                              maxLength={9}
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col md:col-span-2'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Rua / Logradouro
                            </p>
                            <Input
                              id='newClientStreetAddress'
                              value={newClientData.streetAddress}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  streetAddress: e.target.value,
                                })
                              }
                              data-testid='input-new-client-street-address'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Número
                            </p>
                            <Input
                              id='newClientAddressNumber'
                              value={newClientData.addressNumber}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  addressNumber: e.target.value,
                                })
                              }
                              data-testid='input-new-client-address-number'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Complemento
                            </p>
                            <Input
                              id='newClientAddressComplement'
                              value={newClientData.addressComplement}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  addressComplement: e.target.value,
                                })
                              }
                              data-testid='input-new-client-address-complement'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Bairro / Distrito
                            </p>
                            <Input
                              id='newClientNeighborhood'
                              value={newClientData.neighborhood}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  neighborhood: e.target.value,
                                })
                              }
                              data-testid='input-new-client-neighborhood'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Estado
                            </p>
                            <Input
                              id='newClientState'
                              value={newClientData.state}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  state: e.target.value,
                                })
                              }
                              maxLength={2}
                              placeholder='UF'
                              data-testid='input-new-client-state'
                              className={cn(
                                'flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal',
                                newClientErrors.state && 'input-error'
                              )}
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Cidade
                            </p>
                            <Input
                              id='newClientCity'
                              value={newClientData.city}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  city: e.target.value,
                                })
                              }
                              data-testid='input-new-client-city'
                              className={cn(
                                'flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal',
                                newClientErrors.city && 'input-error'
                              )}
                            />
                          </label>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Secao: Dados Pessoais */}
                      <div className='space-y-6'>
                        <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                          Dados Pessoais
                        </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Nome *
                            </p>
                            <Input
                              id='newClientName'
                              value={newClientData.name}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  name: e.target.value,
                                })
                              }
                              data-testid='input-new-client-name'
                              className={cn(
                                'flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal',
                                newClientErrors.name && 'input-error'
                              )}
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              CPF *
                            </p>
                            <Input
                              id='newClientCpf'
                              value={maskCPF(newClientData.document)}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  document: maskCPF(e.target.value),
                                })
                              }
                              placeholder='000.000.000-00'
                              data-testid='input-new-client-cpf'
                              maxLength={14}
                              required
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          {newClientData.type !== 'PF' && (
                            <label className='flex flex-col'>
                              <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                CNPJ *
                              </p>
                              <Input
                                id='newClientDocumentDisplay'
                                value={maskCNPJ(newClientData.document)}
                                onBlur={handleNewClientCnpjBlur}
                                onChange={(e) => {
                                  lastNewClientCnpjRef.current = null;
                                  setNewClientData({
                                    ...newClientData,
                                    document: maskCNPJ(e.target.value),
                                  });
                                }}
                                placeholder='00.000.000/0000-00'
                                data-testid='input-new-client-document'
                                maxLength={18}
                                className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                              />
                            </label>
                          )}

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              E-mail
                            </p>
                            <Input
                              id='newClientEmail'
                              type='email'
                              value={newClientData.email}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  email: e.target.value,
                                })
                              }
                              data-testid='input-new-client-email'
                              placeholder='contato@email.com'
                              className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                            />
                          </label>

                          <label className='flex flex-col'>
                            <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                              Telefone *
                            </p>
                            <Input
                              id='newClientPhone'
                              value={newClientData.phone}
                              onChange={(e) =>
                                setNewClientData({
                                  ...newClientData,
                                  phone: maskPhone(e.target.value),
                                })
                              }
                              required
                              data-testid='input-new-client-phone'
                              placeholder='(00) 00000-0000'
                              maxLength={15}
                              className={cn(
                                'flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal',
                                newClientErrors.phone && 'input-error'
                              )}
                            />
                          </label>
                        </div>

                        <div className='space-y-6 mt-6'>
                          <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] border-b dark:border-gray-700 pb-3'>
                            Endereço
                          </h3>
                          <div className='flex gap-3'>
                            <label className='flex flex-col flex-1'>
                              <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                CEP *
                              </p>
                              <Input
                                id='newClientZipCode'
                                value={newClientData.zipCode}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const masked = maskCEP(value);
                                  setNewClientData({
                                    ...newClientData,
                                    zipCode: masked,
                                  });
                                }}
                                onBlur={handleSearchNewClientCep}
                                placeholder='00000-000'
                                data-testid='input-new-client-zipcode'
                                maxLength={9}
                                className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                              />
                            </label>
                          </div>

                            <div className='space-y-4'>
                              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                                <label className='flex flex-col md:col-span-2'>
                                  <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                    Rua / Logradouro
                                  </p>
                                  <Input
                                    id='newClientStreetAddress'
                                    value={newClientData.streetAddress}
                                    onChange={(e) =>
                                      setNewClientData({
                                        ...newClientData,
                                        streetAddress: e.target.value,
                                      })
                                    }
                                    data-testid='input-new-client-street-address'
                                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                                  />
                                </label>
                                <label className='flex flex-col'>
                                  <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                    Numero
                                  </p>
                                  <Input
                                    id='newClientAddressNumber'
                                    value={newClientData.addressNumber}
                                    onChange={(e) =>
                                      setNewClientData({
                                        ...newClientData,
                                        addressNumber: e.target.value,
                                      })
                                    }
                                    data-testid='input-new-client-address-number'
                                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                                  />
                                </label>
                                <label className='flex flex-col'>
                                  <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                    Complemento
                                  </p>
                                  <Input
                                    id='newClientAddressComplement'
                                    value={newClientData.addressComplement}
                                    onChange={(e) =>
                                      setNewClientData({
                                        ...newClientData,
                                        addressComplement: e.target.value,
                                      })
                                    }
                                    data-testid='input-new-client-address-complement'
                                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                                  />
                                </label>
                                <label className='flex flex-col'>
                                  <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                    Bairro / Distrito
                                  </p>
                                  <Input
                                    id='newClientNeighborhood'
                                    value={newClientData.neighborhood}
                                    onChange={(e) =>
                                      setNewClientData({
                                        ...newClientData,
                                        neighborhood: e.target.value,
                                      })
                                    }
                                    data-testid='input-new-client-neighborhood'
                                    className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal'
                                  />
                                </label>
                                <label className='flex flex-col'>
                                  <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                    Cidade
                                  </p>
                                  <Input
                                    id='newClientCity'
                                    value={newClientData.city}
                                    onChange={(e) =>
                                      setNewClientData({
                                        ...newClientData,
                                        city: e.target.value,
                                      })
                                    }
                                    data-testid='input-new-client-city'
                                    className={cn(
                                      'flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal',
                                      newClientErrors.city && 'input-error'
                                    )}
                                  />
                                </label>
                                <label className='flex flex-col'>
                                  <p className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal pb-2'>
                                    Estado
                                  </p>
                                  <Input
                                    id='newClientState'
                                    value={newClientData.state}
                                    onChange={(e) =>
                                      setNewClientData({
                                        ...newClientData,
                                        state: e.target.value,
                                      })
                                    }
                                    maxLength={2}
                                    placeholder='SP'
                                    data-testid='input-new-client-state'
                                    className={cn(
                                      'flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-primary h-12 placeholder:text-[#60708a] px-4 text-base font-normal leading-normal',
                                      newClientErrors.state && 'input-error'
                                    )}
                                  />
                                </label>
                              </div>
                            </div>
                        </div>
                      </div>
                    </>

                  )}
                </>
              )}

              <div className='flex justify-end gap-4 pt-6 border-t dark:border-gray-700'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => {
                    if (showNewClientFields) {
                      setShowCancelClientConfirm(true);
                    } else {
                      setIsNewClientOpen(false);
                      resetNewClientForm();
                    }
                  }}
                  data-testid='button-cancel-new-client'
                  className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-gray-100 dark:bg-gray-700 text-[#111418] dark:text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-200 dark:hover:bg-gray-600'
                >
                  {showNewClientFields ? 'Cancelar' : 'Fechar'}
                </Button>
                {showNewClientFields && (
                  <Button
                    type='submit'
                    disabled={
                      createClientMutation.isPending || isLoadingNewClientCnpj
                    }
                    data-testid='button-save-new-client'
                    className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-white dark:bg-white text-gray-900 dark:text-gray-900 text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-200 dark:hover:bg-gray-200'
                  >
                    {createClientMutation.isPending ||
                    isLoadingNewClientCnpj ? (
                      <>
                        <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                        {isLoadingNewClientCnpj
                          ? 'Buscando dados...'
                          : 'Salvando...'}
                      </>
                    ) : (
                      'Salvar Cliente'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Ticket Confirmation */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent className='bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-[#111418] dark:text-white text-2xl font-bold leading-tight tracking-tight'>
              Cancelar alterações
            </AlertDialogTitle>
            <AlertDialogDescription className='text-[#60708a] dark:text-gray-400 text-base font-normal leading-normal'>
              Tem certeza que deseja cancelar? Todas as alterações serão
              perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end gap-4 pt-4 border-t dark:border-gray-700'>
            <AlertDialogCancel
              data-testid='button-cancel-no'
              className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-gray-100 dark:bg-gray-700 text-[#111418] dark:text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-200 dark:hover:bg-gray-600'
            >
              Não
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsCreateOpen(false);
                setEditingTicket(null);
                setIsRescheduling(false);
                resetForm();
                setShowCancelConfirm(false);
              }}
              data-testid='button-cancel-yes'
              className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90'
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel New Client Confirmation */}
      <AlertDialog
        open={showCancelClientConfirm}
        onOpenChange={setShowCancelClientConfirm}
      >
        <AlertDialogContent className='bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-[#111418] dark:text-white text-2xl font-bold leading-tight tracking-tight'>
              Cancelar cadastro
            </AlertDialogTitle>
            <AlertDialogDescription className='text-[#60708a] dark:text-gray-400 text-base font-normal leading-normal'>
              Tem certeza que deseja cancelar? Os dados do novo cliente serão
              perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end gap-4 pt-4 border-t dark:border-gray-700'>
            <AlertDialogCancel
              data-testid='button-cancel-client-no'
              className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-gray-100 dark:bg-gray-700 text-[#111418] dark:text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-200 dark:hover:bg-gray-600'
            >
              Não
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsNewClientOpen(false);
                setShowCancelClientConfirm(false);
                resetNewClientForm();
              }}
              data-testid='button-cancel-client-yes'
              className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90'
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Tipo de Cliente (CNPJ) */}
      <Dialog
        open={showNewClientTypeModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewClientTypeModal(false);
            newClientTypeModalOpenedForDocument.current = null;
            isOpeningNewClientTypeModal.current = false;
            setShowNewClientFields(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecione o tipo de cliente</DialogTitle>
            <DialogDescription>
              Este CNPJ pertence a uma empresa. Selecione o tipo de cliente:
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3 py-4'>
            <Button
              type='button'
              variant='outline'
              className='w-full justify-start h-auto p-4'
              onClick={async () => {
                setNewClientData((prev) => ({ ...prev, type: 'PJ' }));
                setNewClientActiveTab('PJ');
                setShowNewClientTypeModal(false);
                newClientTypeModalOpenedForDocument.current = null;
                isOpeningNewClientTypeModal.current = false;

                // Busca dados do CNPJ na API
                const cleanCnpj = newClientData.document.replace(/\D/g, '');
                if (cleanCnpj.length === 14) {
                  setIsLoadingNewClientCnpj(true);
                  try {
                    const found = await fetchAndFillNewClientCnpjData(
                      newClientData.document
                    );
                    if (found) {
                      toast({
                        title: 'Dados encontrados!',
                        description:
                          'Os dados da empresa foram preenchidos automaticamente.',
                      });
                    }
                  } catch (error) {
                    console.error('Erro ao buscar CNPJ:', error);
                  } finally {
                    setIsLoadingNewClientCnpj(false);
                  }
                }

                setShowNewClientFields(true);
              }}
            >
              <Building2 className='mr-3 h-5 w-5' />
              <div className='text-left'>
                <div className='font-semibold'>Cliente Final</div>
                <div className='text-sm text-muted-foreground'>
                  Empresa que contrata serviços (PJ)
                </div>
              </div>
            </Button>
            <Button
              type='button'
              variant='outline'
              className='w-full justify-start h-auto p-4'
              onClick={async () => {
                setNewClientData((prev) => ({
                  ...prev,
                  type: 'EMPRESA_PARCEIRA',
                }));
                setNewClientActiveTab('EMPRESA_PARCEIRA');
                setShowNewClientTypeModal(false);
                newClientTypeModalOpenedForDocument.current = null;
                isOpeningNewClientTypeModal.current = false;

                // Busca dados do CNPJ na API
                const cleanCnpj = newClientData.document.replace(/\D/g, '');
                if (cleanCnpj.length === 14) {
                  setIsLoadingNewClientCnpj(true);
                  try {
                    const found = await fetchAndFillNewClientCnpjData(
                      newClientData.document
                    );
                    if (found) {
                      toast({
                        title: 'Dados encontrados!',
                        description:
                          'Os dados da empresa foram preenchidos automaticamente.',
                      });
                    }
                  } catch (error) {
                    console.error('Erro ao buscar CNPJ:', error);
                  } finally {
                    setIsLoadingNewClientCnpj(false);
                  }
                }

                setShowNewClientFields(true);
              }}
            >
              <Building2 className='mr-3 h-5 w-5' />
              <div className='text-left'>
                <div className='font-semibold'>Empresa Parceira</div>
                <div className='text-sm text-muted-foreground'>
                  Empresa parceira com ciclo de pagamento e planilha mensal
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      {completingTicket && (
        <TicketCompleteDialog
          isOpen={!!completingTicket}
          onClose={() => setCompletingTicket(null)}
          onComplete={async (data) => {
            await completeMutation.mutateAsync({
              id: completingTicket.id,
              data,
            });

            // Emitir recibo se solicitado
            if (data.shouldIssueReceipt && user) {
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
                  name: completingTicket.client?.name || 'Não informado',
                  email: completingTicket.client?.email,
                  phone: completingTicket.client?.phone,
                  document: completingTicket.client?.cpf || completingTicket.client?.cnpj,
                },
                ticket: {
                  id: completingTicket.id,
                  serviceName: buildServiceSummary(
                    data.serviceItems,
                    completingTicket.service?.name || 'Servico Prestado'
                  ),
                  serviceItems: data.serviceItems,
                  date: data.paymentDate || new Date().toISOString(),
                  amount: data.totalAmount + data.discount,
                  discount: data.discount,
                  kmChargeExempt: data.kmChargeExempt,
                  description: data.expenseDetails,
                  warranty: data.warranty,
                },
              });
              setIsReceiptModalOpen(true);
            }
          }}
          isPending={completeMutation.isPending}
          ticket={{
            id: completingTicket.id,
            serviceId: completingTicket.serviceId || '',
            ticketValue:
              completingTicket.ticketValue ||
              completingTicket.service?.price?.toString() ||
              '0',
            service: {
              name: completingTicket.service?.name || 'Não informado',
              price: completingTicket.service?.price?.toString() || '0',
            },
            kmTotal: completingTicket.kmTotal || 0,
            kmRate: completingTicket.kmRate || '0',
          }}
          fullTicketData={completingTicket}
          elapsedSeconds={
            completingTicket.elapsedSeconds ||
            (completingTicket.startedAt
              ? Math.max(
                  0,
                  Math.floor(
                    (new Date().getTime() -
                      new Date(completingTicket.startedAt).getTime()) /
                      1000
                  )
                )
              : 0)
          }
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
    </div>
  );
}
