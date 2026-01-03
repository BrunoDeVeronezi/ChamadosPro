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
import { apiRequest } from '@/lib/queryClient';
import { Search, Send, Filter, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ModalDetalhesRegistroFinanceiro } from '@/components/modal-detalhes-registro-financeiro';

interface Invoice {
  id: string;
  clientName: string;
  serviceName: string;
  date: string;
  duration: string;
  amount: number;
  status: 'PAGO' | 'PENDENTE' | 'ATRASADO';
}

export default function Faturamento() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ['/api/financial/invoices'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        '/api/financial/invoices',
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar faturas');
      return response.json();
    },
  });

  const filteredInvoices = invoices?.filter(
    (invoice) =>
      invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.serviceName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAGO':
        return (
          <Badge className='bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'>
            Pago
          </Badge>
        );
      case 'PENDENTE':
        return (
          <Badge className='bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'>
            Pendente
          </Badge>
        );
      case 'ATRASADO':
        return (
          <Badge className='bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'>
            Atrasado
          </Badge>
        );
      default:
        return null;
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredInvoices?.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredInvoices?.map((i) => i.id) || []);
    }
  };

  return (
    <div className='flex h-screen bg-[#f5f7f8] dark:bg-[#101722] font-display'>
      <main className='flex-1 overflow-y-auto'>
        <div className='p-8 max-w-7xl mx-auto'>
          {/* Header */}
          <header className='flex flex-wrap justify-between items-center gap-4 mb-6'>
            <h1 className='text-gray-900 dark:text-white text-3xl font-bold tracking-tight'>
              Faturamento (Folhas de Cobrança)
            </h1>
          </header>

          {/* ToolBar */}
          <Card className='flex flex-wrap justify-between items-center gap-4 p-4 bg-white dark:bg-[#101722] rounded-xl border border-gray-200 dark:border-gray-800 mb-6'>
            <div className='flex gap-4 items-center'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5' />
                <Input
                  className='pl-10 pr-4 py-2 w-64 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-[#3880f5] focus:border-[#3880f5] text-gray-900 dark:text-gray-100'
                  placeholder='Filtrar por Cliente...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant='outline' className='flex items-center gap-2'>
                <Filter className='w-4 h-4' />
                Filtros
              </Button>
            </div>
            <Button
              className='bg-[#3880f5] hover:bg-[#3880f5]/90'
              disabled={selectedItems.length === 0}
            >
              <Send className='w-4 h-4 mr-2' />
              Envio de Cobrança via WhatsApp
            </Button>
          </Card>

          {/* MetaText */}
          <div className='px-4 pb-3'>
            <p className='text-gray-500 dark:text-gray-400 text-sm font-normal leading-normal'>
              {filteredInvoices?.length || 0} faturas encontradas
            </p>
          </div>

          {/* Table */}
          <Card className='overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#101722]'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='bg-gray-50 dark:bg-white/5'>
                    <TableHead className='px-6 py-4 w-12'>
                      <Checkbox
                        checked={
                          filteredInvoices &&
                          filteredInvoices.length > 0 &&
                          selectedItems.length === filteredInvoices.length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className='px-6 py-4 font-medium text-gray-900 dark:text-white'>
                      Cliente
                    </TableHead>
                    <TableHead className='px-6 py-4 font-medium text-gray-900 dark:text-white'>
                      Serviço
                    </TableHead>
                    <TableHead className='px-6 py-4 font-medium text-gray-900 dark:text-white'>
                      Data
                    </TableHead>
                    <TableHead className='px-6 py-4 font-medium text-gray-900 dark:text-white'>
                      Duração
                    </TableHead>
                    <TableHead className='px-6 py-4 font-medium text-gray-900 dark:text-white'>
                      Valor
                    </TableHead>
                    <TableHead className='px-6 py-4 font-medium text-gray-900 dark:text-white'>
                      Status
                    </TableHead>
                    <TableHead className='relative px-6 py-4'>
                      <span className='sr-only'>Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className='px-6 py-8 text-center text-gray-500'
                      >
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredInvoices && filteredInvoices.length > 0 ? (
                    filteredInvoices.map((invoice) => (
                      <TableRow
                        key={invoice.id}
                        className='hover:bg-gray-50/50 dark:hover:bg-white/5'
                      >
                        <TableCell className='px-6 py-4'>
                          <Checkbox
                            checked={selectedItems.includes(invoice.id)}
                            onCheckedChange={() => toggleSelect(invoice.id)}
                          />
                        </TableCell>
                        <TableCell className='px-6 py-4 font-medium text-gray-900 dark:text-white'>
                          {invoice.clientName}
                        </TableCell>
                        <TableCell className='px-6 py-4 text-gray-500 dark:text-gray-400'>
                          {invoice.serviceName}
                        </TableCell>
                        <TableCell className='px-6 py-4 text-gray-500 dark:text-gray-400'>
                          {format(new Date(invoice.date), 'dd/MM/yyyy', {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell className='px-6 py-4 text-gray-500 dark:text-gray-400'>
                          {invoice.duration}
                        </TableCell>
                        <TableCell className='px-6 py-4 text-gray-500 dark:text-gray-400'>
                          {formatCurrency(invoice.amount)}
                        </TableCell>
                        <TableCell className='px-6 py-4'>
                          {getStatusBadge(invoice.status)}
                        </TableCell>
                        <TableCell className='px-6 py-4 text-right'>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8'
                            onClick={() => {
                              setSelectedRecordId(invoice.id);
                              setIsDetailsModalOpen(true);
                            }}
                          >
                            <MoreHorizontal className='w-4 h-4' />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className='px-6 py-8 text-center text-gray-500'
                      >
                        Nenhuma fatura encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
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
