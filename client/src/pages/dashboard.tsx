import { useMemo, useState, useEffect } from 'react'; // Hooks do React

import { motion, AnimatePresence } from 'framer-motion';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/queryClient';

import {

  Users,

  CheckCircle2,

  Calendar as CalendarIcon,

  X,

  Play,

  XCircle,

  CheckCheck,

  User,

  Briefcase,

  Building,

  Clock3,

  AlertTriangle,

  DollarSign,

  Trophy,

  MessageCircle,

  ArrowLeft,

  Medal,

  Award,

  Star,

  Copy,

  Navigation,

  TrendingUp,

  Mail,

  FileText,

  Fuel,

  FileSpreadsheet,

  Trash2,

  Settings as SettingsIcon,

} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';

import { Skeleton } from '@/components/ui/skeleton';

import { Badge } from '@/components/ui/badge';

import { Checkbox } from '@/components/ui/checkbox';

import { Input } from '@/components/ui/input';

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from '@/components/ui/select';

import {

  Dialog,

  DialogContent,

  DialogDescription,

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

import { MetricCard } from '@/components/metric-card';

import { TicketCompleteDialog } from '@/components/ticket-complete-dialog';

import { ReceiptPreviewDialog } from '@/components/receipt-preview-dialog';

import { MobileBackButton } from '@/components/mobile-back-button';

import { buildServiceSummary } from '@/utils/service-items';

import {

  unmaskPhone,

  formatCurrency,

  maskCurrency,

  unmaskCurrency,

} from '@/lib/masks';

import { cn } from '@/lib/utils';

import {

  format,

  differenceInHours,

  differenceInMinutes,

  isBefore,

  isToday,

  isTomorrow,

  startOfWeek,

  endOfWeek,

  eachDayOfInterval,

  isWithinInterval,

} from 'date-fns';

import { ptBR } from 'date-fns/locale';

import { useToast } from '@/hooks/use-toast';

import { usePaidAccess } from '@/hooks/use-paid-access';

import { generateReceiptPDF } from '@/utils/receipt-pdf-generator';

import { useLocation } from 'wouter';

import { useAuth } from '@/hooks/use-auth';

import {

  BarChart,

  Bar,

  PieChart,

  Pie,

  Cell,

  LineChart,

  Line,

  XAxis,

  YAxis,

  CartesianGrid,

  Tooltip,

  Legend,

  ResponsiveContainer,

} from 'recharts';



interface DashboardStats {

  activeTickets: number;

  pendingTickets: number;

  activeClients: number;

  completedThisMonth: number;

  cancelledThisMonth: number;

  chamadosEmAberto: number;

  slaHoursAvg: number;

  faturamentoEstimado: number;

  ticketMedio: number;

  clientesAtivosHoje: number;

  clientesAtivosSemana: number;

  proximosAgendamentos: number;

  pendenciasVencidas: number;

  aReceberVencido: number;

  revenuePerHourAvg: number;

  revenuePerHourByType: {

    PF: number;

    PJ: number;

    EMPRESA_PARCEIRA: number;

  };

  revenuePerHourRanking: Array<{

    type: string;

    revenue: number;

    hours: number;

    avg: number;

    ticketCount: number;

  }>;

}



interface Ticket {

  id: string;

  scheduledFor: string;

  status: string;

  ticketValue: string;

  kmRate: string;

  kmTotal: number;

  extraExpenses: number;

  totalAmount: number;

  startedAt: string;

  stoppedAt: string;

  completedAt: string;

  paymentDate: string;

  client: {

    id: string;

    name: string;

    type: 'PF' | 'PJ' | 'EMPRESA_PARCEIRA';

    phone: string;

  };

  service: { id: string; name: string; price: number };

}



interface FinancialRecord {

  id: string;

  amount: number | string;

  status: 'pending' | 'paid' | 'overdue';

  dueDate: string | Date;

  ticketId?: string;

}



interface TicketStatsByStatus {

  completed: number;

  cancelled: number;

  inProgress: number;

  pending: number;

  noShow: number;

  total: number;

}



interface ClientStatsByType {

  pf: number;

  pj: number;

  empresaParceira: number;

  total: number;

}



interface Client {

  id: string;

  name: string;

  type: 'PF' | 'PJ' | 'EMPRESA_PARCEIRA';

  email: string;

  phone: string;

  city: string;

  state: string;

}



const normalizeStatus = (status: string) => (status || '').trim().toUpperCase();



const isDashboardDebugEnabled = () =>

  import.meta.env.DEV &&

  typeof window !== 'undefined' &&

  window.localStorage.getItem('dashboardDebug') === 'true';



const dashboardLog = (...args: unknown[]) => {

  if (isDashboardDebugEnabled()) {

    console.log(...args);

  }

};



const dashboardWarn = (...args: unknown[]) => {

  if (isDashboardDebugEnabled()) {

    console.warn(...args);

  }

};



// Função reutilizável para obter ícone e cores por posição

const getRankingIconAndColors = (index: number) => {

  if (index === 0) {

    // 1º lugar - Ouro

    return {

      Icon: Trophy,

      iconColor: 'text-yellow-500',

      bgColor: 'bg-yellow-500/15',

      borderColor: 'border border-slate-300/50 dark:border-slate-800',

      badge: '🏆 Campeão',

    };

  } else if (index === 1) {

    // 2º lugar - Prata

    return {

      Icon: Medal,

      iconColor: 'text-slate-400',

      bgColor: 'bg-slate-400/15',

      borderColor: 'border border-slate-300/50 dark:border-slate-800',

      badge: '🥈 Prata',

    };

  } else if (index === 2) {

    // 3º lugar - Bronze

    return {

      Icon: Award,

      iconColor: 'text-orange-600',

      bgColor: 'bg-orange-600/15',

      borderColor: 'border border-slate-300/50 dark:border-slate-800',

      badge: '🥉 Bronze',

    };

  } else if (index < 10) {

    // 4º ao 10º - Top 10

    return {

      Icon: Star,

      iconColor: 'text-blue-500',

      bgColor: 'bg-blue-500/10',

      borderColor: 'border border-slate-300/50 dark:border-slate-800',

      badge: '⭐ Top 10',

    };

  } else {

    // Demais posições

    return {

      Icon: Activity,

      iconColor: 'text-slate-400',

      bgColor: 'bg-slate-100 dark:bg-slate-800',

      borderColor: 'border border-slate-300/50 dark:border-slate-800',

      badge: null,

    };

  }

};



// Labels de tipo de cliente reutilizáveis

const clientTypeLabels: Record<string, string> = {

  PF: 'Pessoa Física',

  PJ: 'Pessoa Jurídica',

  EMPRESA_PARCEIRA: 'Empresa Parceira',

};



// Ícones de tipo de cliente reutilizáveis

const clientTypeIcons: Record<string, any> = {

  PF: User,

  PJ: Briefcase,

  EMPRESA_PARCEIRA: Building,

};



export default function Dashboard() {

  // v2 - Funções de exportação PDF adicionadas

  const { toast } = useToast();

  const { requirePaid } = usePaidAccess();

  const { user } = useAuth();

  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);

  const [showReceivePaymentModal, setShowReceivePaymentModal] = useState(false);

  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  const [paymentToReceive, setPaymentToReceive] = useState<{ ticketId?: string; recordId?: string } | null>(null);

  const [paymentReceivedDate, setPaymentReceivedDate] = useState<string>('');

  const [isPaymentDateAutoFilled, setIsPaymentDateAutoFilled] = useState(false);

  const [selectedPeriod, setSelectedPeriod] = useState('30');

  const [showRevenueRanking, setShowRevenueRanking] = useState(false);

  const [showClientsRanking, setShowClientsRanking] = useState(false);

  const [showBillingRanking, setShowBillingRanking] = useState(false);

  const [showTicketsRanking, setShowTicketsRanking] = useState(false);

  const [showCompletedTickets, setShowCompletedTickets] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const [showReceiveAllConfirm, setShowReceiveAllConfirm] = useState(false);

  const [clientToReceiveAll, setClientToReceiveAll] = useState<{

    id: string;

    name: string;

    totalAmount: number;

    ticketIds: string[];

  } | null>(null);

  const [showPendingPayments, setShowPendingPayments] = useState(false);

  const [selectedPendingClientId, setSelectedPendingClientId] = useState<

    string | null

  >(null);

  const [showReceiveAllPendingConfirm, setShowReceiveAllPendingConfirm] =

    useState(false);

  const [clientToReceiveAllPending, setClientToReceiveAllPending] = useState<{

    id: string;

    name: string;

    totalAmount: number;

    ticketIds: string[];

  } | null>(null);

  const [, setLocation] = useLocation();

  const [completingTicket, setCompletingTicket] = useState<Ticket | null>(null);

  const [receiptData, setReceiptPreviewData] = useState<any>(null);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const [showVehicleSettingsModal, setShowVehicleSettingsModal] =

    useState(false);



  // Opções de período para o filtro

  const PERIOD_OPTIONS = [

    { value: '7', label: 'Últimos 7 Dias' },

    { value: '30', label: 'Últimos 30 Dias' },

    { value: '90', label: 'Últimos 90 Dias' },

    { value: '180', label: 'Últimos 180 Dias' },

    { value: '365', label: 'Último Ano' },

  ];



  const {

    data: stats,

    isLoading: loadingStats,

    error: statsError,

  } = useQuery<DashboardStats>({

    queryKey: ['/api/dashboard/stats', selectedPeriod],

    refetchInterval: 30000, // Atualizar a cada 30 segundos

    refetchOnWindowFocus: true, // Atualizar quando a janela recebe foco

    refetchOnMount: true, // Atualizar quando o componente é montado

  });



  // Log de erro se houver

  useEffect(() => {

    if (statsError) {

      console.error('[Dashboard] ❌ Erro ao buscar stats:', statsError);

    }

  }, [statsError]);

  const { data: tickets = [] } = useQuery<Ticket[]>({

    queryKey: ['/api/tickets'],

    refetchInterval: 30000, // Atualizar a cada 30 segundos

    refetchOnWindowFocus: true, // Atualizar quando a janela recebe foco

    refetchOnMount: true, // Atualizar quando o componente é montado

  });

  const { data: ticketStats, isLoading: loadingTicketStats } =

    useQuery<TicketStatsByStatus>({

      queryKey: ['/api/tickets/stats-by-status'],

      enabled: expandedMetric === 'tickets',

    });

  //   // CORREÇÃO: Consolidar queries duplicadas - usar apenas uma query para clientes

  const { data: allClients = [], isLoading: loadingClients } = useQuery<

    Client[]

  >({

    queryKey: ['/api/clients'],

    staleTime: 5 * 60 * 1000, // 5 minutos

  });



  // Buscar configurações do veículo (declarado ANTES de qualquer useMemo que possa usar)

  const { data: vehicleSettings, refetch: refetchVehicleSettings } = useQuery<{

    fuelType: string;

    kmPerLiter: number;

    fuelPricePerLiter: number;

  }>({

    queryKey: ['/api/vehicle-settings'],

    queryFn: async () => {

      const response = await apiRequest(

        'GET',

        '/api/vehicle-settings',

        undefined

      );

      if (!response.ok) {

        // Se não existir, retornar valores padrão

        return { fuelType: 'GASOLINA', kmPerLiter: 10, fuelPricePerLiter: 6 };

      }

      const data = await response.json();

      return {

        fuelType: data.fuelType || 'GASOLINA',

        kmPerLiter: parseFloat(data.kmPerLiter || '10'),

        fuelPricePerLiter: parseFloat(data.fuelPricePerLiter || '6'),

      };

    },

  });



  //   // CORREÇÃO: Calcular stats localmente ao invés de fazer query separada

  const clientStats = useMemo<ClientStatsByType | null>(() => {

    if (!allClients || allClients.length === 0) return null;

    return {

      pf: allClients.filter((c) => c.type === 'PF').length,

      pj: allClients.filter((c) => c.type === 'PJ').length,

      empresaParceira: allClients.filter((c) => c.type === 'EMPRESA_PARCEIRA')

        .length,

      total: allClients.length,

    };

  }, [allClients]);



  //   // CORREÇÃO: Usar allClients ao invés de clientList

  const clientList = expandedMetric === 'clients' ? allClients : [];

  const loadingClientStats = loadingClients;

  const loadingClientList = loadingClients;



  // Calcular dados para os gráficos do dashboard-overview

  const days = parseInt(selectedPeriod);

  const periodLabel =
    PERIOD_OPTIONS.find((p) => p.value === selectedPeriod)?.label ||
    'Periodo';

  const startDate = useMemo(() => {

    const date = new Date();

    date.setDate(date.getDate() - days);

    return date;

  }, [days]);



  // Desempenho Semanal (últimos 7 dias)

  const weeklyPerformanceData = useMemo(() => {

    const today = new Date();

    const sevenDaysAgo = new Date(today);

    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    sevenDaysAgo.setHours(0, 0, 0, 0);

    const weekDays = eachDayOfInterval({ start: sevenDaysAgo, end: today });



    return weekDays.map((day) => {

      const dayStart = new Date(day);

      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(day);

      dayEnd.setHours(23, 59, 59, 999);



      const dayCompletedTickets = tickets.filter((t: any) => {

        const status = (t.status || '').toString().toUpperCase();

        if (!status.includes('CONCLU') && status !== 'COMPLETED') return false;



        const completedDate = t.completedAt || t.stoppedAt || t.scheduledDate;

        if (!completedDate) return false;



        const ticketDate = new Date(completedDate);

        return isWithinInterval(ticketDate, { start: dayStart, end: dayEnd });

      });



      const dayBilling = dayCompletedTickets.reduce((sum: number, t: any) => {

        const amount = t.totalAmount || t.ticketValue || 0;

        const value = typeof amount === 'string' ? parseFloat(amount) : amount;

        return sum + (value || 0);

      }, 0);



      const times: number[] = [];

      dayCompletedTickets.forEach((t: any) => {

        const startTime = t.startedAt || t.scheduledDate;

        const endTime = t.completedAt || t.stoppedAt;

        if (startTime && endTime) {

          const minutes = differenceInMinutes(

            new Date(endTime),

            new Date(startTime)

          );

          if (minutes > 0 && minutes < 24 * 60) {

            times.push(minutes);

          }

        }

      });

      const avgTime =

        times.length > 0

          ? times.reduce((sum, t) => sum + t, 0) / times.length

          : 0;



      const dayOfWeek = day.getDay();

      const dayAbbrMap: { [key: number]: string } = {

        0: 'Dom',

        1: 'Seg',

        2: 'Ter',

        3: 'Qua',

        4: 'Qui',

        5: 'Sex',

        6: 'Sáb',

      };

      const dayAbbr =

        dayAbbrMap[dayOfWeek] ||

        format(day, 'EEE', { locale: ptBR }).substring(0, 3);



      return {

        day: dayAbbr,

        completed: dayCompletedTickets.length,

        billing: dayBilling,

        avgTime: Math.round(avgTime),

      };

    });

  }, [tickets]);



  // Ranking de Lucratividade

  const profitabilityRankingData = useMemo(() => {

    const filteredTickets = tickets.filter((t: any) => {

      const ticketDate = new Date(t.scheduledDate || t.createdAt);

      return ticketDate >= startDate;

    });



    const profitabilityByClient = new Map<string, number>();

    filteredTickets

      .filter((t: any) => {

        const status = (t.status || '').toString().toUpperCase();

        return status.includes('CONCLU') || status === 'COMPLETED';

      })

      .forEach((t: any) => {

        const clientName = t.client?.name || 'Cliente não identificado';

        const amount = t.totalAmount || t.ticketValue || 0;

        const value = typeof amount === 'string' ? parseFloat(amount) : amount;

        profitabilityByClient.set(

          clientName,

          (profitabilityByClient.get(clientName) || 0) + value

        );

      });



    return Array.from(profitabilityByClient.entries())

      .map(([client, value]) => ({ client, value }))

      .sort((a, b) => b.value - a.value)

      .slice(0, 6);

  }, [tickets, startDate]);



  // Distribuição de Clientes

  const clientDistributionData = useMemo(

    () => [

      { name: 'PF', value: clientStats?.pf || 0 },

      { name: 'PJ', value: clientStats?.pj || 0 },

      { name: 'Partner', value: clientStats?.empresaParceira || 0 },

    ],

    [clientStats]

  );



  // Chamados por Status

  const ticketsByStatusData = useMemo(() => {

    const filteredTickets = tickets.filter((t: any) => {

      const ticketDate = new Date(t.scheduledDate || t.createdAt);

      return ticketDate >= startDate;

    });



    const statusCounts = new Map<string, number>();

    filteredTickets.forEach((t: any) => {

      let status = 'Aberto';

      const ticketStatus = (t.status || '').toString().toUpperCase();

      if (

        ticketStatus.includes('INICIADO') ||

        ticketStatus.includes('EXECUCAO')

      ) {

        status = 'Em Progresso';

      } else if (

        ticketStatus.includes('CONCLU') ||

        ticketStatus === 'COMPLETED'

      ) {

        status = 'Fechado';

      } else if (ticketStatus.includes('CANCEL')) {

        status = 'Cancelado';

      } else if (ticketStatus === 'ABERTO' || ticketStatus === 'PENDING') {

        status = 'Aberto';

      } else {

        status = 'Aguardando';

      }

      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

    });



    return Array.from(statusCounts.entries()).map(([status, count]) => ({

      status,

      count,

    }));

  }, [tickets, startDate]);



  // Tendência de Chamados Cancelados

  const canceledTicketsTrendData = useMemo(() => {

    const filteredTickets = tickets.filter((t: any) => {

      const ticketDate = new Date(t.scheduledDate || t.createdAt);

      return ticketDate >= startDate;

    });



    const canceledByMonth = new Map<string, number>();

    filteredTickets

      .filter((t: any) => {

        const status = (t.status || '').toString().toUpperCase();

        return status.includes('CANCEL') || status === 'CANCELLED';

      })

      .forEach((t: any) => {

        const date = new Date(t.scheduledDate || t.createdAt);

        const monthKey = date.toLocaleDateString('pt-BR', { month: 'short' });

        canceledByMonth.set(monthKey, (canceledByMonth.get(monthKey) || 0) + 1);

      });



    const months = [

      'Jan',

      'Fev',

      'Mar',

      'Abr',

      'Mai',

      'Jun',

      'Jul',

      'Ago',

      'Set',

      'Out',

      'Nov',

      'Dez',

    ];



    return Array.from(canceledByMonth.entries())

      .map(([month, count]) => ({ month, count }))

      .sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month));

  }, [tickets, startDate]);



  const { data: financialRecords = [] } = useQuery<FinancialRecord[]>({

    queryKey: ['/api/financial-records'],

    refetchInterval: 30000, // Atualizar a cada 30 segundos

    refetchOnWindowFocus: true, // Atualizar quando a janela recebe foco

    refetchOnMount: true, // Atualizar quando o componente é montado

  });

  const { data: integrationSettings } = useQuery<{

    paymentLinkUrl?: string;

  }>({

    queryKey: ['/api/integration-settings'],

  });

  const queryClient = useQueryClient();



  // Listener para evento customizado de abrir pagamentos pendentes

  useEffect(() => {

    const handleShowPendingPayments = (event: Event) => {

      setShowPendingPayments(true);

    };



    window.addEventListener(

      'showPendingPayments',

      handleShowPendingPayments as EventListener

    );



    return () => {

      window.removeEventListener(

        'showPendingPayments',

        handleShowPendingPayments as EventListener

      );

    };

  }, []);



  // Mutation para iniciar atendimento (check-in)

  const checkInMutation = useMutation({

    mutationFn: async (ticketId: string) => {

      const startedAt = new Date().toISOString();



      // Salvar no localStorage IMEDIATAMENTE para garantir que o banner aparece

      try {

        const stored = JSON.parse(

          localStorage.getItem('active_tickets_startedAt') || '{}'

        );

        stored[ticketId] = startedAt;

        localStorage.setItem(

          'active_tickets_startedAt',

          JSON.stringify(stored)

        );

      } catch (err) {

        dashboardWarn('Erro ao salvar startedAt no localStorage:', err);

      }



      // Fazer check-in no backend

      const response = await apiRequest(

        'POST',

        `/api/tickets/${ticketId}/check-in`,

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

          stored[ticketId] = updatedTicket.startedAt;

          localStorage.setItem(

            'active_tickets_startedAt',

            JSON.stringify(stored)

          );

        } catch (err) {

          dashboardWarn('Erro ao atualizar startedAt no localStorage:', err);

        }

      }



      return updatedTicket;

    },

    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });

      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

      queryClient.invalidateQueries({

        queryKey: ['/api/dashboard/km-metrics'],

      });

    },

  });



  const handleCheckIn = async (ticketId: string) => {

    try {

      await checkInMutation.mutateAsync(ticketId);

    } catch (error: any) {

      console.error('Erro ao iniciar atendimento:', error);

      // O erro será tratado pelo toast do sistema

    }

  };



  // Mutation para finalizar atendimento

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

      const requestData: any = {

        kmTotal: data.kmTotal || 0,

        kmRate: data.kmRate,

        kmChargeExempt: data.kmChargeExempt,

        additionalHourRate: data.additionalHourRate,

        extraExpenses: data.extraExpenses || 0,

        expenseDetails: data.expenseDetails || '',

        baseAmount: data.baseAmount || 0,

        totalAmount: data.totalAmount,

        discount: data.discount,

        serviceItems: data.serviceItems,

        warranty: data.warranty,

      };



      // Incluir paymentDate apenas se fornecido

      if (data.paymentDate) {

        requestData.paymentDate = data.paymentDate;

      }



      const response = await apiRequest(

        'POST',

        `/api/tickets/${id}/complete`,

        requestData

      );

      if (!response.ok) {

        const error = await response.json();

        throw new Error(error.message || 'Erro ao finalizar atendimento');

      }

      return await response.json();

    },

    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });

      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

      queryClient.invalidateQueries({

        queryKey: ['/api/dashboard/km-metrics'],

      });

      setCompletingTicket(null);

    },

    onError: (error: any) => {

      console.error('Erro ao finalizar atendimento:', error);

    },

  });



  // Mutation para receber pagamento por recordId (usando PATCH)

  const receivePaymentMutation = useMutation({

    mutationFn: async ({ recordId, paidAt }: { recordId: string; paidAt: string }) => {

      try {

        const response = await apiRequest(

          'PATCH',

          `/api/financial-records/${recordId}`,

          {

            status: 'paid',

            paidAt: paidAt,

          }

        );

        // Se chegou aqui, a resposta está OK (apiRequest já valida)

        return await response.json();

      } catch (error: any) {

        // Se apiRequest lançou erro, tentar extrair mensagem do erro

        const errorMessage = error.message || 'Erro ao receber pagamento';

        // Se o erro contém HTML (página de erro), extrair mensagem mais clara

        if (

          errorMessage.includes('<!DOCTYPE') ||

          errorMessage.includes('<html')

        ) {

          throw new Error(

            'Erro no servidor. Verifique se o servidor está rodando.'

          );

        }

        throw new Error(errorMessage);

      }

    },

    onSuccess: async () => {

      //   // CORREÇÃO: Invalidar e refetch imediatamente para atualizar dados

      await Promise.all([

        queryClient.invalidateQueries({ queryKey: ['/api/financial-records'] }),

        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] }),

        queryClient.invalidateQueries({ queryKey: ['/api/tickets'] }),

      ]);



      //   // CORREÇÃO: Forçar refetch explícito para garantir atualização imediata

      await Promise.all([

        queryClient.refetchQueries({ queryKey: ['/api/financial-records'] }),

        queryClient.refetchQueries({ queryKey: ['/api/dashboard/stats'] }),

        queryClient.refetchQueries({ queryKey: ['/api/tickets'] }),

      ]);



      toast({

        title: 'Pagamento recebido',

        description: 'O pagamento foi registrado com sucesso.',

      });

    },

    onError: (error: any) => {

      console.error('Erro ao receber pagamento:', error);

      toast({

        variant: 'destructive',

        title: 'Erro ao receber pagamento',

        description: error.message || 'Não foi possível registrar o pagamento.',

      });

    },

  });



  // Mutation para receber pagamento por ticketId

  const receivePaymentByTicketMutation = useMutation({

    mutationFn: async ({ ticketId, paidAt }: { ticketId: string; paidAt: string }) => {

      try {

        const response = await apiRequest(

          'POST',

          `/api/tickets/${ticketId}/receive-payment`,

          {

            paidAt: paidAt,

          }

        );

        // Se chegou aqui, a resposta está OK (apiRequest já valida)

        return await response.json();

      } catch (error: any) {

        // Se apiRequest lançou erro, tentar extrair mensagem do erro

        const errorMessage = error.message || 'Erro ao receber pagamento';

        // Se o erro contém HTML (página de erro), extrair mensagem mais clara

        if (

          errorMessage.includes('<!DOCTYPE') ||

          errorMessage.includes('<html')

        ) {

          throw new Error(

            'Erro no servidor. Verifique se o servidor está rodando.'

          );

        }

        throw new Error(errorMessage);

      }

    },

    onSuccess: async () => {

      //   // CORREÇÃO: Invalidar e refetch imediatamente para atualizar dados

      await Promise.all([

        queryClient.invalidateQueries({ queryKey: ['/api/financial-records'] }),

        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] }),

        queryClient.invalidateQueries({ queryKey: ['/api/tickets'] }),

      ]);



      //   // CORREÇÃO: Forçar refetch explícito para garantir atualização imediata

      await Promise.all([

        queryClient.refetchQueries({ queryKey: ['/api/financial-records'] }),

        queryClient.refetchQueries({ queryKey: ['/api/dashboard/stats'] }),

        queryClient.refetchQueries({ queryKey: ['/api/tickets'] }),

      ]);



      toast({

        title: 'Pagamento recebido',

        description: 'O pagamento foi registrado com sucesso.',

      });

    },

    onError: (error: any) => {

      console.error('Erro ao receber pagamento:', error);

      toast({

        variant: 'destructive',

        title: 'Erro ao receber pagamento',

        description: error.message || 'Não foi possível registrar o pagamento.',

      });

    },

  });



  const handleReceivePayment = async (recordId: string) => {

    // Preencher data atual automaticamente

    const now = new Date();

    const year = now.getFullYear();

    const month = String(now.getMonth() + 1).padStart(2, '0');

    const day = String(now.getDate()).padStart(2, '0');

    setPaymentReceivedDate(`${year}-${month}-${day}`);

    setIsPaymentDateAutoFilled(true);

    setPaymentToReceive({ recordId });

    setShowReceivePaymentModal(true);

  };



  const handleReceivePaymentByTicket = async (ticketId: string) => {

    // Preencher data atual automaticamente

    const now = new Date();

    const year = now.getFullYear();

    const month = String(now.getMonth() + 1).padStart(2, '0');

    const day = String(now.getDate()).padStart(2, '0');

    setPaymentReceivedDate(`${year}-${month}-${day}`);

    setIsPaymentDateAutoFilled(true);

    setPaymentToReceive({ ticketId });

    setShowReceivePaymentModal(true);

  };



  const handleConfirmReceivePayment = async () => {

    if (!paymentToReceive) return;



    try {

      if (paymentToReceive.recordId) {

        // Converter data para ISO string com hora 00:00:00

        const dateObj = new Date(paymentReceivedDate + 'T00:00:00');

        await receivePaymentMutation.mutateAsync({

          recordId: paymentToReceive.recordId,

          paidAt: dateObj.toISOString(),

        });

      } else if (paymentToReceive.ticketId) {

        // Converter data para ISO string com hora 00:00:00

        const dateObj = new Date(paymentReceivedDate + 'T00:00:00');

        await receivePaymentByTicketMutation.mutateAsync({

          ticketId: paymentToReceive.ticketId,

          paidAt: dateObj.toISOString(),

        });

      }

      setShowReceivePaymentModal(false);

      setPaymentToReceive(null);

      setPaymentReceivedDate('');

      setIsPaymentDateAutoFilled(false);

    } catch (error) {

      console.error('Erro ao receber pagamento:', error);

    }

  };



  // Mutation para excluir registro financeiro

  const deleteFinancialRecordMutation = useMutation({

    mutationFn: async (recordId: string) => {

      const response = await apiRequest(

        'DELETE',

        `/api/financial-records/${recordId}`,

        {}

      );

      return response;

    },

    onSuccess: async () => {

      //   // CORREÇÃO: Invalidar e refetch imediatamente

      await Promise.all([

        queryClient.invalidateQueries({

          queryKey: ['/api/financial-records'],

          refetchType: 'active',

        }),

        queryClient.invalidateQueries({

          queryKey: ['/api/dashboard/stats'],

          refetchType: 'active',

        }),

        queryClient.invalidateQueries({

          queryKey: ['/api/tickets'],

          refetchType: 'active',

        }),

      ]);



      await Promise.all([

        queryClient.refetchQueries({

          queryKey: ['/api/financial-records'],

          exact: false,

          type: 'active',

        }),

        queryClient.refetchQueries({

          queryKey: ['/api/dashboard/stats'],

          exact: false,

          type: 'active',

        }),

        queryClient.refetchQueries({

          queryKey: ['/api/tickets'],

          exact: false,

          type: 'active',

        }),

      ]);



      toast({

        title: 'Registro excluído',

        description: 'O registro financeiro foi excluído com sucesso.',

      });

    },

    onError: (error: any) => {

      console.error('Erro ao excluir registro:', error);

      toast({

        variant: 'destructive',

        title: 'Erro ao excluir registro',

        description: error.message || 'Não foi possível excluir o registro.',

      });

    },

  });



  const handleDeleteFinancialRecord = (recordId: string) => {

    setRecordToDelete(recordId);

  };



  const handleConfirmDeleteFinancialRecord = () => {

    if (!recordToDelete) return;

    deleteFinancialRecordMutation.mutate(recordToDelete);

    setRecordToDelete(null);

  };





  // Mutation para receber todos os pagamentos de um cliente

  const receiveAllPaymentsByClientMutation = useMutation({

    mutationFn: async (ticketIds: string[]) => {

      //   // CORREÇÃO: Usar Promise.allSettled para não falhar completamente se alguns pagamentos já foram recebidos

      const promises = ticketIds.map(async (ticketId) => {

        try {

          await apiRequest(

            'POST',

            `/api/tickets/${ticketId}/receive-payment`,

            {}

          );

          return {

            ticketId,

            success: true,

            error: null,

            alreadyReceived: false,

          };

        } catch (error: any) {

          //   // CORREÇÃO: Tratar erro 400 (pagamento já recebido) como sucesso

          const errorMessage = error.message || String(error) || '';

          dashboardLog(

            `[Receive Payment] Erro para ticket ${ticketId}:`,

            errorMessage

          );



          // Verificar se é erro de pagamento já recebido

          const isAlreadyReceived =

            errorMessage.includes('já foi recebido') ||

            errorMessage.includes('already received') ||

            errorMessage.includes('400:') ||

            (errorMessage.startsWith('400') &&

              errorMessage.includes('recebido'));



          dashboardLog(

            `[Receive Payment] Ticket ${ticketId} já recebido?`,

            isAlreadyReceived

          );



          return {

            ticketId,

            success: isAlreadyReceived, // Considera sucesso se já foi recebido

            alreadyReceived: isAlreadyReceived,

            error: isAlreadyReceived ? null : errorMessage,

          };

        }

      });



      const results = await Promise.allSettled(promises);



      // Processar resultados

      const successful: string[] = [];

      const alreadyReceived: string[] = [];

      const failed: Array<{ ticketId: string; error: string }> = [];



      results.forEach((result, index) => {

        if (result.status === 'fulfilled') {

          const {

            ticketId,

            success,

            error,

            alreadyReceived: isAlreadyReceived,

          } = result.value;

          if (success && !error && !isAlreadyReceived) {

            // Pagamento recebido com sucesso agora

            successful.push(ticketId);

          } else if (success && (error === null || isAlreadyReceived)) {

            // Pagamento já recebido anteriormente (não é erro)

            alreadyReceived.push(ticketId);

          } else {

            // Erro real

            failed.push({ ticketId, error: error || 'Erro desconhecido' });

          }

        } else {

          // Promise rejeitada

          const errorMsg =

            result.reason?.message ||

            String(result.reason) ||

            'Erro desconhecido';

          const isAlreadyReceived =

            errorMsg.includes('já foi recebido') ||

            errorMsg.includes('already received') ||

            errorMsg.includes('400:');



          if (isAlreadyReceived) {

            alreadyReceived.push(ticketIds[index]);

          } else {

            failed.push({ ticketId: ticketIds[index], error: errorMsg });

          }

        }

      });



      return { successful, alreadyReceived, failed };

    },

    onSuccess: async (data) => {

      const { successful, alreadyReceived, failed } = data;



      //   // CORREÇÃO: Capturar valores antes de resetar estados

      const pendingClientId = clientToReceiveAllPending?.id;

      const allPaymentsReceived = failed.length === 0;



      //   // CORREÇÃO: Fechar modais primeiro para melhor UX

      setShowReceiveAllConfirm(false);

      setClientToReceiveAll(null);

      setShowReceiveAllPendingConfirm(false);

      setClientToReceiveAllPending(null);



      //   // CORREÇÃO: Resetar cliente selecionado se todos os pagamentos foram recebidos

      if (pendingClientId && allPaymentsReceived) {

        // Se todos os pagamentos foram recebidos, resetar o estado do cliente selecionado

        setSelectedPendingClientId(null);

      }



      //   // CORREÇÃO: Invalidar e refetch imediatamente para atualizar dados

      // IMPORTANTE: Sempre fazer refetch, mesmo se todos já foram recebidos,

      // para garantir que a UI seja atualizada corretamente

      dashboardLog('[Receive Payment] Invalidando queries...');



      //   // CORREÇÃO: Invalidar com refetchType: 'active' para forçar refetch imediato

      await Promise.all([

        queryClient.invalidateQueries({

          queryKey: ['/api/financial-records'],

          refetchType: 'active', // Força refetch mesmo se não estiver stale

        }),

        queryClient.invalidateQueries({

          queryKey: ['/api/dashboard/stats'],

          refetchType: 'active',

        }),

        queryClient.invalidateQueries({

          queryKey: ['/api/tickets'],

          refetchType: 'active',

        }),

      ]);



      dashboardLog('[Receive Payment] Fazendo refetch explícito...');

      //   // CORREÇÃO: Forçar refetch explícito para garantir atualização imediata

      await Promise.all([

        queryClient.refetchQueries({

          queryKey: ['/api/financial-records'],

          exact: false,

          type: 'active', // Apenas queries ativas

        }),

        queryClient.refetchQueries({

          queryKey: ['/api/dashboard/stats'],

          exact: false,

          type: 'active',

        }),

        queryClient.refetchQueries({

          queryKey: ['/api/tickets'],

          exact: false,

          type: 'active',

        }),

      ]);



      //   // CORREÇÃO: Pequeno delay para garantir que os dados sejam atualizados

      await new Promise((resolve) => setTimeout(resolve, 500));

      dashboardLog('[Receive Payment] Refetch concluído');



      //   // CORREÇÃO: Forçar atualização adicional após delay para garantir sincronização

      await Promise.all([

        queryClient.refetchQueries({

          queryKey: ['/api/financial-records'],

          exact: false,

          type: 'active',

        }),

      ]);



      //   // CORREÇÃO: Mostrar mensagem apropriada baseada nos resultados

      const totalProcessed = successful.length + alreadyReceived.length;

      const total = successful.length + alreadyReceived.length + failed.length;



      if (failed.length === 0) {

        // Todos foram processados com sucesso (incluindo os que já estavam recebidos)

        if (alreadyReceived.length > 0 && successful.length > 0) {

          toast({

            title: 'Pagamentos processados',

            description: `${successful.length} pagamento(s) recebido(s) e ${alreadyReceived.length} já estava(m) recebido(s).`,

          });

        } else if (alreadyReceived.length > 0) {

          toast({

            title: 'Pagamentos já recebidos',

            description: `Todos os ${alreadyReceived.length} pagamento(s) já estavam recebidos.`,

          });

          //   // CORREÇÃO: Mesmo quando todos já foram recebidos, forçar atualização da UI

          // para garantir que o card desapareça se não houver mais pagamentos pendentes

          await new Promise((resolve) => setTimeout(resolve, 300));

          await Promise.all([

            queryClient.refetchQueries({

              queryKey: ['/api/financial-records'],

              exact: false,

              type: 'active',

            }),

          ]);

        } else {

          toast({

            title: 'Pagamentos recebidos',

            description: `Todos os ${successful.length} pagamento(s) foram registrados com sucesso.`,

          });

        }

      } else {

        // Alguns falharam

        const message = `${totalProcessed} de ${total} pagamento(s) processado(s) com sucesso. ${failed.length} falharam.`;

        toast({

          variant: 'destructive',

          title: 'Alguns pagamentos falharam',

          description: message,

        });

      }

    },

    onError: (error: any) => {

      console.error('Erro ao receber pagamentos:', error);

      toast({

        variant: 'destructive',

        title: 'Erro ao receber pagamentos',

        description:

          error.message || 'Não foi possível registrar os pagamentos.',

      });

    },

  });



  const handleReceiveAllPaymentsByClient = async () => {

    if (!clientToReceiveAll) return;

    try {

      await receiveAllPaymentsByClientMutation.mutateAsync(

        clientToReceiveAll.ticketIds

      );

      // Estados são resetados no onSuccess da mutation

    } catch (error) {

      // Erro já é tratado no onError da mutation

      console.error('Erro ao receber pagamentos:', error);

    }

  };



  const handleReceiveAllPendingPaymentsByClient = async () => {

    if (!clientToReceiveAllPending) return;

    try {

      await receiveAllPaymentsByClientMutation.mutateAsync(

        clientToReceiveAllPending.ticketIds

      );

      //   // CORREÇÃO: Estados são resetados no onSuccess da mutation

    } catch (error) {

      // Erro já é tratado no onError da mutation

      console.error('Erro ao receber pagamentos pendentes:', error);

    }

  };



  // Função para gerar link de pagamento

  const generatePaymentLink = (ticketId: string): string => {

    const baseUrl = integrationSettings?.paymentLinkUrl || '';

    if (!baseUrl) return '';

    // Substituir {ticketId} ou {id} pelo ID do ticket

    return baseUrl.replace(/{ticketId}/g, ticketId).replace(/{id}/g, ticketId);

  };



  // Função auxiliar para remover máscara de telefone

  const unmaskPhone = (phone: string): string => {

    return phone.replace(/\D/g, '');

  };



  // Função para formatar mensagem de pagamento (múltiplos)

  const formatPaymentMessage = (

    payments: any[],

    clientName?: string

  ): string => {

    const companyName = user?.companyName || 'ChamadosPro';

    const lines: string[] = [];



    // Header com nome da empresa

    lines.push(`🏢 *${companyName}*`);

    lines.push(

      `  ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`

    );

    lines.push('');

    lines.push('━━━━━━━━━━━━━━━━━━━━');

    lines.push('💳 *COBRANÇA DE PAGAMENTOS PENDENTES*');

    lines.push('━━━━━━━━━━━━━━━━━━━━');

    if (clientName) {

      lines.push(`👤 Cliente: *${clientName}*`);

      lines.push('');

    }



    payments.forEach((payment, index) => {

      const ticket = payment.ticket;

      if (!ticket) return;



      const ticketNumber =

        (ticket as any).ticketNumber || ticket.id.slice(0, 8);

      const serviceName = ticket.service?.name || 'Serviço não informado';

      const attendanceDate = formatDate(

        ticket.completedAt || ticket.stoppedAt || ticket.scheduledDate

      );

      const total = ticket

        ? ticketFinancials(ticket).total

        : normalizeAmount(payment.amount);

      const paymentLink = generatePaymentLink(ticket.id);



      // Card visual do chamado

      lines.push('┌─────────────────────────┐');

      lines.push(`│ 📋 *CHAMADO ${index + 1}*      │`);

      lines.push('├─────────────────────────┤');

      lines.push(`│ 🔢 Número: ${ticketNumber.padEnd(12)} │`);

      lines.push(`│ 🛠️  Serviço: ${serviceName.substring(0, 11).padEnd(12)} │`);

      lines.push(`│   Data: ${attendanceDate.padEnd(13)} │`);

      lines.push(`│ 💰 Valor: *${formatCurrency(total).padEnd(12)}* │`);

      if (paymentLink) {

        lines.push(`│ 🔗 Link: ${paymentLink.substring(0, 20).padEnd(12)} │`);

      }

      lines.push('└─────────────────────────┘');

      lines.push('');

    });



    const totalAmount = payments.reduce((sum, p) => {

      const ticket = p.ticket;

      const total = ticket

        ? ticketFinancials(ticket).total

        : normalizeAmount(p.amount);

      return sum + total;

    }, 0);



    lines.push('━━━━━━━━━━━━━━━━━━━━');

    lines.push(`💰 *TOTAL A PAGAR: ${formatCurrency(totalAmount)}*`);

    lines.push('━━━━━━━━━━━━━━━━━━━━');

    lines.push('');

    lines.push(`📧 Documento gerado por ${companyName}`);



    return lines.join('\n');

  };



  // Função para formatar mensagem de um único pagamento

  const formatSinglePaymentMessage = (

    payment: any,

    clientName?: string

  ): string => {

    const companyName = user?.companyName || 'ChamadosPro';

    const ticket = payment.ticket;

    if (!ticket) return '';



    const ticketNumber = (ticket as any).ticketNumber || ticket.id.slice(0, 8);

    const serviceName = ticket.service?.name || 'Serviço não informado';

    const attendanceDate = formatDate(

      ticket.completedAt || ticket.stoppedAt || ticket.scheduledDate

    );

    const total = ticket

      ? ticketFinancials(ticket).total

      : normalizeAmount(payment.amount);

    const paymentLink = generatePaymentLink(ticket.id);



    const lines: string[] = [];

    lines.push(`🏢 *${companyName}*`);

    lines.push(

      `  ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`

    );

    lines.push('');

    lines.push('━━━━━━━━━━━━━━━━━━━━');

    lines.push('💳 *COBRANÇA DE PAGAMENTO PENDENTE*');

    lines.push('━━━━━━━━━━━━━━━━━━━━');

    if (clientName) {

      lines.push(`👤 Cliente: *${clientName}*`);

      lines.push('');

    }

    lines.push('┌─────────────────────────┐');

    lines.push('│ 📋 *DETALHES DO CHAMADO* │');

    lines.push('├─────────────────────────┤');

    lines.push(`│ 🔢 Número: ${ticketNumber.padEnd(12)} │`);

    lines.push(`│ 🛠️  Serviço: ${serviceName.substring(0, 11).padEnd(12)} │`);

    lines.push(`│   Data: ${attendanceDate.padEnd(13)} │`);

    lines.push(`│ 💰 Valor: *${formatCurrency(total).padEnd(12)}* │`);

    if (paymentLink) {

      lines.push(`│ 🔗 Link: ${paymentLink.substring(0, 20).padEnd(12)} │`);

    }

    lines.push('└─────────────────────────┘');

    lines.push('');

    lines.push(`📧 Documento gerado por ${companyName}`);



    return lines.join('\n');

  };



  // Função auxiliar para normalizar valores monetários

  const normalizeAmount = (val: string | number): number => {

    const num = typeof val === 'string' ? parseFloat(val) : val;

    return Number.isFinite(num) ? num : 0;

  };



  // Função para enviar WhatsApp (múltiplos pagamentos)

  const handleSendWhatsApp = (clientData: any) => {

    if (

      !requirePaid({

        feature: 'Envio por WhatsApp',

        description: 'Envios por WhatsApp estao disponiveis apenas na versao paga.',

      })

    ) {

      return;

    }

    const phone = clientData.client.phone;

    if (!phone) {

      toast({

        variant: 'destructive',

        title: 'Telefone não informado',

        description: 'O cliente não possui telefone cadastrado.',

      });

      return;

    }



    const message = formatPaymentMessage(

      clientData.payments,

      clientData.client.name

    );

    const cleanPhone = unmaskPhone(phone);

    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(

      message

    )}`;

    window.open(url, '_blank');

  };



  // Função para enviar WhatsApp de um único pagamento

  const handleSendWhatsAppSingle = (payment: any, client: any) => {

    if (

      !requirePaid({

        feature: 'Envio por WhatsApp',

        description: 'Envios por WhatsApp estao disponiveis apenas na versao paga.',

      })

    ) {

      return;

    }

    const phone = client.phone;

    if (!phone) {

      toast({

        variant: 'destructive',

        title: 'Telefone não informado',

        description: 'O cliente não possui telefone cadastrado.',

      });

      return;

    }



    const message = formatSinglePaymentMessage(payment, client.name);

    const cleanPhone = unmaskPhone(phone);

    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(

      message

    )}`;

    window.open(url, '_blank');

  };



  // Função para formatar email HTML (múltiplos pagamentos)

  const formatEmailHTML = (payments: any[], clientName?: string): string => {

    const companyName = user?.companyName || 'ChamadosPro';

    const companyLogoUrl = user?.companyLogoUrl;

    const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", {

      locale: ptBR,

    });



    let html = `

<!DOCTYPE html>

<html>

<head>

  <meta charset="UTF-8">

  <style>

    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px; }

    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }

    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 20px; text-align: center; }

    .header img { max-width: 60px; max-height: 60px; margin-bottom: 10px; }

    .header h1 { margin: 0; font-size: 24px; }

    .header p { margin: 5px 0 0 0; font-size: 12px; opacity: 0.9; }

    .content { padding: 20px; }

    .summary-card { background: #f8f9fa; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }

    .summary-card h2 { margin: 0 0 10px 0; color: #3b82f6; font-size: 18px; }

    .summary-card p { margin: 5px 0; }

    .ticket-card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 15px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

    .ticket-header { background: #3b82f6; color: white; padding: 10px; margin: -15px -15px 15px -15px; border-radius: 8px 8px 0 0; font-weight: bold; }

    .ticket-info { margin: 8px 0; }

    .ticket-info strong { color: #3b82f6; }

    .total-section { background: #3b82f6; color: white; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }

    .total-section h2 { margin: 0; font-size: 24px; }

    .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }

  </style>

</head>

<body>

  <div class="container">

    <div class="header">

      ${

        companyLogoUrl

          ? `<img src="${companyLogoUrl}" alt="${companyName}" />`

          : ''

      }

      <h1>${companyName}</h1>

      <p>Emitido em: ${dateStr}</p>

    </div>

    <div class="content">

      <div class="summary-card">

        <h2>💳 Cobrança de Pagamentos Pendentes</h2>

        ${clientName ? `<p><strong>Cliente:</strong> ${clientName}</p>` : ''}

      </div>

`;



    payments.forEach((payment, index) => {

      const ticket = payment.ticket;

      if (!ticket) return;



      const ticketNumber =

        (ticket as any).ticketNumber || ticket.id.slice(0, 8);

      const serviceName = ticket.service?.name || 'Serviço não informado';

      const attendanceDate = formatDate(

        ticket.completedAt || ticket.stoppedAt || ticket.scheduledDate

      );

      const total = ticket

        ? ticketFinancials(ticket).total

        : normalizeAmount(payment.amount);

      const paymentLink = generatePaymentLink(ticket.id);



      html += `

      <div class="ticket-card">

        <div class="ticket-header">📋 Chamado ${index + 1}</div>

        <div class="ticket-info"><strong>🔢 Número:</strong> ${ticketNumber}</div>

        <div class="ticket-info"><strong>🛠️ Serviço:</strong> ${serviceName}</div>

        <div class="ticket-info"><strong>  Data de Atendimento:</strong> ${attendanceDate}</div>

        <div class="ticket-info"><strong>💰 Valor:</strong> ${formatCurrency(

          total

        )}</div>

        ${

          paymentLink

            ? `<div class="ticket-info"><strong>🔗 Link de Pagamento:</strong> <a href="${paymentLink}">${paymentLink}</a></div>`

            : ''

        }

      </div>

      `;

    });



    const totalAmount = payments.reduce((sum, p) => {

      const ticket = p.ticket;

      const total = ticket

        ? ticketFinancials(ticket).total

        : normalizeAmount(p.amount);

      return sum + total;

    }, 0);



    html += `

      <div class="total-section">

        <h2>💰 Total a Pagar: ${formatCurrency(totalAmount)}</h2>

      </div>

    </div>

    <div class="footer">

      <p>Documento gerado automaticamente por ${companyName}</p>

    </div>

  </div>

</body>

</html>

    `;



    return html;

  };



  // Função para enviar Email (múltiplos pagamentos)

  const handleSendEmail = (clientData: any) => {

    const email = clientData.client.email;

    if (!email) {

      toast({

        variant: 'destructive',

        title: 'Email não informado',

        description: 'O cliente não possui email cadastrado.',

      });

      return;

    }



    const subject = encodeURIComponent('Cobrança de Pagamentos Pendentes');

    const htmlBody = formatEmailHTML(

      clientData.payments,

      clientData.client.name

    );

    // Para mailto, usar texto simples (HTML não funciona bem em mailto)

    const textBody = formatPaymentMessage(

      clientData.payments,

      clientData.client.name

    );

    const url = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(

      textBody

    )}`;

    window.location.href = url;

  };



  // Função para formatar email HTML (um único pagamento)

  const formatSingleEmailHTML = (payment: any, clientName?: string): string => {

    const companyName = user?.companyName || 'ChamadosPro';

    const companyLogoUrl = user?.companyLogoUrl;

    const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", {

      locale: ptBR,

    });

    const ticket = payment.ticket;

    if (!ticket) return '';



    const ticketNumber = (ticket as any).ticketNumber || ticket.id.slice(0, 8);

    const serviceName = ticket.service?.name || 'Serviço não informado';

    const attendanceDate = formatDate(

      ticket.completedAt || ticket.stoppedAt || ticket.scheduledDate

    );

    const total = ticket

      ? ticketFinancials(ticket).total

      : normalizeAmount(payment.amount);

    const paymentLink = generatePaymentLink(ticket.id);



    return `

<!DOCTYPE html>

<html>

<head>

  <meta charset="UTF-8">

  <style>

    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px; }

    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }

    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 20px; text-align: center; }

    .header img { max-width: 60px; max-height: 60px; margin-bottom: 10px; }

    .header h1 { margin: 0; font-size: 24px; }

    .header p { margin: 5px 0 0 0; font-size: 12px; opacity: 0.9; }

    .content { padding: 20px; }

    .summary-card { background: #f8f9fa; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }

    .summary-card h2 { margin: 0 0 10px 0; color: #3b82f6; font-size: 18px; }

    .ticket-card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 15px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

    .ticket-header { background: #3b82f6; color: white; padding: 10px; margin: -15px -15px 15px -15px; border-radius: 8px 8px 0 0; font-weight: bold; }

    .ticket-info { margin: 8px 0; }

    .ticket-info strong { color: #3b82f6; }

    .total-section { background: #3b82f6; color: white; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }

    .total-section h2 { margin: 0; font-size: 24px; }

    .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }

  </style>

</head>

<body>

  <div class="container">

    <div class="header">

      ${

        companyLogoUrl

          ? `<img src="${companyLogoUrl}" alt="${companyName}" />`

          : ''

      }

      <h1>${companyName}</h1>

      <p>Emitido em: ${dateStr}</p>

    </div>

    <div class="content">

      <div class="summary-card">

        <h2>💳 Cobrança de Pagamento Pendente</h2>

        ${clientName ? `<p><strong>Cliente:</strong> ${clientName}</p>` : ''}

      </div>

      <div class="ticket-card">

        <div class="ticket-header">📋 Detalhes do Chamado</div>

        <div class="ticket-info"><strong>🔢 Número:</strong> ${ticketNumber}</div>

        <div class="ticket-info"><strong>🛠️ Serviço:</strong> ${serviceName}</div>

        <div class="ticket-info"><strong>  Data de Atendimento:</strong> ${attendanceDate}</div>

        <div class="ticket-info"><strong>💰 Valor a Receber:</strong> ${formatCurrency(

          total

        )}</div>

        ${

          paymentLink

            ? `<div class="ticket-info"><strong>🔗 Link de Pagamento:</strong> <a href="${paymentLink}">${paymentLink}</a></div>`

            : ''

        }

      </div>

      <div class="total-section">

        <h2>💰 Total: ${formatCurrency(total)}</h2>

      </div>

    </div>

    <div class="footer">

      <p>Documento gerado automaticamente por ${companyName}</p>

    </div>

  </div>

</body>

</html>

    `;

  };



  // Função para enviar Email de um único pagamento

  const handleSendEmailSingle = (payment: any, client: any) => {

    const email = client.email;

    if (!email) {

      toast({

        variant: 'destructive',

        title: 'Email não informado',

        description: 'O cliente não possui email cadastrado.',

      });

      return;

    }



    const subject = encodeURIComponent('Cobrança de Pagamento Pendente');

    const textBody = formatSinglePaymentMessage(payment, client.name);

    const url = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(

      textBody

    )}`;

    window.location.href = url;

  };



  // Função para exportar Excel (múltiplos pagamentos)

  const handleExportExcel = async (clientData: any) => {

    if (

      !requirePaid({

        feature: 'Exportacao de relatorios',

        description: 'Exportacoes estao disponiveis apenas na versao paga.',

      })

    ) {

      return;

    }

    try {

      const ExcelJS = await import('exceljs');

      const workbook = new ExcelJS.Workbook();

      const worksheet = workbook.addWorksheet('Cobrança de Pagamentos');



      const companyName = user?.companyName || 'ChamadosPro';

      const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", {

        locale: ptBR,

      });



      // Estilos

      const headerStyle = {

        font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },

        fill: {

          type: 'pattern' as const,

          pattern: 'solid' as const,

          fgColor: { argb: 'FF3B82F6' },

        },

        alignment: {

          horizontal: 'center' as const,

          vertical: 'middle' as const,

        },

        border: {

          top: { style: 'thin' as const, color: { argb: 'FF000000' } },

          bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },

          left: { style: 'thin' as const, color: { argb: 'FF000000' } },

          right: { style: 'thin' as const, color: { argb: 'FF000000' } },

        },

      };



      const titleStyle = {

        font: { bold: true, size: 16, color: { argb: 'FF3B82F6' } },

        alignment: {

          horizontal: 'center' as const,

          vertical: 'middle' as const,

        },

      };



      const cardHeaderStyle = {

        font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },

        fill: {

          type: 'pattern' as const,

          pattern: 'solid' as const,

          fgColor: { argb: 'FF3B82F6' },

        },

        alignment: { horizontal: 'left' as const, vertical: 'middle' as const },

        border: {

          top: { style: 'thin' as const, color: { argb: 'FF3B82F6' } },

          bottom: { style: 'thin' as const, color: { argb: 'FF3B82F6' } },

          left: { style: 'thin' as const, color: { argb: 'FF3B82F6' } },

          right: { style: 'thin' as const, color: { argb: 'FF3B82F6' } },

        },

      };



      const cardContentStyle = {

        fill: {

          type: 'pattern' as const,

          pattern: 'solid' as const,

          fgColor: { argb: 'FFF8F9FA' },

        },

        border: {

          top: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },

          bottom: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },

          left: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },

          right: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },

        },

      };



      // Header da empresa

      worksheet.mergeCells('A1:F1');

      const headerCell = worksheet.getCell('A1');

      headerCell.value = companyName;

      headerCell.style = headerStyle;

      worksheet.getRow(1).height = 30;



      worksheet.mergeCells('A2:F2');

      const dateCell = worksheet.getCell('A2');

      dateCell.value = `Emitido em: ${dateStr}`;

      dateCell.style = {

        ...headerStyle,

        font: { ...headerStyle.font, size: 10 },

      };

      worksheet.getRow(2).height = 20;



      // Título

      worksheet.mergeCells('A3:F3');

      const titleCell = worksheet.getCell('A3');

      titleCell.value = 'Cobrança de Pagamentos Pendentes';

      titleCell.style = titleStyle;

      worksheet.getRow(3).height = 25;



      // Cliente

      worksheet.mergeCells('A4:F4');

      const clientCell = worksheet.getCell('A4');

      clientCell.value = `Cliente: ${clientData.client.name}`;

      clientCell.style = { font: { bold: true, size: 12 } };

      worksheet.getRow(4).height = 20;



      let currentRow = 6;



      // Cabeçalhos da tabela

      worksheet.getRow(currentRow).values = [

        'Chamado',

        'Número',

        'Serviço',

        'Data de Atendimento',

        'Valor',

        'Link de Pagamento',

      ];

      worksheet.getRow(currentRow).eachCell((cell) => {

        cell.style = cardHeaderStyle;

      });

      worksheet.getRow(currentRow).height = 25;

      currentRow++;



      // Dados dos chamados

      clientData.payments.forEach((payment: any, index: number) => {

        const ticket = payment.ticket;

        if (!ticket) return;



        const ticketNumber =

          (ticket as any).ticketNumber || ticket.id.slice(0, 8);

        const serviceName = ticket.service?.name || 'Serviço não informado';

        const attendanceDate = formatDate(

          ticket.completedAt || ticket.stoppedAt || ticket.scheduledDate

        );

        const total = ticket

          ? ticketFinancials(ticket).total

          : normalizeAmount(payment.amount);

        const paymentLink = generatePaymentLink(ticket.id);



        worksheet.getRow(currentRow).values = [

          `Chamado ${index + 1}`,

          ticketNumber,

          serviceName,

          attendanceDate,

          total,

          paymentLink || '-',

        ];

        worksheet.getRow(currentRow).eachCell((cell, colNumber) => {

          cell.style = cardContentStyle;

          if (colNumber === 5) {

            // Coluna de valor

            cell.numFmt = 'R$ #,##0.00';

            cell.style.font = { bold: true, color: { argb: 'FF3B82F6' } };

          }

        });

        worksheet.getRow(currentRow).height = 20;

        currentRow++;

      });



      // Total

      const totalAmount = clientData.payments.reduce((sum: number, p: any) => {

        const ticket = p.ticket;

        const total = ticket

          ? ticketFinancials(ticket).total

          : normalizeAmount(p.amount);

        return sum + total;

      }, 0);



      currentRow++;

      worksheet.mergeCells(`A${currentRow}:E${currentRow}`);

      const totalLabelCell = worksheet.getCell(`A${currentRow}`);

      totalLabelCell.value = 'TOTAL A PAGAR:';

      totalLabelCell.style = {

        font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },

        fill: {

          type: 'pattern',

          pattern: 'solid',

          fgColor: { argb: 'FF3B82F6' },

        },

        alignment: { horizontal: 'right', vertical: 'middle' },

      };



      const totalValueCell = worksheet.getCell(`F${currentRow}`);

      totalValueCell.value = totalAmount;

      totalValueCell.numFmt = 'R$ #,##0.00';

      totalValueCell.style = {

        font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },

        fill: {

          type: 'pattern',

          pattern: 'solid',

          fgColor: { argb: 'FF3B82F6' },

        },

        alignment: { horizontal: 'center', vertical: 'middle' },

      };

      worksheet.getRow(currentRow).height = 30;



      // Rodapé

      currentRow += 2;

      worksheet.mergeCells(`A${currentRow}:F${currentRow}`);

      const footerCell = worksheet.getCell(`A${currentRow}`);

      footerCell.value = `Documento gerado automaticamente por ${companyName}`;

      footerCell.style = {

        font: { size: 10, color: { argb: 'FF6B7280' } },

        alignment: { horizontal: 'center', vertical: 'middle' },

      };



      // Ajustar largura das colunas

      worksheet.columns.forEach((column) => {

        column.width = 20;

      });



      // Salvar arquivo

      const buffer = await workbook.xlsx.writeBuffer();

      const blob = new Blob([buffer], {

        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      });

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');

      link.href = url;

      link.download = `Cobranca_${clientData.client.name.replace(

        /\s+/g,

        '_'

      )}_${new Date().toISOString().split('T')[0]}.xlsx`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);



      toast({

        title: 'Excel gerado',

        description: 'O arquivo Excel foi gerado com sucesso.',

      });

    } catch (error: any) {

      console.error('Erro ao gerar Excel:', error);

      toast({

        variant: 'destructive',

        title: 'Erro ao gerar Excel',

        description: error.message || 'Não foi possível gerar o arquivo Excel.',

      });

    }

  };



  // Função para exportar PDF (múltiplos pagamentos) - v3 com cards visuais, logo e nome da empresa

  const handleExportPDF = async (clientData: any) => {

    if (

      !requirePaid({

        feature: 'Geracao de PDF',

        description: 'Geracao de PDF esta disponivel apenas na versao paga.',

      })

    ) {

      return;

    }

    try {

      // Importar jsPDF dinamicamente

      const { jsPDF } = await import('jspdf');



      const doc = new jsPDF();

      const pageWidth = doc.internal.pageSize.getWidth();

      const pageHeight = doc.internal.pageSize.getHeight();

      const margin = 14;

      const cardWidth = pageWidth - margin * 2;

      let yPos = margin;



      // Cores

      const primaryColor = [59, 130, 246] as [number, number, number]; // Azul

      const lightGray = [243, 244, 246] as [number, number, number];

      const darkGray = [107, 114, 128] as [number, number, number];

      const white = [255, 255, 255] as [number, number, number];



      // ===== HEADER COM LOGO E NOME DA EMPRESA =====

      const companyName = user?.companyName || 'ChamadosPro';

      const companyLogoUrl = user?.companyLogoUrl;



      // Card do header

      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);

      doc.roundedRect(margin, yPos, cardWidth, 35, 3, 3, 'F');



      // Logo (se disponível)

      if (companyLogoUrl) {

        try {

          // Tentar carregar a imagem

          const img = new Image();

          img.crossOrigin = 'anonymous';

          img.src = companyLogoUrl;



          await new Promise((resolve, reject) => {

            img.onload = resolve;

            img.onerror = reject;

            setTimeout(reject, 5000); // Timeout de 5s

          });



          // Adicionar logo (máximo 30x30)

          const logoSize = 30;

          doc.addImage(

            companyLogoUrl,

            'PNG',

            margin + 10,

            yPos + 2.5,

            // logoSize,

            // logoSize

          );

        } catch (logoError) {

          dashboardWarn('Erro ao carregar logo:', logoError);

          // Continuar sem logo se houver erro

        }

      }



      // Nome da empresa

      doc.setFontSize(20);

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

      doc.setFont('helvetica', 'bold');

      const logoWidth = companyLogoUrl ? 45 : 0;

      doc.text(companyName, margin + logoWidth + 5, yPos + 20);



      // Data de emissão

      doc.setFontSize(10);

      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

      doc.setFont('helvetica', 'normal');

      const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", {

        locale: ptBR,

      });

      doc.text(`Emitido em: ${dateStr}`, pageWidth - margin - 10, yPos + 20, {

        align: 'right',

      });



      yPos += 45;



      // ===== CARD DE RESUMO DO CLIENTE =====

      doc.setFillColor(white[0], white[1], white[2]);

      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);

      doc.setLineWidth(0.5);

      doc.roundedRect(margin, yPos, cardWidth, 30, 3, 3, 'FD');



      doc.setFontSize(16);

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

      doc.setFont('helvetica', 'bold');

      doc.text('Cobrança de Pagamentos Pendentes', margin + 10, yPos + 10);



      doc.setFontSize(12);

      doc.setTextColor(0, 0, 0);

      doc.setFont('helvetica', 'normal');

      doc.text(`Cliente: ${clientData.client.name}`, margin + 10, yPos + 20);



      doc.setFontSize(14);

      doc.setFont('helvetica', 'bold');

      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

      doc.text(

        `Total: ${formatCurrency(clientData.totalAmount)}`,

        pageWidth - margin - 10,

        yPos + 20,

        { align: 'right' }

      );



      yPos += 40;



      // ===== CARDS DE CHAMADOS =====

      doc.setFontSize(14);

      doc.setTextColor(0, 0, 0);

      doc.setFont('helvetica', 'bold');

      doc.text('Detalhamento dos Chamados:', margin, yPos);

      yPos += 10;



      clientData.payments.forEach((payment: any, index: number) => {

        // Verificar se precisa de nova página

        if (yPos > pageHeight - 80) {

          doc.addPage();

          yPos = margin;

        }



        const ticket = payment.ticket;

        if (!ticket) return;



        const ticketNumber =

          (ticket as any).ticketNumber || ticket.id.slice(0, 8);

        const serviceName = ticket.service?.name || 'Serviço não informado';

        const attendanceDate = formatDate(

          ticket.completedAt || ticket.stoppedAt || ticket.scheduledDate

        );

        const total = ticket

          ? ticketFinancials(ticket).total

          : normalizeAmount(payment.amount);

        const paymentLink = generatePaymentLink(ticket.id);



        // Card do chamado

        const cardHeight = 50;

        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);

        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);

        doc.setLineWidth(0.3);

        doc.roundedRect(margin, yPos, cardWidth, cardHeight, 3, 3, 'FD');



        // Header do card (com cor de fundo)

        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);

        doc.roundedRect(margin, yPos, cardWidth, 12, 3, 3, 'F');



        doc.setFontSize(12);

        doc.setTextColor(white[0], white[1], white[2]);

        doc.setFont('helvetica', 'bold');

        doc.text(`Chamado ${index + 1}`, margin + 8, yPos + 8);



        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

        doc.setFontSize(11);

        doc.setFont('helvetica', 'bold');

        doc.text(

          `Valor: ${formatCurrency(total)}`,

          pageWidth - margin - 8,

          yPos + 8,

          {

            align: 'right',

          }

        );



        yPos += 15;



        // Conteúdo do card

        doc.setFontSize(10);

        doc.setTextColor(0, 0, 0);

        doc.setFont('helvetica', 'normal');



        const lineHeight = 6;

        doc.text(`Número: ${ticketNumber}`, margin + 8, yPos);

        yPos += lineHeight;

        doc.text(`Serviço: ${serviceName}`, margin + 8, yPos);

        yPos += lineHeight;

        doc.text(`Data de Atendimento: ${attendanceDate}`, margin + 8, yPos);

        yPos += lineHeight;



        if (paymentLink) {

          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

          doc.text(`Link de Pagamento: ${paymentLink}`, margin + 8, yPos);

          doc.setTextColor(0, 0, 0);

          yPos += lineHeight;

        }



        yPos += 8; // Espaço entre cards

      });



      // ===== RODAPÉ =====

      yPos = pageHeight - 20;

      doc.setFontSize(8);

      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

      doc.setFont('helvetica', 'normal');

      doc.text(

        `Documento gerado automaticamente por ${companyName}`,

        pageWidth / 2,

        yPos,

        { align: 'center' }

      );



      // Salvar PDF

      const fileName = `Cobranca_${clientData.client.name.replace(

        /\s+/g,

        '_'

      )}_${new Date().toISOString().split('T')[0]}.pdf`;

      doc.save(fileName);



      toast({

        title: 'PDF gerado',

        description: 'O PDF foi gerado com sucesso.',

      });

    } catch (error: any) {

      console.error('Erro ao gerar PDF:', error);

      toast({

        variant: 'destructive',

        title: 'Erro ao gerar PDF',

        description: error.message || 'Não foi possível gerar o PDF.',

      });

    }

  };



  // Função para exportar PDF de um único pagamento

  const handleExportPDFSingle = async (payment: any, client: any) => {

    if (

      !requirePaid({

        feature: 'Geracao de PDF',

        description: 'Geracao de PDF esta disponivel apenas na versao paga.',

      })

    ) {

      return;

    }

    try {

      // Importar jsPDF dinamicamente

      const { jsPDF } = await import('jspdf');



      const doc = new jsPDF();

      let yPos = 20;



      // Título

      doc.setFontSize(18);

      doc.text('Cobrança de Pagamento Pendente', 14, yPos);

      yPos += 10;



      // Informações do cliente

      doc.setFontSize(12);

      doc.text(`Cliente: ${client.name}`, 14, yPos);

      yPos += 10;



      const ticket = payment.ticket;

      if (ticket) {

        const ticketNumber =

          (ticket as any).ticketNumber || ticket.id.slice(0, 8);

        const serviceName = ticket.service?.name || 'Serviço não informado';

        const attendanceDate = formatDate(

          ticket.completedAt || ticket.stoppedAt || ticket.scheduledDate

        );

        const total = ticket

          ? ticketFinancials(ticket).total

          : normalizeAmount(payment.amount);

        const paymentLink = generatePaymentLink(ticket.id);



        // Detalhes do chamado

        doc.setFontSize(14);

        doc.text('Detalhamento do Chamado:', 14, yPos);

        yPos += 8;



        doc.setFontSize(11);

        doc.setFont('helvetica', 'bold');

        doc.text('Chamado:', 14, yPos);

        yPos += 6;



        doc.setFont('helvetica', 'normal');

        doc.text(`Número: ${ticketNumber}`, 20, yPos);

        yPos += 6;

        doc.text(`Serviço: ${serviceName}`, 20, yPos);

        yPos += 6;

        doc.text(`Data de Atendimento: ${attendanceDate}`, 20, yPos);

        yPos += 6;

        doc.text(`Valor a Receber: ${formatCurrency(total)}`, 20, yPos);

        yPos += 6;

        if (paymentLink) {

          doc.text(`Link de Pagamento: ${paymentLink}`, 20, yPos);

          yPos += 6;

        }

      }



      // Salvar PDF

      const fileName = `Cobranca_${client.name.replace(/\s+/g, '_')}_${

        new Date().toISOString().split('T')[0]

      }.pdf`;

      doc.save(fileName);



      toast({

        title: 'PDF gerado',

        description: 'O PDF foi gerado com sucesso.',

      });

    } catch (error: any) {

      console.error('Erro ao gerar PDF:', error);

      toast({

        variant: 'destructive',

        title: 'Erro ao gerar PDF',

        description: error.message || 'Não foi possível gerar o PDF.',

      });

    }

  };



  const handleCopyAddress = async (address: string) => {

    try {

      await navigator.clipboard.writeText(address);

      toast({

        title: 'Endereço copiado',

        description: 'O endereço foi copiado para a área de transferência.',

      });

    } catch (error) {

      console.error('Erro ao copiar endereço:', error);

      toast({

        variant: 'destructive',

        title: 'Erro ao copiar',

        description: 'Não foi possível copiar o endereço.',

      });

    }

  };



  const handleOpenInGPS = (address: string) => {

    if (!address || address.trim() === '') {

      toast({

        variant: 'destructive',

        title: 'Endereço não informado',

        description: 'Não é possível abrir o GPS sem um endereço.',

      });

      return;

    }



    // Codificar o endereço para URL

    const encodedAddress = encodeURIComponent(address);



    // Tentar abrir no Waze primeiro (se instalado), senão Google Maps

    // Waze URL: https://waze.com/ul?q= (funciona no navegador e tenta abrir app se instalado)

    // Google Maps: https://www.google.com/maps/search/?api=1&query= (sempre funciona)



    const wazeUrl = `https://waze.com/ul?q=${encodedAddress}`;

    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;



    // Tenta abrir Waze primeiro (se o app estiver instalado no dispositivo, abre direto)

    // Se não tiver Waze, o navegador vai abrir o Google Maps

    window.open(wazeUrl, '_blank');

  };



  const formatCurrency = (value: number) =>

    new Intl.NumberFormat('pt-BR', {

      style: 'currency',

      currency: 'BRL',

    }).format(value);



  const formatDate = (value: string | Date | null) => {

    if (!value) return 'Sem data';

    const d = value instanceof Date ? value : new Date(value);

    return isNaN(d.getTime())

      ? 'Data inválida'

      : format(d, 'dd/MM/yyyy', { locale: ptBR });

  };



  const formatDateTime = (value: string | Date | null) => {

    if (!value) return 'Sem horrio';

    const d = value instanceof Date ? value : new Date(value);

    return isNaN(d.getTime())

      ? 'Data inválida'

      : format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR });

  };



  const handleMetricClick = (metricType: string) => {

    setExpandedMetric((prev) => (prev === metricType ? null : metricType));

  };



  const ticketFinancials = (ticket: Ticket) => {

    const base = ticket.ticketValue

      ? Number(ticket.ticketValue)

      : Number(ticket.service.price || 0);

    const km =

      ticket.kmRate && ticket.kmTotal

        ? Number(ticket.kmRate) * Number(ticket.kmTotal)

        : 0;

    const extras = ticket.extraExpenses ? Number(ticket.extraExpenses) : 0;

    const total = ticket.totalAmount ?? base + km + extras;

    return { base, km, extras, total };

  };



  // dados derivados

  const chamadosEmAberto =

    stats?.chamadosEmAberto ?? stats?.pendingTickets ?? 0;

  const completedThisMonth = stats?.completedThisMonth ?? 0;

  const cancelledThisMonth = stats?.cancelledThisMonth ?? 0;

  const slaHoursAvg = stats?.slaHoursAvg ?? 0;

  const faturamentoEstimado = stats?.faturamentoEstimado ?? 0;

  const ticketMedio = stats?.ticketMedio ?? 0;

  const revenuePerHourAvg = stats?.revenuePerHourAvg ?? 0;

  const revenuePerHourRanking = stats?.revenuePerHourRanking ?? [];



  // Logs para debug das métricas

  useEffect(() => {

    dashboardLog('[Dashboard] 📊 Stats recebidos do backend:', {

      chamadosEmAberto,

      completedThisMonth,

      cancelledThisMonth,

      slaHoursAvg,

      faturamentoEstimado,

      ticketMedio,

      revenuePerHourAvg,

      revenuePerHourRanking: revenuePerHourRanking.length,

      revenuePerHourRankingData: revenuePerHourRanking,

      statsRaw: stats,

      isLoading: loadingStats,

      error: statsError,

      selectedPeriod,

    });



    // Alertar se os valores estão zerados mas deveriam ter dados

    if (stats && !loadingStats) {

      if (revenuePerHourAvg === 0) {

        dashboardWarn(

          '[Dashboard] ⚠️ revenuePerHourAvg está zerado. Verifique se há tickets concluídos com pagamento recebido no mês no banco de dados.'

        );

      }

    }

  }, [

    stats,

    chamadosEmAberto,

    completedThisMonth,

    cancelledThisMonth,

    slaHoursAvg,

    faturamentoEstimado,

    ticketMedio,

    revenuePerHourAvg,

    revenuePerHourRanking,

    loadingStats,

    statsError,

    selectedPeriod,

  ]);



  // Calcular ranking de clientes por tipo

  const clientsByType = useMemo(() => {

    const counts = {

      PF: allClients.filter((c) => c.type === 'PF').length,

      PJ: allClients.filter((c) => c.type === 'PJ').length,

      EMPRESA_PARCEIRA: allClients.filter((c) => c.type === 'EMPRESA_PARCEIRA')

        .length,

    };



    // Criar ranking ordenado por quantidade

    const ranking = Object.entries(counts)

      .map(([type, count]) => ({ type, count }))

      .filter((item) => item.count > 0)

      .sort((a, b) => b.count - a.count)

      .slice(0, 3);



    return { counts, ranking };

  }, [allClients]);



  // Calcular faturamento por mês (últimos 12 meses)

  const monthlyBilling = useMemo(() => {

    const now = new Date();

    const months: Array<{

      month: number;

      year: number;

      revenue: number;

      monthName: string;

    }> = [];



    // Criar array com os últimos 12 meses

    for (let i = 11; i >= 0; i--) {

      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);

      months.push({

        month: date.getMonth(),

        year: date.getFullYear(),

        revenue: 0,

        monthName: format(date, 'MMMM yyyy', { locale: ptBR }),

      });

    }



    // Calcular faturamento de cada mês baseado em tickets concluídos

    tickets.forEach((t: any) => {

      const status = normalizeStatus((t.status || '').toString());

      // Aceitar CONCLUÍDO (com acento), CONCLUIDO (sem acento) e COMPLETED

      if (

        status !== 'COMPLETED' &&

        status !== 'CONCLUIDO' &&

        status !== 'CONCLUÍDO'

      ) {

        return;

      }



      // Usar completedAt ou stoppedAt para filtrar por mês de conclusão

      // Se não tiver, usar scheduledDate como fallback

      let completionDate: Date | null = null;

      if (t.completedAt) {

        completionDate = new Date(t.completedAt);

      } else if (t.stoppedAt) {

        completionDate = new Date(t.stoppedAt);

      } else if (t.scheduledDate) {

        completionDate = new Date(t.scheduledDate);

      }



      if (!completionDate || isNaN(completionDate.getTime())) {

        return;

      }



      const monthIndex = months.findIndex(

        (m) =>

          m.month === completionDate!.getMonth() &&

          m.year === completionDate!.getFullYear()

      );



      if (monthIndex >= 0) {

        const ticketValue = t.ticketValue ? parseFloat(t.ticketValue) : 0;

        const servicePrice = t.service?.price ? parseFloat(t.service.price) : 0;

        const baseValue = ticketValue || servicePrice || 0;

        const kmValue =

          t.kmRate && t.kmTotal

            ? parseFloat(t.kmRate) * parseFloat(t.kmTotal)

            : 0;

        const extraExpenses = t.extraExpenses ? parseFloat(t.extraExpenses) : 0;

        const totalAmount = t.totalAmount

          ? parseFloat(t.totalAmount)

          : baseValue + kmValue + extraExpenses;



        months[monthIndex].revenue += totalAmount;

      }

    });



    // Criar ranking ordenado por faturamento

    const ranking = months

      .filter((m) => m.revenue > 0)

      .sort((a, b) => b.revenue - a.revenue)

      .slice(0, 3);



    return { months, ranking };

  }, [tickets]);



  // Calcular chamados agendados ordenados por data/hora (mais próximo primeiro)

  const scheduledTickets = useMemo(() => {

    const now = new Date();

    dashboardLog('[Dashboard] Total de tickets recebidos:', tickets.length);

    dashboardLog(

      '[Dashboard] Primeiros 3 tickets (detalhado):',

      tickets.slice(0, 3).map((t: any) => ({

        id: t.id,

        status: t.status,

        scheduledDate: t.scheduledDate,

        scheduledFor: t.scheduledFor,

        scheduledTime: t.scheduledTime,

        scheduled_date: t.scheduled_date,

        date: t.date,

        client: t.client?.name,

        service: t.service?.name,

        startedAt: t.startedAt,

        stoppedAt: t.stoppedAt,

        completedAt: t.completedAt,

      }))

    );



    // Filtrar apenas chamados agendados (pending ou in-progress) com data futura ou hoje

    const openTickets = tickets

      .filter((t: any) => {

        // Se status estiver vazio ou undefined, considerar como ABERTO (padrão do schema)

        const rawStatus = t.status || 'ABERTO';

        const status = normalizeStatus(rawStatus.toString());

        dashboardLog(

          `[Dashboard] Ticket ${t.id}: status=${status} (raw: ${rawStatus}), scheduledDate=${t.scheduledDate}, scheduledFor=${t.scheduledFor}`

        );



        // Incluir apenas pending ou in-progress (ABERTO ou INICIADO)

        if (

          status !== 'PENDING' &&

          status !== 'IN-PROGRESS' &&

          status !== 'ABERTO' &&

          status !== 'INICIADO' &&

          status !== 'EXECUCAO' // Compatibilidade com status antigo

        ) {

          dashboardLog(

            `[Dashboard] ❌ Ticket ${t.id} filtrado por status: ${status}`

          );

          return false;

        }



        // Tentar múltiplos campos possíveis para data agendada

        let scheduledDateValue =

          t.scheduledDate || t.scheduledFor || t.scheduled_date || t.date;



        // Se scheduledDate é um objeto Date, converter para string

        if (scheduledDateValue instanceof Date) {

          scheduledDateValue = scheduledDateValue.toISOString();

        }



        // Se scheduledFor contém data e hora, extrair apenas a data

        if (

          scheduledDateValue &&

          typeof scheduledDateValue === 'string' &&

          scheduledDateValue.includes('T')

        ) {

          scheduledDateValue = scheduledDateValue.split('T')[0];

        }



        if (!scheduledDateValue) {

          dashboardLog('[Dashboard] ❌ Ticket sem data agendada:', {

            id: t.id,

            status: t.status,

            scheduledDate: t.scheduledDate,

            scheduledFor: t.scheduledFor,

            scheduled_date: t.scheduled_date,

            date: t.date,

          });

          return false;

        }



        const scheduledDate = new Date(scheduledDateValue);

        if (isNaN(scheduledDate.getTime())) {

          dashboardLog('[Dashboard] ❌ Data agendada inválida:', {

            id: t.id,

            scheduledDateValue,

            scheduledDate: t.scheduledDate,

            scheduledFor: t.scheduledFor,

          });

          return false;

        }



        // Incluir apenas chamados de hoje ou futuros

        scheduledDate.setHours(0, 0, 0, 0);

        const today = new Date(now);

        today.setHours(0, 0, 0, 0);



        const isTodayOrFuture = scheduledDate >= today;

        if (!isTodayOrFuture) {

          dashboardLog('[Dashboard] Ticket com data passada (ignorado):', {

            id: t.id,

            scheduledDate: scheduledDate.toISOString(),

            today: today.toISOString(),

            client: t.client?.name,

          });

        } else {

          dashboardLog('[Dashboard] Ticket agendado valido:', {

            id: t.id,

            scheduledDate: scheduledDate.toISOString(),

            client: t.client?.name,

            service: t.service?.name,

          });

        }



        return isTodayOrFuture;

      })

      .map((t: any) => {

        // Tentar múltiplos campos possíveis para data agendada

        let scheduledDateValue =

          t.scheduledDate || t.scheduledFor || t.scheduled_date || t.date;



        // Se scheduledDate é um objeto Date, converter para string

        if (scheduledDateValue instanceof Date) {

          scheduledDateValue = scheduledDateValue.toISOString();

        }



        // Se scheduledFor contém data e hora, extrair apenas a data

        if (

          scheduledDateValue &&

          typeof scheduledDateValue === 'string' &&

          scheduledDateValue.includes('T')

        ) {

          scheduledDateValue = scheduledDateValue.split('T')[0];

        }



        const scheduledDate = new Date(scheduledDateValue);

        const scheduledTime = t.scheduledTime || t.scheduled_time || '00:00';



        // Criar data/hora completa para ordenação

        const [hours, minutes] = scheduledTime.split(':').map(Number);

        const fullDateTime = new Date(scheduledDate);

        fullDateTime.setHours(hours || 0, minutes || 0, 0, 0);



        // Formatar dia da semana

        const dayOfWeek = format(fullDateTime, 'EEEE', { locale: ptBR });

        const dayOfWeekCapitalized =

          dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);



        // Formatar data

        const formattedDate = format(fullDateTime, 'dd/MM/yyyy', {

          locale: ptBR,

        });



        // Para EMPRESA_PARCEIRA, usar serviceAddress do chamado (definido no cadastro do chamado)

        // Para PF e PJ Cliente Final, usar address do ticket (que foi copiado do cadastro do cliente)

        const isEmpresaParceira = t.client?.type === 'EMPRESA_PARCEIRA';



        let fullAddress: string;

        if (isEmpresaParceira) {

          // Para EMPRESA_PARCEIRA, usar serviceAddress que foi definido no cadastro do chamado

          fullAddress = t.serviceAddress || 'Endereço não informado';

        } else {

          // Para PF e PJ Cliente Final, o address do ticket já contém o endereço completo

          // (rua, bairro, cidade, estado) copiado do cadastro do cliente

          // Se o address já contém cidade/estado, usar apenas ele

          // Caso contrário (tickets antigos), adicionar city e state

          const addressFromTicket = t.address || '';

          const hasCityOrState =

            addressFromTicket &&

            (addressFromTicket.includes(t.city || '') ||

              addressFromTicket.includes(t.state || ''));



          if (hasCityOrState || !t.city) {

            // Address já contém tudo ou não tem cidade/estado separados

            fullAddress = addressFromTicket || 'Endereço não informado';

          } else {

            // Tickets antigos: combinar address com city e state

            fullAddress =

              [addressFromTicket, t.city || '', t.state || '']

                .filter(Boolean)

                .join(', ') || 'Endereço não informado';

          }

        }



        return {

          ...t,

          fullDateTime,

          dayOfWeek: dayOfWeekCapitalized,

          formattedDate,

          scheduledTime,

          address: isEmpresaParceira ? t.serviceAddress || '' : t.address || '',

          city: t.city || '',

          state: t.state || '',

          fullAddress,

          clientName: t.client?.name || 'Cliente não identificado',

          serviceName: t.service?.name || 'Serviço não informado',

        };

      })

      .sort(

        (a: any, b: any) => a.fullDateTime.getTime() - b.fullDateTime.getTime()

      ); // Ordenar do mais próximo para o mais distante



    dashboardLog(

      '[Dashboard] 📋 Chamados agendados encontrados:',

      openTickets.length

    );

    if (openTickets.length > 0) {

      dashboardLog(

        '[Dashboard] Primeiros 3 chamados agendados:',

        openTickets.slice(0, 3).map((t: any) => ({

          id: t.id,

          clientName: t.clientName,

          serviceName: t.serviceName,

          formattedDate: t.formattedDate,

          scheduledTime: t.scheduledTime,

        }))

      );

    }



    return openTickets;

  }, [tickets]);



  // Criar mapa de registros financeiros por ticketId para acesso rápido (precisa estar antes de ticketsByProfitability)

  const financialRecordsByTicketId = useMemo(() => {

    const map = new Map<string, FinancialRecord>();

    financialRecords.forEach((record: any) => {

      if (record.ticketId) {

        map.set(record.ticketId, record);

      }

    });

    return map;

  }, [financialRecords]);



  // Calcular ranking de chamados por lucratividade (valor por hora)

  const ticketsByProfitability = useMemo(() => {

    const now = new Date();

    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);



    dashboardLog('[Dashboard] 🎯 Calculando ranking de lucratividade...');

    dashboardLog('[Dashboard] Total de tickets:', tickets.length);

    dashboardLog('[Dashboard] Período:', {

      firstDay: firstDayOfMonth.toISOString(),

      lastDay: lastDayOfMonth.toISOString(),

    });



    // Filtrar chamados concluídos do mês

    const completedTickets = tickets

      .filter((t: any) => {

        const status = normalizeStatus((t.status || '').toString());

        dashboardLog(

          `[Dashboard] 🎯 Ticket ${t.id}: status=${status} (raw: ${t.status})`

        );



        // Aceitar CONCLUÍDO (com acento), CONCLUIDO (sem acento) e COMPLETED

        if (

          status !== 'COMPLETED' &&

          status !== 'CONCLUIDO' &&

          status !== 'CONCLUÍDO'

        ) {

          dashboardLog(

            `[Dashboard] ❌ Ticket ${t.id} filtrado por status: ${status}`

          );

          return false;

        }



        // Usar completedAt ou stoppedAt para filtrar por mês de conclusão

        // Se não tiver, usar scheduledDate como fallback

        let completionDate: Date | null = null;

        if (t.completedAt) {

          completionDate = new Date(t.completedAt);

        } else if (t.stoppedAt) {

          completionDate = new Date(t.stoppedAt);

        } else if (t.scheduledDate) {

          completionDate = new Date(t.scheduledDate);

        }



        if (!completionDate || isNaN(completionDate.getTime())) {

          dashboardLog(

            `[Dashboard] ❌ Ticket ${t.id} sem data de conclusão válida`

          );

          return false;

        }



        const isInMonth =

          completionDate >= firstDayOfMonth && completionDate <= lastDayOfMonth;

        if (!isInMonth) {

          dashboardLog(

            `[Dashboard] ❌ Ticket ${

              t.id

            } fora do mês: ${completionDate.toISOString()}`

          );

        } else {

          dashboardLog(

            `[Dashboard]   Ticket ${

              t.id

            } incluído no ranking: ${completionDate.toISOString()}`

          );

        }



        return isInMonth;

      })

      .map((t: any) => {

        // Log detalhado de todos os campos do ticket para debug

        const ticketFields = {

          startedAt: t.startedAt,

          stoppedAt: t.stoppedAt,

          completedAt: t.completedAt,

          ticketValue: t.ticketValue,

          totalAmount: t.totalAmount,

          kmRate: t.kmRate,

          kmTotal: t.kmTotal,

          extraExpenses: t.extraExpenses,

          servicePrice: t.service?.price,

          service: t.service,

          elapsedSeconds: t.elapsedSeconds,

          duration: t.duration,

          // Verificar campos alternativos que podem ter o valor

          baseAmount: t.baseAmount,

          value: t.value,

          price: t.price,

          amount: t.amount,

        };

        dashboardLog(`[Dashboard] 📊 Processando ticket ${t.id}:`, ticketFields);



        // Calcular valor total do chamado

        // Tentar parsear valores que podem vir como string formatada (R$ 1.234,56)

        const parseValue = (val: any): number => {

          if (!val) return 0;

          if (typeof val === 'number') return val;

          if (typeof val === 'string') {

            // Remover caracteres não numéricos exceto vírgula e ponto

            const cleaned = val.replace(/[^\d,.-]/g, '').replace(',', '.');

            const parsed = parseFloat(cleaned);

            return isNaN(parsed) ? 0 : parsed;

          }

          return 0;

        };



        // Tentar obter valor de múltiplas fontes

        const ticketValue = parseValue(t.ticketValue);

        const servicePrice = parseValue(t.service?.price);

        const baseAmount = parseValue(t.baseAmount);

        const value = parseValue(t.value);

        const price = parseValue(t.price);

        const amount = parseValue(t.amount);



        // Prioridade: ticketValue > baseAmount > servicePrice > value > price > amount

        const baseValue =

          ticketValue ||

          baseAmount ||

          servicePrice ||

          value ||

          price ||

          amount ||

          0;



        const kmRate = parseValue(t.kmRate);

        const kmTotal = parseValue(t.kmTotal);

        const kmValue = kmRate && kmTotal ? kmRate * kmTotal : 0;

        const extraExpenses = parseValue(t.extraExpenses);

        const totalAmountRaw = parseValue(t.totalAmount);



        // Calcular totalAmount ANTES de calcular horas (para poder usar na verificação)

        let totalAmount = totalAmountRaw;

        if (!totalAmount || totalAmount === 0) {

          totalAmount = baseValue + kmValue + extraExpenses;

        }



        // Calcular horas de atendimento

        let hours = 0;

        if (t.startedAt && t.stoppedAt) {

          const start = new Date(t.startedAt);

          const stop = new Date(t.stoppedAt);

          if (

            !isNaN(start.getTime()) &&

            !isNaN(stop.getTime()) &&

            stop > start

          ) {

            const diffHours =

              (stop.getTime() - start.getTime()) / (1000 * 60 * 60);

            // Mínimo de 0.1h (6 minutos) para evitar valores absurdos

            // Máximo de 24h por segurança

            hours = Math.min(Math.max(diffHours, 0.1), 24);

          }

        } else if (t.startedAt && t.completedAt) {

          // Se não tiver stoppedAt, usar completedAt

          const start = new Date(t.startedAt);

          const completed = new Date(t.completedAt);

          if (

            !isNaN(start.getTime()) &&

            !isNaN(completed.getTime()) &&

            completed > start

          ) {

            const diffHours =

              (completed.getTime() - start.getTime()) / (1000 * 60 * 60);

            hours = Math.min(Math.max(diffHours, 0.1), 24);

          }

        } else if (t.elapsedSeconds) {

          const diffHours = t.elapsedSeconds / 3600;

          // Mínimo de 0.1h (6 minutos) para evitar valores absurdos

          // Máximo de 24h por segurança

          hours = Math.min(Math.max(diffHours, 0.1), 24);

        } else if (t.duration) {

          // Se tiver campo duration (em minutos ou horas)

          const durationHours =

            typeof t.duration === 'number'

              ? t.duration > 100

                ? t.duration / 60

                : t.duration // Se > 100, assume minutos, senão horas

              : parseFloat(t.duration) / 60;

          if (!isNaN(durationHours) && durationHours > 0) {

            hours = Math.min(Math.max(durationHours, 0.1), 24);

          }

        }



        // Se ainda não tiver horas calculadas mas tiver valor, usar 1 hora como padrão

        // para permitir que o ticket apareça no ranking

        if (hours === 0 && totalAmount > 0) {

          dashboardLog(

            `[Dashboard] ⚠️ Ticket ${t.id} sem horas calculadas, usando 1h padrão`

          );

          hours = 1;

        }



        dashboardLog(`[Dashboard] ⏱️ Ticket ${t.id} horas:`, {

          startedAt: t.startedAt,

          stoppedAt: t.stoppedAt,

          completedAt: t.completedAt,

          elapsedSeconds: t.elapsedSeconds,

          duration: t.duration,

          calculatedHours: hours,

        });



        // Se ainda for 0 mas tiver horas, permitir que apareça com valor 0 no ranking

        if (totalAmount === 0 && hours > 0) {

          dashboardLog(

            `[Dashboard] ⚠️ Ticket ${t.id} tem horas mas valor é 0 - será incluído com valor 0`

          );

        }



        dashboardLog(`[Dashboard] 💰 Ticket ${t.id} valores:`, {

          ticketValue,

          baseAmount,

          servicePrice,

          value,

          price,

          amount,

          baseValue,

          kmValue,

          extraExpenses,

          totalAmountRaw,

          totalAmount,

        });



        //   // CORREÇÃO: Usar apenas o valor base do serviço (sem km e despesas extras) para cálculo de R$ por hora

        // O totalAmount é mantido para exibição, mas o revenuePerHour usa apenas baseValue

        const revenuePerHour = hours >= 0.1 ? baseValue / hours : 0;



        dashboardLog(`[Dashboard]   Ticket ${t.id} calculado:`, {

          baseValue,

          totalAmount,

          hours,

          revenuePerHour,

          note: 'revenuePerHour usa apenas valor base (sem km e despesas extras)',

        });



        return {

          ...t,

          totalAmount,

          hours,

          revenuePerHour,

          clientName: t.client?.name || 'Cliente não identificado',

          clientType: t.client?.type || 'PF',

        };

      })

      .filter((t: any) => {

        // Incluir tickets que tenham horas válidas (mesmo que valor seja 0)

        // Isso permite que tickets concluídos apareçam mesmo sem valor definido

        const hasValidHours = t.hours > 0;

        if (!hasValidHours) {

          dashboardLog(

            `[Dashboard] ❌ Ticket ${t.id} sem horas válidas: hours=${t.hours}`

          );

          return false;

        }



        // FILTRAR APENAS CHAMADOS COM PAGAMENTO RECEBIDO (status 'paid')

        const financialRecord = financialRecordsByTicketId.get(t.id);

        const paymentStatus = financialRecord?.status || 'pending';

        if (paymentStatus !== 'paid') {

          dashboardLog(

            `[Dashboard] ❌ Ticket ${t.id} filtrado por status de pagamento: ${paymentStatus}`

          );

          return false;

        }



        // Se tiver horas mas não tiver valor, ainda incluir (valor será 0)

        if (t.totalAmount === 0) {

          dashboardLog(

            `[Dashboard] ⚠️ Ticket ${t.id} incluído com valor 0 (tem horas: ${t.hours}h)`

          );

        }

        return true;

      }) // Apenas chamados com tempo válido E pagamento recebido

      .sort((a: any, b: any) => b.revenuePerHour - a.revenuePerHour); // Ordenar por valor por hora (decrescente)



    dashboardLog(

      `[Dashboard] 🎯 Ranking final: ${completedTickets.length} tickets`

    );

    if (completedTickets.length > 0) {

      dashboardLog(

        '[Dashboard] Top 3:',

        completedTickets.slice(0, 3).map((t: any) => ({

          id: t.id,

          clientName: t.clientName,

          revenuePerHour: t.revenuePerHour,

          totalAmount: t.totalAmount,

          hours: t.hours,

        }))

      );

    }



    return completedTickets;

  }, [tickets, financialRecordsByTicketId]);



  // Funções auxiliares para processar dados financeiros

  // normalizeAmount já está declarado acima (linha 650), não redeclarar aqui



  const parseDate = (value: string | Date | null | undefined) => {

    if (!value) return null;

    const d = new Date(value);

    return isNaN(d.getTime()) ? null : d;

  };



  // Calcular pagamentos pendentes do mês agrupados por cliente (sempre calculado para uso condicional)

  const pendingPaymentsThisMonthData = useMemo(() => {

    const now = new Date();

    const currentMonth = now.getMonth();

    const currentYear = now.getFullYear();

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);

    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);



    // Filtrar registros financeiros pendentes do mês

    const pendingRecords = financialRecords

      .filter((record: any) => {

        //   // CORREÇÃO: Normalizar status para comparação (pode vir como string, number, etc)

        const status = String(record.status || 'pending')

          .toLowerCase()

          .trim();



        // APENAS registros com status 'pending' (case-insensitive)

        if (status !== 'pending') {

          return false;

        }



        // Se não tiver ticketId, não incluir (só queremos pagamentos de tickets)

        if (!record.ticketId) return false;



        // Buscar o ticket vinculado

        const ticket = tickets.find((t: any) => t.id === record.ticketId);

        if (!ticket) return false;



        // Verificar se o ticket está concluído

        const ticketStatus = normalizeStatus((ticket.status || '').toString());

        if (

          ticketStatus !== 'COMPLETED' &&

          ticketStatus !== 'CONCLUIDO' &&

          ticketStatus !== 'CONCLUÍDO'

        ) {

          return false;

        }



        // Usar a data de conclusão do ticket para filtrar por mês

        let completionDate: Date | null = null;

        if (ticket.completedAt) {

          completionDate = new Date(ticket.completedAt);

        } else if (ticket.stoppedAt) {

          completionDate = new Date(ticket.stoppedAt);

        } else if ((ticket as any).scheduledDate) {

          completionDate = new Date((ticket as any).scheduledDate);

        }



        if (!completionDate || isNaN(completionDate.getTime())) {

          return false;

        }



        // Verificar se foi concluído no mês atual

        return (

          completionDate >= firstDayOfMonth && completionDate <= lastDayOfMonth

        );

      })

      .map((record: any) => {

        const ticket = tickets.find((t: any) => t.id === record.ticketId);

        const client =

          ticket?.client ||

          allClients.find((c: any) => c.id === record.clientId);



        const dueDate = parseDate(record.dueDate) ?? new Date();

        const isOverdue = dueDate < now;



        return {

          ...record,

          ticket,

          client,

          amount: normalizeAmount(record.amount),

          dueDate,

          isOverdue,

        };

      });



    // Agrupar por cliente

    const clientMap = new Map<

      string,

      {

        client: any;

        payments: any[];

        totalAmount: number;

        ticketIds: string[];

      }

    >();



    pendingRecords.forEach((payment: any) => {

      const clientId = payment.client?.id;

      if (!clientId) return;



      if (!clientMap.has(clientId)) {

        clientMap.set(clientId, {

          client: payment.client,

          payments: [],

          totalAmount: 0,

          ticketIds: [],

        });

      }



      const clientData = clientMap.get(clientId)!;

      clientData.payments.push(payment);

      clientData.totalAmount += payment.amount;

      if (payment.ticketId) {

        clientData.ticketIds.push(payment.ticketId);

      }

    });



    const clientsWithPendingPayments = Array.from(clientMap.values()).sort(

      (a, b) => {

        // Ordenar por valor total pendente (maior primeiro)

        return b.totalAmount - a.totalAmount;

      }

    );



    // Calcular total de vencidos para notificação

    const overdueCount = pendingRecords.filter((p: any) => p.isOverdue).length;

    const overdueAmount = pendingRecords

      .filter((p: any) => p.isOverdue)

      .reduce((sum: number, p: any) => sum + p.amount, 0);



    return {

      pendingRecords,

      clientsWithPendingPayments,

      overdueCount,

      overdueAmount,

    };

  }, [financialRecords, tickets, allClients]);



  //   // CORREÇÃO: Resetar cliente selecionado se não tiver mais pagamentos pendentes

  useEffect(() => {

    if (selectedPendingClientId) {

      const { clientsWithPendingPayments } = pendingPaymentsThisMonthData;

      const clientData = clientsWithPendingPayments.find(

        (c) => c.client.id === selectedPendingClientId

      );



      // Se o cliente não tiver mais pagamentos pendentes, resetar o estado

      if (!clientData || clientData.payments.length === 0) {

        setSelectedPendingClientId(null);

      }

    }

  }, [selectedPendingClientId, pendingPaymentsThisMonthData]);



  // Manter compatibilidade com código existente

  const pendingPaymentsThisMonth = pendingPaymentsThisMonthData.pendingRecords;

  const clientesAtivosHoje = stats?.clientesAtivosHoje ?? 0;

  const clientesAtivosSemana = stats?.clientesAtivosSemana ?? 0;

  const proximosAgendamentos = stats?.proximosAgendamentos ?? 0;

  const pendenciasVencidas = stats?.pendenciasVencidas ?? 0;

  const aReceberVencido = stats?.aReceberVencido ?? 0;



  const totalOps = chamadosEmAberto + completedThisMonth;

  const openPct = totalOps

    ? Math.min(100, Math.round((chamadosEmAberto / totalOps) * 100))

    : 0;

  const completedPct = totalOps

    ? Math.min(100, Math.round((completedThisMonth / totalOps) * 100))

    : 0;

  const faturamentoPct =

    faturamentoEstimado > 0

      ? Math.min(

          100,

          Math.round(

            ((completedThisMonth * ticketMedio) / faturamentoEstimado) * 100

          )

        )

      : 0;



  // Calcular valores financeiros do período selecionado

  const financialMetrics = useMemo(() => {
  const periodStart = startDate;
  const periodEnd = new Date();

  const normalizeAmount = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return Number.isFinite(num) ? num : 0;
  };

  const parseDate = (value: string | Date | null | undefined) => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };

  const normalizeStatus = (value: unknown) =>
    String(value || '').trim().toLowerCase();

  const normalizeType = (value: unknown) =>
    String(value || '').trim().toLowerCase();

  const getRecordDate = (record: any) => {
    const status = normalizeStatus(record.status);
    if (['paid', 'pago'].includes(status)) {
      return (
        parseDate(record.paidAt) ||
        parseDate(record.paymentDate) ||
        parseDate(record.dueDate) ||
        parseDate(record.createdAt)
      );
    }
    return (
      parseDate(record.completionDate) ||
      parseDate(record.createdAt) ||
      parseDate(record.dueDate)
    );
  };

  const totals = financialRecords.reduce(
    (
      acc: {
        receivedThisMonth: number;
        pendingThisMonth: number;
        billingThisMonth: number;
      },
      record: any
    ) => {
      const recordDate = getRecordDate(record);
      if (!recordDate) return acc;

      if (recordDate < periodStart || recordDate > periodEnd) return acc;

      const status = normalizeStatus(record.status);
      const type = normalizeType(record.type);
      const amount = normalizeAmount(record.amount);

      if (['paid', 'pago'].includes(status)) {
        acc.receivedThisMonth += amount;
      } else if (
        ['pending', 'pendente', 'overdue', 'atrasado'].includes(status) &&
        type === 'receivable'
      ) {
        acc.pendingThisMonth += amount;
      }

      acc.billingThisMonth = acc.receivedThisMonth + acc.pendingThisMonth;
      return acc;
    },
    {
      receivedThisMonth: 0,
      pendingThisMonth: 0,
      billingThisMonth: 0,
    }
  );

  return totals;
}, [financialRecords, startDate]);



  const completedRevenue = useMemo(() => {
    const periodEnd = new Date();
    return tickets.reduce((sum, ticket: any) => {
      const status = String(ticket.status || '').toUpperCase();
      if (!status.includes('CONCLU') && status !== 'COMPLETED') {
        return sum;
      }
      const dateValue =
        ticket.completedAt ||
        ticket.stoppedAt ||
        ticket.scheduledDate ||
        ticket.scheduledFor ||
        ticket.createdAt;
      if (!dateValue) return sum;
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return sum;
      if (date < startDate || date > periodEnd) return sum;
      return sum + (ticketFinancials(ticket).total || 0);
    }, 0);
  }, [tickets, startDate]);

  const estimatedRevenue = useMemo(() => {
    const periodEnd = new Date();
    return tickets.reduce((sum, ticket: any) => {
      const dateValue =
        ticket.scheduledDate || ticket.scheduledFor || ticket.createdAt;
      if (!dateValue) return sum;
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return sum;
      if (date < startDate || date > periodEnd) return sum;
      return sum + (ticketFinancials(ticket).total || 0);
    }, 0);
  }, [tickets, startDate]);

  const baseEstimatedRevenue =
    faturamentoEstimado > 0 ? faturamentoEstimado : estimatedRevenue;
  const faturamentoEstimadoDisplay =
    baseEstimatedRevenue > 0 ? baseEstimatedRevenue : completedRevenue;

  const hasFinancialTotals = financialMetrics.billingThisMonth > 0;
  const totalRecebido = hasFinancialTotals
    ? financialMetrics.receivedThisMonth
    : completedRevenue;

  const totalPendente = hasFinancialTotals
    ? financialMetrics.pendingThisMonth
    : Math.max(0, faturamentoEstimadoDisplay - completedRevenue);

  // Faturamento total = soma de recebidos + pendentes do período
  const faturamentoTotal = totalRecebido + totalPendente;



  // Calcular métricas de KM (Ganhos, Gastos e Lucro)

  // Buscar métricas de KM do backend

  const {

    data: kmMetrics = { totalKm: 0, ganhosKm: 0, gastosKm: 0, lucroKm: 0 },

    isLoading: loadingKmMetrics,

  } = useQuery<{

    totalKm: number;

    ganhosKm: number;

    gastosKm: number;

    lucroKm: number;

  }>({

    queryKey: ['/api/dashboard/km-metrics', selectedPeriod],

    queryFn: async () => {

      const response = await apiRequest(

        'GET',

        `/api/dashboard/km-metrics?days=${days}`,

        undefined

      );

      if (!response.ok) {

        throw new Error('Erro ao buscar métricas de KM');

      }

      return await response.json();

    },

    refetchInterval: 30000, // Atualizar a cada 30 segundos

    refetchOnWindowFocus: true,

    refetchOnMount: true,

  });



  // Calcular progresso do faturamento (recebido / total)

  const progressoFaturamento =

    faturamentoTotal > 0

      ? Math.min(100, Math.round((totalRecebido / faturamentoTotal) * 100))

      : 0;



  const openTicketDialog = (ticket: Ticket) => {

    setSelectedTicket(ticket);

    setDialogOpen(true);

  };



  const renderTicketCard = (t: Ticket, isDialog = false) => {

    const { base, km, extras, total } = ticketFinancials(t);

    const start = formatDateTime(t.startedAt);

    const stop = formatDateTime(t.stoppedAt);

    const hours = (

      (differenceInHours(

        new Date(t.stoppedAt || ''),

        new Date(t.startedAt || '')

      ) || 0) as number

    ).toFixed(2);

    const phone = t.client.phone ? unmaskPhone(t.client.phone) : '';



    const handleWhatsApp = () => {

      if (

        !requirePaid({

          feature: 'Envio por WhatsApp',

          description:

            'Envios por WhatsApp estao disponiveis apenas na versao paga.',

        })

      ) {

        return;

      }

      if (!phone) {

        toast({

          variant: 'destructive',

          title: 'Telefone não informado',

          description: 'O cliente não possui telefone cadastrado.',

        });

        return;

      }

      const msg = [

        `Cliente: ${t.client.name || 'Cliente'}`,

        `Serviço: ${t.service.name || 'Serviço'}`,

        `Valor chamado: ${formatCurrency(base)}`,

        `Valor KM: ${formatCurrency(km)}`,

        `Extras: ${formatCurrency(extras)}`,

        `Total: ${formatCurrency(total)}`,

        `Início: ${start}`,

        `Fim: ${stop}`,

        `Duração: ${hours}h`,

        `Vencimento: ${formatDate(t.paymentDate)}`,

      ].join(' | ');

      const url = `https://wa.me/55${phone}text=${encodeURIComponent(msg)}`;

      window.open(url, '_blank');

    };



    return (

      <Card

        key={t.id}

        className='group relative overflow-hidden p-0 bg-white dark:bg-slate-900 border border-slate-300/50 dark:border-slate-800 cursor-pointer hover:shadow-xl hover:border-primary/20 transition-all duration-300 rounded-2xl'

        onClick={() => !isDialog && openTicketDialog(t)}

      >

        <div className='p-4 sm:p-5'>

          <div className='flex items-center justify-between gap-3 mb-4'>

            <div className='min-w-0'>

              <div className='flex items-center gap-2 mb-1'>

                <p className='font-black text-slate-900 dark:text-white truncate text-sm'>

                  {t.client.name || 'Cliente'}

                </p>

                {(t as any).ticketNumber && (

                  <Badge variant='outline' className='bg-primary/5 text-primary border-primary/10 text-[9px] font-black h-4 px-1.5'>

                    #{(t as any).ticketNumber}

                  </Badge>

                )}

              </div>

              <p className='text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate'>

                {t.service.name || 'Serviço'} • {formatDate(t.scheduledFor)}

              </p>

            </div>

            <Badge className='bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex-shrink-0'>

              Concluído

            </Badge>

          </div>



          <div className='grid grid-cols-3 gap-3 mb-4'>

            <div className='p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50'>

              <p className='text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5'>Chamado</p>

              <p className='text-[11px] font-bold text-slate-700 dark:text-slate-200'>{formatCurrency(base)}</p>

            </div>

            <div className='p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50'>

              <p className='text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5'>KM</p>

              <p className='text-[11px] font-bold text-slate-700 dark:text-slate-200'>{formatCurrency(km)}</p>

            </div>

            <div className='p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50'>

              <p className='text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5'>Extras</p>

              <p className='text-[11px] font-bold text-slate-700 dark:text-slate-200'>{formatCurrency(extras)}</p>

            </div>

          </div>



          <div className='flex items-center justify-between gap-2 mb-4 text-[10px] bg-slate-50 dark:bg-slate-800/30 p-2 rounded-xl border border-slate-300/50 dark:border-slate-800'>

            <div className='flex flex-col items-center flex-1'>

              <span className='text-[8px] font-black text-slate-400 uppercase tracking-widest'>Início</span>

              <span className='font-bold text-slate-600 dark:text-slate-300'>{start}</span>

            </div>

            <div className='h-4 w-[1px] bg-slate-200 dark:bg-slate-700' />

            <div className='flex flex-col items-center flex-1'>

              <span className='text-[8px] font-black text-slate-400 uppercase tracking-widest'>Fim</span>

              <span className='font-bold text-slate-600 dark:text-slate-300'>{stop}</span>

            </div>

            <div className='h-4 w-[1px] bg-slate-200 dark:bg-slate-700' />

            <div className='flex flex-col items-center flex-1'>

              <span className='text-[8px] font-black text-slate-400 uppercase tracking-widest'>Duração</span>

              <span className='font-black text-primary flex items-center gap-1'><Clock3 className='h-2.5 w-2.5' /> {hours}h</span>

            </div>

          </div>



          <div className='flex items-center justify-between mb-4'>

            <div>

              <p className='text-[8px] font-black uppercase tracking-widest text-slate-400'>Vencimento</p>

              <p className='text-xs font-bold text-slate-700 dark:text-slate-200'>{formatDate(t.paymentDate)}</p>

            </div>

            <div className='text-right'>

              <p className='text-[8px] font-black uppercase tracking-widest text-slate-400'>Total Bruto</p>

              <p className='text-lg font-black text-primary leading-tight'>{formatCurrency(total)}</p>

            </div>

          </div>



          <Button

            variant='ghost'

            className='w-full h-10 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 font-bold text-xs gap-2'

            onClick={(e) => {

              e.stopPropagation();

              handleWhatsApp();

            }}

          >

            <MessageCircle className='h-4 w-4' />

            Compartilhar via WhatsApp

          </Button>

        </div>

        <div className='absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full -mr-8 -mt-8' />

      </Card>

    );

  };



  // Usar ranking de lucratividade por tipo de cliente do backend

  const revenuePerHourByClientType: Array<{

    type: string;

    revenue: number;

    hours: number;

    avg: number;

    ticketCount: number;

  }> = useMemo(() => {

    // Usar os dados do backend que já estão calculados corretamente

    if (!revenuePerHourRanking || revenuePerHourRanking.length === 0) {

      return [];

    }



    dashboardLog(

      '[Dashboard] 💰 Ranking por tipo de cliente (do backend):',

      revenuePerHourRanking

    );



    return revenuePerHourRanking;

  }, [revenuePerHourRanking]);



  // Calcular chamados concluídos do mês agrupados por cliente (sempre calculado para uso condicional)

  const completedTicketsThisMonthData = useMemo(() => {

    const now = new Date();

    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);



    // Filtrar chamados concluídos do mês

    const completedTickets = tickets.filter((t: any) => {

      const status = normalizeStatus((t.status || '').toString());

      const isCompleted =

        status === 'CONCLUÍDO' ||

        status === 'CONCLUIDO' ||

        status === 'COMPLETED';

      if (!isCompleted) return false;



      let completionDate: Date | null = null;

      if (t.completedAt) {

        completionDate = new Date(t.completedAt);

      } else if (t.stoppedAt) {

        completionDate = new Date(t.stoppedAt);

      } else if (t.scheduledDate) {

        completionDate = new Date(t.scheduledDate);

      }



      if (!completionDate || isNaN(completionDate.getTime())) return false;



      return (

        completionDate >= firstDayOfMonth && completionDate <= lastDayOfMonth

      );

    });



    // Agrupar por cliente

    const clientMap = new Map<

      string,

      {

        client: any;

        tickets: any[];

        totalPending: number;

        totalPaid: number;

        pendingTicketIds: string[];

      }

    >();



    completedTickets.forEach((ticket: any) => {

      const clientId = ticket.client?.id;

      if (!clientId) return;



      if (!clientMap.has(clientId)) {

        clientMap.set(clientId, {

          client: ticket.client,

          tickets: [],

          totalPending: 0,

          totalPaid: 0,

          pendingTicketIds: [],

        });

      }



      const clientData = clientMap.get(clientId)!;

      clientData.tickets.push(ticket);



      const financialRecord = financialRecordsByTicketId.get(ticket.id);

      const paymentStatus = financialRecord?.status || 'pending';

      const { total } = ticketFinancials(ticket);



      if (paymentStatus === 'paid') {

        clientData.totalPaid += total;

      } else {

        clientData.totalPending += total;

        clientData.pendingTicketIds.push(ticket.id);

      }

    });



    const clientsWithTickets = Array.from(clientMap.values()).sort((a, b) => {

      // Ordenar por número de chamados (mais primeiro)

      return b.tickets.length - a.tickets.length;

    });



    return {

      completedTickets,

      clientsWithTickets,

    };

  }, [tickets, financialRecordsByTicketId]);



  // Se estiver mostrando apenas a lista de chamados concluídos, renderizar apenas ela

  if (showCompletedTickets) {

    const { completedTickets: completedTicketsThisMonth, clientsWithTickets } =

      completedTicketsThisMonthData;



    // Se um cliente específico foi selecionado, mostrar seus chamados

    if (selectedClientId) {

      const clientData = clientsWithTickets.find(

        (c) => c.client.id === selectedClientId

      );



      if (!clientData) {

        return (

          <div className='space-y-6'>

            <div className='flex items-center justify-between'>

              <div>

                <h1 className='text-3xl font-semibold mb-2'>

                  Chamados do Cliente

                </h1>

              </div>

              <Button

                variant='outline'

                onClick={() => setSelectedClientId(null)}

                className='flex items-center gap-2'

              >

                <ArrowLeft className='h-4 w-4' />

                Voltar

              </Button>

            </div>

            <Card>

              <CardContent className='p-8 text-center'>

                <XCircle className='h-12 w-12 mx-auto text-muted-foreground mb-4' />

                <p className='text-lg font-semibold mb-2'>

                  Cliente não encontrado

                </p>

              </CardContent>

            </Card>

          </div>

        );

      }



      return (

        <div className='space-y-6'>

          <div className='flex items-center justify-between'>

            <div>

              <h1 className='text-3xl font-semibold mb-2'>

                Chamados de {clientData.client.name}

              </h1>

              <p className='text-muted-foreground'>

                {clientData.tickets.length} chamado(s) concluído(s) este mês

              </p>

            </div>

            <Button

              variant='outline'

              onClick={() => setSelectedClientId(null)}

              className='flex items-center gap-2'

            >

              <ArrowLeft className='h-4 w-4' />

              Voltar

            </Button>

          </div>



          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>

            {clientData.tickets.map((ticket: any) => {

              const financialRecord = financialRecordsByTicketId.get(ticket.id);

              const paymentStatus = financialRecord?.status || 'pending';

              const isPaid = paymentStatus === 'paid';

              const { base, km, extras, total } = ticketFinancials(ticket);



              return (

                <Card

                  key={ticket.id}

                  className='border border-slate-300/50 dark:border-slate-800 bg-emerald-500/5 hover:shadow-md'

                >

                  <CardContent className='p-4'>

                    <div className='flex items-start justify-between mb-3'>

                      <div className='flex-1'>

                        <p className='font-semibold text-lg mb-1'>

                          {ticket.service?.name || 'Serviço não informado'}

                        </p>

                        <p className='text-xs text-muted-foreground'>

                          {formatDate(

                            ticket.completedAt ||

                              ticket.stoppedAt ||

                              ticket.scheduledDate

                          )}

                        </p>

                      </div>

                      <Badge

                        variant={isPaid ? 'default' : 'secondary'}

                        className={`flex-shrink-0 ${

                          isPaid

                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'

                            : 'bg-orange-500 hover:bg-orange-600 text-white'

                        }`}

                      >

                        {isPaid ? (

                          <>

                            <CheckCircle2 className='h-3 w-3 mr-1' />

                            Pago

                          </>

                        ) : (

                          <>

                            <Clock3 className='h-3 w-3 mr-1' />

                            Pendente

                          </>

                        )}

                      </Badge>

                    </div>



                    <div className='space-y-2 text-sm mb-3'>

                      <div>

                        <p className='text-xs text-muted-foreground mb-1'>

                          Valor Total

                        </p>

                        <p className='font-semibold text-lg text-primary'>

                          {formatCurrency(total)}

                        </p>

                      </div>

                      <div className='grid grid-cols-3 gap-2 text-xs'>

                        <div>

                          <p className='text-muted-foreground'>Base</p>

                          <p className='font-semibold'>

                            {formatCurrency(base)}

                          </p>

                        </div>

                        <div>

                          <p className='text-muted-foreground'>KM</p>

                          <p className='font-semibold'>{formatCurrency(km)}</p>

                        </div>

                        <div>

                          <p className='text-muted-foreground'>Extras</p>

                          <p className='font-semibold'>

                            {formatCurrency(extras)}

                          </p>

                        </div>

                      </div>

                      {ticket.startedAt && ticket.stoppedAt && (

                        <div>

                          <p className='text-xs text-muted-foreground mb-1'>

                            Duração

                          </p>

                          <p className='font-semibold'>

                            {(

                              (new Date(ticket.stoppedAt).getTime() -

                                new Date(ticket.startedAt).getTime()) /

                              (1000 * 60 * 60)

                            ).toFixed(2)}{' '}

                            horas

                          </p>

                        </div>

                      )}

                    </div>



                    {/* Botão Receber Pagamento - apenas se não estiver pago */}

                    {!isPaid && (

                      <Button

                        size='sm'

                        variant='default'

                        onClick={() => handleReceivePaymentByTicket(ticket.id)}

                        disabled={receivePaymentByTicketMutation.isPending}

                        className='w-full bg-emerald-600 hover:bg-emerald-700 text-white'

                      >

                        <DollarSign className='h-4 w-4 mr-2' />

                        Receber pagamento

                      </Button>

                    )}

                  </CardContent>

                </Card>

              );

            })}

          </div>



          {/* Dialog de confirmação para receber todos os pagamentos */}

          <AlertDialog

            open={showReceiveAllConfirm}

            onOpenChange={setShowReceiveAllConfirm}

          >

            <AlertDialogContent>

              <AlertDialogHeader>

                <AlertDialogTitle>Receber todos os pagamentos</AlertDialogTitle>

                <AlertDialogDescription>

                  Você está prestes a receber todos os pagamentos pendentes do

                  cliente{' '}

                  <strong>

                    {clientToReceiveAll?.name || 'Cliente não identificado'}

                  </strong>

                  . Total a receber:{' '}

                  <strong>

                    {formatCurrency(clientToReceiveAll?.totalAmount || 0)}

                  </strong>

                  . Deseja continuar?

                </AlertDialogDescription>

              </AlertDialogHeader>

              <AlertDialogFooter>

                <AlertDialogCancel

                  disabled={receiveAllPaymentsByClientMutation.isPending}

                >

                  Cancelar

                </AlertDialogCancel>

                <AlertDialogAction

                  onClick={handleReceiveAllPaymentsByClient}

                  disabled={receiveAllPaymentsByClientMutation.isPending}

                  className='bg-emerald-600 hover:bg-emerald-700'

                >

                  {receiveAllPaymentsByClientMutation.isPending

                    ? 'Recebendo...'

                    : 'Confirmar'}

                </AlertDialogAction>

              </AlertDialogFooter>

            </AlertDialogContent>

          </AlertDialog>

        </div>

      );

    }



    // View principal: cards de clientes agrupados

    return (

      <div className='space-y-6'>

        <div className='flex items-center justify-between'>

          <div>

            <h1 className='text-3xl font-semibold mb-2'>

              Chamados Concluídos do Mês

            </h1>

            <p className='text-muted-foreground'>

              Total de {completedTicketsThisMonth.length} chamado(s)

              concluído(s) agrupados por cliente. Clique no card do cliente para

              ver os chamados individuais.

            </p>

          </div>

          <Button

            variant='outline'

            onClick={() => setShowCompletedTickets(false)}

            className='flex items-center gap-2'

          >

            <ArrowLeft className='h-4 w-4' />

            Voltar ao Dashboard

          </Button>

        </div>



        {clientsWithTickets.length > 0 ? (

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>

            {clientsWithTickets.map((clientData) => {

              const hasPendingPayments = clientData.pendingTicketIds.length > 0;



              return (

                <Card

                  key={clientData.client.id}

                  className='border border-emerald-500/20 bg-emerald-500/5 hover:shadow-md cursor-pointer'

                  onClick={() => setSelectedClientId(clientData.client.id)}

                >

                  <CardContent className='p-4'>

                    <div className='flex items-start justify-between mb-3'>

                      <div className='flex-1'>

                        <p className='font-semibold text-lg mb-1'>

                          {clientData.client.name || 'Cliente não identificado'}

                        </p>

                        <p className='text-sm text-muted-foreground'>

                          {clientData.tickets.length} chamado(s) concluído(s)

                        </p>

                      </div>

                      <Users className='h-5 w-5 text-emerald-500 flex-shrink-0' />

                    </div>



                    <div className='space-y-2 text-sm mb-3'>

                      <div className='flex items-center justify-between'>

                        <span className='text-muted-foreground'>

                          Total pendente:

                        </span>

                        <span className='font-semibold text-orange-600 dark:text-orange-400'>

                          {formatCurrency(clientData.totalPending)}

                        </span>

                      </div>

                      <div className='flex items-center justify-between'>

                        <span className='text-muted-foreground'>

                          Total recebido:

                        </span>

                        <span className='font-semibold text-emerald-600 dark:text-emerald-400'>

                          {formatCurrency(clientData.totalPaid)}

                        </span>

                      </div>

                      <div className='flex items-center justify-between pt-2 border-t'>

                        <span className='text-muted-foreground font-medium'>

                          Total geral:

                        </span>

                        <span className='font-bold text-lg text-primary'>

                          {formatCurrency(

                            clientData.totalPending + clientData.totalPaid

                          )}

                        </span>

                      </div>

                    </div>



                    <div className='flex gap-2'>

                      <Button

                        size='sm'

                        variant='outline'

                        onClick={(e) => {

                          e.stopPropagation();

                          setSelectedClientId(clientData.client.id);

                        }}

                        className='flex-1'

                      >

                        Ver chamados

                      </Button>

                      {hasPendingPayments && (

                        <Button

                          size='sm'

                          variant='default'

                          onClick={(e) => {

                            e.stopPropagation();

                            setClientToReceiveAll({

                              id: clientData.client.id,

                              name: clientData.client.name,

                              totalAmount: clientData.totalPending,

                              ticketIds: clientData.pendingTicketIds,

                            });

                            setShowReceiveAllConfirm(true);

                          }}

                          disabled={

                            receiveAllPaymentsByClientMutation.isPending

                          }

                          className='bg-emerald-600 hover:bg-emerald-700 text-white'

                        >

                          <DollarSign className='h-4 w-4 mr-1' />

                          Receber todos

                        </Button>

                      )}

                    </div>

                  </CardContent>

                </Card>

              );

            })}

          </div>

        ) : (

          <Card className='border border-slate-300/50 dark:border-slate-800 bg-white dark:bg-card shadow-md'>

            <CardContent className='p-8 text-center'>

              <CheckCircle2 className='h-12 w-12 mx-auto text-muted-foreground mb-4' />

              <p className='text-lg font-semibold mb-2'>

                Nenhum chamado concluído no mês

              </p>

              <p className='text-sm text-muted-foreground'>

                Complete chamados este mês para ver a lista

              </p>

            </CardContent>

          </Card>

        )}



        {/* Dialog de confirmação para receber todos os pagamentos */}

        <AlertDialog

          open={showReceiveAllConfirm}

          onOpenChange={setShowReceiveAllConfirm}

        >

          <AlertDialogContent>

            <AlertDialogHeader>

              <AlertDialogTitle>Receber todos os pagamentos</AlertDialogTitle>

              <AlertDialogDescription>

                Você está prestes a receber todos os pagamentos pendentes do

                cliente{' '}

                <strong>

                  {clientToReceiveAll?.name || 'Cliente não identificado'}

                </strong>

                . Total a receber:{' '}

                <strong>

                  {formatCurrency(clientToReceiveAll?.totalAmount || 0)}

                </strong>

                . Deseja continuar?

              </AlertDialogDescription>

            </AlertDialogHeader>

            <AlertDialogFooter>

              <AlertDialogCancel

                disabled={receiveAllPaymentsByClientMutation.isPending}

              >

                Cancelar

              </AlertDialogCancel>

              <AlertDialogAction

                onClick={handleReceiveAllPaymentsByClient}

                disabled={receiveAllPaymentsByClientMutation.isPending}

                className='bg-emerald-600 hover:bg-emerald-700'

              >

                {receiveAllPaymentsByClientMutation.isPending

                  ? 'Recebendo...'

                  : 'Confirmar'}

              </AlertDialogAction>

            </AlertDialogFooter>

          </AlertDialogContent>

        </AlertDialog>

      </div>

    );

  }



  // Se estiver mostrando apenas os pagamentos pendentes, renderizar apenas eles

  if (showPendingPayments) {

    const { clientsWithPendingPayments, overdueCount, overdueAmount } =

      pendingPaymentsThisMonthData || {

        clientsWithPendingPayments: [],

        overdueCount: 0,

        overdueAmount: 0,

      };



    // Se um cliente específico foi selecionado, mostrar seus pagamentos pendentes

    if (selectedPendingClientId) {

      const clientData = clientsWithPendingPayments.find(

        (c) => c.client.id === selectedPendingClientId

      );



      if (!clientData) {

        return (

          <div className='space-y-6'>

            <div className='flex items-center justify-between'>

              <div>

                <h1 className='text-3xl font-semibold mb-2'>

                  Pagamentos do Cliente

                </h1>

              </div>

              <Button

                variant='outline'

                onClick={() => setSelectedPendingClientId(null)}

                className='flex items-center gap-2'

              >

                <ArrowLeft className='h-4 w-4' />

                Voltar

              </Button>

            </div>

            <Card>

              <CardContent className='p-8 text-center'>

                <XCircle className='h-12 w-12 mx-auto text-muted-foreground mb-4' />

                <p className='text-lg font-semibold mb-2'>

                  Cliente não encontrado

                </p>

              </CardContent>

            </Card>

          </div>

        );

      }



      return (

        <div className='space-y-6'>

          <div className='flex items-center justify-between'>

            <div>

              <h1 className='text-3xl font-semibold mb-2'>

                Pagamentos Pendentes de {clientData.client.name}

              </h1>

              <p className='text-muted-foreground'>

                {clientData.payments.length} pagamento(s) pendente(s) este mês

              </p>

            </div>

            <Button

              variant='outline'

              onClick={() => setSelectedPendingClientId(null)}

              className='flex items-center gap-2'

            >

              <ArrowLeft className='h-4 w-4' />

              Voltar

            </Button>

          </div>



          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>

            {clientData.payments

              .filter((payment: any) => {

                //   // CORREÇÃO: Filtrar apenas pagamentos realmente pendentes

                const status = String(payment.status || 'pending')

                  .toLowerCase()

                  .trim();

                const isPending = status === 'pending';

                if (!isPending) {

                  dashboardLog(

                    `[Pending Payments] ❌ Pagamento ${payment.id} filtrado: status="${status}" não é 'pending'`

                  );

                }

                return isPending;

              })

              .map((payment: any) => {

                const isOverdue = payment.isOverdue || false;

                const ticket = payment.ticket;

                const total = ticket

                  ? ticketFinancials(ticket).total

                  : normalizeAmount(payment.amount);



                //   // CORREÇÃO: Verificar status novamente para garantir

                const paymentStatus = String(payment.status || 'pending')

                  .toLowerCase()

                  .trim();

                const isPaid = paymentStatus === 'paid';



                // Se já foi recebido, não mostrar

                if (isPaid) {

                  return null;

                }



                return (

                  <Card

                    key={payment.id}

                    className={`${

                      isOverdue

                        ? 'border-red-500/50 bg-red-500/10 animate-pulse-slow'

                        : 'border-orange-500/20 bg-orange-500/5'

                    } hover:shadow-md`}

                    style={

                      isOverdue

                        ? {

                            animation:

                              'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',

                          }

                        : {}

                    }

                  >

                    <CardContent className='p-4'>

                      <div className='flex items-start justify-between mb-3'>

                        <div className='flex-1'>

                          <p className='font-semibold text-lg mb-1'>

                            {payment.ticket?.service?.name ||

                              'Serviço não informado'}

                          </p>

                          <p className='text-xs text-muted-foreground'>

                            {formatDate(

                              payment.ticket?.completedAt ||

                                payment.ticket?.stoppedAt ||

                                payment.ticket?.scheduledDate

                            )}

                          </p>

                        </div>

                        {isOverdue && (

                          <Badge

                            variant='destructive'

                            className='flex-shrink-0 animate-pulse-slow'

                          >

                            <AlertTriangle className='h-3 w-3 mr-1' />

                            Vencido

                          </Badge>

                        )}

                      </div>



                      <div className='space-y-2 text-sm mb-3'>

                        <div>

                          <p className='text-xs text-muted-foreground mb-1'>

                            Valor Total

                          </p>

                          <p

                            className={`font-semibold text-lg ${

                              isOverdue

                                ? 'text-red-600 dark:text-red-400'

                                : 'text-primary'

                            }`}

                          >

                            {formatCurrency(total)}

                          </p>

                        </div>

                        <div>

                          <p className='text-xs text-muted-foreground mb-1'>

                            Vencimento

                          </p>

                          <p

                            className={`font-semibold ${

                              isOverdue

                                ? 'text-red-600 dark:text-red-400'

                                : 'text-foreground'

                            }`}

                          >

                            {formatDate(payment.dueDate)}

                          </p>

                        </div>

                      </div>



                      <div className='space-y-2'>

                        <Button

                          size='sm'

                          variant='default'

                          onClick={() =>

                            handleReceivePaymentByTicket(payment.ticketId)

                          }

                          disabled={receivePaymentByTicketMutation.isPending}

                          className={`w-full ${

                            isOverdue

                              ? 'bg-red-600 hover:bg-red-700 text-white'

                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'

                          }`}

                        >

                          <DollarSign className='h-4 w-4 mr-2' />

                          Receber pagamento

                        </Button>

                        <div className='flex gap-2'>

                          <Button

                            size='sm'

                            variant='outline'

                            onClick={() =>

                              handleSendWhatsAppSingle(

                                payment,

                                clientData.client

                              )

                            }

                            className='flex-1'

                            disabled={!clientData.client.phone}

                          >

                            <MessageCircle className='h-3 w-3 mr-1' />

                            WhatsApp

                          </Button>

                          <Button

                            size='sm'

                            variant='outline'

                            onClick={() =>

                              handleSendEmailSingle(payment, clientData.client)

                            }

                            className='flex-1'

                            disabled={!clientData.client.email}

                          >

                            <Mail className='h-3 w-3 mr-1' />

                            Email

                          </Button>

                          <Button

                            size='sm'

                            variant='outline'

                            onClick={() =>

                              handleExportPDFSingle(payment, clientData.client)

                            }

                            className='flex-1'

                          >

                            <FileText className='h-3 w-3 mr-1' />

                            PDF

                          </Button>

                          <Button

                            size='sm'

                            variant='outline'

                            onClick={() =>

                              handleExportExcel({

                                client: clientData.client,

                                payments: [payment],

                              })

                            }

                            className='flex-1'

                          >

                            <FileSpreadsheet className='h-3 w-3 mr-1' />

                            Excel

                          </Button>

                        </div>

                        <Button

                          size='sm'

                          variant='destructive'

                          onClick={() =>

                            handleDeleteFinancialRecord(payment.id)

                          }

                          disabled={deleteFinancialRecordMutation.isPending}

                          className='w-full mt-2'

                        >

                          <Trash2 className='h-4 w-4 mr-2' />

                          {deleteFinancialRecordMutation.isPending

                            ? 'Excluindo...'

                            : 'Excluir'}

                        </Button>

                      </div>

                    </CardContent>

                  </Card>

                );

              })

              .filter((card: any) => card !== null)}

          </div>



          {/* Dialog de confirmação para receber todos os pagamentos */}

          <AlertDialog

            open={showReceiveAllPendingConfirm}

            onOpenChange={setShowReceiveAllPendingConfirm}

          >

            <AlertDialogContent>

              <AlertDialogHeader>

                <AlertDialogTitle>Receber todos os pagamentos</AlertDialogTitle>

                <AlertDialogDescription>

                  Você está prestes a receber todos os pagamentos pendentes do

                  cliente{' '}

                  <strong>

                    {clientToReceiveAllPending?.name ||

                      'Cliente não identificado'}

                  </strong>

                  . Total a receber:{' '}

                  <strong>

                    {formatCurrency(

                      clientToReceiveAllPending?.totalAmount || 0

                    )}

                  </strong>

                  . Deseja continuar?

                </AlertDialogDescription>

              </AlertDialogHeader>

              <AlertDialogFooter>

                <AlertDialogCancel

                  disabled={receiveAllPaymentsByClientMutation.isPending}

                >

                  Cancelar

                </AlertDialogCancel>

                <AlertDialogAction

                  onClick={handleReceiveAllPendingPaymentsByClient}

                  disabled={receiveAllPaymentsByClientMutation.isPending}

                  className='bg-emerald-600 hover:bg-emerald-700'

                >

                  {receiveAllPaymentsByClientMutation.isPending

                    ? 'Recebendo...'

                    : 'Confirmar'}

                </AlertDialogAction>

              </AlertDialogFooter>

            </AlertDialogContent>

          </AlertDialog>



          {/* Modal para receber pagamento com data */}

          <Dialog open={showReceivePaymentModal} onOpenChange={setShowReceivePaymentModal}>

            <DialogContent>

              <DialogHeader>

                <DialogTitle>Receber Pagamento</DialogTitle>

                <DialogDescription className='sr-only'>

                  Informe a data de recebimento do pagamento.

                </DialogDescription>

              </DialogHeader>

              <div className='space-y-4'>

                <div className='space-y-2'>

                  <label htmlFor='paymentReceivedDate' className='text-sm font-medium'>

                    Data de Recebimento

                  </label>

                  <Input

                    id='paymentReceivedDate'

                    type='date'

                    value={paymentReceivedDate}

                    onChange={(e) => {

                      setPaymentReceivedDate(e.target.value);

                      setIsPaymentDateAutoFilled(false);

                    }}

                    required

                  />

                  {isPaymentDateAutoFilled && (

                    <p className='text-xs text-muted-foreground'>

                      (Preenchida automaticamente com a data atual - pode alterar)

                    </p>

                  )}

                </div>

              </div>

              <div className='flex justify-end gap-2 mt-4'>

                <Button

                  variant='outline'

                  onClick={() => {

                    setShowReceivePaymentModal(false);

                    setPaymentToReceive(null);

                    setPaymentReceivedDate('');

                    setIsPaymentDateAutoFilled(false);

                  }}

                >

                  Cancelar

                </Button>

                <Button

                  onClick={handleConfirmReceivePayment}

                  disabled={

                    !paymentReceivedDate ||

                    receivePaymentMutation.isPending ||

                    receivePaymentByTicketMutation.isPending

                  }

                  className='bg-emerald-600 hover:bg-emerald-700'

                >

                  {receivePaymentMutation.isPending || receivePaymentByTicketMutation.isPending

                    ? 'Recebendo...'

                    : 'Confirmar Recebimento'}

                </Button>

              </div>

            </DialogContent>

          </Dialog>

        </div>

      );

    }



    // View principal: cards de clientes agrupados

    return (

      <div className='space-y-6'>

        <div className='flex items-center justify-between'>

          <div>

            <h1 className='text-3xl font-semibold mb-2'>

              Pagamentos Pendentes (Mês)

            </h1>

            <p className='text-muted-foreground'>

              Total de {pendingPaymentsThisMonth.length} pagamento(s)

              pendente(s) agrupados por cliente. Clique no card do cliente para

              ver os pagamentos individuais.

            </p>

          </div>

          <Button

            variant='outline'

            onClick={() => setShowPendingPayments(false)}

            className='flex items-center gap-2'

          >

            <ArrowLeft className='h-4 w-4' />

            Voltar ao Dashboard

          </Button>

        </div>



        {clientsWithPendingPayments.length > 0 ? (

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>

            {clientsWithPendingPayments.map((clientData) => {

              const hasOverduePayments = clientData.payments.some(

                (p: any) => p.isOverdue

              );



              return (

                <Card

                  key={clientData.client.id}

                  className={`${

                    hasOverduePayments

                      ? 'border-red-500/50 bg-red-500/10 animate-pulse-slow'

                      : 'border-orange-500/20 bg-orange-500/5'

                  } hover:shadow-md cursor-pointer`}

                  style={

                    hasOverduePayments

                      ? {

                          animation:

                            'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',

                        }

                      : {}

                  }

                  onClick={() =>

                    setSelectedPendingClientId(clientData.client.id)

                  }

                >

                  <CardContent className='p-4 overflow-hidden'>

                    <div className='flex items-start justify-between mb-3'>

                      <div className='flex-1 min-w-0'>

                        <p className='font-semibold text-lg mb-1 truncate'>

                          {clientData.client.name || 'Cliente não identificado'}

                        </p>

                        <p className='text-sm text-muted-foreground'>

                          {clientData.payments.length} pagamento(s) pendente(s)

                        </p>

                      </div>

                      {hasOverduePayments ? (

                        <AlertTriangle className='h-5 w-5 text-red-500 flex-shrink-0 animate-pulse-slow ml-2' />

                      ) : (

                        <Clock3 className='h-5 w-5 text-orange-500 flex-shrink-0 ml-2' />

                      )}

                    </div>



                    <div className='space-y-2 text-sm mb-3'>

                      <div className='flex items-center justify-between'>

                        <span className='text-muted-foreground'>

                          Total pendente:

                        </span>

                        <span

                          className={`font-semibold ${

                            hasOverduePayments

                              ? 'text-red-600 dark:text-red-400'

                              : 'text-orange-600 dark:text-orange-400'

                          }`}

                        >

                          {formatCurrency(clientData.totalAmount)}

                        </span>

                      </div>

                    </div>



                    <div className='space-y-2'>

                      <div className='flex gap-2'>

                        <Button

                          size='sm'

                          variant='outline'

                          onClick={(e) => {

                            e.stopPropagation();

                            setSelectedPendingClientId(clientData.client.id);

                          }}

                          className='flex-1 min-w-0'

                        >

                          <span className='truncate'>Ver pagamentos</span>

                        </Button>

                        <Button

                          size='sm'

                          variant='default'

                          onClick={(e) => {

                            e.stopPropagation();

                            setClientToReceiveAllPending({

                              id: clientData.client.id,

                              name: clientData.client.name,

                              totalAmount: clientData.totalAmount,

                              ticketIds: clientData.ticketIds,

                            });

                            setShowReceiveAllPendingConfirm(true);

                          }}

                          disabled={

                            receiveAllPaymentsByClientMutation.isPending

                          }

                          className='bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0'

                        >

                          <DollarSign className='h-4 w-4 mr-1' />

                          <span className='truncate'>Receber todos</span>

                        </Button>

                      </div>

                      <div className='flex gap-2 overflow-hidden'>

                        <Button

                          size='sm'

                          variant='outline'

                          onClick={(e) => {

                            e.stopPropagation();

                            handleSendWhatsApp(clientData);

                          }}

                          className='flex-1 min-w-0'

                          disabled={!clientData.client.phone}

                        >

                          <MessageCircle className='h-4 w-4 mr-1 flex-shrink-0' />

                          <span className='truncate'>WhatsApp</span>

                        </Button>

                        <Button

                          size='sm'

                          variant='outline'

                          onClick={(e) => {

                            e.stopPropagation();

                            handleSendEmail(clientData);

                          }}

                          className='flex-1 min-w-0'

                          disabled={!clientData.client.email}

                        >

                          <Mail className='h-4 w-4 mr-1 flex-shrink-0' />

                          <span className='truncate'>Email</span>

                        </Button>

                        <Button

                          size='sm'

                          variant='outline'

                          onClick={(e) => {

                            e.stopPropagation();

                            handleExportPDF(clientData);

                          }}

                          className='flex-1 min-w-0'

                        >

                          <FileText className='h-4 w-4 mr-1 flex-shrink-0' />

                          <span className='truncate'>PDF</span>

                        </Button>

                        <Button

                          size='sm'

                          variant='outline'

                          onClick={(e) => {

                            e.stopPropagation();

                            handleExportExcel(clientData);

                          }}

                          className='flex-1 min-w-0'

                        >

                          <FileSpreadsheet className='h-4 w-4 mr-1 flex-shrink-0' />

                          <span className='truncate'>Excel</span>

                        </Button>

                      </div>

                    </div>

                  </CardContent>

                </Card>

              );

            })}

          </div>

        ) : (

          <Card className='border border-slate-300/50 dark:border-slate-800 bg-white dark:bg-card shadow-md'>

            <CardContent className='p-8 text-center'>

              <CheckCircle2 className='h-12 w-12 mx-auto text-muted-foreground mb-4' />

              <p className='text-lg font-semibold mb-2'>

                Nenhum pagamento pendente no mês

              </p>

              <p className='text-sm text-muted-foreground'>

                // Todos os pagamentos foram recebidos este mês

              </p>

            </CardContent>

          </Card>

        )}



        {/* Dialog de confirmação para receber todos os pagamentos */}

        <AlertDialog

          open={showReceiveAllPendingConfirm}

          onOpenChange={setShowReceiveAllPendingConfirm}

        >

          <AlertDialogContent>

            <AlertDialogHeader>

              <AlertDialogTitle>Receber todos os pagamentos</AlertDialogTitle>

              <AlertDialogDescription>

                Você está prestes a receber todos os pagamentos pendentes do

                cliente{' '}

                <strong>

                  {clientToReceiveAllPending?.name ||

                    'Cliente não identificado'}

                </strong>

                . Total a receber:{' '}

                <strong>

                  {formatCurrency(clientToReceiveAllPending?.totalAmount || 0)}

                </strong>

                . Deseja continuar?

              </AlertDialogDescription>

            </AlertDialogHeader>

            <AlertDialogFooter>

              <AlertDialogCancel

                disabled={receiveAllPaymentsByClientMutation.isPending}

              >

                Cancelar

              </AlertDialogCancel>

              <AlertDialogAction

                onClick={handleReceiveAllPendingPaymentsByClient}

                disabled={receiveAllPaymentsByClientMutation.isPending}

                className='bg-emerald-600 hover:bg-emerald-700'

              >

                {receiveAllPaymentsByClientMutation.isPending

                  ? 'Recebendo...'

                  : 'Confirmar'}

              </AlertDialogAction>

            </AlertDialogFooter>

          </AlertDialogContent>

        </AlertDialog>

      </div>

    );

  }



  // Se estiver mostrando apenas o ranking de chamados por lucratividade, renderizar apenas ele

  if (showTicketsRanking) {

    return (

      <div className='space-y-8 p-4 sm:p-6 bg-slate-50 dark:bg-[#0b1120] min-h-screen'>

        <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>

          <div className='space-y-1'>

            <h1 className='text-3xl font-black tracking-tight text-slate-900 dark:text-white'>

              Ranking de Lucratividade

            </h1>

            <p className='text-slate-500 dark:text-slate-400 text-sm font-medium'>

              Chamados concluídos e pagos, ordenados pelo valor gerado por hora.

            </p>

          </div>

          <Button

            variant='outline'

            onClick={() => setShowTicketsRanking(false)}

            className='h-11 px-6 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-xs gap-2 shadow-sm hover:bg-slate-50 transition-all'

          >

            <ArrowLeft className='h-4 w-4' />

            Voltar ao Dashboard

          </Button>

        </div>



        {ticketsByProfitability.length > 0 ? (

          <div className='grid grid-cols-1 gap-4'>

            {ticketsByProfitability.map((ticket: any, index: number) => {

              const {

                Icon: TrophyIcon,

                iconColor,

                bgColor,

                borderColor,

                badge,

              } = getRankingIconAndColors(index);

              const clientTypeLabel = clientTypeLabels[ticket.clientType] || ticket.clientType;



              return (

                <div

                  key={ticket.id}

                  initial={{ opacity: 0, x: -20 }}

                  animate={{ opacity: 1, x: 0 }}

                  transition={{ duration: 0.3, delay: index * 0.05 }}

                  className={cn(

                    'group relative overflow-hidden rounded-2xl p-6 bg-white dark:bg-slate-900 border-2 transition-all duration-300 shadow-sm hover:shadow-xl',

                    borderColor,

                    index === 0 ? 'scale-[1.02] z-10' : ''

                  )}

                >

                  <div className='flex flex-col md:flex-row items-start md:items-center gap-6'>

                    <div className={cn('p-4 rounded-2xl flex-shrink-0 group-hover:scale-110 transition-transform', bgColor)}>

                      <TrophyIcon className={cn('h-8 w-8', iconColor)} />

                    </div>

                    

                    <div className='flex-1 min-w-0'>

                      <div className='flex flex-wrap items-center gap-2 mb-2'>

                        <span className='text-xl font-black text-slate-900 dark:text-white'>

                          {index + 1}º Lugar

                        </span>

                        {badge && (

                          <Badge className='bg-primary/10 text-primary border-none text-[10px] font-black px-2 py-0.5 rounded-full'>

                            {badge}

                          </Badge>

                        )}

                        <Badge variant='outline' className='text-[10px] font-bold text-slate-400 border-slate-200 dark:border-slate-800'>

                          {clientTypeLabel}

                        </Badge>

                      </div>

                      <h3 className='text-lg font-bold text-slate-700 dark:text-slate-200 truncate'>

                        {ticket.clientName}

                      </h3>

                    </div>



                    <div className='grid grid-cols-2 sm:grid-cols-3 gap-8 w-full md:w-auto md:border-l border-slate-200 dark:border-slate-800 md:pl-8'>

                      <div>

                        <p className='text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1'>Valor Faturado</p>

                        <p className='text-lg font-black text-slate-900 dark:text-white'>{formatCurrency(ticket.totalAmount)}</p>

                      </div>

                      <div>

                        <p className='text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1'>Tempo Total</p>

                        <p className='text-lg font-black text-slate-900 dark:text-white'>{ticket.hours.toFixed(2)}h</p>

                      </div>

                      <div className='col-span-2 sm:col-span-1'>

                        <p className='text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1'>R$ Por Hora</p>

                        <p className='text-2xl font-black text-emerald-500 leading-none'>{formatCurrency(ticket.revenuePerHour)}</p>

                      </div>

                    </div>

                  </div>

                  <div className='absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-150 transition-transform duration-700' />

                </div>

              );

            })}

          </div>

        ) : (

          <div className='flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-300/50 dark:border-slate-800 shadow-sm'>

            <div className='p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-6'>

              <CheckCircle2 className='h-12 w-12 text-slate-300 dark:text-slate-600' />

            </div>

            <p className='text-xl font-bold text-slate-900 dark:text-white mb-2'>Nenhum chamado concluído</p>

            <p className='text-slate-500 dark:text-slate-400 text-sm'>Complete chamados este mês para gerar o ranking.</p>

          </div>

        )}

      </div>

    );

  }



  // Se estiver mostrando apenas o ranking de faturamento, renderizar apenas ele

  if (showBillingRanking) {

    return (

      <div className='space-y-8 p-4 sm:p-6 bg-slate-50 dark:bg-[#0b1120] min-h-screen'>

        <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>

          <div className='space-y-1'>

            <h1 className='text-3xl font-black tracking-tight text-slate-900 dark:text-white'>

              Faturamento por Mês

            </h1>

            <p className='text-slate-500 dark:text-slate-400 text-sm font-medium'>

              Evolução do faturamento bruto nos últimos 12 meses.

            </p>

          </div>

          <Button

            variant='outline'

            onClick={() => setShowBillingRanking(false)}

            className='h-11 px-6 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-xs gap-2 shadow-sm hover:bg-slate-50 transition-all'

          >

            <ArrowLeft className='h-4 w-4' />

            Voltar ao Dashboard

          </Button>

        </div>



        {monthlyBilling.ranking.length > 0 ? (

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>

            {monthlyBilling.ranking.map((item, index) => {

              const {

                Icon: TrophyIcon,

                iconColor,

                bgColor,

                borderColor,

              } = getRankingIconAndColors(index);

              const totalRevenue = monthlyBilling.months.reduce((sum, m) => sum + m.revenue, 0);

              const percentage = totalRevenue > 0 ? ((item.revenue / totalRevenue) * 100).toFixed(0) : '0';



              return (

                <div

                  key={`${item.year}-${item.month}`}

                  initial={{ opacity: 0, y: 20 }}

                  animate={{ opacity: 1, y: 0 }}

                  transition={{ duration: 0.3, delay: index * 0.05 }}

                  className={cn(

                    'group relative overflow-hidden rounded-3xl p-8 bg-white dark:bg-slate-900 border-2 transition-all duration-300 shadow-sm hover:shadow-xl',

                    borderColor

                  )}

                >

                  <div className='flex items-center justify-between mb-8'>

                    <div className={cn('p-4 rounded-2xl group-hover:scale-110 transition-transform', bgColor)}>

                      <TrophyIcon className={cn('h-8 w-8', iconColor)} />

                    </div>

                    <div className='text-right'>

                      <p className='text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1'>Posição</p>

                      <span className='text-2xl font-black text-slate-900 dark:text-white'>{index + 1}º</span>

                    </div>

                  </div>

                  

                  <div className='space-y-1 mb-6'>

                    <p className='text-sm font-bold text-primary uppercase tracking-widest'>{item.monthName}</p>

                    <p className='text-4xl font-black text-slate-900 dark:text-white tracking-tight'>

                      {formatCurrency(item.revenue)}

                    </p>

                  </div>



                  <div className='pt-6 border-t border-slate-200 dark:border-slate-800'>

                    <div className='flex items-center justify-between text-xs mb-2'>

                      <span className='font-bold text-slate-500'>Share do Ano</span>

                      <span className='font-black text-slate-900 dark:text-white'>{percentage}%</span>

                    </div>

                    <div className='h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden'>

                      <div 

                        initial={{ width: 0 }}

                        animate={{ width: `${percentage}%` }}

                        transition={{ duration: 1, ease: "easeOut" }}

                        className='h-full bg-primary rounded-full'

                      />

                    </div>

                  </div>

                  <div className='absolute bottom-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mb-8 opacity-50 group-hover:scale-150 transition-transform duration-700' />

                </div>

              );

            })}

          </div>

        ) : (

          <div className='flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-300/50 dark:border-slate-800 shadow-sm'>

            <div className='p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-6'>

              <DollarSign className='h-12 w-12 text-slate-300 dark:text-slate-600' />

            </div>

            <p className='text-xl font-bold text-slate-900 dark:text-white mb-2'>Sem registros financeiros</p>

            <p className='text-slate-500 dark:text-slate-400 text-sm'>Complete chamados para ver o histórico mensal.</p>

          </div>

        )}

      </div>

    );

  }



  // Se estiver mostrando apenas o ranking de clientes, renderizar apenas ele

  if (showClientsRanking) {

    return (

      <div className='space-y-8 p-4 sm:p-6 bg-slate-50 dark:bg-[#0b1120] min-h-screen'>

        <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>

          <div className='space-y-1'>

            <h1 className='text-3xl font-black tracking-tight text-slate-900 dark:text-white'>

              Mix de Clientes

            </h1>

            <p className='text-slate-500 dark:text-slate-400 text-sm font-medium'>

              Distribuição da sua base de clientes por categoria.

            </p>

          </div>

          <Button

            variant='outline'

            onClick={() => setShowClientsRanking(false)}

            className='h-11 px-6 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-xs gap-2 shadow-sm hover:bg-slate-50 transition-all'

          >

            <ArrowLeft className='h-4 w-4' />

            Voltar ao Dashboard

          </Button>

        </div>



        {clientsByType.ranking.length > 0 ? (

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>

            {clientsByType.ranking.map((item, index) => {

              const trophyColors = [

                { bg: 'bg-yellow-500/10', icon: 'text-yellow-500', border: 'border-yellow-500/20' },

                { bg: 'bg-slate-400/10', icon: 'text-slate-400', border: 'border-slate-400/20' },

                { bg: 'bg-orange-600/10', icon: 'text-orange-600', border: 'border-orange-600/20' },

              ];

              const colors = trophyColors[index] || trophyColors[2];

              const ClientIcon = clientTypeIcons[item.type] || User;

              const totalClients = allClients.length;

              const percentage = totalClients > 0 ? ((item.count / totalClients) * 100).toFixed(0) : '0';



              return (

                <div

                  key={item.type}

                  initial={{ opacity: 0, scale: 0.95 }}

                  animate={{ opacity: 1, scale: 1 }}

                  transition={{ duration: 0.3, delay: index * 0.05 }}

                  className={cn(

                    'group relative overflow-hidden rounded-3xl p-8 bg-white dark:bg-slate-900 border-2 transition-all duration-300 shadow-sm hover:shadow-xl',

                    colors.border

                  )}

                >

                  <div className='flex items-center justify-between mb-8'>

                    <div className={cn('p-4 rounded-2xl group-hover:scale-110 transition-transform', colors.bg)}>

                      <ClientIcon className={cn('h-8 w-8', colors.icon)} />

                    </div>

                    <div className='text-right'>

                      <p className='text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1'>Ranking</p>

                      <span className='text-2xl font-black text-slate-900 dark:text-white'>{index + 1}º</span>

                    </div>

                  </div>

                  

                  <div className='space-y-1 mb-6'>

                    <p className='text-sm font-bold text-primary uppercase tracking-widest'>{clientTypeLabels[item.type] || item.type}</p>

                    <p className='text-5xl font-black text-slate-900 dark:text-white tracking-tight'>

                      {item.count}

                    </p>

                  </div>



                  <div className='pt-6 border-t border-slate-200 dark:border-slate-800'>

                    <div className='flex items-center justify-between text-xs mb-2'>

                      <span className='font-bold text-slate-500'>Representatividade</span>

                      <span className='font-black text-slate-900 dark:text-white'>{percentage}%</span>

                    </div>

                    <div className='h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden'>

                      <div 

                        initial={{ width: 0 }}

                        animate={{ width: `${percentage}%` }}

                        transition={{ duration: 1, ease: "easeOut" }}

                        className='h-full bg-primary rounded-full'

                      />

                    </div>

                  </div>

                  <div className='absolute bottom-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mb-8 opacity-50 group-hover:scale-150 transition-transform duration-700' />

                </div>

              );

            })}

          </div>

        ) : (

          <div className='flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-300/50 dark:border-slate-800 shadow-sm'>

            <div className='p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-6'>

              <Users className='h-12 w-12 text-slate-300 dark:text-slate-600' />

            </div>

            <p className='text-xl font-bold text-slate-900 dark:text-white mb-2'>Nenhum cliente cadastrado</p>

            <p className='text-slate-500 dark:text-slate-400 text-sm'>Cadastre clientes para ver o detalhamento.</p>

          </div>

        )}

      </div>

    );

  }



  // Se estiver mostrando apenas o ranking, renderizar apenas ele

  if (showRevenueRanking) {

    return (

      <div className='space-y-8 p-4 sm:p-6 bg-slate-50 dark:bg-[#0b1120] min-h-screen'>

        <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>

          <div className='space-y-1'>

            <h1 className='text-3xl font-black tracking-tight text-slate-900 dark:text-white'>

              Rentabilidade por Tipo

            </h1>

            <p className='text-slate-500 dark:text-slate-400 text-sm font-medium'>

              Quais categorias de clientes geram maior retorno por hora?

            </p>

          </div>

          <Button

            variant='outline'

            onClick={() => setShowRevenueRanking(false)}

            className='h-11 px-6 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-xs gap-2 shadow-sm hover:bg-slate-50 transition-all'

          >

            <ArrowLeft className='h-4 w-4' />

            Voltar ao Dashboard

          </Button>

        </div>



        {revenuePerHourByClientType.length > 0 ? (

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>

            {revenuePerHourByClientType.map((item, index) => {

              const {

                Icon: TrophyIcon,

                iconColor,

                bgColor,

                borderColor,

              } = getRankingIconAndColors(index);

              const ClientIcon = clientTypeIcons[item.type] || User;



              return (

                <div

                  key={item.type}

                  initial={{ opacity: 0, x: 20 }}

                  animate={{ opacity: 1, x: 0 }}

                  transition={{ duration: 0.3, delay: index * 0.05 }}

                  className={cn(

                    'group relative overflow-hidden rounded-3xl p-8 bg-white dark:bg-slate-900 border-2 transition-all duration-300 shadow-sm hover:shadow-xl',

                    borderColor

                  )}

                >

                  <div className='flex items-center justify-between mb-8'>

                    <div className={cn('p-4 rounded-2xl group-hover:scale-110 transition-transform', bgColor)}>

                      <TrophyIcon className={cn('h-8 w-8', iconColor)} />

                    </div>

                    <ClientIcon className={cn('h-6 w-6', iconColor, 'opacity-40')} />

                  </div>

                  

                  <div className='space-y-1 mb-8'>

                    <p className='text-sm font-bold text-primary uppercase tracking-widest'>{clientTypeLabels[item.type] || item.type}</p>

                    <p className='text-4xl font-black text-slate-900 dark:text-white tracking-tight'>

                      {formatCurrency(item.avg)}<span className='text-sm text-slate-400 font-bold'>/h</span>

                    </p>

                  </div>



                  <div className='grid grid-cols-2 gap-4 pt-6 border-t border-slate-200 dark:border-slate-800'>

                    <div>

                      <p className='text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1'>Total Recebido</p>

                      <p className='text-sm font-black text-slate-700 dark:text-slate-200'>{formatCurrency(item.revenue)}</p>

                    </div>

                    <div>

                      <p className='text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1'>Horas Pagas</p>

                      <p className='text-sm font-black text-slate-700 dark:text-slate-200'>{item.hours.toFixed(1)}h</p>

                    </div>

                  </div>

                  <div className='absolute bottom-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mb-8 opacity-50 group-hover:scale-150 transition-transform duration-700' />

                </div>

              );

            })}

          </div>

        ) : (

          <div className='flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-300/50 dark:border-slate-800 shadow-sm'>

            <div className='p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-6'>

              <Trophy className='h-12 w-12 text-slate-300 dark:text-slate-600' />

            </div>

            <p className='text-xl font-bold text-slate-900 dark:text-white mb-2'>Sem dados suficientes</p>

            <p className='text-slate-500 dark:text-slate-400 text-sm'>Receba pagamentos de chamados para ver este ranking.</p>

          </div>

        )}

      </div>

    );

  }



  return (

    <>

      <div className='space-y-8 p-4 sm:p-6 bg-slate-50 dark:bg-[#0b1120] min-h-full'>

      {/* Banner de pagamentos vencidos está fixado no topo via OverduePaymentsBanner no App.tsx */}
      <PageHeader>
        <div className='px-4 sm:px-6'>
          <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-0'>
            <div className='space-y-1'>
              <h1 className='text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white'>
                Dashboard
              </h1>
              <p className='text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium'>
                Bem-vindo de volta! Aqui esta o resumo do seu sistema.
              </p>
            </div>

            <div className='flex items-center gap-3 w-full sm:w-auto'>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className='w-full sm:w-[200px] h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all'>
                  <div className='flex items-center gap-2 text-slate-700 dark:text-slate-300'>
                    <CalendarIcon className='h-4 w-4 text-primary' />
                    <SelectValue>
                      {PERIOD_OPTIONS.find((p) => p.value === selectedPeriod)?.label || 'Ultimos 30 Dias'}
                    </SelectValue>
                  </div>
                </SelectTrigger>
                <SelectContent className='bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl'>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className='text-slate-700 dark:text-slate-300 hover:bg-primary/5 rounded-lg m-1'
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </PageHeader>

      {loadingStats ? (

        <div className='grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4'>

          {[1, 2, 3, 4, 5, 6, 7].map((i) => (

            <Skeleton key={i} className='h-[80px] sm:h-[120px] rounded-xl sm:rounded-2xl' />

          ))}

        </div>

      ) : (

        <div className='space-y-8'>

          {/* Cards de Métricas Principais - Estilo "Bento Grid" Refinado */}

          <div className='grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4'>

            

            {/* Total: Recebido + Lucro KM */}

            <div 

              className='group relative overflow-hidden flex flex-col justify-between rounded-xl sm:rounded-2xl p-3 sm:p-5 bg-emerald-50/80 dark:bg-emerald-500/5 border border-emerald-200/60 dark:border-emerald-500/20 shadow-md hover:shadow-xl transition-all duration-300'

            >

              <MobileBackButton className='absolute left-2 top-2 z-10' stopPropagation />

              <div className='flex items-center justify-between mb-2 sm:mb-4 pl-8 sm:pl-0'>

                <div className='p-2 sm:p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg sm:rounded-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ring-2 sm:ring-4 ring-emerald-50/50 dark:ring-emerald-500/5'>

                  <DollarSign className='h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400 stroke-[2.5px]' />

                </div>

                <Badge variant='outline' className='bg-emerald-50/50 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30 text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1 py-0 sm:px-2.5 sm:py-0.5'>

                  {periodLabel}

                </Badge>

              </div>

              <div>

                <p className='text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0 sm:mb-1 line-clamp-1'>

                  Total Recebido + KM

                </p>

                <p className='text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight'>

                  {formatCurrency(totalRecebido + (kmMetrics.lucroKm || 0))}

                </p>

                <div className='mt-1 sm:mt-2 flex items-center gap-1.5'>

                  <div className='h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-emerald-500 animate-pulse' />

                  <p className='text-[8px] sm:text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight line-clamp-1'>

                    Lucro com KM incluso

                  </p>

                </div>

              </div>

              <div className='absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-emerald-500/5 rounded-full -mr-8 -mt-8 sm:-mr-12 sm:-mt-12 group-hover:scale-150 transition-transform duration-700' />

            </div>



            {/* Chamados Abertos */}

            <div

              className='group relative overflow-hidden flex flex-col justify-between rounded-xl sm:rounded-2xl p-3 sm:p-5 bg-amber-50/80 dark:bg-amber-500/5 border border-amber-200/60 dark:border-amber-500/20 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer'

              onClick={() => setLocation('/chamados?status=ABERTO')}

              role='button'

              tabIndex={0}

            >

              <MobileBackButton className='absolute left-2 top-2 z-10' stopPropagation />

              <div className='flex items-center justify-between mb-2 sm:mb-4 pl-8 sm:pl-0'>

                <div className='p-2 sm:p-2.5 bg-amber-50 dark:bg-amber-500/10 rounded-lg sm:rounded-xl group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300 ring-2 sm:ring-4 ring-amber-50/50 dark:ring-amber-500/5'>

                  <Clock3 className='h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400 stroke-[2.5px]' />

                </div>

                <div className='flex items-center gap-1 text-emerald-500 font-black text-[8px] sm:text-[10px] bg-emerald-50/50 dark:bg-emerald-500/5 px-1 py-0 sm:px-1.5 sm:py-0.5 rounded-full'>

                  <TrendingUp className='h-2.5 w-2.5 sm:h-3 sm:w-3 stroke-[3px]' />

                  5.2%

                </div>

              </div>

              <div>

                <p className='text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0 sm:mb-1 line-clamp-1'>

                  Chamados Abertos

                </p>

                <p className='text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight'>

                  {chamadosEmAberto}

                </p>

                <div className='mt-1 sm:mt-2 flex items-center gap-1.5'>

                  <div className='h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-amber-500 animate-pulse' />

                  <p className='text-[8px] sm:text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tight line-clamp-1'>

                    Aguardando atendimento

                  </p>

                </div>

              </div>

              <div className='absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-amber-500/5 rounded-full -mr-8 -mt-8 sm:-mr-12 sm:-mt-12 group-hover:scale-150 transition-transform duration-700' />

            </div>



            {/* Concluídos (Mês) */}

            <div

              className='group relative overflow-hidden flex flex-col justify-between rounded-xl sm:rounded-2xl p-3 sm:p-5 bg-blue-50/80 dark:bg-blue-500/5 border border-blue-200/60 dark:border-blue-500/20 shadow-md hover:shadow-xl transition-all duration-300'

            >

              <MobileBackButton className='absolute left-2 top-2 z-10' stopPropagation />

              <div className='flex items-center justify-between mb-2 sm:mb-4 pl-8 sm:pl-0'>

                <div className='p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg sm:rounded-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ring-2 sm:ring-4 ring-blue-50/50 dark:ring-blue-500/5'>

                  <CheckCheck className='h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 stroke-[2.5px]' />

                </div>

                <div className='flex items-center gap-1 text-emerald-500 font-black text-[8px] sm:text-[10px] bg-emerald-50/50 dark:bg-emerald-500/5 px-1 py-0 sm:px-1.5 sm:py-0.5 rounded-full'>

                  <TrendingUp className='h-2.5 w-2.5 sm:h-3 sm:w-3 stroke-[3px]' />

                  12.1%

                </div>

              </div>

              <div>

                <p className='text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0 sm:mb-1 line-clamp-1'>

                  Concluídos (Mês)

                </p>

                <p className='text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight'>

                  {completedThisMonth}

                </p>

                <div className='mt-1 sm:mt-2 flex items-center gap-1.5'>

                  <div className='h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-blue-500 animate-pulse' />

                  <p className='text-[8px] sm:text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tight line-clamp-1'>

                    Finalizados com sucesso

                  </p>

                </div>

              </div>

              <div className='absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-blue-500/5 rounded-full -mr-8 -mt-8 sm:-mr-12 sm:-mt-12 group-hover:scale-150 transition-transform duration-700' />

            </div>



            {/* Cancelados (Mês) */}

            <div

              className='group relative overflow-hidden flex flex-col justify-between rounded-xl sm:rounded-2xl p-3 sm:p-5 bg-white dark:bg-slate-900 border border-slate-300/50 dark:border-slate-800 shadow-md hover:shadow-xl hover:border-red-500/20 transition-all duration-300'

            >

              <MobileBackButton className='absolute left-2 top-2 z-10' stopPropagation />

              <div className='flex items-center justify-between mb-2 sm:mb-4 pl-8 sm:pl-0'>

                <div className='p-2 sm:p-2.5 bg-red-50 dark:bg-red-900/10 rounded-lg sm:rounded-xl group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300 ring-2 sm:ring-4 ring-red-50/50 dark:ring-red-900/5'>

                  <XCircle className='h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400 stroke-[2.5px]' />

                </div>

                <Badge variant='outline' className='bg-red-50/50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800/30 text-[8px] sm:text-[9px] font-black tracking-wider uppercase px-1 py-0 sm:px-2.5 sm:py-0.5'>

                  Crítico

                </Badge>

              </div>

              <div>

                <p className='text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0 sm:mb-1 line-clamp-1'>

                  Cancelados (Mês)

                </p>

                <p className='text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight'>

                  {cancelledThisMonth}

                </p>

                <div className='mt-1 sm:mt-2 flex items-center gap-1.5'>

                  <div className='h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-red-500' />

                  <p className='text-[8px] sm:text-[9px] font-bold text-red-600 dark:text-red-400 uppercase tracking-tight line-clamp-1'>

                    {cancelledThisMonth > 0

                      ? `${cancelledThisMonth} chamado(s)`

                      : 'Nenhum cancelamento'}

                  </p>

                </div>

              </div>

              <div className='absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-red-500/5 rounded-full -mr-8 -mt-8 sm:-mr-12 sm:-mt-12 group-hover:scale-150 transition-transform duration-700' />

            </div>



            {/* Recebido (Mês) */}

            <div

              className='group relative overflow-hidden flex flex-col justify-between rounded-xl sm:rounded-2xl p-3 sm:p-5 bg-emerald-50/80 dark:bg-emerald-500/5 border border-emerald-200/60 dark:border-emerald-500/20 shadow-md hover:shadow-xl transition-all duration-300'

            >

              <MobileBackButton className='absolute left-2 top-2 z-10' stopPropagation />

              <div className='flex items-center justify-between mb-2 sm:mb-4 pl-8 sm:pl-0'>

                <div className='p-2 sm:p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg sm:rounded-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ring-2 sm:ring-4 ring-emerald-50/50 dark:ring-emerald-500/5'>

                  <CheckCircle2 className='h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400 stroke-[2.5px]' />

                </div>

                <div className='flex items-center gap-1 text-emerald-500 font-black text-[8px] sm:text-[10px] bg-emerald-50/50 dark:bg-emerald-500/5 px-1 py-0 sm:px-1.5 sm:py-0.5 rounded-full'>

                  <TrendingUp className='h-2.5 w-2.5 sm:h-3 sm:w-3 stroke-[3px]' />

                  8.5%

                </div>

              </div>

              <div>

                <p className='text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0 sm:mb-1 line-clamp-1'>

                  Recebido ({periodLabel})

                </p>

                <p className='text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight'>

                  {formatCurrency(totalRecebido)}

                </p>

                <div className='mt-1 sm:mt-2 flex items-center gap-1.5'>

                  <div className='h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-emerald-500 animate-pulse' />

                  <p className='text-[8px] sm:text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight line-clamp-1'>

                    Pagamentos confirmados

                  </p>

                </div>

              </div>

              <div className='absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-emerald-500/5 rounded-full -mr-8 -mt-8 sm:-mr-12 sm:-mt-12 group-hover:scale-150 transition-transform duration-700' />

            </div>



            {/* Pendente (Mês) */}

            <div

              className='group relative overflow-hidden flex flex-col justify-between rounded-xl sm:rounded-2xl p-3 sm:p-5 bg-orange-50/80 dark:bg-orange-500/5 border border-orange-200/60 dark:border-orange-500/20 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer'

              onClick={() => setShowPendingPayments(true)}

              role='button'

              tabIndex={0}

            >

              <MobileBackButton className='absolute left-2 top-2 z-10' stopPropagation />

              <div className='flex items-center justify-between mb-2 sm:mb-4 pl-8 sm:pl-0'>

                <div className='p-2 sm:p-2.5 bg-orange-50 dark:bg-orange-500/10 rounded-lg sm:rounded-xl group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300 ring-2 sm:ring-4 ring-orange-50/50 dark:ring-orange-500/5'>

                  <Clock3 className='h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400 stroke-[2.5px]' />

                </div>

                <div className='flex items-center gap-1 text-orange-500 font-black text-[8px] sm:text-[10px] bg-orange-50/50 dark:bg-orange-500/5 px-1 py-0 sm:px-1.5 sm:py-0.5 rounded-full'>

                  <TrendingUp className='h-2.5 w-2.5 sm:h-3 sm:w-3 stroke-[3px]' />

                  2.1%

                </div>

              </div>

              <div>

                <p className='text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0 sm:mb-1 line-clamp-1'>

                  Pendente ({periodLabel})

                </p>

                <p className='text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight'>

                  {formatCurrency(totalPendente)}

                </p>

                <div className='mt-1 sm:mt-2 flex items-center gap-1.5'>

                  <div className='h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-orange-500 animate-pulse' />

                  <p className='text-[8px] sm:text-[9px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-tight line-clamp-1'>

                    {totalPendente > 0 ? 'Aguardando pagamento' : 'Tudo em dia'}

                  </p>

                </div>

              </div>

              <div className='absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-orange-500/5 rounded-full -mr-8 -mt-8 sm:-mr-12 sm:-mt-12 group-hover:scale-150 transition-transform duration-700' />

            </div>



            {/* Faturamento (Mês) */}

            <div

              className='group relative overflow-hidden flex flex-col justify-between rounded-xl sm:rounded-2xl p-3 sm:p-5 bg-indigo-50/80 dark:bg-primary/5 border border-indigo-200/60 dark:border-primary/20 shadow-md hover:shadow-xl transition-all duration-300'

            >

              <MobileBackButton className='absolute left-2 top-2 z-10' stopPropagation />

              <div className='flex items-center justify-between mb-2 sm:mb-4 pl-8 sm:pl-0'>

                <div className='p-2 sm:p-2.5 bg-primary/5 dark:bg-primary/10 rounded-lg sm:rounded-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ring-2 sm:ring-4 ring-primary/5 dark:ring-primary/5'>

                  <TrendingUp className='h-4 w-4 sm:h-5 sm:w-5 text-primary stroke-[2.5px]' />

                </div>

                <div className='flex items-center gap-1 text-emerald-500 font-black text-[8px] sm:text-[10px] bg-emerald-50/50 dark:bg-emerald-500/5 px-1 py-0 sm:px-1.5 sm:py-0.5 rounded-full'>

                  <TrendingUp className='h-2.5 w-2.5 sm:h-3 sm:w-3 stroke-[3px]' />

                  9.3%

                </div>

              </div>

              <div>

                <p className='text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0 sm:mb-1 line-clamp-1'>

                  Faturamento ({periodLabel})

                </p>

                <p className='text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight'>

                  {formatCurrency(faturamentoTotal)}

                </p>

                <div className='mt-1 sm:mt-2 flex items-center gap-1.5'>

                  <div className='h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-primary animate-pulse' />

                  <p className='text-[8px] sm:text-[9px] font-bold text-primary uppercase tracking-tight line-clamp-1'>

                    Volume total negociado

                  </p>

                </div>

              </div>

              <div className='absolute top-0 right-0 w-16 h-16 sm:w-24 sm:h-24 bg-primary/5 rounded-full -mr-8 -mt-8 sm:-mr-12 sm:-mt-12 group-hover:scale-150 transition-transform duration-700' />

            </div>

          </div>



          <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>

            {/* Card Faturamento Estimado */}

            <div 

              className='lg:col-span-4 group relative overflow-hidden rounded-2xl bg-blue-50/40 dark:bg-slate-900 border border-blue-100 dark:border-slate-800 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer'

              onClick={() => setShowBillingRanking(true)}

            >

              <div className='p-6'>

                <div className='flex items-center justify-between mb-6'>

                  <div className='space-y-1'>

                    <h3 className='text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400'>

                      Faturamento Estimado

                    </h3>

                    <p className='text-3xl font-black text-slate-900 dark:text-white tracking-tight'>

                      {formatCurrency(faturamentoEstimadoDisplay)}

                    </p>

                  </div>

                  <div className='p-3 bg-primary/5 dark:bg-primary/10 rounded-2xl'>

                    <DollarSign className='h-6 w-6 text-primary' />

                  </div>

                </div>

                

                <div className='space-y-4'>

                  <div className='flex items-center justify-between text-xs'>

                    <span className='font-bold text-slate-600 dark:text-slate-400'>Progresso Atual</span>

                    <span className='font-black text-primary'>{progressoFaturamento}%</span>

                  </div>

                  <div className='h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden'>

                    <div 

                      initial={{ width: 0 }}

                      animate={{ width: `${progressoFaturamento}%` }}

                      transition={{ duration: 1, ease: "easeOut" }}

                      className='h-full bg-primary rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]'

                    />

                  </div>

                  <div className='grid grid-cols-2 gap-4 pt-2'>

                    <div className='p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50'>

                      <p className='text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1'>Ticket Médio</p>

                      <p className='text-sm font-bold text-slate-900 dark:text-white'>{formatCurrency(ticketMedio)}</p>

                    </div>

                    <div className='p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50'>

                      <p className='text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1'>Eficiência</p>

                      <p className='text-sm font-bold text-emerald-500'>+4.2%</p>

                    </div>

                  </div>

                  <p className='text-[10px] text-center font-medium text-slate-400 dark:text-slate-500 pt-2 italic'>

                    Progresso estimado com base nos concluídos do mês

                  </p>

                </div>

              </div>

            </div>



            {/* Card Clientes Cadastrados */}

            <div 

              className='lg:col-span-4 group relative overflow-hidden rounded-2xl bg-purple-50/40 dark:bg-slate-900 border border-purple-100 dark:border-slate-800 shadow-md hover:shadow-md transition-all duration-300 cursor-pointer'

              onClick={() => setShowClientsRanking(true)}

            >

              <div className='p-6'>

                <div className='flex items-center justify-between mb-6'>

                  <div className='space-y-1'>

                    <h3 className='text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400'>

                      Clientes Cadastrados

                    </h3>

                    <p className='text-3xl font-black text-slate-900 dark:text-white tracking-tight'>

                      {allClients.length}

                    </p>

                  </div>

                  <div className='p-3 bg-purple-50 dark:bg-purple-500/10 rounded-2xl'>

                    <Users className='h-6 w-6 text-purple-500' />

                  </div>

                </div>



                <div className='space-y-5'>

                  <div className='grid grid-cols-3 gap-3'>

                    <div className='text-center space-y-1'>

                      <div className='h-1.5 w-full bg-blue-500 rounded-full opacity-20' />

                      <p className='text-[10px] font-bold text-blue-500 uppercase'>PF</p>

                      <p className='text-sm font-black'>{allClients.filter(c => c.type === 'PF').length}</p>

                    </div>

                    <div className='text-center space-y-1'>

                      <div className='h-1.5 w-full bg-emerald-500 rounded-full opacity-20' />

                      <p className='text-[10px] font-bold text-emerald-500 uppercase'>PJ</p>

                      <p className='text-sm font-black'>{allClients.filter(c => c.type === 'PJ').length}</p>

                    </div>

                    <div className='text-center space-y-1'>

                      <div className='h-1.5 w-full bg-purple-500 rounded-full opacity-20' />

                      <p className='text-[10px] font-bold text-purple-500 uppercase'>Part.</p>

                      <p className='text-sm font-black'>{allClients.filter(c => c.type === 'EMPRESA_PARCEIRA').length}</p>

                    </div>

                  </div>

                  

                  <div className='h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden'>

                    <div 

                      className='h-full bg-blue-500 transition-all duration-500' 

                      style={{ width: `${(allClients.filter(c => c.type === 'PF').length / (allClients.length || 1)) * 100}%` }} 

                    />

                    <div 

                      className='h-full bg-emerald-500 transition-all duration-500' 

                      style={{ width: `${(allClients.filter(c => c.type === 'PJ').length / (allClients.length || 1)) * 100}%` }} 

                    />

                    <div 

                      className='h-full bg-purple-500 transition-all duration-500' 

                      style={{ width: `${(allClients.filter(c => c.type === 'EMPRESA_PARCEIRA').length / (allClients.length || 1)) * 100}%` }} 

                    />

                  </div>



                  <Button 

                    variant='ghost' 

                    className='w-full h-11 border border-slate-300/50 dark:border-slate-800 rounded-xl text-xs font-bold hover:bg-primary/5 hover:text-primary transition-all gap-2'

                  >

                    Clique para ver detalhamento por tipo

                  </Button>

                </div>

              </div>

            </div>



            {/* Card R$ Por Hora */}

            <div 

              className='lg:col-span-4 group relative overflow-hidden rounded-2xl bg-indigo-50/40 dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 shadow-md hover:shadow-md transition-all duration-300 cursor-pointer'

              onClick={() => setShowRevenueRanking(true)}

            >

              <div className='p-6'>

                <div className='flex items-center justify-between mb-6'>

                  <div className='space-y-1'>

                    <h3 className='text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400'>

                      R$ Por Hora (Mês)

                    </h3>

                    <p className='text-3xl font-black text-slate-900 dark:text-white tracking-tight'>

                      {formatCurrency(revenuePerHourAvg)}

                    </p>

                  </div>

                  <div className='p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl'>

                    <Clock3 className='h-6 w-6 text-indigo-500' />

                  </div>

                </div>



                <div className='space-y-4'>

                  <div className='flex items-center gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-xl border border-slate-300/50 dark:border-slate-800'>

                    <div className='p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm'>

                      <TrendingUp className='h-4 w-4 text-emerald-500' />

                    </div>

                    <div>

                      <p className='text-[9px] font-black uppercase tracking-widest text-slate-500'>Desempenho</p>

                      <p className='text-xs font-bold text-slate-700 dark:text-slate-300'>Média baseada em pagamentos recebidos</p>

                    </div>

                  </div>



                  <div className='space-y-2'>

                    <div className='flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500'>

                      <span>Meta de Rentabilidade</span>

                      <span>{Math.min(100, Math.round((revenuePerHourAvg / 250) * 100))}%</span>

                    </div>

                    <div className='h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden'>

                      <div 

                        className='h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-1000' 

                        style={{ width: `${Math.min(100, Math.round((revenuePerHourAvg / 250) * 100))}%` }} 

                      />

                    </div>

                  </div>



                  <Button 

                    variant='ghost' 

                    className='w-full h-11 border border-slate-300/50 dark:border-slate-800 rounded-xl text-xs font-bold hover:bg-indigo-500/5 hover:text-indigo-500 transition-all gap-2'

                  >

                    Ver ranking de rentabilidade

                  </Button>

                </div>

              </div>

            </div>

          </div>



          {/* Seção de KM Refinada */}

          <div className='group relative overflow-hidden rounded-2xl bg-emerald-50/30 dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 shadow-md hover:shadow-lg transition-all duration-300'>

            <div className='p-6 sm:p-8'>

              <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8'>

                <div className='flex items-center gap-4'>

                  <div className='p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl'>

                    <Fuel className='h-7 w-7 text-emerald-500' />

                  </div>

                  <div>

                    <h3 className='text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1'>Ganhos e Lucro com KM</h3>

                    <p className='text-4xl font-black text-slate-900 dark:text-white tracking-tight'>

                      {formatCurrency(kmMetrics.lucroKm || 0)}

                    </p>

                    <div className='flex items-center gap-2 mt-1'>

                      <Badge className='bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-none px-2 py-0 text-[10px] font-black'>LUCRO LÍQUIDO</Badge>

                      <span className='text-xs text-slate-400 font-medium'>• {kmMetrics.totalKm?.toFixed(1) || '0.0'} KM percorridos</span>

                    </div>

                  </div>

                </div>

                

                <div className='flex flex-wrap gap-2'>

                  <Button 

                    variant='outline' 

                    size='sm' 

                    className='h-9 rounded-xl border-slate-200 dark:border-slate-800 font-bold text-xs gap-2'

                    onClick={(e) => {

                      e.stopPropagation();

                      setShowVehicleSettingsModal(true);

                    }}

                  >

                    <SettingsIcon className='h-3.5 w-3.5' />

                    Configurar Taxas

                  </Button>

                </div>

              </div>



              <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>

                <div className='relative p-5 rounded-2xl bg-white dark:bg-slate-800/30 border border-slate-300/50 dark:border-slate-800 group/item overflow-hidden'>

                  <p className='text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3'>Total Bruto KM</p>

                  <p className='text-2xl font-black text-slate-900 dark:text-white mb-1'>{formatCurrency(kmMetrics.ganhosKm || 0)}</p>

                  <p className='text-[10px] font-bold text-emerald-500 uppercase'>Receita de deslocamento</p>

                  <div className='absolute -bottom-4 -right-4 opacity-5 group-hover/item:scale-125 transition-transform'>

                    <TrendingUp className='h-20 w-20' />

                  </div>

                </div>



                <div className='relative p-5 rounded-2xl bg-white dark:bg-slate-800/30 border border-slate-300/50 dark:border-slate-800 group/item overflow-hidden'>

                  <p className='text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3'>Gastos Estimados</p>

                  <p className='text-2xl font-black text-red-500 mb-1'>-{formatCurrency(kmMetrics.gastosKm || 0)}</p>

                  <p className='text-[10px] font-bold text-red-400 uppercase'>Combustível e manutenção</p>

                  <div className='absolute -bottom-4 -right-4 opacity-5 group-hover/item:scale-125 transition-transform text-red-500'>

                    <Fuel className='h-20 w-20' />

                  </div>

                </div>



                <div className='relative p-5 rounded-2xl bg-primary/5 dark:bg-primary/10 border border-slate-300/50 dark:border-slate-800 group/item overflow-hidden'>

                  <p className='text-[10px] font-black uppercase tracking-widest text-primary mb-3'>Eficiência Financeira</p>

                  <p className='text-2xl font-black text-primary mb-1'>

                    {kmMetrics.ganhosKm > 0 

                      ? `${Math.round(((kmMetrics.ganhosKm - kmMetrics.gastosKm) / kmMetrics.ganhosKm) * 100)}%`

                      : '0%'}

                  </p>

                  <p className='text-[10px] font-bold text-primary/60 uppercase'>Margem de lucro no KM</p>

                  <div className='absolute -bottom-4 -right-4 opacity-5 group-hover/item:scale-125 transition-transform text-primary'>

                    <Trophy className='h-20 w-20' />

                  </div>

                </div>

              </div>

            </div>

          </div>



          {/* Espaçador extra para garantir que o conteúdo não fique atrás do menu mobile */}

          <div className='h-32 md:hidden' aria-hidden='true' />

        </div>

      )}



      {/* Detalhamento de clientes */}

      {expandedMetric === 'clients' && (

        <Card className='border-primary/20 bg-primary/5'>

          <CardHeader>

            <div className='flex items-center justify-between gap-4'>

              <div className='flex items-center gap-2'>

                <Users className='h-5 w-5 text-primary' />

                <CardTitle className='text-xl font-semibold'>

                  Detalhamento de Clientes

                </CardTitle>

              </div>

              <Button

                variant='ghost'

                size='sm'

                onClick={() => setExpandedMetric(null)}

              >

                <X className='h-4 w-4' />

              </Button>

            </div>

          </CardHeader>

          <CardContent className='space-y-4'>

            {(loadingClientStats || loadingClientList) && (

              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>

                {[...Array(3)].map((_, i) => (

                  <Skeleton key={i} className='h-32' />

                ))}

              </div>

            )}



            {!loadingClientStats && clientStats && clientStats.total > 0 && (

              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>

                <Card className='hover-elevate'>

                  <CardHeader className='pb-3'>

                    <div className='flex items-center gap-3'>

                      <div className='h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0'>

                        <User className='h-5 w-5 text-emerald-600 dark:text-emerald-400' />

                      </div>

                      <h4 className='font-semibold text-sm text-muted-foreground'>

                        Clientes PF

                      </h4>

                    </div>

                  </CardHeader>

                  <CardContent>

                    <p className='text-4xl font-bold text-emerald-600 dark:text-emerald-400'>

                      {clientStats.pf}

                    </p>

                    <p className='text-xs text-muted-foreground mt-2'>

                      {(

                        (clientStats.pf / clientStats.total) * 100 || 0

                      ).toFixed(0)}

                      % do total

                    </p>

                  </CardContent>

                </Card>



                <Card className='hover-elevate'>

                  <CardHeader className='pb-3'>

                    <div className='flex items-center gap-3'>

                      <div className='h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0'>

                        <Briefcase className='h-5 w-5 text-blue-600 dark:text-blue-400' />

                      </div>

                      <h4 className='font-semibold text-sm text-muted-foreground'>

                        Clientes PJ

                      </h4>

                    </div>

                  </CardHeader>

                  <CardContent>

                    <p className='text-4xl font-bold text-blue-600 dark:text-blue-400'>

                      {clientStats.pj}

                    </p>

                    <p className='text-xs text-muted-foreground mt-2'>

                      {(

                        (clientStats.pj / clientStats.total) * 100 || 0

                      ).toFixed(0)}

                      % do total

                    </p>

                  </CardContent>

                </Card>



                <Card className='hover-elevate'>

                  <CardHeader className='pb-3'>

                    <div className='flex items-center gap-3'>

                      <div className='h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0'>

                        <Building className='h-5 w-5 text-amber-600 dark:text-amber-500' />

                      </div>

                      <h4 className='font-semibold text-sm text-muted-foreground'>

                        Empresa Parceira

                      </h4>

                    </div>

                  </CardHeader>

                  <CardContent>

                    <p className='text-4xl font-bold text-amber-600 dark:text-amber-500'>

                      {clientStats.empresaParceira}

                    </p>

                    <p className='text-xs text-muted-foreground mt-2'>

                      {(

                        (clientStats.empresaParceira / clientStats.total) *

                          100 || 0

                      ).toFixed(0)}

                      % do total

                    </p>

                  </CardContent>

                </Card>

              </div>

            )}



            {!loadingClientList && clientList && clientList.length > 0 && (

              <div className='space-y-3'>

                {clientList.map((client) => {

                  const badgeClass =

                    client.type === 'PF'

                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'

                      : client.type === 'PJ'

                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'

                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-500';

                  const badgeLabel =

                    client.type === 'EMPRESA_PARCEIRA'

                      ? 'Empresa Parceira'

                      : client.type;

                  return (

                    <Card key={client.id} className='hover-elevate'>

                      <CardHeader className='pb-2'>

                        <div className='flex items-center justify-between gap-3'>

                          <div className='min-w-0'>

                            <h4

                              className='font-semibold truncate'

                              title={client.name}

                            >

                              {client.name}

                            </h4>

                            <p className='text-xs text-muted-foreground truncate'>

                              {client.email || 'Sem e-mail'}

                            </p>

                          </div>

                          <Badge className={badgeClass}>{badgeLabel}</Badge>

                        </div>

                      </CardHeader>

                      <CardContent className='flex flex-col gap-1 text-sm text-muted-foreground'>

                        <div className='flex items-center gap-2'>

                          <span className='font-medium text-foreground'>

                            Telefone:

                          </span>

                          <span className='truncate'>

                            {client.phone || 'No informado'}

                          </span>

                        </div>

                        <div className='flex items-center gap-2'>

                          <span className='font-medium text-foreground'>

                            Localizao:

                          </span>

                          <span className='truncate'>

                            {client.city && client.state

                              ? `${client.city} - ${client.state}`

                              : 'No informado'}

                          </span>

                        </div>

                      </CardContent>

                    </Card>

                  );

                })}

              </div>

            )}



            {!loadingClientList && (!clientList || clientList.length === 0) && (

              <div className='text-center py-12'>

                <Users className='h-12 w-12 mx-auto text-muted-foreground/50 mb-4' />

                <p className='text-muted-foreground'>

                  Nenhum cliente encontrado

                </p>

              </div>

            )}

          </CardContent>

        </Card>

      )}



      {/* Detalhamento de tickets */}

      {expandedMetric === 'tickets' && (

        <Card className='border-primary/20 bg-primary/5'>

          <CardHeader>

            <div className='flex items-center justify-between gap-4'>

              <div className='flex items-center gap-2'>

                <CalendarIcon className='h-5 w-5 text-primary' />

                <CardTitle className='text-xl font-semibold'>

                  Detalhamento de Chamados

                </CardTitle>

              </div>

              <Button

                variant='ghost'

                size='sm'

                onClick={() => setExpandedMetric(null)}

              >

                <X className='h-4 w-4' />

              </Button>

            </div>

          </CardHeader>

          <CardContent>

            {loadingTicketStats ? (

              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>

                {[...Array(3)].map((_, i) => (

                  <Skeleton key={i} className='h-32' />

                ))}

              </div>

            ) : ticketStats ? (

              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>

                <Card className='hover-elevate'>

                  <CardHeader className='pb-3'>

                    <div className='flex items-center gap-3'>

                      <div className='h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0'>

                        <CheckCheck className='h-5 w-5 text-green-600 dark:text-green-500' />

                      </div>

                      <h4 className='font-semibold text-sm text-muted-foreground'>

                        Concluídos

                      </h4>

                    </div>

                  </CardHeader>

                  <CardContent>

                    <p className='text-4xl font-bold text-green-600 dark:text-green-500'>

                      {ticketStats.completed}

                    </p>

                    <p className='text-xs text-muted-foreground mt-2'>

                      {(

                        (ticketStats.completed / ticketStats.total) * 100 || 0

                      ).toFixed(0)}

                      % do total

                    </p>

                  </CardContent>

                </Card>



                <Card className='hover-elevate'>

                  <CardHeader className='pb-3'>

                    <div className='flex items-center gap-3'>

                      <div className='h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0'>

                        <Play className='h-5 w-5 text-blue-600 dark:text-blue-500' />

                      </div>

                      <h4 className='font-semibold text-sm text-muted-foreground'>

                        Em execução

                      </h4>

                    </div>

                  </CardHeader>

                  <CardContent>

                    <p className='text-4xl font-bold text-blue-600 dark:text-blue-500'>

                      {ticketStats.inProgress}

                    </p>

                    <p className='text-xs text-muted-foreground mt-2'>

                      {(

                        (ticketStats.inProgress / ticketStats.total) * 100 || 0

                      ).toFixed(0)}

                      % do total

                    </p>

                  </CardContent>

                </Card>



                <Card className='hover-elevate'>

                  <CardHeader className='pb-3'>

                    <div className='flex items-center gap-3'>

                      <div className='h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0'>

                        <XCircle className='h-5 w-5 text-red-600 dark:text-red-500' />

                      </div>

                      <h4 className='font-semibold text-sm text-muted-foreground'>

                        Cancelados

                      </h4>

                    </div>

                  </CardHeader>

                  <CardContent>

                    <p className='text-4xl font-bold text-red-600 dark:text-red-500'>

                      {ticketStats.cancelled}

                    </p>

                    <p className='text-xs text-muted-foreground mt-2'>

                      {(

                        (ticketStats.cancelled / ticketStats.total) * 100 || 0

                      ).toFixed(0)}

                      % do total

                    </p>

                  </CardContent>

                </Card>

              </div>

            ) : (

              <div className='text-center py-12'>

                <CalendarIcon className='h-12 w-12 mx-auto text-muted-foreground/50 mb-4' />

                <p className='text-muted-foreground'>

                  Nenhum chamado encontrado

                </p>

              </div>

            )}

          </CardContent>

        </Card>

      )}



      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>

        <DialogContent className='max-w-3xl'>

          <DialogHeader>

            <DialogTitle>Chamado concludo</DialogTitle>

            <DialogDescription className='sr-only'>

              Detalhes do chamado concluido.

            </DialogDescription>

          </DialogHeader>

          {selectedTicket && renderTicketCard(selectedTicket, true)}

        </DialogContent>

      </Dialog>



      <AlertDialog

        open={!!recordToDelete}

        onOpenChange={(open) => {

          if (!open) {

            setRecordToDelete(null);

          }

        }}

      >

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Excluir registro financeiro</AlertDialogTitle>

            <AlertDialogDescription>

              Tem certeza que deseja excluir este registro financeiro? Esta acao

              nao pode ser desfeita.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel onClick={() => setRecordToDelete(null)}>

              Cancelar

            </AlertDialogCancel>

            <AlertDialogAction

              onClick={handleConfirmDeleteFinancialRecord}

              disabled={deleteFinancialRecordMutation.isPending}

            >

              Excluir

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>



      {/* Complete Dialog */}

      {completingTicket && (

        <TicketCompleteDialog

          isOpen={!!completingTicket}

          onClose={() => setCompletingTicket(null)}

          ticket={{

            id: completingTicket.id,

            serviceId: completingTicket.service?.id || '',

            ticketValue: completingTicket.ticketValue || '',

            service: {

              name: completingTicket.service?.name || '',

              price: completingTicket.service?.price?.toString() || '0',

            },

            kmTotal: completingTicket.kmTotal || 0,

            kmRate: completingTicket.kmRate || '0',

          }}

          fullTicketData={completingTicket}

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



      {/* Modal de Configuração do Veículo */}

      <Dialog

        open={showVehicleSettingsModal}

        onOpenChange={setShowVehicleSettingsModal}

      >

        <DialogContent className='max-w-md'>

          <DialogHeader>

            <DialogTitle>Configurações do Veículo</DialogTitle>

            <DialogDescription className='sr-only'>

              Atualize os dados de consumo do veiculo.

            </DialogDescription>

          </DialogHeader>

          <VehicleSettingsForm

            initialFuelType={vehicleSettings?.fuelType || 'GASOLINA'}

            initialKmPerLiter={vehicleSettings?.kmPerLiter || 10}

            initialFuelPricePerLiter={vehicleSettings?.fuelPricePerLiter || 6}

            onSave={async (fuelType, kmPerLiter, fuelPricePerLiter) => {

              try {

                const response = await apiRequest(

                  'PUT',

                  '/api/vehicle-settings',

                  {

                    fuelType,

                    kmPerLiter,

                    fuelPricePerLiter,

                  }

                );

                if (response.ok) {

                  await refetchVehicleSettings();

                  // Invalidar query de km-metrics para recalcular com as novas configurações

                  queryClient.invalidateQueries({

                    queryKey: ['/api/dashboard/km-metrics'],

                  });

                  setShowVehicleSettingsModal(false);

                  toast({

                    title: 'Configurações salvas',

                    description:

                      'As configurações do veículo foram salvas com sucesso.',

                  });

                } else {

                  const error = await response.json();

                  toast({

                    variant: 'destructive',

                    title: 'Erro ao salvar',

                    description:

                      error.message ||

                      'Não foi possível salvar as configurações.',

                  });

                }

              } catch (error: any) {

                toast({

                  variant: 'destructive',

                  title: 'Erro ao salvar',

                  description:

                    error.message ||

                    'Não foi possível salvar as configurações.',

                });

              }

            }}

          />

        </DialogContent>

      </Dialog>

    </div>

    </>

  );

}



// Componente de formulário de configurações do veículo

function VehicleSettingsForm({

  initialFuelType,

  initialKmPerLiter,

  initialFuelPricePerLiter,

  onSave,

}: {

  initialFuelType: string;

  initialKmPerLiter: number;

  initialFuelPricePerLiter: number;

  onSave: (

    fuelType: string,

    kmPerLiter: number,

    fuelPricePerLiter: number

  ) => Promise<void>;

}) {

  // Função auxiliar para converter número para formato de string que maskCurrency espera

  // maskCurrency espera uma string sem formatação (ex: "12000" para R$ 120,00)

  const numberToCurrencyString = (value: number): string => {

    if (value === 0 || isNaN(value)) return '0';

    // Multiplicar por 100 para converter reais em centavos (formato que maskCurrency espera)

    return Math.round(value * 100).toString();

  };



  const [fuelType, setFuelType] = useState(initialFuelType);

  const [kmPerLiter, setKmPerLiter] = useState(initialKmPerLiter.toString());

  const [fuelPricePerLiter, setFuelPricePerLiter] = useState(

    maskCurrency(numberToCurrencyString(initialFuelPricePerLiter))

  );

  const [isSaving, setIsSaving] = useState(false);



  // Função para obter labels baseados no tipo de combustível

  const getFuelLabels = (type: string) => {

    switch (type) {

      case 'GNV':

        return {

          consumptionLabel: 'Consumo do veículo (km por m³)',

          consumptionHelper:

            'Quantos quilômetros o veículo faz por metro cúbico de GNV',

          priceLabel: 'Preço do m³ de GNV (R$)',

          priceHelper: 'Preço atual do metro cúbico de GNV',

          consumptionPlaceholder: '13.0',

          pricePlaceholder: '4.00',

        };

      case 'ELETRICO':

        return {

          consumptionLabel: 'Consumo do veículo (km por kWh)',

          consumptionHelper:

            'Quantos quilômetros o veículo faz por quilowatt-hora',

          priceLabel: 'Preço do kWh (R$)',

          priceHelper: 'Preço atual do quilowatt-hora de energia elétrica',

          consumptionPlaceholder: '6.0',

          pricePlaceholder: '0.77',

        };

      case 'DIESEL':

        return {

          consumptionLabel: 'Consumo do veículo (km por litro)',

          consumptionHelper:

            'Quantos quilômetros o veículo faz por litro de diesel',

          priceLabel: 'Preço do litro de diesel (R$)',

          priceHelper: 'Preço atual do litro de diesel',

          consumptionPlaceholder: '10.8',

          pricePlaceholder: '6.50',

        };

      case 'GASOLINA':

      default:

        return {

          consumptionLabel: 'Consumo do veículo (km por litro)',

          consumptionHelper:

            'Quantos quilômetros o veículo faz por litro de gasolina',

          priceLabel: 'Preço do litro de gasolina (R$)',

          priceHelper: 'Preço atual do litro de gasolina',

          consumptionPlaceholder: '10.0',

          pricePlaceholder: '6.00',

        };

    }

  };



  const labels = getFuelLabels(fuelType);



  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    const kmValue = parseFloat(kmPerLiter);

    // Converter valor mascarado de volta para número

    const fuelValue = parseFloat(unmaskCurrency(fuelPricePerLiter));



    if (isNaN(kmValue) || kmValue <= 0) {

      return;

    }

    if (isNaN(fuelValue) || fuelValue <= 0) {

      return;

    }



    setIsSaving(true);

    try {

      await onSave(fuelType, kmValue, fuelValue);

    } finally {

      setIsSaving(false);

    }

  };



  return (

    <form onSubmit={handleSubmit} className='space-y-4'>

      <div className='space-y-2'>

        <label htmlFor='fuelType' className='text-sm font-medium'>

          Tipo de Combustível *

        </label>

        <Select value={fuelType} onValueChange={setFuelType} required>

          <SelectTrigger id='fuelType' className='w-full'>

            <SelectValue placeholder='Selecione o tipo de combustível' />

          </SelectTrigger>

          <SelectContent>

            <SelectItem value='GASOLINA'>Gasolina</SelectItem>

            <SelectItem value='GNV'>GNV</SelectItem>

            <SelectItem value='DIESEL'>Diesel</SelectItem>

            <SelectItem value='ELETRICO'>Elétrico</SelectItem>

          </SelectContent>

        </Select>

        <p className='text-xs text-muted-foreground'>

          Selecione o tipo de combustível utilizado pelo veículo

        </p>

      </div>



      <div className='space-y-2'>

        <label htmlFor='kmPerLiter' className='text-sm font-medium'>

          {labels.consumptionLabel}

        </label>

        <Input

          id='kmPerLiter'

          type='number'

          step='0.1'

          min='0.1'

          value={kmPerLiter}

          onChange={(e) => setKmPerLiter(e.target.value)}

          placeholder={labels.consumptionPlaceholder}

          required

        />

        <p className='text-xs text-muted-foreground'>

          {labels.consumptionHelper}

        </p>

      </div>



      <div className='space-y-2'>

        <label htmlFor='fuelPricePerLiter' className='text-sm font-medium'>

          {labels.priceLabel}

        </label>

        <Input

          id='fuelPricePerLiter'

          type='text'

          value={fuelPricePerLiter}

          onChange={(e) => setFuelPricePerLiter(maskCurrency(e.target.value))}

          placeholder={labels.pricePlaceholder}

          required

        />

        <p className='text-xs text-muted-foreground'>{labels.priceHelper}</p>

      </div>



      <div className='flex justify-end gap-2 pt-4'>

        <Button

          type='button'

          variant='outline'

          onClick={() => {

            setFuelType(initialFuelType);

            setKmPerLiter(initialKmPerLiter.toString());

            setFuelPricePerLiter(

              maskCurrency(numberToCurrencyString(initialFuelPricePerLiter))

            );

          }}

        >

          Cancelar

        </Button>

        <Button type='submit' disabled={isSaving}>

          {isSaving ? 'Salvando...' : 'Salvar'}

        </Button>

      </div>

    </form>

  );

}

