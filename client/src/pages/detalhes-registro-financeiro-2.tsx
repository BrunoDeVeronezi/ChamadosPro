import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { X, Edit, CheckCircle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'wouter';
import { maskCurrency } from '@/lib/masks';

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

export default function DetalhesRegistroFinanceiro2() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const recordId = window.location.pathname.split('/').pop() || '';
  const [isOpen, setIsOpen] = useState(true);

  const { data: record, isLoading } = useQuery<FinancialRecord>({
    queryKey: ['/api/financial/records', recordId],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/financial/records/${recordId}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar registro financeiro');
      return response.json();
    },
    enabled: !!recordId && isOpen,
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'PUT',
        `/api/financial/records/${recordId}/mark-paid`,
        {}
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao marcar como pago');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/financial/records'] });
      toast({
        title: 'Registro marcado como pago',
        description: 'O registro foi marcado como pago com sucesso.',
      });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao marcar como pago',
        description: error.message,
      });
    },
  });

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className='font-display bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center'>
        <p className='text-gray-500 dark:text-gray-400'>Carregando...</p>
      </div>
    );
  }

  if (!record) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className='w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800'>
        <DialogHeader>
          <div className='flex flex-wrap items-center justify-between gap-4 p-6 border-b border-zinc-200 dark:border-zinc-800'>
            <DialogTitle className='text-zinc-900 dark:text-zinc-100 text-2xl font-bold leading-tight'>
              Detalhes do Registro Financeiro
            </DialogTitle>
            <DialogDescription className='sr-only'>
              Informacoes do registro financeiro selecionado.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className='p-6 space-y-8'>
          {/* Chips (Status) */}
          <div className='flex gap-4 items-center'>
            <span className='text-zinc-500 dark:text-zinc-400 text-sm font-medium'>
              Status
            </span>
            <Badge className='flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-orange-100 dark:bg-orange-900/40 px-3'>
              <p className='text-orange-600 dark:text-orange-300 text-sm font-medium leading-normal'>
                {record.status}
              </p>
            </Badge>
          </div>

          {/* DescriptionList (Main Details) */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1'>
            <div className='flex flex-col gap-1 border-t border-solid border-zinc-200 dark:border-zinc-800 py-4'>
              <p className='text-zinc-500 dark:text-zinc-400 text-sm font-normal leading-normal'>
                Descrição
              </p>
              <p className='text-zinc-900 dark:text-zinc-100 text-base font-normal leading-normal'>
                {record.description}
              </p>
            </div>
            <div className='flex flex-col gap-1 border-t border-solid border-zinc-200 dark:border-zinc-800 py-4'>
              <p className='text-zinc-500 dark:text-zinc-400 text-sm font-normal leading-normal'>
                Cliente
              </p>
              <Link
                href={`/clientes/${record.clientId}`}
                className='text-primary hover:underline text-base font-normal leading-normal flex items-center gap-1.5'
              >
                {record.clientName}
                <ExternalLink className='w-4 h-4' />
              </Link>
            </div>
            <div className='flex flex-col gap-1 border-t border-solid border-zinc-200 dark:border-zinc-800 py-4'>
              <p className='text-zinc-500 dark:text-zinc-400 text-sm font-normal leading-normal'>
                Valor
              </p>
              <p className='text-zinc-900 dark:text-zinc-100 text-base font-semibold leading-normal'>
                {maskCurrency(record.amount.toString())}
              </p>
            </div>
            <div className='flex flex-col gap-1 border-t border-solid border-zinc-200 dark:border-zinc-800 py-4'>
              <p className='text-zinc-500 dark:text-zinc-400 text-sm font-normal leading-normal'>
                Chamado Associado
              </p>
              <Link
                href={`/chamado/${record.ticketId}`}
                className='text-primary hover:underline text-base font-normal leading-normal flex items-center gap-1.5'
              >
                Chamado #{record.ticketNumber}
                <ExternalLink className='w-4 h-4' />
              </Link>
            </div>
          </div>

          {/* DescriptionList (Dates) */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1'>
            <div className='flex flex-col gap-1 border-t border-solid border-zinc-200 dark:border-zinc-800 py-4'>
              <p className='text-zinc-500 dark:text-zinc-400 text-sm font-normal leading-normal'>
                Data de Vencimento
              </p>
              <p className='text-zinc-900 dark:text-zinc-100 text-base font-normal leading-normal'>
                {formatDate(record.dueDate)}
              </p>
            </div>
            <div className='flex flex-col gap-1 border-t border-solid border-zinc-200 dark:border-zinc-800 py-4'>
              <p className='text-zinc-500 dark:text-zinc-400 text-sm font-normal leading-normal'>
                Data de Pagamento
              </p>
              <p className='text-zinc-400 dark:text-zinc-500 text-base font-normal leading-normal italic'>
                {record.paidDate ? formatDate(record.paidDate) : 'Não pago'}
              </p>
            </div>
          </div>
        </div>

        {/* ButtonGroup */}
        <div className='flex justify-end border-t border-zinc-200 dark:border-zinc-800'>
          <div className='flex flex-1 gap-3 flex-wrap p-6 justify-end'>
            <Button
              variant='outline'
              className='flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-bold leading-normal tracking-[0.015em] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors'
              onClick={() => {
                // TODO: Implementar edição
              }}
            >
              <Edit className='w-4 h-4 mr-2' />
              <span className='truncate'>Editar Registro</span>
            </Button>
            {record.status !== 'PAGO' && (
              <Button
                className='flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors'
                onClick={() => markAsPaidMutation.mutate()}
                disabled={markAsPaidMutation.isPending}
              >
                <CheckCircle className='w-4 h-4 mr-2' />
                <span className='truncate'>
                  {markAsPaidMutation.isPending
                    ? 'Marcando...'
                    : 'Marcar como Pago'}
                </span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}






















