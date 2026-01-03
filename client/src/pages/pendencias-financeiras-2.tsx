import { useState } from 'react';
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
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import {
  Send,
  Search,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { maskCurrency } from '@/lib/masks';

interface PendingPayment {
  id: string;
  clientName: string;
  invoiceId: string;
  dueDate: string;
  amount: number;
  status: 'PENDENTE' | 'VENCIDO';
}

export default function PendenciasFinanceiras2() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const { data: pendingPayments, isLoading } = useQuery<PendingPayment[]>({
    queryKey: ['/api/financial/pending', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await apiRequest(
        'GET',
        `/api/financial/pending?${params.toString()}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar pendências');
      return response.json();
    },
  });

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

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateString;
    }
  };

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
    <div className='font-display bg-background-light dark:bg-background-dark'>
      <div className='relative flex min-h-screen w-full flex-col'>
        <div className='flex h-full w-full flex-row'>
          <aside className='flex h-screen min-h-full w-64 flex-col justify-between border-r border-border-light bg-content-light p-4 dark:border-border-dark dark:bg-content-dark'>
            <div className='flex flex-col gap-4'>
              <div className='flex items-center gap-3 px-2'>
                <div className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-primary/20'></div>
                <div className='flex flex-col'>
                  <h1 className='text-text-light dark:text-text-dark text-base font-medium leading-normal'>
                    Técnico Pro
                  </h1>
                  <p className='text-slate-500 dark:text-slate-400 text-sm font-normal leading-normal'>
                    suporte@chamadospro.com
                  </p>
                </div>
              </div>
              <nav className='flex flex-col gap-2'>
                <a
                  className='flex items-center gap-3 rounded-lg px-3 py-2 text-text-light hover:bg-background-light dark:text-text-dark dark:hover:bg-background-dark'
                  href='#'
                >
                  <span>📊</span>
                  <p className='text-sm font-medium leading-normal'>
                    Dashboard
                  </p>
                </a>
                <a
                  className='flex items-center gap-3 rounded-lg px-3 py-2 text-text-light hover:bg-background-light dark:text-text-dark dark:hover:bg-background-dark'
                  href='#'
                >
                  <span>👥</span>
                  <p className='text-sm font-medium leading-normal'>Clientes</p>
                </a>
                <a
                  className='flex items-center gap-3 rounded-lg px-3 py-2 text-text-light hover:bg-background-light dark:text-text-dark dark:hover:bg-background-dark'
                  href='#'
                >
                  <span>🎫</span>
                  <p className='text-sm font-medium leading-normal'>Chamados</p>
                </a>
                <a
                  className='flex items-center gap-3 rounded-lg px-3 py-2 text-text-light hover:bg-background-light dark:text-text-dark dark:hover:bg-background-dark'
                  href='#'
                >
                  <span>📅</span>
                  <p className='text-sm font-medium leading-normal'>Agenda</p>
                </a>
                <a
                  className='flex items-center gap-3 rounded-lg bg-primary/20 px-3 py-2 text-primary dark:bg-primary/30'
                  href='#'
                >
                  <span>💰</span>
                  <p className='text-sm font-medium leading-normal'>
                    Financeiro
                  </p>
                </a>
              </nav>
            </div>
            <div className='flex flex-col gap-1'>
              <a
                className='flex items-center gap-3 rounded-lg px-3 py-2 text-text-light hover:bg-background-light dark:text-text-dark dark:hover:bg-background-dark'
                href='#'
              >
                <span>⚙️</span>
                <p className='text-sm font-medium leading-normal'>
                  Configurações
                </p>
              </a>
              <a
                className='flex items-center gap-3 rounded-lg px-3 py-2 text-text-light hover:bg-background-light dark:text-text-dark dark:hover:bg-background-dark'
                href='#'
              >
                <span>❓</span>
                <p className='text-sm font-medium leading-normal'>Ajuda</p>
              </a>
            </div>
          </aside>

          <main className='flex-1 p-8'>
            <div className='mx-auto flex w-full max-w-7xl flex-col gap-6'>
              <header className='flex flex-wrap items-center justify-between gap-4'>
                <h1 className='text-text-light dark:text-text-dark text-4xl font-black leading-tight tracking-[-0.033em]'>
                  Pendências (Contas a Receber)
                </h1>
                <Button className='flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-4 py-2 text-sm font-bold leading-normal text-white'>
                  <Send className='w-4 h-4' />
                  <span className='truncate'>Envio de Cobrança em Lote</span>
                </Button>
              </header>

              <section className='grid grid-cols-1 gap-6 md:grid-cols-3'>
                <Card className='flex flex-col gap-2 rounded-xl border border-border-light bg-content-light p-6 dark:border-border-dark dark:bg-content-dark'>
                  <p className='text-text-light dark:text-text-dark text-base font-medium leading-normal'>
                    Total a Receber
                  </p>
                  <p className='text-text-light dark:text-text-dark tracking-light text-2xl font-bold leading-tight'>
                    {maskCurrency(totalReceber.toString())}
                  </p>
                </Card>
                <Card className='flex flex-col gap-2 rounded-xl border border-border-light bg-content-light p-6 dark:border-border-dark dark:bg-content-dark'>
                  <p className='text-text-light dark:text-text-dark text-base font-medium leading-normal'>
                    Total Pendente
                  </p>
                  <p className='text-text-light dark:text-text-dark tracking-light text-2xl font-bold leading-tight'>
                    {maskCurrency(totalPendente.toString())}
                  </p>
                </Card>
                <Card className='flex flex-col gap-2 rounded-xl border border-border-light bg-content-light p-6 dark:border-border-dark dark:bg-content-dark'>
                  <p className='text-text-light dark:text-text-dark text-base font-medium leading-normal'>
                    Total Vencido
                  </p>
                  <p className='text-text-light dark:text-text-dark tracking-light text-2xl font-bold leading-tight'>
                    {maskCurrency(totalVencido.toString())}
                  </p>
                </Card>
              </section>

              <section className='flex flex-wrap items-center gap-4'>
                <div className='flex-grow'>
                  <div className='flex h-12 w-full min-w-40 flex-col'>
                    <div className='flex h-full w-full flex-1 items-stretch rounded-lg'>
                      <div className='flex items-center justify-center rounded-l-lg border border-r-0 border-border-light bg-content-light pl-4 text-slate-500 dark:border-border-dark dark:bg-content-dark dark:text-slate-400'>
                        <Search className='w-5 h-5' />
                      </div>
                      <Input
                        className='h-full w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg border border-l-0 border-border-light bg-content-light px-4 text-base font-normal leading-normal text-text-light placeholder:text-slate-500 focus:border-primary focus:outline-0 focus:ring-0 dark:border-border-dark dark:bg-content-dark dark:text-text-dark dark:placeholder:text-slate-400'
                        placeholder='Buscar por cliente ou serviço...'
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className='flex items-center gap-4'>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className='h-12 w-48 rounded-lg border-border-light bg-content-light text-text-light focus:border-primary focus:ring-0 dark:border-border-dark dark:bg-content-dark dark:text-text-dark'>
                      <SelectValue placeholder='Filtrar por Status' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>Todos</SelectItem>
                      <SelectItem value='PENDENTE'>Pendente</SelectItem>
                      <SelectItem value='VENCIDO'>Vencido</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant='outline'
                    size='icon'
                    className='flex h-12 w-12 items-center justify-center rounded-lg border border-border-light bg-content-light text-text-light hover:bg-background-light dark:border-border-dark dark:bg-content-dark dark:text-text-dark dark:hover:bg-background-dark'
                  >
                    <Calendar className='w-5 h-5' />
                  </Button>
                </div>
              </section>

              <section className='overflow-hidden rounded-xl border border-border-light bg-content-light dark:border-border-dark dark:bg-content-dark'>
                <div className='overflow-x-auto'>
                  <Table className='w-full min-w-[800px] text-left'>
                    <TableHeader>
                      <TableRow className='border-b border-border-light bg-background-light dark:border-border-dark dark:bg-background-dark'>
                        <TableHead className='p-4'>
                          <Checkbox
                            checked={
                              filteredPayments &&
                              filteredPayments.length > 0 &&
                              selectedItems.length === filteredPayments.length
                            }
                            onCheckedChange={toggleSelectAll}
                            className='h-4 w-4 rounded border-slate-400 text-primary focus:ring-primary/50 dark:border-slate-500'
                          />
                        </TableHead>
                        <TableHead className='p-4 text-sm font-semibold text-text-light dark:text-text-dark'>
                          Cliente
                        </TableHead>
                        <TableHead className='p-4 text-sm font-semibold text-text-light dark:text-text-dark'>
                          ID da Folha
                        </TableHead>
                        <TableHead className='p-4 text-sm font-semibold text-text-light dark:text-text-dark'>
                          Data de Vencimento
                        </TableHead>
                        <TableHead className='p-4 text-sm font-semibold text-text-light dark:text-text-dark'>
                          Valor
                        </TableHead>
                        <TableHead className='p-4 text-sm font-semibold text-text-light dark:text-text-dark'>
                          Status
                        </TableHead>
                        <TableHead className='p-4 text-sm font-semibold text-text-light dark:text-text-dark'>
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className='divide-y divide-border-light dark:divide-border-dark'>
                      {isLoading ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className='p-4 text-center text-slate-500 dark:text-slate-400'
                          >
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : filteredPayments && filteredPayments.length > 0 ? (
                        filteredPayments.map((payment) => (
                          <TableRow
                            key={payment.id}
                            className='hover:bg-background-light dark:hover:bg-background-dark'
                          >
                            <TableCell className='p-4'>
                              <Checkbox
                                checked={selectedItems.includes(payment.id)}
                                onCheckedChange={() => toggleSelect(payment.id)}
                                className='h-4 w-4 rounded border-slate-400 text-primary focus:ring-primary/50 dark:border-slate-500'
                              />
                            </TableCell>
                            <TableCell className='p-4 text-sm text-text-light dark:text-text-dark'>
                              {payment.clientName}
                            </TableCell>
                            <TableCell className='p-4 text-sm text-slate-500 dark:text-slate-400'>
                              {payment.invoiceId}
                            </TableCell>
                            <TableCell className='p-4 text-sm text-text-light dark:text-text-dark'>
                              {formatDate(payment.dueDate)}
                            </TableCell>
                            <TableCell className='p-4 text-sm font-medium text-text-light dark:text-text-dark'>
                              {maskCurrency(payment.amount.toString())}
                            </TableCell>
                            <TableCell className='p-4'>
                              <Badge
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  payment.status === 'VENCIDO'
                                    ? 'bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                    : 'bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                }`}
                              >
                                {payment.status}
                              </Badge>
                            </TableCell>
                            <TableCell className='p-4'>
                              <div className='flex gap-2 text-slate-500 dark:text-slate-400'>
                                <Button
                                  variant='ghost'
                                  size='icon'
                                  className='hover:text-primary'
                                >
                                  <Eye className='w-5 h-5' />
                                </Button>
                                <Button
                                  variant='ghost'
                                  size='icon'
                                  className='hover:text-primary'
                                >
                                  <Send className='w-5 h-5' />
                                </Button>
                                <Button
                                  variant='ghost'
                                  size='icon'
                                  className='hover:text-primary'
                                >
                                  <span>✓</span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className='p-4 text-center text-slate-500 dark:text-slate-400'
                          >
                            Nenhuma pendência encontrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className='flex items-center justify-between border-t border-border-light px-4 py-3 dark:border-border-dark'>
                  <p className='text-sm text-slate-500 dark:text-slate-400'>
                    Mostrando 1-{filteredPayments?.length || 0} de{' '}
                    {pendingPayments?.length || 0} resultados
                  </p>
                  <div className='flex items-center gap-2'>
                    <Button
                      variant='outline'
                      size='icon'
                      className='rounded-lg border border-border-light bg-content-light p-2 text-slate-600 hover:bg-background-light dark:border-border-dark dark:bg-content-dark dark:text-slate-300 dark:hover:bg-background-dark'
                    >
                      <ChevronLeft className='w-5 h-5' />
                    </Button>
                    <Button
                      variant='outline'
                      size='icon'
                      className='rounded-lg border border-border-light bg-content-light p-2 text-slate-600 hover:bg-background-light dark:border-border-dark dark:bg-content-dark dark:text-slate-300 dark:hover:bg-background-dark'
                    >
                      <ChevronRight className='w-5 h-5' />
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
























