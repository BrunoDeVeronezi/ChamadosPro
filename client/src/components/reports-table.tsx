import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  description: string;
}

interface ReportsTableProps {
  tickets: Ticket[];
  viewMode: 'table' | 'cards';
  selectedIds: Set<string>;
  onSelectAll: () => void;
  onSelectOne: (id: string) => void;
  allSelected: boolean;
  someSelected: boolean;
}

const statusConfig: Record<
  string,
  {
    label: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
  }
> = {
  ABERTO: { label: 'Aberto', variant: 'outline' },
  EXECUCAO: { label: 'Em Progresso', variant: 'default' },
  CONCLUIDO: { label: 'Finalizado', variant: 'secondary' },
  paid: { label: 'Pago', variant: 'secondary' },
  overdue: { label: 'Atrasado', variant: 'destructive' },
};

export function ReportsTable({
  tickets,
  viewMode,
  selectedIds,
  onSelectAll,
  onSelectOne,
  allSelected,
  someSelected,
}: ReportsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
      return 'Data invlida';
    }
  };

  const getStatusInfo = (status: string) => {
    const normalized = (status || '').trim().toUpperCase();
    return (
      statusConfig[normalized] || {
        label: normalized,
        variant: 'outline' as const,
      }
    );
  };

  const calculateTotal = (ticket: Ticket) => {
    const base = ticket.ticketValue
      ? Number(ticket.ticketValue)
      : Number(ticket.service.price || 0);
    const km =
      ticket.kmRate && ticket.kmTotal
        ? Number(ticket.kmRate) * Number(ticket.kmTotal)
        : 0;
    const extras = ticket.extraExpenses ? Number(ticket.extraExpenses) : 0;
    return ticket.totalAmount ?? base + km + extras;
  };

  if (viewMode === 'cards') {
    return (
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3'>
        {tickets.map((ticket) => {
          const total = calculateTotal(ticket);
          const statusInfo = getStatusInfo(ticket.status);
          const isExpanded = expandedRows.has(ticket.id);

          return (
            <Card
              key={ticket.id}
              className={cn(
                'transition-all hover:shadow-md',
                selectedIds.has(ticket.id) && 'ring-2 ring-primary'
              )}
            >
              <CardContent className='p-2 sm:p-3 space-y-1.5 sm:space-y-2'>
                <div className='flex items-start justify-between gap-2'>
                  <div className='flex items-center gap-1.5 min-w-0'>
                    <Checkbox
                      checked={selectedIds.has(ticket.id)}
                      onCheckedChange={() => onSelectOne(ticket.id)}
                      className='h-3.5 w-3.5 sm:h-4 sm:w-4'
                    />
                    <span className='text-[10px] sm:text-xs font-mono text-muted-foreground truncate'>
                      #{ticket.id.slice(0, 8)}
                    </span>
                  </div>
                  <Badge
                    variant={statusInfo.variant}
                    className='text-[10px] sm:text-xs px-1.5 py-0'
                  >
                    {statusInfo.label}
                  </Badge>
                </div>

                <div className='min-w-0'>
                  <h3 className='font-semibold text-sm sm:text-base truncate'>
                    {ticket.client.name || 'Cliente'}
                  </h3>
                  {ticket.client.phone && (
                    <p className='text-xs text-muted-foreground truncate'>
                      {ticket.client.phone}
                    </p>
                  )}
                </div>

                <div className='grid grid-cols-2 gap-1.5 sm:gap-2 text-xs sm:text-sm'>
                  <div>
                    <p className='text-muted-foreground text-[10px] sm:text-xs'>
                      Data Abertura
                    </p>
                    <p className='font-medium text-xs sm:text-sm truncate'>
                      {formatDate(ticket.scheduledFor)}
                    </p>
                  </div>
                  {ticket.completedAt && (
                    <div>
                      <p className='text-muted-foreground text-[10px] sm:text-xs'>
                        Data Fim
                      </p>
                      <p className='font-medium text-xs sm:text-sm truncate'>
                        {formatDate(ticket.completedAt)}
                      </p>
                    </div>
                  )}
                </div>

                <div className='flex items-center justify-between pt-1.5 sm:pt-2 border-t'>
                  <div className='min-w-0'>
                    <p className='text-muted-foreground text-[10px] sm:text-xs'>
                      Valor Total
                    </p>
                    <p className='text-sm sm:text-base font-bold text-primary truncate'>
                      {formatCurrency(total)}
                    </p>
                  </div>
                  {ticket.service && (
                    <div className='text-right min-w-0'>
                      <p className='text-muted-foreground text-[10px] sm:text-xs'>
                        Servio
                      </p>
                      <p className='text-xs sm:text-sm font-medium truncate'>
                        {ticket.service.name}
                      </p>
                    </div>
                  )}
                </div>

                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='w-full'
                      onClick={() => toggleRow(ticket.id)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className='h-4 w-4 mr-2' />
                          Ocultar Detalhes
                        </>
                      ) : (
                        <>
                          <ChevronDown className='h-4 w-4 mr-2' />
                          Ver Detalhes
                        </>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {isExpanded && (
                      <div className='mt-3 pt-3 border-t space-y-2 text-sm'>
                        <div className='grid grid-cols-2 gap-2'>
                          <div>
                            <p className='text-muted-foreground'>Valor Base</p>
                            <p className='font-medium'>
                              {formatCurrency(
                                ticket.ticketValue
                                  ? Number(ticket.ticketValue)
                                  : Number(ticket.service.price || 0)
                              )}
                            </p>
                          </div>
                          {ticket.kmTotal && ticket.kmRate && (
                            <div>
                              <p className='text-muted-foreground'>
                                KM ({ticket.kmTotal} km)
                              </p>
                              <p className='font-medium'>
                                {formatCurrency(
                                  Number(ticket.kmTotal) * Number(ticket.kmRate)
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                        {ticket.extraExpenses &&
                          Number(ticket.extraExpenses) > 0 && (
                            <div>
                              <p className='text-muted-foreground'>
                                Despesas Extras
                              </p>
                              <p className='font-medium'>
                                {formatCurrency(Number(ticket.extraExpenses))}
                              </p>
                            </div>
                          )}
                        {ticket.description && (
                          <div>
                            <p className='text-muted-foreground'>Descrio</p>
                            <p className='text-sm'>{ticket.description}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <Card className='border-0 shadow-none'>
      <div className='overflow-x-auto -mx-2 sm:mx-0'>
        <Table className='text-xs sm:text-sm'>
          <TableHeader>
            <TableRow className='h-8 sm:h-10'>
              <TableHead className='w-8 sm:w-12 p-1 sm:p-2'>
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onSelectAll}
                  className='h-3.5 w-3.5 sm:h-4 sm:w-4'
                  ref={(el) => {
                    if (el) {
                      (el as any).indeterminate = someSelected && !allSelected;
                    }
                  }}
                />
              </TableHead>
              <TableHead className='p-1 sm:p-2'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-6 sm:h-7 text-xs sm:text-sm'
                  onClick={() => handleSort('id')}
                >
                  ID
                  {sortColumn === 'id' && (
                    <ArrowUpDown className='ml-1 h-3 w-3 sm:h-4 sm:w-4' />
                  )}
                </Button>
              </TableHead>
              <TableHead className='p-1 sm:p-2 hidden sm:table-cell'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-6 sm:h-7 text-xs sm:text-sm'
                  onClick={() => handleSort('client')}
                >
                  Cliente
                  {sortColumn === 'client' && (
                    <ArrowUpDown className='ml-1 h-3 w-3 sm:h-4 sm:w-4' />
                  )}
                </Button>
              </TableHead>
              <TableHead className='p-1 sm:p-2'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-6 sm:h-7 text-xs sm:text-sm'
                  onClick={() => handleSort('date')}
                >
                  <span className='hidden sm:inline'>Data Abertura</span>
                  <span className='sm:hidden'>Data</span>
                  {sortColumn === 'date' && (
                    <ArrowUpDown className='ml-1 h-3 w-3 sm:h-4 sm:w-4' />
                  )}
                </Button>
              </TableHead>
              <TableHead className='p-1 sm:p-2 hidden md:table-cell'>
                Data Fim
              </TableHead>
              <TableHead className='p-1 sm:p-2 hidden lg:table-cell'>
                Servio
              </TableHead>
              <TableHead className='p-1 sm:p-2'>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-6 sm:h-7 text-xs sm:text-sm'
                  onClick={() => handleSort('value')}
                >
                  Valor
                  {sortColumn === 'value' && (
                    <ArrowUpDown className='ml-1 h-3 w-3 sm:h-4 sm:w-4' />
                  )}
                </Button>
              </TableHead>
              <TableHead className='p-1 sm:p-2'>Status</TableHead>
              <TableHead className='p-1 sm:p-2 hidden lg:table-cell'>
                Pagamento
              </TableHead>
              <TableHead className='w-8 sm:w-12 p-1 sm:p-2'></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => {
              const total = calculateTotal(ticket);
              const statusInfo = getStatusInfo(ticket.status);
              const isExpanded = expandedRows.has(ticket.id);

              return (
                <>
                  <TableRow
                    key={ticket.id}
                    className={cn(
                      'cursor-pointer h-10 sm:h-12',
                      selectedIds.has(ticket.id) && 'bg-primary/5'
                    )}
                  >
                    <TableCell className='p-1 sm:p-2'>
                      <Checkbox
                        checked={selectedIds.has(ticket.id)}
                        onCheckedChange={() => onSelectOne(ticket.id)}
                        className='h-3.5 w-3.5 sm:h-4 sm:w-4'
                      />
                    </TableCell>
                    <TableCell className='font-mono text-[10px] sm:text-xs p-1 sm:p-2'>
                      #{ticket.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className='p-1 sm:p-2 hidden sm:table-cell'>
                      <div className='min-w-0'>
                        <p className='font-medium text-xs sm:text-sm truncate'>
                          {ticket.client.name || 'Cliente'}
                        </p>
                        {ticket.client.phone && (
                          <p className='text-[10px] sm:text-xs text-muted-foreground truncate'>
                            {ticket.client.phone}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='p-1 sm:p-2 text-[10px] sm:text-xs'>
                      {formatDate(ticket.scheduledFor)}
                    </TableCell>
                    <TableCell className='p-1 sm:p-2 text-[10px] sm:text-xs hidden md:table-cell'>
                      {ticket.completedAt
                        ? formatDate(ticket.completedAt)
                        : '-'}
                    </TableCell>
                    <TableCell className='p-1 sm:p-2 text-[10px] sm:text-xs hidden lg:table-cell truncate max-w-[120px]'>
                      {ticket.service.name || '-'}
                    </TableCell>
                    <TableCell className='p-1 sm:p-2'>
                      <div className='flex items-center gap-1 sm:gap-2'>
                        <span className='font-semibold text-xs sm:text-sm'>
                          {formatCurrency(total)}
                        </span>
                        <TrendingUp className='h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-500' />
                      </div>
                    </TableCell>
                    <TableCell className='p-1 sm:p-2'>
                      <Badge
                        variant={statusInfo.variant}
                        className='text-[10px] sm:text-xs px-1 py-0'
                      >
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className='p-1 sm:p-2 hidden lg:table-cell'>
                      {ticket.paymentDate ? (
                        <Badge
                          variant='secondary'
                          className='text-[10px] sm:text-xs px-1 py-0'
                        >
                          Pago
                        </Badge>
                      ) : (
                        <Badge
                          variant='outline'
                          className='text-[10px] sm:text-xs px-1 py-0'
                        >
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className='p-1 sm:p-2'>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-6 w-6 sm:h-7 sm:w-7 p-0'
                        onClick={() => toggleRow(ticket.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className='h-3 w-3 sm:h-4 sm:w-4' />
                        ) : (
                          <ChevronDown className='h-3 w-3 sm:h-4 sm:w-4' />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className='bg-muted/30 p-2 sm:p-3'
                      >
                        <div className='space-y-2 sm:space-y-3'>
                          <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs sm:text-sm'>
                            <div>
                              <p className='text-muted-foreground text-xs'>
                                Valor Base
                              </p>
                              <p className='font-medium'>
                                {formatCurrency(
                                  ticket.ticketValue
                                    ? Number(ticket.ticketValue)
                                    : Number(ticket.service.price || 0)
                                )}
                              </p>
                            </div>
                            {ticket.kmTotal && ticket.kmRate && (
                              <div>
                                <p className='text-muted-foreground text-xs'>
                                  KM ({ticket.kmTotal} km)
                                </p>
                                <p className='font-medium'>
                                  {formatCurrency(
                                    Number(ticket.kmTotal) *
                                      Number(ticket.kmRate)
                                  )}
                                </p>
                              </div>
                            )}
                            {ticket.extraExpenses &&
                              Number(ticket.extraExpenses) > 0 && (
                                <div>
                                  <p className='text-muted-foreground text-xs'>
                                    Despesas Extras
                                  </p>
                                  <p className='font-medium'>
                                    {formatCurrency(
                                      Number(ticket.extraExpenses)
                                    )}
                                  </p>
                                </div>
                              )}
                            <div>
                              <p className='text-muted-foreground text-xs'>
                                Total
                              </p>
                              <p className='font-bold text-primary'>
                                {formatCurrency(total)}
                              </p>
                            </div>
                          </div>
                          {ticket.description && (
                            <div className='col-span-2 sm:col-span-4'>
                              <p className='text-muted-foreground text-[10px] sm:text-xs mb-0.5 sm:mb-1'>
                                Descrio
                              </p>
                              <p className='text-xs sm:text-sm line-clamp-2'>
                                {ticket.description}
                              </p>
                            </div>
                          )}
                          {ticket.startedAt && (
                            <div className='col-span-2 sm:col-span-4 text-[10px] sm:text-xs text-muted-foreground'>
                              Iniciado em: {formatDate(ticket.startedAt)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
