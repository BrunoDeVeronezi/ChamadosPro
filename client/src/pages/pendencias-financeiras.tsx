import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { Search, Send, Eye, CheckCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ModalDetalhesRegistroFinanceiro } from '@/components/modal-detalhes-registro-financeiro';
import { FinancialActions } from '@/components/financial-actions';

interface PendingPayment {
  id: string;
  clientName: string;
  invoiceId: string;
  dueDate: string;
  amount: number;
  status: 'PENDENTE' | 'VENCIDO';
  ticketId?: string;
}

export default function PendenciasFinanceiras() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Buscar registros financeiros completos para ter acesso ao ticketId
  const { data: financialRecords, isLoading: isLoadingRecords } = useQuery<any[]>({
    queryKey: ['/api/financial-records'],
  });

  // Filtrar registros financeiros pendentes
  const pendingPayments = useMemo(() => {
    if (!financialRecords) return [];
    
    const filtered = financialRecords.filter((record: any) => {
      const recordStatus = (record.status || '').toUpperCase();
      const isPending = recordStatus === 'PENDING' || recordStatus === 'PENDENTE';
      const isOverdue = recordStatus === 'OVERDUE' || recordStatus === 'ATRASADO';
      
      if (statusFilter === 'all') {
        return isPending || isOverdue;
      } else if (statusFilter === 'PENDENTE') {
        return isPending && !isOverdue;
      } else if (statusFilter === 'VENCIDO') {
        return isOverdue;
      }
      
      return false;
    });
    
    return filtered.map((record: any) => {
      const dueDate = record.dueDate ? new Date(record.dueDate) : new Date();
      const now = new Date();
      const isOverdue = dueDate < now;
      
      return {
        id: record.id,
        clientName: record.clientName || 'Cliente não identificado',
        invoiceId: record.id.slice(0, 8),
        dueDate: record.dueDate || new Date().toISOString(),
        amount: parseFloat(record.amount || 0),
        status: isOverdue ? ('VENCIDO' as const) : ('PENDENTE' as const),
        ticketId: record.ticketId,
      };
    });
  }, [financialRecords, statusFilter]);

  const isLoading = isLoadingRecords;

  const filteredPayments = pendingPayments?.filter(
    (payment) =>
      payment.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.invoiceId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalReceber =
    pendingPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalPendente =
    pendingPayments
      ?.filter((p) => p.status === 'PENDENTE')
      .reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalVencido =
    pendingPayments
      ?.filter((p) => p.status === 'VENCIDO')
      .reduce((sum, p) => sum + p.amount, 0) || 0;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredPayments?.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredPayments?.map((p) => p.id) || []);
    }
  };

  return (
    <div className='flex min-h-screen bg-[#f5f7f8] dark:bg-[#101722]'>
      <main className='flex-1 p-8'>
        <div className='mx-auto flex w-full max-w-7xl flex-col gap-6'>
          {/* Header */}
          <header className='flex flex-wrap items-center justify-between gap-4'>
            <h1 className='text-[#111418] dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
              Pendências (Contas a Receber)
            </h1>
            <Button className='bg-[#3880f5] hover:bg-[#3880f5]/90'>
              <Send className='w-4 h-4 mr-2' />
              Envio de Cobrança em Lote
            </Button>
          </header>

          {/* Stats */}
          <section className='grid grid-cols-1 gap-6 md:grid-cols-3'>
            <Card className='flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-6'>
              <p className='text-[#111418] dark:text-white text-base font-medium leading-normal'>
                Total a Receber
              </p>
              <p className='text-[#111418] dark:text-white tracking-light text-2xl font-bold leading-tight'>
                {formatCurrency(totalReceber)}
              </p>
            </Card>
            <Card className='flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-6'>
              <p className='text-[#111418] dark:text-white text-base font-medium leading-normal'>
                Total Pendente
              </p>
              <p className='text-[#111418] dark:text-white tracking-light text-2xl font-bold leading-tight'>
                {formatCurrency(totalPendente)}
              </p>
            </Card>
            <Card className='flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-6'>
              <p className='text-[#111418] dark:text-white text-base font-medium leading-normal'>
                Total Vencido
              </p>
              <p className='text-[#111418] dark:text-white tracking-light text-2xl font-bold leading-tight'>
                {formatCurrency(totalVencido)}
              </p>
            </Card>
          </section>

          {/* Search and Filters */}
          <section className='flex flex-wrap items-center gap-4'>
            <div className='flex-grow'>
              <div className='flex h-12 w-full flex-1 items-stretch rounded-lg'>
                <div className='flex items-center justify-center rounded-l-lg border border-r-0 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 pl-4 text-slate-500 dark:text-slate-400'>
                  <Search className='w-5 h-5' />
                </div>
                <Input
                  className='h-full w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg border border-l-0 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-4 text-base font-normal leading-normal text-[#111418] dark:text-white placeholder:text-slate-500 focus:border-[#3880f5] focus:outline-0 focus:ring-0 dark:placeholder:text-slate-400'
                  placeholder='Buscar por cliente ou serviço...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className='flex items-center gap-4'>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className='h-12 w-48'>
                  <SelectValue placeholder='Filtrar por Status' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todos</SelectItem>
                  <SelectItem value='PENDENTE'>Pendente</SelectItem>
                  <SelectItem value='VENCIDO'>Vencido</SelectItem>
                </SelectContent>
              </Select>
              <Button variant='outline' size='icon' className='h-12 w-12'>
                <Calendar className='w-5 h-5' />
              </Button>
            </div>
          </section>

          {/* Data Table */}
          <section className='overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='border-b border-gray-200 dark:border-gray-800 bg-[#f5f7f8] dark:bg-[#101722]'>
                    <TableHead className='p-4'>
                      <Checkbox
                        checked={
                          filteredPayments &&
                          filteredPayments.length > 0 &&
                          selectedItems.length === filteredPayments.length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className='p-4 text-sm font-semibold text-[#111418] dark:text-white'>
                      Cliente
                    </TableHead>
                    <TableHead className='p-4 text-sm font-semibold text-[#111418] dark:text-white'>
                      ID da Folha
                    </TableHead>
                    <TableHead className='p-4 text-sm font-semibold text-[#111418] dark:text-white'>
                      Data de Vencimento
                    </TableHead>
                    <TableHead className='p-4 text-sm font-semibold text-[#111418] dark:text-white'>
                      Valor
                    </TableHead>
                    <TableHead className='p-4 text-sm font-semibold text-[#111418] dark:text-white'>
                      Status
                    </TableHead>
                    <TableHead className='p-4 text-sm font-semibold text-[#111418] dark:text-white'>
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className='p-8 text-center text-slate-500'
                      >
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredPayments && filteredPayments.length > 0 ? (
                    filteredPayments.map((payment) => (
                      <TableRow
                        key={payment.id}
                        className='hover:bg-[#f5f7f8] dark:hover:bg-[#101722]'
                      >
                        <TableCell className='p-4'>
                          <Checkbox
                            checked={selectedItems.includes(payment.id)}
                            onCheckedChange={() => toggleSelect(payment.id)}
                          />
                        </TableCell>
                        <TableCell className='p-4 text-sm text-[#111418] dark:text-white'>
                          {payment.clientName}
                        </TableCell>
                        <TableCell className='p-4 text-sm text-slate-500 dark:text-slate-400'>
                          {payment.invoiceId}
                        </TableCell>
                        <TableCell className='p-4 text-sm text-[#111418] dark:text-white'>
                          {format(new Date(payment.dueDate), 'dd/MM/yyyy', {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell className='p-4 text-sm font-medium text-[#111418] dark:text-white'>
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell className='p-4'>
                          <Badge
                            variant={
                              payment.status === 'VENCIDO'
                                ? 'destructive'
                                : payment.status === 'PENDENTE'
                                ? 'default'
                                : 'secondary'
                            }
                            className={
                              payment.status === 'VENCIDO'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            }
                          >
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className='p-4'>
                          <div className='flex gap-2 text-slate-500 dark:text-slate-400'>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8 hover:text-[#3880f5]'
                              onClick={() => {
                                setSelectedRecordId(payment.id);
                                setIsDetailsModalOpen(true);
                              }}
                            >
                              <Eye className='w-5 h-5' />
                            </Button>
                            {payment.ticketId && (
                              <FinancialActions ticketId={payment.ticketId} variant='icon' />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className='p-8 text-center text-slate-500'
                      >
                        Nenhuma pendência encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Pagination */}
            {filteredPayments && filteredPayments.length > 0 && (
              <div className='flex items-center justify-between border-t border-gray-200 dark:border-gray-800 px-4 py-3'>
                <p className='text-sm text-slate-500 dark:text-slate-400'>
                  Mostrando 1-{filteredPayments.length} de{' '}
                  {filteredPayments.length} resultados
                </p>
                <div className='flex items-center gap-2'>
                  <Button variant='outline' size='icon' className='h-10 w-10'>
                    ←
                  </Button>
                  <Button variant='outline' size='icon' className='h-10 w-10'>
                    →
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <ModalDetalhesRegistroFinanceiro
        recordId={selectedRecordId}
        open={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
        onEdit={(recordId) => {
          // Implementar navegação para edição se necessário
          console.log('Editar registro:', recordId);
        }}
      />
    </div>
  );
}
