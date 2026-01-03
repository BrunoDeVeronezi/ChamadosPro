import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useLocation } from 'wouter';

interface OverduePaymentsData {
  overdueCount: number;
  overdueAmount: number;
}

export function OverduePaymentsBanner() {
  const [, setLocation] = useLocation();

  // Buscar dados de pagamentos vencidos
  const { data: financialRecords = [] } = useQuery({
    queryKey: ['/api/financial-records'],
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['/api/tickets'],
  });

  // Calcular pagamentos vencidos
  const overdueData: OverduePaymentsData = (() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    const normalizeAmount = (val: string | number) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return Number.isFinite(num) ? num : 0;
    };

    const parseDate = (value: string | Date | null | undefined) => {
      if (!value) return null;
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    };

    const normalizeStatus = (status: string) => {
      return (status || '').toString().toUpperCase().trim();
    };

    const pendingRecords = financialRecords.filter((record: any) => {
      const status = record.status || 'pending';
      if (status !== 'pending') return false;

      if (!record.ticketId) return false;

      const ticket = tickets.find((t: any) => t.id === record.ticketId);
      if (!ticket) return false;

      const ticketStatus = normalizeStatus((ticket.status || '').toString());
      if (
        ticketStatus !== 'COMPLETED' &&
        ticketStatus !== 'CONCLUIDO' &&
        ticketStatus !== 'CONCLUÍDO'
      ) {
        return false;
      }

      let completionDate: Date | null = null;
      if (ticket.completedAt) {
        completionDate = new Date(ticket.completedAt);
      } else if (ticket.stoppedAt) {
        completionDate = new Date(ticket.stoppedAt);
      } else if ((ticket as any).scheduledDate) {
        completionDate = new Date((ticket as any).scheduledDate);
      }

      if (!completionDate || isNaN(completionDate.getTime())) {
        return false;
      }

      return (
        completionDate >= firstDayOfMonth && completionDate <= lastDayOfMonth
      );
    });

    const overdueRecords = pendingRecords.filter((record: any) => {
      const dueDate = parseDate(record.dueDate);
      if (!dueDate) return false;
      return dueDate < now;
    });

    const overdueCount = overdueRecords.length;
    const overdueAmount = overdueRecords.reduce(
      (sum: number, record: any) => sum + normalizeAmount(record.amount),
      0
    );

    return { overdueCount, overdueAmount };
  })();

  if (overdueData.overdueCount === 0) {
    return null;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Card className='border-red-500/50 bg-red-500/10 animate-pulse-slow rounded-none border-x-0 border-t-0'>
      <CardContent className='p-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <AlertTriangle className='h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0' />
            <div>
              <p className='font-semibold text-red-600 dark:text-red-400 text-sm'>
                Há {overdueData.overdueCount} chamado(s) vencido(s)!
              </p>
              <p className='text-xs text-muted-foreground'>
                Total vencido: {formatCurrency(overdueData.overdueAmount)}
              </p>
            </div>
          </div>
          <Button
            variant='default'
            size='sm'
            onClick={() => {
              setLocation('/');
              // Aguardar um pouco para garantir que o dashboard carregou
              setTimeout(() => {
                // Disparar evento customizado para o dashboard abrir a view de pendentes
                window.dispatchEvent(
                  new CustomEvent('showPendingPayments', { detail: true })
                );
              }, 100);
            }}
            className='bg-red-600 hover:bg-red-700 text-white'
          >
            Ver chamados vencidos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


























