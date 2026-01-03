import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { X, Edit, CheckCircle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'wouter';
import { FinancialActions } from '@/components/financial-actions';

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

export default function DetalhesRegistroFinanceiro() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const recordId = window.location.pathname.split('/').pop() || '';

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
    enabled: !!recordId,
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
        return (
          <Badge className='bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'>
            Pago
          </Badge>
        );
      case 'PENDENTE':
        return (
          <Badge className='bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'>
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

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-[#101722]'>
        <p className='text-zinc-100'>Carregando...</p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-[#101722]'>
        <p className='text-zinc-100'>Registro não encontrado</p>
      </div>
    );
  }

  return (
    <div className='relative flex h-auto min-h-screen w-full flex-col bg-[#101722] font-display overflow-x-hidden antialiased'>
      <div className='layout-container flex h-full min-h-screen grow flex-col'>
        <div className='px-4 sm:px-10 flex flex-1 items-center justify-center py-10'>
          <Card className='layout-content-container flex flex-col w-full max-w-3xl flex-1 bg-[#101722] rounded-xl shadow-lg border border-zinc-800'>
            <div className='flex flex-wrap items-center justify-between gap-4 p-6 border-b border-zinc-800'>
              <h1 className='text-zinc-100 text-2xl font-bold leading-tight'>
                Detalhes do Registro Financeiro
              </h1>
              <Button
                variant='ghost'
                size='icon'
                className='flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors'
                onClick={() => setLocation('/pendencias-financeiras')}
              >
                <X className='w-5 h-5' />
              </Button>
            </div>
            <div className='p-6 space-y-8'>
              <div className='flex gap-4 items-center'>
                <span className='text-zinc-400 text-sm font-medium'>
                  Status
                </span>
                {getStatusBadge(record.status)}
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1'>
                <div className='flex flex-col gap-1 border-t border-solid border-zinc-800 py-4'>
                  <p className='text-zinc-400 text-sm font-normal leading-normal'>
                    Descrição
                  </p>
                  <p className='text-zinc-100 text-base font-normal leading-normal'>
                    {record.description}
                  </p>
                </div>
                <div className='flex flex-col gap-1 border-t border-solid border-zinc-800 py-4'>
                  <p className='text-zinc-400 text-sm font-normal leading-normal'>
                    Cliente
                  </p>
                  <Link href={`/clientes/${record.clientId}`}>
                    <a className='text-[#3880f5] hover:underline text-base font-normal leading-normal flex items-center gap-1.5'>
                      {record.clientName}
                      <ExternalLink className='w-4 h-4' />
                    </a>
                  </Link>
                </div>
                <div className='flex flex-col gap-1 border-t border-solid border-zinc-800 py-4'>
                  <p className='text-zinc-400 text-sm font-normal leading-normal'>
                    Valor
                  </p>
                  <p className='text-zinc-100 text-base font-semibold leading-normal'>
                    {formatCurrency(record.amount)}
                  </p>
                </div>
                <div className='flex flex-col gap-1 border-t border-solid border-zinc-800 py-4'>
                  <p className='text-zinc-400 text-sm font-normal leading-normal'>
                    Chamado Associado
                  </p>
                  <Link href={`/chamados/${record.ticketId}`}>
                    <a className='text-[#3880f5] hover:underline text-base font-normal leading-normal flex items-center gap-1.5'>
                      Chamado #{record.ticketNumber}
                      <ExternalLink className='w-4 h-4' />
                    </a>
                  </Link>
                </div>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1'>
                <div className='flex flex-col gap-1 border-t border-solid border-zinc-800 py-4'>
                  <p className='text-zinc-400 text-sm font-normal leading-normal'>
                    Data de Vencimento
                  </p>
                  <p className='text-zinc-100 text-base font-normal leading-normal'>
                    {format(new Date(record.dueDate), 'dd/MM/yyyy', {
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <div className='flex flex-col gap-1 border-t border-solid border-zinc-800 py-4'>
                  <p className='text-zinc-400 text-sm font-normal leading-normal'>
                    Data de Pagamento
                  </p>
                  <p className='text-zinc-500 text-base font-normal leading-normal italic'>
                    {record.paidDate
                      ? format(new Date(record.paidDate), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })
                      : 'Não pago'}
                  </p>
                </div>
              </div>
            </div>
            <div className='flex justify-end border-t border-zinc-800'>
              <div className='flex flex-1 gap-3 flex-wrap p-6 justify-end'>
                <Button
                  variant='outline'
                  className='flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-zinc-800 text-zinc-100 text-sm font-bold leading-normal tracking-[0.015em] hover:bg-zinc-700 transition-colors'
                  onClick={() =>
                    setLocation(`/pendencias-financeiras?edit=${recordId}`)
                  }
                >
                  <Edit className='w-4 h-4 mr-2' />
                  <span className='truncate'>Editar Registro</span>
                </Button>
                {record.ticketId && record.status !== 'PAGO' && (
                  <FinancialActions ticketId={record.ticketId} variant='default' />
                )}
                {record.status !== 'PAGO' && !record.ticketId && (
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
          </Card>
        </div>
      </div>
    </div>
  );
}











