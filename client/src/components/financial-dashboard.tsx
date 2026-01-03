import { useMemo, useState, type MouseEvent } from 'react';
import {
  CheckCircle2,
  Clock,
  Clock3,
  DollarSign,
  MessageCircle,
  TrendingUp,
  AlertTriangle,
  FileText,
  X,
  Receipt,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePaidAccess } from '@/hooks/use-paid-access';
import { unmaskPhone } from '@/lib/masks';
import {
  differenceInMinutes,
  differenceInCalendarDays,
  format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Receivable {
  id: string;
  clientName: string;
  amount: number;
  dueDate: Date;
  status: 'pending' | 'overdue' | 'paid';
}

interface FinancialDashboardProps {
  cashFlowData: { date: string; value: number }[];
  receivables: Receivable[];
  loading: boolean;
  summaryOverrides: {
    receivedThisMonth: number;
    toReceiveTotal: number;
    pendingThisMonth: number;
    billingThisMonth: number;
  };
  completedTickets: any[];
}

const statusConfig = {
  pending: { label: 'Pendente', variant: 'outline' as const },
  overdue: { label: 'Atrasado', variant: 'destructive' as const },
  paid: { label: 'Pago', variant: 'secondary' as const },
};

const normalizeStatus = (status: string) => (status || '').trim().toUpperCase();

export function FinancialDashboard({
  cashFlowData,
  receivables,
  loading,
  summaryOverrides,
  completedTickets = [],
}: FinancialDashboardProps) {
  const [showBillingDetail, setShowBillingDetail] = useState(false);
  const { requirePaid } = usePaidAccess();
  const [selectedBilling, setSelectedBilling] = useState<Set<string>>(
    new Set()
  );
  const [billingClientFilter, setBillingClientFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const calcHours = (start: string, end: string) => {
    if (start && end) {
      const minutes = differenceInMinutes(new Date(end), new Date(start));
      return (minutes / 60).toFixed(2);
    }
    return '0.00';
  };

  // mtricas principais
  const totalReceivables =
    summaryOverrides.toReceiveTotal ??
    receivables
      .filter((r) => r.status !== 'paid')
      .reduce((sum, r) => sum + r.amount, 0);

  const totalPaid =
    summaryOverrides.receivedThisMonth ??
    receivables
      .filter((r) => r.status === 'paid')
      .reduce((sum, r) => sum + r.amount, 0);

  const totalPending =
    summaryOverrides.pendingThisMonth ??
    receivables
      .filter((r) => r.status === 'pending')
      .reduce((sum, r) => sum + r.amount, 0);

  const totalBilling =
    summaryOverrides.billingThisMonth ??
    cashFlowData[cashFlowData.length - 1]?.value ??
    0;

  const faturamento = totalBilling || totalPaid + totalPending;
  const recebidoPct =
    faturamento > 0
      ? Math.min(100, Math.round((totalPaid / faturamento) * 100))
      : 0;
  const pendentePct =
    faturamento > 0
      ? Math.min(100, Math.round((totalPending / faturamento) * 100))
      : 0;

  const completedCards = useMemo(
    () =>
      (completedTickets || []).filter((t) => {
        const st = normalizeStatus(t.status);
        return st === 'COMPLETED' || st === 'CONCLUIDO' || st === 'CONCLUIDO';
      }),
    [completedTickets]
  );

  const billingClients = useMemo(() => {
    const set = new Set<string>();
    completedCards.forEach((t: any) => {
      if (t.client.name) set.add(t.client.name);
    });
    return Array.from(set).sort();
  }, [completedCards]);

  const filteredBillingCards = useMemo(() => {
    if (billingClientFilter === 'all') return completedCards;
    return completedCards.filter(
      (t: any) => t.client.name === billingClientFilter
    );
  }, [completedCards, billingClientFilter]);

  const receivableBuckets = useMemo(() => {
    const today = new Date();
    let vencido = 0;
    let ate7 = 0;
    let ate30 = 0;
    receivables.forEach((r) => {
      if (r.status === 'paid') return;
      const days = differenceInCalendarDays(r.dueDate, today);
      if (days < 0) vencido += r.amount;
      else if (days <= 7) ate7 += r.amount;
      else if (days <= 30) ate30 += r.amount;
    });
    return { vencido, ate7, ate30 };
  }, [receivables]);

  const topPendencias = useMemo(() => {
    const map = new Map<string, number>();
    receivables.forEach((r) => {
      if (r.status === 'paid') return;
      map.set(r.clientName, (map.get(r.clientName) ?? 0) + r.amount);
    });
    return Array.from(map.entries())
      .map(([clientName, total]) => ({ clientName, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [receivables]);

  const renderBillingCard = (t: any) => {
    const base = t.ticketValue
      ? Number(t.ticketValue)
      : Number(t.service?.price || 0);
    const km = t.kmRate && t.kmTotal ? Number(t.kmRate) * Number(t.kmTotal) : 0;
    const extras = t.extraExpenses ? Number(t.extraExpenses) : 0;
    const total = t.totalAmount ?? base + km + extras;
    const isSelected = selectedBilling.has(t.id);
    return (
      <div
        key={t.id}
        className={`rounded-2xl border ${
          isSelected ? 'border-primary' : 'border-black/30'
        } bg-white text-black shadow-md hover:shadow-lg transition-shadow w-full min-w-0 max-w-full sm:max-w-[520px] mx-auto h-full overflow-hidden`}
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,245,245,0.92)), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 16px 16px',
        }}
      >
        <div className='p-3 sm:p-4 space-y-3'>
          <div className='flex items-center justify-between gap-3'>
            <div className='h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center'>
              <FileText className='h-6 w-6 text-primary' />
            </div>
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => {
                const updated = new Set(selectedBilling);
                if (checked) updated.add(t.id);
                else updated.delete(t.id);
                setSelectedBilling(updated);
              }}
            />
          </div>
          <div className='min-w-0'>
            <p className='font-semibold truncate'>
              {t.client.name || 'Cliente'}
            </p>
            <p className='text-xs text-muted-foreground truncate'>
              {formatDate(t.scheduledFor)} • {t.service.name || 'Servio'}
            </p>
          </div>

          <div className='space-y-2 text-sm text-black'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Valor chamado</span>
              <span className='font-semibold'>{formatCurrency(base)}</span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Extras</span>
              <span className='font-semibold'>{formatCurrency(extras)}</span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>KM</span>
              <span className='font-semibold'>{formatCurrency(km)}</span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Incio</span>
              <span className='font-semibold'>
                {formatDateTime(t.startedAt)}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Fim</span>
              <span className='font-semibold'>
                {formatDateTime(t.stoppedAt)}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Durao</span>
              <span className='font-semibold'>
                {calcHours(t.startedAt, t.stoppedAt)} h
              </span>
            </div>
          </div>

          <div className='flex items-center justify-between border-t border-border/60 pt-3'>
            <span className='text-muted-foreground'>Total</span>
            <span className='font-bold text-primary'>
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Agrupa chamados selecionados por cliente e calcula totais
  const chamadosAgrupadosPorCliente = useMemo(() => {
    const selectedCards = filteredBillingCards.filter((t: any) =>
      selectedBilling.has(t.id)
    );
    const groups: Record<string, { tickets: any[]; totalValue: number }> = {};

    selectedCards.forEach((ticket: any) => {
      const clientName = ticket.client?.name || 'Cliente';
      if (!groups[clientName]) {
        groups[clientName] = { tickets: [], totalValue: 0 };
      }

      const base = ticket.ticketValue
        ? Number(ticket.ticketValue)
        : Number(ticket.service?.price || 0);
      const km =
        ticket.kmRate && ticket.kmTotal
          ? Number(ticket.kmRate) * Number(ticket.kmTotal)
          : 0;
      const extras = ticket.extraExpenses ? Number(ticket.extraExpenses) : 0;
      const total = ticket.totalAmount ?? base + km + extras;

      groups[clientName].tickets.push(ticket);
      groups[clientName].totalValue += total;
    });

    return groups;
  }, [filteredBillingCards, selectedBilling]);

  const sendBillingWhatsApp = () => {
    if (
      !requirePaid({
        feature: 'Envio por WhatsApp',
        description: 'Envios por WhatsApp estao disponiveis apenas na versao paga.',
      })
    ) {
      return;
    }
    const cards = filteredBillingCards.filter((t: any) =>
      selectedBilling.has(t.id)
    );
    if (!cards.length) return;
    const groups = cards.reduce((acc: Record<string, any[]>, cur) => {
      const key = cur.client.name || 'Cliente';
      (acc[key] = acc[key] || []).push(cur);
      return acc;
    }, {});
    Object.values(groups).forEach((list: any[]) => {
      const target = list[0];
      const phone = target.client.phone ? unmaskPhone(target.client.phone) : '';
      if (!phone) return;
      const lines: string[] = [];
      lines.push(
        `Ol ${target.client.name || 'cliente'}, segue o resumo de cobrana:`
      );
      list.forEach((t) => {
        const base = t.ticketValue
          ? Number(t.ticketValue)
          : Number(t.service.price || 0);
        const km =
          t.kmRate && t.kmTotal ? Number(t.kmRate) * Number(t.kmTotal) : 0;
        const extras = t.extraExpenses ? Number(t.extraExpenses) : 0;
        const total = t.totalAmount ?? base + km + extras;
        lines.push(
          [
            `Servio: ${t.service.name || 'Servio'}`,
            `Valor chamado: ${formatCurrency(base)}`,
            `Extras: ${formatCurrency(extras)}`,
            `KM: ${formatCurrency(km)}`,
            `Total: ${formatCurrency(total)}`,
          ].join(' | ')
        );
      });
      const url = `https://wa.me/55${phone}text=${encodeURIComponent(
        lines.join('\n')
      )}`;
      window.open(url, '_blank');
    });
  };

  if (loading) {
    return (
      <div className='space-y-6'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className='h-[140px]' />
          ))}
        </div>
        <Card>
          <CardContent className='p-6'>
            <Skeleton className='h-32 w-full' />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='space-y-6 overflow-x-hidden'>
      <div>
        <h1 className='text-3xl font-semibold mb-2'>Financeiro</h1>
        <p className='text-muted-foreground'>
          Acompanhe seu fluxo de caixa e valores a receber
        </p>
      </div>

      {/* Resumo inteligente */}
      <Card className='border border-black/10 dark:border-primary/20 bg-white dark:bg-card shadow-md'>
        <CardContent className='p-4 sm:p-6 space-y-2'>
          <p className='text-sm text-muted-foreground'>
            Status financeiro do ms
          </p>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
            <div className='text-lg font-semibold'>
              {recebidoPct}% do faturamento j recebido À Projeo:{' '}
              {formatCurrency(faturamento)} À A receber:{' '}
              {formatCurrency(totalPending)}
            </div>
            <div className='flex flex-wrap gap-4 text-sm text-muted-foreground'>
              <span>
                Previso de atraso: {formatCurrency(receivableBuckets.vencido)}
              </span>
              <span>
                Ticket mdio (concludos):{' '}
                {formatCurrency(
                  completedCards.length
                    ? totalBilling / completedCards.length
                    : 0
                )}
              </span>
            </div>
          </div>
          <div className='h-2 rounded-full bg-muted overflow-hidden'>
            <div
              className='h-full bg-emerald-500'
              style={{ width: `${recebidoPct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Cards principais */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <Card className='border border-black/10 dark:border-primary/20 bg-white dark:bg-card shadow-md'>
          <CardContent className='p-4 sm:p-5 space-y-3'>
            <div className='flex items-start justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>
                  Total recebido (ms)
                </p>
                <p className='text-3xl font-bold text-emerald-600 dark:text-emerald-400'>
                  {formatCurrency(totalPaid)}
                </p>
              </div>
              <CheckCircle2 className='h-8 w-8 text-emerald-500' />
            </div>
            <div className='space-y-2 text-sm'>
              <div className='h-2 rounded-full bg-muted overflow-hidden'>
                <div
                  className='h-full bg-emerald-500'
                  style={{ width: `${recebidoPct}%` }}
                />
              </div>
              <p className='text-xs text-muted-foreground'>
                Progresso do faturamento do ms
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className='border border-black/10 dark:border-primary/20 bg-white dark:bg-card shadow-md cursor-pointer'
          onClick={() => setShowBillingDetail((prev) => !prev)}
        >
          <CardContent className='p-4 sm:p-5 space-y-3'>
            <div className='flex items-start justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>
                  Total pendente (ms)
                </p>
                <p className='text-3xl font-bold text-amber-600 dark:text-amber-400'>
                  {formatCurrency(totalPending)}
                </p>
              </div>
              <Clock className='h-8 w-8 text-amber-500' />
            </div>
            <div className='space-y-2 text-sm'>
              <div className='h-2 rounded-full bg-muted overflow-hidden'>
                <div
                  className='h-full bg-amber-500'
                  style={{ width: `${pendentePct}%` }}
                />
              </div>
              <p className='text-xs text-muted-foreground'>
                Clique para ver lista/cards e cobrar
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className='border border-black/10 dark:border-primary/20 bg-white dark:bg-card shadow-md'>
          <CardContent className='p-4 sm:p-5 space-y-3'>
            <div className='flex items-start justify-between'>
              <div>
                <p className='text-sm text-muted-foreground'>
                  Faturamento total (ms)
                </p>
                <p className='text-3xl font-bold text-primary'>
                  {formatCurrency(faturamento)}
                </p>
              </div>
              <TrendingUp className='h-8 w-8 text-primary' />
            </div>
            <div className='space-y-2 text-sm'>
              <div className='flex items-center justify-between text-xs text-muted-foreground'>
                <span>Recebido</span>
                <span>{formatCurrency(totalPaid)}</span>
              </div>
              <div className='flex items-center justify-between text-xs text-muted-foreground'>
                <span>Pendente</span>
                <span>{formatCurrency(totalPending)}</span>
              </div>
              <p className='text-xs text-muted-foreground'>Viso geral do ms</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Faturamento (ms) detalhado */}
      {showBillingDetail && (
        <Card className='border border-black/10 dark:border-primary/20 bg-primary/5 shadow-md overflow-hidden'>
          <CardHeader>
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4'>
              <div className='flex items-center gap-2'>
                <DollarSign className='h-5 w-5 text-primary' />
                <CardTitle className='text-xl font-semibold'>
                  Detalhamento de Faturamento (Ms)
                </CardTitle>
              </div>
              <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto'>
                <Select
                  value={billingClientFilter}
                  onValueChange={setBillingClientFilter}
                >
                  <SelectTrigger className='w-full sm:w-[220px]'>
                    <SelectValue placeholder='Todos os clientes' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todos os clientes</SelectItem>
                    {billingClients.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setShowBillingDetail(false)}
                  className='w-full sm:w-auto'
                >
                  <X className='h-4 w-4' />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className='p-3 px-2 sm:px-6 sm:py-6'>
            {filteredBillingCards.length === 0 ? (
              <div className='text-center py-8 text-muted-foreground'>
                Nenhum chamado concludo encontrado
              </div>
            ) : (
              <>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4'>
                  <div className='flex items-center gap-2'>
                    <Checkbox
                      id='select-all-billing'
                      checked={
                        filteredBillingCards.length > 0 &&
                        selectedBilling.size === filteredBillingCards.length &&
                        filteredBillingCards.every((t: any) =>
                          selectedBilling.has(t.id)
                        )
                      }
                      onCheckedChange={(checked) => {
                        if (checked)
                          setSelectedBilling(
                            new Set(filteredBillingCards.map((t: any) => t.id))
                          );
                        else setSelectedBilling(new Set());
                      }}
                    />
                    <label
                      htmlFor='select-all-billing'
                      className='text-sm font-medium cursor-pointer'
                    >
                      Selecionar todos
                    </label>
                    {selectedBilling.size > 0 && (
                      <span className='text-sm text-muted-foreground'>
                        ({selectedBilling.size}{' '}
                        {selectedBilling.size === 1
                          ? 'selecionado'
                          : 'selecionados'}
                        )
                      </span>
                    )}
                  </div>
                  {selectedBilling.size > 0 && (
                    <div className='flex gap-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={sendBillingWhatsApp}
                      >
                        <MessageCircle className='h-4 w-4 mr-2' />
                        WhatsApp ({selectedBilling.size})
                      </Button>
                    </div>
                  )}
                </div>
                <div className='w-full overflow-hidden'>
                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 w-full justify-items-center sm:justify-items-stretch px-1'>
                    {filteredBillingCards.map((t: any) => renderBillingCard(t))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grfico de fluxo de caixa */}
      <Card>
        <CardHeader>
          <CardTitle className='text-xl font-semibold'>
            Fluxo de Caixa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <p className='text-sm text-muted-foreground'>
                Baixe o relatrio completo
              </p>
              <Button variant='outline' size='sm'>
                <DollarSign className='h-4 w-4 mr-2' /> Exportar
              </Button>
            </div>
            <div className='h-64'>
              <ResponsiveContainer width='100%' height='100%'>
                <AreaChart data={cashFlowData}>
                  <defs>
                    <linearGradient id='colorValue' x1='0' y1='0' x2='0' y2='1'>
                      <stop offset='5%' stopColor='#3b82f6' stopOpacity={0.8} />
                      <stop offset='95%' stopColor='#3b82f6' stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray='3 3' strokeOpacity={0.1} />
                  <XAxis
                    dataKey='date'
                    tickFormatter={(v) => {
                      const d = v instanceof Date ? v : new Date(v);
                      return isNaN(d.getTime())
                        ? ''
                        : format(d, 'dd/MM', { locale: ptBR });
                    }}
                  />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(v) => {
                      const d = v instanceof Date ? v : new Date(v);
                      return isNaN(d.getTime())
                        ? ''
                        : format(d, 'dd/MM/yyyy', { locale: ptBR });
                    }}
                  />
                  <Area
                    type='monotone'
                    dataKey='value'
                    stroke='#3b82f6'
                    fillOpacity={1}
                    fill='url(#colorValue)'
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* A receber por vencimento */}
      <Card>
        <CardHeader>
          <CardTitle className='text-xl font-semibold'>
            A receber por vencimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
            <Card className='bg-red-500/10 border-red-500/30'>
              <CardContent className='p-4'>
                <p className='text-sm text-red-600 dark:text-red-400'>
                  Vencido
                </p>
                <p className='text-2xl font-bold text-red-700 dark:text-red-300'>
                  {formatCurrency(receivableBuckets.vencido)}
                </p>
              </CardContent>
            </Card>
            <Card className='bg-amber-500/10 border-amber-500/30'>
              <CardContent className='p-4'>
                <p className='text-sm text-amber-600 dark:text-amber-400'>
                  0 a 7 dias
                </p>
                <p className='text-2xl font-bold text-amber-700 dark:text-amber-300'>
                  {formatCurrency(receivableBuckets.ate7)}
                </p>
              </CardContent>
            </Card>
            <Card className='bg-blue-500/10 border-blue-500/30'>
              <CardContent className='p-4'>
                <p className='text-sm text-blue-600 dark:text-blue-400'>
                  8 a 30 dias
                </p>
                <p className='text-2xl font-bold text-blue-700 dark:text-blue-300'>
                  {formatCurrency(receivableBuckets.ate30)}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Top pendncias */}
      <Card>
        <CardHeader>
          <CardTitle className='text-xl font-semibold'>
            Top 5 pendncias por cliente/parceiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topPendencias.length === 0 ? (
            <p className='text-muted-foreground'>Nenhuma pendncia em aberto</p>
          ) : (
            <div className='space-y-3'>
              {topPendencias.map((item) => (
                <Card key={item.clientName} className='hover-elevate'>
                  <CardContent className='p-4 flex items-center justify-between'>
                    <div className='min-w-0'>
                      <p className='font-semibold truncate'>
                        {item.clientName}
                      </p>
                      <p className='text-xs text-muted-foreground'>Aberto</p>
                    </div>
                    <p className='text-xl font-bold text-primary'>
                      {formatCurrency(item.total)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Valores a Receber */}
      <Card>
        <CardHeader>
          <CardTitle className='text-xl font-semibold'>
            Valores a Receber
          </CardTitle>
          <p className='text-sm text-muted-foreground mt-1'>
            Total: R${' '}
            {totalReceivables.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}
          </p>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {receivables.map((receivable) => {
              const statusInfo = statusConfig[receivable.status];
              return (
                <Card
                  key={receivable.id}
                  className='hover-elevate'
                  data-testid={`card-receivable-${receivable.id}`}
                >
                  <div className='p-4 flex items-center justify-between'>
                    <div className='flex-1'>
                      <div className='flex items-center gap-2 mb-1'>
                        <h4
                          className='font-semibold'
                          data-testid='text-receivable-client'
                        >
                          {receivable.clientName}
                        </h4>
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <p className='text-sm text-muted-foreground'>
                        Vencimento: {formatDate(receivable.dueDate)}
                      </p>
                    </div>
                    <div className='text-right'>
                      <div
                        className='text-2xl font-bold'
                        data-testid='text-receivable-amount'
                      >
                        R${' '}
                        {receivable.amount.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dialog removido - não utilizado atualmente */}
    </div>
  );
}
