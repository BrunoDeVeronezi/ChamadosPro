import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { usePaidAccess } from '@/hooks/use-paid-access';
import {
  AlertTriangle,
  BarChart3,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Image,
  ListChecks,
  Mail,
  MessageCircle,
  Printer,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const MAX_EXPORT_LIMIT = 5000;

const PERIOD_OPTIONS = [
  { value: '7', label: 'Ultimos 7 dias' },
  { value: '30', label: 'Ultimos 30 dias' },
  { value: '90', label: 'Ultimos 90 dias' },
  { value: '180', label: 'Ultimos 180 dias' },
  { value: '365', label: 'Ultimo ano' },
  { value: 'custom', label: 'Personalizado' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'ABERTO', label: 'Aberto' },
  { value: 'EXECUCAO', label: 'Em execucao' },
  { value: 'CONCLUIDO', label: 'Concluido' },
  { value: 'CANCELADO', label: 'Cancelado' },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'paid', label: 'Pago' },
  { value: 'pending', label: 'Pendente' },
  { value: 'overdue', label: 'Vencido' },
];

const CLIENT_TYPE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'PF', label: 'Pessoa Fisica' },
  { value: 'PJ', label: 'Pessoa Juridica' },
  { value: 'EMPRESA_PARCEIRA', label: 'Empresa Parceira' },
];

interface ReportRow {
  id: string;
  ticketNumber: string;
  clientName: string;
  clientType: string;
  city: string;
  state: string;
  serviceName: string;
  technicianName: string;
  scheduledDate: string;
  status: string;
  amount: number | string;
  paymentStatus: string;
  dueDate?: string | null;
}

interface ReportsResponse {
  data: ReportRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ReportPreview {
  total: number;
  totalValue: number;
  byStatus: Record<string, number>;
}

interface AdvancedReportData {
  slaCompliance: number;
  slaComplianceChange: number;
  averageResponseTime: number;
  averageResponseTimeChange: number;
  occupancyRate: number;
  occupancyRateChange: number;
  ticketsByStatus: {
    total: number;
    change: number;
    data: Array<{ name: string; value: number; color: string }>;
  };
  topClientsProfitability: {
    total: number;
    change: number;
    data: Array<{ name: string; value: number }>;
  };
  monthlyCashFlow: {
    total: number;
    change: number;
    data: Array<{ month: string; value: number }>;
  };
  averageServiceTime: {
    total: number;
    change: number;
    data: Array<{ type: string; value: number }>;
  };
}

interface DashboardStats {
  chamadosEmAberto: number;
  completedThisMonth: number;
  cancelledThisMonth: number;
  faturamentoEstimado: number;
  ticketMedio: number;
  revenuePerHourAvg: number;
  pendenciasVencidas: number;
  aReceberVencido: number;
}

interface KmMetrics {
  totalKm: number;
  ganhosKm: number;
  gastosKm: number;
  lucroKm: number;
}

interface Client {
  id: string;
  name: string;
  type: string;
  city?: string;
  state?: string;
}

interface Service {
  id: string;
  name: string;
}

interface Technician {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

const toNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[^\d,.-]/g, '').replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatCurrency = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(toNumber(value));

const parseDateInput = (value: string | null | undefined, endOfDay = false) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const time = endOfDay ? 'T23:59:59.999' : 'T00:00:00';
  const parsed = new Date(`${trimmed}${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseDateValue = (value: string | Date) => {
  if (value instanceof Date) return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseDateInput(trimmed);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateShort = (value: string | Date | null | undefined) => {
  if (!value) return '-';
  const date = parseDateValue(value instanceof Date ? value : String(value));
  if (!date) return '-';
  return format(date, 'dd/MM/yyyy', { locale: ptBR });
};

const formatDuration = (hours: number | null | undefined) => {
  if (!hours || hours <= 0) return '0h';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

const normalizeStatus = (status: string) =>
  (status || '').toString().trim().toUpperCase();

const getStatusPresentation = (status: string) => {
  const normalized = normalizeStatus(status);
  if (!normalized) {
    return {
      label: 'Sem status',
      className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    };
  }
  if (normalized.includes('CONCLU') || normalized === 'COMPLETED') {
    return {
      label: 'Concluido',
      className:
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    };
  }
  if (normalized.includes('CANCEL')) {
    return {
      label: 'Cancelado',
      className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    };
  }
  if (
    normalized.includes('EXEC') ||
    normalized.includes('IN_PROGRESS') ||
    normalized.includes('INICIADO')
  ) {
    return {
      label: 'Em execucao',
      className:
        'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    };
  }
  if (normalized === 'ABERTO' || normalized === 'PENDING') {
    return {
      label: 'Aberto',
      className:
        'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    };
  }
  return {
    label: normalized,
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };
};

const getPaymentPresentation = (status: string) => {
  const normalized = (status || '').toString().toLowerCase().trim();
  if (normalized === 'paid' || normalized === 'pago') {
    return {
      label: 'Pago',
      className:
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    };
  }
  if (normalized === 'overdue' || normalized === 'vencido' || normalized === 'atrasado') {
    return {
      label: 'Vencido',
      className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    };
  }
  if (normalized === 'pending' || normalized === 'pendente') {
    return {
      label: 'Pendente',
      className:
        'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    };
  }
  return {
    label: 'Indefinido',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };
};

const clientTypeLabel = (type?: string) => {
  if (type === 'PF') return 'Pessoa Fisica';
  if (type === 'PJ') return 'Pessoa Juridica';
  if (type === 'EMPRESA_PARCEIRA') return 'Empresa Parceira';
  return type || '-';
};

const getDefaultRange = () => {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  return {
    from: format(from, 'yyyy-MM-dd'),
    to: format(now, 'yyyy-MM-dd'),
  };
};
export default function Relatorios() {
  const { toast } = useToast();
  const { isPaid, requirePaid } = usePaidAccess();
  const [periodPreset, setPeriodPreset] = useState('30');
  const [dateFrom, setDateFrom] = useState(() => getDefaultRange().from);
  const [dateTo, setDateTo] = useState(() => getDefaultRange().to);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [technicianFilter, setTechnicianFilter] = useState('all');
  const [clientTypeFilter, setClientTypeFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllResults, setSelectAllResults] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [attachPdf, setAttachPdf] = useState(true);
  const [attachExcel, setAttachExcel] = useState(false);
  const [whatsDialogOpen, setWhatsDialogOpen] = useState(false);
  const [whatsLinks, setWhatsLinks] = useState<string[]>([]);
  const [exporting, setExporting] = useState<null | 'pdf' | 'excel'>(null);
  const [sharing, setSharing] = useState<
    null | 'whatsapp' | 'email' | 'whatsapp-pdf' | 'whatsapp-image'
  >(null);
  const [printing, setPrinting] = useState(false);

  const range = useMemo(() => {
    let fromDate = parseDateInput(dateFrom) ?? new Date();
    let toDate = parseDateInput(dateTo, true) ?? new Date();

    if (!dateFrom && periodPreset !== 'custom') {
      const days = Number.parseInt(periodPreset, 10);
      if (!Number.isNaN(days)) {
        const now = new Date();
        fromDate = new Date(now);
        fromDate.setDate(fromDate.getDate() - days);
        fromDate.setHours(0, 0, 0, 0);
        toDate = new Date(now);
        toDate.setHours(23, 59, 59, 999);
      }
    }

    if (fromDate > toDate) {
      const temp = fromDate;
      fromDate = toDate;
      toDate = temp;
    }

    const from = format(fromDate, 'yyyy-MM-dd');
    const to = format(toDate, 'yyyy-MM-dd');

    return {
      from,
      to,
      fromQuery: fromDate.toISOString(),
      toQuery: toDate.toISOString(),
    };
  }, [dateFrom, dateTo, periodPreset]);

  const periodForDashboard = useMemo(() => {
    if (periodPreset !== 'custom') return periodPreset;
    const from = new Date(range.fromQuery);
    const to = new Date(range.toQuery);
    const diffDays = Math.max(
      1,
      Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
    );
    return String(diffDays);
  }, [periodPreset, range.from, range.to]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
    setSelectAllResults(false);
  }, [
    range.from,
    range.to,
    searchTerm,
    stateFilter,
    cityFilter,
    technicianFilter,
    clientTypeFilter,
    serviceFilter,
    statusFilter,
    paymentStatusFilter,
  ]);

  const handlePeriodChange = (value: string) => {
    setPeriodPreset(value);
    if (value === 'custom') return;
    const days = Number.parseInt(value, 10);
    if (Number.isNaN(days)) return;
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    setDateFrom(format(from, 'yyyy-MM-dd'));
    setDateTo(format(now, 'yyyy-MM-dd'));
  };

  const resetFilters = () => {
    handlePeriodChange('30');
    setSearchTerm('');
    setStateFilter('all');
    setCityFilter('all');
    setTechnicianFilter('all');
    setClientTypeFilter('all');
    setServiceFilter('all');
    setStatusFilter('all');
    setPaymentStatusFilter('all');
  };

  const reportsParams = (overridePage?: number, overrideLimit?: number) => {
    const params = new URLSearchParams();
    params.set('dateFrom', range.fromQuery);
    params.set('dateTo', range.toQuery);
    if (stateFilter !== 'all') params.set('state', stateFilter);
    if (cityFilter !== 'all') params.set('city', cityFilter);
    if (technicianFilter !== 'all') params.set('technician', technicianFilter);
    if (clientTypeFilter !== 'all') params.set('clientType', clientTypeFilter);
    if (serviceFilter !== 'all') params.set('service', serviceFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (paymentStatusFilter !== 'all')
      params.set('paymentStatus', paymentStatusFilter);
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    params.set('page', String(overridePage ?? page));
    params.set('limit', String(overrideLimit ?? limit));
    return params;
  };

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['/api/services'],
  });

  const { data: technicians = [] } = useQuery<Technician[]>({
    queryKey: ['/api/technicians'],
  });

  const reportsQuery = useQuery<ReportsResponse>({
    queryKey: [
      'reports',
      range.from,
      range.to,
      stateFilter,
      cityFilter,
      technicianFilter,
      clientTypeFilter,
      serviceFilter,
      statusFilter,
      paymentStatusFilter,
      searchTerm,
      page,
      limit,
    ],
    queryFn: async () => {
      const params = reportsParams();
      const response = await apiRequest(
        'GET',
        `/api/reports?${params.toString()}`,
        undefined
      );
      return response.json();
    },
  });

  const previewQuery = useQuery<ReportPreview>({
    queryKey: [
      'reports-preview',
      range.from,
      range.to,
      statusFilter,
      clientTypeFilter,
      searchTerm,
    ],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/reports/preview', {
        filters: {
          dateRange: { from: range.fromQuery, to: range.toQuery },
          status: statusFilter === 'all' ? [] : [statusFilter],
          clientType: clientTypeFilter === 'all' ? [] : [clientTypeFilter],
          searchTerm: searchTerm.trim(),
        },
      });
      return response.json();
    },
  });

  const advancedQuery = useQuery<AdvancedReportData>({
    queryKey: [
      'reports-advanced',
      range.from,
      range.to,
      stateFilter,
      technicianFilter,
      clientTypeFilter,
      serviceFilter,
      paymentStatusFilter,
    ],
    enabled: isPaid,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('startDate', range.fromQuery);
      params.set('endDate', range.toQuery);
      if (stateFilter !== 'all') params.set('state', stateFilter);
      if (technicianFilter !== 'all')
        params.set('technicianId', technicianFilter);
      if (clientTypeFilter !== 'all')
        params.set('clientType', clientTypeFilter);
      if (serviceFilter !== 'all') params.set('serviceId', serviceFilter);
      if (paymentStatusFilter !== 'all')
        params.set('paymentStatus', paymentStatusFilter);
      const response = await apiRequest(
        'GET',
        `/api/reports/advanced?${params.toString()}`,
        undefined
      );
      return response.json();
    },
  });

  const advancedLoading = isPaid && advancedQuery.isLoading;

  const { data: dashboardStats } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats', periodForDashboard],
  });

  const { data: kmMetrics } = useQuery<KmMetrics>({
    queryKey: ['/api/dashboard/km-metrics'],
  });

  const stateOptions = useMemo(() => {
    const unique = new Set<string>();
    clients.forEach((client) => {
      if (client.state) unique.add(client.state);
    });
    return Array.from(unique).sort();
  }, [clients]);

  const cityOptions = useMemo(() => {
    const unique = new Set<string>();
    clients
      .filter((client) => stateFilter === 'all' || client.state === stateFilter)
      .forEach((client) => {
        if (client.city) unique.add(client.city);
      });
    return Array.from(unique).sort();
  }, [clients, stateFilter]);

  const reports = reportsQuery.data?.data ?? [];
  const totalResults = reportsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, reportsQuery.data?.totalPages ?? 1);

  const pageIds = useMemo(() => reports.map((row) => row.id), [reports]);
  const allSelectedOnPage =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelectedOnPage =
    pageIds.some((id) => selectedIds.has(id)) && !allSelectedOnPage;

  const selectedCount = selectAllResults ? totalResults : selectedIds.size;
  const canActOnSelection = selectedCount > 0;

  const statusDistribution = useMemo(() => {
    const byStatus = previewQuery.data?.byStatus ?? {};
    const total = Object.values(byStatus).reduce((sum, value) => sum + value, 0);
    return Object.entries(byStatus)
      .map(([status, count]) => {
        const presentation = getStatusPresentation(status);
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return { label: presentation.label, count, pct };
      })
      .sort((a, b) => b.count - a.count);
  }, [previewQuery.data]);

  const activeFilters = useMemo(() => {
    const items: string[] = [];
    if (searchTerm.trim()) items.push(`Busca: ${searchTerm.trim()}`);
    if (stateFilter !== 'all') items.push(`Estado: ${stateFilter}`);
    if (cityFilter !== 'all') items.push(`Cidade: ${cityFilter}`);
    if (technicianFilter !== 'all') {
      const tech = technicians.find((t) => t.id === technicianFilter);
      const techName = tech
        ? [tech.firstName, tech.lastName].filter(Boolean).join(' ').trim() ||
          tech.email ||
          technicianFilter
        : technicianFilter;
      items.push(`Tecnico: ${techName}`);
    }
    if (clientTypeFilter !== 'all')
      items.push(`Tipo: ${clientTypeLabel(clientTypeFilter)}`);
    if (serviceFilter !== 'all') {
      const service = services.find((s) => s.id === serviceFilter);
      items.push(`Servico: ${service?.name || serviceFilter}`);
    }
    if (statusFilter !== 'all') {
      items.push(`Status: ${getStatusPresentation(statusFilter).label}`);
    }
    if (paymentStatusFilter !== 'all') {
      items.push(`Pagamento: ${getPaymentPresentation(paymentStatusFilter).label}`);
    }
    return items;
  }, [
    searchTerm,
    stateFilter,
    cityFilter,
    technicianFilter,
    clientTypeFilter,
    serviceFilter,
    statusFilter,
    paymentStatusFilter,
    technicians,
    services,
  ]);

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
    setSelectAllResults(false);
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSelectAllResults(false);
  };

  const resolveSelectedRows = async () => {
    if (selectAllResults) {
      return fetchAllReports();
    }
    if (selectedIds.size === 0) return [];
    const onPage = reports.filter((row) => selectedIds.has(row.id));
    if (onPage.length === selectedIds.size) return onPage;
    const allRows = await fetchAllReports();
    return allRows.filter((row) => selectedIds.has(row.id));
  };

  const resolveSelectedIds = async () => {
    if (selectAllResults) {
      const rows = await fetchAllReports();
      return rows.map((row) => row.id);
    }
    return Array.from(selectedIds);
  };

  const fetchAllReports = async () => {
    if (!totalResults) return [];
    const exportLimit = Math.min(MAX_EXPORT_LIMIT, totalResults);
    const params = reportsParams(1, exportLimit);
    const response = await apiRequest(
      'GET',
      `/api/reports?${params.toString()}`,
      undefined
    );
    const payload = (await response.json()) as ReportsResponse;
    if (totalResults > exportLimit) {
      toast({
        title: 'Exportacao parcial',
        description: `Foram carregados ${exportLimit} de ${totalResults} registros. Ajuste os filtros para reduzir o volume.`,
      });
    }
    return payload.data;
  };

  const buildReportFileName = (extension: 'pdf' | 'xlsx' | 'png') =>
    `relatorios-${range.from}-a-${range.to}.${extension}`;

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const buildPdfDoc = async (rows: ReportRow[]) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margin = 40;
    const rowHeight = 18;
    const columns = [
      { label: 'Chamado', width: 70, key: 'ticketNumber' },
      { label: 'Cliente', width: 150, key: 'clientName' },
      { label: 'Tecnico', width: 120, key: 'technicianName' },
      { label: 'Servico', width: 140, key: 'serviceName' },
      { label: 'Data', width: 80, key: 'scheduledDate' },
      { label: 'Status', width: 80, key: 'status' },
      { label: 'Valor', width: 80, key: 'amount' },
      { label: 'Pagamento', width: 80, key: 'paymentStatus' },
    ];

    const truncate = (value: string, max: number) => {
      if (value.length <= max) return value;
      return `${value.slice(0, Math.max(0, max - 3))}...`;
    };

    let y = margin;
    doc.setFontSize(16);
    doc.text('Relatorio de chamados', margin, y);
    y += 18;
    doc.setFontSize(10);
    doc.text(
      `Periodo: ${formatDateShort(range.from)} a ${formatDateShort(range.to)}`,
      margin,
      y
    );
    y += 16;

    const drawHeader = () => {
      doc.setFontSize(9);
      let x = margin;
      columns.forEach((column) => {
        doc.text(column.label, x, y);
        x += column.width;
      });
      y += rowHeight;
    };

    drawHeader();

    rows.forEach((row) => {
      if (y > 520) {
        doc.addPage();
        y = margin;
        drawHeader();
      }
      let x = margin;
      columns.forEach((column) => {
        let value = '';
        if (column.key === 'ticketNumber') {
          value = row.ticketNumber || row.id.slice(0, 8);
        } else if (column.key === 'scheduledDate') {
          value = formatDateShort(row.scheduledDate);
        } else if (column.key === 'status') {
          value = getStatusPresentation(row.status).label;
        } else if (column.key === 'paymentStatus') {
          value = getPaymentPresentation(row.paymentStatus).label;
        } else if (column.key === 'amount') {
          value = formatCurrency(row.amount);
        } else {
          value = String((row as any)[column.key] ?? '');
        }
        doc.text(truncate(value, 24), x, y);
        x += column.width;
      });
      y += rowHeight;
    });

    return doc;
  };

  const exportPdf = async (rows: ReportRow[]) => {
    const doc = await buildPdfDoc(rows);
    doc.save(buildReportFileName('pdf'));
  };

  const createPdfBlob = async (rows: ReportRow[]) => {
    const doc = await buildPdfDoc(rows);
    return doc.output('blob') as Blob;
  };

  const buildImageContainer = (rows: ReportRow[]) => {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '1100px';
    container.style.padding = '24px';
    container.style.background = '#ffffff';
    container.style.color = '#0f172a';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.boxSizing = 'border-box';

    const title = document.createElement('div');
    title.textContent = 'Relatorios';
    title.style.fontSize = '18px';
    title.style.fontWeight = '700';
    container.appendChild(title);

    const period = document.createElement('div');
    period.textContent = `Periodo: ${formatDateShort(range.from)} a ${formatDateShort(
      range.to
    )}`;
    period.style.fontSize = '12px';
    period.style.marginBottom = '16px';
    period.style.color = '#475569';
    container.appendChild(period);

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.tableLayout = 'fixed';
    table.style.fontSize = '12px';

    const headers = [
      'Chamado',
      'Cliente',
      'Tecnico',
      'Servico',
      'Data',
      'Status',
      'Valor',
      'Pagamento',
    ];
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach((text) => {
      const th = document.createElement('th');
      th.textContent = text;
      th.style.textAlign = 'left';
      th.style.padding = '6px 8px';
      th.style.borderBottom = '1px solid #e2e8f0';
      th.style.background = '#f8fafc';
      th.style.fontWeight = '600';
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      const cells = [
        row.ticketNumber || row.id.slice(0, 8),
        row.clientName,
        row.technicianName || '-',
        row.serviceName,
        formatDateShort(row.scheduledDate),
        getStatusPresentation(row.status).label,
        formatCurrency(row.amount),
        getPaymentPresentation(row.paymentStatus).label,
      ];
      cells.forEach((value) => {
        const td = document.createElement('td');
        td.textContent = value || '-';
        td.style.padding = '6px 8px';
        td.style.borderBottom = '1px solid #e2e8f0';
        td.style.verticalAlign = 'top';
        td.style.overflow = 'hidden';
        td.style.textOverflow = 'ellipsis';
        td.style.whiteSpace = 'nowrap';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);

    return container;
  };

  const createImageBlob = async (rows: ReportRow[]) => {
    const { default: html2canvas } = await import('html2canvas');
    const container = buildImageContainer(rows);
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
      });
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => {
          if (value) {
            resolve(value);
          } else {
            reject(new Error('Falha ao gerar imagem.'));
          }
        }, 'image/png');
      });
      return blob;
    } finally {
      document.body.removeChild(container);
    }
  };

  const exportExcel = async (rows: ReportRow[]) => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatorios');

    worksheet.columns = [
      { header: 'Chamado', key: 'ticketNumber', width: 18 },
      { header: 'Cliente', key: 'clientName', width: 28 },
      { header: 'Tipo', key: 'clientType', width: 18 },
      { header: 'Tecnico', key: 'technicianName', width: 22 },
      { header: 'Servico', key: 'serviceName', width: 26 },
      { header: 'Data', key: 'scheduledDate', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Valor', key: 'amount', width: 14 },
      { header: 'Pagamento', key: 'paymentStatus', width: 14 },
      { header: 'Vencimento', key: 'dueDate', width: 14 },
      { header: 'Estado', key: 'state', width: 10 },
      { header: 'Cidade', key: 'city', width: 18 },
    ];

    rows.forEach((row) => {
      worksheet.addRow({
        ticketNumber: row.ticketNumber || row.id,
        clientName: row.clientName,
        clientType: clientTypeLabel(row.clientType),
        technicianName: row.technicianName,
        serviceName: row.serviceName,
        scheduledDate: formatDateShort(row.scheduledDate),
        status: getStatusPresentation(row.status).label,
        amount: toNumber(row.amount),
        paymentStatus: getPaymentPresentation(row.paymentStatus).label,
        dueDate: formatDateShort(row.dueDate || ''),
        state: row.state,
        city: row.city,
      });
    });

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    worksheet.getColumn('amount').numFmt = '"R$" #,##0.00';

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlob(blob, buildReportFileName('xlsx'));
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (
      !requirePaid({
        feature: 'Exportacao de relatorios',
        description: 'Exportacoes estao disponiveis apenas na versao paga.',
      })
    ) {
      return;
    }
    if (!canActOnSelection) {
      toast({
        title: 'Selecione registros',
        description: 'Escolha um ou mais registros para exportar.',
      });
      return;
    }
    setExporting(format);
    try {
      const rows = await resolveSelectedRows();
      if (!rows.length) {
        toast({
          title: 'Nenhum registro encontrado',
          description: 'A selecao atual nao retornou dados para exportacao.',
        });
        return;
      }
      if (format === 'pdf') {
        await exportPdf(rows);
      } else {
        await exportExcel(rows);
      }
      toast({
        title: 'Exportacao concluida',
        description: `Arquivo ${format.toUpperCase()} gerado com sucesso.`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao exportar',
        description: 'Nao foi possivel gerar o arquivo. Tente novamente.',
      });
    } finally {
      setExporting(null);
    }
  };

  const openWhatsAppShare = (message: string) => {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const shareFileViaSystem = async (file: File, message: string) => {
    const canShareFiles =
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] });

    if (!canShareFiles) return 'fallback';

    try {
      await navigator.share({
        title: 'Relatorios',
        text: message,
        files: [file],
      });
      return 'shared';
    } catch (error) {
      const cancelled =
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        (error as { name?: string }).name === 'AbortError';
      return cancelled ? 'cancelled' : 'fallback';
    }
  };

  const handleShareWhatsAppFile = async (format: 'pdf' | 'image') => {
    if (
      !requirePaid({
        feature: 'Envio por WhatsApp',
        description: 'Envios por WhatsApp estao disponiveis apenas na versao paga.',
      })
    ) {
      return;
    }
    if (!canActOnSelection) {
      toast({
        title: 'Selecione registros',
        description: 'Escolha um ou mais registros para compartilhar.',
      });
      return;
    }
    const shareKey = format === 'pdf' ? 'whatsapp-pdf' : 'whatsapp-image';
    setSharing(shareKey);
    try {
      const rows = await resolveSelectedRows();
      if (!rows.length) {
        toast({
          title: 'Nenhum registro encontrado',
          description: 'Nao ha registros para compartilhar.',
        });
        return;
      }
      const fileName =
        format === 'pdf'
          ? buildReportFileName('pdf')
          : buildReportFileName('png');
      const blob =
        format === 'pdf' ? await createPdfBlob(rows) : await createImageBlob(rows);
      const file = new File([blob], fileName, {
        type: format === 'pdf' ? 'application/pdf' : 'image/png',
      });
      const message =
        format === 'pdf'
          ? 'Segue o relatorio em PDF.'
          : 'Segue o relatorio em imagem.';
      const shareResult = await shareFileViaSystem(file, message);
      if (shareResult === 'shared') {
        toast({
          title: 'Compartilhamento iniciado',
          description: 'Selecione o WhatsApp para enviar o arquivo.',
        });
        return;
      }
      if (shareResult === 'cancelled') return;
      downloadBlob(blob, fileName);
      openWhatsAppShare(message);
      toast({
        title: 'Arquivo pronto',
        description: 'Baixe o arquivo e anexe no WhatsApp.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao compartilhar',
        description: 'Nao foi possivel gerar o arquivo.',
      });
    } finally {
      setSharing(null);
    }
  };

  const handlePrint = async () => {
    if (
      !requirePaid({
        feature: 'Impressao de relatorios',
        description: 'Impressao e PDF estao disponiveis apenas na versao paga.',
      })
    ) {
      return;
    }
    if (!canActOnSelection) {
      toast({
        title: 'Selecione registros',
        description: 'Escolha um ou mais registros para imprimir.',
      });
      return;
    }
    setPrinting(true);
    try {
      const rows = await resolveSelectedRows();
      if (!rows.length) {
        toast({
          title: 'Nenhum registro encontrado',
          description: 'Nao ha registros para imprimir.',
        });
        return;
      }
      const doc = await buildPdfDoc(rows);
      if (typeof (doc as any).autoPrint === 'function') {
        (doc as any).autoPrint();
      }
      const blobUrl = doc.output('bloburl');
      const printWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
      if (!printWindow) {
        toast({
          title: 'Popup bloqueado',
          description: 'Libere popups para imprimir.',
        });
        return;
      }
      const tryPrint = () => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch (error) {}
      };
      printWindow.onload = tryPrint;
      window.setTimeout(tryPrint, 700);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (error) {
      toast({
        title: 'Erro ao imprimir',
        description: 'Nao foi possivel gerar a impressao.',
      });
    } finally {
      setPrinting(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (
      !requirePaid({
        feature: 'Envio por WhatsApp',
        description: 'Envios por WhatsApp estao disponiveis apenas na versao paga.',
      })
    ) {
      return;
    }
    if (!canActOnSelection) {
      toast({
        title: 'Selecione registros',
        description: 'Escolha um ou mais registros para compartilhar.',
      });
      return;
    }
    setSharing('whatsapp');
    try {
      const ids = await resolveSelectedIds();
      if (!ids.length) {
        toast({
          title: 'Nenhum registro encontrado',
          description: 'Nao ha registros para compartilhar.',
        });
        return;
      }
      const response = await apiRequest('POST', '/api/reports/send-whatsapp', {
        ids,
        mode: 'click-to-chat',
        templateId: 'default',
      });
      const payload = await response.json();
      const urls = payload?.urls || [];
      if (!urls.length) {
        toast({
          title: 'Nenhum contato encontrado',
          description: 'Nao foi possivel gerar links de WhatsApp.',
        });
        return;
      }
      setWhatsLinks(urls);
      setWhatsDialogOpen(true);
    } catch (error) {
      toast({
        title: 'Erro ao compartilhar',
        description: 'Nao foi possivel gerar os links de WhatsApp.',
      });
    } finally {
      setSharing(null);
    }
  };

  const handleOpenEmail = () => {
    if (!canActOnSelection) {
      toast({
        title: 'Selecione registros',
        description: 'Escolha um ou mais registros para enviar por email.',
      });
      return;
    }
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    const recipients = emailRecipients
      .split(/[\n,;\s]+/)
      .map((email) => email.trim())
      .filter(Boolean);

    if (!recipients.length) {
      toast({
        title: 'Informe os destinatarios',
        description: 'Adicione ao menos um email valido para envio.',
      });
      return;
    }

    setSharing('email');
    try {
      const ids = await resolveSelectedIds();
      if (!ids.length) {
        toast({
          title: 'Nenhum registro encontrado',
          description: 'Nao ha registros para enviar.',
        });
        return;
      }
      const attachFormats = [];
      if (attachPdf) attachFormats.push('pdf');
      if (attachExcel) attachFormats.push('excel');

      await apiRequest('POST', '/api/reports/send-email', {
        ids,
        recipients,
        attachFormats,
        templateId: 'default',
        filters: {
          dateFrom: range.from,
          dateTo: range.to,
          state: stateFilter,
          city: cityFilter,
          technician: technicianFilter,
          clientType: clientTypeFilter,
          service: serviceFilter,
          status: statusFilter,
          paymentStatus: paymentStatusFilter,
          search: searchTerm.trim(),
        },
      });

      toast({
        title: 'Email enviado',
        description: 'O envio foi enfileirado com sucesso.',
      });
      setEmailDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Erro ao enviar email',
        description: 'Nao foi possivel enviar. Tente novamente.',
      });
    } finally {
      setSharing(null);
    }
  };

  const reportPresets = [
    {
      id: 'operacional',
      title: 'Operacional',
      description: 'SLA, TMR e ocupacao por periodo.',
      icon: BarChart3,
      tag: 'Qualidade',
      onApply: () => {
        handlePeriodChange('30');
        setStatusFilter('all');
        setPaymentStatusFilter('all');
      },
    },
    {
      id: 'financeiro',
      title: 'Recebiveis em atraso',
      description: 'Foco em pendencias vencidas.',
      icon: Wallet,
      tag: 'Financeiro',
      onApply: () => {
        handlePeriodChange('90');
        setPaymentStatusFilter('overdue');
      },
    },
    {
      id: 'clientes',
      title: 'Clientes estrategicos',
      description: 'Base PJ e empresas parceiras.',
      icon: Users,
      tag: 'Clientes',
      onApply: () => {
        handlePeriodChange('180');
        setClientTypeFilter('EMPRESA_PARCEIRA');
      },
    },
    {
      id: 'km',
      title: 'Deslocamento e KM',
      description: 'Lucro e custos do deslocamento.',
      icon: Truck,
      tag: 'KM',
      onApply: () => {
        handlePeriodChange('30');
      },
    },
  ];
  return (
    <div className='space-y-8 p-4 sm:p-6 bg-slate-50 dark:bg-[#0b1120] min-h-full'>
      <PageHeader>
        <div className='px-4 sm:px-6'>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='space-y-1'>
              <h1 className='text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white'>
                Relatorios
              </h1>
              <p className='text-slate-500 dark:text-slate-400 text-sm'>
                Analise desempenho, custos e resultados com dados conectados.
              </p>
            </div>
          </div>
        </div>
      </PageHeader>

      <div className='grid grid-cols-1 lg:grid-cols-12 gap-6'>
        <aside className='lg:col-span-3'>
          <Card className='border-slate-200 dark:border-slate-800'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base flex items-center gap-2'>
                <CalendarIcon className='h-4 w-4 text-primary' />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-1.5'>
                <label className='text-xs font-semibold uppercase tracking-widest text-slate-500'>
                  Pesquisa
                </label>
                <Input
                  placeholder='Cliente, chamado, servico...'
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-semibold uppercase tracking-widest text-slate-500'>
                  Periodo
                </label>
                <Select value={periodPreset} onValueChange={handlePeriodChange}>
                  <SelectTrigger className='h-10'>
                    <SelectValue placeholder='Selecione' />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className='grid grid-cols-2 gap-2'>
                  <Input
                    type='date'
                    value={dateFrom}
                    onChange={(event) => {
                      setDateFrom(event.target.value);
                      setPeriodPreset('custom');
                    }}
                  />
                  <Input
                    type='date'
                    value={dateTo}
                    onChange={(event) => {
                      setDateTo(event.target.value);
                      setPeriodPreset('custom');
                    }}
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-semibold uppercase tracking-widest text-slate-500'>
                  Estado
                </label>
                <Select
                  value={stateFilter}
                  onValueChange={(value) => {
                    setStateFilter(value);
                    setCityFilter('all');
                  }}
                >
                  <SelectTrigger className='h-10'>
                    <SelectValue placeholder='Todos' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todos</SelectItem>
                    {stateOptions.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-semibold uppercase tracking-widest text-slate-500'>
                  Cidade
                </label>
                <Select
                  value={cityFilter}
                  onValueChange={setCityFilter}
                  disabled={cityOptions.length === 0}
                >
                  <SelectTrigger className='h-10'>
                    <SelectValue placeholder='Todas' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todas</SelectItem>
                    {cityOptions.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-semibold uppercase tracking-widest text-slate-500'>
                  Tecnico
                </label>
                <Select
                  value={technicianFilter}
                  onValueChange={setTechnicianFilter}
                >
                  <SelectTrigger className='h-10'>
                    <SelectValue placeholder='Todos' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todos</SelectItem>
                    {technicians.map((tech) => {
                      const name =
                        [tech.firstName, tech.lastName]
                          .filter(Boolean)
                          .join(' ')
                          .trim() || tech.email || tech.id;
                      return (
                        <SelectItem key={tech.id} value={tech.id}>
                          {name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-semibold uppercase tracking-widest text-slate-500'>
                  Tipo de cliente
                </label>
                <Select
                  value={clientTypeFilter}
                  onValueChange={setClientTypeFilter}
                >
                  <SelectTrigger className='h-10'>
                    <SelectValue placeholder='Todos' />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-semibold uppercase tracking-widest text-slate-500'>
                  Servico
                </label>
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger className='h-10'>
                    <SelectValue placeholder='Todos' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todos</SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-semibold uppercase tracking-widest text-slate-500'>
                  Status do chamado
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className='h-10'>
                    <SelectValue placeholder='Todos' />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-semibold uppercase tracking-widest text-slate-500'>
                  Status de pagamento
                </label>
                <Select
                  value={paymentStatusFilter}
                  onValueChange={setPaymentStatusFilter}
                >
                  <SelectTrigger className='h-10'>
                    <SelectValue placeholder='Todos' />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button variant='outline' className='w-full' onClick={resetFilters}>
                Limpar filtros
              </Button>
            </CardContent>
          </Card>
        </aside>

        <section className='lg:col-span-9 space-y-6'>
          <Card className='border-slate-200 dark:border-slate-800'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-lg font-semibold'>
                Resumo do periodo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(advancedLoading || previewQuery.isLoading) && (
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  {[1, 2, 3].map((index) => (
                    <Skeleton key={index} className='h-[110px] rounded-xl' />
                  ))}
                </div>
              )}
              {!advancedLoading && !previewQuery.isLoading && (
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <StatCard
                    title='SLA'
                    value={
                      isPaid
                        ? `${toNumber(
                            advancedQuery.data?.slaCompliance
                          ).toFixed(1)}%`
                        : '--'
                    }
                    hint={
                      isPaid
                        ? 'Chamados concluidos no periodo'
                        : 'Disponivel no plano pago'
                    }
                    icon={CheckCircle2}
                    tone='emerald'
                  />
                  <StatCard
                    title='TMR'
                    value={
                      isPaid
                        ? formatDuration(
                            toNumber(advancedQuery.data?.averageResponseTime)
                          )
                        : '--'
                    }
                    hint={
                      isPaid
                        ? 'Tempo medio de resposta'
                        : 'Disponivel no plano pago'
                    }
                    icon={Clock}
                    tone='blue'
                  />
                  <StatCard
                    title='Ocupacao'
                    value={
                      isPaid
                        ? `${toNumber(
                            advancedQuery.data?.occupancyRate
                          ).toFixed(0)}%`
                        : '--'
                    }
                    hint={
                      isPaid
                        ? 'Horas atendidas vs disponiveis'
                        : 'Disponivel no plano pago'
                    }
                    icon={BarChart3}
                    tone='amber'
                  />
                </div>
              )}

              <div className='mt-6 grid grid-cols-1 md:grid-cols-3 gap-4'>
                <StatCard
                  title='Chamados no periodo'
                  value={String(previewQuery.data?.total || 0)}
                  hint={`Periodo: ${formatDateShort(range.from)} a ${formatDateShort(
                    range.to
                  )}`}
                  icon={ListChecks}
                  tone='indigo'
                />
                <StatCard
                  title='Valor total'
                  value={formatCurrency(previewQuery.data?.totalValue || 0)}
                  hint='Soma dos valores filtrados'
                  icon={Wallet}
                  tone='emerald'
                />
                <StatCard
                  title='Ticket medio'
                  value={formatCurrency(
                    previewQuery.data?.total
                      ? (previewQuery.data.totalValue || 0) /
                          previewQuery.data.total
                      : 0
                  )}
                  hint='Media por chamado no periodo'
                  icon={TrendingUp}
                  tone='violet'
                />
              </div>
            </CardContent>
          </Card>

          <Card className='border-slate-200 dark:border-slate-800'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-lg font-semibold'>
                Relatorios recomendados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4'>
                {reportPresets.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <div
                      key={preset.id}
                      className='rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3'
                    >
                      <div className='flex items-center gap-3'>
                        <div className='h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center'>
                          <Icon className='h-5 w-5 text-primary' />
                        </div>
                        <div>
                          <p className='text-sm font-semibold text-slate-900 dark:text-white'>
                            {preset.title}
                          </p>
                          <p className='text-xs text-slate-500 dark:text-slate-400'>
                            {preset.description}
                          </p>
                        </div>
                      </div>
                      <div className='flex items-center justify-between'>
                        <Badge variant='outline' className='text-[10px]'>
                          {preset.tag}
                        </Badge>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='text-xs'
                          onClick={preset.onApply}
                        >
                          Aplicar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className='border-slate-200 dark:border-slate-800'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-lg font-semibold'>
                Insights rapidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <p className='text-sm font-semibold'>Status dos chamados</p>
                    <span className='text-xs text-slate-500'>
                      {previewQuery.data?.total || 0} chamados
                    </span>
                  </div>
                  {previewQuery.isLoading && (
                    <div className='space-y-2'>
                      {[1, 2, 3].map((index) => (
                        <Skeleton key={index} className='h-6 rounded-md' />
                      ))}
                    </div>
                  )}
                  {!previewQuery.isLoading && statusDistribution.length === 0 && (
                    <p className='text-xs text-slate-500'>
                      Sem dados para o periodo selecionado.
                    </p>
                  )}
                  {!previewQuery.isLoading &&
                    statusDistribution.map((item) => (
                      <div key={item.label} className='space-y-1'>
                        <div className='flex items-center justify-between text-xs'>
                          <span className='font-medium'>{item.label}</span>
                          <span className='text-slate-500'>
                            {item.count} ({item.pct}%)
                          </span>
                        </div>
                        <div className='h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden'>
                          <div
                            className='h-full bg-primary/70'
                            style={{ width: `${item.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>

                <div className='space-y-3'>
                  <p className='text-sm font-semibold'>
                    Indicadores do painel (mes atual)
                  </p>
                  <div className='space-y-2 text-xs text-slate-600 dark:text-slate-300'>
                    <div className='flex items-center justify-between'>
                      <span>Chamados abertos</span>
                      <span className='font-semibold'>
                        {dashboardStats?.chamadosEmAberto ?? 0}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span>Concluidos no mes</span>
                      <span className='font-semibold'>
                        {dashboardStats?.completedThisMonth ?? 0}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span>Cancelados no mes</span>
                      <span className='font-semibold'>
                        {dashboardStats?.cancelledThisMonth ?? 0}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span>Faturamento estimado</span>
                      <span className='font-semibold'>
                        {formatCurrency(dashboardStats?.faturamentoEstimado ?? 0)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span>Ticket medio</span>
                      <span className='font-semibold'>
                        {formatCurrency(dashboardStats?.ticketMedio ?? 0)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span>R$ por hora</span>
                      <span className='font-semibold'>
                        {formatCurrency(dashboardStats?.revenuePerHourAvg ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className='space-y-3'>
                  <p className='text-sm font-semibold'>KM e recebiveis</p>
                  <div className='space-y-2 text-xs text-slate-600 dark:text-slate-300'>
                    <div className='flex items-center justify-between'>
                      <span>Lucro com KM</span>
                      <span className='font-semibold'>
                        {formatCurrency(kmMetrics?.lucroKm ?? 0)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span>Total KM</span>
                      <span className='font-semibold'>
                        {toNumber(kmMetrics?.totalKm).toFixed(1)} km
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span>Gastos estimados</span>
                      <span className='font-semibold'>
                        {formatCurrency(kmMetrics?.gastosKm ?? 0)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span>Pendencias vencidas</span>
                      <span className='font-semibold flex items-center gap-1'>
                        <AlertTriangle className='h-3 w-3 text-red-500' />
                        {dashboardStats?.pendenciasVencidas ?? 0}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span>A receber vencido</span>
                      <span className='font-semibold'>
                        {formatCurrency(dashboardStats?.aReceberVencido ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className='border-slate-200 dark:border-slate-800'>
            <CardHeader className='pb-3 space-y-3'>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                  <CardTitle className='text-lg font-semibold'>
                    Resultados
                  </CardTitle>
                  <p className='text-xs text-slate-500'>
                    Mostrando {reports.length} de {totalResults} registros
                  </p>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant='outline'
                        disabled={
                          !canActOnSelection ||
                          exporting !== null ||
                          sharing !== null ||
                          printing
                        }
                        className='gap-2'
                      >
                        <Download className='h-4 w-4' />
                        Exportar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      <DropdownMenuItem onSelect={() => handleExport('pdf')}>
                        <FileText className='h-4 w-4 mr-2' />
                        PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleExport('excel')}>
                        <FileSpreadsheet className='h-4 w-4 mr-2' />
                        Excel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant='outline'
                    onClick={handlePrint}
                    disabled={
                      !canActOnSelection ||
                      exporting !== null ||
                      sharing !== null ||
                      printing
                    }
                    className='gap-2'
                  >
                    <Printer className='h-4 w-4' />
                    {printing ? 'Imprimindo...' : 'Imprimir'}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant='secondary'
                        disabled={
                          !canActOnSelection ||
                          sharing !== null ||
                          exporting !== null ||
                          printing
                        }
                        className='gap-2'
                      >
                        <MessageCircle className='h-4 w-4' />
                        Compartilhar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      <DropdownMenuItem
                        onSelect={() => handleShareWhatsAppFile('pdf')}
                      >
                        <FileText className='h-4 w-4 mr-2' />
                        WhatsApp (PDF)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => handleShareWhatsAppFile('image')}
                      >
                        <Image className='h-4 w-4 mr-2' />
                        WhatsApp (Imagem)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleShareWhatsApp}>
                        <MessageCircle className='h-4 w-4 mr-2' />
                        WhatsApp (Mensagem)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleOpenEmail}>
                        <Mail className='h-4 w-4 mr-2' />
                        Email
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className='flex flex-wrap items-center gap-3'>
                  <div className='flex items-center gap-2 text-xs'>
                    <Checkbox
                      checked={selectAllResults}
                      onCheckedChange={(checked) =>
                        setSelectAllResults(Boolean(checked))
                      }
                      disabled={totalResults === 0}
                    />
                    <span>Selecionar todos ({totalResults})</span>
                  </div>
                  <Badge variant='secondary'>{selectedCount} selecionado(s)</Badge>
                  <Select
                    value={String(limit)}
                    onValueChange={(value) => {
                      setLimit(Number.parseInt(value, 10));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className='h-9 w-[110px]'>
                      <SelectValue placeholder='Linhas' />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50].map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size} linhas
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {activeFilters.length > 0 && (
                <div className='flex flex-wrap gap-2'>
                  {activeFilters.map((filter) => (
                    <Badge key={filter} variant='outline'>
                      {filter}
                    </Badge>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-10'>
                        <Checkbox
                          checked={
                            allSelectedOnPage
                              ? true
                              : someSelectedOnPage
                              ? 'indeterminate'
                              : false
                          }
                          onCheckedChange={toggleSelectAllOnPage}
                        />
                      </TableHead>
                      <TableHead>Chamado</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tecnico</TableHead>
                      <TableHead>Servico</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Vencimento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportsQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={10}>
                          <div className='space-y-2 py-6'>
                            {[1, 2, 3, 4].map((index) => (
                              <Skeleton key={index} className='h-8 w-full' />
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {!reportsQuery.isLoading && reports.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className='text-center py-10'>
                          <p className='text-sm text-slate-500'>
                            Nenhum dado encontrado para os filtros atuais.
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                    {!reportsQuery.isLoading &&
                      reports.map((row) => {
                        const status = getStatusPresentation(row.status);
                        const payment = getPaymentPresentation(
                          row.paymentStatus
                        );
                        return (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(row.id)}
                                onCheckedChange={() => toggleSelectOne(row.id)}
                              />
                            </TableCell>
                            <TableCell className='font-mono text-xs'>
                              #{row.ticketNumber || row.id.slice(0, 8)}
                            </TableCell>
                            <TableCell>
                              <div className='min-w-[160px]'>
                                <p className='font-medium text-slate-900 dark:text-white'>
                                  {row.clientName}
                                </p>
                                <p className='text-xs text-slate-500'>
                                  {clientTypeLabel(row.clientType)}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className='text-sm'>
                              {row.technicianName || '-'}
                            </TableCell>
                            <TableCell className='text-sm'>
                              {row.serviceName || '-'}
                            </TableCell>
                            <TableCell className='text-sm'>
                              {formatDateShort(row.scheduledDate)}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn('text-xs', status.className)}>
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className='text-sm font-semibold'>
                              {formatCurrency(row.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn('text-xs', payment.className)}>
                                {payment.label}
                              </Badge>
                            </TableCell>
                            <TableCell className='text-sm'>
                              {formatDateShort(row.dueDate || '')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>

              <div className='flex flex-col sm:flex-row items-center justify-between gap-3 pt-4'>
                <p className='text-xs text-slate-500'>
                  Pagina {page} de {totalPages}
                </p>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={page >= totalPages}
                    onClick={() =>
                      setPage((prev) => Math.min(totalPages, prev + 1))
                    }
                  >
                    Proximo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className='sm:max-w-[520px]'>
          <DialogHeader>
            <DialogTitle>Enviar por email</DialogTitle>
            <DialogDescription className='sr-only'>
              Configure destinatarios e anexos para envio.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-1.5'>
              <label className='text-xs font-semibold uppercase tracking-widest text-slate-500'>
                Destinatarios
              </label>
              <Input
                placeholder='financeiro@cliente.com, equipe@empresa.com'
                value={emailRecipients}
                onChange={(event) => setEmailRecipients(event.target.value)}
              />
              <p className='text-xs text-slate-500'>
                Separe por virgula, espaco ou nova linha.
              </p>
            </div>

            <div className='space-y-2'>
              <p className='text-xs font-semibold uppercase tracking-widest text-slate-500'>
                Anexos
              </p>
              <div className='flex flex-col gap-2 text-sm'>
                <label className='flex items-center gap-2'>
                  <Checkbox
                    checked={attachPdf}
                    onCheckedChange={(checked) => setAttachPdf(Boolean(checked))}
                  />
                  <span>PDF com resumo e detalhes</span>
                </label>
                <label className='flex items-center gap-2'>
                  <Checkbox
                    checked={attachExcel}
                    onCheckedChange={(checked) =>
                      setAttachExcel(Boolean(checked))
                    }
                  />
                  <span>Excel com linhas filtradas</span>
                </label>
              </div>
              <p className='text-xs text-slate-500'>
                Selecione os anexos desejados antes do envio.
              </p>
            </div>

            <div className='rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300'>
              <p>
                Selecao atual:{' '}
                {selectAllResults
                  ? `${totalResults} registros`
                  : `${selectedCount} registros`}
              </p>
              <p>
                Periodo: {formatDateShort(range.from)} a{' '}
                {formatDateShort(range.to)}
              </p>
            </div>
          </div>
          <DialogFooter className='gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setEmailDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleSendEmail} disabled={sharing === 'email'}>
              {sharing === 'email' ? 'Enviando...' : 'Enviar email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={whatsDialogOpen}
        onOpenChange={(open) => {
          setWhatsDialogOpen(open);
          if (!open) setWhatsLinks([]);
        }}
      >
        <DialogContent className='sm:max-w-[560px]'>
          <DialogHeader>
            <DialogTitle>Links do WhatsApp</DialogTitle>
            <DialogDescription className='sr-only'>
              Links para envio via WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <p className='text-sm text-slate-600 dark:text-slate-300'>
              Copie ou abra os links para enviar a cobranca aos clientes
              selecionados.
            </p>
            <div className='space-y-2 max-h-60 overflow-y-auto pr-1'>
              {whatsLinks.length === 0 && (
                <p className='text-xs text-slate-500'>
                  Nenhum link foi gerado.
                </p>
              )}
              {whatsLinks.map((link, index) => (
                <div
                  key={`${link}-${index}`}
                  className='flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40'
                >
                  <span className='text-xs font-mono text-slate-600 dark:text-slate-300 truncate'>
                    {link}
                  </span>
                  <Button asChild size='sm' variant='outline'>
                    <a href={link} target='_blank' rel='noreferrer'>
                      Abrir
                    </a>
                  </Button>
                </div>
              ))}
            </div>
            <p className='text-xs text-slate-500'>
              A mensagem sera preenchida automaticamente no WhatsApp.
            </p>
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setWhatsDialogOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type StatCardProps = {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: 'emerald' | 'blue' | 'amber' | 'indigo' | 'violet' | 'slate';
};

const TONE_STYLES: Record<
  NonNullable<StatCardProps['tone']>,
  { wrapper: string; icon: string }
> = {
  emerald: {
    wrapper:
      'border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/10',
    icon: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  blue: {
    wrapper:
      'border-blue-200/70 bg-blue-50/60 dark:border-blue-500/20 dark:bg-blue-500/10',
    icon: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300',
  },
  amber: {
    wrapper:
      'border-amber-200/70 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/10',
    icon:
      'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300',
  },
  indigo: {
    wrapper:
      'border-indigo-200/70 bg-indigo-50/60 dark:border-indigo-500/20 dark:bg-indigo-500/10',
    icon:
      'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300',
  },
  violet: {
    wrapper:
      'border-violet-200/70 bg-violet-50/60 dark:border-violet-500/20 dark:bg-violet-500/10',
    icon:
      'bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300',
  },
  slate: {
    wrapper:
      'border-slate-200/70 bg-white/80 dark:border-slate-700 dark:bg-slate-900/40',
    icon:
      'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  },
};

const StatCard = ({ title, value, hint, icon: Icon, tone = 'slate' }: StatCardProps) => {
  const styles = TONE_STYLES[tone] ?? TONE_STYLES.slate;

  return (
    <div
      className={cn(
        'rounded-xl border p-4 flex flex-col gap-3',
        styles.wrapper
      )}
    >
      <div className='flex items-center justify-between'>
        <p className='text-xs font-semibold uppercase tracking-widest text-slate-500'>
          {title}
        </p>
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full',
            styles.icon
          )}
        >
          <Icon className='h-4 w-4' />
        </span>
      </div>
      <div>
        <p className='text-2xl font-bold text-slate-900 dark:text-white'>
          {value}
        </p>
        <p className='text-xs text-slate-500'>{hint}</p>
      </div>
    </div>
  );
};
