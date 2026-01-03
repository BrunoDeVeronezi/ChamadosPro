import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { Search, Send } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { maskCurrency } from '@/lib/masks';

interface Invoice {
  id: string;
  ticketNumber: string;
  clientName: string;
  serviceName: string;
  startDate: string;
  endDate: string;
  duration: string;
  amount: number;
}

export default function Faturamento2() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ['/api/financial/invoices', searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      const response = await apiRequest(
        'GET',
        `/api/financial/invoices?${params.toString()}`,
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
    if (selectedItems.length === filteredInvoices?.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredInvoices?.map((i) => i.id) || []);
    }
  };

  return (
    <div className='bg-background-dark font-display'>
      <div className='flex h-screen'>
        <aside className='w-64 flex-shrink-0 bg-gray-900/50 border-r border-gray-800'>
          <div className='flex h-full flex-col justify-between p-4'>
            <div className='flex flex-col gap-4'>
              <div className='flex items-center gap-3'>
                <div className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-primary/20'></div>
                <div className='flex flex-col'>
                  <h1 className='text-white text-base font-medium leading-normal'>
                    ChamadosPro
                  </h1>
                  <p className='text-gray-400 text-sm font-normal leading-normal'>
                    Técnico de TI
                  </p>
                </div>
              </div>
              <nav className='flex flex-col gap-2 mt-4'>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors'
                  href='#'
                >
                  <span>📊</span>
                  <p className='text-sm font-medium leading-normal'>
                    Dashboard
                  </p>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors'
                  href='#'
                >
                  <span>👥</span>
                  <p className='text-sm font-medium leading-normal'>Clientes</p>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors'
                  href='#'
                >
                  <span>📄</span>
                  <p className='text-sm font-medium leading-normal'>Chamados</p>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors'
                  href='#'
                >
                  <span>📅</span>
                  <p className='text-sm font-medium leading-normal'>Agenda</p>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/20 text-white'
                  href='#'
                >
                  <span>💰</span>
                  <p className='text-sm font-medium leading-normal'>
                    Faturamento
                  </p>
                </a>
              </nav>
            </div>
            <div className='flex flex-col gap-2'>
              <a
                className='flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors'
                href='#'
              >
                <span>⚙️</span>
                <p className='text-sm font-medium leading-normal'>
                  Configurações
                </p>
              </a>
              <a
                className='flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-900/30 transition-colors'
                href='#'
              >
                <span>🚪</span>
                <p className='text-sm font-medium leading-normal'>Sair</p>
              </a>
            </div>
          </div>
        </aside>

        <main className='flex-1 overflow-y-auto'>
          <div className='p-8 max-w-7xl mx-auto'>
            <header className='flex flex-wrap justify-between items-center gap-4 mb-6'>
              <h1 className='text-white text-3xl font-bold tracking-tight'>
                Faturamento (Folhas de Cobrança)
              </h1>
            </header>

            <div className='flex flex-wrap justify-between items-center gap-4 p-4 bg-gray-900 rounded-xl border border-gray-800 mb-6'>
              <div className='flex gap-4 items-center'>
                <div className='relative'>
                  <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5' />
                  <Input
                    className='pl-10 pr-4 py-2 w-64 border border-gray-700 rounded-lg bg-gray-800 focus:ring-2 focus:ring-primary focus:border-primary text-gray-100 placeholder:text-gray-400'
                    placeholder='Filtrar por Cliente...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className='flex items-center gap-2'>
                  <Checkbox
                    id='select-all'
                    checked={
                      filteredInvoices &&
                      filteredInvoices.length > 0 &&
                      selectedItems.length === filteredInvoices.length
                    }
                    onCheckedChange={toggleSelectAll}
                    className='h-5 w-5 rounded border-gray-600 bg-transparent text-primary focus:ring-primary dark:ring-offset-background-dark checked:bg-primary checked:border-primary'
                  />
                  <label
                    className='text-sm text-gray-300 cursor-pointer'
                    htmlFor='select-all'
                  >
                    Selecionar todos
                  </label>
                </div>
              </div>
            </div>

            <Button
              className='flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-wide shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-6'
              disabled={selectedItems.length === 0}
            >
              <Send className='w-5 h-5' />
              <span className='truncate'>Envio de Cobrança via WhatsApp</span>
            </Button>

            <div className='grid grid-cols-1 @2xl:grid-cols-2 gap-6'>
              {isLoading ? (
                <div className='col-span-full text-center py-12 text-gray-400'>
                  Carregando...
                </div>
              ) : filteredInvoices && filteredInvoices.length > 0 ? (
                filteredInvoices.map((invoice) => (
                  <Card
                    key={invoice.id}
                    className='bg-white rounded-lg shadow-sm p-6 relative'
                  >
                    <Checkbox
                      checked={selectedItems.includes(invoice.id)}
                      onCheckedChange={() => toggleSelect(invoice.id)}
                      className='absolute top-4 left-4 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary'
                    />
                    <div className='text-center mb-6'>
                      <h2 className='text-2xl font-bold text-gray-800'>
                        Folha de Cobrança
                      </h2>
                      <p className='text-sm text-gray-500'>
                        #{invoice.ticketNumber}
                      </p>
                    </div>
                    <div className='space-y-4'>
                      <div className='flex justify-between'>
                        <span className='font-medium text-gray-600'>
                          Cliente:
                        </span>
                        <span className='text-gray-800 font-semibold'>
                          {invoice.clientName}
                        </span>
                      </div>
                      <div className='flex justify-between'>
                        <span className='font-medium text-gray-600'>
                          Serviço:
                        </span>
                        <span className='text-gray-800'>
                          {invoice.serviceName}
                        </span>
                      </div>
                      <div className='border-t border-gray-200 my-4'></div>
                      <div className='flex justify-between'>
                        <span className='font-medium text-gray-600'>
                          Data Início:
                        </span>
                        <span className='text-gray-800'>
                          {formatDate(invoice.startDate)}
                        </span>
                      </div>
                      <div className='flex justify-between'>
                        <span className='font-medium text-gray-600'>
                          Data Conclusão:
                        </span>
                        <span className='text-gray-800'>
                          {formatDate(invoice.endDate)}
                        </span>
                      </div>
                      <div className='flex justify-between'>
                        <span className='font-medium text-gray-600'>
                          Duração:
                        </span>
                        <span className='text-gray-800'>
                          {invoice.duration}
                        </span>
                      </div>
                      <div className='border-t border-gray-200 my-4'></div>
                      <div className='flex justify-between items-center bg-gray-50 p-3 rounded-md'>
                        <span className='text-lg font-bold text-gray-800'>
                          Total:
                        </span>
                        <span className='text-xl font-bold text-primary'>
                          {maskCurrency(invoice.amount.toString())}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className='col-span-full text-center py-12 text-gray-400'>
                  Nenhuma folha de cobrança encontrada
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
























