import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Edit, CheckCircle, ExternalLink, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'wouter';
import { generateReceiptPDF } from '@/utils/receipt-pdf-generator';
import { useAuth } from '@/hooks/use-auth';
import { ReceiptPreviewDialog } from './receipt-preview-dialog';

interface FinancialRecord {
  id: string;
  description: string;
  clientName: string;
  clientId: string;
  amount: number;
  ticketId: string;
  ticketNumber: string;
  dueDate: string;
  paidDate?: string;
  status: 'PENDENTE' | 'PAGO' | 'ATRASADO';
}

interface ModalDetalhesRegistroFinanceiroProps {
  recordId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (recordId: string) => void;
}

export function ModalDetalhesRegistroFinanceiro({
  recordId,
  open,
  onOpenChange,
  onEdit,
}: ModalDetalhesRegistroFinanceiroProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const { data: record, isLoading } = useQuery<FinancialRecord>({
    queryKey: ['/api/financial/records', recordId],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/financial-records/${recordId}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar registro financeiro');
      return response.json();
    },
    enabled: !!recordId && open,
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'PATCH',
        `/api/financial-records/${recordId}`,
        { status: 'paid', paidAt: new Date().toISOString() }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao marcar como pago');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/financial/records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/financial/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/financial/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/financial/invoices'] });
      toast({
        title: 'Registro marcado como pago',
        description: 'O registro foi marcado como pago com sucesso.',
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao marcar como pago',
        description: error.message,
      });
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAGO':
      case 'paid':
        return (
          <Badge className='bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'>
            Pago
          </Badge>
        );
      case 'PENDENTE':
      case 'pending':
        return (
          <Badge className='bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'>
            Pendente
          </Badge>
        );
      case 'ATRASADO':
      case 'overdue':
        return (
          <Badge className='bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'>
            Atrasado
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800'>
        <DialogHeader>
          <DialogTitle className='text-gray-900 dark:text-white text-2xl font-bold leading-tight'>
            Detalhes do Registro Financeiro
          </DialogTitle>
          <DialogDescription className='sr-only'>
            Informacoes do registro financeiro selecionado.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className='flex items-center justify-center py-12'>
            <p className='text-gray-500 dark:text-gray-400'>Carregando...</p>
          </div>
        ) : !record ? (
          <div className='flex items-center justify-center py-12'>
            <p className='text-gray-500 dark:text-gray-400'>
              Registro não encontrado
            </p>
          </div>
        ) : (
          <div className='space-y-6'>
            <div className='flex gap-4 items-center'>
              <span className='text-gray-600 dark:text-gray-400 text-sm font-medium'>
                Status
              </span>
              {getStatusBadge(record.status)}
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4'>
              <div className='flex flex-col gap-1 border-t border-solid border-gray-200 dark:border-gray-800 py-4'>
                <p className='text-gray-600 dark:text-gray-400 text-sm font-normal leading-normal'>
                  Descrição
                </p>
                <p className='text-gray-900 dark:text-white text-base font-normal leading-normal'>
                  {record.description || 'N/A'}
                </p>
              </div>

              <div className='flex flex-col gap-1 border-t border-solid border-gray-200 dark:border-gray-800 py-4'>
                <p className='text-gray-600 dark:text-gray-400 text-sm font-normal leading-normal'>
                  Cliente
                </p>
                <Link href={`/clientes/${record.clientId}`}>
                  <a className='text-[#3880f5] hover:underline text-base font-normal leading-normal flex items-center gap-1.5'>
                    {record.clientName}
                    <ExternalLink className='w-4 h-4' />
                  </a>
                </Link>
              </div>

              <div className='flex flex-col gap-1 border-t border-solid border-gray-200 dark:border-gray-800 py-4'>
                <p className='text-gray-600 dark:text-gray-400 text-sm font-normal leading-normal'>
                  Valor
                </p>
                <p className='text-gray-900 dark:text-white text-base font-semibold leading-normal'>
                  {formatCurrency(record.amount)}
                </p>
              </div>

              <div className='flex flex-col gap-1 border-t border-solid border-gray-200 dark:border-gray-800 py-4'>
                <p className='text-gray-600 dark:text-gray-400 text-sm font-normal leading-normal'>
                  Chamado Associado
                </p>
                {record.ticketId ? (
                  <Link href={`/chamados/${record.ticketId}`}>
                    <a className='text-[#3880f5] hover:underline text-base font-normal leading-normal flex items-center gap-1.5'>
                      Chamado #
                      {record.ticketNumber || record.ticketId.slice(0, 8)}
                      <ExternalLink className='w-4 h-4' />
                    </a>
                  </Link>
                ) : (
                  <p className='text-gray-500 dark:text-gray-400 text-base font-normal leading-normal italic'>
                    Nenhum chamado associado
                  </p>
                )}
              </div>

              <div className='flex flex-col gap-1 border-t border-solid border-gray-200 dark:border-gray-800 py-4'>
                <p className='text-gray-600 dark:text-gray-400 text-sm font-normal leading-normal'>
                  Data de Vencimento
                </p>
                <p className='text-gray-900 dark:text-white text-base font-normal leading-normal'>
                  {format(new Date(record.dueDate), 'dd/MM/yyyy', {
                    locale: ptBR,
                  })}
                </p>
              </div>

              <div className='flex flex-col gap-1 border-t border-solid border-gray-200 dark:border-gray-800 py-4'>
                <p className='text-gray-600 dark:text-gray-400 text-sm font-normal leading-normal'>
                  Data de Pagamento
                </p>
                <p className='text-gray-500 dark:text-gray-400 text-base font-normal leading-normal italic'>
                  {record.paidDate
                    ? format(new Date(record.paidDate), 'dd/MM/yyyy', {
                        locale: ptBR,
                      })
                    : 'Não pago'}
                </p>
              </div>
            </div>

            <div className='flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800'>
              <Button
                variant='outline'
                className='flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700'
                onClick={() => {
                  if (record && user) {
                    setReceiptData({
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
                        name: record.clientName || 'Não informado',
                      },
                      ticket: {
                        id: record.ticketId || record.id,
                        serviceName: record.description || 'Serviço Prestado',
                        date: record.paidDate || record.dueDate || new Date().toISOString(),
                        amount: record.amount,
                        description: record.description,
                      },
                    });
                    setIsReceiptModalOpen(true);
                  }
                }}
              >
                <FileText className='w-4 h-4 mr-2' />
                <span className='truncate'>Emitir Recibo</span>
              </Button>

              <Button
                variant='outline'
                className='flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700'
                onClick={() => {
                  if (onEdit) {
                    onEdit(record.id);
                  }
                  onOpenChange(false);
                }}
              >
                <Edit className='w-4 h-4 mr-2' />
                <span className='truncate'>Editar Registro</span>
              </Button>
              {(record.status === 'PENDENTE' ||
                record.status === 'pending' ||
                record.status === 'ATRASADO' ||
                record.status === 'overdue') && (
                <Button
                  className='flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#3880f5] text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-[#3880f5]/90 transition-colors'
                  onClick={() => markAsPaidMutation.mutate()}
                  disabled={markAsPaidMutation.isPending}
                >
                  <CheckCircle className='w-4 h-4 mr-2' />
                  <span className='truncate'>
                    {markAsPaidMutation.isPending
                      ? 'Processando...'
                      : 'Marcar como Pago'}
                  </span>
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      {receiptData && (
        <ReceiptPreviewDialog
          isOpen={isReceiptModalOpen}
          onClose={() => {
            setIsReceiptModalOpen(false);
            setReceiptData(null);
          }}
          data={receiptData}
        />
      )}
    </Dialog>
  );
}




















